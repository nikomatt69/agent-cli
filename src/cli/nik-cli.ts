import * as readline from 'readline';
import chalk from 'chalk';
import boxen from 'boxen';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import ora, { Ora } from 'ora';
import * as fs from 'fs/promises';
import * as path from 'path';

// Import existing modules

import { AgentManager } from './core/agent-manager';
import { PlanningManager } from './planning/planning-manager';
import { ModernAgentOrchestrator } from './automation/agents/modern-agent-system';
import { advancedAIProvider, AdvancedAIProvider } from './ai/advanced-ai-provider';
import { SimpleConfigManager, simpleConfigManager } from './core/config-manager';
import { ExecutionPlan } from './planning/types';
import { SlashCommandHandler } from './chat/nik-cli-commands';
import { chatManager } from './chat/chat-manager';
import { agentService } from './services/agent-service';
import { planningService } from './services/planning-service';
import { AgentTask } from './types/types';

// Configure marked for terminal rendering
marked.setOptions({
    renderer: new TerminalRenderer() as any,
});

export interface NikCLIOptions {
    agent?: string;
    model?: string;
    auto?: boolean;
    plan?: boolean;
}

export interface TodoOptions {
    list?: boolean;
    add?: string;
    complete?: string;
}

export interface PlanOptions {
    execute?: boolean;
    save?: string;
}

export interface AgentOptions {
    auto?: boolean;
}

export interface AutoOptions {
    planFirst?: boolean;
}

export interface ConfigOptions {
    show?: boolean;
    model?: string;
    key?: string;
}

export interface InitOptions {
    force?: boolean;
}

/**
 * NikCLI - Unified CLI interface integrating all existing modules
 * Provides Claude Code-style terminal experience with autonomous agents
 */
export class NikCLI {
    private rl?: readline.Interface;
    private configManager: SimpleConfigManager;
    private agentManager: AgentManager;
    private planningManager: PlanningManager;
    private workingDirectory: string;
    private currentMode: 'default' | 'auto' | 'plan' = 'default';
    private currentAgent?: string;
    private projectContextFile: string;
    private sessionContext: Map<string, any> = new Map();
    private slashHandler: SlashCommandHandler;

    constructor() {
        this.workingDirectory = process.cwd();
        this.projectContextFile = path.join(this.workingDirectory, 'CLAUDE.md');

        // Initialize core managers
        this.configManager = simpleConfigManager;
        this.agentManager = new AgentManager(this.configManager);
        this.planningManager = new PlanningManager(this.workingDirectory);
        this.slashHandler = new SlashCommandHandler();

        this.setupEventHandlers();
        // Bridge orchestrator events into NikCLI output
        this.setupOrchestratorEventBridge();
    }

