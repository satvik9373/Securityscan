import * as vscode from 'vscode';
import * as path from 'path';
import { AuthManager } from '../authentication/authManager';
import { StateManager } from '../storage/stateManager';
import { SecurityScanner } from '../scanner/scanner';
import { AIFixGenerator } from '../ai/fixGenerator';
import { globalRuleRegistry } from '../rules/registry';
import { openFileAtLine } from '../utils/fileUtils';
import { calculateSecurityScore } from '../score-engine/calculator';
import { WebviewMessage, ScanResult, RuleMatch } from '../types';
import { getWebviewContent } from './webviewContent';

export class SecureScanWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'securescan.mainView';

  private view?: vscode.WebviewView;
  private scanner: SecurityScanner;
  private fixGenerator: AIFixGenerator;
  private isScanning = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly authManager: AuthManager,
    private readonly stateManager: StateManager,
  ) {
    this.scanner = new SecurityScanner(globalRuleRegistry);
    this.fixGenerator = new AIFixGenerator();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = getWebviewContent(webviewView.webview, this.extensionUri);

    // Listen to messages from webview
    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      await this.handleMessage(message);
    });

    // Push initial state when ready
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.pushState();
      }
    });
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.pushState();
        break;

      case 'scan':
        await this.runScan(false);
        break;

      case 'rescan':
        await this.runScan(true);
        break;

      case 'signIn': {
        const payload = message.payload as { email: string; password: string };
        const result = await this.authManager.signIn(payload.email, payload.password);
        if (result.success) {
          this.post({ type: 'authSuccess', payload: this.authManager.getState() });
          this.pushState();
        } else {
          this.post({ type: 'authError', payload: result.error });
        }
        break;
      }

      case 'signOut':
        await this.authManager.signOut();
        this.pushState();
        break;

      case 'openFile': {
        const loc = message.payload as { file: string; line: number };
        openFileAtLine(loc.file, loc.line);
        break;
      }

      case 'generateFix': {
        const payload = message.payload as { ruleId: string };
        const result = this.stateManager.getLastScanResult();
        if (!result) break;
        const issue = result.issues.find(i => i.ruleId === payload.ruleId);
        if (!issue) break;
        const fix = await this.fixGenerator.generateFix(issue, result.framework);
        this.post({ type: 'updateState', payload: { fixPrompt: fix } });
        break;
      }

      case 'markResolved': {
        const payload = message.payload as { ruleId: string };
        this.stateManager.markIssueResolved(payload.ruleId);
        this.recalcAndPush();
        break;
      }
    }
  }

  private async runScan(isRescan: boolean): Promise<void> {
    if (this.isScanning) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.post({ type: 'error', payload: 'No workspace folder open. Open a project to scan.' });
      return;
    }

    if (!this.authManager.isAuthenticated()) {
      this.post({ type: 'error', payload: 'Please sign in to scan.' });
      return;
    }

    if (isRescan) {
      this.stateManager.clearResolvedIssues();
    }

    this.isScanning = true;
    const rootPath = workspaceFolders[0].uri.fsPath;
    const resolvedIssues = this.stateManager.getResolvedIssues();

    try {
      const result = await this.scanner.scan(
        rootPath,
        resolvedIssues,
        (message, percent) => {
          this.post({ type: 'scanProgress', payload: { message, percent } });
        }
      );

      // After rescan, unmark issues that still exist
      if (isRescan) {
        const activeRuleIds = new Set(result.issues.map(i => i.ruleId));
        const stillResolved = resolvedIssues.filter(id => !activeRuleIds.has(id));
        for (const id of stillResolved) {
          this.stateManager.markIssueResolved(id);
        }
      }

      this.stateManager.saveScanResult(result);
      this.post({ type: 'scanComplete', payload: result });
      this.pushState();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      this.post({ type: 'error', payload: msg });
    } finally {
      this.isScanning = false;
    }
  }

  private recalcAndPush(): void {
    const result = this.stateManager.getLastScanResult();
    if (!result) return;
    const resolved = this.stateManager.getResolvedIssues();
    const score = calculateSecurityScore(result.issues, resolved);
    this.post({
      type: 'updateState',
      payload: {
        scanResult: { ...result, score },
        resolvedIssues: resolved,
        authState: this.authManager.getState(),
      },
    });
  }

  pushState(): void {
    this.post({
      type: 'updateState',
      payload: {
        scanResult: this.stateManager.getLastScanResult() ?? null,
        resolvedIssues: this.stateManager.getResolvedIssues(),
        authState: this.authManager.getState(),
      },
    });
  }

  private post(message: WebviewMessage): void {
    this.view?.webview.postMessage(message);
  }

  refresh(): void {
    if (this.view) {
      this.view.webview.html = getWebviewContent(this.view.webview, this.extensionUri);
      this.pushState();
    }
  }
}
