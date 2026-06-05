import * as vscode from 'vscode';
import { RuleMatch, AIFixPrompt } from '../types';

export class AIFixGenerator {
  private getOpenAIKey(): string | undefined {
    const config = vscode.workspace.getConfiguration('securescan');
    return config.get<string>('openaiApiKey') || process.env['OPENAI_API_KEY'];
  }

  async generateFix(issue: RuleMatch, framework: string): Promise<AIFixPrompt> {
    const affectedFiles = [...new Set(issue.locations.map(l => l.file))];
    const copyablePrompt = this.buildPrompt(issue, framework, affectedFiles);

    const apiKey = this.getOpenAIKey();
    let explanation = issue.description;
    let remediationPlan = issue.remediationGuidance;

    if (apiKey) {
      try {
        const enhanced = await this.callOpenAI(apiKey, issue, framework, affectedFiles);
        explanation = enhanced.explanation;
        remediationPlan = enhanced.remediationPlan;
      } catch (err) {
        console.error('OpenAI call failed, using static guidance:', err);
      }
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
