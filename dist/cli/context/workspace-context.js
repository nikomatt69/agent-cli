"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceContext = exports.WorkspaceContextManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const tools_manager_1 = require("../tools/tools-manager");
const chalk_1 = __importDefault(require("chalk"));
class WorkspaceContextManager {
    constructor(rootPath = process.cwd()) {
        this.watchers = new Map();
        this.analysisCache = new Map();
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
    async selectPaths(paths) {
        console.log(chalk_1.default.blue(`🎯 Selecting workspace context: ${paths.join(', ')}`));
        this.context.selectedPaths = paths.map(p => path.resolve(this.context.rootPath, p));
        await this.analyzeSelectedPaths();
        console.log(chalk_1.default.green(`✅ Workspace context updated with ${this.context.files.size} files`));
    }
    async analyzeSelectedPaths() {
        this.context.files.clear();
        this.context.directories.clear();
        for (const selectedPath of this.context.selectedPaths) {
            if (fs.existsSync(selectedPath)) {
                const stat = fs.statSync(selectedPath);
                if (stat.isDirectory()) {
                    await this.analyzeDirectory(selectedPath);
                }
                else if (stat.isFile()) {
                    await this.analyzeFile(selectedPath);
                }
            }
        }
        await this.updateProjectMetadata();
        this.context.lastUpdated = new Date();
    }
    async analyzeDirectory(dirPath) {
        const relativePath = path.relative(this.context.rootPath, dirPath);
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
        console.log(chalk_1.default.cyan(`📁 Analyzing directory: ${relativePath}`));
        const files = [];
        const subdirectories = [];
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                const subDir = await this.analyzeDirectory(itemPath);
                subdirectories.push(subDir);
            }
            else if (stat.isFile()) {
                const file = await this.analyzeFile(itemPath);
                if (file) {
                    files.push(file);
                }
            }
        }
        const totalFiles = files.length + subdirectories.reduce((sum, d) => sum + d.totalFiles, 0);
        const totalSize = files.reduce((sum, f) => sum + f.size, 0) +
            subdirectories.reduce((sum, d) => sum + d.totalSize, 0);
        const languages = Array.from(new Set([
            ...files.map(f => f.language).filter(Boolean),
            ...subdirectories.flatMap(d => d.mainLanguages)
        ]));
        const importance = this.calculateDirectoryImportance(relativePath, totalFiles, languages);
        const dirContext = {
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
    async analyzeFile(filePath) {
        try {
            const relativePath = path.relative(this.context.rootPath, filePath);
            const extension = path.extname(filePath).slice(1);
            const skipExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'zip', 'tar', 'gz'];
            if (skipExtensions.includes(extension.toLowerCase())) {
                return null;
            }
            const stat = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf8');
            const language = this.detectLanguage(extension, content);
            const importance = this.calculateFileImportance(relativePath, extension, content);
            const fileContext = {
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
        }
        catch (error) {
            console.log(chalk_1.default.yellow(`⚠️ Could not analyze file: ${filePath}`));
            return null;
        }
    }
    detectLanguage(extension, content) {
        const langMap = {
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
        if (detected)
            return detected;
        if (content.includes('import React') || content.includes('from react'))
            return 'typescript';
        if (content.includes('#!/usr/bin/env python'))
            return 'python';
        if (content.includes('#!/bin/bash'))
            return 'bash';
        return 'text';
    }
    calculateFileImportance(filePath, extension, content) {
        let importance = 50;
        const importantFiles = ['package.json', 'tsconfig.json', 'README.md', 'index.ts', 'index.js', 'app.ts'];
        if (importantFiles.some(f => filePath.endsWith(f))) {
            importance += 30;
        }
        if (filePath.includes('src/') || filePath.includes('components/')) {
            importance += 20;
        }
        const sizeScore = Math.min(content.length / 100, 20);
        importance += sizeScore;
        const exportCount = (content.match(/export\s+/g) || []).length;
        importance += Math.min(exportCount * 5, 25);
        return Math.min(importance, 100);
    }
    calculateDirectoryImportance(path, fileCount, languages) {
        let importance = 30;
        const importantDirs = ['src', 'components', 'pages', 'app', 'lib', 'utils', 'api'];
        if (importantDirs.some(dir => path.includes(dir))) {
            importance += 40;
        }
        importance += Math.min(fileCount * 2, 30);
        const jstsCount = languages.filter(l => ['javascript', 'typescript'].includes(l)).length;
        if (jstsCount > 0) {
            importance += 20;
        }
        return Math.min(importance, 100);
    }
    extractDependencies(content, language) {
        const dependencies = [];
        if (language === 'typescript' || language === 'javascript') {
            const importMatches = content.match(/import .+ from ['"]([^'"]+)['"]/g);
            if (importMatches) {
                importMatches.forEach(match => {
                    const dep = match.match(/from ['"]([^'"]+)['"]/)?.[1];
                    if (dep && !dep.startsWith('.')) {
                        dependencies.push(dep);
                    }
                });
            }
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
    extractExports(content, language) {
        const exports = [];
        if (language === 'typescript' || language === 'javascript') {
            const exportMatches = content.match(/export\s+(const|function|class|interface|type)\s+(\w+)/g);
            if (exportMatches) {
                exportMatches.forEach(match => {
                    const exportName = match.match(/export\s+(?:const|function|class|interface|type)\s+(\w+)/)?.[1];
                    if (exportName) {
                        exports.push(exportName);
                    }
                });
            }
            const defaultExportMatch = content.match(/export\s+default\s+(\w+)/);
            if (defaultExportMatch) {
                exports.push(`default:${defaultExportMatch[1]}`);
            }
        }
        return exports;
    }
    async generateFileSummary(filePath, content, language) {
        const lines = content.split('\n').length;
        if (filePath.endsWith('package.json')) {
            try {
                const pkg = JSON.parse(content);
                return `Package: ${pkg.name} v${pkg.version}`;
            }
            catch {
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
    async generateDirectorySummary(dirPath, files, subdirs) {
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
    async updateProjectMetadata() {
        const projectAnalysis = await tools_manager_1.toolsManager.analyzeProject();
        this.context.projectMetadata = {
            name: projectAnalysis.packageInfo?.name,
            framework: projectAnalysis.framework,
            languages: projectAnalysis.technologies,
            dependencies: Object.keys(projectAnalysis.packageInfo?.dependencies || {}),
            structure: projectAnalysis.structure,
        };
    }
    getContextForAgent(agentId, maxFiles = 20, searchQuery) {
        if (searchQuery || this.context.files.size > 50) {
            return this.getFilteredContextForAgent(agentId, maxFiles, searchQuery);
        }
        const relevantFiles = Array.from(this.context.files.values())
            .filter(file => this.context.selectedPaths.some(path => file.path.startsWith(path.replace(this.context.rootPath, ''))))
            .sort((a, b) => b.importance - a.importance)
            .slice(0, maxFiles);
        const projectSummary = this.generateProjectSummary();
        const totalContext = this.generateContextString(relevantFiles, projectSummary);
        return {
            selectedPaths: this.context.selectedPaths,
            relevantFiles,
            projectSummary,
            totalContext,
        };
    }
    getFilteredContextForAgent(agentId, maxFiles = 20, searchQuery) {
        console.log(chalk_1.default.yellow(`🔍 Auto-filtering context${searchQuery ? ` for query: "${searchQuery}"` : ' (large workspace)'}...`));
        let relevantFiles;
        if (searchQuery) {
            relevantFiles = this.searchFilesWithQuery(searchQuery, maxFiles);
        }
        else {
            relevantFiles = Array.from(this.context.files.values())
                .sort((a, b) => b.importance - a.importance)
                .slice(0, maxFiles);
        }
        const projectSummary = this.generateProjectSummary();
        const totalContext = this.generateContextString(relevantFiles, projectSummary);
        console.log(chalk_1.default.green(`✅ Context filtered to ${relevantFiles.length} relevant files`));
        return {
            selectedPaths: this.context.selectedPaths,
            relevantFiles,
            projectSummary,
            totalContext,
        };
    }
    searchFilesWithQuery(query, maxFiles) {
        const searchResults = [];
        for (const file of this.context.files.values()) {
            let score = 0;
            const pathMatches = (file.path.toLowerCase().match(new RegExp(query.toLowerCase(), 'g')) || []).length;
            score += pathMatches * 20;
            const contentMatches = (file.content.toLowerCase().match(new RegExp(query.toLowerCase(), 'g')) || []).length;
            score += contentMatches * 10;
            if (file.summary) {
                const summaryMatches = (file.summary.toLowerCase().match(new RegExp(query.toLowerCase(), 'g')) || []).length;
                score += summaryMatches * 15;
            }
            if (file.exports) {
                const exportMatches = file.exports.filter(exp => exp.toLowerCase().includes(query.toLowerCase())).length;
                score += exportMatches * 25;
            }
            score += file.importance;
            if (score > 0) {
                searchResults.push({ file, score });
            }
        }
        return searchResults
            .sort((a, b) => b.score - a.score)
            .slice(0, maxFiles)
            .map(result => result.file);
    }
    generateProjectSummary() {
        const metadata = this.context.projectMetadata;
        const fileCount = this.context.files.size;
        const dirCount = this.context.directories.size;
        return `Project: ${metadata.name || 'Unnamed'} (${metadata.framework || 'Unknown framework'})
Files: ${fileCount} files in ${dirCount} directories
Languages: ${metadata.languages.join(', ')}
Dependencies: ${metadata.dependencies.slice(0, 10).join(', ')}${metadata.dependencies.length > 10 ? '...' : ''}
Selected Paths: ${this.context.selectedPaths.join(', ')}`;
    }
    generateContextString(files, projectSummary) {
        let context = `=== WORKSPACE CONTEXT ===\n${projectSummary}\n\n`;
        context += `=== SELECTED FILES (${files.length}) ===\n`;
        const totalSize = files.reduce((sum, file) => sum + file.content.length, 0);
        const maxContextSize = 50000;
        const shouldTruncate = totalSize > maxContextSize;
        const truncateSize = shouldTruncate ? Math.floor(maxContextSize / files.length) : 4000;
        if (shouldTruncate) {
            context += `\n⚠️ Large workspace detected - content truncated to ${truncateSize} chars per file\n`;
        }
        files.forEach(file => {
            context += `\n--- ${file.path} (${file.language}, ${file.size} bytes, importance: ${file.importance}) ---\n`;
            context += `Summary: ${file.summary}\n`;
            if (file.exports && file.exports.length > 0) {
                context += `Exports: ${file.exports.join(', ')}\n`;
            }
            if (file.dependencies && file.dependencies.length > 0) {
                context += `Dependencies: ${file.dependencies.join(', ')}\n`;
            }
            const contentPreview = file.content.length > truncateSize ?
                file.content.slice(0, truncateSize) + '\n... [truncated - use /search to find specific content]' :
                file.content;
            context += `Content:\n${contentPreview}\n`;
        });
        return context;
    }
    startWatching() {
        this.stopWatching();
        this.context.selectedPaths.forEach(selectedPath => {
            if (fs.existsSync(selectedPath)) {
                const watcher = fs.watch(selectedPath, { recursive: true }, (eventType, filename) => {
                    if (filename) {
                        console.log(chalk_1.default.yellow(`📁 File changed: ${filename} (${eventType})`));
                        setTimeout(() => this.analyzeSelectedPaths(), 1000);
                    }
                });
                this.watchers.set(selectedPath, watcher);
            }
        });
        console.log(chalk_1.default.green(`👀 Watching ${this.context.selectedPaths.length} paths for changes`));
    }
    stopWatching() {
        this.watchers.forEach(watcher => watcher.close());
        this.watchers.clear();
    }
    extractRelevantContext(query) {
        console.log(chalk_1.default.blue(`🔍 Extracting context for: "${query}"`));
        const relevantFiles = this.searchFilesWithQuery(query, 10);
        if (relevantFiles.length === 0) {
            return `No relevant files found for query: "${query}"`;
        }
        let context = `=== RELEVANT CONTEXT FOR: "${query}" ===\n\n`;
        relevantFiles.forEach(file => {
            context += `\n--- ${file.path} ---\n`;
            const snippets = this.extractRelevantSnippets(file.content, query);
            if (snippets.length > 0) {
                context += snippets.join('\n...\n') + '\n';
            }
            else {
                context += `${file.summary}\n`;
                context += file.content.slice(0, 500) + '\n';
            }
        });
        return context;
    }
    extractRelevantSnippets(content, query) {
        const lines = content.split('\n');
        const queryLower = query.toLowerCase();
        const snippets = [];
        const contextLines = 3;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
                const start = Math.max(0, i - contextLines);
                const end = Math.min(lines.length, i + contextLines + 1);
                const snippet = lines.slice(start, end)
                    .map((line, index) => {
                    const lineNum = start + index + 1;
                    const marker = (start + index === i) ? '>>> ' : '    ';
                    return `${marker}${lineNum}: ${line}`;
                })
                    .join('\n');
                snippets.push(snippet);
            }
        }
        return snippets.slice(0, 5);
    }
    showContextSummary() {
        console.log(chalk_1.default.blue.bold('\n🌍 Workspace Context Summary'));
        console.log(chalk_1.default.gray('═'.repeat(50)));
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
        const topFiles = Array.from(this.context.files.values())
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 5);
        if (topFiles.length > 0) {
            console.log(chalk_1.default.blue.bold('\n📋 Most Important Files:'));
            topFiles.forEach((file, index) => {
                console.log(`  ${index + 1}. ${file.path} (${file.language}, importance: ${file.importance})`);
                console.log(`     ${chalk_1.default.gray(file.summary)}`);
            });
        }
    }
}
exports.WorkspaceContextManager = WorkspaceContextManager;
exports.workspaceContext = new WorkspaceContextManager();
