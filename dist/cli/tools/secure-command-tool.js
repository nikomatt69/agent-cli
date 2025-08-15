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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureCommandTool = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const input_queue_1 = require("../core/input-queue");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const SAFE_COMMANDS = new Set([
    'ls', 'dir', 'pwd', 'whoami', 'date', 'echo', 'cat', 'head', 'tail',
    'grep', 'find', 'which', 'type', 'node', 'npm', 'yarn', 'pnpm',
    'git status', 'git log', 'git diff', 'git branch', 'git remote',
    'docker ps', 'docker images', 'docker version',
    'ps', 'top', 'df', 'free', 'uptime', 'uname'
]);
const DANGEROUS_COMMANDS = new Set([
    'rm', 'del', 'rmdir', 'mv', 'cp', 'chmod', 'chown', 'sudo',
    'curl', 'wget', 'ssh', 'scp', 'rsync', 'dd', 'fdisk',
    'format', 'mkfs', 'mount', 'umount', 'kill', 'killall',
    'systemctl', 'service', 'crontab', 'at', 'batch'
]);
class SecureCommandTool {
    constructor(workingDir) {
        this.commandHistory = [];
        this.batchSessions = new Map();
        this.workingDirectory = workingDir || process.cwd();
    }
    isSafeCommand(command) {
        const baseCommand = command.trim().split(' ')[0];
        const fullCommand = command.trim();
        return SAFE_COMMANDS.has(baseCommand) || SAFE_COMMANDS.has(fullCommand);
    }
    isDangerousCommand(command) {
        const baseCommand = command.trim().split(' ')[0];
        return DANGEROUS_COMMANDS.has(baseCommand);
    }
    analyzeCommand(command) {
        const risks = [];
        const suggestions = [];
        const safe = this.isSafeCommand(command);
        const dangerous = this.isDangerousCommand(command);
        if (command.includes('rm -rf')) {
            risks.push('Recursive file deletion detected');
            suggestions.push('Consider using a more specific path or --interactive flag');
        }
        if (command.includes('sudo')) {
            risks.push('Elevated privileges requested');
            suggestions.push('Ensure you trust this command completely');
        }
        if (command.includes('curl') || command.includes('wget')) {
            risks.push('Network request detected');
            suggestions.push('Verify the URL and ensure it\'s from a trusted source');
        }
        if (command.includes('|') && command.includes('sh')) {
            risks.push('Potential pipe to shell execution');
            suggestions.push('Review the entire pipeline for security');
        }
        if (command.includes('$(') || command.includes('`')) {
            risks.push('Command substitution detected');
            suggestions.push('Verify all substituted commands are safe');
        }
        return { safe, dangerous, risks, suggestions };
    }
    async createBatchSession(commands, options = {}) {
        const sessionId = `batch_${Date.now()}_${(0, crypto_1.randomBytes)(6).toString('base64url')}`;
        const sessionDuration = options.sessionDuration || 30;
        const expiresAt = new Date(Date.now() + sessionDuration * 60 * 1000);
        console.log(chalk_1.default.blue.bold('\n🔄 Creating Batch Execution Session'));
        console.log(chalk_1.default.gray(`Session ID: ${sessionId}`));
        console.log(chalk_1.default.gray(`Commands: ${commands.length}`));
        console.log(chalk_1.default.gray(`Expires: ${expiresAt.toLocaleTimeString()}`));
        const analyses = commands.map(cmd => ({ command: cmd, analysis: this.analyzeCommand(cmd) }));
        const dangerousCommands = analyses.filter(a => a.analysis.dangerous);
        const riskyCommands = analyses.filter(a => a.analysis.risks.length > 0);
        console.log(chalk_1.default.blue('\n📋 Batch Security Analysis:'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        commands.forEach((cmd, index) => {
            const analysis = analyses[index].analysis;
            const icon = analysis.safe ? '✅' : analysis.dangerous ? '🚫' : '⚠️';
            const color = analysis.safe ? chalk_1.default.green : analysis.dangerous ? chalk_1.default.red : chalk_1.default.yellow;
            console.log(color(`${icon} ${index + 1}. ${cmd}`));
            if (analysis.risks.length > 0) {
                analysis.risks.forEach(risk => {
                    console.log(chalk_1.default.gray(`     • ${risk}`));
                });
            }
        });
        if (dangerousCommands.length > 0 && !options.allowDangerous) {
            console.log(chalk_1.default.red(`\n🚫 Batch contains ${dangerousCommands.length} dangerous command(s)`));
            dangerousCommands.forEach(({ command }) => {
                console.log(chalk_1.default.red(`   • ${command}`));
            });
            throw new Error('Batch contains dangerous commands. Use allowDangerous: true to override.');
        }
        if (riskyCommands.length > 0) {
            console.log(chalk_1.default.yellow(`\n⚠️  ${riskyCommands.length} command(s) have security risks`));
        }
        console.log(chalk_1.default.blue('\n🔐 One-Time Batch Approval'));
        console.log(chalk_1.default.gray('Once approved, all commands will execute asynchronously without further confirmation.'));
        input_queue_1.inputQueue.enableBypass();
        try {
            const { approved } = await inquirer_1.default.prompt([{
                    type: 'confirm',
                    name: 'approved',
                    message: `Approve batch execution of ${commands.length} commands?`,
                    default: false,
                }]);
            const session = {
                id: sessionId,
                commands,
                approved,
                createdAt: new Date(),
                expiresAt,
                results: [],
                status: approved ? 'approved' : 'pending',
                onProgress: options.onProgress,
                onComplete: options.onComplete,
                onError: options.onError,
            };
            this.batchSessions.set(sessionId, session);
            if (approved) {
                console.log(chalk_1.default.green(`✅ Batch approved! Session ID: ${sessionId}`));
            }
            else {
                console.log(chalk_1.default.red('❌ Batch execution cancelled by user'));
            }
            return session;
        }
        finally {
            input_queue_1.inputQueue.disableBypass();
        }
    }
    async executeBatchAsync(sessionId, options = {}) {
        const session = this.batchSessions.get(sessionId);
        if (!session) {
            throw new Error(`Batch session not found: ${sessionId}`);
        }
        if (!session.approved) {
            throw new Error(`Batch session not approved: ${sessionId}`);
        }
        if (new Date() > session.expiresAt) {
            session.status = 'expired';
            throw new Error(`Batch session expired: ${sessionId}`);
        }
        if (session.status === 'executing') {
            console.log(chalk_1.default.yellow(`⚠️  Batch session already executing: ${sessionId}`));
            return;
        }
        session.status = 'executing';
        console.log(chalk_1.default.blue.bold(`\n🚀 Starting Async Batch Execution: ${sessionId}`));
        console.log(chalk_1.default.gray(`Commands: ${session.commands.length}`));
        setImmediate(async () => {
            try {
                for (let i = 0; i < session.commands.length; i++) {
                    const command = session.commands[i];
                    session.onProgress?.(command, i + 1, session.commands.length);
                    console.log(chalk_1.default.blue(`[${i + 1}/${session.commands.length}] Executing: ${command}`));
                    try {
                        const result = await this.execute(command, { ...options, skipConfirmation: true });
                        session.results.push(result);
                        console.log(chalk_1.default.green(`✅ [${i + 1}/${session.commands.length}] Completed: ${command}`));
                        if (result.exitCode !== 0) {
                            console.log(chalk_1.default.red(`❌ Command failed, stopping batch execution`));
                            session.status = 'failed';
                            session.onError?.(new Error(`Command failed: ${command}`), command, i);
                            return;
                        }
                    }
                    catch (error) {
                        console.log(chalk_1.default.red(`❌ [${i + 1}/${session.commands.length}] Failed: ${command}`));
                        console.log(chalk_1.default.red(`Error: ${error.message}`));
                        session.status = 'failed';
                        session.onError?.(error, command, i);
                        return;
                    }
                }
                session.status = 'completed';
                console.log(chalk_1.default.green.bold(`\n✅ Batch Execution Complete: ${sessionId}`));
                console.log(chalk_1.default.gray(`Executed: ${session.results.length}/${session.commands.length} commands`));
                session.onComplete?.(session.results);
            }
            catch (error) {
                session.status = 'failed';
                console.log(chalk_1.default.red.bold(`\n❌ Batch Execution Failed: ${sessionId}`));
                console.log(chalk_1.default.red(`Error: ${error.message}`));
            }
        });
        console.log(chalk_1.default.blue('⏳ Batch execution started in background...'));
    }
    getBatchSession(sessionId) {
        return this.batchSessions.get(sessionId);
    }
    listBatchSessions() {
        return Array.from(this.batchSessions.values());
    }
    cleanupExpiredSessions() {
        const now = new Date();
        let cleaned = 0;
        for (const [sessionId, session] of Array.from(this.batchSessions.entries())) {
            if (now > session.expiresAt) {
                this.batchSessions.delete(sessionId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(chalk_1.default.gray(`🧹 Cleaned up ${cleaned} expired batch session(s)`));
        }
        return cleaned;
    }
    async execute(command, options = {}) {
        const startTime = Date.now();
        const analysis = this.analyzeCommand(command);
        console.log(chalk_1.default.blue(`🔍 Analyzing command: ${command}`));
        if (analysis.dangerous && !options.allowDangerous) {
            const error = `Dangerous command blocked: ${command}`;
            console.log(chalk_1.default.red(`🚫 ${error}`));
            throw new Error(error);
        }
        if (analysis.risks.length > 0) {
            console.log(chalk_1.default.yellow('\n⚠️  Security Analysis:'));
            analysis.risks.forEach(risk => {
                console.log(chalk_1.default.yellow(`  • ${risk}`));
            });
            if (analysis.suggestions.length > 0) {
                console.log(chalk_1.default.blue('\n💡 Suggestions:'));
                analysis.suggestions.forEach(suggestion => {
                    console.log(chalk_1.default.blue(`  • ${suggestion}`));
                });
            }
        }
        if (!analysis.safe && !options.skipConfirmation) {
            console.log(chalk_1.default.yellow(`\n⚠️  Command requires confirmation: ${command}`));
            input_queue_1.inputQueue.enableBypass();
            try {
                const { confirmed } = await inquirer_1.default.prompt([{
                        type: 'confirm',
                        name: 'confirmed',
                        message: 'Execute this command?',
                        default: false,
                    }]);
                if (!confirmed) {
                    console.log(chalk_1.default.yellow('✋ Command execution cancelled by user'));
                    throw new Error('Command execution cancelled by user');
                }
            }
            finally {
                input_queue_1.inputQueue.disableBypass();
            }
        }
        try {
            const cwd = options.cwd ? path.resolve(this.workingDirectory, options.cwd) : this.workingDirectory;
            const env = { ...process.env, ...options.env };
            const timeout = options.timeout || 30000;
            console.log(chalk_1.default.blue(`⚡ Executing: ${command}`));
            console.log(chalk_1.default.gray(`📁 Working directory: ${cwd}`));
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                env,
                timeout,
                encoding: 'utf8',
            });
            const duration = Date.now() - startTime;
            const success = true;
            this.commandHistory.push({
                command,
                timestamp: new Date(),
                success,
                duration,
            });
            console.log(chalk_1.default.green(`✅ Command completed in ${duration}ms`));
            if (stdout) {
                console.log(chalk_1.default.white('📤 Output:'));
                console.log(stdout);
            }
            if (stderr) {
                console.log(chalk_1.default.yellow('⚠️  Warnings:'));
                console.log(stderr);
            }
            return {
                stdout,
                stderr,
                exitCode: 0,
                command,
                duration,
                safe: analysis.safe,
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.commandHistory.push({
                command,
                timestamp: new Date(),
                success: false,
                duration,
            });
            console.log(chalk_1.default.red(`❌ Command failed after ${duration}ms`));
            console.log(chalk_1.default.red(`Error: ${error.message}`));
            return {
                stdout: error.stdout || '',
                stderr: error.stderr || error.message,
                exitCode: error.code || 1,
                command,
                duration,
                safe: analysis.safe,
            };
        }
    }
    async executeSequence(commands, options = {}) {
        console.log(chalk_1.default.blue(`📋 Executing ${commands.length} commands in sequence`));
        console.log(chalk_1.default.blue('\nCommands to execute:'));
        commands.forEach((cmd, index) => {
            console.log(chalk_1.default.gray(`  ${index + 1}. ${cmd}`));
        });
        if (!options.skipConfirmation) {
            input_queue_1.inputQueue.enableBypass();
            try {
                const { confirmed } = await inquirer_1.default.prompt([{
                        type: 'confirm',
                        name: 'confirmed',
                        message: 'Execute all commands?',
                        default: false,
                    }]);
                if (!confirmed) {
                    console.log(chalk_1.default.yellow('✋ Command sequence cancelled by user'));
                    throw new Error('Command sequence cancelled by user');
                }
            }
            finally {
                input_queue_1.inputQueue.disableBypass();
            }
        }
        const results = [];
        for (let i = 0; i < commands.length; i++) {
            const command = commands[i];
            console.log(chalk_1.default.blue(`\n[${i + 1}/${commands.length}] ${command}`));
            try {
                const result = await this.execute(command, { ...options, skipConfirmation: true });
                results.push(result);
                if (result.exitCode !== 0) {
                    console.log(chalk_1.default.red(`❌ Command ${i + 1} failed, stopping sequence`));
                    break;
                }
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Command ${i + 1} failed: ${error}`));
                break;
            }
        }
        return results;
    }
    getHistory(limit) {
        const history = this.commandHistory.slice().reverse();
        return limit ? history.slice(0, limit) : history;
    }
    addSafeCommand(command) {
        SAFE_COMMANDS.add(command);
        console.log(chalk_1.default.green(`✅ Added to safe commands: ${command}`));
    }
    checkCommand(command) {
        const analysis = this.analyzeCommand(command);
        return { safe: analysis.safe, analysis };
    }
}
exports.SecureCommandTool = SecureCommandTool;
