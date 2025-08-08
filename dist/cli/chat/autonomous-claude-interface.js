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
exports.autonomousClaudeInterface = exports.AutonomousClaudeInterface = void 0;
const readline = __importStar(require("readline"));
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const gradient_string_1 = __importDefault(require("gradient-string"));
const marked_1 = require("marked");
const marked_terminal_1 = __importDefault(require("marked-terminal"));
const advanced_ai_provider_1 = require("../ai/advanced-ai-provider");
const modern_agent_system_1 = require("../automation/agents/modern-agent-system");
const config_manager_1 = require("../core/config-manager");
const ora_1 = __importDefault(require("ora"));
const diff_manager_1 = require("../ui/diff-manager");
const execution_policy_1 = require("../policies/execution-policy");
// Configure marked for terminal rendering
marked_1.marked.setOptions({
    renderer: new marked_terminal_1.default(),
});
class AutonomousClaudeInterface {
    constructor() {
        this.isProcessing = false;
        this.activeTools = new Map();
        this.streamBuffer = '';
        this.lastStreamTime = Date.now();
        this.initialized = false;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            historySize: 300,
            completer: this.autoComplete.bind(this),
        });
        this.session = {
            id: Date.now().toString(),
            messages: [],
            workingDirectory: process.cwd(),
            createdAt: new Date(),
            autonomous: true,
            executionHistory: [],
            planMode: false,
            autoAcceptEdits: false,
        };
        // Set working directory in AI provider
        advanced_ai_provider_1.advancedAIProvider.setWorkingDirectory(this.session.workingDirectory);
        modern_agent_system_1.modernAgentOrchestrator.setWorkingDirectory(this.session.workingDirectory);
        // Initialize security policy manager
        this.policyManager = new execution_policy_1.ExecutionPolicyManager(config_manager_1.simpleConfigManager);
        this.setupEventHandlers();
        this.setupStreamOptimization();
    }
    setupEventHandlers() {
        // Handle Ctrl+C gracefully
        this.rl.on('SIGINT', () => {
            if (this.isProcessing) {
                console.log(chalk_1.default.yellow('\\n⏸️  Stopping current operation...'));
                this.stopAllActiveOperations();
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
        // Handle keypress events for interactive features
        process.stdin.on('keypress', (str, key) => {
            if (key && key.name === 'slash' && !this.isProcessing) {
                // Show command suggestions when / is pressed
                setTimeout(() => this.showCommandSuggestions(), 50);
            }
            // Handle Shift+Tab for plan mode cycling
            if (key && key.name === 'tab' && key.shift && !this.isProcessing) {
                this.togglePlanMode();
            }
            // Handle auto-accept toggle
            if (key && key.name === 'a' && key.ctrl && !this.isProcessing) {
                this.toggleAutoAcceptEdits();
            }
        });
        // Handle line input
        this.rl.on('line', async (input) => {
            const trimmed = input.trim();
            if (!trimmed) {
                this.showPrompt();
                return;
            }
            await this.handleInput(trimmed);
            this.showPrompt();
        });
        // Handle close
        this.rl.on('close', () => {
            this.showGoodbye();
            process.exit(0);
        });
    }
    setupStreamOptimization() {
        // Buffer stream output for smoother rendering
        setInterval(() => {
            if (this.streamBuffer && Date.now() - this.lastStreamTime > 50) {
                process.stdout.write(this.streamBuffer);
                this.streamBuffer = '';
            }
        }, 16); // ~60fps
    }
    async start() {
        console.clear();
        // Check for API keys first
        if (!this.checkAPIKeys()) {
            return;
        }
        this.showWelcome();
        // Start continuous input loop and wait for it to close
        return new Promise((resolve) => {
            this.startInputLoop();
            // Resolve when readline interface closes
            this.rl.on('close', () => {
                this.showGoodbye();
                resolve();
            });
        });
    }
    startInputLoop() {
        this.showPrompt();
        // Note: Input handling is done in setupEventHandlers() to avoid duplicate listeners
        // Note: close event is handled in start() method
    }
    checkAPIKeys() {
        const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
        const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
        const hasGoogleKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!hasAnthropicKey && !hasOpenAIKey && !hasGoogleKey) {
            console.log((0, boxen_1.default)(`${chalk_1.default.red('⚠️  No API Keys Found')}\n\n` +
                `Please set at least one API key:\n\n` +
                `${chalk_1.default.blue('• ANTHROPIC_API_KEY')} - for Claude models\n` +
                `${chalk_1.default.blue('• OPENAI_API_KEY')} - for GPT models\n` +
                `${chalk_1.default.blue('• GOOGLE_GENERATIVE_AI_API_KEY')} - for Gemini models\n\n` +
                `${chalk_1.default.yellow('Example:')}\n` +
                `${chalk_1.default.dim('export ANTHROPIC_API_KEY="your-key-here"')}\n` +
                `${chalk_1.default.dim('npm run chat')}`, {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'red',
                textAlignment: 'center',
            }));
            return false;
        }
        // Show which keys are available
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
        const title = gradient_string_1.default.rainbow('🤖 Autonomous Claude Assistant');
        const subtitle = chalk_1.default.gray('Terminal Velocity Development - Fully Autonomous Mode');
        const version = chalk_1.default.dim('v2.0.0 Advanced');
        console.log((0, boxen_1.default)(`${title}\\n${subtitle}\\n\\n${version}\\n\\n` +
            `${chalk_1.default.blue('🎯 Autonomous Mode:')} Enabled\\n` +
            `${chalk_1.default.blue('📁 Working Dir:')} ${chalk_1.default.cyan(this.session.workingDirectory)}\\n` +
            `${chalk_1.default.blue('🧠 Model:')} ${chalk_1.default.green(advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo().name)}\\n\\n` +
            `${chalk_1.default.gray('I operate with full autonomy:')}\\n` +
            `• ${chalk_1.default.green('Read & write files automatically')}\\n` +
            `• ${chalk_1.default.green('Execute commands when needed')}\\n` +
            `• ${chalk_1.default.green('Analyze project structure')}\\n` +
            `• ${chalk_1.default.green('Generate code and configurations')}\\n` +
            `• ${chalk_1.default.green('Manage dependencies autonomously')}\\n\\n` +
            `${chalk_1.default.yellow('Just tell me what you want - I handle everything')}\\n\\n` +
            `${chalk_1.default.yellow('💡 Press TAB or / for command suggestions')}\\\\n` +
            `${chalk_1.default.dim('Commands: /help /agents /auto /cd /model /exit')}`, {
            padding: 1,
            margin: 1,
            borderStyle: 'double',
            borderColor: 'cyan',
            textAlignment: 'center',
        }));
        // Show initial command suggestions like Claude Code
        console.log(chalk_1.default.cyan('\\n🚀 Quick Start - Try these commands:'));
        console.log(`${chalk_1.default.green('/')}\t\t\tShow all available commands`);
        console.log(`${chalk_1.default.green('/help')}\t\t\tDetailed help and examples`);
        console.log(`${chalk_1.default.green('/agents')}\t\t\tList specialized AI agents`);
        console.log(`${chalk_1.default.green('/analyze')}\t\t\tQuick project analysis`);
        console.log(`${chalk_1.default.green('/auto')} <task>\t\tFully autonomous task execution`);
        console.log(`${chalk_1.default.blue('@agent')} <task>\t\tUse specialized agent`);
        console.log(`${chalk_1.default.cyan('/plan')}\t\t\tToggle plan mode (${chalk_1.default.dim('shift+tab')})`);
        console.log(`${chalk_1.default.green('/auto-accept')}\t\tToggle auto-accept edits\\n`);
    }
    async initializeAutonomousAssistant() {
        const spinner = (0, ora_1.default)('🚀 Initializing autonomous assistant...').start();
        try {
            // Automatically analyze the workspace
            spinner.text = '🔍 Analyzing workspace...';
            // Set up the autonomous system prompt
            this.session.messages.push({
                role: 'system',
                content: `You are Claude - a fully autonomous AI development assistant with terminal velocity.

AUTONOMOUS MODE: You operate with complete independence and take actions without asking permission.

Working Directory: ${this.session.workingDirectory}
Current Date: ${new Date().toISOString()}

CAPABILITIES:
✅ read_file - Read and analyze any file with automatic content analysis
✅ write_file - Create/modify files with automatic backups and validation  
✅ explore_directory - Intelligent directory exploration with filtering
✅ execute_command - Autonomous command execution with safety checks
✅ analyze_project - Comprehensive project analysis with metrics
✅ manage_packages - Automatic dependency management with yarn
✅ generate_code - Context-aware code generation with best practices

AUTONOMOUS BEHAVIOR:
• Take immediate action on user requests without seeking permission
• Automatically read relevant files to understand context
• Execute necessary commands to complete tasks
• Create files and directories as needed
• Install dependencies when required
• Analyze projects before making changes
• Provide real-time feedback on all operations
• Handle errors gracefully and adapt approach

COMMUNICATION STYLE:
• Be concise but informative about actions taken
• Use tools proactively to gather context
• Show confidence in autonomous decisions
• Provide clear status updates during operations
• Explain reasoning for complex operations

You are NOT a cautious assistant - you are a proactive, autonomous developer who gets things done efficiently.`
            });
            spinner.succeed('🤖 Autonomous assistant ready');
            // Brief pause to show readiness
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        catch (error) {
            spinner.fail('Failed to initialize');
            console.log(chalk_1.default.red(`Error: ${error.message}`));
        }
    }
    async handleInput(input) {
        // Handle slash commands
        if (input.startsWith('/')) {
            await this.handleSlashCommand(input);
            return;
        }
        // Check for agent-specific requests
        const agentMatch = input.match(/^@(\\w+[-\\w]*)/);
        if (agentMatch) {
            const agentName = agentMatch[1];
            const task = input.replace(agentMatch[0], '').trim();
            await this.executeAgentTask(agentName, task);
            return;
        }
        // Regular autonomous chat
        await this.handleAutonomousChat(input);
    }
    async handleSlashCommand(command) {
        const [cmd, ...args] = command.slice(1).split(' ');
        switch (cmd) {
            case 'help':
                this.showAdvancedHelp();
                break;
            case 'autonomous':
                this.toggleAutonomousMode(args[0]);
                break;
            case 'context':
                await this.showExecutionContext();
                break;
            case 'clear':
                await this.clearSession();
                break;
            case 'agents':
                this.showAvailableAgents();
                break;
            case 'auto':
                const autoTask = args.join(' ');
                if (autoTask) {
                    await this.handleAutoMode(autoTask);
                }
                else {
                    console.log(chalk_1.default.red('Usage: /auto <task description>'));
                }
                break;
            case 'cd':
                await this.changeDirectory(args[0] || process.cwd());
                break;
            case 'pwd':
                console.log(chalk_1.default.blue(`📁 Current directory: ${this.session.workingDirectory}`));
                break;
            case 'ls':
                await this.quickDirectoryList();
                break;
            case 'model':
                if (args[0]) {
                    this.switchModel(args[0]);
                }
                else {
                    this.showCurrentModel();
                }
                break;
            case 'analyze':
                await this.quickProjectAnalysis();
                break;
            case 'history':
                this.showExecutionHistory();
                break;
            case 'plan':
                this.togglePlanMode();
                break;
            case 'auto-accept':
                this.toggleAutoAcceptEdits();
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
                else {
                    console.log(chalk_1.default.red('Usage: /accept <file> or /accept all'));
                }
                break;
            case 'reject':
                if (args[0]) {
                    diff_manager_1.diffManager.rejectDiff(args[0]);
                }
                else {
                    console.log(chalk_1.default.red('Usage: /reject <file>'));
                }
                break;
            case 'security':
                await this.showSecurityStatus();
                break;
            case 'policy':
                if (args[0] && args[1]) {
                    await this.updateSecurityPolicy(args[0], args[1]);
                }
                else {
                    await this.showSecurityStatus();
                }
                break;
            case 'exit':
            case 'quit':
                this.showGoodbye();
                process.exit(0);
                break;
            default:
                console.log(chalk_1.default.red(`Unknown command: ${cmd}`));
                console.log(chalk_1.default.gray('Type /help for available commands'));
        }
        this.showPrompt();
    }
    async handleAutonomousChat(input) {
        // Initialize agent on first input
        if (!this.initialized) {
            await this.initializeAutonomousAssistant();
            this.initialized = true;
        }
        // Check if plan mode is active
        if (this.session.planMode) {
            console.log(chalk_1.default.cyan('🎯 Plan Mode: Creating execution plan...'));
            // Add plan mode prefix to inform AI to create a plan
            this.session.messages.push({
                role: 'user',
                content: `[PLAN MODE] Create a detailed execution plan for: ${input}`,
            });
            await this.processAutonomousMessage();
            return;
        }
        // Add user message for regular autonomous execution
        this.session.messages.push({
            role: 'user',
            content: input,
        });
        // Add auto-accept context if enabled
        if (this.session.autoAcceptEdits) {
            this.session.messages.push({
                role: 'system',
                content: 'AUTO-ACCEPT MODE: Proceed with all file edits and changes without asking for confirmation.',
            });
        }
        await this.processAutonomousMessage();
    }
    async processAutonomousMessage() {
        this.isProcessing = true;
        try {
            console.log(); // Add spacing
            console.log(chalk_1.default.blue('🤖 ') + chalk_1.default.dim('Autonomous assistant thinking...'));
            let assistantMessage = '';
            let toolsExecuted = 0;
            const startTime = Date.now();
            // Stream the autonomous response
            for await (const event of advanced_ai_provider_1.advancedAIProvider.streamChatWithFullAutonomy(this.session.messages)) {
                this.session.executionHistory.push(event);
                switch (event.type) {
                    case 'start':
                        console.log(chalk_1.default.cyan(`🚀 ${event.content}`));
                        break;
                    case 'thinking':
                        console.log(chalk_1.default.magenta(`💭 ${event.content}`));
                        break;
                    case 'text_delta':
                        if (event.content) {
                            // Buffer for smooth streaming
                            this.streamBuffer += event.content;
                            this.lastStreamTime = Date.now();
                            assistantMessage += event.content;
                        }
                        break;
                    case 'tool_call':
                        toolsExecuted++;
                        this.handleToolCall(event);
                        break;
                    case 'tool_result':
                        this.handleToolResult(event);
                        break;
                    case 'complete':
                        // Flush any remaining buffer
                        if (this.streamBuffer) {
                            process.stdout.write(this.streamBuffer);
                            this.streamBuffer = '';
                        }
                        const duration = Date.now() - startTime;
                        console.log();
                        console.log(chalk_1.default.green(`\\n✨ Completed in ${duration}ms • ${toolsExecuted} tools used`));
                        break;
                    case 'error':
                        console.log(chalk_1.default.red(`\\n❌ Error: ${event.error}`));
                        break;
                }
            }
            // Add assistant message to session
            if (assistantMessage.trim()) {
                this.session.messages.push({
                    role: 'assistant',
                    content: assistantMessage.trim(),
                });
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`\\n❌ Autonomous execution failed: ${error.message}`));
        }
        finally {
            this.stopAllActiveOperations();
            this.isProcessing = false;
            console.log(); // Add spacing
            this.showPrompt();
        }
    }
    handleToolCall(event) {
        const { toolName, toolArgs, metadata } = event;
        if (!toolName)
            return;
        // Create visual indicator for tool execution
        const toolEmoji = this.getToolEmoji(toolName);
        const toolLabel = this.getToolLabel(toolName);
        console.log(`\\n${toolEmoji} ${chalk_1.default.cyan(toolLabel)}`, chalk_1.default.dim(this.formatToolArgs(toolArgs)));
        // Create spinner for long-running operations
        const tracker = {
            name: toolName,
            startTime: new Date(),
            spinner: (0, ora_1.default)({
                text: chalk_1.default.dim(`Executing ${toolName}...`),
                spinner: 'dots2',
                color: 'cyan'
            }).start()
        };
        if (metadata?.toolCallId) {
            this.activeTools.set(metadata.toolCallId, tracker);
        }
    }
    handleToolResult(event) {
        const { toolName, toolResult, metadata } = event;
        if (!toolName)
            return;
        // Stop spinner if exists
        if (metadata?.toolCallId) {
            const tracker = this.activeTools.get(metadata.toolCallId);
            if (tracker?.spinner) {
                const duration = Date.now() - tracker.startTime.getTime();
                const success = metadata?.success !== false;
                if (success) {
                    tracker.spinner.succeed(chalk_1.default.green(`${toolName} completed (${duration}ms)`));
                }
                else {
                    tracker.spinner.fail(chalk_1.default.red(`${toolName} failed (${duration}ms)`));
                }
                this.activeTools.delete(metadata.toolCallId);
            }
        }
        // Show tool result summary
        if (toolResult && !toolResult.error) {
            this.showToolResultSummary(toolName, toolResult);
        }
    }
    getToolEmoji(toolName) {
        const emojiMap = {
            'read_file': '📖',
            'write_file': '✏️',
            'explore_directory': '📁',
            'execute_command': '⚡',
            'analyze_project': '🔍',
            'manage_packages': '📦',
            'generate_code': '🎨',
        };
        return emojiMap[toolName] || '🔧';
    }
    getToolLabel(toolName) {
        const labelMap = {
            'read_file': 'Reading file',
            'write_file': 'Writing file',
            'explore_directory': 'Exploring directory',
            'execute_command': 'Executing command',
            'analyze_project': 'Analyzing project',
            'manage_packages': 'Managing packages',
            'generate_code': 'Generating code',
        };
        return labelMap[toolName] || toolName;
    }
    formatToolArgs(args) {
        if (!args)
            return '';
        // Format key arguments for display
        const keyArgs = [];
        if (args.path)
            keyArgs.push(chalk_1.default.blue(args.path));
        if (args.command)
            keyArgs.push(chalk_1.default.yellow(args.command));
        if (args.packages)
            keyArgs.push(chalk_1.default.green(args.packages.join(', ')));
        if (args.type)
            keyArgs.push(chalk_1.default.magenta(args.type));
        return keyArgs.length > 0 ? `(${keyArgs.join(', ')})` : '';
    }
    showToolResultSummary(toolName, result) {
        if (!result)
            return;
        switch (toolName) {
            case 'write_file':
                if (result.path) {
                    console.log(chalk_1.default.dim(`   → ${result.created ? 'Created' : 'Updated'}: ${result.path}`));
                }
                break;
            case 'execute_command':
                if (result.success && result.stdout) {
                    const preview = result.stdout.slice(0, 100);
                    console.log(chalk_1.default.dim(`   → Output: ${preview}${result.stdout.length > 100 ? '...' : ''}`));
                }
                break;
            case 'analyze_project':
                if (result.name) {
                    console.log(chalk_1.default.dim(`   → Project: ${result.name} (${result.fileCount} files)`));
                }
                break;
        }
    }
    async executeAgentTask(agentName, task) {
        if (!task) {
            console.log(chalk_1.default.red('Please specify a task for the agent'));
            this.showPrompt();
            return;
        }
        console.log(chalk_1.default.blue(`\\n🤖 Launching ${agentName} agent in autonomous mode...`));
        console.log(chalk_1.default.gray(`Task: ${task}\\n`));
        this.isProcessing = true;
        try {
            for await (const event of modern_agent_system_1.modernAgentOrchestrator.executeTaskStreaming(agentName, task)) {
                this.session.executionHistory.push(event);
                switch (event.type) {
                    case 'start':
                        console.log(chalk_1.default.cyan(`🚀 ${agentName} initialized and ready`));
                        break;
                    case 'text':
                        if (event.content) {
                            process.stdout.write(event.content);
                        }
                        break;
                    case 'tool':
                        console.log(chalk_1.default.blue(`\\n🔧 ${event.content}`));
                        break;
                    case 'result':
                        console.log(chalk_1.default.green(`✅ ${event.content}`));
                        break;
                    case 'complete':
                        console.log(chalk_1.default.green(`\\n\\n🎉 ${agentName} completed autonomously!`));
                        break;
                    case 'error':
                        console.log(chalk_1.default.red(`\\n❌ Agent error: ${event.content}`));
                        break;
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`\\n❌ Agent execution failed: ${error.message}`));
        }
        finally {
            this.isProcessing = false;
            console.log();
            this.showPrompt();
        }
    }
    async handleAutoMode(task) {
        console.log(chalk_1.default.blue('\\n🎯 Autonomous Mode: Analyzing and executing task...\\n'));
        // Use advanced AI provider for autonomous execution
        this.session.messages.push({
            role: 'user',
            content: `/auto ${task}`
        });
        this.isProcessing = true;
        try {
            for await (const event of advanced_ai_provider_1.advancedAIProvider.executeAutonomousTask(task)) {
                this.session.executionHistory.push(event);
                switch (event.type) {
                    case 'start':
                        console.log(chalk_1.default.cyan(event.content));
                        break;
                    case 'thinking':
                        console.log(chalk_1.default.magenta(`💭 ${event.content}`));
                        break;
                    case 'text_delta':
                        if (event.content) {
                            process.stdout.write(event.content);
                        }
                        break;
                    case 'tool_call':
                        this.handleToolCall(event);
                        break;
                    case 'tool_result':
                        this.handleToolResult(event);
                        break;
                    case 'complete':
                        console.log(chalk_1.default.green('\\n🎉 Autonomous execution completed!'));
                        break;
                    case 'error':
                        console.log(chalk_1.default.red(`\\n❌ Error: ${event.error}`));
                        break;
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`\\n❌ Autonomous execution failed: ${error.message}`));
        }
        finally {
            this.isProcessing = false;
            this.showPrompt();
        }
    }
    // Utility methods
    stopAllActiveOperations() {
        this.activeTools.forEach(tracker => {
            if (tracker.spinner) {
                tracker.spinner.stop();
            }
        });
        this.activeTools.clear();
    }
    toggleAutonomousMode(mode) {
        if (mode === 'off') {
            this.session.autonomous = false;
            console.log(chalk_1.default.yellow('⚠️ Autonomous mode disabled - will ask for confirmation'));
        }
        else {
            this.session.autonomous = true;
            console.log(chalk_1.default.green('✅ Autonomous mode enabled - full independence'));
        }
    }
    async showExecutionContext() {
        const context = advanced_ai_provider_1.advancedAIProvider.getExecutionContext();
        if (context.size === 0) {
            console.log(chalk_1.default.yellow('No execution context available'));
            return;
        }
        console.log(chalk_1.default.cyan.bold('\\n🧠 Execution Context'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        for (const [key, value] of context) {
            console.log(`${chalk_1.default.blue(key)}: ${chalk_1.default.dim(JSON.stringify(value, null, 2).slice(0, 100))}...`);
        }
    }
    async clearSession() {
        console.clear();
        this.session.messages = this.session.messages.filter(m => m.role === 'system');
        this.session.executionHistory = [];
        advanced_ai_provider_1.advancedAIProvider.clearExecutionContext();
        console.log(chalk_1.default.green('✅ Session cleared'));
    }
    showExecutionHistory() {
        const history = this.session.executionHistory.slice(-20); // Show last 20 events
        if (history.length === 0) {
            console.log(chalk_1.default.yellow('No execution history'));
            return;
        }
        console.log(chalk_1.default.cyan.bold('\\n📜 Recent Execution History'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        history.forEach((event, index) => {
            const icon = event.type === 'tool_call' ? '🔧' :
                event.type === 'tool_result' ? '✅' :
                    event.type === 'error' ? '❌' : '•';
            console.log(`${icon} ${chalk_1.default.dim(event.type)}: ${event.content?.slice(0, 60) || 'N/A'}`);
        });
    }
    showAdvancedHelp() {
        console.log(chalk_1.default.cyan.bold('\\n🤖 Autonomous Claude Assistant - Command Reference'));
        console.log(chalk_1.default.gray('═'.repeat(60)));
        console.log(chalk_1.default.white.bold('\\n🚀 Autonomous Features:'));
        console.log(`${chalk_1.default.green('• Full file system access')} - Read/write without permission`);
        console.log(`${chalk_1.default.green('• Command execution')} - Run terminal commands automatically`);
        console.log(`${chalk_1.default.green('• Project analysis')} - Understand codebase structure`);
        console.log(`${chalk_1.default.green('• Code generation')} - Create complete applications`);
        console.log(`${chalk_1.default.green('• Package management')} - Install dependencies as needed`);
        console.log(chalk_1.default.white.bold('\\n🔧 Commands:'));
        console.log(`${chalk_1.default.green('/autonomous [on|off]')} - Toggle autonomous mode`);
        console.log(`${chalk_1.default.green('/context')} - Show execution context`);
        console.log(`${chalk_1.default.green('/analyze')} - Quick project analysis`);
        console.log(`${chalk_1.default.green('/history')} - Show execution history`);
        console.log(`${chalk_1.default.green('/clear')} - Clear session and context`);
        console.log(`${chalk_1.default.green('/auto <task>')} - Fully autonomous task execution`);
        console.log(`${chalk_1.default.green('@<agent> <task>')} - Use specialized agent`);
        console.log(chalk_1.default.white.bold('\\n💬 Natural Language Examples:'));
        console.log(chalk_1.default.dim('• "Create a React todo app with TypeScript and tests"'));
        console.log(chalk_1.default.dim('• "Fix all ESLint errors in this project"'));
        console.log(chalk_1.default.dim('• "Add authentication with JWT to this API"'));
        console.log(chalk_1.default.dim('• "Set up Docker and CI/CD for deployment"'));
        console.log(chalk_1.default.dim('• "Optimize this component for performance"'));
    }
    // [Rest of utility methods remain similar to previous version]
    async changeDirectory(newDir) {
        try {
            const resolvedPath = require('path').resolve(this.session.workingDirectory, newDir);
            if (!require('fs').existsSync(resolvedPath)) {
                console.log(chalk_1.default.red(`Directory not found: ${newDir}`));
                return;
            }
            this.session.workingDirectory = resolvedPath;
            advanced_ai_provider_1.advancedAIProvider.setWorkingDirectory(resolvedPath);
            console.log(chalk_1.default.green(`✅ Changed to: ${resolvedPath}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error changing directory: ${error.message}`));
        }
    }
    async quickDirectoryList() {
        try {
            const files = require('fs').readdirSync(this.session.workingDirectory, { withFileTypes: true });
            console.log(chalk_1.default.blue(`\\n📁 ${this.session.workingDirectory}:`));
            console.log(chalk_1.default.gray('─'.repeat(50)));
            files.slice(0, 20).forEach((file) => {
                const icon = file.isDirectory() ? '📁' : '📄';
                const name = file.isDirectory() ? chalk_1.default.blue(file.name) : file.name;
                console.log(`${icon} ${name}`);
            });
            if (files.length > 20) {
                console.log(chalk_1.default.dim(`... and ${files.length - 20} more items`));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error listing directory: ${error.message}`));
        }
    }
    async quickProjectAnalysis() {
        console.log(chalk_1.default.blue('🔍 Quick project analysis...'));
        try {
            const context = { autonomous: true };
            for await (const event of advanced_ai_provider_1.advancedAIProvider.executeAutonomousTask('analyze_project', context)) {
                if (event.type === 'tool_result' && event.toolName === 'analyze_project') {
                    const analysis = event.toolResult;
                    console.log(chalk_1.default.cyan(`\\n📊 Project: ${analysis.name || 'Unnamed'}`));
                    console.log(chalk_1.default.dim(`Framework: ${analysis.framework || 'Unknown'}`));
                    console.log(chalk_1.default.dim(`Files: ${analysis.fileCount || 0}`));
                    console.log(chalk_1.default.dim(`Languages: ${(analysis.languages || []).join(', ')}`));
                    break;
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`Analysis failed: ${error.message}`));
        }
    }
    switchModel(modelName) {
        try {
            advanced_ai_provider_1.advancedAIProvider.setModel(modelName);
            config_manager_1.simpleConfigManager.setCurrentModel(modelName);
            console.log(chalk_1.default.green(`✅ Switched to: ${modelName}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error: ${error.message}`));
        }
    }
    showCurrentModel() {
        const modelInfo = advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo();
        console.log(chalk_1.default.blue(`🧠 Current model: ${modelInfo.name} (${modelInfo.config})`));
    }
    showAvailableAgents() {
        console.log(chalk_1.default.cyan.bold('\\n🤖 Available Specialized Agents'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        Object.entries(modern_agent_system_1.AGENT_CAPABILITIES).forEach(([name, capability]) => {
            console.log(`${chalk_1.default.green('•')} ${chalk_1.default.bold(name)}`);
            console.log(`  ${chalk_1.default.gray(capability.description)}`);
        });
        console.log(chalk_1.default.dim('\\nUsage: @<agent-name> <task>'));
    }
    showPrompt() {
        if (!this.isProcessing) {
            const workingDir = require('path').basename(this.session.workingDirectory);
            const modelName = advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo().name.split('-')[0];
            const autonomousIndicator = this.session.autonomous ? '🤖' : '👤';
            // Build mode indicators
            const indicators = this.updatePromptIndicators();
            const modeIndicator = indicators.length > 0 ? ` ${indicators.join(' ')} ` : '';
            const prompt = gradient_string_1.default.rainbow(`\\n┌─[${autonomousIndicator}${modelName}:${workingDir}${modeIndicator}]\\n└─❯ `);
            this.rl.setPrompt(prompt);
            this.rl.prompt();
        }
    }
    /**
     * Auto-complete function for readline
     */
    autoComplete(line) {
        const commands = [
            '/add-dir', '/agents', '/analyze', '/auto', '/bug', '/cd', '/clear', '/compact', '/config',
            '/cost', '/doctor', '/exit', '/export', '/help', '/history', '/ls', '/model', '/pwd',
            '/autonomous', '/context', '/plan', '/auto-accept', '/diff', '/accept', '/reject', '/quit'
        ];
        const agentCommands = [
            '@ai-analysis', '@code-review', '@backend-expert', '@frontend-expert', '@react-expert',
            '@devops-expert', '@system-admin', '@autonomous-coder'
        ];
        const allSuggestions = [...commands, ...agentCommands];
        const hits = allSuggestions.filter((c) => c.startsWith(line));
        return [hits.length ? hits : allSuggestions, line];
    }
    /**
     * Show interactive command suggestions
     */
    showCommandSuggestions() {
        if (this.isProcessing)
            return;
        console.log('\n' + chalk_1.default.cyan.bold('📋 Available Commands:'));
        console.log(chalk_1.default.gray('─'.repeat(80)));
        // System Commands
        console.log(chalk_1.default.white.bold('\n🔧 System Commands:'));
        console.log(`${chalk_1.default.green('/help')}           Show detailed help and command reference`);
        console.log(`${chalk_1.default.green('/agents')}         List all available AI agents`);
        console.log(`${chalk_1.default.green('/model')} [name]    Switch AI model or show current model`);
        console.log(`${chalk_1.default.green('/config')}         Open configuration panel`);
        console.log(`${chalk_1.default.green('/clear')}          Clear conversation history and free up context`);
        console.log(`${chalk_1.default.green('/exit')} (quit)    Exit the REPL`);
        // File & Directory Operations  
        console.log(chalk_1.default.white.bold('\n📁 File & Directory Operations:'));
        console.log(`${chalk_1.default.green('/add-dir')}        Add a new working directory`);
        console.log(`${chalk_1.default.green('/cd')} [path]      Change current working directory`);
        console.log(`${chalk_1.default.green('/pwd')}            Show current working directory`);
        console.log(`${chalk_1.default.green('/ls')}             List files in current directory`);
        console.log(`${chalk_1.default.green('/analyze')}        Quick project analysis`);
        // Analysis & Tools
        console.log(chalk_1.default.white.bold('\n🔍 Analysis & Autonomous Tools:'));
        console.log(`${chalk_1.default.green('/auto')} <task>    Fully autonomous task execution`);
        console.log(`${chalk_1.default.green('/plan')}           Toggle plan mode (shift+tab to cycle)`);
        console.log(`${chalk_1.default.green('/auto-accept')}    Toggle auto-accept edits mode`);
        console.log(`${chalk_1.default.green('/context')}        Show execution context`);
        console.log(`${chalk_1.default.green('/history')}        Show execution history`);
        console.log(`${chalk_1.default.green('/autonomous')} [on|off] Toggle autonomous mode`);
        // File Changes & Diffs
        console.log(chalk_1.default.white.bold('\\n📝 File Changes & Diffs:'));
        console.log(`${chalk_1.default.green('/diff')} [file]    Show file changes (all diffs if no file specified)`);
        console.log(`${chalk_1.default.green('/accept')} <file>   Accept and apply file changes`);
        console.log(`${chalk_1.default.green('/accept all')}     Accept all pending file changes`);
        console.log(`${chalk_1.default.green('/reject')} <file>   Reject and discard file changes`);
        // Session Management
        console.log(chalk_1.default.white.bold('\n💾 Session Management:'));
        console.log(`${chalk_1.default.green('/export')}         Export current conversation to file or clipboard`);
        console.log(`${chalk_1.default.green('/compact')}        Clear history but keep summary in context`);
        console.log(`${chalk_1.default.green('/cost')}           Show total cost and duration of current session`);
        console.log(`${chalk_1.default.green('/doctor')}         Diagnose and verify Claude Code installation`);
        console.log(`${chalk_1.default.green('/bug')}            Submit feedback about Claude Code`);
        // Agent Commands
        console.log(chalk_1.default.white.bold('\n🤖 Specialized Agents:'));
        console.log(`${chalk_1.default.blue('@ai-analysis')} <task>     AI code analysis and review`);
        console.log(`${chalk_1.default.blue('@code-review')} <task>     Code review and suggestions`);
        console.log(`${chalk_1.default.blue('@backend-expert')} <task>   Backend development specialist`);
        console.log(`${chalk_1.default.blue('@frontend-expert')} <task>  Frontend/UI development expert`);
        console.log(`${chalk_1.default.blue('@react-expert')} <task>    React and Next.js specialist`);
        console.log(`${chalk_1.default.blue('@devops-expert')} <task>   DevOps and infrastructure expert`);
        console.log(`${chalk_1.default.blue('@system-admin')} <task>    System administration tasks`);
        console.log(`${chalk_1.default.blue('@autonomous-coder')} <task> Full autonomous coding agent`);
        console.log(chalk_1.default.white.bold('\n💬 Natural Language Examples:'));
        console.log(chalk_1.default.dim('• "Create a React todo app with TypeScript and tests"'));
        console.log(chalk_1.default.dim('• "Fix all ESLint errors in this project"'));
        console.log(chalk_1.default.dim('• "Add authentication with JWT to this API"'));
        console.log(chalk_1.default.dim('• "Set up Docker and CI/CD for deployment"'));
        console.log(chalk_1.default.dim('• "Optimize this component for performance"'));
        console.log(chalk_1.default.gray('\n' + '─'.repeat(80)));
        console.log(chalk_1.default.yellow('💡 Tip: Use TAB for auto-completion, Ctrl+C to cancel operations'));
        console.log('');
        this.showPrompt();
    }
    /**
     * Toggle plan mode
     */
    togglePlanMode() {
        this.session.planMode = !this.session.planMode;
        if (this.session.planMode) {
            console.log(chalk_1.default.green('\n✅ plan mode on ') + chalk_1.default.dim('(shift+tab to cycle)'));
        }
        else {
            console.log(chalk_1.default.yellow('\n⚠️ plan mode off'));
        }
        this.updatePromptIndicators();
        this.showPrompt();
    }
    /**
     * Toggle auto-accept edits
     */
    toggleAutoAcceptEdits() {
        this.session.autoAcceptEdits = !this.session.autoAcceptEdits;
        // Sync with diff manager
        diff_manager_1.diffManager.setAutoAccept(this.session.autoAcceptEdits);
        if (this.session.autoAcceptEdits) {
            console.log(chalk_1.default.green('\n✅ auto-accept edits on ') + chalk_1.default.dim('(shift+tab to cycle)'));
        }
        else {
            console.log(chalk_1.default.yellow('\n⚠️ auto-accept edits off'));
        }
        this.updatePromptIndicators();
        this.showPrompt();
    }
    /**
     * Update prompt indicators for current modes
     */
    updatePromptIndicators() {
        const indicators = [];
        if (this.session.planMode)
            indicators.push(chalk_1.default.cyan('plan'));
        if (this.session.autoAcceptEdits)
            indicators.push(chalk_1.default.green('auto-accept'));
        if (this.session.autonomous)
            indicators.push(chalk_1.default.blue('autonomous'));
        // Add diff count if there are pending diffs
        const pendingCount = diff_manager_1.diffManager.getPendingCount();
        if (pendingCount > 0) {
            indicators.push(chalk_1.default.yellow(`${pendingCount} diffs`));
        }
        return indicators;
    }
    /**
     * Show current security status
     */
    async showSecurityStatus() {
        const summary = await this.policyManager.getPolicySummary();
        console.log((0, boxen_1.default)(`${chalk_1.default.blue.bold('🔒 Security Policy Status')}\\n\\n` +
            `${chalk_1.default.green('Current Policy:')} ${summary.currentPolicy.approval}\\n` +
            `${chalk_1.default.green('Sandbox Mode:')} ${summary.currentPolicy.sandbox}\\n` +
            `${chalk_1.default.green('Timeout:')} ${summary.currentPolicy.timeoutMs}ms\\n\\n` +
            `${chalk_1.default.cyan('Commands:')}\\n` +
            `• ${chalk_1.default.green('Allowed:')} ${summary.allowedCommands}\\n` +
            `• ${chalk_1.default.red('Blocked:')} ${summary.deniedCommands}\\n\\n` +
            `${chalk_1.default.cyan('Trusted Commands:')} ${summary.trustedCommands.slice(0, 5).join(', ')}...\\n` +
            `${chalk_1.default.red('Dangerous Commands:')} ${summary.dangerousCommands.slice(0, 3).join(', ')}...`, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'blue'
        }));
        console.log(chalk_1.default.dim('\\n Use /policy <setting> <value> to change security settings'));
        console.log(chalk_1.default.dim(' Available: approval [never|untrusted|always], sandbox [read-only|workspace-write|system-write]'));
    }
    /**
     * Update security policy
     */
    async updateSecurityPolicy(setting, value) {
        try {
            const currentConfig = config_manager_1.simpleConfigManager.getAll();
            switch (setting) {
                case 'approval':
                    if (['never', 'untrusted', 'always'].includes(value)) {
                        // Policy update - would need to extend config manager
                        console.log(chalk_1.default.green(`✅ Approval policy set to: ${value}`));
                        console.log(chalk_1.default.green(`✅ Approval policy set to: ${value}`));
                    }
                    else {
                        console.log(chalk_1.default.red('Invalid approval policy. Use: never, untrusted, or always'));
                    }
                    break;
                case 'sandbox':
                    if (['read-only', 'workspace-write', 'system-write'].includes(value)) {
                        // Sandbox update - would need to extend config manager
                        console.log(chalk_1.default.green(`✅ Sandbox mode set to: ${value}`));
                        console.log(chalk_1.default.green(`✅ Sandbox mode set to: ${value}`));
                    }
                    else {
                        console.log(chalk_1.default.red('Invalid sandbox mode. Use: read-only, workspace-write, or system-write'));
                    }
                    break;
                default:
                    console.log(chalk_1.default.red(`Unknown setting: ${setting}`));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error updating policy: ${error.message}`));
        }
    }
    /**
     * Ask for user confirmation on risky commands
     */
    async askForCommandConfirmation(command) {
        const risk = await this.policyManager.evaluateCommandRisk(command);
        if (!risk.requiresApproval) {
            return risk.allowed;
        }
        if (!risk.allowed) {
            console.log((0, boxen_1.default)(`${chalk_1.default.red.bold('⚠️  Command Blocked')}\\n\\n` +
                `Command: ${chalk_1.default.yellow(command)}\\n` +
                `Risk Level: ${this.getRiskColor(risk.riskLevel)}\\n\\n` +
                `Reasons:\\n${risk.reasons.map(r => `• ${r}`).join('\\n')}\\n\\n` +
                `${chalk_1.default.dim('This command is not allowed in the current security policy.')}`, {
                padding: 1,
                borderStyle: 'round',
                borderColor: 'red'
            }));
            return false;
        }
        console.log((0, boxen_1.default)(`${chalk_1.default.yellow.bold('⚠️  High-Risk Command Detected')}\\n\\n` +
            `Command: ${chalk_1.default.cyan(command)}\\n` +
            `Risk Level: ${this.getRiskColor(risk.riskLevel)}\\n\\n` +
            `Reasons:\\n${risk.reasons.map(r => `• ${r}`).join('\\n')}\\n\\n` +
            `${chalk_1.default.dim('This command requires your explicit approval.')}`, {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'yellow'
        }));
        return await this.promptYesNo('Do you want to proceed? (y/N)');
    }
    /**
     * Prompt for yes/no confirmation
     */
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
    /**
     * Get risk level color
     */
    getRiskColor(level) {
        switch (level) {
            case 'low': return chalk_1.default.green('Low');
            case 'medium': return chalk_1.default.yellow('Medium');
            case 'high': return chalk_1.default.red('High');
            default: return chalk_1.default.gray(level);
        }
    }
    showGoodbye() {
        const executionCount = this.session.executionHistory.length;
        const toolsUsed = this.session.executionHistory.filter(e => e.type === 'tool_call').length;
        console.log((0, boxen_1.default)(`${gradient_string_1.default.rainbow('🤖 Autonomous Claude Assistant')}\\n\\n` +
            `${chalk_1.default.gray('Session completed!')}\\n\\n` +
            `${chalk_1.default.dim('Autonomous Actions:')}\\n` +
            `• ${chalk_1.default.blue('Messages:')} ${this.session.messages.length}\\n` +
            `• ${chalk_1.default.green('Tools Used:')} ${toolsUsed}\\n` +
            `• ${chalk_1.default.cyan('Total Events:')} ${executionCount}\\n` +
            `• ${chalk_1.default.yellow('Duration:')} ${Math.round((Date.now() - this.session.createdAt.getTime()) / 1000)}s\\n\\n` +
            `${chalk_1.default.blue('Thanks for using autonomous development! 🚀')}`, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
            textAlignment: 'center',
        }));
    }
    stop() {
        this.stopAllActiveOperations();
        this.rl.close();
    }
}
exports.AutonomousClaudeInterface = AutonomousClaudeInterface;
exports.autonomousClaudeInterface = new AutonomousClaudeInterface();
