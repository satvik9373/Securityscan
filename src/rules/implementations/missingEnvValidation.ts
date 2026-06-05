import { ScanContext, RuleMatch } from '../../types';
import { BaseRule } from '../base';
import * as path from 'path';

export class MissingEnvValidationRule extends BaseRule {
  id = 'missing_env_validation';
  title = 'Missing Environment Variable Validation';
  description = 'Environment variables are not validated at startup. Missing or malformed env vars may cause silent failures or insecure fallbacks.';
  severity = 'medium' as const;
  category = 'configuration';
  frameworks = ['nodejs', 'express', 'nextjs', 'nestjs'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['env', 'configuration', 'startup'];
  remediationGuidance = 'Use a library like envalid, zod (with z.object for env), or t3-env to validate environment variables at startup. Fail fast if required vars are missing.';

  detect(context: ScanContext): RuleMatch[] {
    const { rootPath, files } = context.projectInfo;

    // Check if there are env vars in use
    let usesEnvVars = false;
    for (const [, content] of context.fileContents) {
      if (/process\.env\.[A-Z_]{3,}/.test(content)) {
        usesEnvVars = true;
        break;
      }
    }

    if (!usesEnvVars) return [];

    // Check if any env validation exists
    const hasEnvValidation = context.projectInfo.dependencies.some(d =>
      ['envalid', 't3-env', '@t3-oss/env-nextjs', '@t3-oss/env-core'].includes(d)
    );

    if (hasEnvValidation) return [];

    for (const [, content] of context.fileContents) {
      if (/z\.object\s*\(\s*\{[^}]*process\.env/s.test(content)) return [];
      if (/envalid|cleanEnv|makeValidators/.test(content)) return [];
    }

    // Find the main entry file
    const entryFile = files.find(f => {
      const base = path.basename(f);
      return ['env.ts', 'env.js', 'config.ts', 'config.js'].includes(base);
    }) ?? files.find(f => {
      const base = path.basename(f);
      return ['index.ts', 'index.js'].includes(base);
    }) ?? files[0];

    if (!entryFile) return [];

    const match = this.buildMatch([{
      file: entryFile,
      line: 1,
      snippet: 'No environment variable validation detected',
    }]);
    match.attackScenario = 'Missing required env vars can cause the app to run with insecure defaults (empty secrets, wrong DB connections) without any warning.';
    return [match];
  }
}
