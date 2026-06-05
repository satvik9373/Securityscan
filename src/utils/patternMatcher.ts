export interface PatternMatch {
  line: number;
  column: number;
  snippet: string;
  match: string;
}

export function findPatternMatches(content: string, pattern: RegExp): PatternMatch[] {
  const lines = content.split('\n');
  const matches: PatternMatch[] = [];
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');

  lines.forEach((line, lineIdx) => {
    globalPattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = globalPattern.exec(line)) !== null) {
      matches.push({
        line: lineIdx + 1,
        column: m.index + 1,
        snippet: line.trim(),
        match: m[0],
      });
    }
  });

  return matches;
}

export function containsAny(content: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(content));
}

export function countOccurrences(content: string, pattern: RegExp): number {
  const global = new RegExp(pattern.source, 'g');
  return (content.match(global) ?? []).length;
}

export function extractImports(content: string, language: 'js' | 'ts' | 'python'): string[] {
  const imports: string[] = [];

  if (language === 'js' || language === 'ts') {
    const requirePattern = /require\(['"]([^'"]+)['"]\)/g;
    const importPattern = /from\s+['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;

    while ((m = requirePattern.exec(content)) !== null) {
      imports.push(m[1]);
    }
    while ((m = importPattern.exec(content)) !== null) {
      imports.push(m[1]);
    }
  } else if (language === 'python') {
    const importPattern = /^import\s+(\S+)|^from\s+(\S+)\s+import/gm;
    let m: RegExpExecArray | null;
    while ((m = importPattern.exec(content)) !== null) {
      imports.push(m[1] ?? m[2]);
    }
  }

  return imports;
}

export function hasDependency(dependencies: string[], ...pkgs: string[]): boolean {
  return pkgs.some(pkg => dependencies.includes(pkg));
}
