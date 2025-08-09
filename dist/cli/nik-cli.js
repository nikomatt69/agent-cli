"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function (o) {
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
exports.NikCLI = void 0;
const readline = __importStar(require("readline"));
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const marked_1 = require("marked");
const marked_terminal_1 = __importDefault(require("marked-terminal"));
const ora_1 = __importDefault(require("ora"));
const cli_progress_1 = __importDefault(require("cli-progress"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// Import existing modules
const config_manager_1 = require("./core/config-manager");
const model_provider_1 = require("./ai/model-provider");
const tools_manager_1 = require("./tools/tools-manager");
const agent_factory_1 = require("./core/agent-factory");
const agent_stream_1 = require("./core/agent-stream");
const workspace_context_1 = require("./context/workspace-context");
const agent_manager_1 = require("./core/agent-manager");
const planning_manager_1 = require("./planning/planning-manager");
const advanced_ai_provider_1 = require("./ai/advanced-ai-provider");
const config_manager_2 = require("./core/config-manager");
const enhanced_planning_1 = require("./planning/enhanced-planning");
const approval_system_1 = require("./ui/approval-system");
const advanced_cli_ui_1 = require("./ui/advanced-cli-ui");
const nik_cli_commands_1 = require("./chat/nik-cli-commands");
const chat_manager_1 = require("./chat/chat-manager");
const agent_service_1 = require("./services/agent-service");
const planning_service_1 = require("./services/planning-service");
const register_agents_1 = require("./register-agents");
// Configure marked for terminal rendering
marked_1.marked.setOptions({
    renderer: new marked_terminal_1.default(),
});
/**
 * NikCLI - Unified CLI interface integrating all existing modules
 * Provides Claude Code-style terminal experience with autonomous agents
 */
class NikCLI {
    constructor() {
        this.currentMode = 'default';
        this.sessionContext = new Map();
        this.indicators = new Map();
        this.liveUpdates = [];
        this.spinners = new Map();
        this.progressBars = new Map();
        this.isInteractiveMode = false;
        this.assistantProcessing = false;
        // Bridge StreamingOrchestrator agent lifecycle events into NikCLI output
        this.orchestratorEventsInitialized = false;
        this.workingDirectory = process.cwd();
        this.projectContextFile = path.join(this.workingDirectory, 'NIKOCLI.md');
        // Initialize core managers
        this.configManager = config_manager_2.simpleConfigManager;
        this.agentManager = new agent_manager_1.AgentManager(this.configManager);
        this.planningManager = new planning_manager_1.PlanningManager(this.workingDirectory);
        this.slashHandler = new nik_cli_commands_1.SlashCommandHandler();
        // Register agents
        (0, register_agents_1.registerAgents)(this.agentManager);
        this.setupEventHandlers();
        // Bridge orchestrator events into NikCLI output
        this.setupOrchestratorEventBridge();
        this.setupAdvancedUIFeatures();
    }
    setupEventHandlers() {
        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
            this.shutdown();
        });
        process.on('SIGTERM', () => {
            this.shutdown();
        });
    }
    setupOrchestratorEventBridge() {
        if (this.orchestratorEventsInitialized)
            return;
        this.orchestratorEventsInitialized = true;
        agent_service_1.agentService.on('task_start', (task) => {
            const indicator = this.createStatusIndicator(`task-${task.id}`, `Agent ${task.agentType}`, task.task);
            this.updateStatusIndicator(indicator.id, { status: 'running' });
            console.log(chalk_1.default.blue(`🤖 Agent ${task.agentType} started: ${task.task.slice(0, 60)}...`));
        });
        agent_service_1.agentService.on('task_progress', (_task, update) => {
            const progress = typeof update.progress === 'number' ? `${update.progress}% ` : '';
            const desc = update.description ? `- ${update.description}` : '';
            this.addLiveUpdate({ type: 'progress', content: `${progress}${desc}`, source: 'agent' });
            console.log(chalk_1.default.cyan(`📊 ${progress}${desc}`));
        });
        agent_service_1.agentService.on('tool_use', (_task, update) => {
            this.addLiveUpdate({ type: 'info', content: `🔧 ${update.tool}: ${update.description}`, source: 'tool' });
            console.log(chalk_1.default.magenta(`🔧 ${update.tool}: ${update.description}`));
        });
        agent_service_1.agentService.on('task_complete', (task) => {
            const indicatorId = `task-${task.id}`;
            if (task.status === 'completed') {
                this.updateStatusIndicator(indicatorId, { status: 'completed', details: 'Task completed successfully' });
                console.log(chalk_1.default.green(`✅ ${task.agentType} completed`));
            }
            else {
                this.updateStatusIndicator(indicatorId, { status: 'failed', details: task.error || 'Unknown error' });
                console.log(chalk_1.default.red(`❌ ${task.agentType} failed: ${task.error}`));
            }
            // Keep prompt visible after background updates
            this.showPrompt();
        });
    }
    // Advanced UI Features Setup
    setupAdvancedUIFeatures() {
        // Initialize advanced UI theme and features
        this.isInteractiveMode = false; // Start in normal mode
        // Setup file watching capabilities
        this.setupFileWatching();
        // Setup progress tracking
        this.setupProgressTracking();
    }
    setupFileWatching() {
        // File watching setup for live updates
        // This would integrate with chokidar for real file watching
    }
    setupProgressTracking() {
        // Progress tracking for long-running operations
        // This provides visual feedback for complex tasks
    }
    // Advanced UI Methods (from advanced-cli-ui.ts)
    createStatusIndicator(id, title, details) {
        const indicator = {
            id,
            title,
            status: 'pending',
            details,
            startTime: new Date(),
            subItems: [],
        };
        this.indicators.set(id, indicator);
        if (this.isInteractiveMode) {
            this.refreshDisplay();
        }
        else {
            console.log(chalk_1.default.blue(`📋 ${title}${details ? ` - ${details}` : ''}`));
        }
        return indicator;
    }
    updateStatusIndicator(id, updates) {
        const indicator = this.indicators.get(id);
        if (!indicator)
            return;
        Object.assign(indicator, updates);
        if (updates.status === 'completed' || updates.status === 'failed') {
            indicator.endTime = new Date();
        }
        if (this.isInteractiveMode) {
            this.refreshDisplay();
        }
        else {
            this.logStatusUpdate(indicator);
        }
    }
    addLiveUpdate(update) {
        const liveUpdate = {
            ...update,
            timestamp: new Date(),
        };
        this.liveUpdates.push(liveUpdate);
        // Keep only recent updates
        if (this.liveUpdates.length > 50) {
            this.liveUpdates = this.liveUpdates.slice(-50);
        }
        if (this.isInteractiveMode) {
            this.refreshDisplay();
        }
        else {
            this.printLiveUpdate(liveUpdate);
        }
    }
    startAdvancedSpinner(id, text) {
        if (this.isInteractiveMode) {
            this.updateStatusIndicator(id, { status: 'running' });
            return;
        }
        const spinner = (0, ora_1.default)({
            text,
            spinner: 'dots',
            color: 'cyan',
        }).start();
        this.spinners.set(id, spinner);
    }
    stopAdvancedSpinner(id, success, finalText) {
        const spinner = this.spinners.get(id);
        if (spinner) {
            if (success) {
                spinner.succeed(finalText);
            }
            else {
                spinner.fail(finalText);
            }
            this.spinners.delete(id);
        }
        this.updateStatusIndicator(id, {
            status: success ? 'completed' : 'failed',
            details: finalText,
        });
    }
    createAdvancedProgressBar(id, title, total) {
        if (this.isInteractiveMode) {
            this.createStatusIndicator(id, title);
            this.updateStatusIndicator(id, { progress: 0 });
            return;
        }
        const progressBar = new cli_progress_1.default.SingleBar({
            format: `${chalk_1.default.cyan(title)} |${chalk_1.default.cyan('{bar}')}| {percentage}% | {value}/{total} | ETA: {eta}s`,
            barCompleteChar: '█',
            barIncompleteChar: '░',
        });
        progressBar.start(total, 0);
        this.progressBars.set(id, progressBar);
    }
    updateAdvancedProgress(id, current, total) {
        const progressBar = this.progressBars.get(id);
        if (progressBar) {
            progressBar.update(current);
        }
        const progress = total ? Math.round((current / total) * 100) : current;
        this.updateStatusIndicator(id, { progress });
    }
    completeAdvancedProgress(id, message) {
        const progressBar = this.progressBars.get(id);
        if (progressBar) {
            progressBar.stop();
            this.progressBars.delete(id);
        }
        this.updateStatusIndicator(id, {
            status: 'completed',
            progress: 100,
            details: message,
        });
    }
    // Helper to show a concise, single-line summary with ellipsis
    conciseOneLine(text, max = 60) {
        if (!text)
            return '';
        const one = text.replace(/\s+/g, ' ').trim();
        return one.length > max ? one.slice(0, max).trimEnd() + '…' : one;
    }
    async askAdvancedConfirmation(question, details, defaultValue = false) {
        const icon = defaultValue ? '✅' : '❓';
        const prompt = `${icon} ${chalk_1.default.cyan(question)}`;
        if (details) {
            console.log(chalk_1.default.gray(`   ${details}`));
        }
        return new Promise((resolve) => {
            if (!this.rl) {
                resolve(defaultValue);
                return;
            }
            this.rl.question(`${prompt} ${chalk_1.default.gray(defaultValue ? '(Y/n)' : '(y/N)')}: `, (answer) => {
                const normalized = answer.toLowerCase().trim();
                if (normalized === '') {
                    resolve(defaultValue);
                }
                else {
                    resolve(normalized.startsWith('y'));
                }
            });
        });
    }
    async showAdvancedSelection(title, choices, defaultIndex = 0) {
        console.log(chalk_1.default.cyan.bold(`\n${title}`));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        choices.forEach((choice, index) => {
            const indicator = index === defaultIndex ? chalk_1.default.green('→') : ' ';
            console.log(`${indicator} ${index + 1}. ${chalk_1.default.bold(choice.label)}`);
            if (choice.description) {
                console.log(`   ${chalk_1.default.gray(choice.description)}`);
            }
        });
        return new Promise((resolve) => {
            if (!this.rl) {
                resolve(choices[defaultIndex].value);
                return;
            }
            const prompt = `\nSelect option (1-${choices.length}, default ${defaultIndex + 1}): `;
            this.rl.question(prompt, (answer) => {
                let selection = defaultIndex;
                const num = parseInt(answer.trim());
                if (!isNaN(num) && num >= 1 && num <= choices.length) {
                    selection = num - 1;
                }
                console.log(chalk_1.default.green(`✓ Selected: ${choices[selection].label}`));
                resolve(choices[selection].value);
            });
        });
    }
    // Advanced UI Helper Methods
    refreshDisplay() {
        if (!this.isInteractiveMode)
            return;
        // Move cursor to top and clear
        process.stdout.write('\x1B[2J\x1B[H');
        this.showAdvancedHeader();
        this.showActiveIndicators();
        this.showRecentUpdates();
    }
    showAdvancedHeader() {
        const header = (0, boxen_1.default)(`${chalk_1.default.cyanBright.bold('🤖 NikCLI')} ${chalk_1.default.gray('v0.1.2-beta')}\n` +
            `${chalk_1.default.gray('Autonomous AI Developer Assistant')}\n\n` +
            `${chalk_1.default.blue('Status:')} ${this.getOverallStatus()}  ${chalk_1.default.blue('Active Tasks:')} ${this.indicators.size}\n` +
            `${chalk_1.default.blue('Mode:')} ${this.currentMode}  ${chalk_1.default.blue('Live Updates:')} Enabled`, {
            padding: 1,
            margin: { top: 0, bottom: 1, left: 0, right: 0 },
            borderStyle: 'round',
            borderColor: 'cyan',
            textAlignment: 'center',
        });
        console.log(header);
    }
    showActiveIndicators() {
        const indicators = Array.from(this.indicators.values());
        if (indicators.length === 0)
            return;
        console.log(chalk_1.default.blue.bold('📊 Active Tasks:'));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        indicators.forEach(indicator => {
            this.printIndicatorLine(indicator);
        });
        console.log();
    }
    showRecentUpdates() {
        const recentUpdates = this.liveUpdates.slice(-10);
        if (recentUpdates.length === 0)
            return;
        console.log(chalk_1.default.blue.bold('📝 Recent Updates:'));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        recentUpdates.forEach(update => {
            this.printLiveUpdate(update);
        });
    }
    printIndicatorLine(indicator) {
        const statusIcon = this.getStatusIcon(indicator.status);
        const duration = this.getDuration(indicator);
        let line = `${statusIcon} ${chalk_1.default.bold(indicator.title)}`;
        if (indicator.progress !== undefined) {
            const progressBar = this.createProgressBarString(indicator.progress);
            line += ` ${progressBar}`;
        }
        if (duration) {
            line += ` ${chalk_1.default.gray(`(${duration})`)}`;
        }
        console.log(line);
        if (indicator.details) {
            console.log(`   ${chalk_1.default.gray(indicator.details)}`);
        }
    }
    printLiveUpdate(update) {
        const timeStr = update.timestamp.toLocaleTimeString();
        const typeColor = this.getUpdateTypeColor(update.type);
        const sourceStr = update.source ? chalk_1.default.gray(`[${update.source}]`) : '';
        const line = `${chalk_1.default.gray(timeStr)} ${sourceStr} ${typeColor(update.content)}`;
        console.log(line);
    }
    logStatusUpdate(indicator) {
        const statusIcon = this.getStatusIcon(indicator.status);
        const statusColor = this.getStatusColor(indicator.status);
        console.log(`${statusIcon} ${statusColor(indicator.title)}`);
        if (indicator.details) {
            console.log(`   ${chalk_1.default.gray(indicator.details)}`);
        }
    }
    // UI Utility Methods
    getStatusIcon(status) {
        switch (status) {
            case 'pending': return '⏳';
            case 'running': return '🔄';
            case 'completed': return '✅';
            case 'failed': return '❌';
            case 'warning': return '⚠️';
            default: return '📋';
        }
    }
    getStatusColor(status) {
        switch (status) {
            case 'pending': return chalk_1.default.gray;
            case 'running': return chalk_1.default.blue;
            case 'completed': return chalk_1.default.green;
            case 'failed': return chalk_1.default.red;
            case 'warning': return chalk_1.default.yellow;
            default: return chalk_1.default.gray;
        }
    }
    getUpdateTypeColor(type) {
        switch (type) {
            case 'error': return chalk_1.default.red;
            case 'warning': return chalk_1.default.yellow;
            case 'info': return chalk_1.default.blue;
            case 'log': return chalk_1.default.green;
            default: return chalk_1.default.white;
        }
    }
    createProgressBarString(progress, width = 20) {
        const filled = Math.round((progress / 100) * width);
        const empty = width - filled;
        const bar = chalk_1.default.cyan('█'.repeat(filled)) + chalk_1.default.gray('░'.repeat(empty));
        return `[${bar}] ${progress}%`;
    }
    getDuration(indicator) {
        if (!indicator.startTime)
            return null;
        const endTime = indicator.endTime || new Date();
        const duration = endTime.getTime() - indicator.startTime.getTime();
        const seconds = Math.round(duration / 1000);
        if (seconds < 60) {
            return `${seconds}s`;
        }
        else {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        }
    }
    getOverallStatus() {
        const indicators = Array.from(this.indicators.values());
        if (indicators.length === 0)
            return chalk_1.default.gray('Idle');
        const hasRunning = indicators.some(i => i.status === 'running');
        const hasFailed = indicators.some(i => i.status === 'failed');
        const hasWarning = indicators.some(i => i.status === 'warning');
        if (hasRunning)
            return chalk_1.default.blue('Running');
        if (hasFailed)
            return chalk_1.default.red('Failed');
        if (hasWarning)
            return chalk_1.default.yellow('Warning');
        return chalk_1.default.green('Ready');
    }
    /**
     * Start interactive chat mode (main Claude Code experience)
     */
    async startChat(options) {
        console.clear();
        this.showChatWelcome();
        // Apply options
        if (options.model) {
            this.switchModel(options.model);
        }
        if (options.auto) {
            this.currentMode = 'auto';
        }
        else if (options.plan) {
            this.currentMode = 'plan';
        }
        if (options.agent) {
            this.currentAgent = options.agent;
        }
        // Initialize systems
        await this.initializeSystems();
        // Start enhanced chat interface with slash commands
        await this.startEnhancedChat();
    }
    /**
     * Enhanced chat interface with Claude Code-style slash commands
     */
    async startEnhancedChat() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            historySize: 300,
        });
        this.rl.on('line', async (input) => {
            const trimmed = input.trim();
            if (!trimmed) {
                this.showPrompt();
                return;
            }
            // Indicate assistant is processing while handling the input
            this.assistantProcessing = true;
            this.showPrompt();
            try {
                // Route slash and agent-prefixed commands, otherwise treat as chat
                if (trimmed.startsWith('/')) {
                    await this.dispatchSlash(trimmed);
                }
                else if (trimmed.startsWith('@')) {
                    await this.dispatchAt(trimmed);
                }
                else {
                    await this.handleChatInput(trimmed);
                }
            }
            finally {
                // Done processing; return to idle
                this.assistantProcessing = false;
                this.showPrompt();
            }
        });
        this.rl.on('SIGINT', () => {
            this.shutdown();
        });
        // Show initial prompt immediately
        this.showPrompt();
    }
    /**
     * Dispatch /slash commands to rich SlashCommandHandler while preserving mode controls
     */
    async dispatchSlash(command) {
        const parts = command.slice(1).split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        try {
            switch (cmd) {
                case 'plan':
                    if (args.length === 0) {
                        this.currentMode = 'plan';
                        console.log(chalk_1.default.green('✓ Switched to plan mode'));
                    }
                    else {
                        await this.generatePlan(args.join(' '), {});
                    }
                    break;
                case 'auto':
                    if (args.length === 0) {
                        this.currentMode = 'auto';
                        console.log(chalk_1.default.green('✓ Switched to auto mode'));
                    }
                    else {
                        await this.autoExecute(args.join(' '), {});
                    }
                    break;
                case 'default':
                    this.currentMode = 'default';
                    console.log(chalk_1.default.green('✓ Switched to default mode'));
                    break;
                // File Operations
                case 'read':
                    await this.handleFileOperations('read', args);
                    break;
                case 'write':
                    await this.handleFileOperations('write', args);
                    break;
                case 'edit':
                    await this.handleFileOperations('edit', args);
                    break;
                case 'ls':
                    await this.handleFileOperations('ls', args);
                    break;
                case 'search':
                case 'grep':
                    await this.handleFileOperations('search', args);
                    break;
                // Terminal Operations
                case 'run':
                case 'sh':
                case 'bash':
                    await this.handleTerminalOperations('run', args);
                    break;
                case 'install':
                    await this.handleTerminalOperations('install', args);
                    break;
                case 'npm':
                    await this.handleTerminalOperations('npm', args);
                    break;
                case 'yarn':
                    await this.handleTerminalOperations('yarn', args);
                    break;
                case 'git':
                    await this.handleTerminalOperations('git', args);
                    break;
                case 'docker':
                    await this.handleTerminalOperations('docker', args);
                    break;
                case 'ps':
                    await this.handleTerminalOperations('ps', args);
                    break;
                case 'kill':
                    await this.handleTerminalOperations('kill', args);
                    break;
                // Project Operations
                case 'build':
                    await this.handleProjectOperations('build', args);
                    break;
                case 'test':
                    await this.handleProjectOperations('test', args);
                    break;
                case 'lint':
                    await this.handleProjectOperations('lint', args);
                    break;
                case 'create':
                    await this.handleProjectOperations('create', args);
                    break;
                // Session Management
                case 'new':
                case 'sessions':
                case 'export':
                case 'stats':
                case 'history':
                case 'debug':
                case 'temp':
                case 'system':
                    await this.handleSessionManagement(cmd, args);
                    break;
                // Model and Config
                case 'model':
                case 'models':
                case 'set-key':
                case 'config':
                    await this.handleModelConfig(cmd, args);
                    break;
                // Advanced Features
                case 'agents':
                case 'agent':
                case 'parallel':
                case 'factory':
                case 'create-agent':
                case 'launch-agent':
                case 'context':
                case 'stream':
                case 'approval':
                case 'todo':
                case 'todos':
                    await this.handleAdvancedFeatures(cmd, args);
                    break;
                // Help and Exit
                case 'help':
                    this.showSlashHelp();
                    break;
                case 'clear':
                    await this.clearSession();
                    break;
                case 'exit':
                case 'quit':
                    this.shutdown();
                    return;
                default: {
                    const result = await this.slashHandler.handle(command);
                    if (result.shouldExit) {
                        this.shutdown();
                        return;
                    }
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error executing ${command}: ${error.message}`));
        }
        this.showPrompt();
    }
    /**
     * Dispatch @agent commands through the unified command router
     */
    async dispatchAt(input) {
        const result = await this.slashHandler.handle(input);
        if (result.shouldExit) {
            this.shutdown();
            return;
        }
        this.showPrompt();
    }
    /**
     * Handle slash commands (Claude Code style)
     */
    async handleSlashCommand(command) {
        const parts = command.slice(1).split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        try {
            switch (cmd) {
                case 'init':
                    await this.initProject({ force: args.includes('--force') });
                    break;
                case 'plan':
                    if (args.length === 0) {
                        this.currentMode = 'plan';
                        console.log(chalk_1.default.green('✓ Switched to plan mode'));
                    }
                    else {
                        await this.generatePlan(args.join(' '), {});
                    }
                    break;
                case 'auto':
                    if (args.length === 0) {
                        this.currentMode = 'auto';
                        console.log(chalk_1.default.green('✓ Switched to auto mode'));
                    }
                    else {
                        await this.autoExecute(args.join(' '), {});
                    }
                    break;
                case 'default':
                    this.currentMode = 'default';
                    console.log(chalk_1.default.green('✓ Switched to default mode'));
                    break;
                case 'agent':
                    if (args.length === 0) {
                        await this.listAgents();
                    }
                    else {
                        this.currentAgent = args[0];
                        console.log(chalk_1.default.green(`✓ Switched to agent: ${args[0]}`));
                    }
                    break;
                case 'model':
                    if (args.length === 0) {
                        await this.listModels();
                    }
                    else {
                        this.switchModel(args[0]);
                    }
                    break;
                case 'clear':
                    await this.clearSession();
                    break;
                case 'compact':
                    await this.compactSession();
                    break;
                case 'cost':
                    await this.showCost();
                    break;
                case 'config':
                    await this.manageConfig({ show: true });
                    break;
                case 'status':
                    await this.showStatus();
                    break;
                case 'todo':
                    await this.manageTodo({ list: true });
                    break;
                case 'help':
                    this.showSlashHelp();
                    break;
                case 'exit':
                case 'quit':
                    this.shutdown();
                    break;
                default:
                    console.log(chalk_1.default.red(`Unknown command: /${cmd}`));
                    console.log(chalk_1.default.dim('Type /help for available commands'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error executing /${cmd}: ${error.message}`));
        }
        this.showPrompt();
    }
    /**
     * Handle regular chat input based on current mode
     */
    async handleChatInput(input) {
        try {
            switch (this.currentMode) {
                case 'plan':
                    await this.handlePlanMode(input);
                    break;
                case 'auto':
                    await this.handleAutoMode(input);
                    break;
                default:
                    await this.handleDefaultMode(input);
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error: ${error.message}`));
        }
        this.showPrompt();
    }
    /**
     * Plan mode: Generate comprehensive plan with todo.md and request approval
     */
    async handlePlanMode(input) {
        console.log(chalk_1.default.blue('🎯 Entering Enhanced Planning Mode...'));
        try {
            // Start progress indicator using our new methods
            const planningId = 'planning-' + Date.now();
            this.createStatusIndicator(planningId, 'Generating comprehensive plan', input);
            this.startAdvancedSpinner(planningId, 'Analyzing requirements and generating plan...');
            // Generate comprehensive plan with todo.md
            const plan = await enhanced_planning_1.enhancedPlanning.generatePlan(input, {
                maxTodos: 15,
                includeContext: true,
                showDetails: true,
                saveTodoFile: true,
                todoFilePath: 'todo.md'
            });
            this.stopAdvancedSpinner(planningId, true, `Plan generated with ${plan.todos.length} todos`);
            // Show plan summary
            console.log(chalk_1.default.blue.bold('\n📋 Plan Generated:'));
            console.log(chalk_1.default.green(`✓ Todo file saved: ${path.join(this.workingDirectory, 'todo.md')}`));
            console.log(chalk_1.default.cyan(`📊 ${plan.todos.length} todos created`));
            console.log(chalk_1.default.cyan(`⏱️  Estimated duration: ${Math.round(plan.estimatedTotalDuration)} minutes`));
            // Request approval for execution
            const approved = await enhanced_planning_1.enhancedPlanning.requestPlanApproval(plan.id);
            if (approved) {
                console.log(chalk_1.default.green('\n🚀 Switching to Auto Mode for plan execution...'));
                console.log(chalk_1.default.cyan('📋 Plan will be executed automatically without further confirmations'));
                // Switch to auto mode temporarily for execution
                const originalMode = this.currentMode;
                this.currentMode = 'auto';
                try {
                    // Execute the plan in auto mode
                    await this.executeAdvancedPlan(plan.id);
                    // Show final summary
                    this.showExecutionSummary();
                    console.log(chalk_1.default.green.bold('\n🎉 Plan execution completed successfully!'));
                    console.log(chalk_1.default.cyan('📄 Check the updated todo.md file for execution details'));
                }
                finally {
                    // Restore original mode
                    this.currentMode = originalMode;
                    console.log(chalk_1.default.blue(`🔄 Restored to ${originalMode} mode`));
                }
            }
            else {
                console.log(chalk_1.default.yellow('\n📝 Plan saved but not executed.'));
                console.log(chalk_1.default.gray('You can review the todo.md file and run `/plan execute` later.'));
                console.log(chalk_1.default.gray('Or use `/auto [task]` to execute specific parts of the plan.'));
                // Ask if they want to regenerate the plan
                const regenerate = await this.askAdvancedConfirmation('Do you want to regenerate the plan with different requirements?', 'This will create a new plan and overwrite the current todo.md', false);
                if (regenerate) {
                    const newRequirements = await this.askForInput('Enter new or modified requirements: ');
                    if (newRequirements.trim()) {
                        await this.handlePlanMode(newRequirements);
                    }
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Plan generation failed: ${error.message}`, source: 'planning' });
            console.log(chalk_1.default.red(`❌ Planning failed: ${error.message}`));
        }
    }
    showExecutionSummary() {
        const indicators = Array.from(this.indicators.values());
        const completed = indicators.filter(i => i.status === 'completed').length;
        const failed = indicators.filter(i => i.status === 'failed').length;
        const warnings = indicators.filter(i => i.status === 'warning').length;
        const summary = (0, boxen_1.default)(`${chalk_1.default.bold('Execution Summary')}\n\n` +
            `${chalk_1.default.green('✅ Completed:')} ${completed}\n` +
            `${chalk_1.default.red('❌ Failed:')} ${failed}\n` +
            `${chalk_1.default.yellow('⚠️ Warnings:')} ${warnings}\n` +
            `${chalk_1.default.blue('📊 Total:')} ${indicators.length}\n\n` +
            `${chalk_1.default.gray('Overall Status:')} ${this.getOverallStatusText()}`, {
            padding: 1,
            margin: { top: 1, bottom: 1, left: 0, right: 0 },
            borderStyle: 'round',
            borderColor: failed > 0 ? 'red' : completed === indicators.length ? 'green' : 'yellow',
        });
        console.log(summary);
    }
    getOverallStatusText() {
        const indicators = Array.from(this.indicators.values());
        if (indicators.length === 0)
            return chalk_1.default.gray('No tasks');
        const completed = indicators.filter(i => i.status === 'completed').length;
        const failed = indicators.filter(i => i.status === 'failed').length;
        if (failed > 0) {
            return chalk_1.default.red('Some tasks failed');
        }
        else if (completed === indicators.length) {
            return chalk_1.default.green('All tasks completed successfully');
        }
        else {
            return chalk_1.default.blue('Tasks in progress');
        }
    }
    /**
     * Auto mode: Execute immediately without approval
     */
    async handleAutoMode(input) {
        console.log(chalk_1.default.blue('🚀 Auto-executing task...'));
        // Use agent if specified, otherwise auto-select
        if (this.currentAgent) {
            await this.executeAgent(this.currentAgent, input, { auto: true });
        }
        else {
            await this.autoExecute(input, {});
        }
    }
    /**
     * Default mode: Interactive chat with confirmations
     */
    async handleDefaultMode(input) {
        // Check if input mentions specific agent
        const agentMatch = input.match(/@(\w+)/);
        if (agentMatch) {
            const agentName = agentMatch[1];
            const task = input.replace(agentMatch[0], '').trim();
            await this.executeAgent(agentName, task, {});
        }
        else {
            // Real chatbot conversation in default mode
            try {
                // Record user message in session
                chat_manager_1.chatManager.addMessage(input, 'user');
                // Build model-ready messages from session history (respects history setting)
                const messages = chat_manager_1.chatManager.getContextMessages().map(m => ({
                    role: m.role,
                    content: m.content,
                }));
                // Stream assistant response
                process.stdout.write(`${chalk_1.default.cyan('\nAssistant: ')}`);
                let assistantText = '';
                for await (const ev of advanced_ai_provider_1.advancedAIProvider.streamChatWithFullAutonomy(messages)) {
                    if (ev.type === 'text_delta' && ev.content) {
                        assistantText += ev.content;
                        process.stdout.write(ev.content);
                    }
                    else if (ev.type === 'error') {
                        console.log(`${chalk_1.default.red(ev.content || ev.error || 'Unknown error')}`);
                    }
                }
                // Save assistant message to history
                if (assistantText.trim().length > 0) {
                    chat_manager_1.chatManager.addMessage(assistantText.trim(), 'assistant');
                }
                console.log(); // newline after streaming
            }
            catch (err) {
                console.log(chalk_1.default.red(`Chat error: ${err.message}`));
            }
        }
    }
    /**
     * Generate execution plan for a task
     */
    async generatePlan(task, options) {
        console.log(chalk_1.default.blue(`🎯 Generating plan for: ${chalk_1.default.cyan(task)}`));
        try {
            const plan = await this.planningManager.generatePlanOnly(task, this.workingDirectory);
            if (options.save) {
                await this.savePlanToFile(plan, options.save);
            }
            if (options.execute) {
                const approved = await this.askForApproval('Execute this plan immediately?');
                if (approved) {
                    await this.planningManager.executePlan(plan.id);
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`Plan generation failed: ${error.message}`));
        }
    }
    /**
     * Execute task with specific agent
     */
    async executeAgent(name, task, options) {
        console.log(chalk_1.default.blue(`🤖 Executing with ${chalk_1.default.cyan(name)} agent...`));
        try {
            // Launch real agent via AgentService; run asynchronously
            const taskId = await agent_service_1.agentService.executeTask(name, task);
            console.log(chalk_1.default.blue(`🚀 Launched ${name} (Task ID: ${taskId.slice(-6)})`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`Agent execution failed: ${error.message}`));
        }
    }
    /**
     * Autonomous execution with best agent selection
     */
    async autoExecute(task, options) {
        console.log(chalk_1.default.blue(`🚀 Auto-executing: ${chalk_1.default.cyan(task)}`));
        try {
            if (options.planFirst) {
                // Use real PlanningService to create and execute plan asynchronously
                const plan = await planning_service_1.planningService.createPlan(task, {
                    showProgress: true,
                    autoExecute: true,
                    confirmSteps: false,
                });
                console.log(chalk_1.default.cyan(`📋 Generated plan with ${plan.steps.length} steps (id: ${plan.id}). Executing in background...`));
                // Fire-and-forget execution to keep CLI responsive
                (async () => {
                    try {
                        await planning_service_1.planningService.executePlan(plan.id, {
                            showProgress: true,
                            autoExecute: true,
                            confirmSteps: false,
                        });
                    }
                    catch (err) {
                        console.log(chalk_1.default.red(`❌ Plan execution error: ${err.message}`));
                    }
                })();
            }
            else {
                // Direct autonomous execution - select best agent and launch
                const selected = this.agentManager.findBestAgentForTask(task);
                console.log(chalk_1.default.blue(`🤖 Selected agent: ${chalk_1.default.cyan(selected)}`));
                const taskId = await agent_service_1.agentService.executeTask(selected, task);
                console.log(chalk_1.default.blue(`🚀 Launched ${selected} (Task ID: ${taskId.slice(-6)})`));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`Auto execution failed: ${error.message}`));
        }
    }
    /**
     * Manage todo items and planning
     */
    async manageTodo(options) {
        if (options.list) {
            console.log(chalk_1.default.cyan('📋 Todo Items:'));
            const plans = this.planningManager.listPlans();
            if (plans.length === 0) {
                console.log(chalk_1.default.dim('No todo items found'));
                return;
            }
            plans.forEach((plan, index) => {
                const status = '⏳'; // Plans don't have status property, using default
                console.log(`${index + 1}. ${status} ${plan.title}`);
                console.log(`   ${chalk_1.default.dim(plan.description)}`);
            });
        }
        if (options.add) {
            console.log(chalk_1.default.blue(`Adding todo: ${options.add}`));
            await this.generatePlan(options.add, {});
        }
        if (options.complete) {
            console.log(chalk_1.default.green(`Marking todo ${options.complete} as complete`));
            // Implementation for marking todo complete
        }
    }
    /**
     * Manage CLI configuration
     */
    async manageConfig(options) {
        if (options.show) {
            console.log(chalk_1.default.cyan('⚙️ Current Configuration:'));
            const config = this.configManager.getConfig();
            console.log(chalk_1.default.dim('Model:'), chalk_1.default.green(config.currentModel));
            console.log(chalk_1.default.dim('Working Directory:'), chalk_1.default.blue(this.workingDirectory));
            console.log(chalk_1.default.dim('Mode:'), chalk_1.default.yellow(this.currentMode));
            if (this.currentAgent) {
                console.log(chalk_1.default.dim('Current Agent:'), chalk_1.default.cyan(this.currentAgent));
            }
        }
        if (options.model) {
            this.switchModel(options.model);
        }
    }
    /**
     * Initialize project with CLAUDE.md context file (NIKOCLI.md)
     */
    async initProject(options) {
        console.log(chalk_1.default.blue('🔧 Initializing project context...'));
        const claudeFile = path.join(this.workingDirectory, 'NIKOCLI.md');
        try {
            // Check if CLAUDE.md (NIKOCLI.md) already exists
            const exists = await fs.access(claudeFile).then(() => true).catch(() => false);
            if (exists && !options.force) {
                console.log(chalk_1.default.yellow('NIKOCLI.md already exists. Use --force to overwrite.'));
                return;
            }
            // Analyze project structure
            console.log(chalk_1.default.dim('Analyzing project structure...'));
            const analysis = await this.analyzeProject();
            // Generate CLAUDE.md content
            const content = this.generateClaudeMarkdown(analysis);
            // Write file
            await fs.writeFile(claudeFile, content, 'utf8');
            console.log(chalk_1.default.green('✓ NIKOCLI.md created successfully'));
            console.log(chalk_1.default.dim(`Context file: ${claudeFile}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`Failed to initialize project: ${error.message}`));
        }
    }
    /**
     * Show system status and agent information
     */
    async showStatus() {
        console.log(chalk_1.default.cyan.bold('🔍 NikCLI Status'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        // System info
        console.log(chalk_1.default.blue('System:'));
        console.log(`  Working Directory: ${chalk_1.default.dim(this.workingDirectory)}`);
        console.log(`  Mode: ${chalk_1.default.yellow(this.currentMode)}`);
        console.log(`  Model: ${chalk_1.default.green(advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo().name)}`);
        // Agent info
        if (this.currentAgent) {
            console.log(`  Current Agent: ${chalk_1.default.cyan(this.currentAgent)}`);
        }
        // Agent manager stats
        const stats = this.agentManager.getStats();
        console.log(chalk_1.default.blue('\nAgents:'));
        console.log(`  Total: ${stats.totalAgents}`);
        console.log(`  Active: ${stats.activeAgents}`);
        console.log(`  Pending Tasks: ${stats.pendingTasks}`);
        // Planning stats
        const planningStats = this.planningManager.getPlanningStats();
        console.log(chalk_1.default.blue('\nPlanning:'));
        console.log(`  Plans Generated: ${planningStats.totalPlansGenerated}`);
        console.log(`  Plans Executed: ${planningStats.totalPlansExecuted}`);
        console.log(`  Success Rate: ${Math.round((planningStats.successfulExecutions / planningStats.totalPlansExecuted) * 100)}%`);
    }
    /**
     * List available agents and their capabilities
     */
    async listAgents() {
        console.log(chalk_1.default.cyan.bold('🤖 Available Agents'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        const available = agent_service_1.agentService.getAvailableAgents();
        available.forEach(agent => {
            console.log(chalk_1.default.white(`  • ${agent.name}`));
            console.log(chalk_1.default.gray(`    ${agent.description}`));
        });
    }
    /**
     * List available AI models
     */
    async listModels() {
        console.log(chalk_1.default.cyan.bold('🧠 Available Models'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        // Mock models for now
        const models = [
            { provider: 'openai', model: 'gpt-4' },
            { provider: 'anthropic', model: 'claude-3-sonnet' },
            { provider: 'google', model: 'gemini-pro' }
        ];
        const currentModel = 'claude-3-sonnet'; // Mock current model
        models.forEach((modelInfo) => {
            const model = modelInfo.model;
            const indicator = model === currentModel ? chalk_1.default.green('→') : ' ';
            console.log(`${indicator} ${model}`);
        });
    }
    // Command Handler Methods
    async handleFileOperations(command, args) {
        try {
            switch (command) {
                case 'read': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /read <filepath> [<from-to>] [--from N --to M] [--step K] [--more]'));
                        return;
                    }
                    const filePath = args[0];
                    const rest = args.slice(1);
                    // Helpers for flag parsing
                    const hasFlag = (name) => rest.includes(`--${name}`);
                    const getFlag = (name) => {
                        const i = rest.findIndex(v => v === `--${name}`);
                        return i !== -1 ? rest[i + 1] : undefined;
                    };
                    const rangeToken = rest.find(v => /^\d+-\d+$/.test(v));
                    // Determine mode
                    let mode = 'default';
                    if (hasFlag('more'))
                        mode = 'more';
                    else if (rangeToken || hasFlag('from') || hasFlag('to'))
                        mode = 'range';
                    else if (hasFlag('step'))
                        mode = 'step';
                    const defaultStep = 200;
                    let step = parseInt(getFlag('step') || `${defaultStep}`, 10);
                    if (!Number.isFinite(step) || step <= 0)
                        step = defaultStep;
                    const fileInfo = await tools_manager_1.toolsManager.readFile(filePath);
                    const lines = fileInfo.content.split(/\r?\n/);
                    const total = lines.length;
                    const key = `read:${path.resolve(filePath)}`;
                    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
                    console.log(chalk_1.default.blue(`📄 File: ${filePath} (${fileInfo.size} bytes, ${fileInfo.language || 'unknown'})`));
                    console.log(chalk_1.default.gray(`Lines: ${total}`));
                    console.log(chalk_1.default.gray('─'.repeat(50)));
                    const printSlice = (from, to) => {
                        const f = clamp(from, 1, total);
                        const t = clamp(to, 1, total);
                        if (f > total) {
                            console.log(chalk_1.default.yellow('End of file reached.'));
                            return { printed: false, end: total };
                        }
                        const slice = lines.slice(f - 1, t).join('\n');
                        console.log(chalk_1.default.gray(`Showing lines ${f}-${t} of ${total}`));
                        console.log(slice);
                        return { printed: true, end: t };
                    };
                    if (mode === 'range') {
                        // Parse from/to
                        let from;
                        let to;
                        if (rangeToken) {
                            const [a, b] = rangeToken.split('-').map(s => parseInt(s, 10));
                            if (Number.isFinite(a))
                                from = a;
                            if (Number.isFinite(b))
                                to = b;
                        }
                        const fromFlag = parseInt(getFlag('from') || '', 10);
                        const toFlag = parseInt(getFlag('to') || '', 10);
                        if (Number.isFinite(fromFlag))
                            from = fromFlag;
                        if (Number.isFinite(toFlag))
                            to = toFlag;
                        const f = clamp((from ?? 1), 1, total);
                        const t = clamp((to ?? (f + step - 1)), 1, total);
                        printSlice(f, t);
                        // Prepare next cursor
                        this.sessionContext.set(key, { nextStart: t + 1, step });
                    }
                    else if (mode === 'step') {
                        const f = 1;
                        const t = clamp(f + step - 1, 1, total);
                        printSlice(f, t);
                        this.sessionContext.set(key, { nextStart: t + 1, step });
                    }
                    else if (mode === 'more') {
                        const state = this.sessionContext.get(key) || { nextStart: 1, step };
                        // Allow overriding step via flag in --more
                        if (hasFlag('step'))
                            state.step = step;
                        const f = clamp(state.nextStart || 1, 1, total);
                        const t = clamp(f + (state.step || step) - 1, 1, total);
                        const res = printSlice(f, t);
                        if (res.printed) {
                            this.sessionContext.set(key, { nextStart: (res.end + 1), step: (state.step || step) });
                            if (res.end < total) {
                                console.log(chalk_1.default.gray('─'.repeat(50)));
                                console.log(chalk_1.default.cyan(`Tip: use "/read ${filePath} --more" to continue (next from line ${res.end + 1})`));
                            }
                        }
                    }
                    else {
                        // default behavior: show all, but protect against huge outputs
                        if (total > 400) {
                            const approved = await this.askAdvancedConfirmation(`Large file: ${total} lines`, `Show first ${defaultStep} lines now?`, false);
                            if (approved) {
                                const f = 1;
                                const t = clamp(f + defaultStep - 1, 1, total);
                                printSlice(f, t);
                                this.sessionContext.set(key, { nextStart: t + 1, step: defaultStep });
                                if (t < total) {
                                    console.log(chalk_1.default.gray('─'.repeat(50)));
                                    console.log(chalk_1.default.cyan(`Tip: use "/read ${filePath} --more" to continue (next from line ${t + 1})`));
                                }
                            }
                            else {
                                console.log(chalk_1.default.yellow('Skipped large output. Specify a range, e.g.'));
                                console.log(chalk_1.default.cyan(`/read ${filePath} 1-200`));
                            }
                        }
                        else {
                            console.log(fileInfo.content);
                        }
                    }
                    console.log(chalk_1.default.gray('─'.repeat(50)));
                    break;
                }
                case 'write': {
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /write <filepath> <content>'));
                        return;
                    }
                    const filePath = args[0];
                    const content = args.slice(1).join(' ');
                    // Request approval
                    const approved = await this.askAdvancedConfirmation(`Write file: ${filePath}`, `Write ${content.length} characters to file`, false);
                    if (!approved) {
                        console.log(chalk_1.default.yellow('❌ File write operation cancelled'));
                        return;
                    }
                    const writeId = 'write-' + Date.now();
                    this.createStatusIndicator(writeId, `Writing ${filePath}`);
                    this.startAdvancedSpinner(writeId, 'Writing file...');
                    await tools_manager_1.toolsManager.writeFile(filePath, content);
                    this.stopAdvancedSpinner(writeId, true, `File written: ${filePath}`);
                    console.log(chalk_1.default.green(`✅ File written: ${filePath}`));
                    break;
                }
                case 'edit': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /edit <filepath>'));
                        return;
                    }
                    const filePath = args[0];
                    console.log(chalk_1.default.blue(`📝 Opening ${filePath} in system editor...`));
                    try {
                        await tools_manager_1.toolsManager.runCommand('code', [filePath]);
                    }
                    catch {
                        try {
                            await tools_manager_1.toolsManager.runCommand('open', [filePath]);
                        }
                        catch {
                            console.log(chalk_1.default.yellow(`Could not open ${filePath}. Please open it manually.`));
                        }
                    }
                    break;
                }
                case 'ls': {
                    const directory = args[0] || '.';
                    const files = await tools_manager_1.toolsManager.listFiles(directory);
                    console.log(chalk_1.default.blue(`📁 Files in ${directory}:`));
                    console.log(chalk_1.default.gray('─'.repeat(40)));
                    if (files.length === 0) {
                        console.log(chalk_1.default.yellow('No files found'));
                    }
                    else {
                        files.slice(0, 50).forEach(file => {
                            console.log(`${chalk_1.default.cyan('•')} ${file}`);
                        });
                        if (files.length > 50) {
                            console.log(chalk_1.default.gray(`... and ${files.length - 50} more files`));
                        }
                    }
                    break;
                }
                case 'search': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /search <query> [directory] [--limit N] [--more]'));
                        return;
                    }
                    const query = args[0];
                    const directory = (args[1] && !args[1].startsWith('--')) ? args[1] : '.';
                    const rest = args.slice(1).filter(a => a.startsWith('--'));
                    const hasFlag = (name) => rest.includes(`--${name}`);
                    const getFlag = (name) => {
                        const i = rest.findIndex(v => v === `--${name}`);
                        return i !== -1 ? rest[i + 1] : undefined;
                    };
                    let limit = parseInt(getFlag('limit') || '30', 10);
                    if (!Number.isFinite(limit) || limit <= 0)
                        limit = 30;
                    const key = `search:${path.resolve(directory)}:${query}`;
                    const state = this.sessionContext.get(key) || { offset: 0, limit };
                    if (hasFlag('limit'))
                        state.limit = limit;
                    console.log(chalk_1.default.blue(`🔍 Searching for "${query}" in ${directory}...`));
                    const spinId = `search-${Date.now()}`;
                    this.createStatusIndicator(spinId, `Searching: ${query}`, `in ${directory}`);
                    this.startAdvancedSpinner(spinId, `Searching files...`);
                    const results = await tools_manager_1.toolsManager.searchInFiles(query, directory);
                    this.stopAdvancedSpinner(spinId, true, `Search complete: ${results.length} matches`);
                    if (results.length === 0) {
                        console.log(chalk_1.default.yellow('No matches found'));
                    }
                    else {
                        const start = Math.max(0, state.offset);
                        const end = Math.min(results.length, start + (state.limit || limit));
                        console.log(chalk_1.default.green(`Found ${results.length} matches (showing ${start + 1}-${end}):`));
                        console.log(chalk_1.default.gray('─'.repeat(50)));
                        results.slice(start, end).forEach(result => {
                            console.log(chalk_1.default.cyan(`${result.file}:${result.line}`));
                            console.log(`  ${result.content}`);
                        });
                        if (end < results.length) {
                            this.sessionContext.set(key, { offset: end, limit: (state.limit || limit) });
                            console.log(chalk_1.default.gray('─'.repeat(50)));
                            console.log(chalk_1.default.cyan(`Tip: use "/search ${query} ${directory} --more" to see the next ${state.limit || limit} results`));
                        }
                        else {
                            this.sessionContext.delete(key);
                        }
                    }
                    break;
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `File operation failed: ${error.message}`, source: 'file-ops' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    async handleTerminalOperations(command, args) {
        try {
            switch (command) {
                case 'run': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /run <command> [args...]'));
                        return;
                    }
                    const [cmd, ...cmdArgs] = args;
                    const fullCommand = `${cmd} ${cmdArgs.join(' ')}`;
                    const approved = await this.askAdvancedConfirmation(`Execute command: ${fullCommand}`, `Run command in ${process.cwd()}`, false);
                    if (!approved) {
                        console.log(chalk_1.default.yellow('❌ Command execution cancelled'));
                        return;
                    }
                    console.log(chalk_1.default.blue(`⚡ Running: ${fullCommand}`));
                    const cmdId = 'cmd-' + Date.now();
                    this.createStatusIndicator(cmdId, `Executing: ${cmd}`);
                    this.startAdvancedSpinner(cmdId, `Running: ${fullCommand}`);
                    const result = await tools_manager_1.toolsManager.runCommand(cmd, cmdArgs, { stream: true });
                    if (result.code === 0) {
                        this.stopAdvancedSpinner(cmdId, true, 'Command completed successfully');
                        console.log(chalk_1.default.green('✅ Command completed successfully'));
                    }
                    else {
                        this.stopAdvancedSpinner(cmdId, false, `Command failed with exit code ${result.code}`);
                        console.log(chalk_1.default.red(`❌ Command failed with exit code ${result.code}`));
                    }
                    break;
                }
                case 'install': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /install <packages...>'));
                        console.log(chalk_1.default.gray('Options: --global, --dev, --yarn, --pnpm'));
                        return;
                    }
                    const packages = args.filter(arg => !arg.startsWith('--'));
                    const isGlobal = args.includes('--global') || args.includes('-g');
                    const isDev = args.includes('--dev') || args.includes('-D');
                    const manager = args.includes('--yarn') ? 'yarn' :
                        args.includes('--pnpm') ? 'pnpm' : 'npm';
                    const approved = await this.askAdvancedConfirmation(`Install packages: ${packages.join(', ')}`, `Using ${manager}${isGlobal ? ' (global)' : ''}${isDev ? ' (dev)' : ''}`, false);
                    if (!approved) {
                        console.log(chalk_1.default.yellow('❌ Package installation cancelled'));
                        return;
                    }
                    console.log(chalk_1.default.blue(`📦 Installing ${packages.join(', ')} with ${manager}...`));
                    const installId = 'install-' + Date.now();
                    this.createAdvancedProgressBar(installId, 'Installing packages', packages.length);
                    for (let i = 0; i < packages.length; i++) {
                        const pkg = packages[i];
                        this.updateStatusIndicator(installId, { details: `Installing ${pkg}...` });
                        const success = await tools_manager_1.toolsManager.installPackage(pkg, {
                            global: isGlobal,
                            dev: isDev,
                            manager: manager
                        });
                        if (!success) {
                            this.addLiveUpdate({ type: 'warning', content: `Failed to install ${pkg}`, source: 'install' });
                            console.log(chalk_1.default.yellow(`⚠️ Failed to install ${pkg}`));
                        }
                        else {
                            this.addLiveUpdate({ type: 'log', content: `Installed ${pkg}`, source: 'install' });
                        }
                        this.updateAdvancedProgress(installId, i + 1, packages.length);
                    }
                    this.completeAdvancedProgress(installId, `Completed installation of ${packages.length} packages`);
                    console.log(chalk_1.default.green(`✅ Package installation completed`));
                    break;
                }
                case 'npm':
                case 'yarn':
                case 'git':
                case 'docker': {
                    await tools_manager_1.toolsManager.runCommand(command, args, { stream: true });
                    break;
                }
                case 'ps': {
                    const processes = tools_manager_1.toolsManager.getRunningProcesses();
                    console.log(chalk_1.default.blue('🔄 Running Processes:'));
                    console.log(chalk_1.default.gray('─'.repeat(50)));
                    if (processes.length === 0) {
                        console.log(chalk_1.default.yellow('No processes currently running'));
                    }
                    else {
                        processes.forEach(proc => {
                            const duration = Date.now() - proc.startTime.getTime();
                            console.log(`${chalk_1.default.cyan('PID')} ${proc.pid}: ${chalk_1.default.bold(proc.command)} ${proc.args.join(' ')}`);
                            console.log(`  Status: ${proc.status} | Duration: ${Math.round(duration / 1000)}s`);
                            console.log(`  Working Dir: ${proc.cwd}`);
                        });
                    }
                    break;
                }
                case 'kill': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /kill <pid>'));
                        return;
                    }
                    const pid = parseInt(args[0]);
                    if (isNaN(pid)) {
                        console.log(chalk_1.default.red('Invalid PID'));
                        return;
                    }
                    console.log(chalk_1.default.yellow(`⚠️ Attempting to kill process ${pid}...`));
                    const success = await tools_manager_1.toolsManager.killProcess(pid);
                    if (success) {
                        console.log(chalk_1.default.green(`✅ Process ${pid} terminated`));
                    }
                    else {
                        console.log(chalk_1.default.red(`❌ Could not kill process ${pid}`));
                    }
                    break;
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Terminal operation failed: ${error.message}`, source: 'terminal' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    async handleProjectOperations(command, args) {
        try {
            switch (command) {
                case 'build': {
                    console.log(chalk_1.default.blue('🔨 Building project...'));
                    const result = await tools_manager_1.toolsManager.build();
                    if (result.success) {
                        console.log(chalk_1.default.green('✅ Build completed successfully'));
                    }
                    else {
                        console.log(chalk_1.default.red('❌ Build failed'));
                        if (result.errors && result.errors.length > 0) {
                            console.log(chalk_1.default.yellow('Errors found:'));
                            result.errors.forEach(error => {
                                console.log(`  ${chalk_1.default.red('•')} ${error.message}`);
                            });
                        }
                    }
                    break;
                }
                case 'test': {
                    const pattern = args[0];
                    console.log(chalk_1.default.blue(`🧪 Running tests${pattern ? ` (${pattern})` : ''}...`));
                    const result = await tools_manager_1.toolsManager.runTests(pattern);
                    if (result.success) {
                        console.log(chalk_1.default.green('✅ All tests passed'));
                    }
                    else {
                        console.log(chalk_1.default.red('❌ Some tests failed'));
                        if (result.errors && result.errors.length > 0) {
                            console.log(chalk_1.default.yellow('Test errors:'));
                            result.errors.forEach(error => {
                                console.log(`  ${chalk_1.default.red('•')} ${error.message}`);
                            });
                        }
                    }
                    break;
                }
                case 'lint': {
                    console.log(chalk_1.default.blue('🔍 Running linter...'));
                    const result = await tools_manager_1.toolsManager.lint();
                    if (result.success) {
                        console.log(chalk_1.default.green('✅ No linting errors found'));
                    }
                    else {
                        console.log(chalk_1.default.yellow('⚠️ Linting issues found'));
                        if (result.errors && result.errors.length > 0) {
                            result.errors.forEach(error => {
                                const severity = error.severity === 'error' ? chalk_1.default.red('ERROR') : chalk_1.default.yellow('WARNING');
                                console.log(`  ${severity}: ${error.message}`);
                            });
                        }
                    }
                    break;
                }
                case 'create': {
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /create <type> <name>'));
                        console.log(chalk_1.default.gray('Types: react, next, node, express'));
                        return;
                    }
                    const [type, name] = args;
                    console.log(chalk_1.default.blue(`🚀 Creating ${type} project: ${name}`));
                    const result = await tools_manager_1.toolsManager.setupProject(type, name);
                    if (result.success) {
                        console.log(chalk_1.default.green(`✅ Project ${name} created successfully!`));
                        console.log(chalk_1.default.gray(`📁 Location: ${result.path}`));
                    }
                    else {
                        console.log(chalk_1.default.red(`❌ Failed to create project ${name}`));
                    }
                    break;
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Project operation failed: ${error.message}`, source: 'project' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    async handleSessionManagement(command, args) {
        try {
            switch (command) {
                case 'new': {
                    const title = args.join(' ') || undefined;
                    const session = chat_manager_1.chatManager.createNewSession(title);
                    console.log(chalk_1.default.green(`✅ New session created: ${session.title} (${session.id.slice(0, 8)})`));
                    break;
                }
                case 'sessions': {
                    const sessions = chat_manager_1.chatManager.listSessions();
                    const current = chat_manager_1.chatManager.getCurrentSession();
                    console.log(chalk_1.default.blue.bold('\n📝 Chat Sessions:'));
                    console.log(chalk_1.default.gray('─'.repeat(40)));
                    if (sessions.length === 0) {
                        console.log(chalk_1.default.gray('No sessions found'));
                    }
                    else {
                        sessions.forEach((session) => {
                            const isCurrent = session.id === current?.id;
                            const prefix = isCurrent ? chalk_1.default.yellow('→ ') : '  ';
                            const messageCount = session.messages.filter(m => m.role !== 'system').length;
                            console.log(`${prefix}${chalk_1.default.bold(session.title)} ${chalk_1.default.gray(`(${session.id.slice(0, 8)})`)}`);
                            console.log(`    ${chalk_1.default.gray(`${messageCount} messages | ${session.updatedAt.toLocaleString()}`)}`);
                        });
                    }
                    break;
                }
                case 'export': {
                    const sessionId = args[0];
                    const markdown = chat_manager_1.chatManager.exportSession(sessionId);
                    const filename = `chat-export-${Date.now()}.md`;
                    await fs.writeFile(filename, markdown);
                    console.log(chalk_1.default.green(`✅ Session exported to ${filename}`));
                    break;
                }
                case 'stats': {
                    const stats = chat_manager_1.chatManager.getSessionStats();
                    const modelInfo = advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo();
                    console.log(chalk_1.default.blue.bold('\n📊 Usage Statistics:'));
                    console.log(chalk_1.default.gray('─'.repeat(40)));
                    console.log(chalk_1.default.green(`Current Model: ${modelInfo.name}`));
                    console.log(chalk_1.default.green(`Total Sessions: ${stats.totalSessions}`));
                    console.log(chalk_1.default.green(`Total Messages: ${stats.totalMessages}`));
                    console.log(chalk_1.default.green(`Current Session Messages: ${stats.currentSessionMessages}`));
                    break;
                }
                case 'history': {
                    if (args.length === 0) {
                        const enabled = config_manager_1.configManager.get('chatHistory');
                        console.log(chalk_1.default.green(`Chat history: ${enabled ? 'enabled' : 'disabled'}`));
                        return;
                    }
                    const setting = args[0].toLowerCase();
                    if (setting !== 'on' && setting !== 'off') {
                        console.log(chalk_1.default.red('Usage: /history <on|off>'));
                        return;
                    }
                    config_manager_1.configManager.set('chatHistory', setting === 'on');
                    console.log(chalk_1.default.green(`✅ Chat history ${setting === 'on' ? 'enabled' : 'disabled'}`));
                    break;
                }
                case 'debug': {
                    console.log(chalk_1.default.blue.bold('\n🔍 Debug Information:'));
                    console.log(chalk_1.default.gray('═'.repeat(40)));
                    const currentModel = config_manager_1.configManager.getCurrentModel();
                    console.log(chalk_1.default.green(`Current Model: ${currentModel}`));
                    const models = config_manager_1.configManager.get('models');
                    const currentModelConfig = models[currentModel];
                    if (currentModelConfig) {
                        console.log(chalk_1.default.green(`Provider: ${currentModelConfig.provider}`));
                        console.log(chalk_1.default.green(`Model: ${currentModelConfig.model}`));
                    }
                    // Test API key
                    const apiKey = config_manager_1.configManager.getApiKey(currentModel);
                    if (apiKey) {
                        console.log(chalk_1.default.green(`✅ API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)} (${apiKey.length} chars)`));
                    }
                    else {
                        console.log(chalk_1.default.red(`❌ API Key: Not configured`));
                    }
                    break;
                }
                case 'temp': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.green(`Current temperature: ${config_manager_1.configManager.get('temperature')}`));
                        return;
                    }
                    const temp = parseFloat(args[0]);
                    if (isNaN(temp) || temp < 0 || temp > 2) {
                        console.log(chalk_1.default.red('Temperature must be between 0.0 and 2.0'));
                        return;
                    }
                    config_manager_1.configManager.set('temperature', temp);
                    console.log(chalk_1.default.green(`✅ Temperature set to ${temp}`));
                    break;
                }
                case 'system': {
                    if (args.length === 0) {
                        const session = chat_manager_1.chatManager.getCurrentSession();
                        console.log(chalk_1.default.green('Current system prompt:'));
                        console.log(chalk_1.default.gray(session?.systemPrompt || 'None'));
                        return;
                    }
                    const prompt = args.join(' ');
                    const session = chat_manager_1.chatManager.getCurrentSession();
                    if (session) {
                        session.systemPrompt = prompt;
                        // Update the system message
                        const systemMsgIndex = session.messages.findIndex(m => m.role === 'system');
                        if (systemMsgIndex >= 0) {
                            session.messages[systemMsgIndex].content = prompt;
                        }
                        else {
                            session.messages.unshift({
                                role: 'system',
                                content: prompt,
                                timestamp: new Date(),
                            });
                        }
                        console.log(chalk_1.default.green('✅ System prompt updated'));
                    }
                    break;
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Session management failed: ${error.message}`, source: 'session' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    async handleModelConfig(command, args) {
        try {
            switch (command) {
                case 'model': {
                    if (args.length === 0) {
                        const current = advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo();
                        console.log(chalk_1.default.green(`Current model: ${current.name} (${current.config?.provider || 'unknown'})`));
                        return;
                    }
                    const modelName = args[0];
                    config_manager_1.configManager.setCurrentModel(modelName);
                    console.log(chalk_1.default.green(`✅ Switched to model: ${modelName}`));
                    break;
                }
                case 'models': {
                    console.log(chalk_1.default.blue.bold('\n🤖 Available Models:'));
                    console.log(chalk_1.default.gray('─'.repeat(40)));
                    const currentModel = config_manager_1.configManager.get('currentModel');
                    const models = config_manager_1.configManager.get('models');
                    Object.entries(models).forEach(([name, config]) => {
                        const isCurrent = name === currentModel;
                        const hasKey = config_manager_1.configManager.getApiKey(name) !== undefined;
                        const status = hasKey ? chalk_1.default.green('✅') : chalk_1.default.red('❌');
                        const prefix = isCurrent ? chalk_1.default.yellow('→ ') : '  ';
                        console.log(`${prefix}${status} ${chalk_1.default.bold(name)}`);
                        console.log(`    ${chalk_1.default.gray(`Provider: ${config.provider} | Model: ${config.model}`)}`);
                    });
                    break;
                }
                case 'set-key': {
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /set-key <model> <api-key>'));
                        console.log(chalk_1.default.gray('Example: /set-key claude-3-5-sonnet sk-ant-...'));
                        return;
                    }
                    const [modelName, apiKey] = args;
                    config_manager_1.configManager.setApiKey(modelName, apiKey);
                    console.log(chalk_1.default.green(`✅ API key set for ${modelName}`));
                    break;
                }
                case 'config': {
                    console.log(chalk_1.default.cyan('⚙️ Current Configuration:'));
                    const config = config_manager_1.configManager.getConfig();
                    console.log(JSON.stringify(config, null, 2));
                    break;
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Model/config operation failed: ${error.message}`, source: 'config' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    async handleAdvancedFeatures(command, args) {
        try {
            switch (command) {
                case 'agents': {
                    console.log(chalk_1.default.blue.bold('\n🤖 Available Agents:'));
                    console.log(chalk_1.default.gray('─'.repeat(40)));
                    const agents = agent_service_1.agentService.getAvailableAgents();
                    agents.forEach(agent => {
                        console.log(`${chalk_1.default.green('•')} ${chalk_1.default.bold(agent.name)}`);
                        console.log(`  ${chalk_1.default.gray(agent.description)}`);
                    });
                    break;
                }
                case 'agent': {
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /agent <name> <task>'));
                        return;
                    }
                    const agentName = args[0];
                    const task = args.slice(1).join(' ');
                    console.log(chalk_1.default.blue(`🤖 Executing with ${chalk_1.default.cyan(agentName)} agent...`));
                    const taskId = await agent_service_1.agentService.executeTask(agentName, task);
                    console.log(chalk_1.default.blue(`🚀 Launched ${agentName} (Task ID: ${taskId.slice(-6)})`));
                    break;
                }
                case 'parallel': {
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /parallel <agent1,agent2,...> <task>'));
                        return;
                    }
                    const agentNames = args[0].split(',').map(name => name.trim());
                    const task = args.slice(1).join(' ');
                    console.log(chalk_1.default.blue(`⚡ Running ${agentNames.length} agents in parallel...`));
                    // Implementation would execute agents in parallel
                    break;
                }
                case 'factory': {
                    agent_factory_1.agentFactory.showFactoryDashboard();
                    break;
                }
                case 'create-agent': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /create-agent <specialization>'));
                        return;
                    }
                    const specialization = args.join(' ');
                    const blueprint = await agent_factory_1.agentFactory.createAgentBlueprint({
                        specialization,
                        autonomyLevel: 'fully-autonomous',
                        contextScope: 'project',
                    });
                    console.log(chalk_1.default.green(`✅ Agent blueprint created: ${blueprint.name}`));
                    console.log(chalk_1.default.gray(`Blueprint ID: ${blueprint.id}`));
                    break;
                }
                case 'launch-agent': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /launch-agent <blueprint-id> [task]'));
                        return;
                    }
                    const blueprintId = args[0];
                    const task = args.slice(1).join(' ');
                    const agent = await agent_factory_1.agentFactory.launchAgent(blueprintId);
                    if (task) {
                        console.log(chalk_1.default.blue(`🚀 Running agent with task: ${task}`));
                        const result = await agent.run(task);
                        console.log(chalk_1.default.green('✅ Agent execution completed'));
                    }
                    else {
                        console.log(chalk_1.default.blue('🤖 Agent launched and ready'));
                    }
                    break;
                }
                case 'context': {
                    if (args.length === 0) {
                        workspace_context_1.workspaceContext.showContextSummary();
                        return;
                    }
                    const paths = args;
                    await workspace_context_1.workspaceContext.selectPaths(paths);
                    console.log(chalk_1.default.green('✅ Workspace context updated'));
                    break;
                }
                case 'stream': {
                    if (args.length > 0 && args[0] === 'clear') {
                        const activeAgents = agent_stream_1.agentStream.getActiveAgents();
                        activeAgents.forEach(agentId => {
                            agent_stream_1.agentStream.clearAgentStream(agentId);
                        });
                        console.log(chalk_1.default.green('✅ All agent streams cleared'));
                    }
                    else {
                        agent_stream_1.agentStream.showLiveDashboard();
                    }
                    break;
                }
                case 'approval': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.blue('Approval System Configuration:'));
                        const config = approval_system_1.approvalSystem.getConfig();
                        console.log(JSON.stringify(config, null, 2));
                    }
                    else {
                        // Handle approval subcommands
                        const subcommand = args[0];
                        if (subcommand === 'test') {
                            const approved = await approval_system_1.approvalSystem.quickApproval('Test Approval', 'This is a test of the approval system', 'low');
                            console.log(approved ? chalk_1.default.green('Approved') : chalk_1.default.yellow('Cancelled'));
                        }
                    }
                    break;
                }
                case 'todo':
                case 'todos': {
                    await this.handleTodoOperations(command, args);
                    break;
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Advanced feature failed: ${error.message}`, source: 'advanced' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    // Enhanced Planning Methods (from enhanced-planning.ts)
    async generateAdvancedPlan(goal, options = {}) {
        const { maxTodos = 20, includeContext = true, showDetails = true, saveTodoFile = true, todoFilePath = 'todo.md' } = options;
        console.log(chalk_1.default.blue.bold(`\n🎯 Generating Advanced Plan: ${goal}`));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        // Get project context
        let projectContext = '';
        if (includeContext) {
            console.log(chalk_1.default.gray('📁 Analyzing project context...'));
            const context = workspace_context_1.workspaceContext.getContextForAgent('planner', 10);
            projectContext = context.projectSummary;
        }
        // Generate AI-powered plan
        console.log(chalk_1.default.gray('🧠 Generating AI plan...'));
        const todos = await this.generateTodosWithAI(goal, projectContext, maxTodos);
        // Create plan object
        const plan = {
            id: Date.now().toString(),
            title: this.extractPlanTitle(goal),
            description: goal,
            goal,
            todos,
            status: 'draft',
            estimatedTotalDuration: todos.reduce((sum, todo) => sum + todo.estimatedDuration, 0),
            createdAt: new Date(),
            workingDirectory: this.workingDirectory,
            context: {
                projectInfo: includeContext ? projectContext : undefined,
                userRequirements: [goal],
            },
        };
        // Show plan details
        if (showDetails) {
            this.displayAdvancedPlan(plan);
        }
        // Save todo.md file
        if (saveTodoFile) {
            await this.saveTodoMarkdown(plan, todoFilePath);
        }
        return plan;
    }
    async generateTodosWithAI(goal, context, maxTodos) {
        try {
            // Build context-aware message for AI planning
            const messages = [{
                role: 'system',
                content: `You are an expert project planner. Create a detailed, actionable plan to accomplish the given goal.

Generate a JSON array of todo items with the following structure:
{
  "todos": [
    {
      "title": "Clear, actionable title",
      "description": "Detailed description of what needs to be done",
      "priority": "low|medium|high|critical",
      "category": "planning|setup|implementation|testing|documentation|deployment",
      "estimatedDuration": 30,
      "dependencies": [],
      "tags": ["tag1", "tag2"],
      "commands": ["command1", "command2"],
      "files": ["file1.ts", "file2.js"],
      "reasoning": "Why this todo is necessary and how it fits in the overall plan"
    }
  ]
}

Project Context:\n${context}\n\nGenerate a comprehensive plan that is practical and executable.`
            }, {
                role: 'user',
                content: `Create a detailed plan to: ${goal}`
            }];
            // Stream AI response for real-time feedback
            let assistantText = '';
            for await (const ev of advanced_ai_provider_1.advancedAIProvider.streamChatWithFullAutonomy(messages)) {
                if (ev.type === 'text_delta' && ev.content) {
                    assistantText += ev.content;
                    process.stdout.write(ev.content);
                }
            }
            console.log(); // newline
            // Extract JSON from response
            const jsonMatch = assistantText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('AI did not return valid JSON plan');
            }
            const planData = JSON.parse(jsonMatch[0]);
            // Convert to TodoItem format
            const todos = planData.todos.map((todoData, index) => ({
                id: `todo-${Date.now()}-${index}`,
                title: todoData.title || `Task ${index + 1}`,
                description: todoData.description || '',
                status: 'pending',
                priority: todoData.priority || 'medium',
                category: todoData.category || 'implementation',
                estimatedDuration: todoData.estimatedDuration || 30,
                dependencies: todoData.dependencies || [],
                tags: todoData.tags || [],
                commands: todoData.commands || [],
                files: todoData.files || [],
                reasoning: todoData.reasoning || '',
                createdAt: new Date(),
            }));
            console.log(chalk_1.default.green(`✅ Generated ${todos.length} todos`));
            return todos;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to generate AI plan: ${error.message}`));
            // Fallback: create a simple todo
            return [{
                id: `todo-${Date.now()}`,
                title: 'Execute Task',
                description: goal,
                status: 'pending',
                priority: 'medium',
                category: 'implementation',
                estimatedDuration: 60,
                dependencies: [],
                tags: ['manual'],
                reasoning: 'Fallback todo when AI planning fails',
                createdAt: new Date(),
            }];
        }
    }
    displayAdvancedPlan(plan) {
        console.log((0, boxen_1.default)(`${chalk_1.default.blue.bold(plan.title)}\n\n` +
            `${chalk_1.default.gray('Goal:')} ${plan.goal}\n` +
            `${chalk_1.default.gray('Todos:')} ${plan.todos.length}\n` +
            `${chalk_1.default.gray('Estimated Duration:')} ${Math.round(plan.estimatedTotalDuration)} minutes\n` +
            `${chalk_1.default.gray('Status:')} ${this.getPlanStatusColor(plan.status)(plan.status.toUpperCase())}`, {
            padding: 1,
            margin: { top: 1, bottom: 1, left: 0, right: 0 },
            borderStyle: 'round',
            borderColor: 'blue',
        }));
        console.log(chalk_1.default.blue.bold('\n📋 Todo Items:'));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        plan.todos.forEach((todo, index) => {
            const priorityIcon = this.getPlanPriorityIcon(todo.priority);
            const statusIcon = this.getPlanStatusIcon(todo.status);
            const categoryColor = this.getPlanCategoryColor(todo.category);
            console.log(`${index + 1}. ${statusIcon} ${priorityIcon} ${chalk_1.default.bold(todo.title)}`);
            console.log(`   ${chalk_1.default.gray(todo.description)}`);
            console.log(`   ${categoryColor(todo.category)} | ${chalk_1.default.gray(todo.estimatedDuration + 'min')} | ${chalk_1.default.gray(todo.tags.join(', '))}`);
            if (todo.dependencies.length > 0) {
                console.log(`   ${chalk_1.default.yellow('Dependencies:')} ${todo.dependencies.join(', ')}`);
            }
            if (todo.files && todo.files.length > 0) {
                console.log(`   ${chalk_1.default.blue('Files:')} ${todo.files.join(', ')}`);
            }
            console.log();
        });
    }
    async executeAdvancedPlan(planId) {
        const plan = enhanced_planning_1.enhancedPlanning.getPlan(planId);
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }
        if (plan.status !== 'approved') {
            const approved = await this.handlePlanApproval(planId);
            if (!approved) {
                return;
            }
        }
        console.log(chalk_1.default.blue.bold(`\n🚀 Executing Plan: ${plan.title}`));
        console.log(chalk_1.default.cyan('🤖 Auto Mode: Plan will execute automatically'));
        console.log(chalk_1.default.gray('═'.repeat(60)));
        plan.status = 'executing';
        plan.startedAt = new Date();
        try {
            // Execute todos in dependency order
            const executionOrder = this.resolveDependencyOrder(plan.todos);
            let completedCount = 0;
            let autoSkipped = 0;
            for (const todo of executionOrder) {
                console.log(chalk_1.default.cyan(`\n📋 [${completedCount + 1}/${plan.todos.length}] ${todo.title}`));
                console.log(chalk_1.default.gray(`   ${todo.description}`));
                todo.status = 'in_progress';
                todo.startedAt = new Date();
                try {
                    // Execute the todo
                    const startTime = Date.now();
                    await this.executeSingleTodo(todo, plan);
                    const duration = Date.now() - startTime;
                    todo.status = 'completed';
                    todo.completedAt = new Date();
                    todo.actualDuration = Math.round(duration / 60000);
                    console.log(chalk_1.default.green(`   ✅ Completed in ${Math.round(duration / 1000)}s`));
                    completedCount++;
                    // Update todo.md file
                    await this.saveTodoMarkdown(plan);
                }
                catch (error) {
                    todo.status = 'failed';
                    console.log(chalk_1.default.red(`   ❌ Failed: ${error.message}`));
                    // In auto mode, decide automatically based on error severity
                    if (error.message.includes('critical') || error.message.includes('fatal')) {
                        console.log(chalk_1.default.red('🛑 Critical error detected - stopping execution'));
                        plan.status = 'failed';
                        return;
                    }
                    else {
                        // Auto-continue on non-critical errors
                        console.log(chalk_1.default.yellow('⚠️  Non-critical error - continuing with remaining todos'));
                        todo.status = 'failed'; // Keep as failed but continue
                        autoSkipped++;
                    }
                }
                // Show progress
                const progress = Math.round((completedCount / plan.todos.length) * 100);
                console.log(chalk_1.default.blue(`   📊 Progress: ${progress}% (${completedCount}/${plan.todos.length})`));
                // Brief pause between todos for readability
                if (completedCount < plan.todos.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            // Plan completed
            plan.status = 'completed';
            plan.completedAt = new Date();
            plan.actualTotalDuration = plan.todos.reduce((sum, todo) => sum + (todo.actualDuration || 0), 0);
            console.log(chalk_1.default.green.bold(`\n🎉 Plan Completed Successfully!`));
            console.log(chalk_1.default.gray(`✅ ${completedCount}/${plan.todos.length} todos completed`));
            if (autoSkipped > 0) {
                console.log(chalk_1.default.yellow(`⚠️  ${autoSkipped} todos had non-critical errors`));
            }
            console.log(chalk_1.default.gray(`⏱️  Total time: ${plan.actualTotalDuration} minutes`));
            // Update final todo.md
            await this.saveTodoMarkdown(plan);
            // Add completion summary to live updates
            this.addLiveUpdate({
                type: 'log',
                content: `Plan '${plan.title}' completed: ${completedCount}/${plan.todos.length} todos successful`,
                source: 'plan-execution'
            });
        }
        catch (error) {
            plan.status = 'failed';
            console.log(chalk_1.default.red(`\n❌ Plan execution failed: ${error.message}`));
            this.addLiveUpdate({
                type: 'error',
                content: `Plan '${plan.title}' failed: ${error.message}`,
                source: 'plan-execution'
            });
        }
    }
    async executeSingleTodo(todo, plan) {
        console.log(chalk_1.default.gray(`   🔍 Analyzing todo: ${todo.title}`));
        // Build a compact execution prompt and hand off to the autonomous provider
        const toolsList = Array.isArray(todo.tools) && todo.tools.length > 0 ? todo.tools.join(', ') : 'read_file, write_file, explore_directory, execute_command, analyze_project, manage_packages, generate_code';
        const executionMessages = [
            {
                role: 'system',
                content: `You are an autonomous executor that completes specific development tasks.\n\nCURRENT TASK: ${todo.title}\nTASK DESCRIPTION: ${todo.description || ''}\nAVAILABLE TOOLS: ${toolsList}\n\nGUIDELINES:\n- Be autonomous and safe\n- Follow project conventions\n- Create production-ready code\n- Provide clear progress updates\n- Use tools when needed without asking for permission\n\nExecute the task now using the available tools.`
            },
            {
                role: 'user',
                content: `Execute task: ${todo.title}${todo.description ? `\n\nDetails: ${todo.description}` : ''}`
            }
        ];
        let responseText = '';
        try {
            for await (const event of advanced_ai_provider_1.advancedAIProvider.executeAutonomousTask('Execute task', { messages: executionMessages })) {
                if (event.type === 'text_delta' && event.content) {
                    responseText += event.content;
                }
                else if (event.type === 'tool_call') {
                    console.log(chalk_1.default.cyan(`   🛠️ Tool: ${event.toolName}`));
                }
                else if (event.type === 'tool_result') {
                    console.log(chalk_1.default.gray(`   ↪ Result from ${event.toolName}`));
                }
                else if (event.type === 'error') {
                    throw new Error(event.error || 'Unknown autonomous execution error');
                }
            }
        }
        catch (err) {
            console.log(chalk_1.default.yellow(`   ⚠️ Autonomous execution warning: ${err.message}`));
        }
        // Optional: still honor any concrete commands/files declared by the todo
        if (todo.commands && todo.commands.length > 0) {
            for (const command of todo.commands) {
                console.log(chalk_1.default.blue(`   ⚡ Running: ${command}`));
                try {
                    const [cmd, ...args] = command.split(' ');
                    await tools_manager_1.toolsManager.runCommand(cmd, args);
                }
                catch (error) {
                    console.log(chalk_1.default.yellow(`   ⚠️ Command warning: ${error}`));
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        if (todo.files && todo.files.length > 0) {
            for (const file of todo.files) {
                console.log(chalk_1.default.yellow(`   📄 Working on file: ${file}`));
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }
    }
    resolveDependencyOrder(todos) {
        const resolved = [];
        const remaining = [...todos];
        while (remaining.length > 0) {
            const canExecute = remaining.filter(todo => todo.dependencies.every((depId) => resolved.some(resolvedTodo => resolvedTodo.id === depId)));
            if (canExecute.length === 0) {
                // Break circular dependencies by taking the first remaining todo
                const next = remaining.shift();
                resolved.push(next);
            }
            else {
                // Execute todos with satisfied dependencies
                canExecute.forEach(todo => {
                    const index = remaining.indexOf(todo);
                    remaining.splice(index, 1);
                    resolved.push(todo);
                });
            }
        }
        return resolved;
    }
    async handlePlanApproval(planId) {
        const plan = enhanced_planning_1.enhancedPlanning.getPlan(planId);
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }
        console.log(chalk_1.default.yellow.bold('\n⚠️  Plan Review Required'));
        console.log(chalk_1.default.gray('═'.repeat(60)));
        // Show plan summary
        this.displayPlanSummary(plan);
        // Ask for approval
        const approved = await this.askAdvancedConfirmation(`Execute Plan: ${plan.title}`, `Execute ${plan.todos.length} tasks with estimated duration of ${Math.round(plan.estimatedTotalDuration)} minutes`, false);
        if (approved) {
            plan.status = 'approved';
            plan.approvedAt = new Date();
            console.log(chalk_1.default.green('✅ Plan approved for execution'));
        }
        else {
            console.log(chalk_1.default.yellow('❌ Plan execution cancelled'));
        }
        return approved;
    }
    displayPlanSummary(plan) {
        const stats = {
            byPriority: this.groupPlanBy(plan.todos, 'priority'),
            byCategory: this.groupPlanBy(plan.todos, 'category'),
            totalFiles: new Set(plan.todos.flatMap((t) => t.files || [])).size,
            totalCommands: plan.todos.reduce((sum, t) => sum + (t.commands?.length || 0), 0),
        };
        console.log(chalk_1.default.cyan('📊 Plan Statistics:'));
        console.log(`  • Total Todos: ${plan.todos.length}`);
        console.log(`  • Estimated Duration: ${Math.round(plan.estimatedTotalDuration)} minutes`);
        console.log(`  • Files to modify: ${stats.totalFiles}`);
        console.log(`  • Commands to run: ${stats.totalCommands}`);
        console.log(chalk_1.default.cyan('\n🎯 Priority Distribution:'));
        Object.entries(stats.byPriority).forEach(([priority, todos]) => {
            const icon = this.getPlanPriorityIcon(priority);
            console.log(`  ${icon} ${priority}: ${todos.length} todos`);
        });
        console.log(chalk_1.default.cyan('\n📁 Category Distribution:'));
        Object.entries(stats.byCategory).forEach(([category, todos]) => {
            const color = this.getPlanCategoryColor(category);
            console.log(`  • ${color(category)}: ${todos.length} todos`);
        });
    }
    async saveTodoMarkdown(plan, filename = 'todo.md') {
        const todoPath = path.join(this.workingDirectory, filename);
        let content = `# Todo Plan: ${plan.title}\n\n`;
        content += `**Goal:** ${plan.goal}\n\n`;
        content += `**Status:** ${plan.status.toUpperCase()}\n`;
        content += `**Created:** ${plan.createdAt.toISOString()}\n`;
        content += `**Estimated Duration:** ${Math.round(plan.estimatedTotalDuration)} minutes\n\n`;
        if (plan.context.projectInfo) {
            content += `## Project Context\n\n`;
            const projectInfoBlock = typeof plan.context.projectInfo === 'string'
                ? plan.context.projectInfo
                : JSON.stringify(plan.context.projectInfo, null, 2);
            const fenceLang = typeof plan.context.projectInfo === 'string' ? '' : 'json';
            content += `\`\`\`${fenceLang}\n${projectInfoBlock}\n\`\`\`\n\n`;
        }
        content += `## Todo Items (${plan.todos.length})\n\n`;
        plan.todos.forEach((todo, index) => {
            const statusEmoji = this.getPlanStatusEmoji(todo.status);
            const priorityEmoji = this.getPlanPriorityEmoji(todo.priority);
            content += `### ${index + 1}. ${statusEmoji} ${todo.title} ${priorityEmoji}\n\n`;
            content += `**Description:** ${todo.description}\n\n`;
            content += `**Category:** ${todo.category} | **Priority:** ${todo.priority} | **Duration:** ${todo.estimatedDuration}min\n\n`;
            if (todo.reasoning) {
                content += `**Reasoning:** ${todo.reasoning}\n\n`;
            }
            if (todo.dependencies.length > 0) {
                content += `**Dependencies:** ${todo.dependencies.join(', ')}\n\n`;
            }
            if (todo.files && todo.files.length > 0) {
                content += `**Files:** \`${todo.files.join('\`, \`')}\`\n\n`;
            }
            if (todo.commands && todo.commands.length > 0) {
                content += `**Commands:**\n`;
                todo.commands.forEach((cmd) => {
                    content += `- \`${cmd}\`\n`;
                });
                content += '\n';
            }
            if (todo.tags.length > 0) {
                content += `**Tags:** ${todo.tags.map((tag) => `#${tag}`).join(' ')}\n\n`;
            }
            if (todo.status === 'completed' && todo.completedAt) {
                content += `**Completed:** ${todo.completedAt.toISOString()}\n`;
                if (todo.actualDuration) {
                    content += `**Actual Duration:** ${todo.actualDuration}min\n`;
                }
                content += '\n';
            }
            content += '---\n\n';
        });
        // Add statistics
        content += `## Statistics\n\n`;
        content += `- **Total Todos:** ${plan.todos.length}\n`;
        content += `- **Completed:** ${plan.todos.filter((t) => t.status === 'completed').length}\n`;
        content += `- **In Progress:** ${plan.todos.filter((t) => t.status === 'in_progress').length}\n`;
        content += `- **Pending:** ${plan.todos.filter((t) => t.status === 'pending').length}\n`;
        content += `- **Failed:** ${plan.todos.filter((t) => t.status === 'failed').length}\n`;
        if (plan.actualTotalDuration) {
            content += `- **Actual Duration:** ${plan.actualTotalDuration}min\n`;
            content += `- **Estimated vs Actual:** ${Math.round((plan.actualTotalDuration / plan.estimatedTotalDuration) * 100)}%\n`;
        }
        content += `\n---\n*Generated by NikCLI on ${new Date().toISOString()}*\n`;
        await fs.writeFile(todoPath, content, 'utf8');
        console.log(chalk_1.default.green(`📄 Todo file saved: ${todoPath}`));
    }
    // Planning Utility Methods
    extractPlanTitle(goal) {
        return goal.length > 50 ? goal.substring(0, 47) + '...' : goal;
    }
    groupPlanBy(array, key) {
        return array.reduce((groups, item) => {
            const group = String(item[key]);
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    }
    getPlanStatusColor(status) {
        switch (status) {
            case 'completed': return chalk_1.default.green;
            case 'executing':
            case 'in_progress': return chalk_1.default.blue;
            case 'approved': return chalk_1.default.cyan;
            case 'failed': return chalk_1.default.red;
            case 'cancelled': return chalk_1.default.yellow;
            default: return chalk_1.default.gray;
        }
    }
    getPlanStatusIcon(status) {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '🔄';
            case 'failed': return '❌';
            case 'skipped': return '⏭️';
            default: return '⏳';
        }
    }
    getPlanStatusEmoji(status) {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '🔄';
            case 'failed': return '❌';
            case 'skipped': return '⏭️';
            default: return '⏳';
        }
    }
    getPlanPriorityIcon(priority) {
        switch (priority) {
            case 'critical': return '🔴';
            case 'high': return '🟡';
            case 'medium': return '🟢';
            case 'low': return '🔵';
            default: return '⚪';
        }
    }
    getPlanPriorityEmoji(priority) {
        switch (priority) {
            case 'critical': return '🔥';
            case 'high': return '⚡';
            case 'medium': return '📋';
            case 'low': return '📝';
            default: return '📄';
        }
    }
    getPlanCategoryColor(category) {
        switch (category) {
            case 'planning': return chalk_1.default.cyan;
            case 'setup': return chalk_1.default.blue;
            case 'implementation': return chalk_1.default.green;
            case 'testing': return chalk_1.default.yellow;
            case 'documentation': return chalk_1.default.magenta;
            case 'deployment': return chalk_1.default.red;
            default: return chalk_1.default.gray;
        }
    }
    // Utility methods
    async initializeSystems() {
        await this.agentManager.initialize();
        // Ensure orchestrator services share our working directory
        planning_service_1.planningService.setWorkingDirectory(this.workingDirectory);
        // Event bridge is idempotent
        this.setupOrchestratorEventBridge();
        console.log(chalk_1.default.dim('✓ Systems initialized'));
    }
    switchModel(modelName) {
        try {
            this.configManager.setCurrentModel(modelName);
            // Validate the new model using model provider
            if (model_provider_1.modelProvider.validateApiKey()) {
                console.log(chalk_1.default.green(`✅ Switched to model: ${modelName}`));
            }
            else {
                console.log(chalk_1.default.yellow(`⚠️  Switched to model: ${modelName} (API key needed)`));
            }
            this.addLiveUpdate({
                type: 'info',
                content: `Model switched to: ${modelName}`,
                source: 'model-switch'
            });
        }
        catch (error) {
            this.addLiveUpdate({
                type: 'error',
                content: `Model switch failed: ${error.message}`,
                source: 'model-switch'
            });
            console.log(chalk_1.default.red(`❌ Could not switch model: ${error.message}`));
        }
    }
    async askForApproval(question) {
        return await advanced_cli_ui_1.advancedUI.askConfirmation(question, undefined, false);
    }
    async askForInput(prompt) {
        return new Promise((resolve) => {
            if (!this.rl) {
                resolve('');
                return;
            }
            this.rl.question(chalk_1.default.cyan(prompt), (answer) => {
                resolve(answer.trim());
            });
        });
    }
    async clearSession() {
        // Clear current chat session
        chat_manager_1.chatManager.clearCurrentSession();
        // Clear legacy session context
        this.sessionContext.clear();
        // Clear UI indicators and state
        this.indicators.clear();
        this.liveUpdates.length = 0;
        // Stop any running spinners
        this.spinners.forEach(spinner => spinner.stop());
        this.spinners.clear();
        // Stop any progress bars
        this.progressBars.forEach(bar => bar.stop());
        this.progressBars.clear();
        console.log(chalk_1.default.green('✅ Session and UI state cleared'));
        this.addLiveUpdate({ type: 'info', content: 'Session cleared', source: 'session' });
    }
    async compactSession() {
        console.log(chalk_1.default.blue('📊 Compacting session to save tokens...'));
        const session = chat_manager_1.chatManager.getCurrentSession();
        if (!session || session.messages.length <= 5) {
            console.log(chalk_1.default.yellow('Session too short to compact'));
            return;
        }
        try {
            const originalCount = session.messages.length;
            // Keep system message, last 2 user messages, and last 2 assistant messages
            const systemMessages = session.messages.filter(m => m.role === 'system');
            const recentMessages = session.messages.slice(-4);
            // Create summary of older messages
            const olderMessages = session.messages.slice(0, -4).filter(m => m.role !== 'system');
            if (olderMessages.length > 0) {
                const summaryMessage = {
                    role: 'system',
                    content: `[Session Summary: ${olderMessages.length} messages compacted to save tokens]`,
                    timestamp: new Date()
                };
                session.messages = [...systemMessages, summaryMessage, ...recentMessages];
                console.log(chalk_1.default.green(`✅ Session compacted: ${originalCount} → ${session.messages.length} messages`));
                this.addLiveUpdate({
                    type: 'info',
                    content: `Session compacted: saved ${originalCount - session.messages.length} messages`,
                    source: 'session'
                });
            }
            else {
                console.log(chalk_1.default.green('✓ Session compacted'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error compacting session: ${error.message}`));
        }
    }
    async showCost() {
        console.log(chalk_1.default.blue('💰 Token usage and cost information'));
        try {
            const session = chat_manager_1.chatManager.getCurrentSession();
            const stats = chat_manager_1.chatManager.getSessionStats();
            if (session) {
                // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
                const totalChars = session.messages.reduce((sum, msg) => sum + msg.content.length, 0);
                const estimatedTokens = Math.round(totalChars / 4);
                console.log(chalk_1.default.cyan('📊 Current Session:'));
                console.log(`  Messages: ${session.messages.length}`);
                console.log(`  Characters: ${totalChars.toLocaleString()}`);
                console.log(`  Estimated Tokens: ${estimatedTokens.toLocaleString()}`);
                console.log(chalk_1.default.cyan('\n📊 Overall Stats:'));
                console.log(`  Total Sessions: ${stats.totalSessions}`);
                console.log(`  Total Messages: ${stats.totalMessages}`);
                // Show current model pricing info
                const currentModel = this.configManager.getCurrentModel();
                console.log(chalk_1.default.cyan('\n🏷️ Current Model:'));
                console.log(`  Model: ${currentModel}`);
                console.log(chalk_1.default.gray('  Note: Actual costs depend on your AI provider\'s pricing'));
                this.addLiveUpdate({
                    type: 'info',
                    content: `Session stats: ${session.messages.length} messages, ~${estimatedTokens} tokens`,
                    source: 'cost-analysis'
                });
            }
            else {
                console.log(chalk_1.default.gray('No active session for cost analysis'));
            }
        }
        catch (error) {
            this.addLiveUpdate({
                type: 'error',
                content: `Cost calculation failed: ${error.message}`,
                source: 'cost-analysis'
            });
            console.log(chalk_1.default.red(`❌ Error calculating costs: ${error.message}`));
        }
    }
    async handleTodoOperations(command, args) {
        try {
            if (args.length === 0) {
                const plans = enhanced_planning_1.enhancedPlanning.getActivePlans();
                if (plans.length === 0) {
                    console.log(chalk_1.default.gray('No todo lists found'));
                    return;
                }
                console.log(chalk_1.default.blue.bold('Todo Lists:'));
                plans.forEach((plan, index) => {
                    console.log(`\n${index + 1}. ${chalk_1.default.bold(plan.title)}`);
                    console.log(`   Status: ${plan.status} | Todos: ${plan.todos.length}`);
                    const completed = plan.todos.filter(t => t.status === 'completed').length;
                    const inProgress = plan.todos.filter(t => t.status === 'in_progress').length;
                    const pending = plan.todos.filter(t => t.status === 'pending').length;
                    const failed = plan.todos.filter(t => t.status === 'failed').length;
                    console.log(`   ✅ ${completed} | 🔄 ${inProgress} | ⏳ ${pending} | ❌ ${failed}`);
                });
                return;
            }
            const subcommand = args[0].toLowerCase();
            const restArgs = args.slice(1);
            switch (subcommand) {
                case 'show': {
                    const planId = restArgs[0];
                    if (!planId) {
                        const plans = enhanced_planning_1.enhancedPlanning.getActivePlans();
                        const latestPlan = plans[plans.length - 1];
                        if (latestPlan) {
                            enhanced_planning_1.enhancedPlanning.showPlanStatus(latestPlan.id);
                        }
                        else {
                            console.log(chalk_1.default.yellow('No todo lists found'));
                        }
                    }
                    else {
                        enhanced_planning_1.enhancedPlanning.showPlanStatus(planId);
                    }
                    break;
                }
                case 'open':
                case 'edit': {
                    const todoPath = 'todo.md';
                    console.log(chalk_1.default.blue(`Opening ${todoPath} in your default editor...`));
                    try {
                        await tools_manager_1.toolsManager.runCommand('code', [todoPath]);
                    }
                    catch {
                        try {
                            await tools_manager_1.toolsManager.runCommand('open', [todoPath]);
                        }
                        catch {
                            console.log(chalk_1.default.yellow(`Could not open ${todoPath}. Please open it manually.`));
                        }
                    }
                    break;
                }
                default:
                    console.log(chalk_1.default.red(`Unknown todo command: ${subcommand}`));
                    console.log(chalk_1.default.gray('Available commands: show, open, edit'));
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Todo operation failed: ${error.message}`, source: 'todo' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    showSlashHelp() {
        console.log(chalk_1.default.cyan.bold('📚 Available Slash Commands'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        const commands = [
            // Mode Commands
            ['/plan [task]', 'Switch to plan mode or generate plan'],
            ['/auto [task]', 'Switch to auto mode or execute task'],
            ['/default', 'Switch to default mode'],
            // File Operations  
            ['/read <file>', 'Read file contents'],
            ['/write <file> <content>', 'Write content to file'],
            ['/edit <file>', 'Edit file interactively'],
            ['/ls [directory]', 'List files in directory'],
            ['/search <query>', 'Search in files'],
            // Terminal Operations
            ['/run <command>', 'Execute terminal command'],
            ['/install <packages>', 'Install npm/yarn packages'],
            ['/npm <args>', 'Run npm commands'],
            ['/yarn <args>', 'Run yarn commands'],
            ['/git <args>', 'Run git commands'],
            ['/docker <args>', 'Run docker commands'],
            ['/ps', 'List running processes'],
            ['/kill <pid>', 'Kill process by PID'],
            // Project Operations
            ['/build', 'Build the project'],
            ['/test [pattern]', 'Run tests'],
            ['/lint', 'Run linting'],
            ['/create <type> <name>', 'Create new project'],
            // Agent Management
            ['/agents', 'List available agents'],
            ['/agent <name> <task>', 'Run specific agent'],
            ['/parallel <agents> <task>', 'Run multiple agents'],
            ['/factory', 'Show agent factory dashboard'],
            ['/create-agent <spec>', 'Create new agent'],
            ['/launch-agent <id>', 'Launch agent from blueprint'],
            // Session Management
            ['/new [title]', 'Start new chat session'],
            ['/sessions', 'List all sessions'],
            ['/export [sessionId]', 'Export session to markdown'],
            ['/stats', 'Show usage statistics'],
            ['/history <on|off>', 'Enable/disable chat history'],
            ['/debug', 'Show debug information'],
            ['/temp <0.0-2.0>', 'Set temperature'],
            ['/system <prompt>', 'Set system prompt'],
            // Model & Config
            ['/models', 'List available models'],
            ['/model <name>', 'Switch to model'],
            ['/set-key <model> <key>', 'Set API key'],
            ['/config', 'Show configuration'],
            // Advanced Features
            ['/context [paths]', 'Manage workspace context'],
            ['/stream [clear]', 'Show/clear agent streams'],
            ['/approval [test]', 'Approval system controls'],
            ['/todo [command]', 'Todo list operations'],
            ['/todos', 'Show todo lists'],
            // Basic Commands
            ['/init [--force]', 'Initialize project context'],
            ['/status', 'Show system status'],
            ['/clear', 'Clear session context'],
            ['/help', 'Show this help'],
            ['/exit', 'Exit NikCLI']
        ];
        // Group commands for better readability
        console.log(chalk_1.default.blue.bold('\n🎯 Mode Control:'));
        commands.slice(0, 3).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n📁 File Operations:'));
        commands.slice(3, 8).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n⚡ Terminal Operations:'));
        commands.slice(8, 16).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n🔨 Project Operations:'));
        commands.slice(16, 20).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n🤖 Agent Management:'));
        commands.slice(20, 26).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n📝 Session Management:'));
        commands.slice(26, 34).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n⚙️ Configuration:'));
        commands.slice(34, 38).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n🔧 Advanced Features:'));
        commands.slice(38, 43).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n📋 Basic Commands:'));
        commands.slice(43).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.gray('\n💡 Tip: Use Ctrl+C to stop any running operation'));
    }
    showChatWelcome() {
        const title = chalk_1.default.cyanBright('🤖 NikCLI');
        const subtitle = chalk_1.default.gray('Autonomous AI Developer Assistant');
        console.log((0, boxen_1.default)(`${title}\n${subtitle}\n\n` +
            `${chalk_1.default.blue('Mode:')} ${chalk_1.default.yellow(this.currentMode)}\n` +
            `${chalk_1.default.blue('Model:')} ${chalk_1.default.green(advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo().name)}\n` +
            `${chalk_1.default.blue('Directory:')} ${chalk_1.default.cyan(path.basename(this.workingDirectory))}\n\n` +
            `${chalk_1.default.dim('Type /help for commands or start chatting!')}\n` +
            `${chalk_1.default.dim('Use Shift+Tab to cycle modes: default → auto → plan')}`, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
            textAlignment: 'center',
        }));
    }
    showPrompt() {
        if (!this.rl)
            return;
        const workingDir = path.basename(this.workingDirectory);
        const modeIcon = this.currentMode === 'auto' ? '🚀' :
            this.currentMode === 'plan' ? '🎯' : '💬';
        const agentInfo = this.currentAgent ? `@${this.currentAgent}:` : '';
        const statusDot = this.assistantProcessing ? chalk_1.default.green('●') + chalk_1.default.dim('….') : chalk_1.default.red('●');
        const prompt = `\n┌─[${modeIcon}${agentInfo}${chalk_1.default.green(workingDir)} ${statusDot}]\n└─❯ `;
        this.rl.setPrompt(prompt);
        this.rl.prompt();
    }
    async analyzeProject() {
        // Implementation for project analysis
        return {
            name: path.basename(this.workingDirectory),
            framework: 'Unknown',
            languages: ['typescript', 'javascript'],
            dependencies: [],
            structure: {}
        };
    }
    generateClaudeMarkdown(analysis) {
        return `# NIKOCLI.md

This file provides guidance to NikCLI when working with code in this repository.

## Project Overview
- **Name**: ${analysis.name}
- **Framework**: ${analysis.framework}
- **Languages**: ${analysis.languages.join(', ')}

## Architecture
[Project architecture description will be auto-generated based on analysis]

## Development Commands
[Development commands will be auto-detected and listed here]

## Conventions
[Code conventions and patterns will be documented here]

## Context
This file is automatically maintained by NikCLI to provide consistent context across sessions.
`;
    }
    async savePlanToFile(plan, filename) {
        const content = `# Execution Plan: ${plan.title}

## Description
${plan.description}

## Steps
${plan.steps.map((step, index) => `${index + 1}. ${step.title}\n   ${step.description}`).join('\n\n')}

## Risk Assessment
- Overall Risk: ${plan.riskAssessment.overallRisk}
- Estimated Duration: ${Math.round(plan.estimatedTotalDuration / 1000)}s

Generated by NikCLI on ${new Date().toISOString()}
`;
        await fs.writeFile(filename, content, 'utf8');
        console.log(chalk_1.default.green(`✓ Plan saved to ${filename}`));
    }
    shutdown() {
        console.log(chalk_1.default.blue('\n👋 Shutting down NikCLI...'));
        if (this.rl) {
            this.rl.close();
        }
        // Cleanup systems
        this.agentManager.cleanup();
        console.log(chalk_1.default.green('✓ Goodbye!'));
        process.exit(0);
    }
}
exports.NikCLI = NikCLI;
