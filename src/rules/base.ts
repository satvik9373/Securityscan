import { SecurityRule, ScanContext, RuleMatch, Severity, Framework, Language } from '../types';

export abstract class BaseRule implements SecurityRule {
  abstract id: string;
  abstract title: string;
  abstract description: string;
  abstract severity: Severity;
  abstract category: string;
  abstract frameworks: readonly Framework[] | 'all';
  abstract languages: readonly Language[] | 'all';
  abstract tags: string[];
  abstract remediationGuidance: string;
  references?: string[];

  abstract detect(context: ScanContext): RuleMatch[];

  protected appliesToProject(context: ScanContext): boolean {
    const { framework, language } = context.projectInfo;

    const frameworkMatch =
      this.frameworks === 'all' ||
      (this.frameworks as readonly Framework[]).includes(framework);

    const languageMatch =
      this.languages === 'all' ||
      (this.languages as readonly Language[]).includes(language);

    return frameworkMatch && languageMatch;
  }

  protected buildMatch(locations: RuleMatch['locations']): RuleMatch {
    return {
      ruleId: this.id,
      title: this.title,
      severity: this.severity,
      description: this.description,
      locations,
      remediationGuidance: this.remediationGuidance,
    };
  }
}
