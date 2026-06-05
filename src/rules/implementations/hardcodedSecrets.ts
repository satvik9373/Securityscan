import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';
import * as path from 'path';

interface SecretPattern { pattern: RegExp; label: string; }

const SECRET_PATTERNS: SecretPattern[] = [
  // Generic key=value assignments with real-looking values
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"`][^'"`\s]{4,}['"`]/gi, label: 'hardcoded password' },
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/gi, label: 'hardcoded API key' },
  { pattern: /(?:secret[_-]?key|secretkey|client_secret|clientsecret)\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/gi, label: 'hardcoded secret key' },
  { pattern: /(?:access[_-]?token|accesstoken|bearer)\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/gi, label: 'hardcoded access token' },
  { pattern: /(?:private[_-]?key|privatekey)\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/gi, label: 'hardcoded private key' },
  { pattern: /(?:auth[_-]?token|authtoken)\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/gi, label: 'hardcoded auth token' },
  // Well-known token formats
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, label: 'OpenAI API key' },
  { pattern: /sk-proj-[a-zA-Z0-9_-]{20,}/g, label: 'OpenAI project key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, label: 'GitHub personal access token' },
  { pattern: /ghs_[a-zA-Z0-9]{36}/g, label: 'GitHub service token' },
  { pattern: /AKIA[0-9A-Z]{16}/g, label: 'AWS access key ID' },
  { pattern: /(?:aws[_-]?secret|aws[_-]?access[_-]?key[_-]?secret)\s*[:=]\s*['"`][A-Za-z0-9/+=]{20,}['"`]/gi, label: 'AWS secret key' },
  { pattern: /xox[bporas]-[0-9A-Za-z-]{10,}/g, label: 'Slack token' },
  { pattern: /AIza[0-9A-Za-z_-]{35}/g, label: 'Google API key' },
  { pattern: /ya29\.[0-9A-Za-z_-]{60,}/g, label: 'Google OAuth token' },
  { pattern: /(?:twilio|stripe|sendgrid|mailgun)[_-]?(?:key|token|secret)\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/gi, label: 'third-party service key' },
  // Connection strings with embedded credentials
  { pattern: /mongodb(?:\+srv)?:\/\/[^'"`\s:]+:[^'"`\s@]{3,}@/g, label: 'MongoDB connection string with credentials' },
  { pattern: /(?:postgresql|postgres|mysql|mssql):\/\/[^'"`\s:]+:[^'"`\s@]{3,}@/g, label: 'database URL with credentials' },
  { pattern: /redis:\/\/[^'"`\s:]+:[^'"`\s@]{3,}@/g, label: 'Redis connection string with credentials' },
  // Private key blocks
  { pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, label: 'private key block' },
  // JWT secrets used inline
  { pattern: /jwt\.sign\s*\([^,]+,\s*['"`][^'"`]{8,}['"`]/g, label: 'JWT secret hardcoded' },
];

// Skip lines that are clearly env-var references or dummy values
const FALSE_POSITIVE_PATTERNS = [
  /process\.env\./,
  /os\.environ/,
  /getenv\s*\(/,
  /config\[/,
  /settings\./,
  /your[_-]?(?:api[_-]?)?key/i,
  /example[_-]?key/i,
  /placeholder/i,
  /changeme/i,
  /your[_-]?secret/i,
  /insert[_-]?here/i,
  /todo/i,
  /xxxxx+/i,
  /\*{4,}/,
  /^#/,                     // comment lines
  /\$\{[^}]+\}/,           // template variable like ${SECRET}
  /process\.env/,
];

// File paths that should be skipped entirely
const SKIP_FILE_PATTERNS = [
  /\/node_modules\//,
  /\/dist\//,
  /\/out\//,
  /\/build\//,
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\.lock$/,
];

export class HardcodedSecretsRule extends BaseRule {
  id = 'hardcoded_secrets';
  title = 'Hardcoded Secrets / Credentials';
  description = 'Sensitive credentials such as API keys, passwords, or tokens are hardcoded directly in source code instead of being loaded from environment variables.';
  severity = 'critical' as const;
  category = 'secrets';
  frameworks = 'all' as const;
  languages = 'all' as const;
  tags = ['secrets', 'credentials', 'owasp-a07'];
  remediationGuidance = 'Move all secrets to environment variables. Use a .env file with dotenv (add .env to .gitignore). For production, use a secrets manager like AWS Secrets Manager, HashiCorp Vault, or Doppler.';
  references = ['https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/'];

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];
    const seen = new Set<string>(); // deduplicate same line same file

    for (const [filePath, content] of context.fileContents) {
      // Skip compiled output, test files, and lock files
      if (SKIP_FILE_PATTERNS.some(p => p.test(filePath))) continue;
      // Skip env files themselves (they're allowed to have secrets)
      const basename = filePath.split('/').pop() ?? '';
      if (basename.startsWith('.env')) continue;

      for (const { pattern, label } of SECRET_PATTERNS) {
        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          const key = `${filePath}:${m.line}`;
          if (seen.has(key)) continue;

          // Check the full line for false positives
          if (FALSE_POSITIVE_PATTERNS.some(fp => fp.test(m.snippet))) continue;

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
    match.attackScenario = 'An attacker who reads your source code (public repo, leaked backup, compromised developer machine) can extract these credentials to access databases, APIs, or cloud resources.';
    return [match];
  }
}
