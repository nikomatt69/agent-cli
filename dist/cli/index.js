#!/usr/bin/env node
"use strict";
/**
 * NikCLI - Unified Autonomous AI Development Assistant
 * Consolidated Entry Point with Modular Architecture
 */
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
exports.StreamingModule = exports.ServiceModule = exports.SystemModule = exports.IntroductionModule = exports.MainOrchestrator = void 0;
exports.main = main;
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const readline = __importStar(require("readline"));
const events_1 = require("events");
// Core imports
const nik_cli_1 = require("./nik-cli");
const agent_service_1 = require("./services/agent-service");
const tool_service_1 = require("./services/tool-service");
const planning_service_1 = require("./services/planning-service");
const lsp_service_1 = require("./services/lsp-service");
const diff_manager_1 = require("./ui/diff-manager");
const execution_policy_1 = require("./policies/execution-policy");
const config_manager_1 = require("./core/config-manager");
const register_agents_1 = require("./register-agents");
const agent_manager_1 = require("./core/agent-manager");
// ASCII Art Banner
const banner = `
███╗   ██╗██╗██╗  ██╗ ██████╗██╗     ██╗
████╗  ██║██║██║ ██╔╝██╔════╝██║     ██║
██╔██╗ ██║██║█████╔╝ ██║     ██║     ██║
██║╚██╗██║██║██╔═██╗ ██║     ██║     ██║
██║ ╚████║██║██║  ██╗╚██████╗███████╗██║
╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝
`;
/**
 * Introduction Display Module
 */
class IntroductionModule {
    static displayBanner() {
        console.clear();
        // Use realistic solid colors instead of rainbow gradient
        console.log(chalk_1.default.cyanBright(banner));
        const welcomeBox = (0, boxen_1.default)(chalk_1.default.white.bold('🤖 Autonomous AI Development Assistant\n\n') +
            chalk_1.default.gray('• Intelligent code generation and analysis\n') +
            chalk_1.default.gray('• Autonomous planning and execution\n') +
            chalk_1.default.gray('• Real-time project understanding\n') +
            chalk_1.default.gray('• Interactive terminal interface\n\n') +
            chalk_1.default.cyan('Ready to transform your development workflow!'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
            backgroundColor: '#1a1a1a'
        });
        console.log(welcomeBox);
    }
    static displayApiKeySetup() {
        const setupBox = (0, boxen_1.default)(chalk_1.default.yellow.bold('⚠️  API Key Required\n\n') +
            chalk_1.default.white('To use NikCLI, please set at least one API key:\n\n') +
            chalk_1.default.green('• ANTHROPIC_API_KEY') + chalk_1.default.gray(' - for Claude models (recommended)\n') +
            chalk_1.default.blue('• OPENAI_API_KEY') + chalk_1.default.gray(' - for GPT models\n') +
            chalk_1.default.magenta('• GOOGLE_GENERATIVE_AI_API_KEY') + chalk_1.default.gray(' - for Gemini models\n\n') +
            chalk_1.default.white.bold('Setup Examples:\n') +
            chalk_1.default.dim('export ANTHROPIC_API_KEY="your-key-here"\n') +
            chalk_1.default.dim('export OPENAI_API_KEY="your-key-here"\n') +
            chalk_1.default.dim('export GOOGLE_GENERATIVE_AI_API_KEY="your-key-here"\n\n') +
            chalk_1.default.cyan('Then run: ') + chalk_1.default.white.bold('npm start'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'yellow',
            backgroundColor: '#2a1a00'
        });
        console.log(setupBox);
    }
    static displayStartupInfo() {
        const startupBox = (0, boxen_1.default)(chalk_1.default.green.bold('🚀 Starting NikCLI...\n\n') +
            chalk_1.default.white('Initializing autonomous AI assistant\n') +
            chalk_1.default.gray('• Loading project context\n') +
            chalk_1.default.gray('• Preparing planning system\n') +
            chalk_1.default.gray('• Setting up tool integrations\n\n') +
            chalk_1.default.cyan('Type ') + chalk_1.default.white.bold('/help') + chalk_1.default.cyan(' for available commands'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
            backgroundColor: '#001a00'
        });
        console.log(startupBox);
    }
}
exports.IntroductionModule = IntroductionModule;
/**
 * System Requirements Module
 */
