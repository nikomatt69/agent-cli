"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextAwareRAGSystem = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const crypto_1 = require("crypto");
const chalk_1 = __importDefault(require("chalk"));
class ContextAwareRAGSystem {
    constructor(workingDirectory) {
        this.workingDir = (0, path_1.resolve)(workingDirectory);
        this.memoryPath = (0, path_1.join)(this.workingDir, '.claude-memory');
        this.ensureMemoryDir();
        this.loadMemory();
    }
    ensureMemoryDir() {
        if (!(0, fs_1.existsSync)(this.memoryPath)) {
            (0, fs_1.mkdirSync)(this.memoryPath, { recursive: true });
        }
    }
    loadMemory() {
        const memoryFile = (0, path_1.join)(this.memoryPath, 'workspace-memory.json');
        if ((0, fs_1.existsSync)(memoryFile)) {
            try {
                const data = JSON.parse((0, fs_1.readFileSync)(memoryFile, 'utf-8'));
                this.memory = {
                    files: new Map(data.files || []),
                    interactions: data.interactions || [],
                    context: data.context || this.createInitialContext(),
                    embeddings: data.embeddings || [],
                    lastUpdated: new Date(data.lastUpdated || Date.now())
                };
            }
            catch (error) {
                console.log(chalk_1.default.yellow('⚠️ Could not load existing memory, creating new'));
                this.memory = this.createFreshMemory();
            }
        }
        else {
            this.memory = this.createFreshMemory();
        }
    }
    createFreshMemory() {
        return {
            files: new Map(),
            interactions: [],
            context: this.createInitialContext(),
            embeddings: [],
            lastUpdated: new Date()
        };
    }
    createInitialContext() {
        return {
            rootPath: this.workingDir,
            projectName: 'Unknown',
            framework: 'Unknown',
            languages: [],
            dependencies: {},
            structure: {},
            currentGoals: [],
            recentChanges: [],
            problemsIdentified: [],
            solutionsApplied: []
        };
    }
    saveMemory() {
        const memoryFile = (0, path_1.join)(this.memoryPath, 'workspace-memory.json');
        const data = {
            files: Array.from(this.memory.files.entries()),
            interactions: this.memory.interactions,
            context: this.memory.context,
            embeddings: this.memory.embeddings,
            lastUpdated: new Date()
        };
        try {
            (0, fs_1.writeFileSync)(memoryFile, JSON.stringify(data, null, 2));
        }
        catch (error) {
            console.log(chalk_1.default.red('❌ Failed to save workspace memory'));
        }
    }
    // Context-aware file analysis
    async analyzeFile(filePath, content) {
        const fullPath = (0, path_1.resolve)(this.workingDir, filePath);
        const relativePath = (0, path_1.relative)(this.workingDir, fullPath);
        if (!content) {
            if (!(0, fs_1.existsSync)(fullPath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            content = (0, fs_1.readFileSync)(fullPath, 'utf-8');
        }
        const hash = (0, crypto_1.createHash)('md5').update(content).digest('hex');
        const language = this.detectLanguage((0, path_1.extname)(filePath));
        // Check if file changed
        const existingMemory = this.memory.files.get(relativePath);
        if (existingMemory && existingMemory.hash === hash) {
            return existingMemory; // No changes
        }
        console.log(chalk_1.default.blue(`🔍 Analyzing: ${relativePath}`));
        const analysis = this.performCodeAnalysis(content, language);
        const summary = await this.generateFileSummary(content, language, analysis);
        const importance = this.calculateImportance(relativePath, analysis);
        const fileMemory = {
            path: relativePath,
            hash,
            content,
            summary,
            language,
            imports: analysis.imports,
            exports: analysis.exports,
            functions: analysis.functions,
            classes: analysis.classes,
            lastAnalyzed: new Date(),
            importance
        };
        this.memory.files.set(relativePath, fileMemory);
        // Create embedding for semantic search
        await this.createEmbedding(relativePath, content, summary);
        this.saveMemory();
        return fileMemory;
    }
    // Comprehensive workspace analysis
    async analyzeWorkspace() {
        console.log(chalk_1.default.blue('🔍 Performing comprehensive workspace analysis...'));
        // Analyze package.json first
        const packagePath = (0, path_1.join)(this.workingDir, 'package.json');
        if ((0, fs_1.existsSync)(packagePath)) {
            const packageContent = (0, fs_1.readFileSync)(packagePath, 'utf-8');
            const packageJson = JSON.parse(packageContent);
            this.memory.context.projectName = packageJson.name || 'Unknown';
            this.memory.context.dependencies = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies
            };
            this.memory.context.framework = this.detectFramework(packageJson);
        }
        // Scan and analyze important files
        const importantFiles = await this.findImportantFiles();
        for (const filePath of importantFiles) {
            try {
                await this.analyzeFile(filePath);
            }
            catch (error) {
                console.log(chalk_1.default.yellow(`⚠️ Could not analyze ${filePath}`));
            }
        }
        // Update context with findings
        this.memory.context.languages = this.extractLanguages();
        this.memory.context.structure = this.buildProjectStructure();
        this.saveMemory();
        return this.memory.context;
    }
    // Semantic search and retrieval
    async searchRelevantContext(query, maxResults = 5) {
        const queryEmbedding = this.createSimpleEmbedding(query);
        const results = [];
        for (const [path, file] of this.memory.files) {
            // Simple text similarity (in production, use proper embeddings)
            const similarity = this.calculateSimilarity(query, file.content + ' ' + file.summary);
            if (similarity > 0.1) {
                results.push({ file, similarity });
            }
        }
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxResults)
            .map(r => r.file);
    }
    // Store interaction for learning
    recordInteraction(userInput, aiResponse, actions) {
        const interaction = {
            id: (0, crypto_1.createHash)('md5').update(`${Date.now()}-${userInput}`).digest('hex').substring(0, 8),
            timestamp: new Date(),
            userInput,
            aiResponse,
            actions,
            context: this.generateCurrentContextString(),
            successful: actions.every(a => !a.result?.error)
        };
        this.memory.interactions.push(interaction);
        // Keep only last 100 interactions
        if (this.memory.interactions.length > 100) {
            this.memory.interactions = this.memory.interactions.slice(-100);
        }
        this.saveMemory();
        return interaction.id;
    }
    // Get relevant context for AI
    getContextForAI(query) {
        let relevantFiles = [];
        if (query) {
            // Get semantically relevant files
            relevantFiles = Array.from(this.memory.files.values())
                .sort((a, b) => b.importance - a.importance)
                .slice(0, 10);
        }
        else {
            // Get most important files
            relevantFiles = Array.from(this.memory.files.values())
                .sort((a, b) => b.importance - a.importance)
                .slice(0, 8);
        }
        const recentInteractions = this.memory.interactions
            .slice(-5)
            .filter(i => i.successful);
        return {
            workspaceContext: this.memory.context,
            relevantFiles,
            recentInteractions,
            currentGoals: this.memory.context.currentGoals,
            knownProblems: this.memory.context.problemsIdentified
        };
    }
    // Update current goals and problems
    updateGoals(goals) {
        this.memory.context.currentGoals = goals;
        this.saveMemory();
    }
    addProblem(problem) {
        if (!this.memory.context.problemsIdentified.includes(problem)) {
            this.memory.context.problemsIdentified.push(problem);
            this.saveMemory();
        }
    }
    addSolution(solution) {
        if (!this.memory.context.solutionsApplied.includes(solution)) {
            this.memory.context.solutionsApplied.push(solution);
            this.saveMemory();
        }
    }
    addRecentChange(change) {
        this.memory.context.recentChanges.push(change);
        // Keep only last 20 changes
        if (this.memory.context.recentChanges.length > 20) {
            this.memory.context.recentChanges = this.memory.context.recentChanges.slice(-20);
        }
        this.saveMemory();
    }
    // Helper methods
    performCodeAnalysis(content, language) {
        const analysis = {
            imports: [],
            exports: [],
            functions: [],
            classes: [],
            lines: content.split('\n').length,
            complexity: 0
        };
        switch (language) {
            case 'typescript':
            case 'javascript':
                analysis.imports = (content.match(/import .* from ['"`].*['"`]/g) || []);
                analysis.exports = (content.match(/export .*/g) || []);
                analysis.functions = (content.match(/function \w+|const \w+ = |=>/g) || []);
                analysis.classes = (content.match(/class \w+/g) || []);
                break;
            case 'python':
                analysis.imports = (content.match(/from .* import .*|import .*/g) || []);
                analysis.functions = (content.match(/def \w+/g) || []);
                analysis.classes = (content.match(/class \w+/g) || []);
                break;
        }
        analysis.complexity = this.calculateComplexity(content);
        return analysis;
    }
    async generateFileSummary(content, language, analysis) {
        // Simple rule-based summary (in production, use AI)
        const lines = content.split('\n').length;
        const summary = `${language} file with ${analysis.functions.length} functions, ${analysis.classes.length} classes (${lines} lines)`;
        // Add specific insights based on content
        if (content.includes('useState') || content.includes('useEffect')) {
            return `React ${summary} with hooks`;
        }
        if (content.includes('express') || content.includes('app.listen')) {
            return `Express ${summary} with API endpoints`;
        }
        if (content.includes('test(') || content.includes('describe(')) {
            return `Test ${summary}`;
        }
        return summary;
    }
    calculateImportance(path, analysis) {
        let importance = 0;
        // Path-based importance
        if (path.includes('index.'))
            importance += 20;
        if (path.includes('app.') || path.includes('main.'))
            importance += 25;
        if (path.includes('package.json'))
            importance += 30;
        if (path.includes('tsconfig.json'))
            importance += 15;
        if (path.includes('src/'))
            importance += 10;
        if (path.includes('components/'))
            importance += 5;
        // Content-based importance
        importance += Math.min(analysis.functions.length * 2, 20);
        importance += Math.min(analysis.classes.length * 3, 15);
        importance += Math.min(analysis.imports.length, 10);
        return Math.min(importance, 100);
    }
    async findImportantFiles() {
        const important = [];
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.md'];
        const scan = (dir, depth = 0) => {
            if (depth > 3)
                return; // Limit depth
            try {
                const items = (0, fs_1.readdirSync)(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = (0, path_1.join)(dir, item.name);
                    const relativePath = (0, path_1.relative)(this.workingDir, fullPath);
                    // Skip common ignored directories
                    if (item.name.startsWith('.') && item.name !== '.env')
                        continue;
                    if (['node_modules', 'dist', 'build', '.git'].includes(item.name))
                        continue;
                    if (item.isDirectory()) {
                        scan(fullPath, depth + 1);
                    }
                    else if (item.isFile() && extensions.includes((0, path_1.extname)(item.name))) {
                        important.push(relativePath);
                    }
                }
            }
            catch (error) {
                // Skip inaccessible directories
            }
        };
        scan(this.workingDir);
        return important;
    }
    detectLanguage(extension) {
        const map = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.json': 'json',
            '.md': 'markdown'
        };
        return map[extension] || 'text';
    }
    detectFramework(packageJson) {
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (deps.next)
            return 'Next.js';
        if (deps.react)
            return 'React';
        if (deps.vue)
            return 'Vue.js';
        if (deps.express)
            return 'Express';
        if (deps.fastify)
            return 'Fastify';
        if (deps.nestjs)
            return 'Nest.js';
        if (deps.bun)
            return 'Bun';
        if (deps.deno)
            return 'Deno';
        if (deps.rails)
            return 'Ruby on Rails';
        if (deps.spring)
            return 'Spring Boot';
        if (deps.aspnet)
            return 'ASP.NET';
        if (deps.laravel)
            return 'Laravel';
        if (deps.yii)
            return 'Yii';
        if (deps.symfony)
            return 'Symfony';
        if (deps.elixir)
            return 'Elixir';
        if (deps.phoenix)
            return 'Phoenix';
        if (deps.flutter)
            return 'Flutter';
        if (deps.swift)
            return 'Swift';
        if (deps.kotlin)
            return 'Kotlin';
        if (deps.golang)
            return 'Go';
        if (deps.erlang)
            return 'Erlang';
        if (deps.elixir)
            return 'Elixir';
        return 'Node.js';
    }
    extractLanguages() {
        const languages = new Set();
        for (const file of this.memory.files.values()) {
            if (file.language !== 'text') {
                languages.add(file.language);
            }
        }
        return Array.from(languages);
    }
    buildProjectStructure() {
        // Build simplified structure from memory
        const structure = {};
        for (const file of this.memory.files.values()) {
            const parts = file.path.split('/');
            let current = structure;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]])
                    current[parts[i]] = {};
                current = current[parts[i]];
            }
            if (!current._files)
                current._files = [];
            current._files.push(parts[parts.length - 1]);
        }
        return structure;
    }
    createSimpleEmbedding(text) {
        // Simple embedding - in production use proper embeddings
        const words = text.toLowerCase().split(/\W+/);
        const vector = new Array(100).fill(0);
        for (let i = 0; i < words.length; i++) {
            const hash = this.simpleHash(words[i]);
            vector[hash % 100] += 1;
        }
        return vector;
    }
    async createEmbedding(path, content, summary) {
        const text = `${path} ${summary} ${content.substring(0, 500)}`;
        const vector = this.createSimpleEmbedding(text);
        const embedding = {
            id: path,
            content: summary,
            vector,
            metadata: { path, language: this.detectLanguage((0, path_1.extname)(path)) },
            timestamp: new Date()
        };
        // Replace existing embedding
        this.memory.embeddings = this.memory.embeddings.filter(e => e.id !== path);
        this.memory.embeddings.push(embedding);
    }
    calculateSimilarity(query, content) {
        const queryWords = new Set(query.toLowerCase().split(/\W+/));
        const contentWords = new Set(content.toLowerCase().split(/\W+/));
        const intersection = new Set([...queryWords].filter(x => contentWords.has(x)));
        const union = new Set([...queryWords, ...contentWords]);
        return intersection.size / union.size;
    }
    calculateComplexity(content) {
        let complexity = 0;
        // Simple complexity metrics
        complexity += (content.match(/if\s*\(/g) || []).length;
        complexity += (content.match(/for\s*\(/g) || []).length * 2;
        complexity += (content.match(/while\s*\(/g) || []).length * 2;
        complexity += (content.match(/switch\s*\(/g) || []).length * 3;
        complexity += (content.match(/catch\s*\(/g) || []).length;
        return complexity;
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    generateCurrentContextString() {
        const ctx = this.memory.context;
        return `Project: ${ctx.projectName} (${ctx.framework}) | Files: ${this.memory.files.size} | Languages: ${ctx.languages.join(', ')}`;
    }
    // Clear memory (useful for testing)
    clearMemory() {
        this.memory = this.createFreshMemory();
        this.saveMemory();
    }
    // Get memory stats
    getMemoryStats() {
        return {
            totalFiles: this.memory.files.size,
            totalInteractions: this.memory.interactions.length,
            successfulInteractions: this.memory.interactions.filter(i => i.successful).length,
            currentGoals: this.memory.context.currentGoals.length,
            knownProblems: this.memory.context.problemsIdentified.length,
            lastUpdated: this.memory.lastUpdated
        };
    }
}
exports.ContextAwareRAGSystem = ContextAwareRAGSystem;
