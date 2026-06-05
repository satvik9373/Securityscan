import * as vscode from 'vscode';
import * as cp from 'child_process';
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
      } catch { /* corrupted */ }
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
      const frontendApi = this.getFrontendApiBase(publishableKey);

      // Server serves the auth page AND receives result via POST /done
      const serverPromise = startOAuthCallbackServer(port, publishableKey, frontendApi, provider);

      // Open local auth page in browser
      await this.openBrowser(`http://127.0.0.1:${port}/`, provider);

      void vscode.window.showInformationMessage(
        `SecureScan: Complete ${provider} sign-in in your browser, then return to VS Code.`,
        'Open Manually'
      ).then(action => {
        if (action === 'Open Manually') {
          void vscode.env.openExternal(vscode.Uri.parse(`http://127.0.0.1:${port}/`));
        }
      });

      const result = await serverPromise;

      if (result.error) {
        return { success: false, error: result.error };
      }

      // Build user from what the browser page reported
      let user: AuthUser | null = result.userId
        ? {
            id: result.userId,
            email: result.email ?? '',
            firstName: result.firstName,
            lastName: result.lastName,
            imageUrl: result.imageUrl,
          }
        : null;

      // Enrich via Backend API if we only have sessionId
      const secretKey = this.getClerkSecretKey();
      if (secretKey && result.sessionId && !result.userId) {
        user = await this.fetchUserBySessionId(secretKey, result.sessionId) ?? user;
      }

      await this.persistSession(result.sessionId ?? `session_${Date.now()}`, user);
      return { success: true };


    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OAuth authentication failed';
      return { success: false, error: msg };
    }
  }

  // ── Demo Sign In ───────────────────────────────────────────────────────────

  async signInDemo(email: string): Promise<{ success: boolean; error?: string }> {
    const user: AuthUser = {
      id: `demo_${Date.now()}`,
      email,
      firstName: email.split('@')[0],
    };
    await this.persistSession(`demo_${Date.now()}`, user);
    return { success: true };
  }

  async signOut(): Promise<void> {
    await this.clearSession();
  }

  getState(): AuthState { return this.state; }
  isAuthenticated(): boolean { return this.state.isAuthenticated; }

  // ── Browser opener ─────────────────────────────────────────────────────────

  private async openBrowser(url: string, provider: string): Promise<void> {
    // Method 1: VS Code API (works in most cases)
    try {
      const opened = await vscode.env.openExternal(vscode.Uri.parse(url));
      if (opened) {
        console.log(`[SecureScan] Opened browser via vscode.env.openExternal: ${url}`);
        return;
      }
    } catch (e) {
      console.warn('[SecureScan] openExternal failed:', e);
    }

    // Method 2: OS-specific shell command
    try {
      const cmd = this.getBrowserCommand(url);
      console.log(`[SecureScan] Opening browser via shell: ${cmd}`);
      await new Promise<void>((resolve, reject) => {
        cp.exec(cmd, { timeout: 5000 }, (err) => {
          if (err) { reject(err); } else { resolve(); }
        });
      });
      return;
    } catch (e) {
      console.warn('[SecureScan] Shell browser open failed:', e);
    }

    // Method 3: Show URL so user can open manually
    const action = await vscode.window.showErrorMessage(
      `SecureScan: Could not open browser automatically. Click "Open" or copy the URL to sign in with ${provider}.`,
      'Open',
      'Copy URL'
    );
    if (action === 'Open') {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    } else if (action === 'Copy URL') {
      await vscode.env.clipboard.writeText(url);
      vscode.window.showInformationMessage(`URL copied. Paste it in your browser: ${url}`);
    }
  }

  private getBrowserCommand(url: string): string {
    const escaped = url.replace(/"/g, '\\"');
    switch (process.platform) {
      case 'win32':
        // Use start with an empty title string to handle URLs with query params
        return `start "" "${escaped}"`;
      case 'darwin':
        return `open "${escaped}"`;
      default:
        // Linux — try xdg-open, sensible-browser, or x-www-browser
        return `xdg-open "${escaped}" || sensible-browser "${escaped}" || x-www-browser "${escaped}"`;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async fetchUserBySessionId(secretKey: string, sessionId: string): Promise<AuthUser | null> {
    try {
      const sessResp = await axios.get(`https://api.clerk.com/v1/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${secretKey}` }, timeout: 8000,
      });
      const userId = sessResp.data?.user_id;
      if (userId) return this.fetchUserBySecretKey(secretKey, userId);
    } catch { /* fallback */ }
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
    // Clerk publishable keys encode the frontend API host as base64 ending with "$"
    const parts = publishableKey.split('_');
    if (parts.length >= 3) {
      const encoded = parts[2].replace(/[.$]+$/, '');
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8').replace(/[.$\0\n\r]+$/, '');
        if (decoded.includes('.') && decoded.length > 4) {
          return `https://${decoded}`;
        }
      } catch { /* fall through */ }
    }
    return 'https://api.clerk.com';
  }
}
