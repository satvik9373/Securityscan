import { ScanContext, RuleMatch } from '../../types';
import { BaseRule } from '../base';
import { hasDependency } from '../../utils/patternMatcher';
import * as path from 'path';

export class MissingHelmetRule extends BaseRule {
  id = 'missing_helmet';
  title = 'Missing Helmet.js Security Headers';
  description = 'Helmet.js is not configured. HTTP security headers (CSP, HSTS, X-Frame-Options, etc.) are missing, leaving the app vulnerable to common web attacks.';
  severity = 'medium' as const;
  category = 'headers';
  frameworks = ['express', 'nodejs', 'nestjs'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['headers', 'helmet', 'csp', 'hsts', 'owasp-a05'];
  remediationGuidance = 'Install helmet (npm install helmet) and add app.use(helmet()) as early middleware. Configure Content-Security-Policy for your specific use case.';

  detect(context: ScanContext): RuleMatch[] {
    const { dependencies, framework } = context.projectInfo;

    if (!['express', 'nodejs', 'nestjs'].includes(framework)) return [];

    const hasHelmet = hasDependency(dependencies, 'helmet');

    if (hasHelmet) {
      // Verify it's actually used
      for (const [, content] of context.fileContents) {
        if (/helmet\s*\(\s*\)|app\.use\s*\(\s*helmet/.test(content)) {
          return [];
        }
      }
    }

    const entryFiles = context.projectInfo.files
      .filter(f => {
        const base = path.basename(f);
        return ['index.ts', 'index.js', 'server.ts', 'server.js', 'app.ts', 'app.js'].includes(base);
      })
      .slice(0, 3);

    const locations = entryFiles.map(f => ({
      file: f,
      line: 1,
      snippet: 'Helmet middleware not found',
    }));

    if (locations.length === 0) return [];

    const match = this.buildMatch(locations);
    match.attackScenario = 'Without security headers, attackers can execute clickjacking attacks, inject malicious scripts via XSS, or downgrade HTTPS connections.';
    return [match];
  }
}
