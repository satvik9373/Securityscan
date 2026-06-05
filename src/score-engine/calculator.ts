import { RuleMatch, SecurityScore, Severity } from '../types';

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

const SEVERITY_MAX_DEDUCTION: Record<Severity, number> = {
  critical: 100,
  high: 60,
  medium: 40,
  low: 20,
  info: 0,
};

export function calculateSecurityScore(issues: RuleMatch[], resolvedIds: string[] = []): SecurityScore {
  const activeIssues = issues.filter(i => !resolvedIds.includes(i.ruleId));

  let deduction = 0;
  const breakdown = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const issue of activeIssues) {
    const weight = SEVERITY_WEIGHTS[issue.severity] ?? 0;
    deduction += weight;

    if (issue.severity in breakdown) {
      breakdown[issue.severity as keyof typeof breakdown]++;
    }
  }

  // Cap deduction per severity level
  const cappedDeduction = Math.min(deduction, 100);
  const total = Math.max(0, 100 - cappedDeduction);

  return {
    total,
    breakdown,
    grade: gradeFromScore(total),
  };
}

function gradeFromScore(score: number): SecurityScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';  // green
  if (score >= 60) return '#f59e0b';  // amber
  if (score >= 40) return '#f97316';  // orange
  return '#ef4444';                    // red
}
