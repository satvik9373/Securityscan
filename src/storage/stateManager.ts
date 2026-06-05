import * as vscode from 'vscode';
import { ScanResult, StoredState, AuthState } from '../types';

const SCAN_RESULT_KEY = 'securescan.lastScanResult';
const RESOLVED_ISSUES_KEY = 'securescan.resolvedIssues';

export class StateManager {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  saveScanResult(result: ScanResult): void {
    this.context.workspaceState.update(SCAN_RESULT_KEY, result);
  }

  getLastScanResult(): ScanResult | undefined {
    return this.context.workspaceState.get<ScanResult>(SCAN_RESULT_KEY);
  }

  clearScanResult(): void {
    this.context.workspaceState.update(SCAN_RESULT_KEY, undefined);
  }

  getResolvedIssues(): string[] {
    return this.context.workspaceState.get<string[]>(RESOLVED_ISSUES_KEY) ?? [];
  }

  markIssueResolved(ruleId: string): void {
    const resolved = this.getResolvedIssues();
    if (!resolved.includes(ruleId)) {
      resolved.push(ruleId);
      this.context.workspaceState.update(RESOLVED_ISSUES_KEY, resolved);
    }
  }

  unmarkIssueResolved(ruleId: string): void {
    const resolved = this.getResolvedIssues().filter(id => id !== ruleId);
    this.context.workspaceState.update(RESOLVED_ISSUES_KEY, resolved);
  }

  clearResolvedIssues(): void {
    this.context.workspaceState.update(RESOLVED_ISSUES_KEY, []);
  }
}
