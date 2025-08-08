import * as fs from 'fs';
import * as path from 'path';
import { toolsManager } from '../tools/tools-manager';
import chalk from 'chalk';

export interface FileContext {
  path: string;
  content: string;
  size: number;
  modified: Date;
  language: string;
  importance: number; // 0-100
  summary?: string;
  dependencies?: string[];
  exports?: string[];
}

export interface DirectoryContext {
  path: string;
  files: FileContext[];
  subdirectories: DirectoryContext[];
  totalFiles: number;
  totalSize: number;
  mainLanguages: string[];
  framework?: string;
  importance: number;
  summary?: string;
}

export interface WorkspaceContext {
  rootPath: string;
  selectedPaths: string[];
  directories: Map<string, DirectoryContext>;
  files: Map<string, FileContext>;
  projectMetadata: {
    name?: string;
    framework?: string;
    languages: string[];
    dependencies: string[];
    structure: any;
  };
  lastUpdated: Date;
}

export class WorkspaceContextManager {
  private context: WorkspaceContext;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private analysisCache: Map<string, any> = new Map();

  constructor(rootPath: string = process.cwd()) {
    this.context = {
      rootPath,
      selectedPaths: [rootPath],
      directories: new Map(),
      files: new Map(),
      projectMetadata: {
        languages: [],
        dependencies: [],
        structure: {},
      },
      lastUpdated: new Date(),
    };
  }

  // Select specific directories/files for focused context
  async selectPaths(paths: string[]): Promise<void> {
    console.log(chalk.blue(`🎯 Selecting workspace context: ${paths.join(', ')}`));

    this.context.selectedPaths = paths.map(p => path.resolve(this.context.rootPath, p));

    // Analyze selected paths
    await this.analyzeSelectedPaths();

    console.log(chalk.green(`✅ Workspace context updated with ${this.context.files.size} files`));
  }

  private async analyzeSelectedPaths(): Promise<void> {
    this.context.files.clear();
    this.context.directories.clear();

    for (const selectedPath of this.context.selectedPaths) {
      if (fs.existsSync(selectedPath)) {
        const stat = fs.statSync(selectedPath);

        if (stat.isDirectory()) {
          await this.analyzeDirectory(selectedPath);
        } else if (stat.isFile()) {
          await this.analyzeFile(selectedPath);
        }
      }
    }

    // Update project metadata
    await this.updateProjectMetadata();
    this.context.lastUpdated = new Date();
  }

