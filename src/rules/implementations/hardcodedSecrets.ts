import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';

const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi, label: 'hardcoded password' },
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{8,}['"]/gi, label: 'hardcoded API key' },
  { pattern: /(?:secret[_-]?key|secretkey)\s*[:=]\s*['"][^'"]{8,}['"]/gi, label: 'hardcoded secret key' },
  { pattern: /(?:access[_-]?token|accesstoken)\s*[:=]\s*['"][^'"]{8,}['"]/gi, label: 'hardcoded access token' },
  { pattern: /(?:private[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"]/gi, label: 'hardcoded private key' },
  { pattern: /sk-[a-zA-Z0-9]{40,}/g, label: 'OpenAI API key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, label: 'GitHub personal access token' },
  { pattern: /(?:mongodb(?:\+srv)?:\/\/[^'":\s]+:[^'"@\s]+@)/g, label: 'MongoDB connection string with credentials' },
  { pattern: /(?:postgresql|postgres|mysql):\/\/[^'":\s]+:[^'"@\s]+@/g, label: 'database URL with credentials' },
  { pattern: /AKIA[0-9A-Z]{16}/g, label: 'AWS access key' },
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, label: 'private key block' },
];

// Patterns that look like secrets but are likely env var references or examples
const FALSE_POSITIVE_PATTERNS = [
  /process\.env/,
  /os\.environ/,
  /getenv/,
  /your[_-]?(?:api[_-]?)?key/i,
  /example/i,
  /placeholder/i,
  /changeme/i,
  /xxxxx/i,
  /\*{4,}/,
];

export class HardcodedSecretsRule extends BaseRule {
  id = 'hardcoded_secrets';
  title = 'Hardcoded Secrets / Credentials';
  description = 'Sensitive credentials such as API keys, passwords, or tokens are hardcoded in source code.';
  severity = 'critical' as const;
  category = 'secrets';
  frameworks = 'all' as const;
  languages = 'all' as const;
  tags = ['secrets', 'credentials', 'owasp-a07'];
  remediationGuidance = 'Move all secrets to environment variables. Use a .env file with dotenv or a secrets manager. Ensure .env is in .gitignore.';
  attackScenario = 'An attacker who gains read access to the repository (e.g., via a public GitHub repo or a compromised developer machine) can extract credentials and use them to access databases, APIs, or cloud resources.';

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];

    for (const [filePath, content] of context.fileContents) {
      // Skip env files themselves and compiled output
      if (filePath.endsWith('.env') || filePath.includes('/dist/') || filePath.includes('/out/')) {
        continue;
      }

      for (const { pattern, label } of SECRET_PATTERNS) {
        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          if (!FALSE_POSITIVE_PATTERNS.some(fp => fp.test(m.snippet))) {
            locations.push({
              file: filePath,
              line: m.line,
              column: m.column,
              snippet: `[${label}] ${m.snippet.substring(0, 100)}`,
            });
          }
        }
      }
    }

    if (locations.length === 0) return [];

    const match = this.buildMatch(locations);
    match.attackScenario = this.attackScenario;
    return [match];
  }
}
