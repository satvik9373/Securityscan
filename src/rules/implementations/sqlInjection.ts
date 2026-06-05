import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';

// Patterns indicating unsafe string interpolation in SQL queries
const SQL_INJECTION_PATTERNS = [
  /(?:query|execute|raw)\s*\(\s*`[^`]*\$\{[^}]*(?:req\.|params\.|body\.|query\.)[^}]*\}[^`]*`/g,
  /(?:query|execute|raw)\s*\(\s*['"][^'"]*'\s*\+\s*(?:req\.|params\.|body\.|query\.)/g,
  /(?:query|execute|raw)\s*\(\s*['"][^'"]*"\s*\+\s*(?:req\.|params\.|body\.|query\.)/g,
  /db\.query\s*\(\s*[`'"]/g,
  /connection\.query\s*\(\s*`[^`]*\$\{/g,
  /knex\.raw\s*\(\s*`[^`]*\$\{/g,
  /sequelize\.query\s*\(\s*`[^`]*\$\{/g,
  /\bexec\s*\(\s*[`'"]\s*SELECT.*\+/gi,
  /\bexec\s*\(\s*[`'"]\s*INSERT.*\+/gi,
  /\bexec\s*\(\s*[`'"]\s*UPDATE.*\+/gi,
  /\bexec\s*\(\s*[`'"]\s*DELETE.*\+/gi,
];

export class SqlInjectionRule extends BaseRule {
  id = 'sql_injection_risk';
  title = 'SQL Injection Risk';
  description = 'User-controlled input appears to be directly interpolated into SQL queries without parameterization.';
  severity = 'critical' as const;
  category = 'injection';
  frameworks = 'all' as const;
  languages = ['typescript', 'javascript', 'python', 'php'] as const;
  tags = ['sql-injection', 'injection', 'owasp-a03'];
  remediationGuidance = 'Always use parameterized queries or prepared statements. Never concatenate user input into SQL strings. Use an ORM with safe query builders.';

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];

    for (const [filePath, content] of context.fileContents) {
      if (
        !content.includes('query') &&
        !content.includes('execute') &&
        !content.includes('SELECT') &&
        !content.includes('INSERT')
      ) {
        continue;
      }

      for (const pattern of SQL_INJECTION_PATTERNS) {
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
    match.attackScenario = 'An attacker can inject malicious SQL via user input fields to dump the entire database, bypass authentication, or delete data.';
    return [match];
  }
}
