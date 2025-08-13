"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditTool = void 0;
const base_tool_1 = require("./base-tool");
const prompt_manager_1 = require("../prompts/prompt-manager");
const cli_ui_1 = require("../utils/cli-ui");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const fs_1 = require("fs");
const diff_viewer_1 = require("../ui/diff-viewer");
const diff_manager_1 = require("../ui/diff-manager");
class EditTool extends base_tool_1.BaseTool {
    constructor(workingDirectory) {
        super('edit-tool', workingDirectory);
    }
    async execute(params) {
        try {
            const promptManager = prompt_manager_1.PromptManager.getInstance();
            const systemPrompt = await promptManager.loadPromptForContext({
                toolName: 'edit-tool',
                parameters: params
            });
            cli_ui_1.CliUI.logDebug(`Using system prompt: ${systemPrompt.substring(0, 100)}...`);
            if (!params.filePath) {
                throw new Error('filePath is required');
            }
            if (params.oldString === params.newString) {
                throw new Error('oldString and newString must be different');
            }
            const filePath = this.resolveFilePath(params.filePath);
            if (!this.isPathSafe(filePath)) {
                throw new Error(`File path not safe or outside working directory: ${filePath}`);
            }
            cli_ui_1.CliUI.logInfo(`✏️ Editing file: ${(0, path_1.relative)(this.workingDirectory, filePath)}`);
            let originalContent = '';
            let fileExists = false;
            if ((0, fs_1.existsSync)(filePath)) {
                originalContent = await (0, promises_1.readFile)(filePath, 'utf-8');
                fileExists = true;
            }
            else if (params.oldString !== '') {
                throw new Error(`File does not exist: ${filePath}`);
            }
            const editResult = await this.performEdit(filePath, originalContent, params, fileExists);
            if (params.previewOnly) {
                cli_ui_1.CliUI.logInfo('📋 Preview mode - no changes written to file');
                return {
                    success: true,
                    data: editResult,
                    metadata: {
                        executionTime: Date.now(),
                        toolName: this.name,
                        parameters: params
                    }
                };
            }
            if (params.createBackup !== false && fileExists && editResult.replacementsMade > 0) {
                const backupPath = await this.createBackup(filePath, originalContent);
                editResult.backupCreated = true;
                editResult.backupPath = backupPath;
                cli_ui_1.CliUI.logInfo(`💾 Backup created: ${(0, path_1.relative)(this.workingDirectory, backupPath)}`);
            }
            if (editResult.replacementsMade > 0) {
                await this.writeFileWithValidation(filePath, editResult.changes, params);
                cli_ui_1.CliUI.logSuccess(`✅ File edited successfully: ${editResult.replacementsMade} replacements made`);
            }
            else {
                cli_ui_1.CliUI.logWarning('⚠️ No replacements made - pattern not found');
            }
            return {
                success: true,
                data: editResult,
                metadata: {
                    executionTime: Date.now(),
                    toolName: this.name,
                    parameters: params
                }
            };
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Edit tool failed: ${error.message}`);
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
    async performEdit(filePath, originalContent, params, fileExists) {
        let newContent;
        let replacementsMade = 0;
        const changes = [];
        if (params.oldString === '') {
            newContent = params.newString;
            replacementsMade = 1;
            changes.push({
                lineNumber: 1,
                before: '',
                after: params.newString,
                context: { beforeLines: [], afterLines: [] }
            });
        }
        else {
            const lines = originalContent.split('\n');
            const newLines = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (params.replaceAll) {
                    if (line.includes(params.oldString)) {
                        const newLine = line.replace(new RegExp(this.escapeRegex(params.oldString), 'g'), params.newString);
                        const occurrences = (line.match(new RegExp(this.escapeRegex(params.oldString), 'g')) || []).length;
                        newLines.push(newLine);
                        replacementsMade += occurrences;
                        changes.push({
                            lineNumber: i + 1,
                            before: line,
                            after: newLine,
                            context: this.getLineContext(lines, i, 2)
                        });
                    }
                    else {
                        newLines.push(line);
                    }
                }
                else {
                    if (line.includes(params.oldString) && replacementsMade === 0) {
                        const newLine = line.replace(params.oldString, params.newString);
                        newLines.push(newLine);
                        replacementsMade = 1;
                        changes.push({
                            lineNumber: i + 1,
                            before: line,
                            after: newLine,
                            context: this.getLineContext(lines, i, 2)
                        });
                    }
                    else {
                        newLines.push(line);
                    }
                }
            }
            newContent = newLines.join('\n');
        }
        const diff = this.generateDiff(originalContent, newContent, filePath);
        if (replacementsMade > 0 && !params.previewOnly) {
            const fileDiff = {
                filePath,
                originalContent,
                newContent,
                isNew: !fileExists,
                isDeleted: false
            };
            console.log('\n');
            diff_viewer_1.DiffViewer.showFileDiff(fileDiff, { compact: true });
            diff_manager_1.diffManager.addFileDiff(filePath, originalContent, newContent);
        }
        let syntaxValid;
        if (params.validateSyntax) {
            syntaxValid = await this.validateSyntax(filePath, newContent);
        }
        return {
            filePath,
            success: true,
            replacementsMade,
            backupCreated: false,
            diff,
            syntaxValid,
            previewMode: params.previewOnly || false,
            changes
        };
    }
    getLineContext(lines, lineIndex, contextSize) {
        const beforeLines = lines.slice(Math.max(0, lineIndex - contextSize), lineIndex);
        const afterLines = lines.slice(lineIndex + 1, Math.min(lines.length, lineIndex + 1 + contextSize));
        return { beforeLines, afterLines };
    }
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    generateDiff(oldContent, newContent, filePath) {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const diff = [];
        diff.push(`--- ${filePath}`);
        diff.push(`+++ ${filePath}`);
        let lineNum = 1;
        const maxLines = Math.max(oldLines.length, newLines.length);
        for (let i = 0; i < maxLines; i++) {
            const oldLine = oldLines[i] || '';
            const newLine = newLines[i] || '';
            if (oldLine !== newLine) {
                if (oldLine && newLine) {
                    diff.push(`@@ -${lineNum},1 +${lineNum},1 @@`);
                    diff.push(`-${oldLine}`);
                    diff.push(`+${newLine}`);
                }
                else if (oldLine) {
                    diff.push(`@@ -${lineNum},1 +${lineNum},0 @@`);
                    diff.push(`-${oldLine}`);
                }
                else if (newLine) {
                    diff.push(`@@ -${lineNum},0 +${lineNum},1 @@`);
                    diff.push(`+${newLine}`);
                }
            }
            lineNum++;
        }
        return diff.join('\n');
    }
    async createBackup(filePath, content) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${filePath}.backup.${timestamp}`;
        await (0, promises_1.writeFile)(backupPath, content, 'utf-8');
        return backupPath;
    }
    async writeFileWithValidation(filePath, changes, params) {
        const dir = (0, path_1.dirname)(filePath);
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        }
        const newContent = this.reconstructContentFromChanges(filePath, changes);
        if (params.validateSyntax) {
            const isValid = await this.validateSyntax(filePath, newContent);
            if (!isValid) {
                throw new Error('Syntax validation failed - file not written');
            }
        }
        const tempPath = `${filePath}.tmp.${Date.now()}`;
        await (0, promises_1.writeFile)(tempPath, newContent, 'utf-8');
        require('fs').renameSync(tempPath, filePath);
    }
    reconstructContentFromChanges(filePath, changes) {
        if ((0, fs_1.existsSync)(filePath)) {
            return require('fs').readFileSync(filePath, 'utf-8');
        }
        return changes.length > 0 ? changes[0].after : '';
    }
    async validateSyntax(filePath, content) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        try {
            switch (ext) {
                case 'json':
                    JSON.parse(content);
                    return true;
                case 'js':
                case 'ts':
                    return !content.includes('syntax error');
                case 'yaml':
                case 'yml':
                    return !content.includes('!!error');
                default:
                    return true;
            }
        }
        catch (error) {
            cli_ui_1.CliUI.logWarning(`Syntax validation failed: ${error}`);
            return false;
        }
    }
    resolveFilePath(filePath) {
        if (require('path').isAbsolute(filePath)) {
            return filePath;
        }
        return (0, path_1.join)(this.workingDirectory, filePath);
    }
}
exports.EditTool = EditTool;
