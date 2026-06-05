# SecureScan — AI Security Copilot for VS Code

SecureScan is a production-ready VS Code extension that scans your entire codebase for security vulnerabilities, generates actionable checklists, and creates AI-powered fix prompts.

## Features

- **Automatic Framework Detection** — Next.js, React, Node.js, Express, NestJS, and more
- **12 Security Rules** covering OWASP Top 10
- **Security Score** (0–100) with letter grade
- **AI Fix Prompts** powered by OpenAI GPT-4o-mini
- **Clerk Authentication** — sign in before scanning
- **Rescan & Verification** — verify fixes actually work
- **Jump to File** — click any issue to open the exact file and line

## Security Rules

| Rule | Severity | Description |
|------|----------|-------------|
| `hardcoded_secrets` | 🔴 Critical | Passwords, API keys, tokens in source code |
| `sql_injection_risk` | 🔴 Critical | User input in SQL queries |
| `unsafe_jwt` | 🔴 Critical | Weak JWT secrets, `none` algorithm |
| `exposed_api_key` | 🔴 Critical | Secrets in client-side code |
| `path_traversal` | 🔴 Critical | User input in file system operations |
| `missing_rate_limiting` | 🟠 High | No rate limiting on APIs |
| `open_cors` | 🟠 High | Wildcard CORS policy |
| `xss_risk` | 🟠 High | Unsanitized HTML rendering |
| `insecure_cookies` | 🟠 High | Missing HttpOnly/Secure/SameSite |
| `missing_input_validation` | 🟠 High | No validation library |
| `missing_helmet` | 🟡 Medium | Missing security headers |
| `missing_env_validation` | 🟡 Medium | Env vars not validated at startup |

## Setup

### 1. Install

```
code --install-extension securescan-1.0.0.vsix
```

### 2. Configure

Open VS Code Settings and set:

```
securescan.clerkPublishableKey = pk_test_...
securescan.openaiApiKey = sk-...
```

Or set environment variables:

```bash
CLERK_PUBLISHABLE_KEY=pk_test_...
OPENAI_API_KEY=sk-...
```

### 3. Scan

1. Open a project in VS Code
2. Click the 🛡️ SecureScan icon in the Activity Bar
3. Sign in with your Clerk credentials
4. Click **Scan Project**

## Architecture

```
src/
├── extension.ts              # VS Code entry point
├── types/                    # Shared TypeScript types
├── authentication/           # Clerk auth manager
├── framework-detection/      # Auto-detect framework/language
├── scanner/                  # Main scan orchestrator
├── rules/
│   ├── base.ts              # Abstract BaseRule
│   ├── registry.ts          # Rule registry
│   └── implementations/     # 12 security rules
├── score-engine/            # 0-100 score calculator
├── ai/                      # OpenAI fix generator
├── storage/                 # VS Code state persistence
└── ui/                      # Webview provider + HTML/CSS/JS
```

## Adding Custom Rules

```typescript
import { BaseRule } from './rules/base';
import { ScanContext, RuleMatch } from './types';

class MyCustomRule extends BaseRule {
  id = 'my_custom_rule';
  title = 'My Custom Check';
  severity = 'medium' as const;
  frameworks = 'all' as const;
  languages = 'all' as const;
  // ...

  detect(context: ScanContext): RuleMatch[] {
    // Your detection logic here
    return [];
  }
}

// Register it:
import { globalRuleRegistry } from './rules/registry';
globalRuleRegistry.register(new MyCustomRule());
```

## Supported Frameworks

**MVP:** Next.js, React, Node.js, Express  
**Planned:** Django, Flask, Laravel, Spring Boot, Go, NestJS

## Performance

- Handles 50,000+ lines of code
- Skips files over 1MB
- Excludes `node_modules`, `dist`, `.git` automatically
- Progress reporting during scan

## License

MIT
