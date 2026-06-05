import * as crypto from 'crypto';
import { ScanContext, ScanResult, RuleMatch, ProjectInfo } from '../types';
import { RuleRegistry } from '../rules/registry';
import { FrameworkDetector } from '../framework-detection/detector';
import { readFileContent, countLines } from '../utils/fileUtils';
import { calculateSecurityScore } from '../score-engine/calculator';

export type ScanProgressCallback = (message: string, percent: number) => void;

export class SecurityScanner {
  private detector = new FrameworkDetector();
  private registry: RuleRegistry;

  constructor(registry: RuleRegistry) {
    this.registry = registry;
  }

  async scan(
    rootPath: string,
    resolvedIssues: string[] = [],
    onProgress?: ScanProgressCallback
  ): Promise<ScanResult> {
    const startTime = Date.now();

    onProgress?.('Detecting framework...', 5);
    const projectInfo = this.detector.detect(rootPath);

    onProgress?.(`Detected: ${projectInfo.framework} / ${projectInfo.language}`, 15);

    // Load file contents
    onProgress?.('Loading files...', 20);
    const fileContents = new Map<string, string>();
    let linesScanned = 0;
    let loaded = 0;

    for (const file of projectInfo.files) {
      const content = readFileContent(file);
      if (content !== null) {
        fileContents.set(file, content);
        linesScanned += countLines(content);
      }
      loaded++;
      if (loaded % 50 === 0) {
        const pct = 20 + Math.floor((loaded / projectInfo.files.length) * 30);
        onProgress?.(`Loading files... (${loaded}/${projectInfo.files.length})`, pct);
      }
    }

    onProgress?.(`Scanned ${linesScanned.toLocaleString()} lines across ${fileContents.size} files`, 50);

    const context: ScanContext = { projectInfo, fileContents };

    // Run rules
    const rules = this.registry.getAllRules();
    const issues: RuleMatch[] = [];
    let ruleIdx = 0;

    for (const rule of rules) {
      onProgress?.(`Running rule: ${rule.title}`, 50 + Math.floor((ruleIdx / rules.length) * 40));
      try {
        const matches = rule.detect(context);
        issues.push(...matches);
      } catch (err) {
        console.error(`Rule ${rule.id} failed:`, err);
      }
      ruleIdx++;
    }

    onProgress?.('Calculating security score...', 92);
    const score = calculateSecurityScore(issues, resolvedIssues);

    onProgress?.('Scan complete', 100);

    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      projectPath: rootPath,
      framework: projectInfo.framework,
      language: projectInfo.language,
      issues,
      score,
      fileCount: fileContents.size,
      linesScanned,
      duration: Date.now() - startTime,
    };
  }
}
