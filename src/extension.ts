import * as vscode from 'vscode';
import { SecureScanWebviewProvider } from './ui/webviewProvider';
import { AuthManager } from './authentication/authManager';
import { StateManager } from './storage/stateManager';

export function activate(context: vscode.ExtensionContext): void {
  const authManager = new AuthManager(context);
  const stateManager = new StateManager(context);

  const provider = new SecureScanWebviewProvider(
    context.extensionUri,
    authManager,
    stateManager,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SecureScanWebviewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('securescan.scan', () => {
      vscode.commands.executeCommand('securescan.mainView.focus');
      provider.pushState();
    }),

    vscode.commands.registerCommand('securescan.rescan', () => {
      vscode.commands.executeCommand('securescan.mainView.focus');
    }),

    vscode.commands.registerCommand('securescan.signIn', () => {
      vscode.commands.executeCommand('securescan.mainView.focus');
    }),

    vscode.commands.registerCommand('securescan.signOut', async () => {
      await authManager.signOut();
      provider.pushState();
    }),

    vscode.commands.registerCommand('securescan.openFile', (file: string, line: number) => {
      const uri = vscode.Uri.file(file);
      vscode.window.showTextDocument(uri, {
        selection: new vscode.Range(
          new vscode.Position(Math.max(0, line - 1), 0),
          new vscode.Position(Math.max(0, line - 1), 0)
        ),
      });
    }),
  );

  // Listen to auth state changes and push to webview
  authManager.onStateChange(() => {
    provider.pushState();
  });
}

export function deactivate(): void {
  // cleanup handled by VS Code subscription disposal
}
