import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';

const UNSAFE_JWT_PATTERNS = [
  // Algorithm set to none
  /algorithm\s*:\s*['"]none['"]/gi,
  // Signing with empty/weak secret
  /jwt\.sign\s*\([^)]*,\s*['"]{2}/g,
  /jwt\.sign\s*\([^)]*,\s*['"]\s*['"]/g,
  // Missing verification
  /jwt\.decode\s*\(/g,
  // Ignoring expiry
  /ignoreExpiration\s*:\s*true/g,
  // Not verifying signature
  /algorithms\s*:\s*\[\s*['"]none['"]/gi,
];

export class UnsafeJwtRule extends BaseRule {
  id = 'unsafe_jwt';
  title = 'Unsafe JWT Configuration';
  description = 'JWT tokens are configured insecurely: weak secrets, missing verification, disabled expiration, or the "none" algorithm.';
  severity = 'critical' as const;
  category = 'authentication';
  frameworks = 'all' as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['jwt', 'authentication', 'owasp-a02'];
  remediationGuidance = 'Use strong random secrets (256-bit+). Always verify JWT signatures. Set reasonable expiry times. Never use the "none" algorithm. Store secrets in environment variables.';

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];

    for (const [filePath, content] of context.fileContents) {
      if (!content.includes('jwt') && !content.includes('JWT')) continue;

      for (const pattern of UNSAFE_JWT_PATTERNS) {
        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          locations.push({
            file: filePath,
            line: m.line,
            column: m.column,
            snippet: m.snippet,
          });
        }
      }
    }

    if (locations.length === 0) return [];

    const match = this.buildMatch(locations);
    match.attackScenario = 'An attacker can forge JWT tokens with the "none" algorithm or a weak secret, gaining unauthorized access to any user account.';
    return [match];
  }
}
