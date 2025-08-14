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
exports.IDEContextEnricher = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
const util_1 = require("util");
const chalk_1 = __importDefault(require("chalk"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class IDEContextEnricher {
    getIDEContextTool() {
        return (0, ai_1.tool)({
            description: 'Analyze and enrich IDE context including editor, workspace, project structure, and development environment',
            parameters: zod_1.z.object({
                includeDependencies: zod_1.z.boolean().default(true).describe('Include package.json and dependency analysis'),
                includeGitInfo: zod_1.z.boolean().default(true).describe('Include Git repository information'),
                includeRecentFiles: zod_1.z.boolean().default(true).describe('Include recently modified files'),
                includeOpenFiles: zod_1.z.boolean().default(true).describe('Include currently open files in editor')
            }),
            execute: async ({ includeDependencies, includeGitInfo, includeRecentFiles, includeOpenFiles }) => {
                try {
                    console.log(chalk_1.default.blue('🔍 Analyzing IDE and workspace context...'));
                    const context = {
                        editor: await this.detectEditor(),
                        workspace: process.cwd(),
                        projectType: await this.detectProjectType(),
                        dependencies: includeDependencies ? await this.analyzeDependencies() : null,
                        gitInfo: includeGitInfo ? await this.getGitInfo() : null,
                        recentFiles: includeRecentFiles ? await this.getRecentFiles() : [],
                        openFiles: includeOpenFiles ? await this.getOpenFiles() : []
                    };
                    return {
                        context,
                        analysis: this.generateContextAnalysis(context),
                        recommendations: this.generateRecommendations(context)
                    };
                }
                catch (error) {
                    return {
                        error: `IDE context analysis failed: ${error.message}`,
                        partialContext: {
                            editor: 'unknown',
                            workspace: process.cwd(),
                            projectType: 'unknown'
                        }
                    };
                }
            }
        });
    }
    async detectEditor() {
        try {
            const editorVars = ['EDITOR', 'VISUAL', 'VSCODE_PID', 'INTELLIJ_IDEA_PID'];
            for (const varName of editorVars) {
                if (process.env[varName]) {
                    return process.env[varName] || 'unknown';
                }
            }
            if (process.env.VSCODE_PID || process.env.VSCODE_EXTENSION_HOST) {
                return 'VS Code';
            }
            if (process.env.INTELLIJ_IDEA_PID || process.env.WEBSTORM_PID) {
                return 'IntelliJ IDEA/WebStorm';
            }
            if (process.env.VIM || process.env.NVIM) {
                return 'Vim/Neovim';
            }
            return 'Terminal/CLI';
        }
        catch (error) {
            return 'unknown';
        }
    }
    async detectProjectType() {
        const files = (0, fs_1.readdirSync)(process.cwd());
        if (files.includes('package.json')) {
            try {
                const packageJson = JSON.parse((0, fs_1.readFileSync)('package.json', 'utf-8'));
                if (packageJson.dependencies?.next || packageJson.dependencies?.['@next/next']) {
                    return 'Next.js';
                }
                if (packageJson.dependencies?.react) {
                    return 'React';
                }
                if (packageJson.dependencies?.vue) {
                    return 'Vue.js';
                }
                return 'Node.js';
            }
            catch {
                return 'Node.js';
            }
        }
        if (files.includes('pyproject.toml') || files.includes('requirements.txt')) {
            return 'Python';
        }
        if (files.includes('Cargo.toml')) {
            return 'Rust';
        }
        if (files.includes('go.mod')) {
            return 'Go';
        }
        if (files.includes('pom.xml') || files.includes('build.gradle')) {
            return 'Java';
        }
        return 'Unknown';
    }
    async analyzeDependencies() {
        try {
            if ((0, fs_1.existsSync)('package.json')) {
                const packageJson = JSON.parse((0, fs_1.readFileSync)('package.json', 'utf-8'));
                return {
                    name: packageJson.name,
                    version: packageJson.version,
                    dependencies: Object.keys(packageJson.dependencies || {}).length,
                    devDependencies: Object.keys(packageJson.devDependencies || {}).length,
                    scripts: Object.keys(packageJson.scripts || {}),
                    type: packageJson.type || 'commonjs'
                };
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    async getGitInfo() {
        try {
            const { stdout: branch } = await execAsync('git branch --show-current');
            const { stdout: remote } = await execAsync('git remote get-url origin');
            const { stdout: status } = await execAsync('git status --porcelain');
            return {
                branch: branch.trim(),
                remote: remote.trim(),
                hasChanges: status.trim().length > 0,
                changeCount: status.split('\n').filter(line => line.trim()).length
            };
        }
        catch (error) {
            return null;
        }
    }
    async getRecentFiles() {
        try {
            const { stdout } = await execAsync('find . -type f -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" | head -10');
            return stdout.split('\n').filter(file => file.trim()).map(file => (0, path_1.relative)(process.cwd(), file));
        }
        catch (error) {
            return [];
        }
    }
    async getOpenFiles() {
        try {
            const { spawn } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
            const workspaceFiles = this.getWorkspaceFiles('.', ['.ts', '.js', '.tsx', '.jsx']).slice(0, 5);
            return workspaceFiles;
        }
        catch (error) {
            return [];
        }
    }
    getWorkspaceFiles(dir, extensions) {
        try {
            const files = [];
            const entries = (0, fs_1.readdirSync)(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    const subFiles = this.getWorkspaceFiles((0, path_1.join)(dir, entry.name), extensions);
                    files.push(...subFiles);
                }
                else if (entry.isFile() && extensions.includes((0, path_1.extname)(entry.name))) {
                    files.push((0, path_1.join)(dir, entry.name));
                }
            }
            return files;
        }
        catch (error) {
            return [];
        }
    }
    generateContextAnalysis(context) {
        let analysis = `📊 **IDE Context Analysis**\n\n`;
        analysis += `**Editor**: ${context.editor}\n`;
        analysis += `**Workspace**: ${context.workspace}\n`;
        analysis += `**Project Type**: ${context.projectType}\n\n`;
        if (context.dependencies) {
            analysis += `**Dependencies**: ${context.dependencies.dependencies} prod, ${context.dependencies.devDependencies} dev\n`;
            analysis += `**Available Scripts**: ${context.dependencies.scripts.join(', ')}\n\n`;
        }
        if (context.gitInfo) {
            analysis += `**Git**: ${context.gitInfo.branch} branch, ${context.gitInfo.hasChanges ? 'has changes' : 'clean'}\n`;
            if (context.gitInfo.hasChanges) {
                analysis += `**Changes**: ${context.gitInfo.changeCount} files modified\n`;
            }
            analysis += `**Remote**: ${context.gitInfo.remote}\n\n`;
        }
        if (context.recentFiles.length > 0) {
            analysis += `**Recent Files**: ${context.recentFiles.slice(0, 5).join(', ')}\n\n`;
        }
        return analysis;
    }
    generateRecommendations(context) {
        const recommendations = [];
        if (context.projectType === 'Next.js') {
            recommendations.push('Consider using Next.js App Router for new features');
            recommendations.push('Enable TypeScript strict mode for better type safety');
        }
        if (context.projectType === 'React') {
            recommendations.push('Consider using React 18 features like Suspense');
            recommendations.push('Implement error boundaries for better error handling');
        }
        if (context.gitInfo?.hasChanges) {
            recommendations.push('Commit your changes before making major modifications');
            recommendations.push('Consider creating a feature branch for new work');
        }
        if (context.dependencies?.dependencies > 50) {
            recommendations.push('Consider auditing dependencies for security vulnerabilities');
            recommendations.push('Review and remove unused dependencies');
        }
        return recommendations;
    }
}
exports.IDEContextEnricher = IDEContextEnricher;
