import * as path from 'path';
import { Framework, Language, PackageJson, ProjectInfo } from '../types';
import { fileExists, getAllFiles, readJsonFile } from '../utils/fileUtils';

export class FrameworkDetector {
  detect(rootPath: string): ProjectInfo {
    const packageJson = readJsonFile<PackageJson>(path.join(rootPath, 'package.json'));
    const dependencies = this.extractDeps(packageJson);
    const devDependencies = this.extractDevDeps(packageJson);
    const allDeps = [...dependencies, ...devDependencies];

    const framework = this.detectFramework(rootPath, allDeps, packageJson);
    const language = this.detectLanguage(rootPath, allDeps);
    const files = getAllFiles(rootPath);

    return {
      rootPath,
      framework,
      language,
      files,
      packageJson: packageJson ?? undefined,
      dependencies,
      devDependencies,
    };
  }

  private detectFramework(
    rootPath: string,
    deps: string[],
    pkg: PackageJson | null
  ): Framework {
    // Next.js
    if (
      deps.includes('next') ||
      fileExists(path.join(rootPath, 'next.config.js')) ||
      fileExists(path.join(rootPath, 'next.config.ts'))
    ) {
      return 'nextjs';
    }

    // NestJS
    if (deps.includes('@nestjs/core') || deps.includes('@nestjs/common')) {
      return 'nestjs';
    }

    // Express
    if (deps.includes('express')) {
      return 'express';
    }

    // React (SPA without Next)
    if (deps.includes('react') || deps.includes('react-dom')) {
      return 'react';
    }

    // Node.js (generic)
    if (
      fileExists(path.join(rootPath, 'package.json')) ||
      pkg !== null
    ) {
      return 'nodejs';
    }

    // Python frameworks
    if (
      fileExists(path.join(rootPath, 'manage.py')) ||
      fileExists(path.join(rootPath, 'settings.py'))
    ) {
      return 'django';
    }

    if (
      fileExists(path.join(rootPath, 'app.py')) ||
      fileExists(path.join(rootPath, 'wsgi.py'))
    ) {
      return 'flask';
    }

    // Laravel
    if (
      fileExists(path.join(rootPath, 'artisan')) ||
      fileExists(path.join(rootPath, 'composer.json'))
    ) {
      return 'laravel';
    }

    // Go
    if (
      fileExists(path.join(rootPath, 'go.mod')) ||
      fileExists(path.join(rootPath, 'main.go'))
    ) {
      return 'go';
    }

    // Spring Boot
    if (
      fileExists(path.join(rootPath, 'pom.xml')) ||
      fileExists(path.join(rootPath, 'build.gradle'))
    ) {
      return 'spring';
    }

    return 'unknown';
  }

  private detectLanguage(rootPath: string, deps: string[]): Language {
    if (
      fileExists(path.join(rootPath, 'tsconfig.json')) ||
      deps.some(d => d === 'typescript' || d === 'ts-node')
    ) {
      return 'typescript';
    }

    if (fileExists(path.join(rootPath, 'package.json'))) {
      return 'javascript';
    }

    if (
      fileExists(path.join(rootPath, 'requirements.txt')) ||
      fileExists(path.join(rootPath, 'setup.py')) ||
      fileExists(path.join(rootPath, 'pyproject.toml'))
    ) {
      return 'python';
    }

    if (fileExists(path.join(rootPath, 'composer.json'))) {
      return 'php';
    }

    if (fileExists(path.join(rootPath, 'go.mod'))) {
      return 'go';
    }

    if (
      fileExists(path.join(rootPath, 'pom.xml')) ||
      fileExists(path.join(rootPath, 'build.gradle'))
    ) {
      return 'java';
    }

    return 'unknown';
  }

  private extractDeps(pkg: PackageJson | null): string[] {
    if (!pkg?.dependencies) return [];
    return Object.keys(pkg.dependencies);
  }

  private extractDevDeps(pkg: PackageJson | null): string[] {
    if (!pkg?.devDependencies) return [];
    return Object.keys(pkg.devDependencies);
  }
}
