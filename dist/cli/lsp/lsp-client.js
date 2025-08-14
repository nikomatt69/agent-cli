"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LSPClient = void 0;
exports.formatDiagnostic = formatDiagnostic;
exports.getSymbolKindName = getSymbolKindName;
const node_1 = require("vscode-jsonrpc/node");
const language_detection_1 = require("./language-detection");
const path_1 = require("path");
const fs_1 = require("fs");
const chalk_1 = __importDefault(require("chalk"));
class LSPClient {
    constructor(server, serverInfo, workspaceRoot) {
        this.openFiles = new Map();
        this.diagnostics = new Map();
        this.isInitialized = false;
        this.server = server;
        this.serverInfo = serverInfo;
        this.workspaceRoot = workspaceRoot;
        this.connection = (0, node_1.createMessageConnection)(new node_1.StreamMessageReader(server.process.stdout), new node_1.StreamMessageWriter(server.process.stdin));
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.connection.onNotification('textDocument/publishDiagnostics', (params) => {
            const uri = params.uri;
            const filePath = this.uriToPath(uri);
            console.log(chalk_1.default.blue(`📊 Diagnostics for: ${(0, path_1.relative)(this.workspaceRoot, filePath)}`));
            this.diagnostics.set(filePath, params.diagnostics);
            if (params.diagnostics.length > 0) {
                params.diagnostics.forEach((diag) => {
                    const severity = diag.severity === 1 ? chalk_1.default.red('ERROR') :
                        diag.severity === 2 ? chalk_1.default.yellow('WARNING') :
                            diag.severity === 3 ? chalk_1.default.blue('INFO') : chalk_1.default.gray('HINT');
                    console.log(`  ${severity} [${diag.range.start.line + 1}:${diag.range.start.character + 1}] ${diag.message}`);
                });
            }
        });
        this.connection.onRequest('window/showMessage', (params) => {
            console.log(`${this.serverInfo.name}: ${params.message}`);
        });
        this.connection.onRequest('window/showMessageRequest', (params) => {
            console.log(`${this.serverInfo.name}: ${params.message}`);
            return null;
        });
        this.connection.onRequest('workspace/configuration', () => {
            return [{}];
        });
        this.connection.onNotification('$/progress', (params) => {
            if (params.value?.kind === 'begin') {
                console.log(chalk_1.default.blue(`🔄 ${this.serverInfo.name}: ${params.value.title || params.value.message || 'Working...'}`));
            }
        });
        this.connection.listen();
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            console.log(chalk_1.default.blue(`🚀 Initializing ${this.serverInfo.name}...`));
            const initResult = await this.connection.sendRequest('initialize', {
                processId: process.pid,
                rootPath: this.workspaceRoot,
                rootUri: this.pathToUri(this.workspaceRoot),
                capabilities: {
                    workspace: {
                        applyEdit: true,
                        workspaceEdit: { documentChanges: true },
                        didChangeConfiguration: { dynamicRegistration: true },
                        didChangeWatchedFiles: { dynamicRegistration: true },
                        symbol: { dynamicRegistration: true },
                        executeCommand: { dynamicRegistration: true },
                    },
                    textDocument: {
                        publishDiagnostics: {
                            relatedInformation: true,
                            versionSupport: false,
                            tagSupport: { valueSet: [1, 2] }
                        },
                        synchronization: {
                            dynamicRegistration: true,
                            willSave: true,
                            willSaveWaitUntil: true,
                            didSave: true
                        },
                        completion: {
                            dynamicRegistration: true,
                            contextSupport: true,
                            completionItem: {
                                snippetSupport: true,
                                commitCharactersSupport: true,
                                documentationFormat: ['markdown', 'plaintext'],
                                deprecatedSupport: true,
                                preselectSupport: true,
                            }
                        },
                        hover: {
                            dynamicRegistration: true,
                            contentFormat: ['markdown', 'plaintext']
                        },
                        signatureHelp: { dynamicRegistration: true },
                        references: { dynamicRegistration: true },
                        documentHighlight: { dynamicRegistration: true },
                        documentSymbol: { dynamicRegistration: true },
                        formatting: { dynamicRegistration: true },
                        rangeFormatting: { dynamicRegistration: true },
                        onTypeFormatting: { dynamicRegistration: true },
                        definition: { dynamicRegistration: true },
                        typeDefinition: { dynamicRegistration: true },
                        implementation: { dynamicRegistration: true },
                        codeAction: { dynamicRegistration: true },
                        codeLens: { dynamicRegistration: true },
                        documentLink: { dynamicRegistration: true },
                        rename: { dynamicRegistration: true },
                    }
                },
                initializationOptions: this.server.initialization,
                workspaceFolders: [{
                        uri: this.pathToUri(this.workspaceRoot),
                        name: 'workspace'
                    }]
            });
            await this.connection.sendNotification('initialized', {});
            this.isInitialized = true;
            console.log(chalk_1.default.green(`✅ ${this.serverInfo.name} initialized`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to initialize ${this.serverInfo.name}: ${error.message}`));
            throw error;
        }
    }
    async openFile(filePath) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const absolutePath = (0, path_1.resolve)(filePath);
        const uri = this.pathToUri(absolutePath);
        try {
            const content = (0, fs_1.readFileSync)(absolutePath, 'utf-8');
            const languageId = (0, language_detection_1.detectLanguageFromExtension)(absolutePath);
            if (this.openFiles.has(absolutePath)) {
                await this.connection.sendNotification('textDocument/didClose', {
                    textDocument: { uri }
                });
            }
            await this.connection.sendNotification('textDocument/didOpen', {
                textDocument: {
                    uri,
                    languageId,
                    version: 1,
                    text: content
                }
            });
            this.openFiles.set(absolutePath, 1);
            console.log(chalk_1.default.blue(`📖 Opened: ${(0, path_1.relative)(this.workspaceRoot, absolutePath)}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to open file ${filePath}: ${error.message}`));
            throw error;
        }
    }
    async getHover(filePath, line, character) {
        const uri = this.pathToUri((0, path_1.resolve)(filePath));
        try {
            const result = await this.connection.sendRequest('textDocument/hover', {
                textDocument: { uri },
                position: { line, character }
            });
            return result || null;
        }
        catch (error) {
            return null;
        }
    }
    async getCompletion(filePath, line, character) {
        const uri = this.pathToUri((0, path_1.resolve)(filePath));
        try {
            const result = await this.connection.sendRequest('textDocument/completion', {
                textDocument: { uri },
                position: { line, character },
                context: { triggerKind: 1 }
            });
            return result?.items || result || [];
        }
        catch (error) {
            return [];
        }
    }
    async getWorkspaceSymbols(query) {
        try {
            const result = await this.connection.sendRequest('workspace/symbol', { query });
            return result || [];
        }
        catch (error) {
            return [];
        }
    }
    async getDocumentSymbols(filePath) {
        const uri = this.pathToUri((0, path_1.resolve)(filePath));
        try {
            const result = await this.connection.sendRequest('textDocument/documentSymbol', {
                textDocument: { uri }
            });
            return result || [];
        }
        catch (error) {
            return [];
        }
    }
    async getDefinition(filePath, line, character) {
        const uri = this.pathToUri((0, path_1.resolve)(filePath));
        try {
            const result = await this.connection.sendRequest('textDocument/definition', {
                textDocument: { uri },
                position: { line, character }
            });
            return result;
        }
        catch (error) {
            return null;
        }
    }
    async getReferences(filePath, line, character) {
        const uri = this.pathToUri((0, path_1.resolve)(filePath));
        try {
            const result = await this.connection.sendRequest('textDocument/references', {
                textDocument: { uri },
                position: { line, character },
                context: { includeDeclaration: true }
            });
            return result || [];
        }
        catch (error) {
            return [];
        }
    }
    getDiagnostics(filePath) {
        if (filePath) {
            const absolutePath = (0, path_1.resolve)(filePath);
            return this.diagnostics.get(absolutePath) || [];
        }
        return this.diagnostics;
    }
    async waitForDiagnostics(filePath, timeoutMs = 3000) {
        return new Promise((resolvePromise) => {
            const absolutePath = (0, path_1.resolve)(filePath);
            const checkDiagnostics = () => {
                const diagnostics = this.diagnostics.get(absolutePath);
                if (diagnostics !== undefined) {
                    resolvePromise(diagnostics);
                }
                else {
                    setTimeout(checkDiagnostics, 100);
                }
            };
            setTimeout(() => resolvePromise([]), timeoutMs);
            checkDiagnostics();
        });
    }
    getServerInfo() {
        return this.serverInfo;
    }
    getWorkspaceRoot() {
        return this.workspaceRoot;
    }
    isFileOpen(filePath) {
        return this.openFiles.has((0, path_1.resolve)(filePath));
    }
    getOpenFiles() {
        return Array.from(this.openFiles.keys());
    }
    async closeFile(filePath) {
        const absolutePath = (0, path_1.resolve)(filePath);
        if (this.openFiles.has(absolutePath)) {
            const uri = this.pathToUri(absolutePath);
            await this.connection.sendNotification('textDocument/didClose', {
                textDocument: { uri }
            });
            this.openFiles.delete(absolutePath);
            this.diagnostics.delete(absolutePath);
        }
    }
    async shutdown() {
        try {
            if (this.isInitialized) {
                await this.connection.sendRequest('shutdown', null);
                await this.connection.sendNotification('exit', null);
            }
            for (const filePath of this.openFiles.keys()) {
                await this.closeFile(filePath);
            }
            this.server.process.kill();
            this.connection.end();
            console.log(chalk_1.default.green(`🛑 ${this.serverInfo.name} shutdown`));
        }
        catch (error) {
            console.log(chalk_1.default.yellow(`⚠️ Error during shutdown: ${error.message}`));
        }
    }
    pathToUri(path) {
        return `file://${path}`;
    }
    uriToPath(uri) {
        return uri.replace('file://', '');
    }
    static async create(server, serverInfo, workspaceRoot) {
        const client = new LSPClient(server, serverInfo, workspaceRoot);
        await client.initialize();
        return client;
    }
}
exports.LSPClient = LSPClient;
function formatDiagnostic(diagnostic) {
    const severityMap = {
        1: chalk_1.default.red('ERROR'),
        2: chalk_1.default.yellow('WARNING'),
        3: chalk_1.default.blue('INFO'),
        4: chalk_1.default.gray('HINT')
    };
    const severity = severityMap[diagnostic.severity] || 'UNKNOWN';
    const line = diagnostic.range.start.line + 1;
    const col = diagnostic.range.start.character + 1;
    return `${severity} [${line}:${col}] ${diagnostic.message}`;
}
function getSymbolKindName(kind) {
    const symbolKindMap = {
        1: 'File',
        2: 'Module',
        3: 'Namespace',
        4: 'Package',
        5: 'Class',
        6: 'Method',
        7: 'Property',
        8: 'Field',
        9: 'Constructor',
        10: 'Enum',
        11: 'Interface',
        12: 'Function',
        13: 'Variable',
        14: 'Constant',
        15: 'String',
        16: 'Number',
        17: 'Boolean',
        18: 'Array',
        19: 'Object',
        20: 'Key',
        21: 'Null',
        22: 'EnumMember',
        23: 'Struct',
        24: 'Event',
        25: 'Operator',
        26: 'TypeParameter'
    };
    return symbolKindMap[kind] || 'Unknown';
}
