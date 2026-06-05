import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';

// These patterns look for user input being interpolated or concatenated into SQL —
// specifically require a user-controlled variable (req., params., body., query., user., input.)
// to be present inside the SQL call, which distinguishes from safe parameterized queries.
const USER_INPUT_VARS = '(?:req\\.|request\\.|params\\.|body\\.|query\\.|user\\.|input\\.|ctx\\.|event\\.)';

const SQL_INJECTION_PATTERNS: RegExp[] = [
  // Template literal with user input: query(`SELECT ... ${req.body.id}`)
  new RegExp(`(?:query|execute|raw|runSql)\\s*\\(\\s*\`[^\`]*\\$\\{[^}]*${USER_INPUT_VARS}[^}]*\\}`, 'g'),
  // String concatenation: query("SELECT ... " + req.body.id)
  new RegExp(`(?:query|execute|raw|runSql)\\s*\\(\\s*['"][^'"]*['"]\\s*\\+\\s*${USER_INPUT_VARS}`, 'g'),
  new RegExp(`(?:query|execute|raw|runSql)\\s*\\(\\s*\`[^\`]*\`\\s*\\+\\s*${USER_INPUT_VARS}`, 'g'),
  // connection.query with template literal containing user input
  new RegExp(`connection\\.query\\s*\\(\\s*\`[^\`]*\\$\\{[^}]*${USER_INPUT_VARS}[^}]*\\}`, 'g'),
  // knex.raw / sequelize.query with user input interpolation
  new RegExp(`(?:knex\\.raw|sequelize\\.query|db\\.raw)\\s*\\(\\s*\`[^\`]*\\$\\{[^}]*${USER_INPUT_VARS}[^}]*\\}`, 'g'),
  // String concatenation directly building SQL keywords
  new RegExp(`['"\`]\\s*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM)\\s[^'"\`]*['"\`]\\s*\\+\\s*${USER_INPUT_VARS}`, 'gi'),
  // Python-style: cursor.execute with format or %
  /cursor\.execute\s*\(\s*['"f][^'"]*%s[^'"]*['"]\s*%\s*(?:request|req|params|body)/g,
  /cursor\.execute\s*\(\s*f['"][^'"]*\{[^}]*(?:request|req|params|body)/g,
  // PHP-style: mysqli_query / PDO with string concat
  /mysqli_query\s*\([^,]+,\s*['"][^'"]*['"]?\s*\.\s*\$_(?:GET|POST|REQUEST|COOKIE)/g,
  /\$(?:pdo|db|conn|mysqli)->query\s*\(\s*['"][^'"]*['"]?\s*\.\s*\$_(?:GET|POST|REQUEST)/g,
];

export class SqlInjectionRule extends BaseRule {
  id = 'sql_injection_risk';
  title = 'SQL Injection Risk';
  description = 'User-controlled input is directly interpolated or concatenated into SQL queries without parameterization, allowing attackers to modify query logic.';
  severity = 'critical' as const;
  category = 'injection';
  frameworks = 'all' as const;
  languages = ['typescript', 'javascript', 'python', 'php'] as const;
  tags = ['sql-injection', 'injection', 'owasp-a03'];
  remediationGuidance = 'Use parameterized queries or prepared statements: db.query("SELECT * FROM users WHERE id = ?", [req.params.id]). ORMs like Prisma, Drizzle, and TypeORM use safe query builders by default — avoid .raw() calls with user input.';

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];
    const seen = new Set<string>();

    for (const [filePath, content] of context.fileContents) {
      // Quick exit: skip files with no SQL-like content
      if (
        !content.includes('query') &&
        !content.includes('execute') &&
        !content.includes('SELECT') &&
        !content.includes('INSERT') &&
        !content.includes('UPDATE') &&
        !content.includes('DELETE')
      ) {
        continue;
      }

      for (const pattern of SQL_INJECTION_PATTERNS) {
        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          const key = `${filePath}:${m.line}`;
          if (seen.has(key)) continue;
          seen.add(key);
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
    match.attackScenario = "An attacker sends ' OR '1'='1 as a user ID parameter. The raw SQL becomes SELECT * FROM users WHERE id = '' OR '1'='1' which returns all rows, bypassing authentication or leaking the entire database.";
    return [match];
  }
}
