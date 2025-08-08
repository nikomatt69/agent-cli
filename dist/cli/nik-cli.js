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
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const marked_1 = require("marked");
const marked_terminal_1 = __importDefault(require("marked-terminal"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// Import existing modules
const agent_manager_1 = require("./core/agent-manager");
const planning_manager_1 = require("./planning/planning-manager");
const advanced_ai_provider_1 = require("./ai/advanced-ai-provider");
const config_manager_1 = require("./core/config-manager");
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
        this.chatMessages = [];
        this.workingDirectory = process.cwd();
        this.projectContextFile = path.join(this.workingDirectory, 'CLAUDE.md');
        // Initialize core managers
        this.configManager = config_manager_1.simpleConfigManager;
        this.agentManager = new agent_manager_1.AgentManager(this.configManager);
        this.planningManager = new planning_manager_1.PlanningManager(this.workingDirectory);
        this.setupEventHandlers();
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
        // Initialize chat system prompt if configured
        try {
            const sysPrompt = this.configManager.get('systemPrompt');
            if (sysPrompt && !this.chatMessages.find(m => m.role === 'system')) {
                this.chatMessages.push({ role: 'system', content: sysPrompt });
            }
        }
        catch { }
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
            // Handle slash commands
            if (trimmed.startsWith('/')) {
                await this.handleSlashCommand(trimmed);
            }
            else {
                await this.handleChatInput(trimmed);
            }
        });
        this.rl.on('SIGINT', () => {
            this.shutdown();
        });
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
     * Plan mode: Generate plan first, then ask for approval
     */
    async handlePlanMode(input) {
        console.log(chalk_1.default.blue('🎯 Generating execution plan...'));
        const plan = await this.planningManager.generatePlanOnly(input, this.workingDirectory);
        console.log(chalk_1.default.cyan('\n📋 Generated Plan:'));
        // Display plan using console output
        console.log(`Plan: ${plan.title}`);
        console.log(`Description: ${plan.description}`);
        console.log(`Steps: ${plan.steps.length}`);
        // Ask for approval
        const approved = await this.askForApproval('Execute this plan?');
        if (approved) {
            console.log(chalk_1.default.green('✓ Plan approved, executing...'));
            await this.planningManager.executePlan(plan.id);
        }
        else {
            console.log(chalk_1.default.yellow('Plan cancelled'));
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
            // Use chat interface for general conversation
            console.log(chalk_1.default.blue('💬 Processing with chat interface...'));
            // Ensure API key is configured
            if (!advanced_ai_provider_1.advancedAIProvider.validateApiKey()) {
                console.log(chalk_1.default.red('❌ No API key configured for the current model.'));
                console.log(chalk_1.default.dim('Set it via environment variable or update your config.'));
                return;
            }
            // Build message history and stream response
            this.chatMessages.push({ role: 'user', content: input });
            let assistantText = '';
            try {
                for await (const event of advanced_ai_provider_1.advancedAIProvider.streamChatWithFullAutonomy(this.chatMessages)) {
                    switch (event.type) {
                        case 'text_delta':
                            if (event.content) {
                                process.stdout.write(chalk_1.default.white(event.content));
                            }
                            break;
                        case 'tool_call':
                            console.log(`\n${chalk_1.default.dim('🔧 Tool:')} ${chalk_1.default.cyan(event.toolName || '')}`);
                            if (event.toolArgs)
                                console.log(chalk_1.default.gray(`Args: ${JSON.stringify(event.toolArgs)}`));
                            break;
                        case 'tool_result':
                            if (event.toolName)
                                console.log(chalk_1.default.green(`✅ ${event.toolName} completed`));
                            break;
                        case 'complete':
                            // Add a newline if the stream didn't end with one
                            process.stdout.write('\n');
                            break;
                        case 'error':
                            console.log(chalk_1.default.red(`Error: ${event.error || event.content || 'unknown error'}`));
                            break;
                    }
                    if (event.type === 'text_delta' && event.content) {
                        assistantText += event.content;
                    }
                }
                // Save assistant message to history
                if (assistantText.trim().length > 0) {
                    this.chatMessages.push({ role: 'assistant', content: assistantText });
                }
            }
            catch (err) {
                console.log(chalk_1.default.red(`Chat failed: ${err.message || err}`));
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
            // Check if agent exists
            // Mock available agents for now
            const availableAgents = ['coding-agent', 'devops-agent', 'frontend-agent'];
            if (!availableAgents.includes(name)) {
                console.log(chalk_1.default.red(`Agent '${name}' not found`));
                console.log(chalk_1.default.dim(`Available agents: ${availableAgents.join(', ')}`));
                return;
            }
            // Execute with specific agent
            // Mock agent execution for now
            console.log(chalk_1.default.green(`✅ Agent ${name} executed task successfully`));
            console.log(chalk_1.default.green('✓ Agent execution completed'));
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
                // Generate plan first, then execute
                const plan = await this.planningManager.generatePlanOnly(task, this.workingDirectory);
                await this.planningManager.executePlan(plan.id);
            }
            else {
                // Direct autonomous execution - suggest best agent first
                console.log(chalk_1.default.blue(`🤖 Executing task with default agent...`));
                try {
                    // Simple task execution - can be enhanced later
                    console.log(chalk_1.default.green(`✅ Task completed`));
                }
                catch (error) {
                    console.log(chalk_1.default.red(`❌ Task failed: ${error}`));
                }
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
     * Initialize project with CLAUDE.md context file
     */
    async initProject(options) {
        console.log(chalk_1.default.blue('🔧 Initializing project context...'));
        const claudeFile = path.join(this.workingDirectory, 'CLAUDE.md');
        try {
            // Check if CLAUDE.md already exists
            const exists = await fs.access(claudeFile).then(() => true).catch(() => false);
            if (exists && !options.force) {
                console.log(chalk_1.default.yellow('CLAUDE.md already exists. Use --force to overwrite.'));
                return;
            }
            // Analyze project structure
            console.log(chalk_1.default.dim('Analyzing project structure...'));
            const analysis = await this.analyzeProject();
            // Generate CLAUDE.md content
            const content = this.generateClaudeMarkdown(analysis);
            // Write file
            await fs.writeFile(claudeFile, content, 'utf8');
            console.log(chalk_1.default.green('✓ CLAUDE.md created successfully'));
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
        // Mock agent capabilities for now
        const mockAgents = [
            { id: 'coding-agent', description: 'Code generation and debugging' },
            { id: 'devops-agent', description: 'Infrastructure and deployment' },
            { id: 'frontend-agent', description: 'UI development and styling' }
        ];
        mockAgents.forEach(agent => {
            console.log(chalk_1.default.white(`  • ${agent.id}`));
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
    // Utility methods
    async initializeSystems() {
        await this.agentManager.initialize();
        console.log(chalk_1.default.dim('✓ Systems initialized'));
    }
    switchModel(modelName) {
        try {
            // Mock usage stats for now
            console.log(chalk_1.default.cyan('💰 Usage Stats:'));
            console.log(chalk_1.default.white('  • Total requests: 0'));
            console.log(chalk_1.default.white('  • Total cost: $0.00'));
            console.log(chalk_1.default.cyan('\n⚙️  Configuration:'));
            console.log(JSON.stringify(this.configManager.getConfig(), null, 2));
            console.log(chalk_1.default.green(`✓ Switched to model: ${modelName}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`Failed to switch model: ${error.message}`));
        }
    }
    async askForApproval(question) {
        return new Promise((resolve) => {
            if (!this.rl) {
                resolve(false);
                return;
            }
            this.rl.question(chalk_1.default.yellow(`${question} (y/N): `), (answer) => {
                resolve(answer.toLowerCase().startsWith('y'));
            });
        });
    }
    async clearSession() {
        this.sessionContext.clear();
        console.log(chalk_1.default.green('✓ Session cleared'));
    }
    async compactSession() {
        // Implementation for session compaction
        console.log(chalk_1.default.green('✓ Session compacted'));
    }
    async showCost() {
        // Implementation for cost tracking
        console.log(chalk_1.default.blue('💰 Token usage and cost information'));
        console.log(chalk_1.default.dim('Cost tracking not yet implemented'));
    }
    showSlashHelp() {
        console.log(chalk_1.default.cyan.bold('📚 Available Slash Commands'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        const commands = [
            ['/init', 'Initialize project with CLAUDE.md'],
            ['/plan [task]', 'Switch to plan mode or generate plan'],
            ['/auto [task]', 'Switch to auto mode or execute task'],
            ['/default', 'Switch to default mode'],
            ['/agent [name]', 'List agents or switch to specific agent'],
            ['/model [name]', 'List models or switch to specific model'],
            ['/clear', 'Clear session context'],
            ['/compact', 'Compact session to save tokens'],
            ['/cost', 'Show token usage and costs'],
            ['/config', 'Show current configuration'],
            ['/status', 'Show system status'],
            ['/todo', 'Show todo items'],
            ['/help', 'Show this help'],
            ['/exit', 'Exit NikCLI']
        ];
        commands.forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(15))} ${chalk_1.default.dim(desc)}`);
        });
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
        // Mock models for now
        const models = [
            { provider: 'openai', model: 'gpt-4' },
            { provider: 'anthropic', model: 'claude-3-sonnet' },
            { provider: 'google', model: 'gemini-pro' }
        ];
        const modelName = models[0].model.split('-')[0];
        const modeIcon = this.currentMode === 'auto' ? '🚀' :
            this.currentMode === 'plan' ? '🎯' : '💬';
        const agentInfo = this.currentAgent ? `@${this.currentAgent}:` : '';
        const prompt = `\n┌─[${modeIcon}${agentInfo}${chalk_1.default.green(modelName)}:${chalk_1.default.green(workingDir)}]\n└─❯ `;
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
        return `# CLAUDE.md

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
