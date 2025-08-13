#!/usr/bin/env node
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
exports.StreamingOrchestrator = void 0;
const chalk_1 = __importDefault(require("chalk"));
const readline = __importStar(require("readline"));
const events_1 = require("events");
const agent_service_1 = require("./services/agent-service");
const tool_service_1 = require("./services/tool-service");
const planning_service_1 = require("./services/planning-service");
const lsp_service_1 = require("./services/lsp-service");
const diff_manager_1 = require("./ui/diff-manager");
const execution_policy_1 = require("./policies/execution-policy");
const config_manager_1 = require("./core/config-manager");
class StreamingOrchestratorImpl extends events_1.EventEmitter {
    constructor() {
        super();
        // Message streaming system
        this.messageQueue = [];
        this.processingMessage = false;
        this.activeAgents = new Map();
        this.streamBuffer = '';
        this.lastUpdate = Date.now();
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
            autoAcceptEdits: true, // Default from image
            contextLeft: 20, // Show percentage like in image
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
        // Setup service listeners
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
        agent_service_1.agentService.on('tool_use', (task, update) => {
            this.queueMessage({
                type: 'tool',
                content: `🔧 ${task.agentType} using ${update.tool}: ${update.description}`,
                metadata: { agentId: task.id, tool: update.tool }
            });
        });
        agent_service_1.agentService.on('task_complete', (task) => {
            this.activeAgents.delete(task.id);
            if (task.status === 'completed') {
                this.queueMessage({
                    type: 'system',
                    content: `✅ Agent ${task.agentType} completed successfully`,
                    metadata: { agentId: task.id, result: task.result }
                });
                // Auto-absorb completed messages after 2 seconds
                setTimeout(() => this.absorbCompletedMessages(), 2000);
            }
            else {
                this.queueMessage({
                    type: 'error',
                    content: `❌ Agent ${task.agentType} failed: ${task.error}`,
                    metadata: { agentId: task.id, error: task.error }
                });
            }
        });
    }
    async queueUserInput(input) {
        const message = {
            id: `user_${Date.now()}`,
            type: 'user',
            content: input,
            timestamp: new Date(),
            status: 'queued'
        };
        this.messageQueue.push(message);
        // Process immediately if not busy
        if (!this.processingMessage && this.messageQueue.length === 1) {
            this.processNextMessage();
        }
    }
    queueMessage(partial) {
        const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            status: 'queued',
            ...partial
        };
        this.messageQueue.push(message);
        this.displayMessage(message);
    }
    async processNextMessage() {
        if (this.processingMessage || this.messageQueue.length === 0)
            return;
        const message = this.messageQueue.find(m => m.status === 'queued');
        if (!message)
            return;
        this.processingMessage = true;
        message.status = 'processing';
        try {
            if (message.type === 'user') {
                await this.handleUserMessage(message);
            }
        }
        catch (error) {
            this.queueMessage({
                type: 'error',
                content: `❌ Error processing message: ${error.message}`
            });
        }
        finally {
            message.status = 'completed';
            this.processingMessage = false;
            // Process next message
            setTimeout(() => this.processNextMessage(), 100);
        }
    }
    async handleUserMessage(message) {
        const input = message.content;
        // Handle commands
        if (input.startsWith('/')) {
            await this.handleCommand(input);
            return;
        }
        // Handle agent requests
        if (input.startsWith('@')) {
            const match = input.match(/^@(\\w+[-\\w]*)/);
            if (match) {
                const agentName = match[1];
                const task = input.replace(match[0], '').trim();
                await this.launchAgent(agentName, task);
                return;
            }
        }
        // Natural language - autonomous processing
        await this.processNaturalLanguage(input);
    }
    async handleCommand(command) {
        const [cmd, ...args] = command.slice(1).split(' ');
        switch (cmd) {
            case 'status':
                this.showStatus();
                break;
            case 'agents':
                this.showActiveAgents();
                break;
            case 'diff':
                if (args[0]) {
                    diff_manager_1.diffManager.showDiff(args[0]);
                }
                else {
                    diff_manager_1.diffManager.showAllDiffs();
                }
                break;
            case 'accept':
                if (args[0] === 'all') {
                    diff_manager_1.diffManager.acceptAllDiffs();
                }
                else if (args[0]) {
                    diff_manager_1.diffManager.acceptDiff(args[0]);
                }
                break;
            case 'clear':
                this.clearMessages();
                break;
            case 'help':
                this.showHelp();
                break;
            default:
                this.queueMessage({
                    type: 'error',
                    content: `❌ Unknown command: ${cmd}`
                });
        }
    }
    async launchAgent(agentName, task) {
        if (!task) {
            this.queueMessage({
                type: 'error',
                content: `❌ Agent ${agentName} requires a task description`
            });
            return;
        }
        try {
            // Check if we have capacity (max 3 agents)
            if (this.activeAgents.size >= 3) {
                this.queueMessage({
                    type: 'system',
                    content: `⏳ Agent ${agentName} queued (${this.activeAgents.size}/3 active)`
                });
            }
            const taskId = await agent_service_1.agentService.executeTask(agentName, task);
            this.queueMessage({
                type: 'system',
                content: `🚀 Launched ${agentName} agent (Task ID: ${taskId.slice(-6)})`
            });
        }
        catch (error) {
            this.queueMessage({
                type: 'error',
                content: `❌ Failed to launch ${agentName}: ${error.message}`
            });
        }
    }
    async processNaturalLanguage(input) {
        this.queueMessage({
            type: 'system',
            content: `🧠 Processing: "${input}"`
        });
        // Select best agent for the task
        const selectedAgent = this.selectBestAgent(input);
        if (this.context.planMode) {
            this.queueMessage({
                type: 'system',
                content: `🎯 Plan Mode: Creating execution plan...`
            });
            try {
                const plan = await planning_service_1.planningService.createPlan(input, {
                    showProgress: false,
                    autoExecute: this.context.autonomous,
                    confirmSteps: false
                });
                this.queueMessage({
                    type: 'system',
                    content: `📋 Generated plan with ${plan.steps.length} steps`
                });
                // Execute plan
                setTimeout(async () => {
                    await planning_service_1.planningService.executePlan(plan.id, {
                        showProgress: true,
                        autoExecute: true,
                        confirmSteps: false
                    });
                }, 1000);
            }
            catch (error) {
                this.queueMessage({
                    type: 'error',
                    content: `❌ Planning failed: ${error.message}`
                });
            }
        }
        else {
            // Direct agent execution
            await this.launchAgent(selectedAgent, input);
        }
    }
    selectBestAgent(input) {
        const lower = input.toLowerCase();
        if (lower.includes('react') || lower.includes('component'))
            return 'react-expert';
        if (lower.includes('backend') || lower.includes('api'))
            return 'backend-expert';
        if (lower.includes('frontend') || lower.includes('ui'))
            return 'frontend-expert';
        if (lower.includes('deploy') || lower.includes('docker'))
            return 'devops-expert';
        if (lower.includes('review') || lower.includes('analyze'))
            return 'code-review';
        return 'autonomous-coder';
    }
    displayMessage(message) {
        const timestamp = message.timestamp.toLocaleTimeString('en-GB', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        let prefix = '';
        let content = message.content;
        let color = chalk_1.default.white;
        switch (message.type) {
            case 'user':
                prefix = '>';
                color = chalk_1.default.green;
                break;
            case 'system':
                prefix = '•';
                color = chalk_1.default.blue;
                break;
            case 'agent':
                prefix = '🤖';
                color = chalk_1.default.cyan;
                break;
            case 'tool':
                prefix = '🔧';
                color = chalk_1.default.magenta;
                break;
            case 'error':
                prefix = '❌';
                color = chalk_1.default.red;
                break;
            case 'diff':
                prefix = '📝';
                color = chalk_1.default.yellow;
                break;
        }
        const statusIndicator = message.status === 'completed' ? '' :
            message.status === 'processing' ? chalk_1.default.yellow('⏳') :
                message.status === 'absorbed' ? chalk_1.default.dim('📤') : '';
        console.log(`${chalk_1.default.dim(timestamp)} ${prefix} ${color(content)} ${statusIndicator}`);
        // Show progress bar for agent messages
        if (message.progress && message.progress > 0) {
            const progressBar = this.createProgressBar(message.progress);
            console.log(`${' '.repeat(timestamp.length + 2)}${progressBar}`);
        }
    }
    createProgressBar(progress, width = 20) {
        const filled = Math.round((progress / 100) * width);
        const empty = width - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        return chalk_1.default.blue(`[${bar}] ${progress}%`);
    }
    absorbCompletedMessages() {
        let absorbed = 0;
        this.messageQueue.forEach(msg => {
            if (msg.status === 'completed' && msg.type !== 'user') {
                msg.status = 'absorbed';
                absorbed++;
            }
        });
        if (absorbed > 0) {
            console.log(chalk_1.default.dim(`📤 Absorbed ${absorbed} completed messages`));
            this.updateContextCounter();
        }
    }
    updateContextCounter() {
        const activeMessages = this.messageQueue.filter(m => m.status !== 'absorbed').length;
        this.context.contextLeft = Math.max(0, this.context.maxContext - activeMessages);
    }
    clearMessages() {
        const cleared = this.messageQueue.length;
        this.messageQueue = [];
        this.context.contextLeft = this.context.maxContext;
        console.clear();
        console.log(chalk_1.default.green(`✅ Cleared ${cleared} messages`));
    }
    showStatus() {
        const active = this.activeAgents.size;
        const queued = agent_service_1.agentService.getQueuedTasks().length;
        const pending = diff_manager_1.diffManager.getPendingCount();
        console.log(chalk_1.default.cyan.bold('\\n🎛️ Orchestrator Status'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        console.log(`${chalk_1.default.blue('Working Dir:')} ${this.context.workingDirectory}`);
        console.log(`${chalk_1.default.blue('Active Agents:')} ${active}/3`);
        console.log(`${chalk_1.default.blue('Queued Tasks:')} ${queued}`);
        console.log(`${chalk_1.default.blue('Messages:')} ${this.messageQueue.length}`);
        console.log(`${chalk_1.default.blue('Pending Diffs:')} ${pending}`);
        console.log(`${chalk_1.default.blue('Context Left:')} ${this.context.contextLeft}%`);
    }
    showActiveAgents() {
        if (this.activeAgents.size === 0) {
            console.log(chalk_1.default.yellow('No active agents'));
            return;
        }
        console.log(chalk_1.default.cyan.bold('\\n🤖 Active Agents'));
        console.log(chalk_1.default.gray('─'.repeat(30)));
        this.activeAgents.forEach(agent => {
            console.log(`${chalk_1.default.blue(agent.agentType)} - ${agent.task.slice(0, 40)}...`);
        });
    }
    cycleMode() {
        if (!this.context.planMode && !this.context.autoAcceptEdits) {
            this.context.planMode = true;
            console.log(chalk_1.default.green('\\n✅ plan mode on ') + chalk_1.default.dim('(shift+tab to cycle)'));
        }
        else if (this.context.planMode && !this.context.autoAcceptEdits) {
            this.context.planMode = false;
            this.context.autoAcceptEdits = true;
            diff_manager_1.diffManager.setAutoAccept(true);
            console.log(chalk_1.default.green('\\n✅ auto-accept edits on ') + chalk_1.default.dim('(shift+tab to cycle)'));
        }
        else {
            this.context.planMode = false;
            this.context.autoAcceptEdits = false;
            diff_manager_1.diffManager.setAutoAccept(false);
            console.log(chalk_1.default.yellow('\\n⚠️ manual mode'));
        }
    }
    showCommandMenu() {
        console.log(chalk_1.default.cyan.bold('\\n📋 Available Commands:'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(`${chalk_1.default.green('/status')}        Show orchestrator status`);
        console.log(`${chalk_1.default.green('/agents')}        Show active agents`);
        console.log(`${chalk_1.default.green('/diff')} [file]   Show file changes`);
        console.log(`${chalk_1.default.green('/accept')} [all]  Accept file changes`);
        console.log(`${chalk_1.default.green('/clear')}         Clear message queue`);
        console.log(`${chalk_1.default.green('/help')}          Show detailed help`);
        console.log(chalk_1.default.cyan.bold('\\n🤖 Agent Usage:'));
        console.log(`${chalk_1.default.blue('@agent-name')} task description`);
        console.log(chalk_1.default.dim('Available: react-expert, backend-expert, frontend-expert,'));
        console.log(chalk_1.default.dim('          devops-expert, code-review, autonomous-coder'));
        console.log(chalk_1.default.cyan.bold('\\n💬 Natural Language:'));
        console.log(chalk_1.default.dim('Just describe what you want to accomplish'));
    }
    showHelp() {
        console.log(chalk_1.default.cyan.bold('\\n🎛️ AI Development Orchestrator Help'));
        console.log(chalk_1.default.gray('═'.repeat(60)));
        console.log(chalk_1.default.white.bold('\\nHow it works:'));
        console.log('• Messages are queued and processed in order');
        console.log('• Up to 3 agents can run in parallel');
        console.log('• Completed messages are auto-absorbed');
        console.log('• Context is automatically managed');
        console.log(chalk_1.default.white.bold('\\nKeyboard shortcuts:'));
        console.log('• / - Show command menu');
        console.log('• Shift+Tab - Cycle modes (manual → plan → auto-accept)');
        console.log('• ESC - Return to default chat');
        console.log('• Ctrl+C - Stop agents or exit');
        console.log(chalk_1.default.white.bold('\\nModes:'));
        console.log('• Manual - Ask for confirmation');
        console.log('• Plan - Create execution plans first');
        console.log('• Auto-accept - Apply all changes automatically');
    }
    stopAllAgents() {
        this.activeAgents.clear();
        console.log(chalk_1.default.yellow('\\n⏹️ Stopped all active agents'));
    }
    startMessageProcessor() {
        // Process messages every 100ms
        setInterval(() => {
            if (!this.processingMessage) {
                this.processNextMessage();
            }
            this.updateContextCounter();
        }, 100);
        // Auto-absorb messages every 5 seconds
        setInterval(() => {
            this.absorbCompletedMessages();
        }, 5000);
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
        const prompt = `\n┌─[${agentIndicator}:${chalk_1.default.green(dir)}${modeStr}]─[${contextStr}]\n└─❯ `;
        this.rl.setPrompt(prompt);
        this.rl.prompt();
    }
    autoComplete(line) {
        const commands = [
            '/status', '/agents', '/diff', '/accept', '/clear', '/help'
        ];
        const agents = [
            '@react-expert', '@backend-expert', '@frontend-expert',
            '@devops-expert', '@code-review', '@autonomous-coder'
        ];
        const all = [...commands, ...agents];
        const hits = all.filter(c => c.startsWith(line));
        return [hits.length ? hits : all, line];
    }
    gracefulExit() {
        console.log(chalk_1.default.blue('\n👋 Shutting down orchestrator...'));
        if (this.activeAgents.size > 0) {
            console.log(chalk_1.default.yellow(`⏳ Waiting for ${this.activeAgents.size} agents to finish...`));
            // In production, you'd wait for agents to complete
        }
        console.log(chalk_1.default.green('✅ Goodbye!'));
        process.exit(0);
    }
    async start() {
        console.clear();
        // Check API keys
        const hasKeys = this.checkAPIKeys();
        if (!hasKeys)
            return;
        this.showWelcome();
        this.initializeServices();
        // Start the interface
        this.showPrompt();
        return new Promise((resolve) => {
            this.rl.on('close', resolve);
        });
    }
    checkAPIKeys() {
        const hasAny = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!hasAny) {
            console.log(chalk_1.default.red('❌ No API keys found. Please set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY'));
            return false;
        }
        return true;
    }
    showWelcome() {
        const title = chalk_1.default.cyanBright('🎛️ Streaming AI Development Orchestrator');
        console.log(chalk_1.default.cyan('─'.repeat(80)));
        console.log(title);
        console.log(chalk_1.default.cyan('─'.repeat(80)));
        console.log(`${chalk_1.default.blue('Directory:')} ${this.context.workingDirectory}`);
        console.log(`${chalk_1.default.blue('Max Agents:')} 3 parallel`);
        console.log(`${chalk_1.default.blue('Mode:')} ${this.context.autoAcceptEdits ? 'Auto-accept' : 'Manual'}`);
        console.log(chalk_1.default.dim('\nPress / for commands, @ for agents, or describe what you want to do\n'));
    }
    async initializeServices() {
        // Initialize all services
        tool_service_1.toolService.setWorkingDirectory(this.context.workingDirectory);
        planning_service_1.planningService.setWorkingDirectory(this.context.workingDirectory);
        lsp_service_1.lspService.setWorkingDirectory(this.context.workingDirectory);
        // Auto-start relevant services
        await lsp_service_1.lspService.autoStartServers(this.context.workingDirectory);
        console.log(chalk_1.default.dim('🚀 Services initialized'));
    }
}
// Export the class
class StreamingOrchestrator extends StreamingOrchestratorImpl {
}
exports.StreamingOrchestrator = StreamingOrchestrator;
// Start the orchestrator if this file is run directly
if (require.main === module) {
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start().catch(console.error);
}
