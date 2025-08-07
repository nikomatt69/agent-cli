import { writeFile, mkdir, copyFile, unlink } from 'fs/promises';
import { dirname, join } from 'path';
import { BaseTool, ToolExecutionResult } from './base-tool';
import { sanitizePath } from './secure-file-tools';
import { CliUI } from '../utils/cli-ui';

/**
 * Production-ready Write File Tool
 * Safely writes files with backup, validation, and rollback capabilities
 */
export class WriteFileTool extends BaseTool {
    private backupDirectory: string;

    constructor(workingDirectory: string) {
        super('write-file-tool', workingDirectory);
        this.backupDirectory = join(workingDirectory, '.ai-backups');
    }

    async execute(filePath: string, content: string, options: WriteFileOptions = {}): Promise<ToolExecutionResult> {
        const startTime = Date.now();
        let backupPath: string | undefined;

        try {
            // Sanitize and validate file path
            const sanitizedPath = sanitizePath(filePath, this.workingDirectory);

            // Validate content if validators are provided
            if (options.validators) {
                for (const validator of options.validators) {
                    const validation = await validator(content, sanitizedPath);
                    if (!validation.isValid) {
                        throw new Error(`Content validation failed: ${validation.errors.join(', ')}`);
                    }
                }
            }

            // Create backup if file exists and backup is enabled
            if (options.createBackup !== false) {
                backupPath = await this.createBackup(sanitizedPath);
            }

            // Ensure directory exists
            const dir = dirname(sanitizedPath);
            await mkdir(dir, { recursive: true });

            // Apply content transformations
            let processedContent = content;
            if (options.transformers) {
                for (const transformer of options.transformers) {
                    processedContent = await transformer(processedContent, sanitizedPath);
                }
            }

            // Write file with specified encoding
            const encoding = options.encoding || 'utf8';
            await writeFile(sanitizedPath, processedContent, {
                encoding: encoding as BufferEncoding,
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
            const writeFileResult: WriteFileResult = {
                success: true,
                filePath: sanitizedPath,
                bytesWritten: Buffer.byteLength(processedContent, encoding as BufferEncoding),
                backupPath,
                duration,
                metadata: {
                    encoding,
                    lines: processedContent.split('\n').length,
                    created: !backupPath, // New file if no backup was created
                    mode: options.mode || 0o644
                }
            };

            CliUI.logSuccess(`File written: ${filePath} (${writeFileResult.bytesWritten} bytes)`);
            return {
                success: true,
                data: writeFileResult,
                metadata: {
                    executionTime: duration,
                    toolName: this.name,
                    parameters: { filePath, contentLength: content.length, options }
                }
            };

        } catch (error: any) {
            // Rollback if backup exists
            if (backupPath && options.autoRollback !== false) {
                try {
                    await this.rollback(filePath, backupPath);
                    CliUI.logInfo('Rolled back to backup due to error');
                } catch (rollbackError: any) {
                    CliUI.logWarning(`Rollback failed: ${rollbackError.message}`);
                }
            }

            const duration = Date.now() - startTime;
            const errorResult: WriteFileResult = {
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

            CliUI.logError(`Failed to write file ${filePath}: ${error.message}`);
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
    async writeMultiple(files: FileWrite[], options: WriteFileOptions = {}): Promise<WriteMultipleResult> {
        const results: WriteFileResult[] = [];
        const backups: string[] = [];
        let successCount = 0;

        try {
            // Phase 1: Create backups for all existing files
            for (const file of files) {
                const sanitizedPath = sanitizePath(file.path, this.workingDirectory);
                if (options.createBackup !== false) {
                    try {
                        const backupPath = await this.createBackup(sanitizedPath);
                        if (backupPath) backups.push(backupPath);
                    } catch {
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
                const result = toolResult.data as WriteFileResult;
                results.push(result);

                if (result.success) {
                    successCount++;
                } else if (options.stopOnFirstError) {
                    break;
                }
            }

            // Phase 3: Handle partial failures
            if (successCount < files.length && options.rollbackOnPartialFailure) {
                await this.rollbackMultiple(backups);
                CliUI.logWarning('Rolled back all changes due to partial failure');
            }

            return {
                success: successCount === files.length,
                results,
                successCount,
                totalFiles: files.length,
                backupPaths: backups
            };

        } catch (error: any) {
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
    async append(filePath: string, content: string, options: AppendOptions = {}): Promise<WriteFileResult> {
        try {
            const sanitizedPath = sanitizePath(filePath, this.workingDirectory);

            // Read existing content if file exists
            let existingContent = '';
            try {
                const fs = await import('fs/promises');
                existingContent = await fs.readFile(sanitizedPath, 'utf8');
            } catch {
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
            return toolResult.data as WriteFileResult;

        } catch (error: any) {
            throw new Error(`Failed to append to file: ${error.message}`);
        }
    }

    /**
     * Create a backup of an existing file
     */
    private async createBackup(filePath: string): Promise<string | undefined> {
        try {
            const fs = await import('fs/promises');
            await fs.access(filePath); // Check if file exists

            // Ensure backup directory exists
            await mkdir(this.backupDirectory, { recursive: true });

            // Generate backup filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = filePath.replace(this.workingDirectory, '').replace(/^\//, '');
            const backupPath = join(this.backupDirectory, `${fileName}.${timestamp}.backup`);

            // Ensure backup subdirectories exist
            await mkdir(dirname(backupPath), { recursive: true });

            // Copy file to backup location
            await copyFile(filePath, backupPath);

            CliUI.logInfo(`Backup created: ${backupPath}`);
            return backupPath;

        } catch {
            // File doesn't exist or can't be backed up
            return undefined;
        }
    }

    /**
     * Rollback a file from backup
     */
    private async rollback(filePath: string, backupPath: string): Promise<void> {
        try {
            const sanitizedPath = sanitizePath(filePath, this.workingDirectory);
            await copyFile(backupPath, sanitizedPath);
            await unlink(backupPath); // Clean up backup
        } catch (error: any) {
            throw new Error(`Rollback failed: ${error.message}`);
        }
    }

    /**
     * Rollback multiple files from backups
     */
    private async rollbackMultiple(backupPaths: string[]): Promise<void> {
        for (const backupPath of backupPaths) {
            try {
                // Extract original path from backup path
                const originalPath = backupPath
                    .replace(this.backupDirectory, this.workingDirectory)
                    .replace(/\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.backup$/, '');

                await this.rollback(originalPath, backupPath);
            } catch (error: any) {
                CliUI.logWarning(`Failed to rollback ${backupPath}: ${error.message}`);
            }
        }
    }

    /**
     * Verify that file was written correctly
     */
    private async verifyWrite(filePath: string, expectedContent: string, encoding: string): Promise<VerificationResult> {
        try {
            const fs = await import('fs/promises');
            const actualContent = await fs.readFile(filePath, encoding as BufferEncoding);

            if (actualContent === expectedContent) {
                return { success: true };
            } else {
                return {
                    success: false,
                    error: 'Content mismatch after write'
                };
            }
        } catch (error: any) {
            return {
                success: false,
                error: `Verification read failed: ${error.message}`
            };
        }
    }

    /**
     * Clean old backups
     */
    async cleanBackups(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
        try {
            const fs = await import('fs/promises');
            const files = await fs.readdir(this.backupDirectory, { recursive: true });
            const now = Date.now();
            let deletedCount = 0;

            for (const file of files) {
                if (typeof file === 'string' && file.endsWith('.backup')) {
                    const filePath = join(this.backupDirectory, file);
                    const stats = await fs.stat(filePath);

                    if (now - stats.mtime.getTime() > maxAge) {
                        await unlink(filePath);
                        deletedCount++;
                    }
                }
            }

            CliUI.logInfo(`Cleaned ${deletedCount} old backup files`);
            return deletedCount;

        } catch (error: any) {
            CliUI.logWarning(`Failed to clean backups: ${error.message}`);
            return 0;
        }
    }
}

export interface WriteFileOptions {
    encoding?: string;
    mode?: number;
    createBackup?: boolean;
    autoRollback?: boolean;
    verifyWrite?: boolean;
    stopOnFirstError?: boolean;
    rollbackOnPartialFailure?: boolean;
    validators?: ContentValidator[];
    transformers?: ContentTransformer[];
}

export interface AppendOptions {
    encoding?: string;
    separator?: string;
    createBackup?: boolean;
    verifyWrite?: boolean;
}

export interface WriteFileResult {
    success: boolean;
    filePath: string;
    bytesWritten: number;
    backupPath?: string;
    duration: number;
    error?: string;
    metadata: {
        encoding: string;
        lines: number;
        created: boolean;
        mode: number;
    };
}

export interface WriteMultipleResult {
    success: boolean;
    results: WriteFileResult[];
    successCount: number;
    totalFiles: number;
    backupPaths: string[];
    error?: string;
}

export interface FileWrite {
    path: string;
    content: string;
}

export interface VerificationResult {
    success: boolean;
    error?: string;
}

export type ContentValidator = (content: string, filePath: string) => Promise<ValidationResult>;
export type ContentTransformer = (content: string, filePath: string) => Promise<string>;

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
}
