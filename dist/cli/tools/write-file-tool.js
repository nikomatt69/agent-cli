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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WriteFileTool = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const base_tool_1 = require("./base-tool");
const secure_file_tools_1 = require("./secure-file-tools");
const terminal_ui_1 = require("../ui/terminal-ui");
/**
 * Production-ready Write File Tool
 * Safely writes files with backup, validation, and rollback capabilities
 */
class WriteFileTool extends base_tool_1.BaseTool {
    constructor(workingDirectory) {
        super('write-file-tool', workingDirectory);
        this.backupDirectory = (0, path_1.join)(workingDirectory, '.ai-backups');
    }
    async execute(filePath, content, options = {}) {
        const startTime = Date.now();
        let backupPath;
        try {
            // Sanitize and validate file path
            const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
            // Validate content if validators are provided
            if (options.validators) {
                for (const validator of options.validators) {
                    const validation = await validator(content, sanitizedPath);
                    if (!validation.isValid) {
                        throw new Error(`Content validation failed: ${validation.errors.join(', ')}`);
                    }
                }
            }
            // Read existing content for diff display
            let existingContent = '';
            let isNewFile = false;
            try {
                existingContent = await (0, promises_1.readFile)(sanitizedPath, 'utf8');
            }
            catch (error) {
                // File doesn't exist, it's a new file
                isNewFile = true;
            }
            // Create backup if file exists and backup is enabled
            if (options.createBackup !== false) {
                backupPath = await this.createBackup(sanitizedPath);
            }
            // Ensure directory exists
            const dir = (0, path_1.dirname)(sanitizedPath);
            await (0, promises_1.mkdir)(dir, { recursive: true });
            // Apply content transformations
            let processedContent = content;
            if (options.transformers) {
                for (const transformer of options.transformers) {
                    processedContent = await transformer(processedContent, sanitizedPath);
                }
            }
            // Show diff before writing (unless disabled)
            if (options.showDiff !== false && !isNewFile && existingContent !== processedContent) {
                const fileDiff = {
                    filePath: sanitizedPath,
                    originalContent: existingContent,
                    newContent: processedContent,
                    isNew: false,
                    isDeleted: false
                };
                console.log('\n');
                terminal_ui_1.DiffViewer.showFileDiff(fileDiff, { compact: true });
                // Also add to diff manager for approval system
                terminal_ui_1.diffManager.addFileDiff(sanitizedPath, existingContent, processedContent);
            }
            else if (isNewFile) {
                const fileDiff = {
                    filePath: sanitizedPath,
                    originalContent: '',
                    newContent: processedContent,
                    isNew: true,
                    isDeleted: false
                };
                console.log('\n');
                terminal_ui_1.DiffViewer.showFileDiff(fileDiff, { compact: true });
            }
            // Write file with specified encoding
            const encoding = options.encoding || 'utf8';
            await (0, promises_1.writeFile)(sanitizedPath, processedContent, {
                encoding: encoding,
                mode: options.mode || 0o644
            });
            // Verify write if requested
            if (options.verifyWrite) {
                const verification = await this.verifyWrite(sanitizedPath, processedContent, encoding);
                if (!verification.success) {
                    throw new Error(`Write verification failed: ${verification.error}`);
                }
            }
            const duration = Date.now() - startTime;
            const writeFileResult = {
                success: true,
                filePath: sanitizedPath,
                bytesWritten: Buffer.byteLength(processedContent, encoding),
                backupPath,
                duration,
                metadata: {
                    encoding,
                    lines: processedContent.split('\n').length,
                    created: !backupPath, // New file if no backup was created
                    mode: options.mode || 0o644
                }
            };
            terminal_ui_1.CliUI.logSuccess(`File written: ${filePath} (${writeFileResult.bytesWritten} bytes)`);
            return {
                success: true,
                data: writeFileResult,
                metadata: {
                    executionTime: duration,
                    toolName: this.name,
                    parameters: { filePath, contentLength: content.length, options }
                }
            };
        }
        catch (error) {
            // Rollback if backup exists
            if (backupPath && options.autoRollback !== false) {
                try {
                    await this.rollback(filePath, backupPath);
                    terminal_ui_1.CliUI.logInfo('Rolled back to backup due to error');
                }
                catch (rollbackError) {
                    terminal_ui_1.CliUI.logWarning(`Rollback failed: ${rollbackError.message}`);
                }
            }
            const duration = Date.now() - startTime;
            const errorResult = {
                success: false,
                filePath,
                bytesWritten: 0,
                backupPath,
                duration,
                error: error.message,
                metadata: {
                    encoding: options.encoding || 'utf8',
                    lines: 0,
                    created: false,
                    mode: options.mode || 0o644
                }
            };
            terminal_ui_1.CliUI.logError(`Failed to write file ${filePath}: ${error.message}`);
            return {
                success: false,
                data: errorResult,
                error: error.message,
                metadata: {
                    executionTime: duration,
                    toolName: this.name,
                    parameters: { filePath, contentLength: content.length, options }
                }
            };
        }
    }
    /**
     * Write multiple files in a transaction-like manner
     */
    async writeMultiple(files, options = {}) {
        const results = [];
        const backups = [];
        let successCount = 0;
        try {
            // Phase 1: Create backups for all existing files
            for (const file of files) {
                const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(file.path, this.workingDirectory);
                if (options.createBackup !== false) {
                    try {
                        const backupPath = await this.createBackup(sanitizedPath);
                        if (backupPath)
                            backups.push(backupPath);
                    }
                    catch {
                        // File doesn't exist, no backup needed
                    }
                }
            }
            // Phase 2: Write all files
            for (const file of files) {
                const toolResult = await this.execute(file.path, file.content, {
                    ...options,
                    createBackup: false // Already handled above
                });
                const result = toolResult.data;
                results.push(result);
                if (result.success) {
                    successCount++;
                }
                else if (options.stopOnFirstError) {
                    break;
                }
            }
            // Phase 3: Handle partial failures
            if (successCount < files.length && options.rollbackOnPartialFailure) {
                await this.rollbackMultiple(backups);
                terminal_ui_1.CliUI.logWarning('Rolled back all changes due to partial failure');
            }
            return {
                success: successCount === files.length,
                results,
                successCount,
                totalFiles: files.length,
                backupPaths: backups
            };
        }
        catch (error) {
            // Rollback all changes
            if (options.autoRollback !== false) {
                await this.rollbackMultiple(backups);
            }
            return {
                success: false,
                results,
                successCount,
                totalFiles: files.length,
                backupPaths: backups,
                error: error.message
            };
        }
    }
    /**
     * Append content to an existing file
     */
    async append(filePath, content, options = {}) {
        try {
            const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
            // Read existing content if file exists
            let existingContent = '';
            try {
                const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
                existingContent = await fs.readFile(sanitizedPath, 'utf8');
            }
            catch {
                // File doesn't exist, will be created
            }
            // Prepare new content
            const separator = options.separator || '\n';
            const newContent = existingContent + (existingContent ? separator : '') + content;
            const toolResult = await this.execute(filePath, newContent, {
                encoding: options.encoding,
                createBackup: options.createBackup,
                verifyWrite: options.verifyWrite
            });
            return toolResult.data;
        }
        catch (error) {
            throw new Error(`Failed to append to file: ${error.message}`);
        }
    }
    /**
     * Create a backup of an existing file
     */
    async createBackup(filePath) {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            await fs.access(filePath); // Check if file exists
            // Ensure backup directory exists
            await (0, promises_1.mkdir)(this.backupDirectory, { recursive: true });
            // Generate backup filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = filePath.replace(this.workingDirectory, '').replace(/^\//, '');
            const backupPath = (0, path_1.join)(this.backupDirectory, `${fileName}.${timestamp}.backup`);
            // Ensure backup subdirectories exist
            await (0, promises_1.mkdir)((0, path_1.dirname)(backupPath), { recursive: true });
            // Copy file to backup location
            await (0, promises_1.copyFile)(filePath, backupPath);
            terminal_ui_1.CliUI.logInfo(`Backup created: ${backupPath}`);
            return backupPath;
        }
        catch {
            // File doesn't exist or can't be backed up
            return undefined;
        }
    }
    /**
     * Rollback a file from backup
     */
    async rollback(filePath, backupPath) {
        try {
            const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
            await (0, promises_1.copyFile)(backupPath, sanitizedPath);
            await (0, promises_1.unlink)(backupPath); // Clean up backup
        }
        catch (error) {
            throw new Error(`Rollback failed: ${error.message}`);
        }
    }
    /**
     * Rollback multiple files from backups
     */
    async rollbackMultiple(backupPaths) {
        for (const backupPath of backupPaths) {
            try {
                // Extract original path from backup path
                const originalPath = backupPath
                    .replace(this.backupDirectory, this.workingDirectory)
                    .replace(/\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.backup$/, '');
                await this.rollback(originalPath, backupPath);
            }
            catch (error) {
                terminal_ui_1.CliUI.logWarning(`Failed to rollback ${backupPath}: ${error.message}`);
            }
        }
    }
    /**
     * Verify that file was written correctly
     */
    async verifyWrite(filePath, expectedContent, encoding) {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const actualContent = await fs.readFile(filePath, encoding);
            if (actualContent === expectedContent) {
                return { success: true };
            }
            else {
                return {
                    success: false,
                    error: 'Content mismatch after write'
                };
            }
        }
        catch (error) {
            return {
                success: false,
                error: `Verification read failed: ${error.message}`
            };
        }
    }
    /**
     * Clean old backups
     */
    async cleanBackups(maxAge = 7 * 24 * 60 * 60 * 1000) {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const files = await fs.readdir(this.backupDirectory, { recursive: true });
            const now = Date.now();
            let deletedCount = 0;
            for (const file of files) {
                if (typeof file === 'string' && file.endsWith('.backup')) {
                    const filePath = (0, path_1.join)(this.backupDirectory, file);
                    const stats = await fs.stat(filePath);
                    if (now - stats.mtime.getTime() > maxAge) {
                        await (0, promises_1.unlink)(filePath);
                        deletedCount++;
                    }
                }
            }
            terminal_ui_1.CliUI.logInfo(`Cleaned ${deletedCount} old backup files`);
            return deletedCount;
        }
        catch (error) {
            terminal_ui_1.CliUI.logWarning(`Failed to clean backups: ${error.message}`);
            return 0;
        }
    }
}
exports.WriteFileTool = WriteFileTool;
