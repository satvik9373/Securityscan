import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { hasDependency } from '../../utils/patternMatcher';
import * as path from 'path';

const RATE_LIMIT_PACKAGES = [
  'express-rate-limit',
  'rate-limiter-flexible',
  'next-rate-limit',
  '@upstash/ratelimit',
  'upstash-ratelimit',
  'express-slow-down',
  'bottleneck',
  'p-limit',
  '@nestjs/throttler',
  'nestjs-rate-limiter',
  'koa-ratelimit',
  'hapi-rate-limit',
  'fastify-rate-limit',
  '@fastify/rate-limit',
];

// Code patterns that indicate rate limiting is implemented inline (without a package)
const INLINE_RATE_LIMIT_PATTERNS = [
  /rateLimit\s*[=(]/i,
  /rateLimiter\s*[=(]/i,
  /rate_limit\s*[=(]/i,
  /RateLimiter\s*[=(]/i,
  /slowDown\s*\(/,
  /Throttl/i,
  /throttle\s*\(/,
  /@Throttle\s*\(/,     // NestJS decorator
  /windowMs/,           // express-rate-limit config property
  /tokensPerInterval/,  // limiter package
  /maxRequests/i,
];

// Entry point files where we report the issue
const ENTRY_POINT_NAMES = new Set([
  'index.ts', 'index.js',
  'server.ts', 'server.js',
  'app.ts', 'app.js',
  'main.ts', 'main.js',
  'middleware.ts', 'middleware.js', // Next.js middleware
]);

export class MissingRateLimitingRule extends BaseRule {
  id = 'missing_rate_limiting';
  title = 'Missing Rate Limiting';
  description = 'No rate limiting middleware or logic is detected. Without rate limiting, login endpoints, API calls, and form submissions are vulnerable to brute force and denial-of-service attacks.';
  severity = 'high' as const;
  category = 'availability';
  frameworks = ['express', 'nodejs', 'nextjs', 'nestjs'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['rate-limiting', 'brute-force', 'dos', 'owasp-a04'];
  remediationGuidance = "Install express-rate-limit: npm install express-rate-limit. Add to your app: import rateLimit from 'express-rate-limit'; app.use(rateLimit({ windowMs: 15*60*1000, max: 100 })). For Next.js, use @upstash/ratelimit with Redis.";

  detect(context: ScanContext): RuleMatch[] {
    const { dependencies, devDependencies } = context.projectInfo;
    const allDeps = [...dependencies, ...devDependencies];

    // Check package dependencies
    const hasRateLimitPkg = RATE_LIMIT_PACKAGES.some(pkg => hasDependency(allDeps, pkg));
    if (hasRateLimitPkg) return [];

    // Check for inline rate limiting code in any file
    for (const [, content] of context.fileContents) {
      if (INLINE_RATE_LIMIT_PATTERNS.some(p => p.test(content))) {
        return [];
      }
    }

    // Find entry point files to report against — gives actionable file locations
    const entryFiles: FileLocation[] = [];
    for (const filePath of context.projectInfo.files) {
      const base = path.basename(filePath);
      if (!ENTRY_POINT_NAMES.has(base)) continue;

      // Read the first few lines for a meaningful snippet
      const content = context.fileContents.get(filePath);
      const firstMeaningfulLine = content
        ? content.split('\n').findIndex(l => l.trim().length > 0 && !l.trim().startsWith('//'))
        : 0;

      entryFiles.push({
        file: filePath,
        line: Math.max(1, firstMeaningfulLine + 1),
        snippet: 'No rate limiting applied — add rateLimit() middleware here',
      });

      if (entryFiles.length >= 3) break;
    }

    // If no entry files found, report on the most relevant file
    if (entryFiles.length === 0) {
      const routeFile = context.projectInfo.files.find(f =>
        /(?:route|api|handler|controller)\.[jt]sx?$/.test(f)
      );
      if (routeFile) {
        entryFiles.push({
          file: routeFile,
          line: 1,
          snippet: 'No rate limiting configured in this route handler',
        });
      }
    }

    if (entryFiles.length === 0) return [];

    const match = this.buildMatch(entryFiles);
    match.attackScenario = 'An attacker scripts 10,000 login attempts per minute against /api/auth/login, cycling through common passwords. Without rate limiting, the server processes every request until credentials are found or the server is overwhelmed.';
    return [match];
  }
}
