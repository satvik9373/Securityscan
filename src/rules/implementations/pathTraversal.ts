import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';

const PATH_TRAVERSAL_PATTERNS = [
  /fs\.readFile(?:Sync)?\s*\(\s*(?:req\.|params\.|body\.|query\.)/g,
  /fs\.writeFile(?:Sync)?\s*\(\s*(?:req\.|params\.|body\.|query\.)/g,
  /path\.join\s*\([^)]*(?:req\.|params\.|body\.|query\.)/g,
  /res\.sendFile\s*\(\s*(?:req\.|params\.|body\.|query\.)/g,
  /require\s*\(\s*(?:req\.|params\.|body\.|query\.)/g,
];

export class PathTraversalRule extends BaseRule {
  id = 'path_traversal';
  title = 'Path Traversal Risk';
  description = 'User-controlled input is used in file system operations without sanitization, enabling directory traversal attacks.';
  severity = 'critical' as const;
  category = 'injection';
  frameworks = ['express', 'nodejs', 'nextjs'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['path-traversal', 'file-inclusion', 'owasp-a01'];
  remediationGuidance = 'Sanitize file paths from user input. Use path.resolve and verify the result is within an allowed base directory. Never pass req.params/body directly to file system functions.';

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];

    for (const [filePath, content] of context.fileContents) {
      if (!content.includes('fs.') && !content.includes('readFile') && !content.includes('sendFile')) {
        continue;
      }

      for (const pattern of PATH_TRAVERSAL_PATTERNS) {
        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          locations.push({
            file: filePath,
            line: m.line,
            snippet: m.snippet,
          });
        }
      }
    }

    if (locations.length === 0) return [];

    const match = this.buildMatch(locations);
    match.attackScenario = 'An attacker sends a request with "../../../etc/passwd" as a file parameter, reading sensitive system files or overwriting critical application files.';
    return [match];
  }
}
