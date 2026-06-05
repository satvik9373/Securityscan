export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type Framework =
  | 'nextjs'
  | 'react'
  | 'nodejs'
  | 'express'
  | 'nestjs'
  | 'django'
  | 'flask'
  | 'laravel'
  | 'spring'
  | 'go'
  | 'unknown';

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'php'
  | 'java'
  | 'go'
  | 'unknown';

export interface FileLocation {
  file: string;
  line: number;
  column?: number;
  snippet?: string;
}

export interface SecurityRule {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  frameworks: readonly Framework[] | 'all';
  languages: readonly Language[] | 'all';
  tags: string[];
  remediationGuidance: string;
  references?: string[];
  detect(context: ScanContext): RuleMatch[];
}

export interface RuleMatch {
  ruleId: string;
  title: string;
  severity: Severity;
  description: string;
  locations: FileLocation[];
  remediationGuidance: string;
  attackScenario?: string;
}

export interface ProjectInfo {
  rootPath: string;
  framework: Framework;
  language: Language;
  files: string[];
  packageJson?: PackageJson;
  dependencies: string[];
  devDependencies: string[];
}

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface ScanContext {
  projectInfo: ProjectInfo;
  fileContents: Map<string, string>;
  ast?: Map<string, unknown>;
}

export interface ScanResult {
  id: string;
  timestamp: number;
  projectPath: string;
  framework: Framework;
  language: Language;
  issues: RuleMatch[];
  score: SecurityScore;
  fileCount: number;
  linesScanned: number;
  duration: number;
}

export interface SecurityScore {
  total: number;
  breakdown: ScoreBreakdown;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface ScoreBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface AIFixPrompt {
  issueId: string;
  explanation: string;
  remediationPlan: string;
  copyablePrompt: string;
  affectedFiles: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  sessionToken: string | null;
}

export interface StoredState {
  authState: AuthState;
  lastScanResult: ScanResult | null;
  resolvedIssues: string[];
}

export interface WebviewMessage {
  type: WebviewMessageType;
  payload?: unknown;
}

export type WebviewMessageType =
  | 'scan'
  | 'rescan'
  | 'signIn'
  | 'signInDemo'
  | 'signOut'
  | 'openFile'
  | 'generateFix'
  | 'copyPrompt'
  | 'markResolved'
  | 'ready'
  | 'updateState'
  | 'scanProgress'
  | 'scanComplete'
  | 'authProgress'
  | 'authSuccess'
  | 'authError'
  | 'error';
