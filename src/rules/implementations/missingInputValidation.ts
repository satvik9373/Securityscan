import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { hasDependency } from '../../utils/patternMatcher';

const VALIDATION_PACKAGES = [
  'zod', 'yup', 'joi', 'class-validator', 'express-validator',
  'ajv', 'superstruct', 'valibot', '@hapi/joi',
];

// Route handler patterns that suggest input is being used without validation
const UNVALIDATED_INPUT_PATTERNS = [
  /req\.body\.[a-zA-Z_]+/g,
  /req\.params\.[a-zA-Z_]+/g,
  /req\.query\.[a-zA-Z_]+/g,
];

export class MissingInputValidationRule extends BaseRule {
  id = 'missing_input_validation';
  title = 'Missing Input Validation';
  description = 'No input validation library is detected. User-supplied data may be used without type checking or sanitization.';
  severity = 'high' as const;
  category = 'validation';
  frameworks = ['express', 'nodejs', 'nestjs', 'nextjs'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['validation', 'input', 'owasp-a03'];
  remediationGuidance = 'Use a validation library like Zod, Joi, or express-validator. Validate all request body, params, and query parameters before processing. Define schemas for all API inputs.';

  detect(context: ScanContext): RuleMatch[] {
    const { dependencies } = context.projectInfo;

    const hasValidation = VALIDATION_PACKAGES.some(pkg =>
      hasDependency(dependencies, pkg)
    );

    if (hasValidation) return [];

    // Find files that access req.body, req.params, etc. without validation
    const locations: FileLocation[] = [];

    for (const [filePath, content] of context.fileContents) {
      if (!content.includes('req.body') && !content.includes('req.params') && !content.includes('req.query')) {
        continue;
      }

      // Check if there's any validation logic
      if (/validate|schema|sanitize|parse/i.test(content)) continue;

      let found = false;
      for (const pattern of UNVALIDATED_INPUT_PATTERNS) {
        const m = pattern.exec(content);
        if (m && !found) {
          const lineNum = content.substring(0, m.index).split('\n').length;
          locations.push({
            file: filePath,
            line: lineNum,
            snippet: 'Unvalidated request input usage',
          });
          found = true;
        }
      }
    }

    if (locations.length === 0) return [];

    const match = this.buildMatch(locations.slice(0, 10));
    match.attackScenario = 'Attackers can send malformed or malicious data to crash the application, trigger unexpected behavior, or inject payloads.';
    return [match];
  }
}
