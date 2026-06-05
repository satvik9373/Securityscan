import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';

const WILDCARD_CORS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // cors({ origin: '*' })
  { pattern: /cors\s*\(\s*\{\s*[^}]*origin\s*:\s*['"`]\*['"`]/g, label: "cors({ origin: '*' })" },
  // cors() with no arguments — allows all origins by default
  { pattern: /app\.use\s*\(\s*cors\s*\(\s*\)\s*\)/g, label: 'cors() without origin restriction' },
  { pattern: /router\.use\s*\(\s*cors\s*\(\s*\)\s*\)/g, label: 'cors() without origin restriction' },
  // Manual header: 'Access-Control-Allow-Origin': '*'
  { pattern: /Access-Control-Allow-Origin['"]\s*[,:]?\s*['"`]\*['"`]/g, label: "Access-Control-Allow-Origin: '*'" },
  // res.header('Access-Control-Allow-Origin', '*')
  { pattern: /(?:res|response)\.(?:header|setHeader)\s*\(\s*['"`]Access-Control-Allow-Origin['"`]\s*,\s*['"`]\*['"`]/g, label: "setHeader Access-Control-Allow-Origin: '*'" },
  // Next.js headers config with wildcard
  { pattern: /['"`]Access-Control-Allow-Origin['"`]\s*,\s*(?:value\s*:\s*)?['"`]\*['"`]/g, label: "Next.js wildcard CORS header" },
  // Python/Flask
  { pattern: /CORS\s*\(\s*app\s*\)/g, label: 'Flask-CORS without origin restriction' },
  { pattern: /Access-Control-Allow-Origin.*\*/g, label: "Access-Control-Allow-Origin: '*'" },
];

// Lines that indicate this is a dev/test environment check, not a blanket wildcard
const DEV_CONTEXT = [
  /process\.env\.NODE_ENV\s*(?:!==|===|==|!=)\s*['"`]production['"`]/,
  /isDev/,
  /isProduction/,
  /if\s*\(\s*dev/i,
];

export class OpenCorsRule extends BaseRule {
  id = 'open_cors';
  title = 'Open / Wildcard CORS Policy';
  description = "CORS is configured to allow requests from any origin (*). This lets any website make authenticated cross-origin requests to your API on behalf of a logged-in user.";
  severity = 'high' as const;
  category = 'access-control';
  frameworks = ['express', 'nodejs', 'nextjs', 'nestjs'] as const;
  languages = ['typescript', 'javascript', 'python'] as const;
  tags = ['cors', 'access-control', 'owasp-a01'];
  remediationGuidance = "Specify an explicit allowlist of trusted origins: cors({ origin: ['https://yourapp.com', 'https://staging.yourapp.com'] }). Use a function-based origin check for dynamic validation. In production, never use '*'.";

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];
    const seen = new Set<string>();

    for (const [filePath, content] of context.fileContents) {
      if (
        !content.toLowerCase().includes('cors') &&
        !content.includes('Access-Control')
      ) {
        continue;
      }

      for (const { pattern, label } of WILDCARD_CORS_PATTERNS) {
        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          const key = `${filePath}:${m.line}`;
          if (seen.has(key)) continue;

          // Skip if it's in a comment
          if (/^\s*(?:\/\/|\/\*|\*|#)/.test(m.snippet)) continue;

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
    match.attackScenario = "A malicious site (evil.com) makes a fetch() to your API with the victim's credentials. Because CORS allows all origins, the browser sends the request with the user's cookies, and evil.com can read the response.";
    return [match];
  }
}
