import { ScanContext, RuleMatch, FileLocation } from '../../types';
import { BaseRule } from '../base';
import * as path from 'path';

interface CookieCall {
  line: number;
  text: string;
  missingFlags: string[];
}

/**
 * Extract res.cookie() calls including multi-line options objects.
 * Returns the starting line number and the full call text.
 */
function extractCookieCalls(content: string): CookieCall[] {
  const lines = content.split('\n');
  const results: CookieCall[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find any cookie-setting pattern on this line
    const isResCookie = /res\.cookie\s*\(/.test(line);
    const isSetCookie = /setCookie\s*\(/.test(line) || /cookies\.set\s*\(/.test(line);
    const isDocCookie = /document\.cookie\s*=/.test(line);
    const isResponseCookies = /response\.cookies\.set\s*\(/.test(line); // Next.js / Fetch API
    const isNextCookies = /cookies\(\)\.set\s*\(/.test(line); // Next.js server actions

    if (!isResCookie && !isSetCookie && !isDocCookie && !isResponseCookies && !isNextCookies) {
      continue;
    }

    if (isDocCookie) {
      // document.cookie = ... — always check what's being set
      const val = line.trim();
      const missingFlags: string[] = [];
      if (!/HttpOnly/i.test(val)) missingFlags.push('HttpOnly');
      if (!/Secure/i.test(val)) missingFlags.push('Secure');
      if (!/SameSite/i.test(val)) missingFlags.push('SameSite');
      if (missingFlags.length > 0) {
        results.push({ line: i + 1, text: val, missingFlags });
      }
      continue;
    }

    // For function-call cookie setters, extract the full call spanning multiple lines
    let callText = '';
    let depth = 0;
    let started = false;
    let endLine = i;

    for (let j = i; j < Math.min(i + 20, lines.length); j++) {
      const chunk = lines[j];
      for (const ch of chunk) {
        if (ch === '(') { depth++; started = true; }
        if (ch === ')') { depth--; }
      }
      callText += (j === i ? chunk : ' ' + chunk.trim());
      endLine = j;
      if (started && depth <= 0) break;
    }

    // Parse the options object for security flags
    const missingFlags: string[] = [];
    const hasHttpOnly = /httpOnly\s*:\s*true/i.test(callText);
    const hasSecure = /secure\s*:\s*true/i.test(callText) || /secure\s*:\s*process\.env\.NODE_ENV\s*===?\s*['"]production['"]/i.test(callText);
    const hasSameSite = /sameSite\s*:/i.test(callText);

    // If no options object at all, all flags are missing
    const hasOptions = /\{\s*[a-zA-Z]/.test(callText.split(/res\.cookie|setCookie|cookies\.set|response\.cookies\.set/)[1] ?? '');

    if (!hasHttpOnly) missingFlags.push('httpOnly');
    if (!hasSecure) missingFlags.push('secure');
    if (!hasSameSite) missingFlags.push('sameSite');

    // Only report if flags are actually missing (not just a transport cookie with no options)
    if (missingFlags.length > 0) {
      // Skip if options explicitly set other security flags (maybe they know what they're doing)
      // Only flag when at least 2 of the 3 are missing — single-miss is common in dev configs
      if (missingFlags.length >= 2 || (!hasHttpOnly && !hasSecure)) {
        results.push({
          line: i + 1,
          text: callText.replace(/\s+/g, ' ').substring(0, 150),
          missingFlags,
        });
      }
    }
  }

  return results;
}

export class InsecureCookiesRule extends BaseRule {
  id = 'insecure_cookies';
  title = 'Insecure Cookie Configuration';
  description = 'Cookies are set without critical security attributes. Missing httpOnly exposes cookies to JavaScript (XSS theft). Missing Secure allows cookies over HTTP. Missing SameSite enables CSRF attacks.';
  severity = 'high' as const;
  category = 'session';
  frameworks = ['express', 'nodejs', 'nextjs'] as const;
  languages = ['typescript', 'javascript'] as const;
  tags = ['cookies', 'session', 'csrf', 'owasp-a02'];
  remediationGuidance = "Set cookies with all security flags: res.cookie('session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 3600000 }). For Next.js, use cookies().set() with the same options.";

  detect(context: ScanContext): RuleMatch[] {
    const locations: FileLocation[] = [];

    for (const [filePath, content] of context.fileContents) {
      if (!/\.[jt]sx?$/.test(filePath)) continue;
      if (
        !content.includes('cookie') &&
        !content.includes('Cookie')
      ) continue;

      const calls = extractCookieCalls(content);
      for (const call of calls) {
        locations.push({
          file: filePath,
          line: call.line,
          snippet: `[missing: ${call.missingFlags.join(', ')}] ${call.text}`,
        });
      }
    }

    if (locations.length === 0) return [];

    const match = this.buildMatch(locations);
    match.attackScenario = 'Without httpOnly, an XSS payload can read document.cookie and exfiltrate session tokens. Without SameSite, a malicious site can trigger state-changing requests using the victim\'s credentials.';
    return [match];
  }
}
