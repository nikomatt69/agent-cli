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
exports.FileInfoSchema = exports.ReadFileTool = void 0;
const promises_1 = require("fs/promises");
const base_tool_1 = require("./base-tool");
const secure_file_tools_1 = require("./secure-file-tools");
const cli_ui_1 = require("../utils/cli-ui");
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
const lsp_manager_1 = require("../lsp/lsp-manager");
const context_aware_rag_1 = require("../context/context-aware-rag");
const zod_1 = require("zod");
const tool_schemas_1 = require("../schemas/tool-schemas");
class ReadFileTool extends base_tool_1.BaseTool {
    constructor(workingDirectory) {
        super('read-file-tool', workingDirectory);
        this.contextSystem = new context_aware_rag_1.ContextAwareRAGSystem(workingDirectory);
    }
    async execute(filePath, options = {}) {
        const startTime = Date.now();
        try {
            const result = await this.executeInternal(filePath, options);
            return {
                success: result.success,
                data: result,
                metadata: {
                    executionTime: Date.now() - startTime,
                    toolName: this.name,
                    parameters: { filePath, options }
                }
            };
        }
        catch (error) {
            return {
                success: false,
                data: null,
                error: error.message,
                metadata: {
                    executionTime: Date.now() - startTime,
                    toolName: this.name,
                    parameters: { filePath, options }
                }
            };
        }
    }
    async executeInternal(filePath, options = {}) {
        try {
            const validatedOptions = tool_schemas_1.ReadFileOptionsSchema.parse(options);
            if (typeof filePath !== 'string' || filePath.trim().length === 0) {
                throw new Error('filePath must be a non-empty string');
            }
            const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
            if (validatedOptions.maxSize) {
                const stats = await Promise.resolve().then(() => __importStar(require('fs/promises'))).then(fs => fs.stat(sanitizedPath));
                if (stats.size > validatedOptions.maxSize) {
                    throw new Error(`File too large: ${stats.size} bytes (max: ${validatedOptions.maxSize})`);
                }
            }
            const encoding = validatedOptions.encoding || 'utf8';
            const content = await (0, promises_1.readFile)(sanitizedPath, encoding);
            await this.performLSPContextAnalysis(sanitizedPath, content);
            let processedContent = content;
            if (validatedOptions.stripComments && this.isCodeFile(filePath)) {
                processedContent = this.stripComments(processedContent, this.getFileExtension(filePath));
            }
            if (validatedOptions.maxLines && typeof processedContent === 'string') {
                const lines = processedContent.split('\n');
                if (lines.length > validatedOptions.maxLines) {
                    processedContent = lines.slice(0, validatedOptions.maxLines).join('\n') +
                        `\n... (truncated ${lines.length - validatedOptions.maxLines} lines)`;
                }
            }
            const result = {
                success: true,
                filePath: sanitizedPath,
                content: processedContent,
                size: Buffer.byteLength(content, encoding),
                encoding,
                metadata: {
                    lines: typeof processedContent === 'string' ? processedContent.split('\n').length : undefined,
                    isEmpty: content.length === 0,
                    isBinary: encoding !== 'utf8' && encoding !== 'utf-8',
                    extension: this.getFileExtension(filePath)
                }
            };
            const validatedResult = tool_schemas_1.ReadFileResultSchema.parse(result);
            if (!validatedResult.metadata?.isBinary && typeof processedContent === 'string' && processedContent.length < 50000) {
                advanced_cli_ui_1.advancedUI.showFileContent(sanitizedPath, processedContent);
            }
            return validatedResult;
        }
        catch (error) {
            const errorResult = {
                success: false,
                filePath,
                content: '',
                size: 0,
                encoding: options.encoding || 'utf8',
                error: error.message,
                metadata: {
                    isEmpty: true,
                    isBinary: false,
                    extension: this.getFileExtension(filePath)
                }
            };
            cli_ui_1.CliUI.logError(`Failed to read file ${filePath}: ${error.message}`);
            return errorResult;
        }
    }
    async readMultiple(filePaths, options = {}) {
        const readPromises = filePaths.map(path => this.execute(path, options));
        return (await Promise.all(readPromises)).map(result => result.data);
    }
    async readStream(filePath, chunkSize = 1024 * 64) {
        const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        const stream = fs.createReadStream(sanitizedPath, {
            encoding: 'utf8',
            highWaterMark: chunkSize
        });
        return {
            async *[Symbol.asyncIterator]() {
                for await (const chunk of stream) {
                    yield chunk;
                }
            }
        };
    }
    async canRead(filePath) {
        try {
            const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            await fs.access(sanitizedPath, fs.constants.R_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    async getFileInfo(filePath) {
        try {
            const sanitizedPath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const stats = await fs.stat(sanitizedPath);
            return {
                path: sanitizedPath,
                size: stats.size,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime,
                extension: this.getFileExtension(filePath),
                isReadable: await this.canRead(filePath)
            };
        }
        catch (error) {
            throw new Error(`Failed to get file info: ${error.message}`);
        }
    }
    stripComments(content, extension) {
        switch (extension.toLowerCase()) {
            case '.js':
            case '.ts':
            case '.jsx':
            case '.tsx':
                content = content.replace(/\/\/.*$/gm, '');
                content = content.replace(/\/\*[\s\S]*?\*\//g, '');
                break;
            case '.py':
                content = content.replace(/#.*$/gm, '');
                break;
            case '.css':
            case '.scss':
                content = content.replace(/\/\*[\s\S]*?\*\//g, '');
                break;
            case '.html':
            case '.xml':
                let previousContent;
                do {
                    previousContent = content;
                    content = content.replace(/<!--[\s\S]*?-->/g, '');
                } while (content !== previousContent);
                break;
        }
        return content.replace(/\n\s*\n/g, '\n').trim();
    }
    isCodeFile(filePath) {
        const codeExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
            '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.clj',
            '.css', '.scss', '.sass', '.less', '.html', '.xml', '.json', '.yaml', '.yml'
        ];
        const extension = this.getFileExtension(filePath);
        return codeExtensions.includes(extension.toLowerCase());
    }
    getFileExtension(filePath) {
        const lastDot = filePath.lastIndexOf('.');
        return lastDot >= 0 ? filePath.substring(lastDot) : '';
    }
    async performLSPContextAnalysis(filePath, content) {
        try {
            const lspContext = await lsp_manager_1.lspManager.analyzeFile(filePath);
            if (lspContext.diagnostics.length > 0) {
                const errors = lspContext.diagnostics.filter(d => d.severity === 1);
                const warnings = lspContext.diagnostics.filter(d => d.severity === 2);
                if (errors.length > 0) {
                    cli_ui_1.CliUI.logInfo(`LSP analysis: ${errors.length} errors in ${filePath}`);
                }
                if (warnings.length > 0) {
                    cli_ui_1.CliUI.logInfo(`LSP analysis: ${warnings.length} warnings in ${filePath}`);
                }
            }
            this.contextSystem.recordInteraction(`Reading file: ${filePath}`, `File read operation with LSP analysis`, [{
                    type: 'read_file',
                    target: filePath,
                    params: { contentLength: content.length },
                    result: 'success',
                    duration: 0
                }]);
            await this.contextSystem.analyzeFile(filePath);
        }
        catch (error) {
            cli_ui_1.CliUI.logWarning(`LSP/Context analysis failed for ${filePath}: ${error.message}`);
        }
    }
}
exports.ReadFileTool = ReadFileTool;
exports.FileInfoSchema = zod_1.z.object({
    path: zod_1.z.string(),
    size: zod_1.z.number().int().min(0),
    isFile: zod_1.z.boolean(),
    isDirectory: zod_1.z.boolean(),
    created: zod_1.z.date(),
    modified: zod_1.z.date(),
    accessed: zod_1.z.date(),
    extension: zod_1.z.string(),
    isReadable: zod_1.z.boolean()
});