    private setupEventHandlers(): void {
        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
            this.shutdown();
        });

        process.on('SIGTERM', () => {
            this.shutdown();
        });
    }

    // Bridge StreamingOrchestrator agent lifecycle events into NikCLI output
    private orchestratorEventsInitialized = false;
    private setupOrchestratorEventBridge(): void {
        if (this.orchestratorEventsInitialized) return;
        this.orchestratorEventsInitialized = true;

        agentService.on('task_start', (task) => {
            console.log(chalk.blue(`🤖 Agent ${task.agentType} started: ${task.task.slice(0, 60)}...`));
        });

        agentService.on('task_progress', (_task, update) => {
            const progress = typeof update.progress === 'number' ? `${update.progress}% ` : '';
            const desc = update.description ? `- ${update.description}` : '';
            console.log(chalk.cyan(`📊 ${progress}${desc}`));
        });

        agentService.on('tool_use', (_task, update) => {
            console.log(chalk.magenta(`🔧 ${update.tool}: ${update.description}`));
        });

        agentService.on('task_complete', (task) => {
            if (task.status === 'completed') {
                console.log(chalk.green(`✅ ${task.agentType} completed`));
            } else {
                console.log(chalk.red(`❌ ${task.agentType} failed: ${task.error}`));
            }
            // Keep prompt visible after background updates
            this.showPrompt();
        });
    }

    /**
     * Start interactive chat mode (main Claude Code experience)
     */
    async startChat(options: NikCLIOptions): Promise<void> {
        console.clear();
        this.showChatWelcome();

        // Apply options
        if (options.model) {
            this.switchModel(options.model);
        }

        if (options.auto) {
            this.currentMode = 'auto';
        } else if (options.plan) {
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
    private async startEnhancedChat(): Promise<void> {
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

            // Route slash and agent-prefixed commands, otherwise treat as chat
            if (trimmed.startsWith('/')) {
                await this.dispatchSlash(trimmed);
            } else if (trimmed.startsWith('@')) {
                await this.dispatchAt(trimmed);
            } else {
                await this.handleChatInput(trimmed);
            }
        });

        this.rl.on('SIGINT', () => {
            this.shutdown();
        });

        this.showPrompt();
    }

    /**
     * Dispatch /slash commands to rich SlashCommandHandler while preserving mode controls
     */
    private async dispatchSlash(command: string): Promise<void> {
        const parts = command.slice(1).split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        try {
            switch (cmd) {
                case 'plan':
                    if (args.length === 0) {
                        this.currentMode = 'plan';
                        console.log(chalk.green('✓ Switched to plan mode'));
                    } else {
                        await this.generatePlan(args.join(' '), {});
                    }
                    break;

                case 'auto':
                    if (args.length === 0) {
                        this.currentMode = 'auto';
                        console.log(chalk.green('✓ Switched to auto mode'));
                    } else {
                        await this.autoExecute(args.join(' '), {});
                    }
                    break;

                case 'default':
                    this.currentMode = 'default';
                    console.log(chalk.green('✓ Switched to default mode'));
                    break;

                default: {
                    const result = await this.slashHandler.handle(command);
                    if (result.shouldExit) {
                        this.shutdown();
                        return;
                    }
                }
            }
        } catch (error: any) {
            console.log(chalk.red(`Error executing ${command}: ${error.message}`));
        }

        this.showPrompt();
    }

    /**
     * Dispatch @agent commands through the unified command router
     */
    private async dispatchAt(input: string): Promise<void> {
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
    private async handleSlashCommand(command: string): Promise<void> {
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
                        console.log(chalk.green('✓ Switched to plan mode'));
                    } else {
                        await this.generatePlan(args.join(' '), {});
                    }
                    break;

                case 'auto':
                    if (args.length === 0) {
                        this.currentMode = 'auto';
                        console.log(chalk.green('✓ Switched to auto mode'));
                    } else {
                        await this.autoExecute(args.join(' '), {});
                    }
                    break;

                case 'default':
                    this.currentMode = 'default';
                    console.log(chalk.green('✓ Switched to default mode'));
                    break;

                case 'agent':
                    if (args.length === 0) {
                        await this.listAgents();
                    } else {
                        this.currentAgent = args[0];
                        console.log(chalk.green(`✓ Switched to agent: ${args[0]}`));
                    }
                    break;

                case 'model':
                    if (args.length === 0) {
                        await this.listModels();
                    } else {
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
                    console.log(chalk.red(`Unknown command: /${cmd}`));
                    console.log(chalk.dim('Type /help for available commands'));
            }
        } catch (error: any) {
            console.log(chalk.red(`Error executing /${cmd}: ${error.message}`));
        }

        this.showPrompt();
    }

    /**
     * Handle regular chat input based on current mode
     */
    private async handleChatInput(input: string): Promise<void> {
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
        } catch (error: any) {
            console.log(chalk.red(`Error: ${error.message}`));
        }

        this.showPrompt();
    }

    /**
     * Plan mode: Generate plan first, then ask for approval
     */
    private async handlePlanMode(input: string): Promise<void> {
        console.log(chalk.blue('🎯 Generating execution plan...'));

        const plan = await this.planningManager.generatePlanOnly(input, this.workingDirectory);

        console.log(chalk.cyan('\n📋 Generated Plan:'));
        // Display plan using console output
        console.log(`Plan: ${plan.title}`);
        console.log(`Description: ${plan.description}`);
        console.log(`Steps: ${plan.steps.length}`);

        // Ask for approval
        const approved = await this.askForApproval('Execute this plan?');

        if (approved) {
            console.log(chalk.green('✓ Plan approved, executing...'));
            await this.planningManager.executePlan(plan.id);
        } else {
            console.log(chalk.yellow('Plan cancelled'));
        }
    }

    /**
     * Auto mode: Execute immediately without approval
     */
    private async handleAutoMode(input: string): Promise<void> {
        console.log(chalk.blue('🚀 Auto-executing task...'));

        // Use agent if specified, otherwise auto-select
        if (this.currentAgent) {
            await this.executeAgent(this.currentAgent, input, { auto: true });
        } else {
            await this.autoExecute(input, {});
        }
    }

    /**
     * Default mode: Interactive chat with confirmations
     */
    private async handleDefaultMode(input: string): Promise<void> {
        // Check if input mentions specific agent
        const agentMatch = input.match(/@(\w+)/);

        if (agentMatch) {
            const agentName = agentMatch[1];
            const task = input.replace(agentMatch[0], '').trim();
            await this.executeAgent(agentName, task, {});
        } else {
            // Real chatbot conversation in default mode
            try {
                // Record user message in session
                chatManager.addMessage(input, 'user');

                // Build model-ready messages from session history (respects history setting)
                const messages = chatManager.getContextMessages().map(m => ({
                    role: m.role as 'system' | 'user' | 'assistant',
                    content: m.content,
                }));

                // Stream assistant response
                process.stdout.write(`${chalk.cyan('\nAssistant: ')}`);
                let assistantText = '';
                for await (const ev of advancedAIProvider.streamChatWithFullAutonomy(messages)) {
                    if (ev.type === 'text_delta' && ev.content) {
                        assistantText += ev.content;
                        process.stdout.write(ev.content);
                    } else if (ev.type === 'error') {
                        console.log(`${chalk.red(ev.content || ev.error || 'Unknown error')}`);
                    }
                }

                // Save assistant message to history
                if (assistantText.trim().length > 0) {
                    chatManager.addMessage(assistantText.trim(), 'assistant');
                }

                console.log(); // newline after streaming
            } catch (err: any) {
                console.log(chalk.red(`Chat error: ${err.message}`));
            }
        }
    }

    /**
     * Generate execution plan for a task
     */
    async generatePlan(task: string, options: PlanOptions): Promise<void> {
        console.log(chalk.blue(`🎯 Generating plan for: ${chalk.cyan(task)}`));

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
        } catch (error: any) {
            console.log(chalk.red(`Plan generation failed: ${error.message}`));
        }
    }

    /**
     * Execute task with specific agent
     */
    async executeAgent(name: string, task: string, options: AgentOptions): Promise<void> {
        console.log(chalk.blue(`🤖 Executing with ${chalk.cyan(name)} agent...`));

        try {
            // Launch real agent via AgentService; run asynchronously
            const taskId = await agentService.executeTask(name, task);
            console.log(chalk.blue(`🚀 Launched ${name} (Task ID: ${taskId.slice(-6)})`));
        } catch (error: any) {
            console.log(chalk.red(`Agent execution failed: ${error.message}`));
        }
    }

    /**
     * Autonomous execution with best agent selection
     */
    async autoExecute(task: string, options: AutoOptions): Promise<void> {
        console.log(chalk.blue(`🚀 Auto-executing: ${chalk.cyan(task)}`));

        try {
            if (options.planFirst) {
                // Use real PlanningService to create and execute plan asynchronously
                const plan = await planningService.createPlan(task, {
                    showProgress: true,
                    autoExecute: true,
                    confirmSteps: false,
                });
                console.log(chalk.cyan(`📋 Generated plan with ${plan.steps.length} steps (id: ${plan.id}). Executing in background...`));
                // Fire-and-forget execution to keep CLI responsive
                (async () => {
                    try {
                        await planningService.executePlan(plan.id, {
                            showProgress: true,
                            autoExecute: true,
                            confirmSteps: false,
                        });
                    } catch (err: any) {
                        console.log(chalk.red(`❌ Plan execution error: ${err.message}`));
                    }
                })();
            } else {
                // Direct autonomous execution - select best agent and launch
                const selected = this.agentManager.findBestAgentForTask(task as any);
                console.log(chalk.blue(`🤖 Selected agent: ${chalk.cyan(selected)}`));
                const taskId = await agentService.executeTask(selected as any, task);
                console.log(chalk.blue(`🚀 Launched ${selected} (Task ID: ${taskId.slice(-6)})`));
            }
        } catch (error: any) {
            console.log(chalk.red(`Auto execution failed: ${error.message}`));
        }
    }

    /**
     * Manage todo items and planning
     */
    async manageTodo(options: TodoOptions): Promise<void> {
        if (options.list) {
            console.log(chalk.cyan('📋 Todo Items:'));
            const plans = this.planningManager.listPlans();

            if (plans.length === 0) {
                console.log(chalk.dim('No todo items found'));
                return;
            }

            plans.forEach((plan, index) => {
                const status = '⏳'; // Plans don't have status property, using default
                console.log(`${index + 1}. ${status} ${plan.title}`);
                console.log(`   ${chalk.dim(plan.description)}`);
            });
        }

        if (options.add) {
            console.log(chalk.blue(`Adding todo: ${options.add}`));
            await this.generatePlan(options.add, {});
        }

        if (options.complete) {
            console.log(chalk.green(`Marking todo ${options.complete} as complete`));
            // Implementation for marking todo complete
        }
    }

    /**
     * Manage CLI configuration
     */
    async manageConfig(options: ConfigOptions): Promise<void> {
        if (options.show) {
            console.log(chalk.cyan('⚙️ Current Configuration:'));
            const config = this.configManager.getConfig();
            console.log(chalk.dim('Model:'), chalk.green(config.currentModel));
            console.log(chalk.dim('Working Directory:'), chalk.blue(this.workingDirectory));
            console.log(chalk.dim('Mode:'), chalk.yellow(this.currentMode));
            if (this.currentAgent) {
                console.log(chalk.dim('Current Agent:'), chalk.cyan(this.currentAgent));
            }
        }

        if (options.model) {
            this.switchModel(options.model);
        }
    }

    /**
     * Initialize project with CLAUDE.md context file
     */
    async initProject(options: InitOptions): Promise<void> {
        console.log(chalk.blue('🔧 Initializing project context...'));

        const claudeFile = path.join(this.workingDirectory, 'CLAUDE.md');

        try {
            // Check if CLAUDE.md already exists
            const exists = await fs.access(claudeFile).then(() => true).catch(() => false);

            if (exists && !options.force) {
                console.log(chalk.yellow('CLAUDE.md already exists. Use --force to overwrite.'));
                return;
            }

            // Analyze project structure
            console.log(chalk.dim('Analyzing project structure...'));
            const analysis = await this.analyzeProject();

            // Generate CLAUDE.md content
            const content = this.generateClaudeMarkdown(analysis);

            // Write file
            await fs.writeFile(claudeFile, content, 'utf8');

            console.log(chalk.green('✓ CLAUDE.md created successfully'));
            console.log(chalk.dim(`Context file: ${claudeFile}`));

        } catch (error: any) {
            console.log(chalk.red(`Failed to initialize project: ${error.message}`));
        }
    }

    /**
     * Show system status and agent information
     */
    async showStatus(): Promise<void> {
        console.log(chalk.cyan.bold('🔍 NikCLI Status'));
        console.log(chalk.gray('─'.repeat(50)));

        // System info
        console.log(chalk.blue('System:'));
        console.log(`  Working Directory: ${chalk.dim(this.workingDirectory)}`);
        console.log(`  Mode: ${chalk.yellow(this.currentMode)}`);
        console.log(`  Model: ${chalk.green(advancedAIProvider.getCurrentModelInfo().name)}`);

        // Agent info
        if (this.currentAgent) {
            console.log(`  Current Agent: ${chalk.cyan(this.currentAgent)}`);
        }

        // Agent manager stats
        const stats = this.agentManager.getStats();
        console.log(chalk.blue('\nAgents:'));
        console.log(`  Total: ${stats.totalAgents}`);
        console.log(`  Active: ${stats.activeAgents}`);
        console.log(`  Pending Tasks: ${stats.pendingTasks}`);

        // Planning stats
        const planningStats = this.planningManager.getPlanningStats();
        console.log(chalk.blue('\nPlanning:'));
        console.log(`  Plans Generated: ${planningStats.totalPlansGenerated}`);
        console.log(`  Plans Executed: ${planningStats.totalPlansExecuted}`);
        console.log(`  Success Rate: ${Math.round((planningStats.successfulExecutions / planningStats.totalPlansExecuted) * 100)}%`);
    }

    /**
     * List available agents and their capabilities
     */
    async listAgents(): Promise<void> {
        console.log(chalk.cyan.bold('🤖 Available Agents'));
        console.log(chalk.gray('─'.repeat(50)));
        const available = agentService.getAvailableAgents();
        available.forEach(agent => {
            console.log(chalk.white(`  • ${agent.name}`));
            console.log(chalk.gray(`    ${agent.description}`));
        });
    }

    /**
     * List available AI models
     */
    async listModels(): Promise<void> {
        console.log(chalk.cyan.bold('🧠 Available Models'));
        console.log(chalk.gray('─'.repeat(50)));

        // Mock models for now
        const models = [
            { provider: 'openai', model: 'gpt-4' },
            { provider: 'anthropic', model: 'claude-3-sonnet' },
            { provider: 'google', model: 'gemini-pro' }
        ];
        const currentModel = 'claude-3-sonnet'; // Mock current model

        models.forEach((modelInfo) => {
            const model = modelInfo.model;
            const indicator = model === currentModel ? chalk.green('→') : ' ';
            console.log(`${indicator} ${model}`);
        });
    }

    // Utility methods
    private async initializeSystems(): Promise<void> {
        await this.agentManager.initialize();
        // Ensure orchestrator services share our working directory
        planningService.setWorkingDirectory(this.workingDirectory);
        // Event bridge is idempotent
        this.setupOrchestratorEventBridge();
        console.log(chalk.dim('✓ Systems initialized'));
    }

    private switchModel(modelName: string): void {
        try {
            // Mock usage stats for now
            console.log(chalk.cyan('💰 Usage Stats:'));
            console.log(chalk.white('  • Total requests: 0'));
            console.log(chalk.white('  • Total cost: $0.00'));

            console.log(chalk.cyan('\n⚙️  Configuration:'));
            console.log(JSON.stringify(this.configManager.getConfig(), null, 2));
            console.log(chalk.green(`✓ Switched to model: ${modelName}`));
        } catch (error: any) {
            console.log(chalk.red(`Failed to switch model: ${error.message}`));
        }
    }

    private async askForApproval(question: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (!this.rl) {
                resolve(false);
                return;
            }

            this.rl.question(chalk.yellow(`${question} (y/N): `), (answer) => {
                resolve(answer.toLowerCase().startsWith('y'));
            });
        });
    }

    private async clearSession(): Promise<void> {
        this.sessionContext.clear();
        console.log(chalk.green('✓ Session cleared'));
    }

    private async compactSession(): Promise<void> {
        // Implementation for session compaction
        console.log(chalk.green('✓ Session compacted'));
    }

    private async showCost(): Promise<void> {
        // Implementation for cost tracking
        console.log(chalk.blue('💰 Token usage and cost information'));
        console.log(chalk.dim('Cost tracking not yet implemented'));
    }

    private showSlashHelp(): void {
        console.log(chalk.cyan.bold('📚 Available Slash Commands'));
        console.log(chalk.gray('─'.repeat(50)));

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
            console.log(`${chalk.green(cmd.padEnd(15))} ${chalk.dim(desc)}`);
        });
    }

    private showChatWelcome(): void {
        const title = chalk.cyanBright('🤖 NikCLI');
        const subtitle = chalk.gray('Autonomous AI Developer Assistant');

        console.log(boxen(
            `${title}\n${subtitle}\n\n` +
            `${chalk.blue('Mode:')} ${chalk.yellow(this.currentMode)}\n` +
            `${chalk.blue('Model:')} ${chalk.green(advancedAIProvider.getCurrentModelInfo().name)}\n` +
            `${chalk.blue('Directory:')} ${chalk.cyan(path.basename(this.workingDirectory))}\n\n` +
            `${chalk.dim('Type /help for commands or start chatting!')}\n` +
            `${chalk.dim('Use Shift+Tab to cycle modes: default → auto → plan')}`,
            {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'cyan',
                textAlignment: 'center',
            }
        ));
    }

    private showPrompt(): void {
        if (!this.rl) return;

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

        const prompt = `\n┌─[${modeIcon}${agentInfo}${chalk.green(modelName)}:${chalk.green(workingDir)}]\n└─❯ `;
        this.rl.setPrompt(prompt);
        this.rl.prompt();
    }

    private async analyzeProject(): Promise<any> {
        // Implementation for project analysis
        return {
            name: path.basename(this.workingDirectory),
            framework: 'Unknown',
            languages: ['typescript', 'javascript'],
            dependencies: [],
            structure: {}
        };
    }

    private generateClaudeMarkdown(analysis: any): string {
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

    private async savePlanToFile(plan: ExecutionPlan, filename: string): Promise<void> {
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
        console.log(chalk.green(`✓ Plan saved to ${filename}`));
    }

    private shutdown(): void {
        console.log(chalk.blue('\n👋 Shutting down NikCLI...'));

        if (this.rl) {
            this.rl.close();
        }

        // Cleanup systems
        this.agentManager.cleanup();

        console.log(chalk.green('✓ Goodbye!'));
        process.exit(0);
    }
}
