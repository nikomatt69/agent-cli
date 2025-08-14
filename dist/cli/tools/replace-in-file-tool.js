"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplaceInFileTool = void 0;
const promises_1 = require("fs/promises");
const base_tool_1 = require("./base-tool");
const secure_file_tools_1 = require("./secure-file-tools");
const cli_ui_1 = require("../utils/cli-ui");
class ReplaceInFileTool extends base_tool_1.BaseTool {
    constructor(workingDirectory) {
        super('replace-in-file-tool', workingDirectory);
    }
    async execute(filePath, searchPattern, replacement, options = {}) {
        const startTime = Date.now();
        let backupContent;
        try {
            const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
            const originalContent = await (0, promises_1.readFile)(sanitizedPath, 'utf8');
            backupContent = originalContent;
            const replaceResult = this.performReplacement(originalContent, searchPattern, replacement, options);
            if (options.validators) {
                for (const validator of options.validators) {
                    const validation = await validator(originalContent, replaceResult.newContent, replaceResult.matches);
                    if (!validation.isValid) {
                        throw new Error(`Replacement validation failed: ${validation.errors.join(', ')}`);
                    }
                }
            }
            if (replaceResult.matchCount === 0 && options.requireMatch) {
                throw new Error('No matches found for the search pattern');
            }
            if (replaceResult.matchCount > 0) {
                await (0, promises_1.writeFile)(sanitizedPath, replaceResult.newContent, 'utf8');
            }
            const duration = Date.now() - startTime;
            const replaceResult_ = {
                success: true,
                filePath: sanitizedPath,
                matchCount: replaceResult.matchCount,
                replacementsMade: replaceResult.matchCount,
                originalSize: Buffer.byteLength(originalContent, 'utf8'),
                newSize: Buffer.byteLength(replaceResult.newContent, 'utf8'),
                duration,
                preview: this.generatePreview(originalContent, replaceResult.newContent, options.previewLines),
                metadata: {
                    searchPattern: searchPattern.toString(),
                    replacement,
                    encoding: 'utf8',
                    hasChanges: replaceResult.matchCount > 0
                }
            };
            if (replaceResult.matchCount > 0) {
                cli_ui_1.CliUI.logSuccess(`Replaced ${replaceResult.matchCount} occurrence(s) in ${filePath}`);
            }
            else {
                cli_ui_1.CliUI.logInfo(`No matches found in ${filePath}`);
            }
            return {
                success: true,
                data: replaceResult_,
                metadata: {
                    executionTime: duration,
                    toolName: this.name,
                    parameters: { filePath, searchPattern: searchPattern.toString(), replacement, options }
                }
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorResult = {
                success: false,
                filePath,
                matchCount: 0,
                replacementsMade: 0,
                originalSize: backupContent ? Buffer.byteLength(backupContent, 'utf8') : 0,
                newSize: 0,
                duration,
                error: error.message,
                metadata: {
                    searchPattern: searchPattern.toString(),
                    replacement,
                    encoding: 'utf8',
                    hasChanges: false
                }
            };
            cli_ui_1.CliUI.logError(`Failed to replace in file ${filePath}: ${error.message}`);
            return {
                success: false,
                data: errorResult,
                error: error.message,
                metadata: {
                    executionTime: duration,
                    toolName: this.name,
                    parameters: { filePath, searchPattern: searchPattern.toString(), replacement, options }
                }
            };
        }
    }
    async replaceInMultiple(filePaths, searchPattern, replacement, options = {}) {
        const results = [];
        let totalReplacements = 0;
        let successCount = 0;
        for (const filePath of filePaths) {
            try {
                const result = await this.execute(filePath, searchPattern, replacement, options);
                results.push(result.data);
                if (result.success) {
                    successCount++;
                    totalReplacements += result.data.replacementsMade;
                }
                else if (options.stopOnFirstError) {
                    break;
                }
            }
            catch (error) {
                results.push({
                    success: false,
                    filePath,
                    matchCount: 0,
                    replacementsMade: 0,
                    originalSize: 0,
                    newSize: 0,
                    duration: 0,
                    error: error.message,
                    metadata: {
                        searchPattern: searchPattern.toString(),
                        replacement,
                        encoding: 'utf8',
                        hasChanges: false
                    }
                });
                if (options.stopOnFirstError) {
                    break;
                }
            }
        }
        return {
            success: successCount === filePaths.length,
            results,
            totalFiles: filePaths.length,
            successfulFiles: successCount,
            totalReplacements,
            summary: this.generateSummary(results)
        };
    }
    async replaceWithContext(filePath, searchPattern, replacement, context) {
        try {
            const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
            const content = await (0, promises_1.readFile)(sanitizedPath, 'utf8');
            const lines = content.split('\n');
            let matchCount = 0;
            const modifiedLines = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                let shouldReplace = false;
                const hasMatch = typeof searchPattern === 'string'
                    ? line.includes(searchPattern)
                    : searchPattern.test(line);
                if (hasMatch) {
                    shouldReplace = this.checkContext(lines, i, context);
                }
                if (shouldReplace) {
                    const newLine = typeof searchPattern === 'string'
                        ? line.replace(new RegExp(this.escapeRegex(searchPattern), 'g'), replacement)
                        : line.replace(searchPattern, replacement);
                    modifiedLines.push(newLine);
                    matchCount++;
                }
                else {
                    modifiedLines.push(line);
                }
            }
            const newContent = modifiedLines.join('\n');
            if (matchCount > 0) {
                await (0, promises_1.writeFile)(sanitizedPath, newContent, 'utf8');
            }
            return {
                success: true,
                filePath: sanitizedPath,
                matchCount,
                replacementsMade: matchCount,
                originalSize: Buffer.byteLength(content, 'utf8'),
                newSize: Buffer.byteLength(newContent, 'utf8'),
                duration: 0,
                preview: this.generatePreview(content, newContent),
                metadata: {
                    searchPattern: searchPattern.toString(),
                    replacement,
                    encoding: 'utf8',
                    hasChanges: matchCount > 0,
                    contextUsed: true
                }
            };
        }
        catch (error) {
            throw new Error(`Context-aware replacement failed: ${error.message}`);
        }
    }
    performReplacement(content, searchPattern, replacement, options) {
        let newContent;
        let matchCount = 0;
        const matches = [];
        if (typeof searchPattern === 'string') {
            const regex = new RegExp(this.escapeRegex(searchPattern), options.caseSensitive === false ? 'gi' : 'g');
            newContent = content.replace(regex, (match, ...args) => {
                matchCount++;
                matches.push(match);
                if (options.maxReplacements && matchCount > options.maxReplacements) {
                    return match;
                }
                return replacement;
            });
        }
        else {
            const globalRegex = new RegExp(searchPattern.source, searchPattern.flags.includes('g') ? searchPattern.flags : searchPattern.flags + 'g');
            newContent = content.replace(globalRegex, (match, ...args) => {
                matchCount++;
                matches.push(match);
                if (options.maxReplacements && matchCount > options.maxReplacements) {
                    return match;
                }
                return replacement;
            });
        }
        return {
            newContent,
            matchCount: Math.min(matchCount, options.maxReplacements || matchCount),
            matches
        };
    }
    checkContext(lines, lineIndex, context) {
        if (context.beforeLines) {
            for (let i = 1; i <= context.beforeLines.length; i++) {
                const beforeIndex = lineIndex - i;
                if (beforeIndex >= 0) {
                    const beforeLine = lines[beforeIndex];
                    const expectedPattern = context.beforeLines[i - 1];
                    if (typeof expectedPattern === 'string') {
                        if (!beforeLine.includes(expectedPattern))
                            return false;
                    }
                    else {
                        if (!expectedPattern.test(beforeLine))
                            return false;
                    }
                }
            }
        }
        if (context.afterLines) {
            for (let i = 1; i <= context.afterLines.length; i++) {
                const afterIndex = lineIndex + i;
                if (afterIndex < lines.length) {
                    const afterLine = lines[afterIndex];
                    const expectedPattern = context.afterLines[i - 1];
                    if (typeof expectedPattern === 'string') {
                        if (!afterLine.includes(expectedPattern))
                            return false;
                    }
                    else {
                        if (!expectedPattern.test(afterLine))
                            return false;
                    }
                }
            }
        }
        if (context.excludeIfContains) {
            const currentLine = lines[lineIndex];
            for (const excludePattern of context.excludeIfContains) {
                if (typeof excludePattern === 'string') {
                    if (currentLine.includes(excludePattern))
                        return false;
                }
                else {
                    if (excludePattern.test(currentLine))
                        return false;
                }
            }
        }
        return true;
    }
    generatePreview(originalContent, newContent, maxLines = 10) {
        const originalLines = originalContent.split('\n');
        const newLines = newContent.split('\n');
        const changes = [];
        const maxLength = Math.max(originalLines.length, newLines.length);
        for (let i = 0; i < maxLength && changes.length < maxLines; i++) {
            const originalLine = originalLines[i] || '';
            const newLine = newLines[i] || '';
            if (originalLine !== newLine) {
                changes.push({
                    lineNumber: i + 1,
                    original: originalLine,
                    modified: newLine,
                    type: originalLine === '' ? 'added' : newLine === '' ? 'removed' : 'modified'
                });
            }
        }
        return {
            changes,
            totalChanges: changes.length,
            hasMoreChanges: changes.length === maxLines && originalContent !== newContent
        };
    }
    generateSummary(results) {
        const filesWithChanges = results.filter(r => r.success && r.replacementsMade > 0);
        const filesWithErrors = results.filter(r => !r.success);
        return {
            totalFiles: results.length,
            filesModified: filesWithChanges.length,
            filesWithErrors: filesWithErrors.length,
            totalReplacements: results.reduce((sum, r) => sum + r.replacementsMade, 0),
            averageReplacementsPerFile: filesWithChanges.length > 0
                ? Math.round(filesWithChanges.reduce((sum, r) => sum + r.replacementsMade, 0) / filesWithChanges.length)
                : 0
        };
    }
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
exports.ReplaceInFileTool = ReplaceInFileTool;
