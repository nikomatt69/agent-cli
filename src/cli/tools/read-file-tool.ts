import { readFile } from 'fs/promises';
import { BaseTool, ToolExecutionResult } from './base-tool';
import { sanitizePath } from './secure-file-tools';
import { CliUI } from '../utils/cli-ui';
import { advancedUI } from '../ui/advanced-cli-ui';

/**
 * Production-ready Read File Tool
 * Safely reads file contents with security checks and error handling
 */
export class ReadFileTool extends BaseTool {
    constructor(workingDirectory: string) {
        super('read-file-tool', workingDirectory);
    }

    async execute(filePath: string, options: ReadFileOptions = {}): Promise<ToolExecutionResult> {
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
        } catch (error: any) {
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

    private async executeInternal(filePath: string, options: ReadFileOptions = {}): Promise<ReadFileResult> {
        try {
            // Sanitize and validate file path
            const sanitizedPath = sanitizePath(filePath, this.workingDirectory);

            // Check file size if maxSize is specified
            if (options.maxSize) {
                const stats = await import('fs/promises').then(fs => fs.stat(sanitizedPath));
                if (stats.size > options.maxSize) {
                    throw new Error(`File too large: ${stats.size} bytes (max: ${options.maxSize})`);
                }
            }

            // Read file with specified encoding
            const encoding = options.encoding || 'utf8';
            const content = await readFile(sanitizedPath, encoding as BufferEncoding);

            // Apply content filters if specified
            let processedContent = content;
            if (options.stripComments && this.isCodeFile(filePath)) {
                processedContent = this.stripComments(processedContent, this.getFileExtension(filePath));
            }

            if (options.maxLines && typeof processedContent === 'string') {
                const lines = processedContent.split('\n');
                if (lines.length > options.maxLines) {
                    processedContent = lines.slice(0, options.maxLines).join('\n') +
                        `\n... (truncated ${lines.length - options.maxLines} lines)`;
                }
            }

            const result: ReadFileResult = {
                success: true,
                filePath: sanitizedPath,
                content: processedContent,
                size: Buffer.byteLength(content, encoding as BufferEncoding),
                encoding,
                metadata: {
                    lines: typeof processedContent === 'string' ? processedContent.split('\n').length : undefined,
                    isEmpty: content.length === 0,
                    isBinary: encoding !== 'utf8' && encoding !== 'utf-8',
                    extension: this.getFileExtension(filePath)
                }
            };

            // Show file content in structured UI if not binary and not too large
            if (!result.metadata?.isBinary && typeof processedContent === 'string' && processedContent.length < 50000) {
                advancedUI.showFileContent(sanitizedPath, processedContent);
            }

            return result;

        } catch (error: any) {
            const errorResult: ReadFileResult = {
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

            // Log error for debugging
            CliUI.logError(`Failed to read file ${filePath}: ${error.message}`);

            return errorResult;
        }
    }

    /**
     * Read multiple files in parallel
     */
    async readMultiple(filePaths: string[], options: ReadFileOptions = {}): Promise<ReadFileResult[]> {
        const readPromises = filePaths.map(path => this.execute(path, options));
        return (await Promise.all(readPromises)).map(result => result.data);
    }

    /**
     * Read file with streaming for large files
     */
    async readStream(filePath: string, chunkSize: number = 1024 * 64): Promise<AsyncIterable<string>> {
        const sanitizedPath = sanitizePath(filePath, this.workingDirectory);
        const fs = await import('fs');
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

    /**
     * Check if file exists and is readable
     */
    async canRead(filePath: string): Promise<boolean> {
        try {
            const sanitizedPath = sanitizePath(filePath, this.workingDirectory);
            const fs = await import('fs/promises');
            await fs.access(sanitizedPath, fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file information without reading content
     */
    async getFileInfo(filePath: string): Promise<FileInfo> {
        try {
            const sanitizedPath = sanitizePath(filePath, this.workingDirectory);
            const fs = await import('fs/promises');
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
        } catch (error: any) {
            throw new Error(`Failed to get file info: ${error.message}`);
        }
    }

    /**
     * Strip comments from code files
     */
    private stripComments(content: string, extension: string): string {
        switch (extension.toLowerCase()) {
            case '.js':
            case '.ts':
            case '.jsx':
            case '.tsx':
                // Remove single-line comments
                content = content.replace(/\/\/.*$/gm, '');
                // Remove multi-line comments
                content = content.replace(/\/\*[\s\S]*?\*\//g, '');
                break;
            case '.py':
                // Remove Python comments
                content = content.replace(/#.*$/gm, '');
                break;
            case '.css':
            case '.scss':
                // Remove CSS comments
                content = content.replace(/\/\*[\s\S]*?\*\//g, '');
                break;
            case '.html':
            case '.xml':
                // Remove HTML/XML comments with complete sanitization
                let previousContent;
                do {
                    previousContent = content;
                    content = content.replace(/<!--[\s\S]*?-->/g, '');
                } while (content !== previousContent);
                break;
        }

        // Clean up extra whitespace
        return content.replace(/\n\s*\n/g, '\n').trim();
    }

    /**
     * Check if file is a code file based on extension
     */
    private isCodeFile(filePath: string): boolean {
        const codeExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
            '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.clj',
            '.css', '.scss', '.sass', '.less', '.html', '.xml', '.json', '.yaml', '.yml'
        ];

        const extension = this.getFileExtension(filePath);
        return codeExtensions.includes(extension.toLowerCase());
    }

    /**
     * Get file extension
     */
    private getFileExtension(filePath: string): string {
        const lastDot = filePath.lastIndexOf('.');
        return lastDot >= 0 ? filePath.substring(lastDot) : '';
    }
}

export interface ReadFileOptions {
    encoding?: string;
    maxSize?: number; // Maximum file size in bytes
    maxLines?: number; // Maximum number of lines to read
    stripComments?: boolean; // Remove comments from code files
}

export interface ReadFileResult {
    success: boolean;
    filePath: string;
    content: string | Buffer;
    size: number;
    encoding: string;
    error?: string;
    metadata: {
        lines?: number;
        isEmpty: boolean;
        isBinary: boolean;
        extension: string;
    };
}

export interface FileInfo {
    path: string;
    size: number;
    isFile: boolean;
    isDirectory: boolean;
    created: Date;
    modified: Date;
    accessed: Date;
    extension: string;
    isReadable: boolean;
}
