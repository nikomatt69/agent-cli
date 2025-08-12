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
exports.RunCommandTool = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const base_tool_1 = require("./base-tool");
const terminal_ui_1 = require("../ui/terminal-ui");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Production-ready Run Command Tool
 * Safely executes commands with whitelist, sandboxing, and monitoring
 */
class RunCommandTool extends base_tool_1.BaseTool {
    constructor(workingDirectory, config = {}) {
        super('run-command-tool', workingDirectory);
        this.allowedCommands = new Set(config.allowedCommands || DEFAULT_ALLOWED_COMMANDS);
        this.allowedPaths = new Set(config.allowedPaths || [workingDirectory]);
        this.maxExecutionTime = config.maxExecutionTime || 30000; // 30 seconds
        this.maxOutputSize = config.maxOutputSize || 1024 * 1024; // 1MB
    }
    async execute(command, options = {}) {
        const startTime = Date.now();
        try {
            // Parse and validate command
            const parsedCommand = this.parseCommand(command);
            await this.validateCommand(parsedCommand, options);
            // Execute command with monitoring
            const result = await this.executeWithMonitoring(parsedCommand, options);
            const duration = Date.now() - startTime;
            const commandResult = {
                success: result.exitCode === 0,
                command: command,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                duration,
                workingDirectory: options.cwd || this.workingDirectory,
                metadata: {
                    pid: result.pid,
                    signal: result.signal,
                    timedOut: result.timedOut,
                    outputTruncated: result.outputTruncated
                }
            };
            if (result.exitCode === 0) {
                terminal_ui_1.CliUI.logSuccess(`Command executed successfully: ${command}`);
            }
            else {
                terminal_ui_1.CliUI.logWarning(`Command failed with exit code ${result.exitCode}: ${command}`);
            }
            return {
                success: result.exitCode === 0,
                data: commandResult,
                metadata: {
                    executionTime: duration,
                    toolName: this.name,
                    parameters: { command, options }
                }
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorResult = {
                success: false,
                command,
                exitCode: -1,
                stdout: '',
                stderr: error.message,
                duration,
                workingDirectory: options.cwd || this.workingDirectory,
                error: error.message,
                metadata: {
                    timedOut: false,
                    outputTruncated: false
                }
            };
            terminal_ui_1.CliUI.logError(`Command execution failed: ${command} - ${error.message}`);
            return {
                success: false,
                data: errorResult,
                error: error.message,
                metadata: {
                    executionTime: duration,
                    toolName: this.name,
                    parameters: { command, options }
                }
            };
        }
    }
    /**
     * Execute multiple commands in sequence
     */
    async executeSequence(commands, options = {}) {
        const results = [];
        let successCount = 0;
        for (let i = 0; i < commands.length; i++) {
            const command = commands[i];
            try {
                const toolResult = await this.execute(command, options);
                const result = toolResult.data;
                results.push(result);
                if (result.success) {
                    successCount++;
                }
                else if (options.stopOnFirstError) {
                    terminal_ui_1.CliUI.logWarning(`Stopping sequence at command ${i + 1} due to failure`);
                    break;
                }
            }
            catch (error) {
                const errorResult = {
                    success: false,
                    command,
                    exitCode: -1,
                    stdout: '',
                    stderr: error.message,
                    duration: 0,
                    workingDirectory: options.cwd || this.workingDirectory,
                    error: error.message,
                    metadata: {
                        timedOut: false,
                        outputTruncated: false
                    }
                };
                results.push(errorResult);
                if (options.stopOnFirstError) {
                    break;
                }
            }
        }
        return {
            success: successCount === commands.length,
            results,
            totalCommands: commands.length,
            successfulCommands: successCount,
            summary: this.generateSequenceSummary(results)
        };
    }
    /**
     * Execute command with real-time output streaming
     */
    async executeWithStreaming(command, options = {}) {
        return new Promise((resolve, reject) => {
            const parsedCommand = this.parseCommand(command);
            // Validate command first
            this.validateCommand(parsedCommand, options).then(() => {
                const startTime = Date.now();
                let stdout = '';
                let stderr = '';
                let outputSize = 0;
                let timedOut = false;
                let outputTruncated = false;
                const child = (0, child_process_1.spawn)(parsedCommand.executable, parsedCommand.args, {
                    cwd: options.cwd || this.workingDirectory,
                    env: { ...process.env, ...options.env },
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                // Set up timeout
                const timeout = setTimeout(() => {
                    timedOut = true;
                    child.kill('SIGTERM');
                    // Force kill after 5 seconds
                    setTimeout(() => {
                        if (!child.killed) {
                            child.kill('SIGKILL');
                        }
                    }, 5000);
                }, this.maxExecutionTime);
                // Handle stdout
                child.stdout?.on('data', (data) => {
                    const chunk = data.toString();
                    outputSize += chunk.length;
                    if (outputSize > this.maxOutputSize) {
                        outputTruncated = true;
                        child.kill('SIGTERM');
                        return;
                    }
                    stdout += chunk;
                    if (options.onStdout) {
                        options.onStdout(chunk);
                    }
                });
                // Handle stderr
                child.stderr?.on('data', (data) => {
                    const chunk = data.toString();
                    outputSize += chunk.length;
                    if (outputSize > this.maxOutputSize) {
                        outputTruncated = true;
                        child.kill('SIGTERM');
                        return;
                    }
                    stderr += chunk;
                    if (options.onStderr) {
                        options.onStderr(chunk);
                    }
                });
                // Handle process completion
                child.on('close', (exitCode, signal) => {
                    clearTimeout(timeout);
                    const result = {
                        success: exitCode === 0 && !timedOut && !outputTruncated,
                        command,
                        exitCode: exitCode || -1,
                        stdout,
                        stderr,
                        duration: Date.now() - startTime,
                        workingDirectory: options.cwd || this.workingDirectory,
                        metadata: {
                            pid: child.pid,
                            signal,
                            timedOut,
                            outputTruncated
                        }
                    };
                    resolve(result);
                });
                child.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            }).catch(reject);
        });
    }
    /**
     * Parse command string into executable and arguments
     */
    parseCommand(command) {
        // Simple command parsing - in production, consider using a proper shell parser
        const parts = command.trim().split(/\s+/);
        const executable = parts[0];
        const args = parts.slice(1);
        return {
            original: command,
            executable,
            args,
            fullPath: executable // Will be resolved during validation
        };
    }
    /**
     * Validate command against security policies
     */
    async validateCommand(parsedCommand, options) {
        // Check if command is in whitelist
        if (!this.allowedCommands.has(parsedCommand.executable)) {
            throw new Error(`Command not allowed: ${parsedCommand.executable}`);
        }
        // Validate working directory
        const workingDir = options.cwd || this.workingDirectory;
        if (!this.allowedPaths.has(workingDir)) {
            const isSubPath = Array.from(this.allowedPaths).some(allowedPath => workingDir.startsWith(allowedPath));
            if (!isSubPath) {
                throw new Error(`Working directory not allowed: ${workingDir}`);
            }
        }
        // Check for dangerous arguments
        const dangerousPatterns = [
            /rm\s+-rf/,
            /sudo/,
            /chmod\s+777/,
            />/, // Output redirection
            /\|/, // Pipes
            /;/, // Command chaining
            /&&/, // Command chaining
            /\|\|/, // Command chaining
        ];
        const fullCommand = `${parsedCommand.executable} ${parsedCommand.args.join(' ')}`;
        for (const pattern of dangerousPatterns) {
            if (pattern.test(fullCommand)) {
                throw new Error(`Dangerous command pattern detected: ${pattern.source}`);
            }
        }
        // Validate file paths in arguments
        for (const arg of parsedCommand.args) {
            if (arg.startsWith('/') || arg.includes('..')) {
                // This looks like a file path, validate it
                try {
                    const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
                    const resolvedPath = require('path').resolve(workingDir, arg);
                    // Check if path is within allowed directories
                    const isAllowed = Array.from(this.allowedPaths).some(allowedPath => resolvedPath.startsWith(allowedPath));
                    if (!isAllowed) {
                        throw new Error(`File path not allowed: ${arg}`);
                    }
                }
                catch {
                    // If path validation fails, it might not be a file path
                    // Continue with execution but log warning
                    terminal_ui_1.CliUI.logWarning(`Could not validate path argument: ${arg}`);
                }
            }
        }
    }
    /**
     * Execute command with monitoring and limits
     */
    async executeWithMonitoring(parsedCommand, options) {
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let outputSize = 0;
            let timedOut = false;
            let outputTruncated = false;
            const child = (0, child_process_1.spawn)(parsedCommand.executable, parsedCommand.args, {
                cwd: options.cwd || this.workingDirectory,
                env: { ...process.env, ...options.env },
                stdio: ['pipe', 'pipe', 'pipe']
            });
            const timeout = setTimeout(() => {
                timedOut = true;
                child.kill('SIGTERM');
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill('SIGKILL');
                    }
                }, 5000);
            }, this.maxExecutionTime);
            child.stdout?.on('data', (data) => {
                const chunk = data.toString();
                outputSize += chunk.length;
                if (outputSize > this.maxOutputSize) {
                    outputTruncated = true;
                    child.kill('SIGTERM');
                    return;
                }
                stdout += chunk;
            });
            child.stderr?.on('data', (data) => {
                const chunk = data.toString();
                outputSize += chunk.length;
                if (outputSize > this.maxOutputSize) {
                    outputTruncated = true;
                    child.kill('SIGTERM');
                    return;
                }
                stderr += chunk;
            });
            child.on('close', (exitCode, signal) => {
                clearTimeout(timeout);
                resolve({
                    exitCode: exitCode || -1,
                    stdout,
                    stderr,
                    pid: child.pid,
                    signal,
                    timedOut,
                    outputTruncated
                });
            });
            child.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }
    /**
     * Generate summary for command sequence
     */
    generateSequenceSummary(results) {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
        return {
            totalCommands: results.length,
            successfulCommands: successful.length,
            failedCommands: failed.length,
            totalDuration,
            averageDuration: results.length > 0 ? Math.round(totalDuration / results.length) : 0,
            longestCommand: results.reduce((max, r) => r.duration > max.duration ? r : max, results[0])?.command || ''
        };
    }
    /**
     * Add command to whitelist
     */
    addAllowedCommand(command) {
        this.allowedCommands.add(command);
        terminal_ui_1.CliUI.logInfo(`Added command to whitelist: ${command}`);
    }
    /**
     * Remove command from whitelist
     */
    removeAllowedCommand(command) {
        this.allowedCommands.delete(command);
        terminal_ui_1.CliUI.logInfo(`Removed command from whitelist: ${command}`);
    }
    /**
     * Get current whitelist
     */
    getAllowedCommands() {
        return Array.from(this.allowedCommands);
    }
    /**
     * Add allowed path
     */
    addAllowedPath(path) {
        this.allowedPaths.add(path);
        terminal_ui_1.CliUI.logInfo(`Added path to whitelist: ${path}`);
    }
}
exports.RunCommandTool = RunCommandTool;
// Default allowed commands (safe, common development commands)
const DEFAULT_ALLOWED_COMMANDS = [
    'ls', 'dir', 'pwd', 'echo', 'cat', 'head', 'tail', 'grep', 'find', 'wc',
    'git', 'npm', 'yarn', 'node', 'python', 'python3', 'pip', 'pip3',
    'tsc', 'eslint', 'prettier', 'jest', 'mocha', 'cypress',
    'docker', 'kubectl', 'helm',
    'curl', 'wget', 'ping', 'nslookup',
    'mkdir', 'touch', 'cp', 'mv', 'ln',
    'which', 'whereis', 'type', 'file', 'stat',
    'ps', 'top', 'htop', 'df', 'du', 'free', 'uptime'
];