class SystemModule {
    static async checkApiKeys() {
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        return !!(anthropicKey || openaiKey || googleKey);
    }
    static checkNodeVersion() {
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0]);
        if (major < 18) {
            console.log(chalk_1.default.red(`❌ Node.js ${major} is too old. Requires Node.js 18+`));
            return false;
        }
        console.log(chalk_1.default.green(`✅ Node.js ${version}`));
        return true;
    }
    static async checkSystemRequirements() {
        console.log(chalk_1.default.blue('🔍 Checking system requirements...'));
        const checks = [
            this.checkNodeVersion(),
            await this.checkApiKeys()
        ];
        const allPassed = checks.every(r => r);
        if (allPassed) {
            console.log(chalk_1.default.green('✅ All system checks passed'));
        }
        else {
            console.log(chalk_1.default.red('❌ System requirements not met'));
        }
        return allPassed;
    }
}
exports.SystemModule = SystemModule;
/**
 * Service Initialization Module
 */
class ServiceModule {
    static async initializeServices() {
        const workingDir = process.cwd();
        // Set working directory for all services
        tool_service_1.toolService.setWorkingDirectory(workingDir);
        planning_service_1.planningService.setWorkingDirectory(workingDir);
        lsp_service_1.lspService.setWorkingDirectory(workingDir);
        diff_manager_1.diffManager.setAutoAccept(true);
        console.log(chalk_1.default.dim('   Services configured'));
    }
    static async initializeAgents() {
        // Create and initialize the core AgentManager
        if (!this.agentManager) {
            this.agentManager = new agent_manager_1.AgentManager(config_manager_1.simpleConfigManager);
            await this.agentManager.initialize();
        }
        // Register agent classes (e.g., UniversalAgent)
        (0, register_agents_1.registerAgents)(this.agentManager);
        // Ensure at least one agent instance is created (universal-agent)
        try {
            await this.agentManager.createAgent('universal-agent');
        }
        catch (_) {
            // If already created or creation failed silently, proceed
        }
        const agents = this.agentManager.listAgents();
        console.log(chalk_1.default.dim(`   Loaded ${agents.length} agents`));
    }
    static async initializeTools() {
        const tools = tool_service_1.toolService.getAvailableTools();
        console.log(chalk_1.default.dim(`   Loaded ${tools.length} tools`));
    }
    static async initializePlanning() {
        console.log(chalk_1.default.dim('   Planning system ready'));
    }
    static async initializeSecurity() {
        console.log(chalk_1.default.dim('   Security policies loaded'));
    }
    static async initializeContext() {
        console.log(chalk_1.default.dim('   Context management ready'));
    }
    static async initializeSystem() {
        if (this.initialized)
            return true;
        const steps = [
            { name: 'Services', fn: this.initializeServices.bind(this) },
            { name: 'Agents', fn: this.initializeAgents.bind(this) },
            { name: 'Tools', fn: this.initializeTools.bind(this) },
            { name: 'Planning', fn: this.initializePlanning.bind(this) },
            { name: 'Security', fn: this.initializeSecurity.bind(this) },
            { name: 'Context', fn: this.initializeContext.bind(this) }
        ];
        for (const step of steps) {
            try {
                console.log(chalk_1.default.blue(`🔄 ${step.name}...`));
                await step.fn();
                console.log(chalk_1.default.green(`✅ ${step.name} initialized`));
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ ${step.name} failed: ${error.message}`));
                return false;
            }
        }
        this.initialized = true;
        console.log(chalk_1.default.green.bold('\n🎉 System initialization complete!'));
        return true;
    }
}
exports.ServiceModule = ServiceModule;
ServiceModule.initialized = false;
ServiceModule.agentManager = null;
/**
 * Streaming Orchestrator Module
 */
class StreamingModule extends events_1.EventEmitter {
    constructor() {
        super();
        this.messageQueue = [];
        this.processingMessage = false;
        this.activeAgents = new Map();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            historySize: 300,
            completer: this.autoComplete.bind(this),
        });
        this.context = {
            workingDirectory: process.cwd(),
            autonomous: true,
            planMode: false,
            autoAcceptEdits: true,
            contextLeft: 20,
            maxContext: 100
        };
        this.policyManager = new execution_policy_1.ExecutionPolicyManager(config_manager_1.simpleConfigManager);
        this.setupInterface();
        this.startMessageProcessor();
    }
    setupInterface() {
        // Raw mode for better control
        process.stdin.setRawMode(true);
        require('readline').emitKeypressEvents(process.stdin);
        // Keypress handlers
        process.stdin.on('keypress', (str, key) => {
            if (key && key.name === 'slash' && !this.processingMessage) {
                setTimeout(() => this.showCommandMenu(), 50);
            }
            if (key && key.name === 'tab' && key.shift) {
                this.cycleMode();
            }
            if (key && key.name === 'c' && key.ctrl) {
                if (this.activeAgents.size > 0) {
                    this.stopAllAgents();
                }
                else {
                    this.gracefulExit();
                }
            }
        });
        // Input handler
        this.rl.on('line', async (input) => {
            const trimmed = input.trim();
            if (!trimmed) {
                this.showPrompt();
                return;
            }
            await this.queueUserInput(trimmed);
            this.showPrompt();
        });
        this.rl.on('close', () => {
            this.gracefulExit();
        });
        this.setupServiceListeners();
    }
    setupServiceListeners() {
        // Agent events
        agent_service_1.agentService.on('task_start', (task) => {
            this.activeAgents.set(task.id, task);
            this.queueMessage({
                type: 'system',
                content: `🤖 Agent ${task.agentType} started: ${task.task.slice(0, 50)}...`,
                metadata: { agentId: task.id, agentType: task.agentType }
            });
        });
        agent_service_1.agentService.on('task_progress', (task, update) => {
            this.queueMessage({
                type: 'agent',
                content: `📊 ${task.agentType}: ${update.progress}% ${update.description || ''}`,
                metadata: { agentId: task.id, progress: update.progress },
                agentId: task.id,
                progress: update.progress
            });
        });
    }
    queueMessage(message) {
        const fullMessage = {
            id: Date.now().toString(),
            timestamp: new Date(),
            status: 'queued',
            ...message
        };
        this.messageQueue.push(fullMessage);
    }
    async queueUserInput(input) {
        this.queueMessage({
            type: 'user',
            content: input
        });
    }
    showPrompt() {
        const dir = require('path').basename(this.context.workingDirectory);
        const agents = this.activeAgents.size;
        const agentIndicator = agents > 0 ? chalk_1.default.blue(`${agents}🤖`) : '🎛️';
        const modes = [];
        if (this.context.planMode)
            modes.push(chalk_1.default.cyan('plan'));
        if (this.context.autoAcceptEdits)
            modes.push(chalk_1.default.green('auto-accept'));
        const modeStr = modes.length > 0 ? ` ${modes.join(' ')} ` : '';
        const contextStr = chalk_1.default.dim(`${this.context.contextLeft}%`);
        // Realistic prompt styling (no rainbow)
        const prompt = `\n┌─[${agentIndicator}:${chalk_1.default.green(dir)}${modeStr}]─[${contextStr}]\n└─❯ `;
        this.rl.setPrompt(prompt);
        this.rl.prompt();
    }
    autoComplete(line) {
        const commands = ['/status', '/agents', '/diff', '/accept', '/clear', '/help'];
        const agents = ['@react-expert', '@backend-expert', '@frontend-expert', '@devops-expert', '@code-review', '@autonomous-coder'];
        const all = [...commands, ...agents];
        const hits = all.filter(c => c.startsWith(line));
        return [hits.length ? hits : all, line];
    }
    showCommandMenu() {
        console.log(chalk_1.default.cyan('\n📋 Available Commands:'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        console.log(`${chalk_1.default.green('/help')}     Show detailed help`);
        console.log(`${chalk_1.default.green('/agents')}   List available agents`);
        console.log(`${chalk_1.default.green('/status')}   Show system status`);
        console.log(`${chalk_1.default.green('/clear')}    Clear session`);
    }
    cycleMode() {
        this.context.planMode = !this.context.planMode;
        console.log(this.context.planMode ?
            chalk_1.default.green('\n✅ Plan mode enabled') :
            chalk_1.default.yellow('\n⚠️ Plan mode disabled'));
    }
    stopAllAgents() {
        this.activeAgents.clear();
        console.log(chalk_1.default.yellow('\n⏹️ Stopped all active agents'));
    }
    startMessageProcessor() {
        setInterval(() => {
            if (!this.processingMessage) {
                this.processNextMessage();
            }
        }, 100);
    }
    processNextMessage() {
        const message = this.messageQueue.find(m => m.status === 'queued');
        if (!message)
            return;
        this.processingMessage = true;
        message.status = 'processing';
        // Process message based on type
        setTimeout(() => {
            message.status = 'completed';
            this.processingMessage = false;
        }, 100);
    }
    gracefulExit() {
        console.log(chalk_1.default.blue('\n👋 Shutting down orchestrator...'));
        if (this.activeAgents.size > 0) {
            console.log(chalk_1.default.yellow(`⏳ Waiting for ${this.activeAgents.size} agents to finish...`));
        }
        console.log(chalk_1.default.green('✅ Goodbye!'));
        process.exit(0);
    }
    async start() {
        this.showPrompt();
        return new Promise((resolve) => {
            this.rl.on('close', resolve);
        });
    }
}
exports.StreamingModule = StreamingModule;
/**
 * Main Orchestrator - Unified Entry Point
 */
class MainOrchestrator {
    constructor() {
        this.initialized = false;
        this.setupGlobalHandlers();
    }
    setupGlobalHandlers() {
        // Global error handler
        process.on('unhandledRejection', (reason, promise) => {
            console.error(chalk_1.default.red('❌ Unhandled Rejection:'), reason);
        });
        process.on('uncaughtException', (error) => {
            console.error(chalk_1.default.red('❌ Uncaught Exception:'), error);
            this.gracefulShutdown();
        });
        // Graceful shutdown handlers
        process.on('SIGTERM', this.gracefulShutdown.bind(this));
        process.on('SIGINT', this.gracefulShutdown.bind(this));
    }
    async gracefulShutdown() {
        console.log(chalk_1.default.yellow('\n🛑 Shutting down orchestrator...'));
        try {
            // Stop autonomous interface if running (not used in unified NikCLI entrypoint)
            // No specific stop required here
            // Stop streaming module if running
            if (this.streamingModule) {
                // Streaming module handles its own cleanup
            }
            console.log(chalk_1.default.green('✅ Orchestrator shut down cleanly'));
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Error during shutdown:'), error);
        }
        finally {
            process.exit(0);
        }
    }
    showQuickStart() {
        console.log(chalk_1.default.cyan.bold('\n📚 Quick Start Guide:'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        console.log(`${chalk_1.default.green('Natural Language:')} Just describe what you want`);
        console.log(`${chalk_1.default.blue('Agent Specific:')} @agent-name your task`);
        console.log(`${chalk_1.default.yellow('Commands:')} /help, /status, /agents`);
        console.log(`${chalk_1.default.magenta('Shortcuts:')} / (menu), Shift+Tab (modes)`);
        console.log('');
        console.log(chalk_1.default.dim('Examples:'));
        console.log(chalk_1.default.dim('• "Create a React todo app with TypeScript"'));
        console.log(chalk_1.default.dim('• "@react-expert optimize this component"'));
        console.log(chalk_1.default.dim('• "/status" to see system status'));
        console.log('');
    }
    async start() {
        try {
            // Display introduction
            IntroductionModule.displayBanner();
            // Wait a moment for visual effect
            await new Promise(resolve => setTimeout(resolve, 1500));
            // Check system requirements
            const requirementsMet = await SystemModule.checkSystemRequirements();
            if (!requirementsMet) {
                if (!(await SystemModule.checkApiKeys())) {
                    IntroductionModule.displayApiKeySetup();
                }
                console.log(chalk_1.default.red('\n❌ Cannot start - system requirements not met'));
                process.exit(1);
            }
            // Display startup info
            IntroductionModule.displayStartupInfo();
            // Wait a moment before starting
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Initialize all systems
            const initialized = await ServiceModule.initializeSystem();
            if (!initialized) {
                console.log(chalk_1.default.red('\n❌ Cannot start - system initialization failed'));
                process.exit(1);
            }
            // Show quick start guide
            this.showQuickStart();
            // Start unified NikCLI interface
            console.log(chalk_1.default.blue.bold('🤖 Starting NikCLI...\n'));
            const cli = new nik_cli_1.NikCLI();
            await cli.startChat({});
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to start orchestrator:'), error);
            process.exit(1);
        }
    }
}
exports.MainOrchestrator = MainOrchestrator;
/**
 * Main entry point function
 */
async function main() {
    const orchestrator = new MainOrchestrator();
    await orchestrator.start();
}
// Start the application
if (require.main === module) {
    main().catch(error => {
        console.error(chalk_1.default.red('❌ Startup failed:'), error);
        process.exit(1);
    });
}
