import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';

const XSS_PATTERNS = [
  /dangerouslySetInnerHTML\s*=\s*\{/g,
  /innerHTML\s*=\s*(?!['"`]<)/g,
  /document\.write\s*\(/g,
  /eval\s*\(\s*(?:req\.|params\.|body\.|query\.)/g,
  /res\.send\s*\(\s*(?:req\.|params\.|body\.|query\.)/g,
  /res\.write\s*\(\s*(?:req\.|params\.|body\.|query\.)/g,
  /v-html\s*=\s*['"]/g,
];

export class XssRiskRule extends BaseRule {
  id = 'xss_risk';
  title = 'Cross-Site Scripting (XSS) Risk';
  description = 'Unsanitized user input may be rendered as HTML or executed as JavaScript, enabling XSS attacks.';
  severity = 'high' as const;
  category = 'injection';
  frameworks = 'all' as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['xss', 'injection', 'owasp-a03'];
  remediationGuidance = 'Sanitize all user input before rendering. Avoid dangerouslySetInnerHTML in React. Use DOMPurify for HTML sanitization. Implement Content-Security-Policy headers.';

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];

    for (const [filePath, content] of context.fileContents) {
      for (const pattern of XSS_PATTERNS) {
        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          // Skip if it's clearly a static string
          if (m.snippet.includes("''") || m.snippet.includes('""')) continue;
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
    match.attackScenario = 'An attacker injects malicious JavaScript into input fields. When other users view the content, the script executes in their browser, stealing cookies or session tokens.';
    return [match];
  }
}
