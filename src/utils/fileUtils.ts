import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '.nyc_output',
  '__pycache__',
  '.pytest_cache',
  'vendor',
  'target',
  '.gradle',
];

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.php', '.java', '.go',
  '.json', '.env', '.yaml', '.yml',
  '.sh', '.bash',
]);

export function getAllFiles(rootPath: string, excludePatterns?: string[]): string[] {
  const excludes = excludePatterns ?? DEFAULT_EXCLUDES;
  const files: string[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      if (shouldExclude(relativePath, entry.name, excludes)) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(rootPath);
  return files;
}

function shouldExclude(relativePath: string, name: string, excludes: string[]): boolean {
  if (name.startsWith('.') && name !== '.env') {
    return true;
  }
  for (const pattern of excludes) {
    if (relativePath.includes(pattern) || name === pattern) {
      return true;
    }
  }
  return false;
}

export function readFileContent(filePath: string): string | null {
  try {
    const stats = fs.statSync(filePath);
    // Skip files larger than 1MB
    if (stats.size > 1024 * 1024) {
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function countLines(content: string): number {
  return content.split('\n').length;
}

export function getLineContent(content: string, lineNumber: number): string {
  const lines = content.split('\n');
  return lines[lineNumber - 1] ?? '';
}

export function findLineNumber(content: string, pattern: RegExp): number[] {
  const lines = content.split('\n');
  const matches: number[] = [];
  lines.forEach((line, idx) => {
    if (pattern.test(line)) {
      matches.push(idx + 1);
    }
  });
  return matches;
}

export function openFileAtLine(filePath: string, line: number): void {
  const uri = vscode.Uri.file(filePath);
  vscode.window.showTextDocument(uri, {
    selection: new vscode.Range(
      new vscode.Position(Math.max(0, line - 1), 0),
      new vscode.Position(Math.max(0, line - 1), 0)
    ),
    preview: false,
  });
}

export function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function readJsonFile<T>(filePath: string): T | null {
  const content = readFileContent(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
