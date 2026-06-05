import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import { findPatternMatches } from '../../utils/patternMatcher';

interface JwtIssue { pattern: RegExp; label: string; }

const UNSAFE_JWT_PATTERNS: JwtIssue[] = [
  // Algorithm explicitly set to 'none'
  { pattern: /algorithm\s*:\s*['"`]none['"`]/gi, label: 'algorithm: none disables signature verification' },
  { pattern: /algorithms\s*:\s*\[\s*['"`]none['"`]/gi, label: 'algorithms: ["none"] allows unsigned tokens' },
  // jwt.sign with empty string secret
  { pattern: /jwt\.sign\s*\([^)]*,\s*['"]{2}\s*[,)]/g, label: 'jwt.sign with empty secret' },
  { pattern: /jwt\.sign\s*\([^)]*,\s*`\s*`\s*[,)]/g, label: 'jwt.sign with empty template literal secret' },
  // jwt.sign with null/undefined secret
  { pattern: /jwt\.sign\s*\([^)]*,\s*(?:null|undefined)\s*[,)]/g, label: 'jwt.sign with null secret' },
  // ignoreExpiration disables expiry checks
  { pattern: /ignoreExpiration\s*:\s*true/g, label: 'ignoreExpiration: true — tokens never expire' },
  // notBefore: 0 / nbf checks disabled
  { pattern: /ignoreNotBefore\s*:\s*true/g, label: 'ignoreNotBefore: true' },
  // jwt.decode used INSTEAD of jwt.verify — decode does NOT verify signature
  { pattern: /jwt\.decode\s*\([^)]*\)(?![^;{]*verify)/g, label: 'jwt.decode instead of jwt.verify (no signature check)' },
  // Hardcoded short/weak JWT secrets
  { pattern: /jwt\.sign\s*\([^,]+,\s*['"`](?:secret|password|123|abc|test|dev|jwt|token)['"`]/gi, label: 'weak hardcoded JWT secret' },
  // jose/jsonwebtoken with none alg
  { pattern: /new\s+SignJWT\s*\([^)]*\)(?:[^;]*alg\s*:\s*['"`]none['"`])/g, label: 'jose SignJWT with none algorithm' },
];

export class UnsafeJwtRule extends BaseRule {
  id = 'unsafe_jwt';
  title = 'Unsafe JWT Configuration';
  description = 'JWT tokens are configured insecurely: weak or empty secrets, disabled signature verification, missing expiration, or the "none" algorithm — any of which allows attackers to forge tokens.';
  severity = 'critical' as const;
  category = 'authentication';
  frameworks = 'all' as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['jwt', 'authentication', 'owasp-a02'];
  remediationGuidance = 'Always use jwt.verify() (not jwt.decode()). Use a strong random secret: crypto.randomBytes(64).toString("hex"). Set expiry: jwt.sign(payload, secret, { expiresIn: "1h" }). Use RS256/ES256 for multi-service architectures.';

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];
    const seen = new Set<string>();

    for (const [filePath, content] of context.fileContents) {
      if (!/\.[jt]sx?$/.test(filePath)) continue;
      if (!content.includes('jwt') && !content.includes('JWT') && !content.includes('JsonWebToken')) {
        continue;
      }

      // Special case: if the file uses jwt.decode but also jwt.verify, it's probably fine
      // (decode used to extract claims after verify). Only flag files that ONLY use decode.
      const hasVerify = /jwt\.verify\s*\(/.test(content) || /jwtService\.verify/.test(content) || /\.verifyToken\s*\(/.test(content);

      for (const { pattern, label } of UNSAFE_JWT_PATTERNS) {
        // Skip the decode-only check if verify is also present
        if (label.includes('decode') && hasVerify) continue;

        const matches = findPatternMatches(content, pattern);
        for (const m of matches) {
          const key = `${filePath}:${m.line}`;
          if (seen.has(key)) continue;
          // Skip comments
          if (/^\s*(?:\/\/|\/\*|\*)/.test(m.snippet)) continue;

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
    match.attackScenario = 'With the "none" algorithm, an attacker modifies their JWT payload (e.g., role: "admin"), removes the signature, and sets alg: "none". The server accepts the forged token without verifying the signature.';
    return [match];
  }
}
