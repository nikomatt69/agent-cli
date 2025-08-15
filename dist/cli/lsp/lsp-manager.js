"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lspManager = exports.LSPManager = void 0;
const lsp_client_1 = require("./lsp-client");
const lsp_servers_1 = require("./lsp-servers");
const language_detection_1 = require("./language-detection");
const path_1 = require("path");
const fs_1 = require("fs");
const chalk_1 = __importDefault(require("chalk"));
class LSPManager {
    constructor() {
        this.clients = new Map();
        this.workspaceRoots = new Set();
        this.fileAnalysisCache = new Map();
        process.on('beforeExit', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }
    async getClientsForFile(filePath) {
        const absolutePath = (0, path_1.resolve)(filePath);
        const applicableServers = (0, lsp_servers_1.getApplicableLSPServers)(absolutePath);
        const clients = [];
        for (const serverInfo of applicableServers) {
            const workspaceRoot = (0, lsp_servers_1.findLSPWorkspaceRoot)(absolutePath, serverInfo) || (0, path_1.dirname)(absolutePath);
            const clientKey = `${workspaceRoot}:${serverInfo.id}`;
            let client = this.clients.get(clientKey);
            if (!client) {
                try {
                    console.log(chalk_1.default.blue(`🔌 Starting ${serverInfo.name} for ${(0, path_1.relative)(workspaceRoot, absolutePath)}...`));
                    const serverHandle = await serverInfo.spawn(workspaceRoot);
                    if (!serverHandle) {
                        console.log(chalk_1.default.yellow(`⚠️ Could not start ${serverInfo.name}`));
                        continue;
                    }
                    client = await lsp_client_1.LSPClient.create(serverHandle, serverInfo, workspaceRoot);
                    this.clients.set(clientKey, client);
                    this.workspaceRoots.add(workspaceRoot);
                }
                catch (error) {
                    console.log(chalk_1.default.red(`❌ Failed to start ${serverInfo.name}: ${error.message}`));
                    continue;
                }
            }
            clients.push(client);
        }
        return clients;
    }
    async analyzeFile(filePath) {
        const absolutePath = (0, path_1.resolve)(filePath);
        const cached = this.fileAnalysisCache.get(absolutePath);
        if (cached) {
            return cached;
        }
        if (!(0, fs_1.existsSync)(absolutePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const content = (0, fs_1.readFileSync)(absolutePath, 'utf-8');
        const language = (0, language_detection_1.detectLanguageFromContent)(content, absolutePath);
        const clients = await this.getClientsForFile(absolutePath);
        const context = {
            file: absolutePath,
            language,
            symbols: [],
            diagnostics: [],
            workspaceRoot: (0, path_1.dirname)(absolutePath)
        };
        for (const client of clients) {
            try {
                if (!client.isFileOpen(absolutePath)) {
                    await client.openFile(absolutePath);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                const diagnostics = client.getDiagnostics(absolutePath);
                context.diagnostics.push(...diagnostics);
                const symbols = await client.getDocumentSymbols(absolutePath);
                context.symbols.push(...symbols);
                context.workspaceRoot = client.getWorkspaceRoot();
            }
            catch (error) {
                console.log(chalk_1.default.yellow(`⚠️ Error analyzing with ${client.getServerInfo().name}: ${error.message}`));
            }
        }
        this.fileAnalysisCache.set(absolutePath, context);
        console.log(chalk_1.default.green(`✅ Analyzed ${(0, path_1.relative)(context.workspaceRoot, absolutePath)}: ${context.symbols.length} symbols, ${context.diagnostics.length} diagnostics`));
        return context;
    }
    async getWorkspaceInsights(workspaceRoot) {
        const insights = {
            totalFiles: 0,
            languages: [],
            frameworks: [],
            diagnostics: { errors: 0, warnings: 0, hints: 0 },
            symbols: { functions: 0, classes: 0, interfaces: 0, variables: 0 },
            problems: [],
            suggestions: []
        };
        const languageSet = new Set();
        const frameworkSet = new Set();
        for (const [key, client] of this.clients) {
            if (!key.startsWith(workspaceRoot))
                continue;
            const allDiagnostics = client.getDiagnostics();
            for (const [filePath, diagnostics] of allDiagnostics) {
                insights.totalFiles++;
                const language = (0, language_detection_1.detectLanguageFromExtension)(filePath);
                if (language !== 'plaintext') {
                    languageSet.add(language);
                }
                diagnostics.forEach(diag => {
                    switch (diag.severity) {
                        case 1:
                            insights.diagnostics.errors++;
                            break;
                        case 2:
                            insights.diagnostics.warnings++;
                            break;
                        case 3:
                        case 4:
                            insights.diagnostics.hints++;
                            break;
                    }
                });
                try {
                    const symbols = await client.getDocumentSymbols(filePath);
                    symbols.forEach(symbol => {
                        switch (symbol.kind) {
                            case 12:
                                insights.symbols.functions++;
                                break;
                            case 5:
                                insights.symbols.classes++;
                                break;
                            case 11:
                                insights.symbols.interfaces++;
                                break;
                            case 13:
                            case 14:
                                insights.symbols.variables++;
                                break;
                        }
                    });
                }
                catch (error) {
                }
            }
        }
        insights.languages = Array.from(languageSet);
        insights.frameworks = Array.from(frameworkSet);
        if (insights.diagnostics.errors > 0) {
            insights.problems.push(`${insights.diagnostics.errors} compilation errors need fixing`);
        }
        if (insights.diagnostics.warnings > 10) {
            insights.problems.push(`${insights.diagnostics.warnings} warnings should be addressed`);
        }
        if (insights.languages.includes('typescript') && insights.diagnostics.errors > 0) {
            insights.suggestions.push('Run `tsc --noEmit` to check TypeScript compilation');
        }
        if (insights.languages.includes('javascript') && insights.symbols.functions > insights.symbols.classes * 5) {
            insights.suggestions.push('Consider organizing functions into classes or modules');
        }
        return insights;
    }
    async searchSymbols(query, workspaceRoot) {
        const allSymbols = [];
        for (const [key, client] of this.clients) {
            if (workspaceRoot && !key.startsWith(workspaceRoot))
                continue;
            try {
                const symbols = await client.getWorkspaceSymbols(query);
                allSymbols.push(...symbols);
            }
            catch (error) {
            }
        }
        return allSymbols;
    }
    async getHoverInfo(filePath, line, character) {
        const clients = await this.getClientsForFile(filePath);
        for (const client of clients) {
            try {
                if (!client.isFileOpen(filePath)) {
                    await client.openFile(filePath);
                }
                const hover = await client.getHover(filePath, line, character);
                if (hover)
                    return hover;
            }
            catch (error) {
                continue;
            }
        }
        return null;
    }
    async getCompletions(filePath, line, character) {
        const clients = await this.getClientsForFile(filePath);
        const allCompletions = [];
        for (const client of clients) {
            try {
                if (!client.isFileOpen(filePath)) {
                    await client.openFile(filePath);
                }
                const completions = await client.getCompletion(filePath, line, character);
                allCompletions.push(...completions);
            }
            catch (error) {
                continue;
            }
        }
        return allCompletions;
    }
    async ensureDependencies(languages) {
        const serverIds = languages
            .map(lang => {
            if (['javascript', 'typescript', 'typescriptreact', 'javascriptreact'].includes(lang))
                return 'typescript';
            if (lang === 'python')
                return 'python';
            if (lang === 'rust')
                return 'rust';
            if (lang === 'go')
                return 'go';
            if (lang === 'ruby')
                return 'ruby';
            return null;
        })
            .filter(Boolean);
        await (0, lsp_servers_1.ensureLSPDependencies)(serverIds);
    }
    getAllDiagnostics() {
        const diagnostics = [];
        for (const client of this.clients.values()) {
            const clientDiagnostics = client.getDiagnostics();
            for (const [filePath, fileDiagnostics] of clientDiagnostics) {
                const relativePath = (0, path_1.relative)(process.cwd(), filePath);
                fileDiagnostics.forEach(diag => {
                    diagnostics.push(`${relativePath}: ${(0, lsp_client_1.formatDiagnostic)(diag)}`);
                });
            }
        }
        return diagnostics;
    }
    hasErrors(filePath) {
        for (const client of this.clients.values()) {
            const diagnostics = client.getDiagnostics(filePath);
            if (diagnostics.some(d => d.severity === 1)) {
                return true;
            }
        }
        return false;
    }
    getErrorCount(workspaceRoot) {
        let errorCount = 0;
        for (const [key, client] of this.clients) {
            if (workspaceRoot && !key.startsWith(workspaceRoot))
                continue;
            const allDiagnostics = client.getDiagnostics();
            for (const diagnostics of allDiagnostics.values()) {
                errorCount += diagnostics.filter(d => d.severity === 1).length;
            }
        }
        return errorCount;
    }
    clearCache() {
        this.fileAnalysisCache.clear();
    }
    getWorkspaceRoots() {
        return Array.from(this.workspaceRoots);
    }
    getStatus() {
        const status = {
            activeClients: this.clients.size,
            workspaceRoots: this.workspaceRoots.size,
            cachedAnalyses: this.fileAnalysisCache.size,
            totalErrors: this.getErrorCount(),
            servers: {}
        };
        for (const client of this.clients.values()) {
            const serverName = client.getServerInfo().name;
            status.servers[serverName] = (status.servers[serverName] || 0) + 1;
        }
        return status;
    }
    async shutdown() {
        console.log(chalk_1.default.blue('\n🛑 Shutting down LSP clients...'));
        const shutdownPromises = Array.from(this.clients.values()).map(client => client.shutdown().catch(err => console.log(chalk_1.default.yellow(`⚠️ Error shutting down client: ${err.message}`))));
        await Promise.allSettled(shutdownPromises);
        this.clients.clear();
        this.workspaceRoots.clear();
        this.fileAnalysisCache.clear();
        console.log(chalk_1.default.green('✅ LSP shutdown complete'));
    }
}
exports.LSPManager = LSPManager;
exports.lspManager = new LSPManager();
