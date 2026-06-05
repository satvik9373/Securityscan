import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches, hasDependency } from '../../utils/patternMatcher';

const VALIDATION_PACKAGES = [
  'zod', 'yup', 'joi', 'class-validator', 'express-validator',
  'ajv', 'superstruct', 'valibot', '@hapi/joi', 'typebox',
  '@sinclair/typebox', 'io-ts', 'runtypes',
];

// Patterns: direct use of user input properties (req.body.x, req.params.x, etc.)
const UNVALIDATED_INPUT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /req\.body\.([a-zA-Z_][a-zA-Z0-9_]*)/g, label: 'req.body' },
  { pattern: /req\.params\.([a-zA-Z_][a-zA-Z0-9_]*)/g, label: 'req.params' },
  { pattern: /req\.query\.([a-zA-Z_][a-zA-Z0-9_]*)/g, label: 'req.query' },
  { pattern: /request\.body\.([a-zA-Z_][a-zA-Z0-9_]*)/g, label: 'request.body' },
  { pattern: /ctx\.request\.body/g, label: 'ctx.request.body' },
  { pattern: /event\.body/g, label: 'event.body (Lambda/API Gateway)' },
  { pattern: /searchParams\.get\s*\(['"]/g, label: 'URL searchParams' },
];

// Indicators that validation IS happening nearby
const VALIDATION_INDICATORS = [
  /\.parse\s*\(/,          // zod .parse(), yup .validate()
  /\.validate\s*\(/,
  /\.safeParse\s*\(/,
  /checkSchema\s*\(/,
  /validationResult\s*\(/,
  /body\s*\(['"]/,         // express-validator body()
  /param\s*\(['"]/,
  /query\s*\(['"]/,
  /schema\s*\./,
  /validator\./,
  /sanitize\s*\(/,
  /Joi\./,
  /yup\./,
  /z\.\w/,                 // zod z.string(), z.number(), etc.
  /class-transformer/,
  /@IsString|@IsNumber|@IsEmail/, // class-validator decorators
];

export class MissingInputValidationRule extends BaseRule {
  id = 'missing_input_validation';
  title = 'Missing Input Validation';
  description = 'Request input (body, params, query) is accessed directly without being validated through a schema validation library. Unvalidated input can cause type errors, injection attacks, and unexpected behavior.';
  severity = 'high' as const;
  category = 'validation';
  frameworks = ['express', 'nodejs', 'nestjs', 'nextjs'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['validation', 'input', 'owasp-a03'];
  remediationGuidance = "Install Zod (npm install zod) and validate all inputs: const body = schema.parse(req.body). For Next.js API routes, validate both the request shape and data types. Reject requests that fail validation with a 400 status.";

  detect(context: ScanContext): RuleMatch[] {
    const { dependencies, devDependencies } = context.projectInfo;
    const allDeps = [...dependencies, ...devDependencies];

    const hasValidationPkg = VALIDATION_PACKAGES.some(pkg => hasDependency(allDeps, pkg));

    // If a validation package is installed, check it's actually used somewhere
    if (hasValidationPkg) {
      // If zod/joi/etc is in deps and used somewhere, trust it
      for (const [, content] of context.fileContents) {
        if (VALIDATION_INDICATORS.some(p => p.test(content))) {
          return [];
        }
      }
    }

    // Find files that use request input without obvious validation
    const locations: FileLocation[] = [];
    const seen = new Set<string>();

    for (const [filePath, content] of context.fileContents) {
      if (!/\.[jt]sx?$/.test(filePath)) continue;

      const hasInput = UNVALIDATED_INPUT_PATTERNS.some(({ pattern }) => {
        // Reset lastIndex since these are module-level regexes with 'g'
        pattern.lastIndex = 0;
        return pattern.test(content);
      });
      if (!hasInput) continue;

      // Check if this specific file validates its inputs
      if (VALIDATION_INDICATORS.some(p => p.test(content))) continue;

      // Find specific unvalidated access points
      for (const { pattern, label } of UNVALIDATED_INPUT_PATTERNS) {
        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          const key = `${filePath}:${m.line}`;
          if (seen.has(key)) continue;
          // Skip if the line itself has validation context
          if (VALIDATION_INDICATORS.some(p => p.test(m.snippet))) continue;
          // Skip if it's in a comment
          if (/^\s*(?:\/\/|\/\*|\*)/.test(m.snippet)) continue;

          seen.add(key);
          locations.push({
            file: filePath,
            line: m.line,
            snippet: `[unvalidated ${label}] ${m.snippet.substring(0, 100)}`,
          });

          // Cap locations per file to avoid noise
          if (locations.filter(l => l.file === filePath).length >= 3) break;
        }
      }
    }

    if (locations.length === 0) return [];

    const match = this.buildMatch(locations.slice(0, 15));
    match.attackScenario = 'An attacker sends {"__proto__": {"isAdmin": true}} as the request body. Without validation, prototype pollution can escalate privileges or crash the server.';
    return [match];
  }
}
