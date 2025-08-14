"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrepTool = void 0;
const base_tool_1 = require("./base-tool");
const prompt_manager_1 = require("../prompts/prompt-manager");
const cli_ui_1 = require("../utils/cli-ui");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const fs_1 = require("fs");
const list_tool_1 = require("./list-tool");
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
const DEFAULT_MAX_RESULTS = 100;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BINARY_FILE_PATTERNS = ['.jpg', '.png', '.gif', '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so'];
class GrepTool extends base_tool_1.BaseTool {
    constructor(workingDirectory) {
        super('grep-tool', workingDirectory);
    }
    async execute(params) {
        try {
            const promptManager = prompt_manager_1.PromptManager.getInstance();
            const systemPrompt = await promptManager.loadPromptForContext({
                toolName: 'grep-tool',
                parameters: params
            });
            cli_ui_1.CliUI.logDebug(`Using system prompt: ${systemPrompt.substring(0, 100)}...`);
            if (!params.pattern) {
                throw new Error('Pattern is required for grep search');
            }
            const searchPath = params.path || this.workingDirectory;
            const maxResults = params.maxResults || DEFAULT_MAX_RESULTS;
            const contextLines = params.contextLines || 0;
            if (!this.isPathSafe(searchPath)) {
                throw new Error(`Path not safe or outside working directory: ${searchPath}`);
            }
            if (!(0, fs_1.existsSync)(searchPath)) {
                throw new Error(`Search path does not exist: ${searchPath}`);
            }
            cli_ui_1.CliUI.logInfo(`🔍 Searching for pattern: ${cli_ui_1.CliUI.highlight(params.pattern)}`);
            const startTime = Date.now();
            const regex = this.buildRegexPattern(params);
            const filesToSearch = await this.findFilesToSearch(searchPath, params);
            cli_ui_1.CliUI.logDebug(`Found ${filesToSearch.length} files to search`);
            const matches = [];
            let filesScanned = 0;
            let filesWithMatches = 0;
            for (const filePath of filesToSearch) {
                if (matches.length >= maxResults)
                    break;
                try {
                    const fileMatches = await this.searchInFile(filePath, regex, contextLines, params);
                    if (fileMatches.length > 0) {
                        matches.push(...fileMatches);
                        filesWithMatches++;
                    }
                    filesScanned++;
                    if (matches.length >= maxResults) {
                        matches.splice(maxResults);
                        break;
                    }
                }
                catch (error) {
                    cli_ui_1.CliUI.logDebug(`Skipping file ${filePath}: ${error.message}`);
                }
            }
            const executionTime = Date.now() - startTime;
            const result = {
                pattern: params.pattern,
                searchPath,
                totalMatches: matches.length,
                filesWithMatches,
                matches: matches.slice(0, maxResults),
                truncated: matches.length >= maxResults,
                searchStats: {
                    filesScanned,
                    directoriesScanned: 1,
                    executionTime
                }
            };
            cli_ui_1.CliUI.logSuccess(`✅ Found ${result.totalMatches} matches in ${filesWithMatches} files`);
            if (result.matches.length > 0) {
                advanced_cli_ui_1.advancedUI.showGrepResults(params.pattern, result.matches);
            }
            return {
                success: true,
                data: result,
                metadata: {
                    executionTime,
                    toolName: this.name,
                    parameters: params
                }
            };
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Grep tool failed: ${error.message}`);
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
    buildRegexPattern(params) {
        let pattern = params.pattern;
        if (!params.useRegex) {
            pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        if (params.wholeWord) {
            pattern = `\\b${pattern}\\b`;
        }
        const flags = params.caseSensitive ? 'g' : 'gi';
        try {
            return new RegExp(pattern, flags);
        }
        catch (error) {
            throw new Error(`Invalid regex pattern: ${pattern}. ${error}`);
        }
    }
    async findFilesToSearch(searchPath, params) {
        const files = [];
        const visited = new Set();
        const scanRecursive = async (currentPath, depth) => {
            if (depth > 10 || files.length > 1000)
                return;
            const realPath = require('fs').realpathSync(currentPath);
            if (visited.has(realPath))
                return;
            visited.add(realPath);
            try {
                const entries = await (0, promises_1.readdir)(currentPath);
                for (const entry of entries) {
                    const fullPath = (0, path_1.join)(currentPath, entry);
                    const relativePath = (0, path_1.relative)(searchPath, fullPath);
                    if (this.shouldIgnoreForGrep(relativePath, params.exclude || [])) {
                        continue;
                    }
                    try {
                        const stats = await (0, promises_1.stat)(fullPath);
                        if (stats.isDirectory()) {
                            await scanRecursive(fullPath, depth + 1);
                        }
                        else if (stats.isFile()) {
                            if (stats.size > MAX_FILE_SIZE) {
                                cli_ui_1.CliUI.logDebug(`Skipping large file: ${relativePath} (${stats.size} bytes)`);
                                continue;
                            }
                            if (this.isBinaryFile(entry)) {
                                continue;
                            }
                            if (params.include && !this.matchesIncludePattern(entry, params.include)) {
                                continue;
                            }
                            files.push(fullPath);
                        }
                    }
                    catch (statError) {
                        cli_ui_1.CliUI.logDebug(`Skipping ${fullPath}: ${statError}`);
                    }
                }
            }
            catch (readdirError) {
                cli_ui_1.CliUI.logDebug(`Cannot read directory ${currentPath}: ${readdirError}`);
            }
        };
        const stats = await (0, promises_1.stat)(searchPath);
        if (stats.isFile()) {
            files.push(searchPath);
        }
        else {
            await scanRecursive(searchPath, 0);
        }
        return files;
    }
    async searchInFile(filePath, regex, contextLines, params) {
        const content = await (0, promises_1.readFile)(filePath, 'utf-8');
        const lines = content.split('\n');
        const matches = [];
        const relativePath = (0, path_1.relative)(this.workingDirectory, filePath);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = regex.exec(line);
            if (match) {
                const grepMatch = {
                    file: relativePath,
                    lineNumber: i + 1,
                    line: line,
                    match: match[0],
                    column: match.index
                };
                if (contextLines > 0) {
                    grepMatch.beforeContext = lines.slice(Math.max(0, i - contextLines), i);
                    grepMatch.afterContext = lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines));
                }
                matches.push(grepMatch);
                regex.lastIndex = 0;
            }
        }
        return matches;
    }
    shouldIgnoreForGrep(relativePath, excludePatterns) {
        const pathLower = relativePath.toLowerCase();
        if (list_tool_1.IGNORE_PATTERNS.some(pattern => {
            if (pattern.endsWith('/')) {
                return pathLower.includes(pattern.toLowerCase());
            }
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(pathLower);
            }
            return pathLower.includes(pattern.toLowerCase());
        })) {
            return true;
        }
        return excludePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(pathLower);
            }
            return pathLower.includes(pattern.toLowerCase());
        });
    }
    isBinaryFile(filename) {
        const ext = (0, path_1.extname)(filename).toLowerCase();
        return BINARY_FILE_PATTERNS.includes(ext);
    }
    matchesIncludePattern(filename, includePattern) {
        if (includePattern.includes('{') && includePattern.includes('}')) {
            const basePattern = includePattern.split('{')[0];
            const extensions = includePattern.match(/\{([^}]+)\}/)?.[1].split(',') || [];
            return extensions.some(ext => {
                const fullPattern = basePattern + ext.trim();
                return this.matchesGlobPattern(filename, fullPattern);
            });
        }
        return this.matchesGlobPattern(filename, includePattern);
    }
    matchesGlobPattern(filename, pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
        return regex.test(filename);
    }
}
exports.GrepTool = GrepTool;
