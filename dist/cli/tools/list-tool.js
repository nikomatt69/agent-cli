"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListTool = exports.IGNORE_PATTERNS = void 0;
const base_tool_1 = require("./base-tool");
const prompt_manager_1 = require("../prompts/prompt-manager");
const terminal_ui_1 = require("../ui/terminal-ui");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const fs_1 = require("fs");
// Pattern intelligenti da ignorare automaticamente
exports.IGNORE_PATTERNS = [
    'node_modules/',
    '__pycache__/',
    '.git/',
    'dist/',
    'build/',
    'target/',
    'vendor/',
    'bin/',
    'obj/',
    '.idea/',
    '.vscode/',
    '.zig-cache/',
    'zig-out',
    '.coverage',
    'coverage/',
    'tmp/',
    'temp/',
    '.cache/',
    'cache/',
    'logs/',
    '.venv/',
    'venv/',
    'env/',
    '.DS_Store',
    'Thumbs.db',
    '*.log',
    '*.tmp',
    '.env.local',
    '.env.*.local'
];
const DEFAULT_LIMIT = 100;
const MAX_DEPTH = 10;
class ListTool extends base_tool_1.BaseTool {
    constructor(workingDirectory) {
        super('list-tool', workingDirectory);
    }
    async execute(params) {
        try {
            // Carica prompt specifico per questo tool
            const promptManager = prompt_manager_1.PromptManager.getInstance();
            const systemPrompt = await promptManager.loadPromptForContext({
                toolName: 'list-tool',
                parameters: params
            });
            terminal_ui_1.CliUI.logDebug(`Using system prompt: ${systemPrompt.substring(0, 100)}...`);
            const searchPath = params.path || this.workingDirectory;
            const limit = params.limit || DEFAULT_LIMIT;
            const maxDepth = Math.min(params.maxDepth || 5, MAX_DEPTH);
            // Validazione sicurezza percorso
            if (!this.isPathSafe(searchPath)) {
                throw new Error(`Path not safe or outside working directory: ${searchPath}`);
            }
            if (!(0, fs_1.existsSync)(searchPath)) {
                throw new Error(`Directory does not exist: ${searchPath}`);
            }
            terminal_ui_1.CliUI.logInfo(`📁 Listing directory: ${(0, path_1.relative)(this.workingDirectory, searchPath)}`);
            // Scansione intelligente con limiti
            const results = await this.scanDirectory(searchPath, {
                maxDepth,
                includeHidden: params.includeHidden || false,
                ignorePatterns: [...exports.IGNORE_PATTERNS, ...(params.ignore || [])],
                limit
            });
            // Ordinamento risultati
            const sortedResults = this.sortResults(results, params.sortBy || 'name');
            // Costruzione struttura directory per output
            const directoryStructure = this.buildDirectoryStructure(sortedResults, searchPath);
            return {
                success: true,
                data: {
                    searchPath,
                    totalFound: results.length,
                    results: sortedResults.slice(0, limit),
                    directoryStructure,
                    limitReached: results.length >= limit,
                    searchStats: {
                        directoriesScanned: results.filter(r => r.type === 'directory').length,
                        filesScanned: results.filter(r => r.type === 'file').length,
                        maxDepth,
                        ignorePatterns: exports.IGNORE_PATTERNS.length + (params.ignore?.length || 0)
                    }
                },
                metadata: {
                    executionTime: Date.now(),
                    toolName: this.name,
                    parameters: params
                }
            };
        }
        catch (error) {
            terminal_ui_1.CliUI.logError(`List tool failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                data: null,
                metadata: {
                    executionTime: Date.now(),
                    toolName: this.name,
                    parameters: params
                }
            };
        }
    }
    /**
     * Scansione intelligente directory con pattern ignore
     */
    async scanDirectory(searchPath, options) {
        const results = [];
        const visited = new Set();
        const scanRecursive = async (currentPath, depth) => {
            if (depth > options.maxDepth || results.length >= options.limit) {
                return;
            }
            const realPath = require('fs').realpathSync(currentPath);
            if (visited.has(realPath)) {
                return; // Evita loop infiniti con symlink
            }
            visited.add(realPath);
            try {
                const entries = await (0, promises_1.readdir)(currentPath);
                for (const entry of entries) {
                    if (results.length >= options.limit)
                        break;
                    const fullPath = (0, path_1.join)(currentPath, entry);
                    const relativePath = (0, path_1.relative)(searchPath, fullPath);
                    // Skip hidden files se non richiesti
                    if (!options.includeHidden && entry.startsWith('.')) {
                        continue;
                    }
                    // Applica ignore patterns
                    if (this.shouldIgnore(relativePath, options.ignorePatterns)) {
                        continue;
                    }
                    try {
                        const stats = await (0, promises_1.stat)(fullPath);
                        const fileEntry = {
                            name: entry,
                            path: fullPath,
                            relativePath,
                            type: stats.isDirectory() ? 'directory' : 'file',
                            size: stats.size,
                            modified: stats.mtime,
                            extension: stats.isFile() ? this.getFileExtension(entry) : undefined
                        };
                        results.push(fileEntry);
                        // Ricorsione per directory
                        if (stats.isDirectory() && depth < options.maxDepth) {
                            await scanRecursive(fullPath, depth + 1);
                        }
                    }
                    catch (statError) {
                        // Skip file con errori di accesso
                        terminal_ui_1.CliUI.logDebug(`Skipping ${fullPath}: ${statError}`);
                    }
                }
            }
            catch (readdirError) {
                terminal_ui_1.CliUI.logDebug(`Cannot read directory ${currentPath}: ${readdirError}`);
            }
        };
        await scanRecursive(searchPath, 0);
        return results;
    }
    /**
     * Verifica se un file/directory deve essere ignorato
     */
    shouldIgnore(relativePath, ignorePatterns) {
        const pathLower = relativePath.toLowerCase();
        return ignorePatterns.some(pattern => {
            // Pattern directory (terminano con /)
            if (pattern.endsWith('/')) {
                return pathLower.includes(pattern.toLowerCase());
            }
            // Pattern file specifici
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(pathLower);
            }
            // Pattern esatti
            return pathLower.includes(pattern.toLowerCase());
        });
    }
    /**
     * Ordina risultati per criterio specificato
     */
    sortResults(results, sortBy) {
        return results.sort((a, b) => {
            switch (sortBy) {
                case 'size':
                    return b.size - a.size;
                case 'modified':
                    return b.modified.getTime() - a.modified.getTime();
                case 'name':
                default:
                    // Directory prima, poi file, entrambi alfabetici
                    if (a.type !== b.type) {
                        return a.type === 'directory' ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
            }
        });
    }
    /**
     * Costruisce struttura directory per output user-friendly
     */
    buildDirectoryStructure(results, basePath) {
        const root = {
            name: (0, path_1.basename)(basePath),
            type: 'directory',
            children: [],
            path: basePath
        };
        const nodeMap = new Map();
        nodeMap.set('', root);
        // Ordina per depth per costruire struttura corretta
        const sortedResults = results.sort((a, b) => a.relativePath.split('/').length - b.relativePath.split('/').length);
        for (const entry of sortedResults) {
            const pathParts = entry.relativePath.split('/');
            let currentNode = root;
            // Naviga/crea path fino al parent
            for (let i = 0; i < pathParts.length - 1; i++) {
                const partialPath = pathParts.slice(0, i + 1).join('/');
                if (!nodeMap.has(partialPath)) {
                    const newNode = {
                        name: pathParts[i],
                        type: 'directory',
                        children: [],
                        path: (0, path_1.join)(basePath, partialPath)
                    };
                    currentNode.children?.push(newNode);
                    nodeMap.set(partialPath, newNode);
                }
                currentNode = nodeMap.get(partialPath);
            }
            // Aggiungi il file/directory finale
            const finalNode = {
                name: entry.name,
                type: entry.type,
                children: entry.type === 'directory' ? [] : undefined,
                path: entry.path,
                size: entry.size,
                modified: entry.modified,
                extension: entry.extension
            };
            currentNode.children?.push(finalNode);
            if (entry.type === 'directory') {
                nodeMap.set(entry.relativePath, finalNode);
            }
        }
        return root;
    }
    getFileExtension(filename) {
        const lastDot = filename.lastIndexOf('.');
        return lastDot > 0 ? filename.substring(lastDot + 1) : '';
    }
}
exports.ListTool = ListTool;
