"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeContextSchema = exports.LSPDiagnosticSchema = exports.FileSearchResultSchema = exports.FileSearchOptionsSchema = exports.MultiEditResultSchema = exports.MultiEditOptionsSchema = exports.EditOperationSchema = exports.CommandResultSchema = exports.CommandOptionsSchema = exports.ReadFileResultSchema = exports.ReadFileOptionsSchema = exports.VerificationResultSchema = exports.FileWriteSchema = exports.WriteMultipleResultSchema = exports.AppendOptionsSchema = exports.WriteFileResultSchema = exports.WriteFileOptionsSchema = exports.ToolExecutionResultSchema = exports.ValidationResultSchema = void 0;
const zod_1 = require("zod");
exports.ValidationResultSchema = zod_1.z.object({
    isValid: zod_1.z.boolean(),
    errors: zod_1.z.array(zod_1.z.string()),
    warnings: zod_1.z.array(zod_1.z.string()).optional()
});
exports.ToolExecutionResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.any().optional(),
    error: zod_1.z.string().optional(),
    metadata: zod_1.z.object({
        executionTime: zod_1.z.number().min(0),
        toolName: zod_1.z.string(),
        parameters: zod_1.z.record(zod_1.z.any()).optional()
    }).optional()
});
exports.WriteFileOptionsSchema = zod_1.z.object({
    encoding: zod_1.z.string().optional(),
    mode: zod_1.z.number().int().optional(),
    createBackup: zod_1.z.boolean().optional(),
    autoRollback: zod_1.z.boolean().optional(),
    verifyWrite: zod_1.z.boolean().optional(),
    stopOnFirstError: zod_1.z.boolean().optional(),
    rollbackOnPartialFailure: zod_1.z.boolean().optional(),
    showDiff: zod_1.z.boolean().optional(),
    validators: zod_1.z.array(zod_1.z.function().returns(zod_1.z.promise(exports.ValidationResultSchema))).optional(),
    transformers: zod_1.z.array(zod_1.z.function().returns(zod_1.z.promise(zod_1.z.string()))).optional()
});
exports.WriteFileResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    filePath: zod_1.z.string(),
    bytesWritten: zod_1.z.number().int().min(0),
    backupPath: zod_1.z.string().optional(),
    duration: zod_1.z.number().min(0),
    error: zod_1.z.string().optional(),
    metadata: zod_1.z.object({
        encoding: zod_1.z.string(),
        lines: zod_1.z.number().int().min(0),
        created: zod_1.z.boolean(),
        mode: zod_1.z.number().int()
    })
});
exports.AppendOptionsSchema = zod_1.z.object({
    encoding: zod_1.z.string().optional(),
    separator: zod_1.z.string().optional(),
    createBackup: zod_1.z.boolean().optional(),
    verifyWrite: zod_1.z.boolean().optional()
});
exports.WriteMultipleResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    results: zod_1.z.array(exports.WriteFileResultSchema),
    successCount: zod_1.z.number().int().min(0),
    totalFiles: zod_1.z.number().int().min(0),
    backupPaths: zod_1.z.array(zod_1.z.string()),
    error: zod_1.z.string().optional()
});
exports.FileWriteSchema = zod_1.z.object({
    path: zod_1.z.string().min(1),
    content: zod_1.z.string()
});
exports.VerificationResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    error: zod_1.z.string().optional()
});
exports.ReadFileOptionsSchema = zod_1.z.object({
    encoding: zod_1.z.string().optional(),
    maxSize: zod_1.z.number().int().min(1).optional(),
    maxLines: zod_1.z.number().int().min(1).optional(),
    stripComments: zod_1.z.boolean().optional(),
    parseJson: zod_1.z.boolean().optional()
});
exports.ReadFileResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    filePath: zod_1.z.string(),
    content: zod_1.z.union([zod_1.z.string(), zod_1.z.instanceof(Buffer)]),
    size: zod_1.z.number().int().min(0),
    encoding: zod_1.z.string(),
    error: zod_1.z.string().optional(),
    metadata: zod_1.z.object({
        lines: zod_1.z.number().int().min(0).optional(),
        isEmpty: zod_1.z.boolean(),
        isBinary: zod_1.z.boolean(),
        extension: zod_1.z.string()
    })
});
exports.CommandOptionsSchema = zod_1.z.object({
    cwd: zod_1.z.string().optional(),
    timeout: zod_1.z.number().int().min(100).optional(),
    skipConfirmation: zod_1.z.boolean().optional(),
    env: zod_1.z.record(zod_1.z.string()).optional(),
    shell: zod_1.z.string().optional()
});
exports.CommandResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    stdout: zod_1.z.string(),
    stderr: zod_1.z.string(),
    exitCode: zod_1.z.number().int(),
    command: zod_1.z.string(),
    duration: zod_1.z.number().min(0),
    workingDirectory: zod_1.z.string()
});
exports.EditOperationSchema = zod_1.z.object({
    oldString: zod_1.z.string().min(1),
    newString: zod_1.z.string(),
    replaceAll: zod_1.z.boolean().optional()
});
exports.MultiEditOptionsSchema = zod_1.z.object({
    createBackup: zod_1.z.boolean().optional(),
    showDiff: zod_1.z.boolean().optional(),
    validateSyntax: zod_1.z.boolean().optional(),
    autoFormat: zod_1.z.boolean().optional()
});
exports.MultiEditResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    filePath: zod_1.z.string(),
    operationsApplied: zod_1.z.number().int().min(0),
    backupPath: zod_1.z.string().optional(),
    linesChanged: zod_1.z.number().int().min(0),
    errors: zod_1.z.array(zod_1.z.string()).optional()
});
exports.FileSearchOptionsSchema = zod_1.z.object({
    maxResults: zod_1.z.number().int().min(1).max(1000).optional(),
    includeHidden: zod_1.z.boolean().optional(),
    extensions: zod_1.z.array(zod_1.z.string()).optional(),
    excludePatterns: zod_1.z.array(zod_1.z.string()).optional(),
    caseSensitive: zod_1.z.boolean().optional()
});
exports.FileSearchResultSchema = zod_1.z.object({
    files: zod_1.z.array(zod_1.z.object({
        path: zod_1.z.string(),
        name: zod_1.z.string(),
        size: zod_1.z.number().int().min(0),
        modified: zod_1.z.date(),
        type: zod_1.z.enum(['file', 'directory', 'symlink']),
        extension: zod_1.z.string().optional()
    })),
    totalFound: zod_1.z.number().int().min(0),
    searchTime: zod_1.z.number().min(0)
});
exports.LSPDiagnosticSchema = zod_1.z.object({
    range: zod_1.z.object({
        start: zod_1.z.object({
            line: zod_1.z.number().int().min(0),
            character: zod_1.z.number().int().min(0)
        }),
        end: zod_1.z.object({
            line: zod_1.z.number().int().min(0),
            character: zod_1.z.number().int().min(0)
        })
    }),
    severity: zod_1.z.number().int().min(1).max(4),
    message: zod_1.z.string().min(1),
    source: zod_1.z.string().optional(),
    code: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional()
});
exports.CodeContextSchema = zod_1.z.object({
    file: zod_1.z.string(),
    language: zod_1.z.string(),
    symbols: zod_1.z.array(zod_1.z.any()),
    diagnostics: zod_1.z.array(exports.LSPDiagnosticSchema),
    hover: zod_1.z.any().optional(),
    definitions: zod_1.z.array(zod_1.z.any()).optional(),
    references: zod_1.z.array(zod_1.z.any()).optional(),
    workspaceRoot: zod_1.z.string()
});
