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
exports.orchestratorService = exports.OrchestratorService = void 0;
const chalk_1 = __importDefault(require("chalk"));
const readline = __importStar(require("readline"));
const boxen_1 = __importDefault(require("boxen"));
const gradient_string_1 = __importDefault(require("gradient-string"));
const events_1 = require("events");
const agent_service_1 = require("./agent-service");
const tool_service_1 = require("./tool-service");
const planning_service_1 = require("./planning-service");
const lsp_service_1 = require("./lsp-service");
const diff_manager_1 = require("../ui/diff-manager");
const execution_policy_1 = require("../policies/execution-policy");
const config_manager_1 = require("../core/config-manager");
const module_manager_1 = require("../core/module-manager");
class OrchestratorService extends events_1.EventEmitter {
    constructor() {
        super();
        this.initialized = false;
        this.activeAgentTasks = new Map();
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
            autoAcceptEdits: false,
            isProcessing: false,
            session: {
                id: Date.now().toString(),
                messages: [],
                executionHistory: []
            }
        };
        // Initialize services
        this.policyManager = new execution_policy_1.ExecutionPolicyManager(config_manager_1.simpleConfigManager);
        const moduleContext = {
            ...this.context,
            policyManager: this.policyManager
        };
        this.moduleManager = new module_manager_1.ModuleManager(moduleContext);
        this.setupEventHandlers();
        this.setupServiceListeners();
    }
    setupEventHandlers() {
        // Handle Ctrl+C gracefully
        this.rl.on('SIGINT', () => {
            if (this.context.isProcessing) {
                console.log(chalk_1.default.yellow('\\n⏸️  Stopping current operation...'));
                this.stopAllOperations();
                this.showPrompt();
            }
            else {
                this.showGoodbye();
                process.exit(0);
            }
        });
        // Enable raw mode for keypress detection
        process.stdin.setRawMode(true);
        require('readline').emitKeypressEvents(process.stdin);
        // Handle keypress events
        process.stdin.on('keypress', (str, key) => {
            if (key && key.name === 'slash' && !this.context.isProcessing) {
                setTimeout(() => this.showCommandMenu(), 50);
            }
            if (key && key.name === 'tab' && key.shift && !this.context.isProcessing) {
                this.togglePlanMode();
            }
            if (key && key.name === 'a' && key.ctrl && !this.context.isProcessing) {
                this.toggleAutoAccept();
            }
        });
        // Handle input
        this.rl.on('line', async (input) => {
            const trimmedInput = input.trim();
            if (!trimmedInput) {
                this.showPrompt();
                return;
            }
            await this.handleInput(trimmedInput);
            this.showPrompt();
        });
        this.rl.on('close', () => {
            this.showGoodbye();
            process.exit(0);
        });
    }
    setupServiceListeners() {
        // Listen to agent service events
        agent_service_1.agentService.on('task_start', (task) => {
            this.activeAgentTasks.set(task.id, task);
            console.log(chalk_1.default.blue(`🤖 Agent ${task.agentType} started: ${task.task.slice(0, 50)}...`));
        });
        agent_service_1.agentService.on('task_progress', (task, update) => {
            console.log(chalk_1.default.cyan(`  📊 ${task.agentType}: ${update.progress}% - ${update.description || ''}`));
        });
        agent_service_1.agentService.on('tool_use', (task, update) => {
            console.log(chalk_1.default.magenta(`  🔧 ${task.agentType} using ${update.tool}: ${update.description}`));
        });
        agent_service_1.agentService.on('task_complete', (task) => {
            this.activeAgentTasks.delete(task.id);
            if (task.status === 'completed') {
                console.log(chalk_1.default.green(`✅ Agent ${task.agentType} completed successfully`));
                if (task.result) {
                    this.displayAgentResult(task);
                }
            }
            else {
                console.log(chalk_1.default.red(`❌ Agent ${task.agentType} failed: ${task.error}`));
            }
        });
    }
    async start() {
        console.clear();
        if (!this.checkAPIKeys()) {
            return;
        }
        this.showWelcome();
        // Start service initialization in background
        this.initializeServices();
        return new Promise((resolve) => {
            this.showPrompt();
            this.rl.on('close', () => {
                resolve();
            });
        });
    }
    async initializeServices() {
        // Initialize all services in background
        tool_service_1.toolService.setWorkingDirectory(this.context.workingDirectory);
        planning_service_1.planningService.setWorkingDirectory(this.context.workingDirectory);
        lsp_service_1.lspService.setWorkingDirectory(this.context.workingDirectory);
        // Auto-start LSP servers for detected languages
        await lsp_service_1.lspService.autoStartServers(this.context.workingDirectory);
        this.initialized = true;
        console.log(chalk_1.default.dim('🚀 All services initialized'));
    }
    async handleInput(input) {
        this.context.isProcessing = true;
        try {
            // Handle slash commands
            if (input.startsWith('/')) {
                await this.handleCommand(input);
                return;
            }
            // Handle agent-specific requests
            const agentMatch = input.match(/^@(\\w+[-\\w]*)/);
            if (agentMatch) {
                const agentName = agentMatch[1];
                const task = input.replace(agentMatch[0], '').trim();
                await this.executeAgentTask(agentName, task);
                return;
            }
            // Handle natural language requests
            await this.handleNaturalLanguageRequest(input);
        }
        finally {
            this.context.isProcessing = false;
        }
    }
    async handleCommand(command) {
        const [cmd, ...args] = command.slice(1).split(' ');
        // Handle special orchestrator commands
        switch (cmd) {
            case 'status':
                await this.showStatus();
                break;
            case 'services':
                await this.showServices();
                break;
            case 'agents':
                await this.showActiveAgents();
                break;
            default:
                // Delegate to module manager
                await this.moduleManager.executeCommand(cmd, args);
                // Update context after module execution
                this.updateModuleContext();
        }
    }
    async executeAgentTask(agentName, task) {
        if (!task) {
            console.log(chalk_1.default.red('Please specify a task for the agent'));
            return;
        }
        console.log(chalk_1.default.blue(`\\n🤖 Launching ${agentName} agent...`));
        console.log(chalk_1.default.gray(`Task: ${task}\\n`));
        try {
            const taskId = await agent_service_1.agentService.executeTask(agentName, task);
            console.log(chalk_1.default.dim(`Task ID: ${taskId}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to launch agent: ${error.message}`));
        }
    }
    async handleNaturalLanguageRequest(input) {
        if (!this.initialized) {
            await this.initializeServices();
        }
        console.log(chalk_1.default.blue('🧠 Processing natural language request...'));
        if (this.context.planMode) {
            // Create execution plan first
            console.log(chalk_1.default.cyan('🎯 Plan Mode: Creating execution plan...'));
            const plan = await planning_service_1.planningService.createPlan(input, {
                showProgress: true,
                autoExecute: false,
                confirmSteps: !this.context.autonomous
            });
            if (!this.context.autonomous) {
                const proceed = await this.promptYesNo('Execute this plan? (y/N)');
                if (!proceed) {
                    console.log(chalk_1.default.yellow('Plan execution cancelled'));
                    return;
                }
            }
            await planning_service_1.planningService.executePlan(plan.id, {
                showProgress: true,
                autoExecute: this.context.autonomous,
                confirmSteps: !this.context.autonomous
            });
        }
        else {
            // Direct autonomous execution using appropriate agent
            const bestAgent = this.selectBestAgent(input);
            console.log(chalk_1.default.blue(`🎯 Selected ${bestAgent} agent for this task`));
            await this.executeAgentTask(bestAgent, input);
        }
    }
    selectBestAgent(input) {
        const lowerInput = input.toLowerCase();
        // Simple keyword-based agent selection
        if (lowerInput.includes('react') || lowerInput.includes('component')) {
            return 'react-expert';
        }
        else if (lowerInput.includes('backend') || lowerInput.includes('api') || lowerInput.includes('server')) {
            return 'backend-expert';
        }
        else if (lowerInput.includes('frontend') || lowerInput.includes('ui') || lowerInput.includes('interface')) {
            return 'frontend-expert';
        }
        else if (lowerInput.includes('deploy') || lowerInput.includes('docker') || lowerInput.includes('ci/cd')) {
            return 'devops-expert';
        }
        else if (lowerInput.includes('review') || lowerInput.includes('analyze') || lowerInput.includes('check')) {
            return 'code-review';
        }
        else {
            return 'autonomous-coder'; // Default fallback
        }
    }
    displayAgentResult(task) {
        console.log((0, boxen_1.default)(`${chalk_1.default.green.bold('🎉 Agent Result')}\\n\\n` +
            `${chalk_1.default.blue('Agent:')} ${task.agentType}\\n` +
            `${chalk_1.default.blue('Task:')} ${task.task.slice(0, 60)}...\\n` +
            `${chalk_1.default.blue('Duration:')} ${task.endTime && task.startTime ?
                Math.round((task.endTime.getTime() - task.startTime.getTime()) / 1000) : 0}s\\n\\n` +
            `${chalk_1.default.cyan('Result:')} ${JSON.stringify(task.result, null, 2).slice(0, 200)}...`, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green'
        }));
    }
    async showStatus() {
        const activeAgents = agent_service_1.agentService.getActiveAgents();
        const queuedTasks = agent_service_1.agentService.getQueuedTasks();
        const pendingDiffs = diff_manager_1.diffManager.getPendingCount();
        console.log((0, boxen_1.default)(`${chalk_1.default.blue.bold('🎛️  Orchestrator Status')}\\n\\n` +
            `${chalk_1.default.green('Working Directory:')} ${this.context.workingDirectory}\\n` +
            `${chalk_1.default.green('Mode:')} ${this.context.autonomous ? 'Autonomous' : 'Manual'}\\n` +
            `${chalk_1.default.green('Plan Mode:')} ${this.context.planMode ? 'On' : 'Off'}\\n` +
            `${chalk_1.default.green('Auto-Accept:')} ${this.context.autoAcceptEdits ? 'On' : 'Off'}\\n\\n` +
            `${chalk_1.default.cyan('Active Agents:')} ${activeAgents.length}/3\\n` +
            `${chalk_1.default.cyan('Queued Tasks:')} ${queuedTasks.length}\\n` +
            `${chalk_1.default.cyan('Pending Diffs:')} ${pendingDiffs}\\n` +
            `${chalk_1.default.cyan('Session Messages:')} ${this.context.session.messages.length}`, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'blue'
        }));
    }
    async showServices() {
        const lspStatus = lsp_service_1.lspService.getServerStatus();
        const toolHistory = tool_service_1.toolService.getExecutionHistory().slice(-5);
        const planStats = planning_service_1.planningService.getStatistics();
        console.log(chalk_1.default.cyan.bold('\\n🔧 Services Status'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.white.bold('\\nLSP Servers:'));
        lspStatus.forEach(server => {
            const statusColor = server.status === 'running' ? chalk_1.default.green :
                server.status === 'error' ? chalk_1.default.red : chalk_1.default.yellow;
            console.log(`  ${statusColor('●')} ${server.name}: ${server.status}`);
        });
        console.log(chalk_1.default.white.bold('\\nRecent Tool Usage:'));
        toolHistory.forEach(exec => {
            const statusIcon = exec.status === 'completed' ? '✅' :
                exec.status === 'failed' ? '❌' : '🔄';
            console.log(`  ${statusIcon} ${exec.toolName}: ${exec.status}`);
        });
        console.log(chalk_1.default.white.bold('\\nPlanning Statistics:'));
        console.log(`  Total Plans: ${planStats.total}`);
        console.log(`  Active: ${planStats.running}`);
        console.log(`  Completed: ${planStats.completed}`);
    }
    async showActiveAgents() {
        const activeAgents = agent_service_1.agentService.getActiveAgents();
        const queuedTasks = agent_service_1.agentService.getQueuedTasks();
        console.log(chalk_1.default.cyan.bold('\\n🤖 Agent Status'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        if (activeAgents.length > 0) {
            console.log(chalk_1.default.white.bold('\\nActive Agents:'));
            activeAgents.forEach(agent => {
                const progress = agent.progress ? `${agent.progress}%` : 'Starting...';
                console.log(`  🔄 ${chalk_1.default.blue(agent.agentType)}: ${progress}`);
                console.log(`     ${chalk_1.default.dim(agent.task.slice(0, 60))}...`);
            });
        }
        if (queuedTasks.length > 0) {
            console.log(chalk_1.default.white.bold('\\nQueued Tasks:'));
            queuedTasks.forEach((task, index) => {
                console.log(`  ${index + 1}. ${chalk_1.default.yellow(task.agentType)}: ${task.task.slice(0, 50)}...`);
            });
        }
        if (activeAgents.length === 0 && queuedTasks.length === 0) {
            console.log(chalk_1.default.dim('No active agents or queued tasks'));
        }
    }
    showCommandMenu() {
        // Delegate to module manager
        console.log('\\n' + chalk_1.default.cyan.bold('📋 Available Commands:'));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        console.log(chalk_1.default.white.bold('\\n🎛️  Orchestrator Commands:'));
        console.log(`${chalk_1.default.green('/status')}         Show orchestrator and service status`);
        console.log(`${chalk_1.default.green('/services')}       Show detailed service information`);
        console.log(`${chalk_1.default.green('/agents')}         Show active agents and queue`);
        console.log(chalk_1.default.white.bold('\\n🔧 Module Commands:'));
        const commands = this.moduleManager.getCommands();
        const categories = ['system', 'file', 'analysis', 'diff', 'security'];
        categories.forEach(category => {
            const categoryCommands = commands.filter(c => c.category === category);
            if (categoryCommands.length > 0) {
                categoryCommands.slice(0, 3).forEach(cmd => {
                    console.log(`${chalk_1.default.green(`/${cmd.name}`).padEnd(20)} ${cmd.description}`);
                });
            }
        });
        console.log(chalk_1.default.white.bold('\\n🤖 Agent Commands:'));
        console.log(`${chalk_1.default.blue('@agent-name')} <task>  Execute task with specific agent`);
        console.log(`${chalk_1.default.dim('Available:')} ai-analysis, code-review, backend-expert, frontend-expert`);
        console.log(`${chalk_1.default.dim('         ')} react-expert, devops-expert, system-admin, autonomous-coder`);
        console.log(chalk_1.default.gray('\\n' + '─'.repeat(60)));
        console.log(chalk_1.default.yellow('💡 Natural language: Just describe what you want to accomplish'));
    }
    checkAPIKeys() {
        const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
        const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
        const hasGoogleKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!hasAnthropicKey && !hasOpenAIKey && !hasGoogleKey) {
            console.log((0, boxen_1.default)(`${chalk_1.default.red('⚠️  No API Keys Found')}\\n\\n` +
                `Please set at least one API key:\\n\\n` +
                `${chalk_1.default.blue('• ANTHROPIC_API_KEY')} - for Claude models\\n` +
                `${chalk_1.default.blue('• OPENAI_API_KEY')} - for GPT models\\n` +
                `${chalk_1.default.blue('• GOOGLE_GENERATIVE_AI_API_KEY')} - for Gemini models`, {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'red',
                textAlignment: 'center',
            }));
            return false;
        }
        const availableKeys = [];
        if (hasAnthropicKey)
            availableKeys.push(chalk_1.default.green('✓ Claude'));
        if (hasOpenAIKey)
            availableKeys.push(chalk_1.default.green('✓ GPT'));
        if (hasGoogleKey)
            availableKeys.push(chalk_1.default.green('✓ Gemini'));
        console.log(chalk_1.default.dim(`API Keys: ${availableKeys.join(', ')}`));
        return true;
    }
    showWelcome() {
        const title = gradient_string_1.default.rainbow('🎛️  AI Development Orchestrator');
        const subtitle = chalk_1.default.gray('Multi-Agent Autonomous Development System');
        console.log((0, boxen_1.default)(`${title}\\n${subtitle}\\n\\n` +
            `${chalk_1.default.blue('🎯 Mode:')} ${this.context.autonomous ? 'Autonomous' : 'Manual'}\\n` +
            `${chalk_1.default.blue('📁 Directory:')} ${chalk_1.default.cyan(this.context.workingDirectory)}\\n` +
            `${chalk_1.default.blue('🤖 Max Agents:')} 3 parallel\\n\\n` +
            `${chalk_1.default.gray('I orchestrate specialized AI agents to handle your development tasks:')}\\n` +
            `• ${chalk_1.default.green('Natural language processing')} - Just describe what you want\\n` +
            `• ${chalk_1.default.green('Intelligent agent selection')} - Best agent for each task\\n` +
            `• ${chalk_1.default.green('Parallel execution')} - Up to 3 agents working simultaneously\\n` +
            `• ${chalk_1.default.green('Real-time monitoring')} - See everything happening live\\n` +
            `• ${chalk_1.default.green('Autonomous operation')} - Minimal interruptions\\n\\n` +
            `${chalk_1.default.yellow('💡 Press / for commands, @ for agents, or just tell me what to do')}`, {
            padding: 1,
            margin: 1,
            borderStyle: 'double',
            borderColor: 'cyan',
            textAlignment: 'center',
        }));
    }
    togglePlanMode() {
        this.context.planMode = !this.context.planMode;
        if (this.context.planMode) {
            console.log(chalk_1.default.green('\\n✅ plan mode on ') + chalk_1.default.dim('(shift+tab to cycle)'));
        }
        else {
            console.log(chalk_1.default.yellow('\\n⚠️ plan mode off'));
        }
        this.updateModuleContext();
    }
    toggleAutoAccept() {
        this.context.autoAcceptEdits = !this.context.autoAcceptEdits;
        diff_manager_1.diffManager.setAutoAccept(this.context.autoAcceptEdits);
        if (this.context.autoAcceptEdits) {
            console.log(chalk_1.default.green('\\n✅ auto-accept edits on ') + chalk_1.default.dim('(ctrl+a to toggle)'));
        }
        else {
            console.log(chalk_1.default.yellow('\\n⚠️ auto-accept edits off'));
        }
        this.updateModuleContext();
    }
    updateModuleContext() {
        this.moduleManager.updateContext({
            ...this.context,
            policyManager: this.policyManager
        });
    }
    stopAllOperations() {
        // Stop any running agents (simplified)
        this.activeAgentTasks.clear();
        this.context.isProcessing = false;
    }
    async promptYesNo(question) {
        return new Promise((resolve) => {
            const tempRl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            tempRl.question(chalk_1.default.yellow(`${question} `), (answer) => {
                tempRl.close();
                resolve(answer.toLowerCase().startsWith('y'));
            });
        });
    }
    showPrompt() {
        if (!this.context.isProcessing) {
            const workingDir = require('path').basename(this.context.workingDirectory);
            const indicators = this.getPromptIndicators();
            const modeIndicator = indicators.length > 0 ? ` ${indicators.join(' ')} ` : '';
            const activeCount = this.activeAgentTasks.size;
            const agentIndicator = activeCount > 0 ? chalk_1.default.blue(`${activeCount}🤖`) : '🎛️';
            const prompt = gradient_string_1.default.rainbow(`\\n┌─[${agentIndicator}:${workingDir}${modeIndicator}]\\n└─❯ `);
            this.rl.setPrompt(prompt);
            this.rl.prompt();
        }
    }
    getPromptIndicators() {
        const indicators = [];
        if (this.context.planMode)
            indicators.push(chalk_1.default.cyan('plan'));
        if (this.context.autoAcceptEdits)
            indicators.push(chalk_1.default.green('auto-accept'));
        if (!this.context.autonomous)
            indicators.push(chalk_1.default.yellow('manual'));
        const pendingCount = diff_manager_1.diffManager.getPendingCount();
        if (pendingCount > 0) {
            indicators.push(chalk_1.default.yellow(`${pendingCount} diffs`));
        }
        return indicators;
    }
    autoComplete(line) {
        const commands = this.moduleManager.getCommandNames();
        const agents = agent_service_1.agentService.getAvailableAgents().map(a => `@${a.name}`);
        const allSuggestions = [...commands, ...agents];
        const hits = allSuggestions.filter((c) => c.startsWith(line));
        return [hits.length ? hits : allSuggestions, line];
    }
    showGoodbye() {
        const activeAgents = this.activeAgentTasks.size;
        const toolsUsed = tool_service_1.toolService.getExecutionHistory().length;
        console.log((0, boxen_1.default)(`${gradient_string_1.default.rainbow('🎛️  AI Development Orchestrator')}\\n\\n` +
            `${chalk_1.default.gray('Session completed!')}\\n\\n` +
            `${chalk_1.default.blue('Messages processed:')} ${this.context.session.messages.length}\\n` +
            `${chalk_1.default.green('Tools executed:')} ${toolsUsed}\\n` +
            `${chalk_1.default.cyan('Agents launched:')} ${this.context.session.executionHistory.length}\\n` +
            `${chalk_1.default.yellow('Duration:')} ${Math.round((Date.now() - parseInt(this.context.session.id)) / 1000)}s\\n\\n` +
            `${chalk_1.default.blue('Thanks for using the AI orchestrator! 🚀')}`, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
            textAlignment: 'center',
        }));
    }
}
exports.OrchestratorService = OrchestratorService;
exports.orchestratorService = new OrchestratorService();
