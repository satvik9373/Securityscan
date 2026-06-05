import * as vscode from 'vscode';
import { RuleMatch, AIFixPrompt } from '../types';
import { getEnvVar } from '../utils/envReader';

export interface AITelemetry {
  keyLoaded: boolean;
  keySource: 'vscode-config' | 'env-var' | 'none';
  lastRequestTime: number | null;
  lastResponseTime: number | null;
  lastDurationMs: number | null;
  totalTokensUsed: number;
  lastError: string | null;
  requestCount: number;
}

const telemetry: AITelemetry = {
  keyLoaded: false,
  keySource: 'none',
  lastRequestTime: null,
  lastResponseTime: null,
  lastDurationMs: null,
  totalTokensUsed: 0,
  lastError: null,
  requestCount: 0,
};

export function getAITelemetry(): AITelemetry {
  return { ...telemetry };
}

export class AIFixGenerator {
  private getOpenAIKey(): { key: string | undefined; source: AITelemetry['keySource'] } {
    const config = vscode.workspace.getConfiguration('securescan');
    const fromConfig = config.get<string>('openaiApiKey');
    if (fromConfig) return { key: fromConfig, source: 'vscode-config' };

    const fromEnv = getEnvVar('OPENAI_API_KEY', 'NEXT_PUBLIC_OPENAI_API_KEY');
    if (fromEnv) return { key: fromEnv, source: 'env-var' };

    return { key: undefined, source: 'none' };
  }

  checkKeyStatus(): void {
    const { key, source } = this.getOpenAIKey();
    telemetry.keyLoaded = !!key;
    telemetry.keySource = source;
    console.log(`[SecureScan] OPENAI KEY EXISTS: ${telemetry.keyLoaded ? 'TRUE' : 'FALSE'} (source: ${source})`);
  }

  async generateFix(issue: RuleMatch, framework: string): Promise<AIFixPrompt> {
    const affectedFiles = [...new Set(issue.locations.map(l => l.file))];
    const copyablePrompt = this.buildPrompt(issue, framework, affectedFiles);

    const { key: apiKey, source } = this.getOpenAIKey();
    telemetry.keyLoaded = !!apiKey;
    telemetry.keySource = source;

    console.log(`[SecureScan] OPENAI KEY EXISTS: ${telemetry.keyLoaded ? 'TRUE' : 'FALSE'} (source: ${source})`);

    let explanation = issue.description;
    let remediationPlan = issue.remediationGuidance;

    if (apiKey) {
      try {
        const enhanced = await this.callOpenAI(apiKey, issue, framework, affectedFiles);
        explanation = enhanced.explanation;
        remediationPlan = enhanced.remediationPlan;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        telemetry.lastError = msg;
        console.error('[SecureScan] OPENAI REQUEST FAILED:', msg);
      }
    } else {
      console.warn('[SecureScan] OPENAI REQUEST SKIPPED — no API key configured. Add key via: Settings > securescan.openaiApiKey or OPENAI_API_KEY env var');
    }

    return {
      issueId: issue.ruleId,
      explanation,
      remediationPlan,
      copyablePrompt,
      affectedFiles,
    };
  }

  private async callOpenAI(
    apiKey: string,
    issue: RuleMatch,
    framework: string,
    affectedFiles: string[]
  ): Promise<{ explanation: string; remediationPlan: string }> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });

    const locationsSummary = issue.locations
      .slice(0, 5)
      .map(l => `  - ${l.file}:${l.line}${l.snippet ? ` — ${l.snippet}` : ''}`)
      .join('\n');

    const requestStart = Date.now();
    telemetry.lastRequestTime = requestStart;
    telemetry.lastError = null;
    telemetry.requestCount++;

    console.log(`[SecureScan] OPENAI REQUEST STARTED — issue: ${issue.ruleId}, model: gpt-4o-mini, request #${telemetry.requestCount}`);

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a senior security engineer. Provide concise, actionable security guidance.',
        },
        {
          role: 'user',
          content: `Security issue found in a ${framework} application:

Issue: ${issue.title}
Severity: ${issue.severity}
Description: ${issue.description}

Affected locations:
${locationsSummary}

Provide:
1. A 2-3 sentence explanation of why this is dangerous
2. A step-by-step remediation plan (3-5 steps)

Respond in JSON: { "explanation": "...", "remediationPlan": "..." }`,
        },
      ],
      temperature: 0.3,
      max_tokens: 600,
    });

    const durationMs = Date.now() - requestStart;
    telemetry.lastResponseTime = Date.now();
    telemetry.lastDurationMs = durationMs;

    const tokensUsed = response.usage?.total_tokens ?? 0;
    telemetry.totalTokensUsed += tokensUsed;

    console.log(`[SecureScan] OPENAI RESPONSE RECEIVED — duration: ${durationMs}ms, tokens: ${tokensUsed}, total tokens used: ${telemetry.totalTokensUsed}`);

    const content = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content) as { explanation: string; remediationPlan: string };
    return parsed;
  }

  buildPrompt(issue: RuleMatch, framework: string, affectedFiles: string[]): string {
    const filesList = affectedFiles.slice(0, 10).join('\n');
    const locationDetails = issue.locations
      .slice(0, 10)
      .map(l => `  ${l.file}:${l.line}`)
      .join('\n');

    return `You are a senior security engineer.

I have a ${framework} application with the following security vulnerability:

**Issue:** ${issue.title}
**Severity:** ${issue.severity.toUpperCase()}
**Description:** ${issue.description}

**Attack scenario:** ${issue.attackScenario ?? 'See OWASP documentation for attack scenarios.'}

**Affected files:**
${locationDetails}

**Task:** Please fix this security vulnerability in my codebase.

**Requirements:**
- ${issue.remediationGuidance}
- Preserve all existing functionality
- Follow ${framework} best practices
- Add comments explaining the security fix
- Do not break any existing tests

**Affected files to modify:**
${filesList}

Please provide the complete fixed code for each affected file with explanations of every change made.`;
  }
}
