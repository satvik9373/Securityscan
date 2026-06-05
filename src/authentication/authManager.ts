import * as vscode from 'vscode';
import axios from 'axios';
import { AuthState, AuthUser } from '../types';

const SESSION_KEY = 'securescan.session';
const USER_KEY = 'securescan.user';

export class AuthManager {
  private context: vscode.ExtensionContext;
  private state: AuthState = { isAuthenticated: false, user: null, sessionToken: null };
  private onStateChangeEmitter = new vscode.EventEmitter<AuthState>();
  readonly onStateChange = this.onStateChangeEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadPersistedState();
  }

  private async loadPersistedState(): Promise<void> {
    const token = await this.context.secrets.get(SESSION_KEY);
    const userJson = this.context.globalState.get<string>(USER_KEY);

    if (token && userJson) {
      try {
        const user = JSON.parse(userJson) as AuthUser;
        const valid = await this.verifyToken(token);
        if (valid) {
          this.state = { isAuthenticated: true, user, sessionToken: token };
          this.onStateChangeEmitter.fire(this.state);
          return;
        }
      } catch {
        // Token invalid, clear
      }
    }
    await this.clearSession();
  }

  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const clerkKey = this.getClerkPublishableKey();
    if (!clerkKey) {
      return { success: false, error: 'Clerk publishable key not configured. Set CLERK_PUBLISHABLE_KEY in extension settings.' };
    }

    try {
      // Use Clerk's Frontend API to create a session
      const frontendApiBase = this.getFrontendApiBase(clerkKey);

      // Step 1: Create sign-in attempt
      const signInResp = await axios.post(
        `${frontendApiBase}/v1/client/sign_ins`,
        {
          identifier: email,
          password,
          strategy: 'password',
        },
        {
          headers: {
            'Authorization': `Bearer ${clerkKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const signIn = signInResp.data?.response ?? signInResp.data;

      if (signIn?.status === 'complete') {
        const sessionToken = signIn.created_session_id ?? signIn.client?.sessions?.[0]?.id;
        const userData = signIn.created_user_id
          ? await this.fetchUser(frontendApiBase, clerkKey, signIn.created_user_id)
          : null;

        if (sessionToken) {
          await this.persistSession(sessionToken, userData);
          return { success: true };
        }
      }

      return { success: false, error: 'Authentication failed. Please check your credentials.' };
    } catch (err: unknown) {
      const error = err as { response?: { data?: { errors?: Array<{ message: string }> } } };
      const msg = error?.response?.data?.errors?.[0]?.message ?? 'Authentication failed';
      return { success: false, error: msg };
    }
  }

  async signInWithToken(token: string, user: AuthUser): Promise<void> {
    await this.persistSession(token, user);
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

  private async verifyToken(token: string): Promise<boolean> {
    const clerkKey = this.getClerkPublishableKey();
    if (!clerkKey || !token) return false;

    try {
      const frontendApiBase = this.getFrontendApiBase(clerkKey);
      const resp = await axios.get(`${frontendApiBase}/v1/client`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });
      return resp.status === 200;
    } catch {
      return false;
    }
  }

  private async fetchUser(base: string, key: string, userId: string): Promise<AuthUser | null> {
    try {
      const resp = await axios.get(`${base}/v1/users/${userId}`, {
        headers: { Authorization: `Bearer ${key}` },
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

  private getClerkPublishableKey(): string | undefined {
    const config = vscode.workspace.getConfiguration('securescan');
    return config.get<string>('clerkPublishableKey') || process.env['CLERK_PUBLISHABLE_KEY'];
  }

  private getFrontendApiBase(publishableKey: string): string {
    // Extract domain from publishable key: pk_test_xxx -> clerk.xxx
    const parts = publishableKey.split('_');
    if (parts.length >= 3) {
      const encoded = parts[2].replace(/\.$/, '');
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8').replace(/\.$/, '');
        return `https://${decoded}`;
      } catch {
        // fallback
      }
    }
    return 'https://api.clerk.com';
  }
}
