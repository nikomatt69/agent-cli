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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentValidators = exports.WriteFileTool = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const base_tool_1 = require("./base-tool");
const secure_file_tools_1 = require("./secure-file-tools");
const cli_ui_1 = require("../utils/cli-ui");
const diff_viewer_1 = require("../ui/diff-viewer");
const diff_manager_1 = require("../ui/diff-manager");
class WriteFileTool extends base_tool_1.BaseTool {
    constructor(workingDirectory) {
        super('write-file-tool', workingDirectory);
        this.backupDirectory = (0, path_1.join)(workingDirectory, '.ai-backups');
    }
    async execute(filePath, content, options = {}) {
        const startTime = Date.now();
        let backupPath;
        try {
            const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
            if (options.validators) {
                for (const validator of options.validators) {
                    const validation = await validator(content, sanitizedPath);
                    if (!validation.isValid) {
                        throw new Error(`Content validation failed: ${validation.errors.join(', ')}`);
                    }
                }
            }
            let existingContent = '';
            let isNewFile = false;
            try {
                existingContent = await (0, promises_1.readFile)(sanitizedPath, 'utf8');
            }
            catch (error) {
                isNewFile = true;
            }
            if (options.createBackup !== false) {
                backupPath = await this.createBackup(sanitizedPath);
            }
            const dir = (0, path_1.dirname)(sanitizedPath);
            await (0, promises_1.mkdir)(dir, { recursive: true });
            let processedContent = content;
            if (options.transformers) {
                for (const transformer of options.transformers) {
                    processedContent = await transformer(processedContent, sanitizedPath);
                }
            }
            if (options.showDiff !== false && !isNewFile && existingContent !== processedContent) {
                const fileDiff = {
                    filePath: sanitizedPath,
                    originalContent: existingContent,
                    newContent: processedContent,
                    isNew: false,
                    isDeleted: false
                };
                console.log('\n');
                diff_viewer_1.DiffViewer.showFileDiff(fileDiff, { compact: true });
                diff_manager_1.diffManager.addFileDiff(sanitizedPath, existingContent, processedContent);
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
                diff_viewer_1.DiffViewer.showFileDiff(fileDiff, { compact: true });
            }
            const encoding = options.encoding || 'utf8';
            await (0, promises_1.writeFile)(sanitizedPath, processedContent, {
                encoding: encoding,
                mode: options.mode || 0o644
            });
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
                    created: !backupPath,
                    mode: options.mode || 0o644
                }
            };
            const relativePath = sanitizedPath.replace(this.workingDirectory, '').replace(/^\//, '') || sanitizedPath;
            cli_ui_1.CliUI.logSuccess(`File written: ${relativePath} (${writeFileResult.bytesWritten} bytes)`);
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
            if (backupPath && options.autoRollback !== false) {
                try {
                    await this.rollback(filePath, backupPath);
                    cli_ui_1.CliUI.logInfo('Rolled back to backup due to error');
                }
                catch (rollbackError) {
                    cli_ui_1.CliUI.logWarning(`Rollback failed: ${rollbackError.message}`);
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
            const relativePath = filePath.replace(this.workingDirectory, '').replace(/^\//, '') || filePath;
            cli_ui_1.CliUI.logError(`Failed to write file ${relativePath}: ${error.message}`);
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
    async writeMultiple(files, options = {}) {
        const results = [];
        const backups = [];
        let successCount = 0;
        try {
            for (const file of files) {
                const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(file.path, this.workingDirectory);
                if (options.createBackup !== false) {
                    try {
                        const backupPath = await this.createBackup(sanitizedPath);
                        if (backupPath)
                            backups.push(backupPath);
                    }
                    catch {
                    }
                }
            }
            for (const file of files) {
                const toolResult = await this.execute(file.path, file.content, {
                    ...options,
                    createBackup: false
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
            if (successCount < files.length && options.rollbackOnPartialFailure) {
                await this.rollbackMultiple(backups);
                cli_ui_1.CliUI.logWarning('Rolled back all changes due to partial failure');
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
    async append(filePath, content, options = {}) {
        try {
            const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
            let existingContent = '';
            try {
                const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
                existingContent = await fs.readFile(sanitizedPath, 'utf8');
            }
            catch {
            }
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
    async createBackup(filePath) {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            await fs.access(filePath);
            await (0, promises_1.mkdir)(this.backupDirectory, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = filePath.replace(this.workingDirectory, '').replace(/^\//, '');
            const backupPath = (0, path_1.join)(this.backupDirectory, `${fileName}.${timestamp}.backup`);
            await (0, promises_1.mkdir)((0, path_1.dirname)(backupPath), { recursive: true });
            await (0, promises_1.copyFile)(filePath, backupPath);
            cli_ui_1.CliUI.logInfo(`Backup created: ${backupPath}`);
            return backupPath;
        }
        catch {
            return undefined;
        }
    }
    async rollback(filePath, backupPath) {
        try {
            const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
            await (0, promises_1.copyFile)(backupPath, sanitizedPath);
            await (0, promises_1.unlink)(backupPath);
        }
        catch (error) {
            throw new Error(`Rollback failed: ${error.message}`);
        }
    }
    async rollbackMultiple(backupPaths) {
        for (const backupPath of backupPaths) {
            try {
                const originalPath = backupPath
                    .replace(this.backupDirectory, this.workingDirectory)
                    .replace(/\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.backup$/, '');
                await this.rollback(originalPath, backupPath);
            }
            catch (error) {
                cli_ui_1.CliUI.logWarning(`Failed to rollback ${backupPath}: ${error.message}`);
            }
        }
    }
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
            cli_ui_1.CliUI.logInfo(`Cleaned ${deletedCount} old backup files`);
            return deletedCount;
        }
        catch (error) {
            cli_ui_1.CliUI.logWarning(`Failed to clean backups: ${error.message}`);
            return 0;
        }
    }
}
exports.WriteFileTool = WriteFileTool;
class ContentValidators {
}
exports.ContentValidators = ContentValidators;
_a = ContentValidators;
ContentValidators.noAbsolutePaths = async (content, _filePath) => {
    const errors = [];
    const warnings = [];
    const absolutePathRegex = /(?:import|require|from)\s+['"`]([^'"`]*\/Users\/[^'"`]*|[^'"`]*\/home\/[^'"`]*|[^'"`]*C:\\[^'"`]*)/g;
    const matches = content.match(absolutePathRegex);
    if (matches) {
        errors.push(`Found absolute paths in imports: ${matches.join(', ')}`);
    }
    const generalAbsoluteRegex = /(\/Users\/\w+|\/home\/\w+|C:\\[^\\]*\\)/g;
    const generalMatches = content.match(generalAbsoluteRegex);
    if (generalMatches) {
        const uniquePaths = [...new Set(generalMatches)];
        warnings.push(`Consider using relative paths instead of: ${uniquePaths.join(', ')}`);
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};
ContentValidators.noLatestVersions = async (content, filePath) => {
    const errors = [];
    const warnings = [];
    if (filePath.endsWith('package.json')) {
        try {
            const packageObj = JSON.parse(content);
            const checkDependencies = (deps, section) => {
                if (deps) {
                    Object.entries(deps).forEach(([name, version]) => {
                        if (version === 'latest') {
                            warnings.push(`${section}.${name} uses "latest" - consider pinning to specific version`);
                        }
                    });
                }
            };
            checkDependencies(packageObj.dependencies, 'dependencies');
            checkDependencies(packageObj.devDependencies, 'devDependencies');
            checkDependencies(packageObj.peerDependencies, 'peerDependencies');
        }
        catch (parseError) {
            warnings.push('Could not parse package.json to validate versions');
        }
    }
    return {
        isValid: true,
        errors,
        warnings
    };
};
ContentValidators.codeQuality = async (content, filePath) => {
    const errors = [];
    const warnings = [];
    if (filePath.match(/\.(ts|tsx|js|jsx)$/)) {
        if (content.includes('console.log(') && !filePath.includes('test')) {
            warnings.push('Consider using proper logging instead of console.log');
        }
        if (filePath.endsWith('index.ts') || filePath.endsWith('index.js')) {
            if (!content.includes('export') && content.trim().length > 0) {
                warnings.push('Index file should typically export something');
            }
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};
