import * as vscode from 'vscode';
import { AuthManager } from '../authentication/authManager';
import { StateManager } from '../storage/stateManager';
import { SecurityScanner } from '../scanner/scanner';
import { AIFixGenerator } from '../ai/fixGenerator';
import { globalRuleRegistry } from '../rules/registry';
import { openFileAtLine } from '../utils/fileUtils';
import { calculateSecurityScore } from '../score-engine/calculator';
import { WebviewMessage } from '../types';
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
    this.scanner     = new SecurityScanner(globalRuleRegistry);
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

    webviewView.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      await this.handleMessage(msg);
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this.pushState();
    });
  }

  private async handleMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        this.pushState();
        break;

      case 'signIn': {
        this.post({ type: 'authProgress', payload: 'Opening GitHub sign-in...' });
        const result = await this.authManager.signIn();
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

      case 'scan':
        await this.runScan(false);
        break;

      case 'rescan':
        await this.runScan(true);
        break;

      case 'openFile': {
        const loc = msg.payload as { file: string; line: number };
        openFileAtLine(loc.file, loc.line);
        break;
      }

      case 'generateFix': {
        const payload = msg.payload as { ruleId: string };
        const result  = this.stateManager.getLastScanResult();
        if (!result) break;
        const issue = result.issues.find(i => i.ruleId === payload.ruleId);
        if (!issue) break;
        const fix = await this.fixGenerator.generateFix(issue, result.framework);
        this.post({ type: 'updateState', payload: { fixPrompt: fix } });
        break;
      }

      case 'markResolved': {
        const payload = msg.payload as { ruleId: string };
        this.stateManager.markIssueResolved(payload.ruleId);
        this.recalcAndPush();
        break;
      }
    }
  }

  private async runScan(isRescan: boolean): Promise<void> {
    if (this.isScanning) return;

    if (!this.authManager.isAuthenticated()) {
      this.post({ type: 'error', payload: 'Please sign in to scan your project.' });
      return;
    }

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      this.post({ type: 'error', payload: 'No workspace folder open. Open a project to scan.' });
      return;
    }

    if (isRescan) this.stateManager.clearResolvedIssues();

    this.isScanning = true;
    const rootPath      = folders[0].uri.fsPath;
    const resolvedIssues = this.stateManager.getResolvedIssues();

    try {
      const result = await this.scanner.scan(rootPath, resolvedIssues, (message, percent) => {
        this.post({ type: 'scanProgress', payload: { message, percent } });
      });

      if (isRescan) {
        const activeIds    = new Set(result.issues.map(i => i.ruleId));
        const stillResolved = resolvedIssues.filter(id => !activeIds.has(id));
        for (const id of stillResolved) this.stateManager.markIssueResolved(id);
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
    const score    = calculateSecurityScore(result.issues, resolved);
    this.post({
      type: 'updateState',
      payload: { scanResult: { ...result, score }, resolvedIssues: resolved, authState: this.authManager.getState() },
    });
  }

  pushState(): void {
    this.post({
      type: 'updateState',
      payload: {
        scanResult:    this.stateManager.getLastScanResult() ?? null,
        resolvedIssues: this.stateManager.getResolvedIssues(),
        authState:     this.authManager.getState(),
      },
    });
  }

  private post(msg: WebviewMessage): void {
    this.view?.webview.postMessage(msg);
  }

  refresh(): void {
    if (this.view) {
      this.view.webview.html = getWebviewContent(this.view.webview, this.extensionUri);
      this.pushState();
    }
  }
}
