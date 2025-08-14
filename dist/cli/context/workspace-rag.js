"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceRAG = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
const crypto_1 = require("crypto");
class WorkspaceRAG {
    constructor(workspacePath) {
        this.embeddings = new Map();
        this.contextCache = new Map();
        this.context = this.initializeWorkspace(workspacePath);
        this.analyzeWorkspace();
    }
    initializeWorkspace(path) {
        return {
            rootPath: (0, path_1.resolve)(path),
            projectName: this.extractProjectName(path),
            framework: 'unknown',
            languages: [],
            files: new Map(),
            structure: {},
            dependencies: [],
            scripts: {},
            lastAnalyzed: new Date(),
        };
    }
    extractProjectName(path) {
        const packageJsonPath = (0, path_1.join)(path, 'package.json');
        if ((0, fs_1.existsSync)(packageJsonPath)) {
            try {
                const pkg = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf-8'));
                return pkg.name || 'unnamed-project';
            }
            catch { }
        }
        return require('path').basename(path);
    }
    async analyzeWorkspace() {
        console.log(chalk_1.default.blue('🧠 Building workspace context with RAG...'));
        await this.scanFiles();
        await this.analyzeProjectStructure();
        this.extractDependencies(this.context.files, this.context.framework);
        await this.analyzeGitContext();
        await this.buildSemanticIndex();
        this.context.lastAnalyzed = new Date();
        return this.context;
    }
    async scanFiles() {
        const scanDirectory = (dirPath, depth = 0) => {
            if (depth > 5)
                return;
            const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
            const items = (0, fs_1.readdirSync)(dirPath, { withFileTypes: true });
            for (const item of items) {
                if (skipDirs.includes(item.name))
                    continue;
                const fullPath = (0, path_1.join)(dirPath, item.name);
                const relativePath = (0, path_1.relative)(this.context.rootPath, fullPath);
                if (item.isDirectory()) {
                    scanDirectory(fullPath, depth + 1);
                }
                else if (item.isFile()) {
                    this.analyzeFile(fullPath, relativePath);
                }
            }
        };
        scanDirectory(this.context.rootPath);
    }
    analyzeFile(fullPath, relativePath) {
        try {
            const stats = (0, fs_1.statSync)(fullPath);
            const content = (0, fs_1.readFileSync)(fullPath, 'utf-8');
            const ext = (0, path_1.extname)(fullPath);
            const language = this.detectLanguage(ext);
            if (stats.size > 1024 * 1024 || this.isBinaryFile(ext))
                return;
            const fileEmbedding = {
                path: relativePath,
                content,
                summary: this.generateFileSummary(content, language),
                importance: this.calculateImportance(relativePath, content, language),
                lastModified: stats.mtime,
                hash: (0, crypto_1.createHash)('md5').update(content).digest('hex'),
                language,
                size: stats.size,
                dependencies: this.extractDependencies(content, language),
                exports: this.extractExports(content, language),
                functions: this.extractFunctions(content, language),
                classes: this.extractClasses(content, language),
                types: this.extractTypes(content, language),
            };
            this.context.files.set(relativePath, fileEmbedding);
            if (!this.context.languages.includes(language)) {
                this.context.languages.push(language);
            }
        }
        catch (error) {
        }
    }
    generateFileSummary(content, language) {
        const lines = content.split('\n').length;
        switch (language) {
            case 'typescript':
            case 'javascript':
                const imports = (content.match(/import .* from/g) || []).length;
                const exports = (content.match(/export/g) || []).length;
                const functions = (content.match(/function \w+|const \w+ = |=>/g) || []).length;
                return `${language} file with ${lines} lines, ${imports} imports, ${exports} exports, ${functions} functions`;
            case 'json':
                try {
                    const parsed = JSON.parse(content);
                    const keys = Object.keys(parsed).length;
                    return `JSON config with ${keys} keys`;
                }
                catch {
                    return `Invalid JSON file`;
                }
            default:
                return `${language} file with ${lines} lines`;
        }
    }
    calculateImportance(path, content, language) {
        let importance = 50;
        if (path.includes('package.json'))
            importance += 40;
        if (path.includes('tsconfig.json'))
            importance += 30;
        if (path.includes('next.config'))
            importance += 30;
        if (path.includes('README'))
            importance += 20;
        if (path.includes('index.'))
            importance += 20;
        if (path.includes('app.') || path.includes('main.'))
            importance += 25;
        if (path.includes('config') || path.includes('settings'))
            importance += 15;
        if (path.includes('types') || path.includes('interfaces'))
            importance += 15;
        if (path.includes('test') || path.includes('spec'))
            importance -= 10;
        const lines = content.split('\n').length;
        if (lines > 500)
            importance += 10;
        if (lines > 1000)
            importance += 15;
        if (language === 'typescript')
            importance += 10;
        if (content.includes('export default'))
            importance += 10;
        if (content.includes('React.createContext'))
            importance += 15;
        return Math.min(100, Math.max(0, importance));
    }
    detectLanguage(ext) {
        const langMap = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.json': 'json',
            '.md': 'markdown',
            '.css': 'css',
            '.scss': 'scss',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby'
        };
        return langMap[ext] || 'text';
    }
    isBinaryFile(ext) {
        const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip'];
        return binaryExts.includes(ext);
    }
    extractDependencies(content, language) {
        const deps = [];
        if (language === 'typescript' || language === 'javascript') {
            const importMatches = content.match(/import .* from ['"]([^'"]+)['"]/g);
            if (importMatches) {
                importMatches.forEach(match => {
                    const dep = match.match(/from ['"]([^'"]+)['"]/)?.[1];
                    if (dep)
                        deps.push(dep);
                });
            }
            const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g);
            if (requireMatches) {
                requireMatches.forEach(match => {
                    const dep = match.match(/require\(['"]([^'"]+)['"]\)/)?.[1];
                    if (dep)
                        deps.push(dep);
                });
            }
        }
        return [...new Set(deps)];
    }
    extractExports(content, language) {
        const exports = [];
        if (language === 'typescript' || language === 'javascript') {
            const namedExports = content.match(/export \{ ([^}]+) \}/g);
            if (namedExports) {
                namedExports.forEach(match => {
                    const items = match.replace('export { ', '').replace(' }', '').split(',');
                    items.forEach(item => exports.push(item.trim()));
                });
            }
            if (content.includes('export default')) {
                exports.push('default');
            }
            const directExports = content.match(/export (const|function|class) (\w+)/g);
            if (directExports) {
                directExports.forEach(match => {
                    const name = match.split(' ')[2];
                    if (name)
                        exports.push(name);
                });
            }
        }
        return exports;
    }
    extractFunctions(content, language) {
        const functions = [];
        if (language === 'typescript' || language === 'javascript') {
            const funcDeclarations = content.match(/function (\w+)/g);
            if (funcDeclarations) {
                funcDeclarations.forEach(match => {
                    const name = match.replace('function ', '');
                    functions.push(name);
                });
            }
            const arrowFunctions = content.match(/const (\w+) = [^=]*=>/g);
            if (arrowFunctions) {
                arrowFunctions.forEach(match => {
                    const name = match.match(/const (\w+)/)?.[1];
                    if (name)
                        functions.push(name);
                });
            }
        }
        return functions;
    }
    extractClasses(content, language) {
        const classes = [];
        if (language === 'typescript' || language === 'javascript') {
            const classMatches = content.match(/class (\w+)/g);
            if (classMatches) {
                classMatches.forEach(match => {
                    const name = match.replace('class ', '');
                    classes.push(name);
                });
            }
        }
        return classes;
    }
    extractTypes(content, language) {
        const types = [];
        if (language === 'typescript') {
            const interfaces = content.match(/interface (\w+)/g);
            if (interfaces) {
                interfaces.forEach(match => {
                    const name = match.replace('interface ', '');
                    types.push(name);
                });
            }
            const typeDeclarations = content.match(/type (\w+)/g);
            if (typeDeclarations) {
                typeDeclarations.forEach(match => {
                    const name = match.replace('type ', '');
                    types.push(name);
                });
            }
        }
        return types;
    }
    async analyzeProjectStructure() {
        const packageJsonPath = (0, path_1.join)(this.context.rootPath, 'package.json');
        if ((0, fs_1.existsSync)(packageJsonPath)) {
            const pkg = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf-8'));
            this.context.framework = this.detectFramework(pkg);
            this.context.dependencies = Object.keys(pkg.dependencies || {});
            this.context.scripts = pkg.scripts || {};
        }
        this.context.structure = this.buildStructureTree();
    }
    detectFramework(pkg) {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.next)
            return 'Next.js';
        if (deps.nuxt)
            return 'Nuxt.js';
        if (deps['@angular/core'])
            return 'Angular';
        if (deps.vue)
            return 'Vue.js';
        if (deps.react)
            return 'React';
        if (deps.express)
            return 'Express';
        if (deps.fastify)
            return 'Fastify';
        if (deps.svelte)
            return 'Svelte';
        return 'JavaScript/Node.js';
    }
    buildStructureTree() {
        const structure = { directories: [], files: [] };
        const importantDirs = ['src', 'components', 'pages', 'api', 'lib', 'utils', 'hooks', 'types', 'styles'];
        const importantFiles = Array.from(this.context.files.values())
            .filter(f => f.importance > 70)
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 20);
        structure.importantFiles = importantFiles;
        structure.directories = importantDirs.filter(dir => Array.from(this.context.files.keys()).some(path => path.startsWith(dir + '/')));
        return structure;
    }
    async analyzeGitContext() {
        try {
            const gitDir = (0, path_1.join)(this.context.rootPath, '.git');
            if ((0, fs_1.existsSync)(gitDir)) {
                const branch = (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', {
                    cwd: this.context.rootPath,
                    encoding: 'utf-8'
                }).trim();
                const status = (0, child_process_1.execSync)('git status --porcelain', {
                    cwd: this.context.rootPath,
                    encoding: 'utf-8'
                }).trim();
                const commits = (0, child_process_1.execSync)('git log --oneline -10', {
                    cwd: this.context.rootPath,
                    encoding: 'utf-8'
                }).trim().split('\n');
                this.context.gitInfo = { branch, status, commits };
            }
        }
        catch (error) {
        }
    }
    async buildSemanticIndex() {
        for (const [path, file] of this.context.files) {
            this.embeddings.set(path, this.createSimpleEmbedding(file));
        }
    }
    createSimpleEmbedding(file) {
        const words = file.content.toLowerCase().match(/\b\w+\b/g) || [];
        const wordFreq = new Map();
        words.forEach(word => {
            wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
        });
        const embedding = new Array(100).fill(0);
        let index = 0;
        for (const [word, freq] of wordFreq) {
            const hash = this.simpleHash(word) % 100;
            embedding[hash] += freq;
            if (++index > 50)
                break;
        }
        return embedding;
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
        }
        return Math.abs(hash);
    }
    getRelevantFiles(query, limit = 10) {
        const queryWords = query.toLowerCase().match(/\b\w+\b/g) || [];
        const scores = [];
        for (const [path, file] of this.context.files) {
            let score = 0;
            queryWords.forEach(word => {
                if (file.content.toLowerCase().includes(word)) {
                    score += 1;
                }
                if (file.path.toLowerCase().includes(word)) {
                    score += 2;
                }
            });
            score += file.importance / 100;
            if (score > 0) {
                scores.push({ file, score });
            }
        }
        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(item => item.file);
    }
    getProjectSummary() {
        const fileCount = this.context.files.size;
        const languages = this.context.languages.join(', ');
        const framework = this.context.framework;
        const dependencies = this.context.dependencies.length;
        return `${this.context.projectName} (${framework}) - ${fileCount} files, Languages: ${languages}, ${dependencies} dependencies`;
    }
    getContext() {
        return this.context;
    }
    updateFile(path) {
        const fullPath = (0, path_1.join)(this.context.rootPath, path);
        if ((0, fs_1.existsSync)(fullPath)) {
            this.analyzeFile(fullPath, path);
        }
    }
    getContextForTask(task) {
        const relevantFiles = this.getRelevantFiles(task, 15);
        const projectInfo = {
            name: this.context.projectName,
            framework: this.context.framework,
            languages: this.context.languages,
            structure: this.context.structure,
            scripts: this.context.scripts
        };
        const recommendations = this.generateRecommendations(task, relevantFiles);
        return { relevantFiles, projectInfo, recommendations };
    }
    generateRecommendations(task, files) {
        const recommendations = [];
        const taskLower = task.toLowerCase();
        if (taskLower.includes('component') && this.context.framework.includes('React')) {
            recommendations.push('Use functional components with hooks');
            recommendations.push('Follow existing component patterns in /components');
        }
        if (taskLower.includes('api') && files.some(f => f.path.includes('api'))) {
            recommendations.push('Follow existing API structure');
            recommendations.push('Use consistent error handling patterns');
        }
        if (taskLower.includes('test')) {
            const hasTests = files.some(f => f.path.includes('test') || f.path.includes('spec'));
            if (hasTests) {
                recommendations.push('Follow existing test patterns');
            }
            else {
                recommendations.push('Set up testing infrastructure first');
            }
        }
        return recommendations;
    }
}
exports.WorkspaceRAG = WorkspaceRAG;
