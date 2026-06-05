import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';

const USER_INPUT = '(?:req\\.|request\\.|params\\.|body\\.|query\\.|ctx\\.|event\\.)';

const PATH_TRAVERSAL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // fs.readFile/writeFile/appendFile with user input directly
  { pattern: new RegExp(`fs\\.readFile(?:Sync)?\\s*\\(\\s*${USER_INPUT}`, 'g'), label: 'fs.readFile with user input' },
  { pattern: new RegExp(`fs\\.writeFile(?:Sync)?\\s*\\(\\s*${USER_INPUT}`, 'g'), label: 'fs.writeFile with user input' },
  { pattern: new RegExp(`fs\\.appendFile(?:Sync)?\\s*\\(\\s*${USER_INPUT}`, 'g'), label: 'fs.appendFile with user input' },
  { pattern: new RegExp(`fs\\.unlink(?:Sync)?\\s*\\(\\s*${USER_INPUT}`, 'g'), label: 'fs.unlink with user input' },
  // path.join/path.resolve with user input
  { pattern: new RegExp(`path\\.join\\s*\\([^)]*${USER_INPUT}`, 'g'), label: 'path.join with user input' },
  { pattern: new RegExp(`path\\.resolve\\s*\\([^)]*${USER_INPUT}`, 'g'), label: 'path.resolve with user input' },
  // res.sendFile with user input
  { pattern: new RegExp(`res\\.sendFile\\s*\\(\\s*${USER_INPUT}`, 'g'), label: 'res.sendFile with user input' },
  // dynamic require() with user input
  { pattern: new RegExp(`require\\s*\\(\\s*${USER_INPUT}`, 'g'), label: 'dynamic require() with user input' },
  // Template literal path with user input
  { pattern: new RegExp(`\`[^'\`]*\\$\\{[^}]*${USER_INPUT}[^}]*\\}[^'\`]*\`[^;]*(?:readFile|writeFile|sendFile|readdir)`, 'g'), label: 'template literal path with user input' },
  // open() / createReadStream with user input
  { pattern: new RegExp(`(?:createReadStream|createWriteStream|openSync)\\s*\\(\\s*${USER_INPUT}`, 'g'), label: 'stream opened with user input' },
  // Python os.path.join / open() with user input
  { pattern: /os\.path\.join\s*\([^)]*(?:request|req|params)\./g, label: 'Python os.path.join with user input' },
  { pattern: /open\s*\(\s*(?:request|req|params)\./g, label: 'Python open() with user input' },
];

// Patterns indicating path sanitization IS being done
const SAFE_PATTERNS = [
  /path\.resolve\s*\(\s*__dirname/,    // anchored to a base dir
  /\.startsWith\s*\(\s*(?:baseDir|uploadDir|__dirname)/,
  /\.normalize\s*\(.*\).*startsWith/,
  /sanitize.*path/i,
  /validatePath/i,
];

export class PathTraversalRule extends BaseRule {
  id = 'path_traversal';
  title = 'Path Traversal Risk';
  description = 'User-controlled input is passed directly to file system operations. An attacker can use "../" sequences to read or write files outside the intended directory, including system files and application secrets.';
  severity = 'critical' as const;
  category = 'injection';
  frameworks = ['express', 'nodejs', 'nextjs'] as const;
  languages = ['typescript', 'javascript', 'python'] as const;
  tags = ['path-traversal', 'file-inclusion', 'owasp-a01'];
  remediationGuidance = "Never pass user input directly to file operations. Resolve to an absolute path and verify it starts with the allowed base directory: const safePath = path.resolve(baseDir, userInput); if (!safePath.startsWith(baseDir)) throw new Error('Invalid path');";

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];
    const seen = new Set<string>();

    for (const [filePath, content] of context.fileContents) {
      if (
        !content.includes('fs.') &&
        !content.includes('readFile') &&
        !content.includes('writeFile') &&
        !content.includes('sendFile') &&
        !content.includes('createReadStream') &&
        !content.includes('path.join') &&
        !content.includes('path.resolve') &&
        !content.includes('os.path')
      ) {
        continue;
      }

      for (const { pattern, label } of PATH_TRAVERSAL_PATTERNS) {
        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          const key = `${filePath}:${m.line}`;
          if (seen.has(key)) continue;

          // Check surrounding lines for sanitization
          const surroundingLines = content.split('\n')
            .slice(Math.max(0, m.line - 3), m.line + 2)
            .join('\n');
          if (SAFE_PATTERNS.some(p => p.test(surroundingLines))) continue;

          // Skip comments
          if (/^\s*(?:\/\/|\/\*|\*)/.test(m.snippet)) continue;

          seen.add(key);
          locations.push({
            file: filePath,
            line: m.line,
            column: m.column,
            snippet: `[${label}] ${m.snippet.substring(0, 120)}`,
          });
        }
      }
    }

    if (locations.length === 0) return [];

    const match = this.buildMatch(locations);
    match.attackScenario = "GET /download?file=../../.env — The attacker traverses up from the uploads directory to read the application's .env file, exposing database credentials, API keys, and JWT secrets.";
    return [match];
  }
}
