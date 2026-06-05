import { ScanContext, RuleMatch } from '../../types';
import { BaseRule } from '../base';
import { hasDependency } from '../../utils/patternMatcher';
import * as path from 'path';

export class MissingRateLimitingRule extends BaseRule {
  id = 'missing_rate_limiting';
  title = 'Missing Rate Limiting';
  description = 'No rate limiting middleware is configured. APIs and authentication endpoints are vulnerable to brute force and DDoS attacks.';
  severity = 'high' as const;
  category = 'availability';
  frameworks = ['express', 'nodejs', 'nextjs'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['rate-limiting', 'brute-force', 'dos', 'owasp-a04'];
  remediationGuidance = 'Install express-rate-limit and configure limits per route. For Next.js use next-rate-limit or implement middleware-based rate limiting.';

  detect(context: ScanContext): RuleMatch[] {
    const { dependencies } = context.projectInfo;

    const hasRateLimit = hasDependency(
      dependencies,
      'express-rate-limit',
      'rate-limiter-flexible',
      'next-rate-limit',
      'upstash-ratelimit',
      '@upstash/ratelimit',
      'express-slow-down',
    );

    // Also check if rate limit is used in code
    if (!hasRateLimit) {
      for (const [, content] of context.fileContents) {
        if (/rateLimit|rate_limit|rateLimiter|RateLimiter|slowDown/i.test(content)) {
          return [];
        }
      }
    }

    if (hasRateLimit) return [];

    // Find entry points to report
    const entryFiles = context.projectInfo.files
      .filter(f => {
        const base = path.basename(f);
        return ['index.ts', 'index.js', 'server.ts', 'server.js', 'app.ts', 'app.js'].includes(base);
      })
      .slice(0, 3);

    const locations = entryFiles.map(f => ({
      file: f,
      line: 1,
      snippet: 'No rate limiting middleware found',
    }));

    if (locations.length === 0) {
      locations.push({
        file: context.projectInfo.rootPath,
        line: 1,
        snippet: 'No rate limiting detected in project',
      });
    }

    const match = this.buildMatch(locations);
    match.attackScenario = 'An attacker can send thousands of requests per second to brute force login endpoints or overwhelm the server.';
    return [match];
  }
}
