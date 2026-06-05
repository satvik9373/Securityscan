import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { hasDependency, findPatternMatches } from '../../utils/patternMatcher';
import * as path from 'path';

const ENV_VALIDATION_PACKAGES = [
  'envalid',
  't3-env',
  '@t3-oss/env-nextjs',
  '@t3-oss/env-core',
  'env-var',
  'convict',
  'dotenv-safe',
];

// Pattern: process.env.VARNAME — capturing actual var names used
const ENV_USAGE_PATTERN = /process\.env\.([A-Z_][A-Z0-9_]{2,})/g;

// Patterns indicating env validation is done in code
const VALIDATION_CODE_PATTERNS = [
  /z\.object\s*\(\s*\{[^}]*process\.env/s,     // Zod wrapping env
  /z\.string\s*\(\s*\).*process\.env/,
  /envalid|cleanEnv|makeValidators/,
  /convict\s*\(/,
  /env-var/,
  /getEnv\s*\(\s*['"][A-Z]/,                    // custom getEnv wrapper
  /requireEnv\s*\(/,
  /checkEnv\s*\(/,
];

export class MissingEnvValidationRule extends BaseRule {
  id = 'missing_env_validation';
  title = 'Missing Environment Variable Validation';
  description = 'Environment variables are accessed via process.env without validation. If required variables are missing or malformed, the app may silently use undefined values, empty strings, or insecure defaults.';
  severity = 'medium' as const;
  category = 'configuration';
  frameworks = ['nodejs', 'express', 'nextjs', 'nestjs'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['env', 'configuration', 'startup'];
  remediationGuidance = "Use @t3-oss/env-nextjs or Zod to validate env at startup: import { z } from 'zod'; const env = z.object({ DATABASE_URL: z.string().url(), API_KEY: z.string().min(1) }).parse(process.env). Fail fast if required vars are missing.";

  detect(context: ScanContext): RuleMatch[] {
    const { dependencies, devDependencies, files } = context.projectInfo;
    const allDeps = [...dependencies, ...devDependencies];

    // Check for validation packages
    if (ENV_VALIDATION_PACKAGES.some(pkg => hasDependency(allDeps, pkg))) return [];

    // Collect all env vars used across the project
    const envVarsUsed = new Set<string>();
    for (const [, content] of context.fileContents) {
      const matches = findPatternMatches(content, ENV_USAGE_PATTERN);
      for (const m of matches) {
        // Extract the var name from the match
        const varName = m.match.replace('process.env.', '');
        if (varName) envVarsUsed.add(varName);
      }
    }

    if (envVarsUsed.size === 0) return [];

    // Check if validation code exists anywhere
    for (const [, content] of context.fileContents) {
      if (VALIDATION_CODE_PATTERNS.some(p => p.test(content))) return [];
    }

    // Find where env vars are accessed (first occurrence of each)
    const envAccessLocations: FileLocation[] = [];
    const reportedVars = new Set<string>();

    // Prefer env.ts, config.ts, then index files
    const priorityFiles = [
      files.find(f => /(?:env|config)\.[jt]s$/.test(path.basename(f))),
      files.find(f => /index\.[jt]s$/.test(path.basename(f))),
    ].filter(Boolean) as string[];

    const filesToCheck = [...new Set([...priorityFiles, ...files])];

    for (const filePath of filesToCheck) {
      const content = context.fileContents.get(filePath);
      if (!content) continue;

      const matches = findPatternMatches(content, ENV_USAGE_PATTERN);
      for (const m of matches) {
        const varName = m.match.replace('process.env.', '');
        if (reportedVars.has(varName)) continue;
        // Skip common non-critical vars
        if (['NODE_ENV', 'PORT', 'HOST', 'DEBUG'].includes(varName)) continue;
        // Only report truly sensitive ones
        if (!/(?:URL|KEY|SECRET|TOKEN|PASSWORD|DATABASE|DB|REDIS|MONGO|API|AUTH)/.test(varName)) continue;

        reportedVars.add(varName);
        envAccessLocations.push({
          file: filePath,
          line: m.line,
          snippet: `[unvalidated env: ${varName}] ${m.snippet.substring(0, 100)}`,
        });

        if (envAccessLocations.length >= 8) break;
      }
      if (envAccessLocations.length >= 8) break;
    }

    if (envAccessLocations.length === 0) return [];

    const match = this.buildMatch(envAccessLocations);
    match.attackScenario = `App uses ${Array.from(envVarsUsed).slice(0, 3).join(', ')} without validation. If DATABASE_URL is missing in production, the app falls back to undefined, connecting to no database — but the auth check may still pass if it catches errors silently.`;
    return [match];
  }
}
