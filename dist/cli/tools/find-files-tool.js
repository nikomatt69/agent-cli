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
exports.FindFilesTool = void 0;
const globby_1 = require("globby");
const base_tool_1 = require("./base-tool");
const logger_1 = require("../utils/logger");
const secure_file_tools_1 = require("./secure-file-tools");
class FindFilesTool extends base_tool_1.BaseTool {
    constructor(workingDirectory) {
        super('find-files-tool', workingDirectory);
    }
    async execute(pattern, options = {}) {
        const startTime = Date.now();
        try {
            const sanitizedCwd = (0, secure_file_tools_1.sanitizePath)(options.cwd || '.', this.workingDirectory);
            const files = await (0, globby_1.globby)(pattern, { cwd: sanitizedCwd, onlyFiles: true });
            // Show file list in structured UI (optional; safe in headless envs)
            if (files.length > 0 &&
                typeof process !== 'undefined' &&
                process.stdout &&
                process.stdout.isTTY) {
                try {
                    // Lazy import to avoid bundling/UI dependency in non-interactive flows
                    const { advancedUI } = await Promise.resolve().then(() => __importStar(require('../ui/advanced-cli-ui')));
                    advancedUI.showFileList(files, `🔍 Find: ${pattern}`);
                }
                catch (error) {
                    // Non-fatal: swallow UI errors but log for diagnostics
                    try {
                        logger_1.logger.debug('Optional advanced UI display failed; continuing without UI', {
                            tool: 'find-files-tool',
                            pattern,
                            fileCount: files.length,
                            error: error && typeof error === 'object'
                                ? { message: error.message, name: error.name, stack: error.stack }
                                : String(error)
                        });
                    }
                    catch {
                        // Best-effort logging; never throw from here
                    }
                }
            }
            return {
                success: true,
                data: files,
                metadata: {
                    executionTime: Date.now() - startTime,
                    toolName: this.name,
                    parameters: { pattern, options }
                }
            };
        }
        catch (error) {
            return {
                success: false,
                data: [],
                error: error.message,
                metadata: {
                    executionTime: Date.now() - startTime,
                    toolName: this.name,
                    parameters: { pattern, options }
                }
            };
        }
    }
}
exports.FindFilesTool = FindFilesTool;
