import * as vscode from 'vscode';
import { AuthState, AuthUser } from '../types';

const USER_KEY = 'securescan.user';
const GITHUB_SCOPES = ['user:email', 'read:user'];

export class AuthManager {
  private state: AuthState = { isAuthenticated: false, user: null, sessionToken: null };
  private onStateChangeEmitter = new vscode.EventEmitter<AuthState>();
  readonly onStateChange = this.onStateChangeEmitter.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    void this.refreshSession();

    // Re-check whenever the user's GitHub session changes in VS Code
    context.subscriptions.push(
      vscode.authentication.onDidChangeSessions(async e => {
        if (e.provider.id === 'github') {
          await this.refreshSession();
        }
      })
    );
  }

  // ── Sign In ────────────────────────────────────────────────────────────────
  // VS Code opens GitHub OAuth in the browser and handles the entire callback.
  // No local server, no CORS, no Clerk needed.
  async signIn(): Promise<{ success: boolean; error?: string }> {
    try {
      const session = await vscode.authentication.getSession('github', GITHUB_SCOPES, {
        createIfNone: true,
      });

      if (!session) {
        return { success: false, error: 'Sign-in was cancelled.' };
      }

      const user: AuthUser = {
        id: session.account.id,
        email: session.account.label,
        firstName: session.account.label,
      };

      await this.persistSession(session.accessToken, user);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      return { success: false, error: msg };
    }
  }

  async signOut(): Promise<void> {
    await this.clearSession();
  }

  getState(): AuthState { return this.state; }
  isAuthenticated(): boolean { return this.state.isAuthenticated; }

  // ── Private ────────────────────────────────────────────────────────────────

  private async refreshSession(): Promise<void> {
    try {
      // silent: true — don't prompt, just check if a session already exists
      const session = await vscode.authentication.getSession('github', GITHUB_SCOPES, {
        createIfNone: false,
        silent: true,
      });

      if (session) {
        const storedJson = this.context.globalState.get<string>(USER_KEY);
        const user: AuthUser = storedJson
          ? (JSON.parse(storedJson) as AuthUser)
          : { id: session.account.id, email: session.account.label, firstName: session.account.label };

        this.state = { isAuthenticated: true, user, sessionToken: session.accessToken };
      } else {
        this.state = { isAuthenticated: false, user: null, sessionToken: null };
      }
    } catch {
      this.state = { isAuthenticated: false, user: null, sessionToken: null };
    }
    this.onStateChangeEmitter.fire(this.state);
  }

  private async persistSession(token: string, user: AuthUser): Promise<void> {
    await this.context.globalState.update(USER_KEY, JSON.stringify(user));
    this.state = { isAuthenticated: true, user, sessionToken: token };
    this.onStateChangeEmitter.fire(this.state);
  }

  private async clearSession(): Promise<void> {
    await this.context.globalState.update(USER_KEY, undefined);
    this.state = { isAuthenticated: false, user: null, sessionToken: null };
    this.onStateChangeEmitter.fire(this.state);
  }
}
