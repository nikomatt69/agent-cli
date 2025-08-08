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
exports.NikCLI = void 0;
const readline = __importStar(require("readline"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const gradient_string_1 = __importDefault(require("gradient-string"));
const marked_1 = require("marked");
// Core imports
const agent_manager_1 = require("./agent-manager");
const planning_manager_1 = require("../planning/planning-manager");
const autonomous_claude_interface_1 = require("../chat/autonomous-claude-interface");
const config_manager_1 = require("./config-manager");
// Configure marked for terminal rendering
marked_1.marked.setOptions({
    renderer: new marked_1.marked.Renderer(),
    gfm: true,
    breaks: true
});
/**
 * NikCLI - Unified CLI entrypoint with terminal chatbot interface
 * Provides Claude Code-style terminal experience with autonomous agents
 */
class NikCLI {
    constructor() {
        this.currentMode = 'default';
        this.sessionContext = new Map();
        this.workingDirectory = process.cwd();
        this.projectContextFile = path.join(this.workingDirectory, 'CLAUDE.md');
        // Initialize core managers
        this.configManager = config_manager_1.simpleConfigManager;
        this.agentManager = new agent_manager_1.AgentManager(this.configManager);
        this.planningManager = new planning_manager_1.PlanningManager(this.workingDirectory);
        this.chatInterface = new autonomous_claude_interface_1.AutonomousClaudeInterface();
        this.setupEventHandlers();
    }
    /**
     * Setup event handlers for managers
     */
    setupEventHandlers() {
        // Agent events
        this.agentManager.on('agentStarted', (data) => {
            console.log(chalk_1.default.blue(`🤖 Agent ${data.agentId} started`));
        });
        this.agentManager.on('agentCompleted', (data) => {
            console.log(chalk_1.default.green(`✅ Agent ${data.agentId} completed`));
        });
        this.agentManager.on('agentError', (data) => {
            console.log(chalk_1.default.red(`❌ Agent ${data.agentId} error: ${data.error}`));
        });
        // Planning events
        this.planningManager.on('planGenerated', (plan) => {
            console.log(chalk_1.default.cyan(`📋 Plan generated with ${plan.steps.length} steps`));
        });
        this.planningManager.on('stepCompleted', (data) => {
            console.log(chalk_1.default.green(`✅ Step ${data.stepIndex + 1} completed`));
        });
    }
    /**
     * Start the CLI interface
     */
    async start() {
        this.displayWelcome();
        await this.initializeProject();
        await this.startChatLoop();
    }
    /**
     * Display welcome message
     */
    displayWelcome() {
        const title = gradient_string_1.default.rainbow('🚀 NikCLI - AI Developer Assistant');
        const subtitle = chalk_1.default.gray('Claude Code-style terminal experience with autonomous agents');
        console.log((0, boxen_1.default)(`${title}\n\n${subtitle}`, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan'
        }));
        console.log(chalk_1.default.cyan('\n📋 Available Commands:'));
        console.log(chalk_1.default.white('  • /chat    - Enter chat mode (default)'));
        console.log(chalk_1.default.white('  • /auto    - Enter autonomous mode'));
        console.log(chalk_1.default.white('  • /plan    - Enter planning mode'));
        console.log(chalk_1.default.white('  • /init    - Initialize project context'));
        console.log(chalk_1.default.white('  • /config  - Manage configuration'));
        console.log(chalk_1.default.white('  • /status  - Show system status'));
        console.log(chalk_1.default.white('  • /help    - Show help'));
        console.log(chalk_1.default.white('  • /exit    - Exit NikCLI\n'));
    }
    /**
     * Initialize project context
     */
    async initializeProject() {
        if (!fs.existsSync(this.projectContextFile)) {
            const contextContent = `# Project Context - ${path.basename(this.workingDirectory)}

## Project Overview
This file maintains context for NikCLI sessions in this project.

## Current Session
- Started: ${new Date().toISOString()}
- Mode: ${this.currentMode}
- Working Directory: ${this.workingDirectory}

## Session History
<!-- Session history will be maintained here -->

## Notes
<!-- Add project-specific notes here -->
`;
            fs.writeFileSync(this.projectContextFile, contextContent);
            console.log(chalk_1.default.green(`📝 Created project context file: ${this.projectContextFile}`));
        }
    }
    /**
     * Start the main chat loop
     */
    async startChatLoop() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.rl.on('line', async (input) => {
            await this.handleInput(input.trim());
        });
        this.rl.on('close', () => {
            console.log(chalk_1.default.yellow('\n👋 Goodbye!'));
            process.exit(0);
        });
        // Start with initial prompt
        this.showPrompt();
    }
    /**
     * Handle user input
     */
    async handleInput(input) {
        if (!input) {
            this.showPrompt();
            return;
        }
        // Handle slash commands
        if (input.startsWith('/')) {
            await this.handleSlashCommand(input);
            return;
        }
        // Handle based on current mode
        switch (this.currentMode) {
            case 'default':
                await this.handleChatMode(input);
                break;
            case 'auto':
                await this.handleAutoMode(input);
                break;
            case 'plan':
                await this.handlePlanMode(input);
                break;
        }
        this.showPrompt();
    }
    /**
     * Handle slash commands
     */
    async handleSlashCommand(command) {
        const [cmd, ...args] = command.slice(1).split(' ');
        switch (cmd.toLowerCase()) {
            case 'chat':
                this.currentMode = 'default';
                console.log(chalk_1.default.green('💬 Switched to chat mode'));
                break;
            case 'auto':
                this.currentMode = 'auto';
                console.log(chalk_1.default.yellow('🤖 Switched to autonomous mode'));
                break;
            case 'plan':
                this.currentMode = 'plan';
                console.log(chalk_1.default.blue('📋 Switched to planning mode'));
                break;
            case 'init':
                await this.handleInitCommand(args);
                break;
            case 'config':
                await this.handleConfigCommand(args);
                break;
            case 'status':
                await this.handleStatusCommand();
                break;
            case 'agents':
                await this.handleAgentsCommand();
                break;
            case 'models':
                await this.handleModelsCommand();
                break;
            case 'clear':
                console.clear();
                this.displayWelcome();
                break;
            case 'help':
                this.displayHelp();
                break;
            case 'exit':
                this.rl?.close();
                break;
            default:
                console.log(chalk_1.default.red(`❌ Unknown command: /${cmd}`));
                console.log(chalk_1.default.gray('Type /help for available commands'));
        }
        this.showPrompt();
    }
    /**
     * Handle chat mode
     */
    async handleChatMode(input) {
        try {
            console.log(chalk_1.default.blue('🤖 Processing...'));
            // Use the autonomous interface for chat
            await this.chatInterface.processMessage(input);
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error: ${error}`));
        }
    }
    /**
     * Handle autonomous mode
     */
    async handleAutoMode(input) {
        try {
            console.log(chalk_1.default.yellow('🤖 Autonomous mode - executing task...'));
            // Generate and execute plan automatically
            const plan = await this.planningManager.generatePlan(input);
            if (plan) {
                await this.planningManager.executePlan(plan.id);
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error: ${error}`));
        }
    }
    /**
     * Handle planning mode
     */
    async handlePlanMode(input) {
        try {
            console.log(chalk_1.default.blue('📋 Generating plan...'));
            const plan = await this.planningManager.generatePlan(input);
            if (plan) {
                this.displayPlan(plan);
                // Ask for approval
                const approved = await this.askForApproval('Execute this plan?');
                if (approved) {
                    await this.planningManager.executePlan(plan.id);
                }
                else {
                    console.log(chalk_1.default.yellow('Plan execution cancelled'));
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error: ${error}`));
        }
    }
    /**
     * Handle init command
     */
    async handleInitCommand(args) {
        const projectType = args[0] || 'general';
        console.log(chalk_1.default.green(`🚀 Initializing ${projectType} project...`));
        // Initialize project context
        await this.initializeProject();
        // Set up project-specific configuration
        const config = this.configManager.getConfig();
        console.log(chalk_1.default.green('✅ Project initialized'));
    }
    /**
     * Handle config command
     */
    async handleConfigCommand(args) {
        if (args.length === 0) {
            // Show current config
            const config = this.configManager.getConfig();
            console.log(chalk_1.default.cyan('📋 Current Configuration:'));
            console.log(JSON.stringify(config, null, 2));
            return;
        }
        const [key, value] = args;
        if (value) {
            // Set config value
            this.configManager.setConfig(key, value);
            console.log(chalk_1.default.green(`✅ Set ${key} = ${value}`));
        }
        else {
            // Get config value
            const config = this.configManager.getConfig();
            const val = config[key];
            console.log(chalk_1.default.cyan(`${key}: ${val || 'undefined'}`));
        }
    }
    /**
     * Handle status command
     */
    async handleStatusCommand() {
        console.log(chalk_1.default.cyan('📊 System Status:'));
        console.log(chalk_1.default.white(`  • Mode: ${this.currentMode}`));
        console.log(chalk_1.default.white(`  • Working Directory: ${this.workingDirectory}`));
        console.log(chalk_1.default.white(`  • Current Agent: ${this.currentAgent || 'none'}`));
        console.log(chalk_1.default.white(`  • Active Tasks: ${this.agentManager.getActiveTaskCount()}`));
        console.log(chalk_1.default.white(`  • Project Context: ${fs.existsSync(this.projectContextFile) ? 'exists' : 'missing'}`));
    }
    /**
     * Handle agents command
     */
    async handleAgentsCommand() {
        console.log(chalk_1.default.cyan('🤖 Available Agents:'));
        // Mock agent list for now
        const agents = [
            { id: 'coding-agent', name: 'Coding Agent', capabilities: ['code-generation', 'debugging'] },
            { id: 'devops-agent', name: 'DevOps Agent', capabilities: ['deployment', 'infrastructure'] },
            { id: 'frontend-agent', name: 'Frontend Agent', capabilities: ['ui-development', 'styling'] }
        ];
        agents.forEach(agent => {
            console.log(chalk_1.default.white(`  • ${agent.name} (${agent.id})`));
            console.log(chalk_1.default.gray(`    Capabilities: ${agent.capabilities.join(', ')}`));
        });
    }
    /**
     * Handle models command
     */
    async handleModelsCommand() {
        console.log(chalk_1.default.cyan('🧠 Available Models:'));
        // Mock model list for now
        const models = [
            { provider: 'openai', model: 'gpt-4' },
            { provider: 'anthropic', model: 'claude-3-sonnet' },
            { provider: 'google', model: 'gemini-pro' }
        ];
        models.forEach(model => {
            console.log(chalk_1.default.white(`  • ${model.provider}/${model.model}`));
        });
    }
    /**
     * Display plan
     */
    displayPlan(plan) {
        console.log(chalk_1.default.cyan(`\n📋 Plan: ${plan.title}`));
        console.log(chalk_1.default.gray(`Description: ${plan.description}\n`));
        plan.steps.forEach((step, index) => {
            console.log(chalk_1.default.white(`${index + 1}. ${step.title}`));
            console.log(chalk_1.default.gray(`   ${step.description}`));
            console.log(chalk_1.default.gray(`   Agent: ${step.agentId}`));
        });
    }
    /**
     * Ask for user approval
     */
    async askForApproval(question) {
        return new Promise((resolve) => {
            if (!this.rl) {
                resolve(false);
                return;
            }
            this.rl.question(chalk_1.default.yellow(`${question} (y/n): `), (answer) => {
                resolve(answer.toLowerCase().startsWith('y'));
            });
        });
    }
    /**
     * Display help
     */
    displayHelp() {
        console.log(chalk_1.default.cyan('\n📚 NikCLI Help\n'));
        console.log(chalk_1.default.white('🔧 Slash Commands:'));
        console.log(chalk_1.default.gray('  /chat     - Switch to chat mode'));
        console.log(chalk_1.default.gray('  /auto     - Switch to autonomous mode'));
        console.log(chalk_1.default.gray('  /plan     - Switch to planning mode'));
        console.log(chalk_1.default.gray('  /init     - Initialize project'));
        console.log(chalk_1.default.gray('  /config   - Manage configuration'));
        console.log(chalk_1.default.gray('  /status   - Show system status'));
        console.log(chalk_1.default.gray('  /agents   - List available agents'));
        console.log(chalk_1.default.gray('  /models   - List available models'));
        console.log(chalk_1.default.gray('  /clear    - Clear screen'));
        console.log(chalk_1.default.gray('  /help     - Show this help'));
        console.log(chalk_1.default.gray('  /exit     - Exit NikCLI\n'));
        console.log(chalk_1.default.white('🎯 Modes:'));
        console.log(chalk_1.default.gray('  default   - Interactive chat with AI'));
        console.log(chalk_1.default.gray('  auto      - Autonomous task execution'));
        console.log(chalk_1.default.gray('  plan      - Step-by-step planning with approval\n'));
    }
    /**
     * Show prompt based on current mode
     */
    showPrompt() {
        const modeColors = {
            default: chalk_1.default.green,
            auto: chalk_1.default.yellow,
            plan: chalk_1.default.blue
        };
        const modeColor = modeColors[this.currentMode];
        const prompt = `${modeColor(`[${this.currentMode}]`)} ${chalk_1.default.cyan('nikcli')} ${chalk_1.default.gray('>')} `;
        if (this.rl) {
            this.rl.setPrompt(prompt);
            this.rl.prompt();
        }
    }
    /**
     * Cleanup and exit
     */
    async cleanup() {
        if (this.rl) {
            this.rl.close();
        }
        // Save session context
        this.updateProjectContext();
        console.log(chalk_1.default.green('✅ Session saved'));
    }
    /**
     * Update project context file
     */
    updateProjectContext() {
        if (!fs.existsSync(this.projectContextFile)) {
            return;
        }
        const sessionEntry = `
## Session ${new Date().toISOString()}
- Mode: ${this.currentMode}
- Agent: ${this.currentAgent || 'none'}
- Tasks: ${this.agentManager.getActiveTaskCount()}
`;
        fs.appendFileSync(this.projectContextFile, sessionEntry);
    }
}
exports.NikCLI = NikCLI;
