import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';

const WILDCARD_CORS_PATTERNS = [
  /cors\s*\(\s*\{\s*origin\s*:\s*['"]\*['"]/g,
  /cors\s*\(\s*\)/g,
  /Access-Control-Allow-Origin['"]\s*:\s*['"]\*/g,
  /res\.header\s*\(\s*['"]Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"]/g,
  /setHeader\s*\(\s*['"]Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"]/g,
];

export class OpenCorsRule extends BaseRule {
  id = 'open_cors';
  title = 'Open / Wildcard CORS Policy';
  description = 'CORS is configured to allow requests from any origin (*), which can enable cross-site request forgery and data theft.';
  severity = 'high' as const;
  category = 'access-control';
  frameworks = ['express', 'nodejs', 'nextjs', 'nestjs'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['cors', 'access-control', 'owasp-a01'];
  remediationGuidance = 'Restrict CORS to specific trusted origins. Use an allowlist of domains instead of wildcard (*). Consider different policies for development vs production.';

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];

    for (const [filePath, content] of context.fileContents) {
      if (!content.toLowerCase().includes('cors')) continue;

      for (const pattern of WILDCARD_CORS_PATTERNS) {
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
    match.attackScenario = 'A malicious website can make authenticated API requests on behalf of a logged-in user, stealing data or performing unwanted actions.';
    return [match];
  }
}
