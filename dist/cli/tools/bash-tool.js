"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BashTool = void 0;
const base_tool_1 = require("./base-tool");
const prompt_manager_1 = require("../prompts/prompt-manager");
const cli_ui_1 = require("../utils/cli-ui");
const child_process_1 = require("child_process");
// Whitelist comandi sicuri
const SAFE_COMMANDS = [
    'ls', 'cat', 'head', 'tail', 'grep', 'find', 'wc', 'sort', 'uniq',
    'echo', 'pwd', 'whoami', 'date', 'which', 'type',
    'npm', 'yarn', 'node', 'python', 'python3', 'pip', 'pip3',
    'git', 'docker', 'kubectl',
    'mkdir', 'cp', 'mv', 'touch',
    'curl', 'wget', 'ping', 'nslookup',
    'ps', 'top', 'df', 'du', 'free', 'uptime'
];
// Comandi pericolosi vietati
const DANGEROUS_COMMANDS = [
    'rm', 'rmdir', 'dd', 'mkfs', 'fdisk',
    'sudo', 'su', 'chmod', 'chown', 'chgrp',
    'kill', 'killall', 'pkill',
    'reboot', 'shutdown', 'halt', 'poweroff',
    'format', 'del', 'erase'
];
// Pattern pericolosi negli argomenti
const DANGEROUS_PATTERNS = [
    /rm\s+-rf/i,
    />\s*\/dev\/null/i,
    /;\s*rm/i,
    /&&\s*rm/i,
    /\|\s*rm/i,
    /eval\s+/i,
    /exec\s+/i,
    /\/etc\/passwd/i,
    /\/etc\/shadow/i
];
const MAX_OUTPUT_LENGTH = 30000;
const DEFAULT_TIMEOUT = 60000; // 1 minuto
const MAX_TIMEOUT = 600000; // 10 minuti
class BashTool extends base_tool_1.BaseTool {
    constructor(workingDirectory) {
        super('bash-tool', workingDirectory);
    }
    async execute(params) {
        try {
            // Carica prompt specifico per questo tool
            const promptManager = prompt_manager_1.PromptManager.getInstance();
            const systemPrompt = await promptManager.loadPromptForContext({
                toolName: 'bash-tool',
                parameters: params
            });
            cli_ui_1.CliUI.logDebug(`Using system prompt: ${systemPrompt.substring(0, 100)}...`);
            if (!params.command) {
                throw new Error('Command is required');
            }
            // Validazione sicurezza comando
            await this.validateCommandSafety(params.command, params.allowDangerous || false);
            const timeout = Math.min(params.timeout || DEFAULT_TIMEOUT, MAX_TIMEOUT);
            const workingDir = params.workingDirectory || this.workingDirectory;
            // Validazione working directory
            if (!this.isPathSafe(workingDir)) {
                throw new Error(`Working directory not safe: ${workingDir}`);
            }
            cli_ui_1.CliUI.logInfo(`🔧 Executing command: ${cli_ui_1.CliUI.highlight(params.command)}`);
            if (params.description) {
                cli_ui_1.CliUI.logInfo(`📝 Description: ${params.description}`);
            }
            const result = await this.executeCommand(params.command, {
                timeout,
                workingDirectory: workingDir,
                environment: params.environment
            });
            if (result.exitCode === 0) {
                cli_ui_1.CliUI.logSuccess(`✅ Command completed successfully (${result.executionTime}ms)`);
            }
            else {
                cli_ui_1.CliUI.logWarning(`⚠️ Command exited with code ${result.exitCode}`);
            }
            return {
                success: result.exitCode === 0,
                data: result,
                metadata: {
                    executionTime: result.executionTime,
                    toolName: this.name,
                    parameters: params
                }
            };
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Bash tool failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                data: null,
                metadata: {
                    executionTime: Date.now(),
                    toolName: this.name,
                    parameters: params
                }
            };
        }
    }
    /**
     * Valida la sicurezza del comando
     */
    async validateCommandSafety(command, allowDangerous) {
        const commandLower = command.toLowerCase().trim();
        // Estrai comando principale
        const mainCommand = commandLower.split(/\s+/)[0];
        const commandWithoutPath = mainCommand.split('/').pop() || mainCommand;
        // Verifica comandi pericolosi
        if (DANGEROUS_COMMANDS.includes(commandWithoutPath)) {
            if (!allowDangerous) {
                throw new Error(`Dangerous command not allowed: ${commandWithoutPath}. Use allowDangerous=true to override.`);
            }
            cli_ui_1.CliUI.logWarning(`⚠️ Executing dangerous command: ${commandWithoutPath}`);
        }
        // Verifica pattern pericolosi
        for (const pattern of DANGEROUS_PATTERNS) {
            if (pattern.test(command)) {
                if (!allowDangerous) {
                    throw new Error(`Dangerous pattern detected in command: ${pattern}. Use allowDangerous=true to override.`);
                }
                cli_ui_1.CliUI.logWarning(`⚠️ Dangerous pattern detected: ${pattern}`);
            }
        }
        // Verifica se comando è in whitelist (solo se non pericoloso)
        if (!SAFE_COMMANDS.includes(commandWithoutPath) && !allowDangerous) {
            cli_ui_1.CliUI.logWarning(`Command '${commandWithoutPath}' not in safe whitelist. Consider adding to SAFE_COMMANDS if appropriate.`);
        }
        // Validazioni aggiuntive
        if (command.includes('..')) {
            throw new Error('Directory traversal not allowed in commands');
        }
        if (command.length > 1000) {
            throw new Error('Command too long (max 1000 characters)');
        }
    }
    /**
     * Esegue il comando con timeout e monitoring
     */
    async executeCommand(command, options) {
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let killed = false;
            // Prepara environment
            const env = {
                ...process.env,
                ...options.environment,
                PWD: options.workingDirectory
            };
            // Spawn processo
            const child = (0, child_process_1.spawn)('bash', ['-c', command], {
                cwd: options.workingDirectory,
                env,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            // Setup timeout
            const timeoutHandle = setTimeout(() => {
                timedOut = true;
                killed = true;
                child.kill('SIGTERM');
                // Force kill dopo 5 secondi
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill('SIGKILL');
                    }
                }, 5000);
            }, options.timeout);
            // Gestione output
            if (child.stdout) {
                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                    // Limita output per evitare memory overflow
                    if (stdout.length > MAX_OUTPUT_LENGTH) {
                        stdout = stdout.substring(0, MAX_OUTPUT_LENGTH) + '\n... [output truncated]';
                        child.kill('SIGTERM');
                    }
                });
            }
            if (child.stderr) {
                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                    if (stderr.length > MAX_OUTPUT_LENGTH) {
                        stderr = stderr.substring(0, MAX_OUTPUT_LENGTH) + '\n... [error output truncated]';
                    }
                });
            }
            // Gestione completamento
            child.on('close', (exitCode) => {
                clearTimeout(timeoutHandle);
                const executionTime = Date.now() - startTime;
                const result = {
                    command,
                    exitCode: exitCode || 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    executionTime,
                    workingDirectory: options.workingDirectory,
                    timedOut,
                    killed
                };
                if (timedOut) {
                    result.stderr += `\nCommand timed out after ${options.timeout}ms`;
                }
                resolve(result);
            });
            // Gestione errori
            child.on('error', (error) => {
                clearTimeout(timeoutHandle);
                reject(new Error(`Failed to execute command: ${error.message}`));
            });
            // Log processo avviato
            cli_ui_1.CliUI.logDebug(`Started process PID: ${child.pid}`);
        });
    }
    /**
     * Lista comandi sicuri disponibili
     */
    static getSafeCommands() {
        return [...SAFE_COMMANDS];
    }
    /**
     * Lista comandi pericolosi vietati
     */
    static getDangerousCommands() {
        return [...DANGEROUS_COMMANDS];
    }
    /**
     * Verifica se un comando è considerato sicuro
     */
    static isCommandSafe(command) {
        const commandLower = command.toLowerCase().trim();
        const mainCommand = commandLower.split(/\s+/)[0];
        const commandWithoutPath = mainCommand.split('/').pop() || mainCommand;
        // Verifica se è in blacklist
        if (DANGEROUS_COMMANDS.includes(commandWithoutPath)) {
            return false;
        }
        // Verifica pattern pericolosi
        for (const pattern of DANGEROUS_PATTERNS) {
            if (pattern.test(command)) {
                return false;
            }
        }
        // Verifica se è in whitelist
        return SAFE_COMMANDS.includes(commandWithoutPath);
    }
}
exports.BashTool = BashTool;
