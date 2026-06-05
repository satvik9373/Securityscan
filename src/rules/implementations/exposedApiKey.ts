import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';
import * as path from 'path';

// Client-side files that should never contain secrets
const CLIENT_FILE_PATTERNS = [
  /\/pages\//,
  /\/app\//,
  /\/components\//,
  /\/src\/.*\.(tsx|jsx)$/,
  /\/public\//,
];

const API_KEY_EXPOSURE_PATTERNS = [
  /NEXT_PUBLIC_[A-Z_]*(?:KEY|SECRET|TOKEN)\s*[:=]\s*['"][^'"]{8,}['"]/g,
  /window\.[a-zA-Z_]*(?:key|secret|token|password)\s*=/gi,
  /localStorage\.setItem\s*\(\s*['"][^'"]*(?:token|key|secret)[^'"]*['"]\s*,\s*(?:req\.|user\.)/gi,
];

export class ExposedApiKeyRule extends BaseRule {
  id = 'exposed_api_key';
  title = 'Exposed API Key in Client-Side Code';
  description = 'API keys or secrets are exposed in client-side code or public environment variables that will be bundled into the browser.';
  severity = 'critical' as const;
  category = 'secrets';
  frameworks = ['nextjs', 'react'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['api-key', 'secrets', 'client-side', 'owasp-a02'];
  remediationGuidance = 'Never use NEXT_PUBLIC_ prefix for secrets. Keep API calls server-side using API routes. Use Next.js API routes or server components to proxy sensitive requests.';

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];

    // Check .env files for NEXT_PUBLIC secrets
    for (const [filePath, content] of context.fileContents) {
      const fileName = path.basename(filePath);
      if (fileName.startsWith('.env')) {
        const matches = findPatternMatches(content, /NEXT_PUBLIC_[A-Z_]*(?:SECRET|KEY|TOKEN|PASSWORD)/g);
        for (const m of matches) {
          locations.push({
            file: filePath,
            line: m.line,
            snippet: `Public env var with sensitive name: ${m.snippet}`,
          });
        }
      }
    }

    // Check client-side files for secret patterns
    for (const [filePath, content] of context.fileContents) {
      const isClientFile = CLIENT_FILE_PATTERNS.some(p => p.test(filePath));
      if (!isClientFile) continue;

      for (const pattern of API_KEY_EXPOSURE_PATTERNS) {
        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          locations.push({
            file: filePath,
            line: m.line,
            snippet: m.snippet,
          });
        }
      }
    }

    if (locations.length === 0) return [];

    const match = this.buildMatch(locations);
    match.attackScenario = 'API keys bundled in client-side JavaScript are visible to anyone who views page source, enabling abuse of paid APIs or unauthorized data access.';
    return [match];
  }
}
