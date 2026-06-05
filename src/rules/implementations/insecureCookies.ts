import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';

// Cookie set without secure/httpOnly flags
const INSECURE_COOKIE_PATTERNS = [
  /res\.cookie\s*\([^)]*\)/g,
  /setCookie\s*\([^)]*\)/g,
  /document\.cookie\s*=/g,
];

export class InsecureCookiesRule extends BaseRule {
  id = 'insecure_cookies';
  title = 'Insecure Cookie Configuration';
  description = 'Cookies are set without HttpOnly, Secure, or SameSite attributes, making them vulnerable to theft and CSRF attacks.';
  severity = 'high' as const;
  category = 'session';
  frameworks = ['express', 'nodejs', 'nextjs'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['cookies', 'session', 'csrf', 'owasp-a02'];
  remediationGuidance = 'Set cookies with httpOnly: true, secure: true (in production), and sameSite: "strict" or "lax". Use cookie-parser with signed cookies for session data.';

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];

    for (const [filePath, content] of context.fileContents) {
      if (!content.includes('cookie') && !content.includes('Cookie')) continue;

      const matches = findPatternMatches(content, INSECURE_COOKIE_PATTERNS[0]);
      for (const m of matches) {
        const snippet = m.snippet;
        const hasHttpOnly = /httpOnly\s*:\s*true/i.test(snippet);
        const hasSecure = /secure\s*:\s*true/i.test(snippet);
        const hasSameSite = /sameSite/i.test(snippet);

        if (!hasHttpOnly || !hasSecure || !hasSameSite) {
          locations.push({
            file: filePath,
            line: m.line,
            snippet: `Cookie without ${[
              !hasHttpOnly ? 'httpOnly' : null,
              !hasSecure ? 'secure' : null,
              !hasSameSite ? 'sameSite' : null,
            ].filter(Boolean).join(', ')} flag`,
          });
        }
      }

      // Check for document.cookie (always bad in server context)
      const docCookieMatches = findPatternMatches(content, INSECURE_COOKIE_PATTERNS[2]);
      for (const m of docCookieMatches) {
        locations.push({
          file: filePath,
          line: m.line,
          snippet: m.snippet,
        });
      }
    }

    if (locations.length === 0) return [];

    const match = this.buildMatch(locations);
    match.attackScenario = 'Session cookies without HttpOnly can be stolen via XSS. Cookies without Secure can be transmitted over HTTP. Missing SameSite enables CSRF attacks.';
    return [match];
  }
}
