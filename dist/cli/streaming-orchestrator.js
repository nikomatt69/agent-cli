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
const crypto_1 = require("crypto");
const agent_service_1 = require("./services/agent-service");
const tool_service_1 = require("./services/tool-service");
const planning_service_1 = require("./services/planning-service");
const lsp_service_1 = require("./services/lsp-service");
const diff_manager_1 = require("./ui/diff-manager");
const execution_policy_1 = require("./policies/execution-policy");
const config_manager_1 = require("./core/config-manager");
const input_queue_1 = require("./core/input-queue");
const performance_optimizer_1 = require("./core/performance-optimizer");
class StreamingOrchestratorImpl extends events_1.EventEmitter {
    constructor(optimizationConfig) {
        super();
        this.messageQueue = [];
        this.processingMessage = false;
        this.activeAgents = new Map();
        this.streamBuffer = '';
        this.lastUpdate = Date.now();
        this.inputQueueEnabled = true;
        this.tokenOptimizer = new performance_optimizer_1.TokenOptimizer(optimizationConfig);
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
        process.stdin.setRawMode(true);
        require('readline').emitKeypressEvents(process.stdin);
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
        this.rl.on('line', async (input) => {
            const trimmed = input.trim();
            if (!trimmed) {
                this.showPrompt();
                return;
            }
            if (this.inputQueueEnabled && (this.processingMessage || this.activeAgents.size > 0) && input_queue_1.inputQueue.shouldQueue(trimmed)) {
                let priority = 'normal';
                if (trimmed.startsWith('/') || trimmed.startsWith('@')) {
                    priority = 'high';
                }
                else if (trimmed.toLowerCase().includes('urgent') || trimmed.toLowerCase().includes('stop')) {
                    priority = 'high';
                }
                else if (trimmed.toLowerCase().includes('later') || trimmed.toLowerCase().includes('low priority')) {
                    priority = 'low';
                }
                const queueId = input_queue_1.inputQueue.enqueue(trimmed, priority, 'user');
                this.queueMessage({
                    type: 'system',
                    content: `📥 Input queued (${priority} priority, ID: ${queueId.slice(-6)}): ${trimmed.substring(0, 40)}${trimmed.length > 40 ? '...' : ''}`
                });
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
        const riskLevel = this.assessInputRisk(input);
        if (riskLevel === 'high') {
            const approved = await this.requestUserApproval(input, riskLevel);
            if (!approved) {
                console.log(chalk_1.default.yellow(`⚠️  Task cancelled by user`));
                return;
            }
        }
        const optimizationResult = await this.tokenOptimizer.optimizePrompt(input);
        const message = {
            id: `user_${Date.now()}`,
            type: 'user',
            content: optimizationResult.content,
            timestamp: new Date(),
            status: 'queued',
            metadata: {
                originalTokens: optimizationResult.originalTokens,
                optimizedTokens: optimizationResult.optimizedTokens,
                tokensSaved: optimizationResult.tokensSaved,
                policyChecked: true
            }
        };
        this.messageQueue.push(message);
        if (optimizationResult.tokensSaved > 5) {
            performance_optimizer_1.QuietCacheLogger.logCacheSave(optimizationResult.tokensSaved);
        }
        if (!this.processingMessage && this.messageQueue.length === 1) {
            this.processNextMessage();
        }
    }
    queueMessage(partial) {
        const message = {
            id: `msg_${Date.now()}_${(0, crypto_1.randomBytes)(6).toString('base64url')}`,
            timestamp: new Date(),
            status: 'queued',
            ...partial
        };
        const now = Date.now();
        if (message.type === 'system' && typeof message.content === 'string') {
            if (now - this.lastUpdate < 500 && this.streamBuffer.includes(message.content.substring(0, 50))) {
                this.streamBuffer += `\n${message.content}`;
                this.lastUpdate = now;
                return;
            }
            else {
                if (this.streamBuffer) {
                    this.flushStreamBuffer();
                }
                this.streamBuffer = message.content;
                this.lastUpdate = now;
            }
        }
        if (typeof message.content === 'string' && message.content.length > 50) {
            this.tokenOptimizer.optimizePrompt(message.content).then(result => {
                message.content = result.content;
                if (result.tokensSaved > 3) {
                    performance_optimizer_1.QuietCacheLogger.logCacheSave(result.tokensSaved);
                }
            }).catch(() => {
            });
        }
        this.messageQueue.push(message);
        this.displayMessage(message);
    }
    flushStreamBuffer() {
        if (this.streamBuffer) {
            const bufferedMessage = {
                id: `buffered_${Date.now()}`,
                type: 'system',
                content: this.streamBuffer,
                timestamp: new Date(),
                status: 'completed'
            };
            this.displayMessage(bufferedMessage);
            this.streamBuffer = '';
        }
    }
    assessInputRisk(input) {
        const lowercaseInput = input.toLowerCase();
        const highRiskKeywords = [
            'delete', 'remove', 'rm ', 'sudo', 'chmod', 'format', 'wipe',
            'destroy', 'uninstall', 'drop database', 'truncate', 'reset',
            'factory reset', 'system restore', 'reboot', 'shutdown'
        ];
        const mediumRiskKeywords = [
            'modify', 'change', 'update', 'install', 'configure', 'setup',
            'create database', 'migrate', 'deploy', 'publish', 'push',
            'merge', 'rebase', 'force push'
        ];
        if (highRiskKeywords.some(keyword => lowercaseInput.includes(keyword))) {
            return 'high';
        }
        if (mediumRiskKeywords.some(keyword => lowercaseInput.includes(keyword))) {
            return 'medium';
        }
        return 'low';
    }
    async requestUserApproval(input, riskLevel) {
        return new Promise((resolve) => {
            console.log(chalk_1.default.yellow(`\n⚠️  Risk Level: ${riskLevel.toUpperCase()}`));
            console.log(chalk_1.default.cyan(`Request: ${input}`));
            console.log(chalk_1.default.yellow(`This operation may affect your system. Do you want to proceed?`));
            const rl = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question(chalk_1.default.cyan('Continue? (y/N): '), (answer) => {
                rl.close();
                const approved = answer.toLowerCase().startsWith('y');
                resolve(approved);
            });
        });
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
            setTimeout(() => this.processNextMessage(), 100);
            this.processQueuedInputs();
        }
    }
    async handleUserMessage(message) {
        const input = message.content;
        if (input.startsWith('/')) {
            await this.handleCommand(input);
            return;
        }
        if (input.startsWith('@')) {
            const match = input.match(/^@(\\w+[-\\w]*)/);
            if (match) {
                const agentName = match[1];
                const task = input.replace(match[0], '').trim();
                await this.launchAgent(agentName, task);
                return;
            }
        }
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
            case 'queue':
                this.handleQueueCommand(args);
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
        const queueStatus = input_queue_1.inputQueue.getStatus();
        console.log(chalk_1.default.cyan.bold('\\n🎛️ Orchestrator Status'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        console.log(`${chalk_1.default.blue('Working Dir:')} ${this.context.workingDirectory}`);
        console.log(`${chalk_1.default.blue('Active Agents:')} ${active}/3`);
        console.log(`${chalk_1.default.blue('Queued Tasks:')} ${queued}`);
        console.log(`${chalk_1.default.blue('Messages:')} ${this.messageQueue.length}`);
        console.log(`${chalk_1.default.blue('Pending Diffs:')} ${pending}`);
        console.log(`${chalk_1.default.blue('Context Left:')} ${this.context.contextLeft}%`);
        console.log(`${chalk_1.default.blue('Input Queue:')} ${this.inputQueueEnabled ? 'Enabled' : 'Disabled'}`);
        if (this.inputQueueEnabled) {
            console.log(`${chalk_1.default.blue('  Queued Inputs:')} ${queueStatus.queueLength}`);
            console.log(`${chalk_1.default.blue('  Processing:')} ${queueStatus.isProcessing ? 'Yes' : 'No'}`);
        }
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
        console.log(`${chalk_1.default.green('/queue')} [cmd]   Manage input queue`);
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
        console.log(chalk_1.default.white.bold('\\nQueue Commands:'));
        console.log('• /queue status - Show queue status');
        console.log('• /queue clear - Clear all queued inputs');
        console.log('• /queue enable/disable - Toggle input queue');
        console.log('• /queue process - Process next queued input');
    }
    handleQueueCommand(args) {
        const [subCmd] = args;
        switch (subCmd) {
            case 'status':
                input_queue_1.inputQueue.showStats();
                break;
            case 'clear':
                const cleared = input_queue_1.inputQueue.clear();
                this.queueMessage({
                    type: 'system',
                    content: `🗑️ Cleared ${cleared} inputs from queue`
                });
                break;
            case 'enable':
                this.inputQueueEnabled = true;
                this.queueMessage({
                    type: 'system',
                    content: '✅ Input queue enabled'
                });
                break;
            case 'disable':
                this.inputQueueEnabled = false;
                this.queueMessage({
                    type: 'system',
                    content: '⚠️ Input queue disabled'
                });
                break;
            case 'process':
                this.processQueuedInputs();
                break;
            default:
                console.log(chalk_1.default.cyan.bold('\\n📥 Input Queue Commands:'));
                console.log(chalk_1.default.gray('─'.repeat(40)));
                console.log(`${chalk_1.default.green('/queue status')}   - Show queue statistics`);
                console.log(`${chalk_1.default.green('/queue clear')}    - Clear all queued inputs`);
                console.log(`${chalk_1.default.green('/queue enable')}   - Enable input queue`);
                console.log(`${chalk_1.default.green('/queue disable')}  - Disable input queue`);
                console.log(`${chalk_1.default.green('/queue process')}  - Process next queued input`);
        }
    }
    stopAllAgents() {
        this.activeAgents.clear();
        console.log(chalk_1.default.yellow('\\n⏹️ Stopped all active agents'));
    }
    startMessageProcessor() {
        setInterval(() => {
            if (!this.processingMessage) {
                this.processNextMessage();
            }
            this.updateContextCounter();
        }, 100);
        setInterval(() => {
            this.absorbCompletedMessages();
        }, 5000);
        setInterval(() => {
            this.processQueuedInputs();
        }, 2000);
    }
    async processQueuedInputs() {
        if (!this.inputQueueEnabled || this.processingMessage || this.activeAgents.size > 0) {
            return;
        }
        const status = input_queue_1.inputQueue.getStatus();
        if (status.queueLength === 0) {
            return;
        }
        const result = await input_queue_1.inputQueue.processNext(async (input) => {
            await this.queueUserInput(input);
        });
        if (result) {
            this.queueMessage({
                type: 'system',
                content: `🔄 Processing queued input: ${result.input.substring(0, 40)}${result.input.length > 40 ? '...' : ''}`
            });
        }
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
        const queueStatus = this.inputQueueEnabled ? input_queue_1.inputQueue.getStatus() : null;
        const queueStr = queueStatus && queueStatus.queueLength > 0 ?
            chalk_1.default.yellow(` | 📥${queueStatus.queueLength}`) : '';
        const prompt = `\n┌─[${agentIndicator}:${chalk_1.default.green(dir)}${modeStr}]─[${contextStr}${queueStr}]\n└─❯ `;
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
        }
        console.log(chalk_1.default.green('✅ Goodbye!'));
        process.exit(0);
    }
    async start() {
        console.clear();
        const hasKeys = this.checkAPIKeys();
        if (!hasKeys)
            return;
        this.showWelcome();
        this.initializeServices();
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
        tool_service_1.toolService.setWorkingDirectory(this.context.workingDirectory);
        planning_service_1.planningService.setWorkingDirectory(this.context.workingDirectory);
        lsp_service_1.lspService.setWorkingDirectory(this.context.workingDirectory);
        await lsp_service_1.lspService.autoStartServers(this.context.workingDirectory);
        console.log(chalk_1.default.dim('🚀 Services initialized'));
    }
}
class StreamingOrchestrator extends StreamingOrchestratorImpl {
}
exports.StreamingOrchestrator = StreamingOrchestrator;
if (require.main === module) {
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start().catch(console.error);
}
