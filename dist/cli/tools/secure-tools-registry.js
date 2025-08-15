"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureTools = exports.SecureToolsRegistry = void 0;
const chalk_1 = __importDefault(require("chalk"));
const secure_file_tools_1 = require("./secure-file-tools");
const find_files_tool_1 = require("./find-files-tool");
const _1 = require(".");
class SecureToolsRegistry {
    constructor(workingDir) {
        this.executionHistory = [];
        this.workingDirectory = workingDir || process.cwd();
        this.readFileTool = new secure_file_tools_1.ReadFileTool(this.workingDirectory);
        this.writeFileTool = new secure_file_tools_1.WriteFileTool(this.workingDirectory);
        this.listDirectoryTool = new secure_file_tools_1.ListDirectoryTool(this.workingDirectory);
        this.replaceInFileTool = new secure_file_tools_1.ReplaceInFileTool(this.workingDirectory);
        this.secureCommandTool = new _1.SecureCommandTool(this.workingDirectory);
        this.findFilesTool = new find_files_tool_1.FindFilesTool(this.workingDirectory);
        console.log(chalk_1.default.green('🔒 Secure Tools Registry initialized'));
        console.log(chalk_1.default.gray(`📁 Working directory: ${this.workingDirectory}`));
    }
    createContext(securityLevel = 'safe') {
        return {
            workingDirectory: this.workingDirectory,
            timestamp: new Date(),
            securityLevel,
        };
    }
    async executeWithTracking(toolName, operation, context, securityChecks) {
        const startTime = Date.now();
        try {
            console.log(chalk_1.default.blue(`🔧 Executing tool: ${toolName}`));
            const data = await operation();
            const executionTime = Date.now() - startTime;
            const result = {
                success: true,
                data,
                context,
                executionTime,
                securityChecks,
            };
            this.executionHistory.push(result);
            console.log(chalk_1.default.green(`✅ Tool completed: ${toolName} (${executionTime}ms)`));
            return result;
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            const result = {
                success: false,
                error: error.message,
                context,
                executionTime,
                securityChecks,
            };
            this.executionHistory.push(result);
            console.log(chalk_1.default.red(`❌ Tool failed: ${toolName} - ${error.message}`));
            throw error;
        }
    }
    async readFile(filePath) {
        const context = this.createContext('safe');
        return this.executeWithTracking('ReadFile', () => this.readFileTool.execute(filePath), context, { pathValidated: true, userConfirmed: false });
    }
    async writeFile(filePath, content, options = {}) {
        const context = this.createContext(options.skipConfirmation ? 'safe' : 'confirmed');
        return this.executeWithTracking('WriteFile', () => this.writeFileTool.execute(filePath, content, options), context, {
            pathValidated: true,
            userConfirmed: !options.skipConfirmation
        });
    }
    async listDirectory(directoryPath = '.', options = {}) {
        const context = this.createContext('safe');
        return this.executeWithTracking('ListDirectory', () => this.listDirectoryTool.execute(directoryPath, options), context, { pathValidated: true, userConfirmed: false });
    }
    async replaceInFile(filePath, replacements, options = {}) {
        const context = this.createContext(options.skipConfirmation ? 'safe' : 'confirmed');
        return this.executeWithTracking('ReplaceInFile', () => this.replaceInFileTool.execute(filePath, replacements, options), context, {
            pathValidated: true,
            userConfirmed: !options.skipConfirmation
        });
    }
    async findFiles(pattern, options = {}) {
        const context = this.createContext('safe');
        return this.executeWithTracking('FindFiles', async () => {
            const result = await this.findFilesTool.execute(pattern, options);
            return result.data;
        }, context, { pathValidated: true, userConfirmed: false });
    }
    async executeCommand(command, options = {}) {
        const context = this.createContext(options.allowDangerous ? 'dangerous' :
            options.skipConfirmation ? 'safe' : 'confirmed');
        return this.executeWithTracking('ExecuteCommand', () => this.secureCommandTool.execute(command, options), context, {
            pathValidated: true,
            userConfirmed: !options.skipConfirmation,
            commandAnalyzed: true
        });
    }
    async executeCommandSequence(commands, options = {}) {
        const context = this.createContext(options.allowDangerous ? 'dangerous' :
            options.skipConfirmation ? 'safe' : 'confirmed');
        return this.executeWithTracking('ExecuteCommandSequence', () => this.secureCommandTool.executeSequence(commands, options), context, {
            pathValidated: true,
            userConfirmed: !options.skipConfirmation,
            commandAnalyzed: true
        });
    }
    async createBatchSession(commands, options = {}) {
        const context = this.createContext(options.allowDangerous ? 'dangerous' : 'confirmed');
        return this.executeWithTracking('CreateBatchSession', () => this.secureCommandTool.createBatchSession(commands, options), context, {
            pathValidated: true,
            userConfirmed: true,
            commandAnalyzed: true
        });
    }
    async executeBatchAsync(sessionId, options = {}) {
        const context = this.createContext('confirmed');
        return this.executeWithTracking('ExecuteBatchAsync', () => this.secureCommandTool.executeBatchAsync(sessionId, options), context, {
            pathValidated: true,
            userConfirmed: true,
            commandAnalyzed: true
        });
    }
    getBatchSession(sessionId) {
        return this.secureCommandTool.getBatchSession(sessionId);
    }
    listBatchSessions() {
        return this.secureCommandTool.listBatchSessions();
    }
    cleanupExpiredSessions() {
        return this.secureCommandTool.cleanupExpiredSessions();
    }
    validatePath(filePath) {
        try {
            const safePath = (0, secure_file_tools_1.sanitizePath)(filePath, this.workingDirectory);
            return { valid: true, safePath };
        }
        catch (error) {
            return { valid: false, error: error.message };
        }
    }
    checkCommand(command) {
        return this.secureCommandTool.checkCommand(command);
    }
    getExecutionHistory(options = {}) {
        let history = this.executionHistory.slice().reverse();
        if (options.securityLevel) {
            history = history.filter(result => result.context.securityLevel === options.securityLevel);
        }
        if (options.successOnly) {
            history = history.filter(result => result.success);
        }
        if (options.limit) {
            history = history.slice(0, options.limit);
        }
        return history;
    }
    getSecurityStats() {
        const total = this.executionHistory.length;
        const safe = this.executionHistory.filter(r => r.context.securityLevel === 'safe').length;
        const confirmed = this.executionHistory.filter(r => r.context.securityLevel === 'confirmed').length;
        const dangerous = this.executionHistory.filter(r => r.context.securityLevel === 'dangerous').length;
        const failed = this.executionHistory.filter(r => !r.success).length;
        const pathValidated = this.executionHistory.filter(r => r.securityChecks.pathValidated).length;
        const userConfirmed = this.executionHistory.filter(r => r.securityChecks.userConfirmed).length;
        return {
            totalOperations: total,
            safeOperations: safe,
            confirmedOperations: confirmed,
            dangerousOperations: dangerous,
            failedOperations: failed,
            pathValidationRate: total > 0 ? pathValidated / total : 0,
            userConfirmationRate: total > 0 ? userConfirmed / total : 0,
        };
    }
    printSecuritySummary() {
        const stats = this.getSecurityStats();
        console.log(chalk_1.default.blue.bold('\n🔒 Security Summary'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.white(`Total Operations: ${stats.totalOperations}`));
        console.log(chalk_1.default.green(`Safe Operations: ${stats.safeOperations}`));
        console.log(chalk_1.default.yellow(`Confirmed Operations: ${stats.confirmedOperations}`));
        console.log(chalk_1.default.red(`Dangerous Operations: ${stats.dangerousOperations}`));
        console.log(chalk_1.default.red(`Failed Operations: ${stats.failedOperations}`));
        console.log(chalk_1.default.blue(`Path Validation Rate: ${(stats.pathValidationRate * 100).toFixed(1)}%`));
        console.log(chalk_1.default.blue(`User Confirmation Rate: ${(stats.userConfirmationRate * 100).toFixed(1)}%`));
    }
}
exports.SecureToolsRegistry = SecureToolsRegistry;
exports.secureTools = new SecureToolsRegistry();
