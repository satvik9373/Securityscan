import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { hasDependency } from '../../utils/patternMatcher';
import * as path from 'path';

const HELMET_ALTERNATIVES = [
  'helmet',
  '@fastify/helmet',
  'fastify-helmet',
  'koa-helmet',
  // NestJS helmet
];

// Patterns that indicate security headers are set manually
const MANUAL_HEADER_PATTERNS = [
  /Content-Security-Policy/,
  /X-Frame-Options/,
  /X-Content-Type-Options/,
  /Strict-Transport-Security/,
  /helmet\s*\(/,
  /@Header\s*\(\s*['"]Content-Security-Policy/,  // NestJS
];

const ENTRY_POINT_NAMES = new Set([
  'index.ts', 'index.js',
  'server.ts', 'server.js',
  'app.ts', 'app.js',
  'main.ts', 'main.js',
]);

export class MissingHelmetRule extends BaseRule {
  id = 'missing_helmet';
  title = 'Missing Security Headers (Helmet.js)';
  description = 'HTTP security headers are not configured. Without headers like Content-Security-Policy, X-Frame-Options, and Strict-Transport-Security, the app is vulnerable to clickjacking, MIME sniffing, and protocol downgrade attacks.';
  severity = 'medium' as const;
  category = 'headers';
  frameworks = ['express', 'nodejs', 'nestjs'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['headers', 'helmet', 'csp', 'hsts', 'owasp-a05'];
  remediationGuidance = "Install helmet: npm install helmet. Add as early middleware: import helmet from 'helmet'; app.use(helmet()). For NestJS: app.use(helmet()) in main.ts. Configure CSP for your specific asset sources.";

  detect(context: ScanContext): RuleMatch[] {
    const { dependencies, devDependencies, framework } = context.projectInfo;
    const allDeps = [...dependencies, ...devDependencies];

    if (!['express', 'nodejs', 'nestjs'].includes(framework)) return [];

    const hasHelmetPkg = HELMET_ALTERNATIVES.some(pkg => hasDependency(allDeps, pkg));

    // If package is present, verify it's actually used in code
    if (hasHelmetPkg) {
      for (const [, content] of context.fileContents) {
        if (/helmet\s*\(\s*\)|app\.use\s*\(\s*helmet/.test(content)) {
          return [];
        }
      }
      // Package installed but not used — still flag it
    }

    // Check if headers are manually set
    for (const [, content] of context.fileContents) {
      if (MANUAL_HEADER_PATTERNS.some(p => p.test(content))) {
        return [];
      }
    }

    // Find entry point files
    const entryFiles: FileLocation[] = [];
    for (const filePath of context.projectInfo.files) {
      const base = path.basename(filePath);
      if (!ENTRY_POINT_NAMES.has(base)) continue;

      const content = context.fileContents.get(filePath);
      // Find where app middleware is registered (look for app.use)
      const appUseLine = content
        ? content.split('\n').findIndex(l => /app\.use\s*\(/.test(l))
        : -1;

      entryFiles.push({
        file: filePath,
        line: appUseLine >= 0 ? appUseLine + 1 : 1,
        snippet: hasHelmetPkg
          ? 'helmet package found but app.use(helmet()) not called'
          : 'No security headers middleware found — add app.use(helmet()) here',
      });

      if (entryFiles.length >= 2) break;
    }

    if (entryFiles.length === 0) return [];

    const match = this.buildMatch(entryFiles);
    match.attackScenario = 'Without X-Frame-Options, attackers embed your site in an invisible iframe to trick users into clicking UI elements (clickjacking). Without CSP, injected inline scripts can execute even if your own code has no XSS.';
    return [match];
  }
}
