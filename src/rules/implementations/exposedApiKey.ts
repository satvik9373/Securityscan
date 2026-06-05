import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';
import * as path from 'path';

// NEXT_PUBLIC_ env vars that contain secret-sounding names are bundled to the browser
const NEXT_PUBLIC_SECRET_PATTERN = /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|KEY|TOKEN|PASSWORD|CREDENTIAL|AUTH)[A-Z0-9_]*/g;

// Patterns that indicate secrets in client-side files
const CLIENT_SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Direct secret value assignment in client code
  { pattern: /(?:apiKey|api_key|secretKey|secret_key|privateKey|private_key|accessToken)\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/gi, label: 'secret hardcoded in client file' },
  // process.env.SECRET (no NEXT_PUBLIC_) accessed in client component — will be undefined in browser but indicates confusion
  { pattern: /process\.env\.(?!NEXT_PUBLIC_)[A-Z_]+(?:SECRET|KEY|TOKEN|PASSWORD)/g, label: 'server-only env var in client component' },
  // localStorage storing tokens — poor practice
  { pattern: /localStorage\.setItem\s*\(\s*['"`][^'"`]*(?:token|key|secret|password)[^'"`]*['"`]/gi, label: 'sensitive data in localStorage' },
  // Sending secrets to client via JSON response
  { pattern: /res\.json\s*\([^)]*(?:secret|password|token|key)\s*:/gi, label: 'potential secret in JSON response' },
];

// File paths that are definitely client-side (Next.js/React)
const CLIENT_FILE_PATTERNS = [
  /\/pages\/(?!api\/)/,           // Next.js pages (not API routes)
  /\/app\/(?!api\/).*\.(tsx|jsx)$/,  // Next.js app dir components
  /\/components\//,
  /\/hooks\//,
  /\/context\//,
  /\/store\//,
  /\.client\.[jt]sx?$/,           // explicitly client files
];

// Files where secrets ARE expected (server-side)
const SERVER_FILE_PATTERNS = [
  /\/pages\/api\//,
  /\/app\/api\//,
  /\/server\//,
  /\/lib\/(?:server|auth|db)/,
  /\.server\.[jt]sx?$/,
];

export class ExposedApiKeyRule extends BaseRule {
  id = 'exposed_api_key';
  title = 'API Key / Secret Exposed to Client';
  description = 'Secrets or API keys may be accessible in client-side code or bundled into the browser. NEXT_PUBLIC_ variables are always visible to anyone who views the page source.';
  severity = 'critical' as const;
  category = 'secrets';
  frameworks = ['nextjs', 'react'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['api-key', 'secrets', 'client-side', 'owasp-a02'];
  remediationGuidance = "Never use NEXT_PUBLIC_ prefix for secrets. Move all secret API calls to server-side API routes (/pages/api/ or /app/api/). Store secrets only in server-side env vars (no NEXT_PUBLIC_ prefix). Use Next.js Server Actions for server-side mutations.";

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];
    const seen = new Set<string>();

    // 1. Scan .env files for NEXT_PUBLIC_ variables with secret-sounding names
    for (const [filePath, content] of context.fileContents) {
      const basename = path.basename(filePath);
      if (!basename.startsWith('.env')) continue;

      const matches = findPatternMatches(content, NEXT_PUBLIC_SECRET_PATTERN);
      for (const m of matches) {
        const key = `${filePath}:${m.line}`;
        if (seen.has(key)) continue;
        // Only flag if there's actually a value (not just the var name)
        if (/=\s*\S/.test(m.snippet)) {
          seen.add(key);
          locations.push({
            file: filePath,
            line: m.line,
            snippet: `[NEXT_PUBLIC_ secret exposed to browser] ${m.snippet.substring(0, 100)}`,
          });
        }
      }
    }

    // 2. Scan client-side component files for secret usage
    for (const [filePath, content] of context.fileContents) {
      if (!/\.[jt]sx?$/.test(filePath)) continue;

      const isClientFile = CLIENT_FILE_PATTERNS.some(p => p.test(filePath));
      const isServerFile = SERVER_FILE_PATTERNS.some(p => p.test(filePath));

      if (!isClientFile || isServerFile) continue;

      // Check for 'use server' directive — if present, it's a server action
      if (/['"]use server['"]/.test(content)) continue;

      for (const { pattern, label } of CLIENT_SECRET_PATTERNS) {
        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          const key = `${filePath}:${m.line}`;
          if (seen.has(key)) continue;
          // Skip comments and type definitions
          if (/^\s*(?:\/\/|\/\*|\*|type |interface )/.test(m.snippet)) continue;

          seen.add(key);
          locations.push({
            file: filePath,
            line: m.line,
            snippet: `[${label}] ${m.snippet.substring(0, 120)}`,
          });
        }
      }
    }

    if (locations.length === 0) return [];

    const match = this.buildMatch(locations);
    match.attackScenario = 'Any user who opens browser DevTools → Network tab can see all NEXT_PUBLIC_ variables. Secrets like OpenAI keys or Stripe secret keys exposed this way let attackers make API calls on your account, accruing charges or accessing data.';
    return [match];
  }
}
