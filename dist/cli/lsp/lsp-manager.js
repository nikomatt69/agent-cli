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
        this.clients = new Map(); // workspaceRoot+serverId -> client
        this.workspaceRoots = new Set();
        this.fileAnalysisCache = new Map();
        // Cleanup on process exit
        process.on('beforeExit', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }
    // Get or create LSP clients for a file
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
    // Analyze a file with full LSP context
    async analyzeFile(filePath) {
        const absolutePath = (0, path_1.resolve)(filePath);
        // Check cache first
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
        // Get data from all applicable LSP clients
        for (const client of clients) {
            try {
                // Open file if not already open
                if (!client.isFileOpen(absolutePath)) {
                    await client.openFile(absolutePath);
                }
                // Wait a moment for diagnostics to arrive
                await new Promise(resolve => setTimeout(resolve, 1000));
                // Collect diagnostics
                const diagnostics = client.getDiagnostics(absolutePath);
                context.diagnostics.push(...diagnostics);
                // Get document symbols
                const symbols = await client.getDocumentSymbols(absolutePath);
                context.symbols.push(...symbols);
                // Update workspace root to the LSP client's root
                context.workspaceRoot = client.getWorkspaceRoot();
            }
            catch (error) {
                console.log(chalk_1.default.yellow(`⚠️ Error analyzing with ${client.getServerInfo().name}: ${error.message}`));
            }
        }
        // Cache the result
        this.fileAnalysisCache.set(absolutePath, context);
        console.log(chalk_1.default.green(`✅ Analyzed ${(0, path_1.relative)(context.workspaceRoot, absolutePath)}: ${context.symbols.length} symbols, ${context.diagnostics.length} diagnostics`));
        return context;
    }
    // Get workspace-wide insights
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
        // Collect data from all clients in this workspace
        for (const [key, client] of this.clients) {
            if (!key.startsWith(workspaceRoot))
                continue;
            // Get all diagnostics
            const allDiagnostics = client.getDiagnostics();
            for (const [filePath, diagnostics] of allDiagnostics) {
                insights.totalFiles++;
                // Detect language
                const language = (0, language_detection_1.detectLanguageFromExtension)(filePath);
                if (language !== 'plaintext') {
                    languageSet.add(language);
                }
                // Count diagnostics by severity
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
                // Get symbols
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
                    // Skip if can't get symbols
                }
            }
        }
        insights.languages = Array.from(languageSet);
        insights.frameworks = Array.from(frameworkSet);
        // Generate problems and suggestions
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
    // Search symbols across workspace
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
                // Skip failed searches
            }
        }
        return allSymbols;
    }
    // Get hover information
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
    // Get completions
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
    // Ensure LSP dependencies are installed
    async ensureDependencies(languages) {
        const serverIds = languages
            .map(lang => {
            // Map languages to server IDs
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
    // Get all diagnostics as formatted strings
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
    // Check if file has errors
    hasErrors(filePath) {
        for (const client of this.clients.values()) {
            const diagnostics = client.getDiagnostics(filePath);
            if (diagnostics.some(d => d.severity === 1)) {
                return true;
            }
        }
        return false;
    }
    // Get error count for workspace
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
    // Clear analysis cache
    clearCache() {
        this.fileAnalysisCache.clear();
    }
    // Get active workspace roots
    getWorkspaceRoots() {
        return Array.from(this.workspaceRoots);
    }
    // Get status summary
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
    // Shutdown all clients
    async shutdown() {
        console.log(chalk_1.default.blue('🛑 Shutting down LSP clients...'));
        const shutdownPromises = Array.from(this.clients.values()).map(client => client.shutdown().catch(err => console.log(chalk_1.default.yellow(`⚠️ Error shutting down client: ${err.message}`))));
        await Promise.allSettled(shutdownPromises);
        this.clients.clear();
        this.workspaceRoots.clear();
        this.fileAnalysisCache.clear();
        console.log(chalk_1.default.green('✅ LSP shutdown complete'));
    }
}
exports.LSPManager = LSPManager;
// Global LSP manager instance
exports.lspManager = new LSPManager();