  private async analyzeDirectory(dirPath: string): Promise<DirectoryContext> {
    const relativePath = path.relative(this.context.rootPath, dirPath);

    // Skip node_modules and other irrelevant directories
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
    if (skipDirs.some(skip => relativePath.includes(skip))) {
      return {
        path: relativePath,
        files: [],
        subdirectories: [],
        totalFiles: 0,
        totalSize: 0,
        mainLanguages: [],
        importance: 0,
        summary: 'Skipped directory',
      };
    }

    console.log(chalk.cyan(`📁 Analyzing directory: ${relativePath}`));

    const files: FileContext[] = [];
    const subdirectories: DirectoryContext[] = [];
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        const subDir = await this.analyzeDirectory(itemPath);
        subdirectories.push(subDir);
      } else if (stat.isFile()) {
        const file = await this.analyzeFile(itemPath);
        if (file) {
          files.push(file);
        }
      }
    }

    // Calculate directory importance and metadata
    const totalFiles = files.length + subdirectories.reduce((sum, d) => sum + d.totalFiles, 0);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0) +
      subdirectories.reduce((sum, d) => sum + d.totalSize, 0);

    const languages = Array.from(new Set([
      ...files.map(f => f.language).filter(Boolean),
      ...subdirectories.flatMap(d => d.mainLanguages)
    ]));

    const importance = this.calculateDirectoryImportance(relativePath, totalFiles, languages);

    const dirContext: DirectoryContext = {
      path: relativePath,
      files,
      subdirectories,
      totalFiles,
      totalSize,
      mainLanguages: languages,
      importance,
      summary: await this.generateDirectorySummary(relativePath, files, subdirectories),
    };

    this.context.directories.set(relativePath, dirContext);
    return dirContext;
  }

  private async analyzeFile(filePath: string): Promise<FileContext | null> {
    try {
      const relativePath = path.relative(this.context.rootPath, filePath);
      const extension = path.extname(filePath).slice(1);

      // Skip binary files and irrelevant files
      const skipExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'zip', 'tar', 'gz'];
      if (skipExtensions.includes(extension.toLowerCase())) {
        return null;
      }

      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const language = this.detectLanguage(extension, content);
      const importance = this.calculateFileImportance(relativePath, extension, content);

      const fileContext: FileContext = {
        path: relativePath,
        content,
        size: stat.size,
        modified: stat.mtime,
        language,
        importance,
        summary: await this.generateFileSummary(relativePath, content, language),
        dependencies: this.extractDependencies(content, language),
        exports: this.extractExports(content, language),
      };

      this.context.files.set(relativePath, fileContext);
      return fileContext;

    } catch (error) {
      console.log(chalk.yellow(`⚠️ Could not analyze file: ${filePath}`));
      return null;
    }
  }

  private detectLanguage(extension: string, content: string): string {
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
    };

    const detected = langMap[extension.toLowerCase()];
    if (detected) return detected;

    // Try to detect from content
    if (content.includes('import React') || content.includes('from react')) return 'typescript';
    if (content.includes('#!/usr/bin/env python')) return 'python';
    if (content.includes('#!/bin/bash')) return 'bash';

    return 'text';
  }

  private calculateFileImportance(filePath: string, extension: string, content: string): number {
    let importance = 50; // Base importance

    // Higher importance for certain files
    const importantFiles = ['package.json', 'tsconfig.json', 'README.md', 'index.ts', 'index.js', 'app.ts'];
    if (importantFiles.some(f => filePath.endsWith(f))) {
      importance += 30;
    }

    // Higher importance for main source directories
    if (filePath.includes('src/') || filePath.includes('components/')) {
      importance += 20;
    }

    // Higher importance based on file size (but not too large)
    const sizeScore = Math.min(content.length / 100, 20);
    importance += sizeScore;

    // Higher importance for files with exports
    const exportCount = (content.match(/export\s+/g) || []).length;
    importance += Math.min(exportCount * 5, 25);

    return Math.min(importance, 100);
  }

  private calculateDirectoryImportance(path: string, fileCount: number, languages: string[]): number {
    let importance = 30; // Base importance

    // Higher importance for source directories
    const importantDirs = ['src', 'components', 'pages', 'app', 'lib', 'utils', 'api'];
    if (importantDirs.some(dir => path.includes(dir))) {
      importance += 40;
    }

    // Higher importance based on file count
    importance += Math.min(fileCount * 2, 30);

    // Higher importance for TypeScript/JavaScript heavy directories
    const jstsCount = languages.filter(l => ['javascript', 'typescript'].includes(l)).length;
    if (jstsCount > 0) {
      importance += 20;
    }

    return Math.min(importance, 100);
  }

  private extractDependencies(content: string, language: string): string[] {
    const dependencies: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // Extract import statements
      const importMatches = content.match(/import .+ from ['"]([^'"]+)['"]/g);
      if (importMatches) {
        importMatches.forEach(match => {
          const dep = match.match(/from ['"]([^'"]+)['"]/)?.[1];
          if (dep && !dep.startsWith('.')) {
            dependencies.push(dep);
          }
        });
      }

      // Extract require statements
      const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g);
      if (requireMatches) {
        requireMatches.forEach(match => {
          const dep = match.match(/require\(['"]([^'"]+)['"]\)/)?.[1];
          if (dep && !dep.startsWith('.')) {
            dependencies.push(dep);
          }
        });
      }
    }

    return Array.from(new Set(dependencies));
  }

  private extractExports(content: string, language: string): string[] {
    const exports: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // Extract export statements
      const exportMatches = content.match(/export\s+(const|function|class|interface|type)\s+(\w+)/g);
      if (exportMatches) {
        exportMatches.forEach(match => {
          const exportName = match.match(/export\s+(?:const|function|class|interface|type)\s+(\w+)/)?.[1];
          if (exportName) {
            exports.push(exportName);
          }
        });
      }

      // Extract default exports
      const defaultExportMatch = content.match(/export\s+default\s+(\w+)/);
      if (defaultExportMatch) {
        exports.push(`default:${defaultExportMatch[1]}`);
      }
    }

    return exports;
  }

  private async generateFileSummary(filePath: string, content: string, language: string): Promise<string> {
    // Simple rule-based summary generation
    const lines = content.split('\n').length;

    if (filePath.endsWith('package.json')) {
      try {
        const pkg = JSON.parse(content);
        return `Package: ${pkg.name} v${pkg.version}`;
      } catch {
        return 'Package configuration file';
      }
    }

    if (language === 'typescript' || language === 'javascript') {
      const functions = (content.match(/function\s+\w+/g) || []).length;
      const classes = (content.match(/class\s+\w+/g) || []).length;
      const components = (content.match(/const\s+\w+.*=.*\(.*\)\s*=>/g) || []).length;

      return `${language} file with ${functions} functions, ${classes} classes, ${components} components (${lines} lines)`;
    }

    return `${language} file (${lines} lines)`;
  }

  private async generateDirectorySummary(dirPath: string, files: FileContext[], subdirs: DirectoryContext[]): Promise<string> {
    const totalFiles = files.length;
    const languages = Array.from(new Set(files.map(f => f.language)));

    if (dirPath.includes('components')) {
      return `React components directory with ${totalFiles} files (${languages.join(', ')})`;
    }

    if (dirPath.includes('pages') || dirPath.includes('app')) {
      return `Application pages/routes with ${totalFiles} files`;
    }

    return `Directory with ${totalFiles} files in ${languages.join(', ')}`;
  }

  private async updateProjectMetadata(): Promise<void> {
    // Analyze project structure
    const projectAnalysis = await toolsManager.analyzeProject();

    this.context.projectMetadata = {
      name: projectAnalysis.packageInfo?.name,
      framework: projectAnalysis.framework,
      languages: projectAnalysis.technologies,
      dependencies: Object.keys(projectAnalysis.packageInfo?.dependencies || {}),
      structure: projectAnalysis.structure,
    };
  }

  // Get context for AI agents
  getContextForAgent(agentId: string, maxFiles: number = 20): {
    selectedPaths: string[];
    relevantFiles: FileContext[];
    projectSummary: string;
    totalContext: string;
  } {
    // Get most important files within selected paths
    const relevantFiles = Array.from(this.context.files.values())
      .filter(file => this.context.selectedPaths.some(path =>
        file.path.startsWith(path.replace(this.context.rootPath, ''))
      ))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, maxFiles);

    const projectSummary = this.generateProjectSummary();

    // Generate total context string
    const totalContext = this.generateContextString(relevantFiles, projectSummary);

    return {
      selectedPaths: this.context.selectedPaths,
      relevantFiles,
      projectSummary,
      totalContext,
    };
  }

  private generateProjectSummary(): string {
    const metadata = this.context.projectMetadata;
    const fileCount = this.context.files.size;
    const dirCount = this.context.directories.size;

    return `Project: ${metadata.name || 'Unnamed'} (${metadata.framework || 'Unknown framework'})
Files: ${fileCount} files in ${dirCount} directories
Languages: ${metadata.languages.join(', ')}
Dependencies: ${metadata.dependencies.slice(0, 10).join(', ')}${metadata.dependencies.length > 10 ? '...' : ''}
Selected Paths: ${this.context.selectedPaths.join(', ')}`;
  }

  private generateContextString(files: FileContext[], projectSummary: string): string {
    let context = `=== WORKSPACE CONTEXT ===\n${projectSummary}\n\n`;

    context += `=== SELECTED FILES (${files.length}) ===\n`;
    files.forEach(file => {
      context += `\n--- ${file.path} (${file.language}, ${file.size} bytes, importance: ${file.importance}) ---\n`;
      context += `Summary: ${file.summary}\n`;
      if (file.exports && file.exports.length > 0) {
        context += `Exports: ${file.exports.join(', ')}\n`;
      }
      if (file.dependencies && file.dependencies.length > 0) {
        context += `Dependencies: ${file.dependencies.join(', ')}\n`;
      }
      // Include file content (truncated for large files)
      const contentPreview = file.content.length > 2000 ?
        file.content.slice(0, 2000) + '\n... [truncated]' :
        file.content;
      context += `Content:\n${contentPreview}\n`;
    });

    return context;
  }

  // Watch for file changes in selected paths
  startWatching(): void {
    this.stopWatching(); // Clear existing watchers

    this.context.selectedPaths.forEach(selectedPath => {
      if (fs.existsSync(selectedPath)) {
        const watcher = fs.watch(selectedPath, { recursive: true }, (eventType, filename) => {
          if (filename) {
            console.log(chalk.yellow(`📁 File changed: ${filename} (${eventType})`));
            // Debounced re-analysis
            setTimeout(() => this.analyzeSelectedPaths(), 1000);
          }
        });

        this.watchers.set(selectedPath, watcher);
      }
    });

    console.log(chalk.green(`👀 Watching ${this.context.selectedPaths.length} paths for changes`));
  }

  stopWatching(): void {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers.clear();
  }

  // Display context summary
  showContextSummary(): void {
    console.log(chalk.blue.bold('\n🌍 Workspace Context Summary'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`📁 Root Path: ${this.context.rootPath}`);
    console.log(`🎯 Selected Paths: ${this.context.selectedPaths.length}`);
    this.context.selectedPaths.forEach(p => {
      console.log(`  • ${p}`);
    });

    console.log(`📄 Files: ${this.context.files.size}`);
    console.log(`📁 Directories: ${this.context.directories.size}`);
    console.log(`🔧 Framework: ${this.context.projectMetadata.framework || 'Unknown'}`);
    console.log(`💻 Languages: ${this.context.projectMetadata.languages.join(', ')}`);
    console.log(`📦 Dependencies: ${this.context.projectMetadata.dependencies.length}`);
    console.log(`🕐 Last Updated: ${this.context.lastUpdated.toLocaleTimeString()}`);

    // Show most important files
    const topFiles = Array.from(this.context.files.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);

    if (topFiles.length > 0) {
      console.log(chalk.blue.bold('\n📋 Most Important Files:'));
      topFiles.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.path} (${file.language}, importance: ${file.importance})`);
        console.log(`     ${chalk.gray(file.summary)}`);
      });
    }
  }
}

export const workspaceContext = new WorkspaceContextManager();