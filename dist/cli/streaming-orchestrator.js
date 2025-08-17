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
const cli_ui_1 = require("./utils/cli-ui");
class StreamingOrchestratorImpl extends events_1.EventEmitter {
    constructor() {
        super();
        this.messageQueue = [];
        this.processingMessage = false;
        this.activeAgents = new Map();
        this.streamBuffer = '';
        this.lastUpdate = Date.now();
        this.inputQueueEnabled = true;
        this.supervisionCognition = null;
        this.adaptiveMetrics = new Map();
        this.panels = new Map();
        this.context = {
            workingDirectory: process.cwd(),
            autonomous: true,
            planMode: false,
            autoAcceptEdits: true,
            vmMode: false,
            contextLeft: 20,
            maxContext: 100
        };
        this.policyManager = new execution_policy_1.ExecutionPolicyManager(config_manager_1.simpleConfigManager);
        global.__streamingOrchestrator = this;
    }
    setupInterface() {
        if (!this.rl)
            return;
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
        const message = {
            id: `user_${Date.now()}`,
            type: 'user',
            content: input,
            timestamp: new Date(),
            status: 'queued'
        };
        this.messageQueue.push(message);
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
                let agentName = match[1];
                const task = input.replace(match[0], '').trim();
                if (this.context.vmMode) {
                    agentName = 'vm-agent';
                    this.queueMessage({
                        type: 'system',
                        content: `🐳 VM Mode: Redirecting to VM Agent`
                    });
                }
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
            if (agentName === 'vm-agent' && this.context.vmMode) {
                await this.handleVMAgentChat(task);
                return;
            }
            if (this.activeAgents.size >= 3) {
                this.queueMessage({
                    type: 'system',
                    content: `⏳ Agent ${agentName} queued (${this.activeAgents.size}/3 active)`
                });
            }
            const taskId = await agent_service_1.agentService.executeTask(agentName, task, {});
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
    async handleVMAgentChat(message) {
        try {
            this.queueMessage({
                type: 'system',
                content: `🐳 VM Mode: Communicating with VM agents...`
            });
            if (!this.activeVMAgent) {
                const { SecureVirtualizedAgent } = await Promise.resolve().then(() => __importStar(require('./virtualized-agents/secure-vm-agent')));
                this.activeVMAgent = new SecureVirtualizedAgent(process.cwd());
                await this.activeVMAgent.initialize();
                await this.activeVMAgent.startChatMode();
                this.queueMessage({
                    type: 'vm',
                    content: `VM Agent initialized and ready for chat`
                });
            }
            this.queueMessage({
                type: 'system',
                content: `📤 Sending to 1 VM agent(s):`
            });
            this.queueMessage({
                type: 'user',
                content: `Input: ${message}`
            });
            this.queueMessage({
                type: 'system',
                content: `🌊 VM Agent ${this.activeVMAgent.id.slice(-8)}: Starting streaming response...`
            });
            cli_ui_1.CliUI.logDebug(`🔍 Checking VM Agent streaming support: ${typeof this.activeVMAgent.processChatMessageStreaming}`);
            if (typeof this.activeVMAgent.processChatMessageStreaming === 'function') {
                cli_ui_1.CliUI.logInfo(`🌊 Using streaming method for VM Agent chat`);
                let hasContent = false;
                let streamBuffer = '';
                try {
                    this.queueMessage({
                        type: 'system',
                        content: `🌊 Starting AI streaming...`
                    });
                    for await (const chunk of this.activeVMAgent.processChatMessageStreaming(message)) {
                        cli_ui_1.CliUI.logDebug(`📦 Received chunk: ${chunk ? chunk.slice(0, 50) : 'null'}...`);
                        if (chunk && chunk.trim()) {
                            hasContent = true;
                            streamBuffer += chunk;
                            this.queueMessage({
                                type: 'vm',
                                content: chunk,
                                metadata: {
                                    isStreaming: true,
                                    vmAgentId: this.activeVMAgent.id,
                                    chunkLength: chunk.length
                                }
                            });
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }
                    }
                    this.queueMessage({
                        type: 'system',
                        content: `✅ VM Agent ${this.activeVMAgent.id.slice(-8)}: Streaming completed (${streamBuffer.length} chars)`
                    });
                }
                catch (streamError) {
                    cli_ui_1.CliUI.logError(`❌ Streaming error details: ${streamError.message}`);
                    this.queueMessage({
                        type: 'error',
                        content: `❌ VM Agent streaming error: ${streamError.message}`
                    });
                    hasContent = false;
                }
                if (!hasContent) {
                    cli_ui_1.CliUI.logWarning(`⚠️ No streaming content received, showing placeholder`);
                    this.queueMessage({
                        type: 'vm',
                        content: `🤖 VM Agent processed the request but no streaming response was generated.`
                    });
                }
            }
            else {
                this.queueMessage({
                    type: 'system',
                    content: `🤖 VM Agent ${this.activeVMAgent.id.slice(-8)}: Processing (non-streaming)...`
                });
                const response = await this.activeVMAgent.processChatMessage(message);
                this.queueMessage({
                    type: 'system',
                    content: `✅ VM Agent ${this.activeVMAgent.id.slice(-8)}: Task completed`
                });
                if (response && response.trim()) {
                    this.queueMessage({
                        type: 'vm',
                        content: response
                    });
                }
                else {
                    this.queueMessage({
                        type: 'vm',
                        content: `🤖 VM Agent completed the task but no specific response was generated.`
                    });
                }
            }
        }
        catch (error) {
            this.queueMessage({
                type: 'error',
                content: `❌ VM Agent chat error: ${error.message}`
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
        if (this.context.vmMode) {
            return 'vm-agent';
        }
        if (lower.includes('analizza la repository') ||
            lower.includes('analizza il repository') ||
            lower.includes('analyze the repository') ||
            lower.includes('vm agent') ||
            lower.includes('isolated environment')) {
            return 'vm-agent';
        }
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
            case 'vm':
                prefix = '🐳';
                color = chalk_1.default.cyan;
                if (message.metadata?.isStreaming) {
                    const streamPrefix = chalk_1.default.dim('🌊');
                    console.log(`${streamPrefix}${color(content)}`);
                    return;
                }
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
        if (message.type === 'vm' && message.metadata?.chunkLength) {
            const streamInfo = chalk_1.default.dim(`[${message.metadata.chunkLength} chars]`);
            console.log(`${' '.repeat(timestamp.length + 4)}${streamInfo}`);
        }
    }
    createPanel(config) {
        const panel = {
            ...config,
            content: [],
            maxLines: config.height || 20
        };
        this.panels.set(config.id, panel);
    }
    async streamToPanel(panelId, content) {
        const panel = this.panels.get(panelId);
        if (!panel)
            return;
        const lines = content.split('\n');
        panel.content.push(...lines);
        if (panel.maxLines && panel.content.length > panel.maxLines) {
            panel.content = panel.content.slice(-panel.maxLines);
        }
        if (panelId.includes('vm')) {
            this.queueMessage({
                type: 'vm',
                content: lines.join(' ')
            });
        }
    }
    displayPanels() {
        if (this.panels.size === 0)
            return;
        console.log(chalk_1.default.cyan('\n═══ Panels ═══'));
        for (const [id, panel] of this.panels) {
            console.log(chalk_1.default.blue(`\n▌ ${panel.title}`));
            console.log(chalk_1.default.gray('─'.repeat(40)));
            const displayLines = panel.content.slice(-5);
            displayLines.forEach(line => {
                if (line)
                    console.log(chalk_1.default.dim(`  ${line}`));
            });
        }
        console.log(chalk_1.default.cyan('═══════════════\n'));
    }
    queueVMMessage(content) {
        this.queueMessage({
            type: 'vm',
            content
        });
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
        const supervision = this.supervisionCognition;
        const metrics = Object.fromEntries(this.adaptiveMetrics);
        this.displayPanels();
        console.log(chalk_1.default.cyan.bold('\\n🧠 Adaptive Orchestrator Status'));
        console.log(chalk_1.default.gray('═'.repeat(50)));
        console.log(`${chalk_1.default.blue('Working Dir:')} ${this.context.workingDirectory}`);
        console.log(`${chalk_1.default.blue('Active Agents:')} ${active}/3`);
        console.log(`${chalk_1.default.blue('Queued Tasks:')} ${queued}`);
        console.log(`${chalk_1.default.blue('Messages:')} ${this.messageQueue.length}`);
        console.log(`${chalk_1.default.blue('Pending Diffs:')} ${pending}`);
        console.log(`${chalk_1.default.blue('Context Left:')} ${this.context.contextLeft}%`);
        if (supervision) {
            console.log(chalk_1.default.cyan.bold('\\n🎯 Supervision Cognition:'));
            console.log(`${chalk_1.default.blue('Task Complexity:')} ${supervision.taskComplexity}`);
            console.log(`${chalk_1.default.blue('Risk Level:')} ${supervision.riskLevel}`);
            console.log(`${chalk_1.default.blue('Agent Coordination:')} ${(supervision.agentCoordination * 100).toFixed(1)}%`);
            console.log(`${chalk_1.default.blue('Resource Usage:')} ${(supervision.resourceUtilization * 100).toFixed(1)}%`);
            console.log(`${chalk_1.default.blue('System Load:')} ${supervision.systemLoad}`);
            console.log(`${chalk_1.default.blue('Adaptive Response:')} ${supervision.adaptiveResponse}`);
        }
        console.log(chalk_1.default.cyan.bold('\\n⚙️ Adaptive Features:'));
        console.log(`${chalk_1.default.blue('Adaptive Supervision:')} ${this.context.adaptiveSupervision ? '✅' : '❌'}`);
        console.log(`${chalk_1.default.blue('Intelligent Prioritization:')} ${this.context.intelligentPrioritization ? '✅' : '❌'}`);
        console.log(`${chalk_1.default.blue('Cognitive Filtering:')} ${this.context.cognitiveFiltering ? '✅' : '❌'}`);
        console.log(`${chalk_1.default.blue('Orchestration Awareness:')} ${this.context.orchestrationAwareness ? '✅' : '❌'}`);
        console.log(chalk_1.default.cyan.bold('\\n📥 Input Processing:'));
        console.log(`${chalk_1.default.blue('Input Queue:')} ${this.inputQueueEnabled ? 'Enabled' : 'Disabled'}`);
        if (this.inputQueueEnabled) {
            console.log(`${chalk_1.default.blue('  Queued Inputs:')} ${queueStatus.queueLength}`);
            console.log(`${chalk_1.default.blue('  Processing:')} ${queueStatus.isProcessing ? 'Yes' : 'No'}`);
        }
        console.log(chalk_1.default.cyan.bold('\\n📊 Performance Metrics:'));
        console.log(`${chalk_1.default.blue('Processing Rate:')} ${(metrics.messageProcessingRate * 100).toFixed(1)}%`);
        console.log(`${chalk_1.default.blue('Coordination Efficiency:')} ${(metrics.agentCoordinationEfficiency * 100).toFixed(1)}%`);
        console.log(`${chalk_1.default.blue('Error Recovery Rate:')} ${(metrics.errorRecoveryRate * 100).toFixed(1)}%`);
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
        if (!this.context.planMode && !this.context.autoAcceptEdits && !this.context.vmMode) {
            this.context.planMode = true;
            console.log(chalk_1.default.green('\\n✅ plan mode on ') + chalk_1.default.dim('(shift+tab to cycle)'));
        }
        else if (this.context.planMode && !this.context.autoAcceptEdits && !this.context.vmMode) {
            this.context.planMode = false;
            this.context.autoAcceptEdits = true;
            diff_manager_1.diffManager.setAutoAccept(true);
            console.log(chalk_1.default.green('\\n✅ auto-accept edits on ') + chalk_1.default.dim('(shift+tab to cycle)'));
        }
        else if (!this.context.planMode && this.context.autoAcceptEdits && !this.context.vmMode) {
            this.context.autoAcceptEdits = false;
            this.context.vmMode = true;
            diff_manager_1.diffManager.setAutoAccept(false);
            console.log(chalk_1.default.cyan('\\n🐳 vm mode on ') + chalk_1.default.dim('(shift+tab to cycle)'));
        }
        else {
            this.context.planMode = false;
            this.context.autoAcceptEdits = false;
            this.context.vmMode = false;
            diff_manager_1.diffManager.setAutoAccept(false);
            if (this.activeVMAgent) {
                this.cleanupVMAgent();
            }
            console.log(chalk_1.default.yellow('\\n⚠️ manual mode'));
        }
    }
    async cleanupVMAgent() {
        try {
            if (this.activeVMAgent) {
                this.queueMessage({
                    type: 'system',
                    content: `🐳 Cleaning up VM agent...`
                });
                await this.activeVMAgent.cleanup();
                this.activeVMAgent = undefined;
                this.queueMessage({
                    type: 'system',
                    content: `✅ VM agent cleaned up`
                });
            }
        }
        catch (error) {
            this.queueMessage({
                type: 'error',
                content: `❌ VM cleanup error: ${error.message}`
            });
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
        if (!this.rl)
            return;
        const dir = require('path').basename(this.context.workingDirectory);
        const agents = this.activeAgents.size;
        const agentIndicator = agents > 0 ? chalk_1.default.blue(`${agents}🤖`) : '🎛️';
        const modes = [];
        if (this.context.planMode)
            modes.push(chalk_1.default.cyan('plan'));
        if (this.context.autoAcceptEdits)
            modes.push(chalk_1.default.green('auto-accept'));
        if (this.context.vmMode)
            modes.push(chalk_1.default.cyan('vm'));
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
        if (!this.rl)
            return [[], line];
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
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            historySize: 300,
            completer: this.autoComplete.bind(this),
        });
        this.showWelcome();
        this.initializeServices();
        this.setupInterface();
        this.startMessageProcessor();
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
    getSupervisionMetrics() {
        return {
            cognition: null,
            metrics: {
                messageProcessingRate: 0.8,
                agentCoordinationEfficiency: 0.7,
                errorRecoveryRate: 0.95
            },
            patterns: {
                multiAgentCoordination: 0.8,
                sequentialTaskExecution: 0.7,
                parallelProcessing: 0.9
            },
            historyLength: 0
        };
    }
    configureAdaptiveSupervision(config) {
        console.log(chalk_1.default.cyan(`🧠 Adaptive supervision configured`));
        if (config.adaptiveSupervision) {
            console.log(chalk_1.default.cyan(`🎯 Cognitive features enabled`));
        }
    }
}
class StreamingOrchestrator extends StreamingOrchestratorImpl {
    createPanel(config) {
        super.createPanel(config);
    }
    async streamToPanel(panelId, content) {
        return super.streamToPanel(panelId, content);
    }
    displayPanels() {
        super.displayPanels();
    }
    queueVMMessage(content) {
        super.queueVMMessage(content);
    }
}
exports.StreamingOrchestrator = StreamingOrchestrator;
if (require.main === module) {
    const orchestrator = new StreamingOrchestrator();
    orchestrator.start().catch(console.error);
}
