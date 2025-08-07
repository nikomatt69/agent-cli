"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemAdminAgent = void 0;
const base_agent_1 = require("./base-agent");
const model_provider_1 = require("../ai/model-provider");
const tools_manager_1 = require("../tools/tools-manager");
const chalk_1 = __importDefault(require("chalk"));
const zod_1 = require("zod");
const SystemCommandSchema = zod_1.z.object({
    commands: zod_1.z.array(zod_1.z.object({
        command: zod_1.z.string(),
        description: zod_1.z.string(),
        sudo: zod_1.z.boolean().optional(),
        interactive: zod_1.z.boolean().optional(),
        timeout: zod_1.z.number().optional(),
    })),
    reasoning: zod_1.z.string(),
    warnings: zod_1.z.array(zod_1.z.string()).optional(),
});
class SystemAdminAgent extends base_agent_1.BaseAgent {
    constructor(workingDirectory = process.cwd()) {
        super(workingDirectory);
        this.id = 'system-admin';
        this.capabilities = ["system-administration", "server-management", "monitoring"];
        this.specialization = 'System administration and server management';
    }
    async onInitialize() {
        console.log('System Admin Agent initialized');
    }
    async onStop() {
        console.log('System Admin Agent stopped');
    }
    async analyzeSystem() {
        console.log(chalk_1.default.blue('🔍 Analyzing system...'));
        const systemInfo = await tools_manager_1.toolsManager.getSystemInfo();
        const dependencies = await tools_manager_1.toolsManager.checkDependencies([
            'node', 'npm', 'git', 'docker', 'python3', 'curl', 'wget', 'code'
        ]);
        const runningProcesses = tools_manager_1.toolsManager.getRunningProcesses();
        const commandHistory = tools_manager_1.toolsManager.getCommandHistory(10);
        console.log(chalk_1.default.green('📊 System Analysis Complete:'));
        console.log(chalk_1.default.gray(`Platform: ${systemInfo.platform} (${systemInfo.arch})`));
        console.log(chalk_1.default.gray(`Node.js: ${systemInfo.nodeVersion}`));
        console.log(chalk_1.default.gray(`Memory: ${Math.round(systemInfo.memory.used / 1024 / 1024 / 1024 * 100) / 100}GB / ${Math.round(systemInfo.memory.total / 1024 / 1024 / 1024 * 100) / 100}GB`));
        console.log(chalk_1.default.gray(`CPUs: ${systemInfo.cpus}`));
        return {
            systemInfo,
            dependencies,
            runningProcesses: runningProcesses.length,
            recentCommands: commandHistory.length,
            analysis: {
                nodeInstalled: !!systemInfo.nodeVersion,
                npmInstalled: !!systemInfo.npmVersion,
                gitInstalled: !!systemInfo.gitVersion,
                dockerInstalled: !!systemInfo.dockerVersion,
                memoryUsage: (systemInfo.memory.used / systemInfo.memory.total) * 100,
            },
        };
    }
    async executeCommands(commandsDescription) {
        console.log(chalk_1.default.blue(`⚡ Planning command execution: ${commandsDescription}`));
        const systemInfo = await tools_manager_1.toolsManager.getSystemInfo();
        const messages = [
            {
                role: 'system',
                content: `You are a system administrator AI. Plan and execute terminal commands safely.

Current system: ${systemInfo.platform} ${systemInfo.arch}
Node.js: ${systemInfo.nodeVersion}
Available tools: ${systemInfo.npmVersion ? 'npm' : ''} ${systemInfo.gitVersion ? 'git' : ''} ${systemInfo.dockerVersion ? 'docker' : ''}

IMPORTANT SAFETY RULES:
1. Never run destructive commands (rm -rf, dd, mkfs, etc.)
2. Always explain what each command does
3. Use sudo only when absolutely necessary
4. Provide warnings for potentially dangerous operations
5. Suggest alternatives for risky commands

Generate a structured plan with commands to execute.`,
            },
            {
                role: 'user',
                content: commandsDescription,
            },
        ];
        try {
            const plan = await model_provider_1.modelProvider.generateStructured({
                messages,
                schema: SystemCommandSchema,
                schemaName: 'SystemCommands',
                schemaDescription: 'Structured plan for system command execution',
            });
            // Cast to any to handle unknown type
            const planResult = plan;
            console.log(chalk_1.default.blue.bold('\n📋 Command Execution Plan:'));
            console.log(chalk_1.default.gray(`Reasoning: ${planResult.reasoning || 'No reasoning provided'}`));
            if (planResult.warnings && planResult.warnings.length > 0) {
                console.log(chalk_1.default.yellow.bold('\n⚠️  Warnings:'));
                planResult.warnings.forEach((warning) => {
                    console.log(chalk_1.default.yellow(`• ${warning}`));
                });
            }
            console.log(chalk_1.default.blue.bold('\nCommands to execute:'));
            (planResult.commands || []).forEach((cmd, index) => {
                console.log(`${index + 1}. ${chalk_1.default.cyan(cmd.command)}`);
                console.log(`   ${chalk_1.default.gray(cmd.description)}`);
                if (cmd.sudo)
                    console.log(`   ${chalk_1.default.red('⚠️ Requires sudo')}`);
            });
            // Ask for confirmation
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            const confirm = await new Promise((resolve) => {
                readline.question(chalk_1.default.yellow('\nExecute these commands? (y/N): '), (answer) => {
                    readline.close();
                    resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
                });
            });
            if (!confirm) {
                console.log(chalk_1.default.yellow('Command execution cancelled'));
                return { cancelled: true, plan };
            }
            // Execute commands
            const results = [];
            for (const cmd of planResult.commands || []) {
                console.log(chalk_1.default.blue(`\n🔄 Executing: ${cmd.command}`));
                const [command, ...args] = cmd.command.split(' ');
                const result = await tools_manager_1.toolsManager.runCommand(command, args, {
                    sudo: cmd.sudo,
                    interactive: cmd.interactive,
                    timeout: cmd.timeout,
                    stream: true,
                });
                results.push({
                    command: cmd.command,
                    success: result.code === 0,
                    output: result.stdout + result.stderr,
                    exitCode: result.code,
                });
                if (result.code !== 0) {
                    console.log(chalk_1.default.red(`❌ Command failed: ${cmd.command}`));
                    console.log(chalk_1.default.gray('Stopping execution due to failure'));
                    break;
                }
                else {
                    console.log(chalk_1.default.green(`✅ Command completed: ${cmd.command}`));
                }
            }
            return {
                success: results.every(r => r.success),
                plan,
                results,
                executed: results.length,
                total: (planResult.commands || []).length,
            };
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error planning commands: ${error.message}`));
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async installDependencies(packages, options = {}) {
        console.log(chalk_1.default.blue(`📦 Installing packages: ${packages.join(', ')}`));
        const results = [];
        const manager = options.manager || 'npm';
        for (const pkg of packages) {
            console.log(chalk_1.default.cyan(`Installing ${pkg} with ${manager}...`));
            const success = await tools_manager_1.toolsManager.installPackage(pkg, {
                global: options.global,
                dev: options.dev,
                manager: manager,
            });
            results.push({ package: pkg, success });
            if (!success) {
                console.log(chalk_1.default.yellow(`⚠️ Failed to install ${pkg}, continuing with others...`));
            }
        }
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        console.log(chalk_1.default.blue.bold(`\n📊 Installation Summary:`));
        console.log(chalk_1.default.green(`✅ Successful: ${successful}`));
        console.log(chalk_1.default.red(`❌ Failed: ${failed}`));
        return {
            success: failed === 0,
            results,
            summary: { successful, failed, total: packages.length },
        };
    }
    async manageProcesses(action, pid) {
        if (action === 'list') {
            const processes = tools_manager_1.toolsManager.getRunningProcesses();
            console.log(chalk_1.default.blue.bold('\n🔄 Running Processes:'));
            if (processes.length === 0) {
                console.log(chalk_1.default.gray('No processes currently running'));
                return { processes: [] };
            }
            processes.forEach(proc => {
                const duration = Date.now() - proc.startTime.getTime();
                console.log(`PID ${chalk_1.default.cyan(proc.pid.toString())}: ${chalk_1.default.bold(proc.command)} ${proc.args.join(' ')}`);
                console.log(`   Status: ${proc.status} | Duration: ${Math.round(duration / 1000)}s`);
                console.log(`   Working Dir: ${proc.cwd}`);
            });
            return { processes };
        }
        else if (action === 'kill' && pid) {
            console.log(chalk_1.default.yellow(`⚠️ Attempting to kill process ${pid}...`));
            const success = await tools_manager_1.toolsManager.killProcess(pid);
            return {
                success,
                action: 'kill',
                pid,
            };
        }
        return { error: 'Invalid action or missing PID' };
    }
    async createProject(projectType, projectName) {
        console.log(chalk_1.default.blue(`🚀 Creating ${projectType} project: ${projectName}`));
        const validTypes = ['react', 'next', 'node', 'express'];
        if (!validTypes.includes(projectType)) {
            return {
                success: false,
                error: `Invalid project type. Supported: ${validTypes.join(', ')}`,
            };
        }
        const result = await tools_manager_1.toolsManager.setupProject(projectType, projectName);
        return result;
    }
    async runScript(script, language = 'bash') {
        console.log(chalk_1.default.blue(`📝 Running ${language} script...`));
        console.log(chalk_1.default.gray(`Script:\n${script}`));
        const result = await tools_manager_1.toolsManager.runScript(script, { language });
        if (result.success) {
            console.log(chalk_1.default.green('✅ Script executed successfully'));
        }
        else {
            console.log(chalk_1.default.red('❌ Script execution failed'));
        }
        console.log(chalk_1.default.blue('Output:'));
        console.log(result.output);
        return result;
    }
    async monitorSystem(duration = 30) {
        console.log(chalk_1.default.blue(`👀 Monitoring system for ${duration} seconds...`));
        const startTime = Date.now();
        const samples = [];
        const interval = setInterval(async () => {
            const systemInfo = await tools_manager_1.toolsManager.getSystemInfo();
            const processes = tools_manager_1.toolsManager.getRunningProcesses();
            samples.push({
                timestamp: new Date(),
                memoryUsed: systemInfo.memory.used,
                processCount: processes.length,
            });
            console.log(chalk_1.default.cyan(`📊 Memory: ${Math.round(systemInfo.memory.used / 1024 / 1024 / 1024 * 100) / 100}GB | Processes: ${processes.length}`));
        }, 5000); // Sample every 5 seconds
        setTimeout(() => {
            clearInterval(interval);
            console.log(chalk_1.default.green(`✅ Monitoring complete. Collected ${samples.length} samples`));
        }, duration * 1000);
        return {
            duration,
            samplesCollected: samples.length,
            monitoringActive: true,
        };
    }
    async onExecuteTask(task) {
        const taskData = typeof task === 'string' ? task : task.data;
        if (!taskData) {
            return {
                message: 'System Admin Agent ready! I can execute terminal commands, manage processes, install packages, and monitor the system.',
                capabilities: [
                    'Execute any terminal command safely',
                    'Install packages and dependencies',
                    'Manage running processes',
                    'Create new projects',
                    'Run scripts in multiple languages',
                    'Monitor system resources',
                    'Analyze system configuration',
                ],
                availableCommands: [
                    'analyze system',
                    'install <packages>',
                    'run command: <command>',
                    'create project <type> <name>',
                    'run script: <script>',
                    'list processes',
                    'kill process <pid>',
                    'monitor system',
                ],
            };
        }
        const lowerTask = taskData.toLowerCase();
        try {
            if (lowerTask.includes('analyze') || lowerTask.includes('system info')) {
                return await this.analyzeSystem();
            }
            if (lowerTask.includes('install')) {
                const packages = taskData.match(/install\s+(.+)/i)?.[1]?.split(/\s+/) || [];
                const isGlobal = lowerTask.includes('global') || lowerTask.includes('-g');
                const isDev = lowerTask.includes('dev') || lowerTask.includes('--save-dev');
                return await this.installDependencies(packages, { global: isGlobal, dev: isDev });
            }
            if (lowerTask.includes('run command') || lowerTask.includes('execute')) {
                const command = taskData.replace(/(run command|execute):\s*/i, '');
                return await this.executeCommands(command);
            }
            if (lowerTask.includes('create project')) {
                const match = taskData.match(/create project\s+(\w+)\s+(.+)/i);
                if (match) {
                    const [, type, name] = match;
                    return await this.createProject(type, name);
                }
            }
            if (lowerTask.includes('run script')) {
                const script = taskData.replace(/run script:\s*/i, '');
                const language = lowerTask.includes('python') ? 'python' :
                    lowerTask.includes('node') ? 'node' : 'bash';
                return await this.runScript(script, language);
            }
            if (lowerTask.includes('list process') || lowerTask.includes('show process')) {
                return await this.manageProcesses('list');
            }
            if (lowerTask.includes('kill process')) {
                const pid = parseInt(taskData.match(/kill process\s+(\d+)/i)?.[1] || '');
                if (pid) {
                    return await this.manageProcesses('kill', pid);
                }
            }
            if (lowerTask.includes('monitor')) {
                const duration = parseInt(taskData.match(/monitor.*?(\d+)/)?.[1] || '30');
                return await this.monitorSystem(duration);
            }
            // Default: treat as command execution
            return await this.executeCommands(taskData);
        }
        catch (error) {
            return {
                error: `System administration failed: ${error.message}`,
                taskData,
            };
        }
    }
    // Keep legacy methods for backward compatibility
    async run(taskData) {
        return await this.onExecuteTask(taskData);
    }
    async cleanup() {
        return await this.onStop();
    }
}
exports.SystemAdminAgent = SystemAdminAgent;
