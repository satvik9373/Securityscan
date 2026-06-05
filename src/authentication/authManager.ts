import * as vscode from 'vscode';
import axios from 'axios';
import { AuthState, AuthUser } from '../types';
import { findAvailablePort, startOAuthCallbackServer } from './oauthServer';
import { getEnvVar } from '../utils/envReader';

const SESSION_KEY = 'securescan.session';
const USER_KEY = 'securescan.user';

export type OAuthProvider = 'google' | 'github';

export class AuthManager {
  private context: vscode.ExtensionContext;
  private state: AuthState = { isAuthenticated: false, user: null, sessionToken: null };
  private onStateChangeEmitter = new vscode.EventEmitter<AuthState>();
  readonly onStateChange = this.onStateChangeEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    void this.loadPersistedState();
  }

  private async loadPersistedState(): Promise<void> {
    const token = await this.context.secrets.get(SESSION_KEY);
    const userJson = this.context.globalState.get<string>(USER_KEY);

    if (token && userJson) {
      try {
        const user = JSON.parse(userJson) as AuthUser;
        this.state = { isAuthenticated: true, user, sessionToken: token };
        this.onStateChangeEmitter.fire(this.state);
        return;
      } catch {
        // corrupted — clear
      }
    }
    await this.clearSession();
  }

  // ── OAuth Sign In ──────────────────────────────────────────────────────────

  async signInWithOAuth(provider: OAuthProvider): Promise<{ success: boolean; error?: string }> {
    const publishableKey = this.getClerkPublishableKey();
    if (!publishableKey) {
      return {
        success: false,
        error: 'Clerk publishable key not found. Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env.local file.',
      };
    }

    try {
      const port = await findAvailablePort();
      const callbackUrl = `http://127.0.0.1:${port}/callback`;
      const frontendApi = this.getFrontendApiBase(publishableKey);

      // Step 1: Create a sign-in attempt with OAuth strategy
      const signInResp = await axios.post(
        `${frontendApi}/v1/client/sign_ins`,
        {
          strategy: `oauth_${provider}`,
          redirect_url: callbackUrl,
          action_complete_redirect_url: callbackUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${publishableKey}`,
            'Content-Type': 'application/json',
            'Clerk-Backend-API-Version': '2024-10-01',
          },
          timeout: 10000,
        }
      );

      const signInData = signInResp.data?.response ?? signInResp.data;
      const redirectUrl =
        signInData?.first_factor_verification?.external_verification_redirect_url ??
        signInData?.external_verification_redirect_url;

      if (!redirectUrl) {
        return { success: false, error: 'Could not get OAuth redirect URL from Clerk.' };
      }

      // Step 2: Start local callback server BEFORE opening browser
      const serverPromise = startOAuthCallbackServer(port);

      // Step 3: Open browser for user to authenticate
      await vscode.env.openExternal(vscode.Uri.parse(redirectUrl));

      // Notify UI that browser is open
      this.onStateChangeEmitter.fire({ ...this.state });

      // Step 4: Wait for callback
      const result = await serverPromise;

      if (result.error) {
        return { success: false, error: result.error };
      }

      // Step 5: Get user info from Clerk using the session
      const user = await this.resolveUserFromCallback(
        frontendApi,
        publishableKey,
        result.dbJwt,
        result.sessionId,
        signInData?.id
      );

      const sessionToken = result.dbJwt ?? result.sessionId ?? signInData?.id ?? 'authenticated';
      await this.persistSession(sessionToken, user);

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OAuth authentication failed';
      return { success: false, error: msg };
    }
  }

  // ── Demo / Email Sign In (fallback) ────────────────────────────────────────

  async signInDemo(email: string): Promise<{ success: boolean; error?: string }> {
    const user: AuthUser = {
      id: `demo_${Date.now()}`,
      email,
      firstName: email.split('@')[0],
      lastName: undefined,
      imageUrl: undefined,
    };
    await this.persistSession(`demo_${Date.now()}`, user);
    return { success: true };
  }

  async signOut(): Promise<void> {
    await this.clearSession();
  }

  getState(): AuthState {
    return this.state;
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async resolveUserFromCallback(
    frontendApi: string,
    publishableKey: string,
    dbJwt?: string,
    sessionId?: string,
    signInId?: string
  ): Promise<AuthUser | null> {
    const secretKey = this.getClerkSecretKey();

    // Try Backend API if we have secret key + session ID
    if (secretKey && sessionId) {
      try {
        const sessResp = await axios.get(
          `https://api.clerk.com/v1/sessions/${sessionId}`,
          { headers: { Authorization: `Bearer ${secretKey}` }, timeout: 8000 }
        );
        const userId = sessResp.data?.user_id;
        if (userId) {
          return await this.fetchUserBySecretKey(secretKey, userId);
        }
      } catch {
        // fallback below
      }
    }

    // Try to get user from the active session via frontend API
    if (dbJwt) {
      try {
        const meResp = await axios.get(`${frontendApi}/v1/me`, {
          headers: { Authorization: `Bearer ${dbJwt}` },
          timeout: 8000,
        });
        const u = meResp.data?.response ?? meResp.data;
        if (u?.id) {
          return {
            id: u.id,
            email: u.email_addresses?.[0]?.email_address ?? '',
            firstName: u.first_name,
            lastName: u.last_name,
            imageUrl: u.image_url,
          };
        }
      } catch {
        // fallback
      }
    }

    return null;
  }

  private async fetchUserBySecretKey(secretKey: string, userId: string): Promise<AuthUser | null> {
    try {
      const resp = await axios.get(`https://api.clerk.com/v1/users/${userId}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
        timeout: 8000,
      });
      const u = resp.data;
      return {
        id: u.id,
        email: u.email_addresses?.[0]?.email_address ?? '',
        firstName: u.first_name,
        lastName: u.last_name,
        imageUrl: u.image_url,
      };
    } catch {
      return null;
    }
  }

  private async persistSession(token: string, user: AuthUser | null): Promise<void> {
    await this.context.secrets.store(SESSION_KEY, token);
    if (user) {
      await this.context.globalState.update(USER_KEY, JSON.stringify(user));
    }
    this.state = { isAuthenticated: true, user, sessionToken: token };
    this.onStateChangeEmitter.fire(this.state);
  }

  private async clearSession(): Promise<void> {
    await this.context.secrets.delete(SESSION_KEY);
    await this.context.globalState.update(USER_KEY, undefined);
    this.state = { isAuthenticated: false, user: null, sessionToken: null };
    this.onStateChangeEmitter.fire(this.state);
  }

  getClerkPublishableKey(): string | undefined {
    const config = vscode.workspace.getConfiguration('securescan');
    return (
      config.get<string>('clerkPublishableKey') ||
      getEnvVar('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_PUBLISHABLE_KEY')
    );
  }

  private getClerkSecretKey(): string | undefined {
    const config = vscode.workspace.getConfiguration('securescan');
    return (
      config.get<string>('clerkSecretKey') ||
      getEnvVar('CLERK_SECRET_KEY')
    );
  }

  getFrontendApiBase(publishableKey: string): string {
    // pk_test_BASE64. or pk_live_BASE64.
    const parts = publishableKey.split('_');
    if (parts.length >= 3) {
      const encoded = parts[2].replace(/\.+$/, '');
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8').replace(/\.+$/, '');
        if (decoded.includes('.') && decoded.length > 4) {
          return `https://${decoded}`;
        }
      } catch {
        // fall through
      }
    }
    return 'https://api.clerk.com';
  }
}
