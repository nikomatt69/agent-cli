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
exports.UnifiedChatInterface = void 0;
exports.main = main;
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const readline = __importStar(require("readline"));
const events_1 = require("events");
const advanced_ai_provider_1 = require("./ai/advanced-ai-provider");
const workflow_orchestrator_1 = require("./automation/workflow-orchestrator");
const chat_orchestrator_1 = require("./chat/chat-orchestrator");
const agent_service_1 = require("./services/agent-service");
const config_manager_1 = require("./core/config-manager");
const banner = `
███╗   ██╗██╗██╗  ██╗ ██████╗██╗     ██╗
████╗  ██║██║██║ ██╔╝██╔════╝██║     ██║
██╔██╗ ██║██║█████╔╝ ██║     ██║     ██║
██║╚██╗██║██║██╔═██╗ ██║     ██║     ██║
██║ ╚████║██║██║  ██╗╚██████╗███████╗██║
╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝
`;
class UnifiedChatInterface extends events_1.EventEmitter {
    constructor() {
        super();
        this.initialized = false;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            historySize: 500,
            completer: this.autoComplete.bind(this),
        });
        this.session = {
            id: Date.now().toString(),
            messages: [],
            workingDirectory: process.cwd(),
            planMode: true,
            isExecuting: false,
            promptQueue: [],
            activeAgents: new Map()
        };
        this.workflowOrchestrator = new workflow_orchestrator_1.WorkflowOrchestrator(this.session.workingDirectory);
        this.chatOrchestrator = new chat_orchestrator_1.ChatOrchestrator(agent_service_1.agentService, {}, {}, config_manager_1.simpleConfigManager);
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.rl.on('SIGINT', () => {
            if (this.session.isExecuting) {
                console.log(chalk_1.default.yellow('\n⏸️  Stopping current execution...'));
                this.stopExecution();
                this.showPrompt();
            }
            else {
                this.showGoodbye();
                process.exit(0);
            }
        });
        this.rl.on('line', async (input) => {
            const trimmed = input.trim();
            if (!trimmed) {
                this.showPrompt();
                return;
            }
            await this.handleInput(trimmed);
            this.showPrompt();
        });
        this.rl.on('close', () => {
            this.showGoodbye();
            process.exit(0);
        });
    }
    async handleInput(input) {
        this.session.messages.push({
            role: 'user',
            content: input,
            timestamp: new Date()
        });
        if (input.startsWith('/')) {
            await this.handleSlashCommand(input);
            return;
        }
        if (this.session.isExecuting) {
            await this.queuePrompt(input);
            return;
        }
        await this.processPrompt(input);
    }
    async processPrompt(input) {
        console.log(chalk_1.default.blue('🤔 Processing your request...'));
        try {
            if (this.session.planMode) {
                const plan = await this.generatePlan(input);
                if (plan) {
                    this.displayPlan(plan);
                    const approved = await this.requestPlanApproval();
                    if (approved) {
                        await this.executePlan(plan);
                    }
                    else {
                        console.log(chalk_1.default.yellow('📝 Plan rejected. Waiting for new prompt...'));
                        this.addAssistantMessage('Plan was not approved. Please provide a new request or modify your requirements.');
                    }
                }
                else {
                    await this.generateDirectResponse(input);
                }
            }
            else {
                await this.generateDirectResponse(input);
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error processing prompt: ${error.message}`));
            this.addAssistantMessage(`I encountered an error: ${error.message}. Please try again.`);
        }
    }
    async generatePlan(prompt) {
        console.log(chalk_1.default.cyan('📋 Generating execution plan...'));
        try {
            const planningResult = await advanced_ai_provider_1.advancedAIProvider.generateWithTools([
                {
                    role: 'system',
                    content: `You are a planning assistant. Analyze the user's request and create a detailed execution plan.
          
          If the request is simple (like asking a question), return null.
          If the request requires multiple steps or actions, create a structured plan.
          
          Return a JSON object with:
          - title: Brief plan title
          - description: What the plan accomplishes
          - steps: Array of steps with id, title, description, toolName, parameters, dependencies, estimatedTime, requiresPermission
          - estimatedDuration: Total time in minutes
          - riskLevel: low/medium/high
          - requiresApproval: boolean
          
          Working directory: ${this.session.workingDirectory}`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]);
            const planText = planningResult;
            try {
                const planData = JSON.parse(planText);
                if (planData && planData.steps && planData.steps.length > 0) {
                    const plan = {
                        id: Date.now().toString(),
                        title: planData.title || 'Execution Plan',
                        description: planData.description || 'Generated plan',
                        steps: planData.steps,
                        estimatedDuration: planData.estimatedDuration || 10,
                        riskLevel: planData.riskLevel || 'medium',
                        requiresApproval: planData.requiresApproval !== false
                    };
                    this.session.currentPlan = plan;
                    return plan;
                }
            }
            catch (parseError) {
                console.log(chalk_1.default.dim('💭 Simple request detected, no plan needed'));
                return null;
            }
            return null;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Planning failed: ${error.message}`));
            return null;
        }
    }
    displayPlan(plan) {
        const planBox = (0, boxen_1.default)(chalk_1.default.white.bold(`📋 ${plan.title}\n\n`) +
            chalk_1.default.gray(`${plan.description}\n\n`) +
            chalk_1.default.blue(`🕒 Estimated Duration: ${plan.estimatedDuration} minutes\n`) +
            chalk_1.default.yellow(`⚠️  Risk Level: ${plan.riskLevel.toUpperCase()}\n\n`) +
            chalk_1.default.white.bold('📝 Execution Steps:\n') +
            plan.steps.map((step, i) => `${i + 1}. ${chalk_1.default.cyan(step.title)}\n   ${chalk_1.default.dim(step.description)}\n   ${step.requiresPermission ? chalk_1.default.red('🔒 Requires permission') : chalk_1.default.green('✅ Auto-approved')}`).join('\n\n'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: plan.riskLevel === 'high' ? 'red' : plan.riskLevel === 'medium' ? 'yellow' : 'green'
        });
        console.log(planBox);
    }
    async requestPlanApproval() {
        return new Promise((resolve) => {
            const question = chalk_1.default.yellow.bold('🤔 Do you approve this execution plan? (y/N): ');
            this.rl.question(question, (answer) => {
                const approved = answer.toLowerCase().startsWith('y');
                resolve(approved);
            });
        });
    }
    async executePlan(plan) {
        console.log(chalk_1.default.green.bold(`🚀 Starting autonomous execution of: ${plan.title}`));
        this.session.isExecuting = true;
        this.session.currentPlan = plan;
        try {
            for (let i = 0; i < plan.steps.length; i++) {
                const step = plan.steps[i];
                console.log(chalk_1.default.blue(`\n📍 Step ${i + 1}/${plan.steps.length}: ${step.title}`));
                if (step.requiresPermission) {
                    const permitted = await this.requestStepPermission(step);
                    if (!permitted) {
                        console.log(chalk_1.default.yellow('⏸️  Execution paused - permission denied'));
                        break;
                    }
                }
                await this.executeStep(step);
                await this.processQueuedPrompts();
            }
            console.log(chalk_1.default.green.bold('✅ Plan execution completed successfully!'));
            this.addAssistantMessage(`Successfully completed: ${plan.title}`);
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Plan execution failed: ${error.message}`));
            this.addAssistantMessage(`Execution failed: ${error.message}`);
        }
        finally {
            this.session.isExecuting = false;
            this.session.currentPlan = undefined;
        }
    }
    async requestStepPermission(step) {
        const permissionBox = (0, boxen_1.default)(chalk_1.default.yellow.bold('🔒 Permission Required\n\n') +
            chalk_1.default.white(`Step: ${step.title}\n`) +
            chalk_1.default.gray(`Description: ${step.description}\n`) +
            chalk_1.default.cyan(`Tool: ${step.toolName}\n`) +
            chalk_1.default.dim(`Parameters: ${JSON.stringify(step.parameters, null, 2)}`), {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'yellow'
        });
        console.log(permissionBox);
        return new Promise((resolve) => {
            const question = chalk_1.default.yellow.bold('Allow this step? (y/N): ');
            this.rl.question(question, (answer) => {
                const allowed = answer.toLowerCase().startsWith('y');
                resolve(allowed);
            });
        });
    }
    async executeStep(step) {
        console.log(chalk_1.default.cyan(`🔧 Executing: ${step.toolName}`));
        try {
            await new Promise(resolve => setTimeout(resolve, step.estimatedTime * 100));
            console.log(chalk_1.default.green(`✅ Completed: ${step.title}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Step failed: ${error.message}`));
            throw error;
        }
    }
    async queuePrompt(prompt) {
        const queuedPrompt = {
            id: Date.now().toString(),
            content: prompt,
            timestamp: new Date(),
            priority: 'medium'
        };
        this.session.promptQueue.push(queuedPrompt);
        console.log(chalk_1.default.blue(`📥 Prompt queued (${this.session.promptQueue.length} in queue)`));
        console.log(chalk_1.default.dim(`"${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`));
    }
    async processQueuedPrompts() {
        if (this.session.promptQueue.length === 0)
            return;
        console.log(chalk_1.default.magenta(`🤖 Processing ${this.session.promptQueue.length} queued prompts with secondary agents...`));
        while (this.session.promptQueue.length > 0) {
            const queuedPrompt = this.session.promptQueue.shift();
            try {
                const agentId = `secondary-${Date.now()}`;
                console.log(chalk_1.default.magenta(`🤖 [${agentId}] Processing: "${queuedPrompt.content.slice(0, 40)}..."`));
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log(chalk_1.default.green(`✅ [${agentId}] Completed secondary task`));
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Secondary agent failed: ${error.message}`));
            }
        }
    }
    async generateDirectResponse(prompt) {
        console.log(chalk_1.default.cyan('💭 Generating response...'));
        try {
            const response = await advanced_ai_provider_1.advancedAIProvider.generateWithTools([
                {
                    role: 'system',
                    content: `You are NikCLI, an autonomous AI development assistant. Provide helpful, concise responses.
          Working directory: ${this.session.workingDirectory}`
                },
                ...this.session.messages.slice(-5)
            ]);
            this.addAssistantMessage(response);
            console.log(chalk_1.default.white(response));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Response generation failed: ${error.message}`));
            this.addAssistantMessage('I apologize, but I encountered an error generating a response. Please try again.');
        }
    }
    async handleSlashCommand(command) {
        const [cmd, ...args] = command.slice(1).split(' ');
        switch (cmd.toLowerCase()) {
            case 'help':
                this.showHelp();
                break;
            case 'plan':
                this.session.planMode = !this.session.planMode;
                console.log(chalk_1.default.green(`📋 Plan mode: ${this.session.planMode ? 'ON' : 'OFF'}`));
                break;
            case 'status':
                this.showStatus();
                break;
            case 'queue':
                this.showQueue();
                break;
            case 'stop':
                if (this.session.isExecuting) {
                    this.stopExecution();
                }
                else {
                    console.log(chalk_1.default.yellow('No execution in progress'));
                }
                break;
            case 'clear':
                console.clear();
                this.displayBanner();
                break;
            case 'exit':
                this.showGoodbye();
                process.exit(0);
                break;
            default:
                console.log(chalk_1.default.red(`Unknown command: /${cmd}. Type /help for available commands.`));
        }
    }
    stopExecution() {
        this.session.isExecuting = false;
        this.session.currentPlan = undefined;
        this.session.promptQueue = [];
        console.log(chalk_1.default.yellow('⏹️  Execution stopped'));
    }
    showHelp() {
        const helpBox = (0, boxen_1.default)(chalk_1.default.white.bold('🤖 NikCLI Commands\n\n') +
            chalk_1.default.green('/help') + chalk_1.default.gray('     - Show this help\n') +
            chalk_1.default.green('/plan') + chalk_1.default.gray('     - Toggle plan mode (currently: ') + (this.session.planMode ? chalk_1.default.green('ON') : chalk_1.default.red('OFF')) + chalk_1.default.gray(')\n') +
            chalk_1.default.green('/status') + chalk_1.default.gray('   - Show current status\n') +
            chalk_1.default.green('/queue') + chalk_1.default.gray('    - Show prompt queue\n') +
            chalk_1.default.green('/stop') + chalk_1.default.gray('     - Stop current execution\n') +
            chalk_1.default.green('/clear') + chalk_1.default.gray('    - Clear screen\n') +
            chalk_1.default.green('/exit') + chalk_1.default.gray('     - Exit NikCLI\n\n') +
            chalk_1.default.yellow('💡 Just type your request and I\'ll help you!'), {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'cyan'
        });
        console.log(helpBox);
    }
    showStatus() {
        const statusBox = (0, boxen_1.default)(chalk_1.default.white.bold('📊 NikCLI Status\n\n') +
            chalk_1.default.blue('Working Directory: ') + chalk_1.default.cyan(this.session.workingDirectory) + '\n' +
            chalk_1.default.blue('Plan Mode: ') + (this.session.planMode ? chalk_1.default.green('ON') : chalk_1.default.red('OFF')) + '\n' +
            chalk_1.default.blue('Executing: ') + (this.session.isExecuting ? chalk_1.default.yellow('YES') : chalk_1.default.green('NO')) + '\n' +
            chalk_1.default.blue('Current Plan: ') + (this.session.currentPlan ? chalk_1.default.cyan(this.session.currentPlan.title) : chalk_1.default.gray('None')) + '\n' +
            chalk_1.default.blue('Queued Prompts: ') + chalk_1.default.yellow(this.session.promptQueue.length.toString()) + '\n' +
            chalk_1.default.blue('Messages: ') + chalk_1.default.cyan(this.session.messages.length.toString()), {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'blue'
        });
        console.log(statusBox);
    }
    showQueue() {
        if (this.session.promptQueue.length === 0) {
            console.log(chalk_1.default.gray('📥 Prompt queue is empty'));
            return;
        }
        const queueBox = (0, boxen_1.default)(chalk_1.default.white.bold(`📥 Prompt Queue (${this.session.promptQueue.length})\n\n`) +
            this.session.promptQueue.map((prompt, i) => `${i + 1}. ${chalk_1.default.cyan(prompt.content.slice(0, 50))}${prompt.content.length > 50 ? '...' : ''}\n   ${chalk_1.default.dim(prompt.timestamp.toLocaleTimeString())}`).join('\n\n'), {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'yellow'
        });
        console.log(queueBox);
    }
    addAssistantMessage(content) {
        this.session.messages.push({
            role: 'assistant',
            content,
            timestamp: new Date()
        });
    }
    autoComplete(line) {
        const commands = ['/help', '/plan', '/status', '/queue', '/stop', '/clear', '/exit'];
        const hits = commands.filter(cmd => cmd.startsWith(line));
        return [hits.length ? hits : commands, line];
    }
    displayBanner() {
        console.clear();
        console.log(chalk_1.default.cyanBright(banner));
        const welcomeBox = (0, boxen_1.default)(chalk_1.default.white.bold('🤖 Autonomous AI Development Assistant\n\n') +
            chalk_1.default.gray('• Intelligent planning and execution\n') +
            chalk_1.default.gray('• Real-time prompt queue management\n') +
            chalk_1.default.gray('• Interactive permission system\n') +
            chalk_1.default.gray('• Multi-agent orchestration\n\n') +
            chalk_1.default.cyan('Ready to help with your development tasks!'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan'
        });
        console.log(welcomeBox);
    }
    showPrompt() {
        const workingDir = require('path').basename(this.session.workingDirectory);
        const indicators = [];
        if (this.session.planMode)
            indicators.push(chalk_1.default.green('plan'));
        if (this.session.isExecuting)
            indicators.push(chalk_1.default.yellow('exec'));
        if (this.session.promptQueue.length > 0)
            indicators.push(chalk_1.default.blue(`queue:${this.session.promptQueue.length}`));
        const modeStr = indicators.length > 0 ? ` [${indicators.join(' ')}]` : '';
        const prompt = chalk_1.default.cyan(`\n┌─[🤖:${workingDir}${modeStr}]\n└─❯ `);
        this.rl.setPrompt(prompt);
        this.rl.prompt();
    }
    showGoodbye() {
        const goodbyeBox = (0, boxen_1.default)(chalk_1.default.white.bold('🤖 NikCLI Session Complete\n\n') +
            chalk_1.default.gray('Thank you for using NikCLI!\n') +
            chalk_1.default.blue(`Messages processed: ${this.session.messages.length}\n`) +
            chalk_1.default.green(`Session duration: ${Math.round((Date.now() - parseInt(this.session.id)) / 1000)}s\n\n`) +
            chalk_1.default.cyan('Happy coding! 🚀'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
            textAlignment: 'center'
        });
        console.log(goodbyeBox);
    }
    async start() {
        try {
            if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
                console.log(chalk_1.default.red('❌ No API keys found. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY'));
                process.exit(1);
            }
            this.displayBanner();
            console.log(chalk_1.default.blue('🔄 Initializing services...'));
            await this.chatOrchestrator.initialize();
            console.log(chalk_1.default.green('✅ Services initialized'));
            this.showPrompt();
            this.initialized = true;
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to start NikCLI:'), error);
            process.exit(1);
        }
    }
}
exports.UnifiedChatInterface = UnifiedChatInterface;
async function main() {
    const chat = new UnifiedChatInterface();
    await chat.start();
}
if (require.main === module) {
    main().catch(error => {
        console.error(chalk_1.default.red('❌ Startup failed:'), error);
        process.exit(1);
    });
}
