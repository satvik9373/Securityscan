import { SecurityRule } from '../types';
import { HardcodedSecretsRule } from './implementations/hardcodedSecrets';
import { MissingRateLimitingRule } from './implementations/missingRateLimiting';
import { OpenCorsRule } from './implementations/openCors';
import { MissingHelmetRule } from './implementations/missingHelmet';
import { SqlInjectionRule } from './implementations/sqlInjection';
import { XssRiskRule } from './implementations/xssRisk';
import { UnsafeJwtRule } from './implementations/unsafeJwt';
import { MissingInputValidationRule } from './implementations/missingInputValidation';
import { ExposedApiKeyRule } from './implementations/exposedApiKey';
import { MissingEnvValidationRule } from './implementations/missingEnvValidation';
import { InsecureCookiesRule } from './implementations/insecureCookies';
import { PathTraversalRule } from './implementations/pathTraversal';

export class RuleRegistry {
  private rules: Map<string, SecurityRule> = new Map();

  constructor() {
    this.registerBuiltInRules();
  }

  private registerBuiltInRules(): void {
    const builtIns: SecurityRule[] = [
      new HardcodedSecretsRule(),
      new MissingRateLimitingRule(),
      new OpenCorsRule(),
      new MissingHelmetRule(),
      new SqlInjectionRule(),
      new XssRiskRule(),
      new UnsafeJwtRule(),
      new MissingInputValidationRule(),
      new ExposedApiKeyRule(),
      new MissingEnvValidationRule(),
      new InsecureCookiesRule(),
      new PathTraversalRule(),
    ];

    for (const rule of builtIns) {
      this.register(rule);
    }
  }

  register(rule: SecurityRule): void {
    this.rules.set(rule.id, rule);
  }

  unregister(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  getRule(id: string): SecurityRule | undefined {
    return this.rules.get(id);
  }

  getAllRules(): SecurityRule[] {
    return Array.from(this.rules.values());
  }

  getRulesByCategory(category: string): SecurityRule[] {
    return this.getAllRules().filter(r => r.category === category);
  }

  getRulesBySeverity(severity: string): SecurityRule[] {
    return this.getAllRules().filter(r => r.severity === severity);
  }
}

export const globalRuleRegistry = new RuleRegistry();
