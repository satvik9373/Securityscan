import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

let cachedEnv: Record<string, string> | null = null;

export function readWorkspaceEnv(): Record<string, string> {
  if (cachedEnv) return cachedEnv;

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return {};

  const rootPath = workspaceFolders[0].uri.fsPath;

  // Priority order for env files
  const envFiles = ['.env.local', '.env.development.local', '.env', '.env.development'];

  for (const envFile of envFiles) {
    const filePath = path.join(rootPath, envFile);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      cachedEnv = parseEnvFile(content);
      return cachedEnv;
    } catch {
      // try next
    }
  }

  cachedEnv = {};
  return cachedEnv;
}

export function clearEnvCache(): void {
  cachedEnv = null;
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const key = line.substring(0, idx).trim();
    let value = line.substring(idx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

export function getEnvVar(...keys: string[]): string | undefined {
  const env = readWorkspaceEnv();
  for (const key of keys) {
    // Check workspace .env first, then process.env
    const val = env[key] ?? process.env[key];
    if (val) return val;
  }
  return undefined;
}
