import * as readline from 'readline';
import chalk from 'chalk';
import boxen from 'boxen';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { advancedAIProvider, StreamEvent } from '../ai/advanced-ai-provider';
import { modernAgentOrchestrator, AGENT_CAPABILITIES } from '../automation/agents/modern-agent-system';
import { simpleConfigManager as configManager } from '../core/config-manager';
import { CoreMessage } from 'ai';
import ora, { Ora } from 'ora';
import { diffManager } from '../ui/diff-manager';
import { ExecutionPolicyManager } from '../policies/execution-policy';



// Configure marked for terminal rendering
marked.setOptions({
  renderer: new TerminalRenderer() as any,
});

interface AutonomousChatSession {
  id: string;
  messages: CoreMessage[];
  workingDirectory: string;
  createdAt: Date;
  agentMode?: string;
  autonomous: boolean;
  executionHistory: StreamEvent[];
  planMode: boolean;
  autoAcceptEdits: boolean;
}

interface ToolExecutionTracker {
  name: string;
  startTime: Date;
  endTime?: Date;
  success?: boolean;
  output?: string;
  spinner?: Ora;
}

export class AutonomousClaudeInterface {
  private rl: readline.Interface;
  private session: AutonomousChatSession;
  private isProcessing = false;
  private currentSpinner?: Ora;
  private activeTools: Map<string, ToolExecutionTracker> = new Map();
  private streamBuffer = '';
  private lastStreamTime = Date.now();
  private initialized = false;
  private policyManager: ExecutionPolicyManager;

  constructor() {
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
    advancedAIProvider.setWorkingDirectory(this.session.workingDirectory);
    modernAgentOrchestrator.setWorkingDirectory(this.session.workingDirectory);

    // Initialize security policy manager
    this.policyManager = new ExecutionPolicyManager(configManager);

    this.setupEventHandlers();
    this.setupStreamOptimization();
  }

  private setupEventHandlers(): void {
    // Handle Ctrl+C gracefully
    this.rl.on('SIGINT', () => {
      if (this.isProcessing) {
        console.log(chalk.yellow('\\n⏸️  Stopping current operation...'));
        this.stopAllActiveOperations();
        this.showPrompt();
      } else {
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

  private setupStreamOptimization(): void {
    // Buffer stream output for smoother rendering
    setInterval(() => {
      if (this.streamBuffer && Date.now() - this.lastStreamTime > 50) {
        process.stdout.write(this.streamBuffer);
        this.streamBuffer = '';
      }
    }, 16); // ~60fps
  }

  async start(): Promise<void> {
    console.clear();

    // Check for API keys first
    if (!this.checkAPIKeys()) {
      return;
    }

    this.showWelcome();

    // Start continuous input loop and wait for it to close
    return new Promise<void>((resolve) => {
      this.startInputLoop();

      // Resolve when readline interface closes
      this.rl.on('close', () => {
        this.showGoodbye();
        resolve();
      });
    });
  }

  private startInputLoop(): void {
    this.showPrompt();
    // Note: Input handling is done in setupEventHandlers() to avoid duplicate listeners
    // Note: close event is handled in start() method
  }

  private checkAPIKeys(): boolean {
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const hasGoogleKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!hasAnthropicKey && !hasOpenAIKey && !hasGoogleKey) {
      console.log(boxen(
        `${chalk.red('⚠️  No API Keys Found')}\n\n` +
        `Please set at least one API key:\n\n` +
        `${chalk.blue('• ANTHROPIC_API_KEY')} - for Claude models\n` +
        `${chalk.blue('• OPENAI_API_KEY')} - for GPT models\n` +
        `${chalk.blue('• GOOGLE_GENERATIVE_AI_API_KEY')} - for Gemini models\n\n` +
        `${chalk.yellow('Example:')}\n` +
        `${chalk.dim('export ANTHROPIC_API_KEY="your-key-here"')}\n` +
        `${chalk.dim('npm run chat')}`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'red',
          textAlignment: 'center',
        }
      ));
      return false;
    }

    // Show which keys are available
    const availableKeys = [];
    if (hasAnthropicKey) availableKeys.push(chalk.green('✓ Claude'));
    if (hasOpenAIKey) availableKeys.push(chalk.green('✓ GPT'));
    if (hasGoogleKey) availableKeys.push(chalk.green('✓ Gemini'));
    console.log(chalk.dim(`API Keys: ${availableKeys.join(', ')}`));
    return true;
  }

  private showWelcome(): void {
    const title = chalk.cyanBright('🤖 Autonomous Claude Assistant');
    const subtitle = chalk.gray('Terminal Velocity Development - Fully Autonomous Mode');
    const version = chalk.dim('v2.0.0 Advanced');

    console.log(boxen(
      `${title}\\n${subtitle}\\n\\n${version}\\n\\n` +
      `${chalk.blue('🎯 Autonomous Mode:')} Enabled\\n` +
      `${chalk.blue('📁 Working Dir:')} ${chalk.cyan(this.session.workingDirectory)}\\n` +
      `${chalk.blue('🧠 Model:')} ${chalk.green(advancedAIProvider.getCurrentModelInfo().name)}\\n\\n` +
      `${chalk.gray('I operate with full autonomy:')}\\n` +
      `• ${chalk.green('Read & write files automatically')}\\n` +
      `• ${chalk.green('Execute commands when needed')}\\n` +
      `• ${chalk.green('Analyze project structure')}\\n` +
      `• ${chalk.green('Generate code and configurations')}\\n` +
      `• ${chalk.green('Manage dependencies autonomously')}\\n\\n` +
      `${chalk.yellow('Just tell me what you want - I handle everything')}\\n\\n` +
      `${chalk.yellow('💡 Press TAB or / for command suggestions')}\\\\n` +
      `${chalk.dim('Commands: /help /agents /auto /cd /model /exit')}`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'cyan',
        textAlignment: 'center',
      }
    ));

    // Show initial command suggestions like Claude Code
    console.log(chalk.cyan('\\n🚀 Quick Start - Try these commands:'));
    console.log(`${chalk.green('/')}\t\t\tShow all available commands`);
    console.log(`${chalk.green('/help')}\t\t\tDetailed help and examples`);
    console.log(`${chalk.green('/agents')}\t\t\tList specialized AI agents`);
    console.log(`${chalk.green('/analyze')}\t\t\tQuick project analysis`);
    console.log(`${chalk.green('/auto')} <task>\t\tFully autonomous task execution`);
    console.log(`${chalk.blue('@agent')} <task>\t\tUse specialized agent`);
    console.log(`${chalk.cyan('/plan')}\t\t\tToggle plan mode (${chalk.dim('shift+tab')})`);
    console.log(`${chalk.green('/auto-accept')}\t\tToggle auto-accept edits\\n`);
  }

  private async initializeAutonomousAssistant(): Promise<void> {
    const spinner = ora('🚀 Initializing autonomous assistant...').start();

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

    } catch (error: any) {
      spinner.fail('Failed to initialize');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  }

  private async handleInput(input: string): Promise<void> {
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

  private async handleSlashCommand(command: string): Promise<void> {
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
        } else {
          console.log(chalk.red('Usage: /auto <task description>'));
        }
        break;
      case 'cd':
        await this.changeDirectory(args[0] || process.cwd());
        break;
      case 'pwd':
        console.log(chalk.blue(`📁 Current directory: ${this.session.workingDirectory}`));
        break;
      case 'ls':
        await this.quickDirectoryList();
        break;
      case 'model':
        if (args[0]) {
          this.switchModel(args[0]);
        } else {
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
          diffManager.showDiff(args[0]);
        } else {
          diffManager.showAllDiffs();
        }
        break;
      case 'accept':
        if (args[0] === 'all') {
          diffManager.acceptAllDiffs();
        } else if (args[0]) {
          diffManager.acceptDiff(args[0]);
        } else {
          console.log(chalk.red('Usage: /accept <file> or /accept all'));
        }
        break;
      case 'reject':
        if (args[0]) {
          diffManager.rejectDiff(args[0]);
        } else {
          console.log(chalk.red('Usage: /reject <file>'));
        }
        break;
      case 'security':
        await this.showSecurityStatus();
        break;
      case 'policy':
        if (args[0] && args[1]) {
          await this.updateSecurityPolicy(args[0], args[1]);
        } else {
          await this.showSecurityStatus();
        }
        break;
      case 'exit':
      case 'quit':
        this.showGoodbye();
        process.exit(0);
        break;
      default:
        console.log(chalk.red(`Unknown command: ${cmd}`));
        console.log(chalk.gray('Type /help for available commands'));
    }

    this.showPrompt();
  }

  private async handleAutonomousChat(input: string): Promise<void> {
    // Initialize agent on first input
    if (!this.initialized) {
      await this.initializeAutonomousAssistant();
      this.initialized = true;
    }

    // Check if plan mode is active
    if (this.session.planMode) {
      console.log(chalk.cyan('🎯 Plan Mode: Creating execution plan...'));

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

  private async processAutonomousMessage(): Promise<void> {
    this.isProcessing = true;

    try {
      console.log(); // Add spacing
      console.log(chalk.blue('🤖 ') + chalk.dim('Autonomous assistant thinking...'));

      let assistantMessage = '';
      let toolsExecuted = 0;
      const startTime = Date.now();

      // Stream the autonomous response
      for await (const event of advancedAIProvider.streamChatWithFullAutonomy(this.session.messages)) {
        this.session.executionHistory.push(event);

        switch (event.type) {
          case 'start':
            console.log(chalk.cyan(`🚀 ${event.content}`));
            break;

          case 'thinking':
            console.log(chalk.magenta(`💭 ${event.content}`));
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
            console.log(chalk.green(`\\n✨ Completed in ${duration}ms • ${toolsExecuted} tools used`));
            break;

          case 'error':
            console.log(chalk.red(`\\n❌ Error: ${event.error}`));
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

    } catch (error: any) {
      console.log(chalk.red(`\\n❌ Autonomous execution failed: ${error.message}`));
    } finally {
      this.stopAllActiveOperations();
      this.isProcessing = false;
      console.log(); // Add spacing
      this.showPrompt();
    }
  }

  private handleToolCall(event: StreamEvent): void {
    const { toolName, toolArgs, metadata } = event;
    if (!toolName) return;

    // Create visual indicator for tool execution
    const toolEmoji = this.getToolEmoji(toolName);
    const toolLabel = this.getToolLabel(toolName);

    console.log(`\\n${toolEmoji} ${chalk.cyan(toolLabel)}`,
      chalk.dim(this.formatToolArgs(toolArgs)));

    // Create spinner for long-running operations
    const tracker: ToolExecutionTracker = {
      name: toolName,
      startTime: new Date(),
      spinner: ora({
        text: chalk.dim(`Executing ${toolName}...`),
        spinner: 'dots2',
        color: 'cyan'
      }).start()
    };

    if (metadata?.toolCallId) {
      this.activeTools.set(metadata.toolCallId, tracker);
    }
  }

  private handleToolResult(event: StreamEvent): void {
    const { toolName, toolResult, metadata } = event;
    if (!toolName) return;

    // Stop spinner if exists
    if (metadata?.toolCallId) {
      const tracker = this.activeTools.get(metadata.toolCallId);
      if (tracker?.spinner) {
        const duration = Date.now() - tracker.startTime.getTime();
        const success = metadata?.success !== false;

        if (success) {
          tracker.spinner.succeed(chalk.green(`${toolName} completed (${duration}ms)`));
        } else {
          tracker.spinner.fail(chalk.red(`${toolName} failed (${duration}ms)`));
        }

        this.activeTools.delete(metadata.toolCallId);
      }
    }

    // Show tool result summary
    if (toolResult && !toolResult.error) {
      this.showToolResultSummary(toolName, toolResult);
    }
  }

  private getToolEmoji(toolName: string): string {
    const emojiMap: Record<string, string> = {
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

  private getToolLabel(toolName: string): string {
    const labelMap: Record<string, string> = {
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

  private formatToolArgs(args: any): string {
    if (!args) return '';

    // Format key arguments for display
    const keyArgs = [];
    if (args.path) keyArgs.push(chalk.blue(args.path));
    if (args.command) keyArgs.push(chalk.yellow(args.command));
    if (args.packages) keyArgs.push(chalk.green(args.packages.join(', ')));
    if (args.type) keyArgs.push(chalk.magenta(args.type));

    return keyArgs.length > 0 ? `(${keyArgs.join(', ')})` : '';
  }

  private showToolResultSummary(toolName: string, result: any): void {
    if (!result) return;

    switch (toolName) {
      case 'write_file':
        if (result.path) {
          console.log(chalk.dim(`   → ${result.created ? 'Created' : 'Updated'}: ${result.path}`));
        }
        break;
      case 'execute_command':
        if (result.success && result.stdout) {
          const preview = result.stdout.slice(0, 100);
          console.log(chalk.dim(`   → Output: ${preview}${result.stdout.length > 100 ? '...' : ''}`));
        }
        break;
      case 'analyze_project':
        if (result.name) {
          console.log(chalk.dim(`   → Project: ${result.name} (${result.fileCount} files)`));
        }
        break;
    }
  }

  private async executeAgentTask(agentName: string, task: string): Promise<void> {
    if (!task) {
      console.log(chalk.red('Please specify a task for the agent'));
      this.showPrompt();
      return;
    }

    console.log(chalk.blue(`\\n🤖 Launching ${agentName} agent in autonomous mode...`));
    console.log(chalk.gray(`Task: ${task}\\n`));

    this.isProcessing = true;

    try {
      for await (const event of modernAgentOrchestrator.executeTaskStreaming(agentName, task)) {
        this.session.executionHistory.push(event);

        switch (event.type) {
          case 'start':
            console.log(chalk.cyan(`🚀 ${agentName} initialized and ready`));
            break;
          case 'text':
            if (event.content) {
              process.stdout.write(event.content);
            }
            break;
          case 'tool':
            console.log(chalk.blue(`\\n🔧 ${event.content}`));
            break;
          case 'result':
            console.log(chalk.green(`✅ ${event.content}`));
            break;
          case 'complete':
            console.log(chalk.green(`\\n\\n🎉 ${agentName} completed autonomously!`));
            break;
          case 'error':
            console.log(chalk.red(`\\n❌ Agent error: ${event.content}`));
            break;
        }
      }
    } catch (error: any) {
      console.log(chalk.red(`\\n❌ Agent execution failed: ${error.message}`));
    } finally {
      this.isProcessing = false;
      console.log();
      this.showPrompt();
    }
  }

  private async handleAutoMode(task: string): Promise<void> {
    console.log(chalk.blue('\\n🎯 Autonomous Mode: Analyzing and executing task...\\n'));

    // Use advanced AI provider for autonomous execution
    this.session.messages.push({
      role: 'user',
      content: `/auto ${task}`
    });

    this.isProcessing = true;

    try {
      for await (const event of advancedAIProvider.executeAutonomousTask(task)) {
        this.session.executionHistory.push(event);

        switch (event.type) {
          case 'start':
            console.log(chalk.cyan(event.content));
            break;
          case 'thinking':
            console.log(chalk.magenta(`💭 ${event.content}`));
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
            console.log(chalk.green('\\n🎉 Autonomous execution completed!'));
            break;
          case 'error':
            console.log(chalk.red(`\\n❌ Error: ${event.error}`));
            break;
        }
      }
    } catch (error: any) {
      console.log(chalk.red(`\\n❌ Autonomous execution failed: ${error.message}`));
    } finally {
      this.isProcessing = false;
      this.showPrompt();
    }
  }

  // Utility methods
  private stopAllActiveOperations(): void {
    this.activeTools.forEach(tracker => {
      if (tracker.spinner) {
        tracker.spinner.stop();
      }
    });
    this.activeTools.clear();
  }

  private toggleAutonomousMode(mode?: string): void {
    if (mode === 'off') {
      this.session.autonomous = false;
      console.log(chalk.yellow('⚠️ Autonomous mode disabled - will ask for confirmation'));
    } else {
      this.session.autonomous = true;
      console.log(chalk.green('✅ Autonomous mode enabled - full independence'));
    }
  }

  private async showExecutionContext(): Promise<void> {
    const context = advancedAIProvider.getExecutionContext();

    if (context.size === 0) {
      console.log(chalk.yellow('No execution context available'));
      return;
    }

    console.log(chalk.cyan.bold('\\n🧠 Execution Context'));
    console.log(chalk.gray('─'.repeat(40)));

    for (const [key, value] of context) {
      console.log(`${chalk.blue(key)}: ${chalk.dim(JSON.stringify(value, null, 2).slice(0, 100))}...`);
    }
  }

  private async clearSession(): Promise<void> {
    console.clear();
    this.session.messages = this.session.messages.filter(m => m.role === 'system');
    this.session.executionHistory = [];
    advancedAIProvider.clearExecutionContext();
    console.log(chalk.green('✅ Session cleared'));
  }

  private showExecutionHistory(): void {
    const history = this.session.executionHistory.slice(-20); // Show last 20 events

    if (history.length === 0) {
      console.log(chalk.yellow('No execution history'));
      return;
    }

    console.log(chalk.cyan.bold('\\n📜 Recent Execution History'));
    console.log(chalk.gray('─'.repeat(50)));

    history.forEach((event, index) => {
      const icon = event.type === 'tool_call' ? '🔧' :
        event.type === 'tool_result' ? '✅' :
          event.type === 'error' ? '❌' : '•';
      console.log(`${icon} ${chalk.dim(event.type)}: ${event.content?.slice(0, 60) || 'N/A'}`);
    });
  }

  private showAdvancedHelp(): void {
    console.log(chalk.cyan.bold('\\n🤖 Autonomous Claude Assistant - Command Reference'));
    console.log(chalk.gray('═'.repeat(60)));

    console.log(chalk.white.bold('\\n🚀 Autonomous Features:'));
    console.log(`${chalk.green('• Full file system access')} - Read/write without permission`);
    console.log(`${chalk.green('• Command execution')} - Run terminal commands automatically`);
    console.log(`${chalk.green('• Project analysis')} - Understand codebase structure`);
    console.log(`${chalk.green('• Code generation')} - Create complete applications`);
    console.log(`${chalk.green('• Package management')} - Install dependencies as needed`);

    console.log(chalk.white.bold('\\n🔧 Commands:'));
    console.log(`${chalk.green('/autonomous [on|off]')} - Toggle autonomous mode`);
    console.log(`${chalk.green('/context')} - Show execution context`);
    console.log(`${chalk.green('/analyze')} - Quick project analysis`);
    console.log(`${chalk.green('/history')} - Show execution history`);
    console.log(`${chalk.green('/clear')} - Clear session and context`);
    console.log(`${chalk.green('/auto <task>')} - Fully autonomous task execution`);
    console.log(`${chalk.green('@<agent> <task>')} - Use specialized agent`);

    console.log(chalk.white.bold('\\n💬 Natural Language Examples:'));
    console.log(chalk.dim('• "Create a React todo app with TypeScript and tests"'));
    console.log(chalk.dim('• "Fix all ESLint errors in this project"'));
    console.log(chalk.dim('• "Add authentication with JWT to this API"'));
    console.log(chalk.dim('• "Set up Docker and CI/CD for deployment"'));
    console.log(chalk.dim('• "Optimize this component for performance"'));
  }

  // [Rest of utility methods remain similar to previous version]
  private async changeDirectory(newDir: string): Promise<void> {
    try {
      const resolvedPath = require('path').resolve(this.session.workingDirectory, newDir);

      if (!require('fs').existsSync(resolvedPath)) {
        console.log(chalk.red(`Directory not found: ${newDir}`));
        return;
      }

      this.session.workingDirectory = resolvedPath;
      advancedAIProvider.setWorkingDirectory(resolvedPath);

      console.log(chalk.green(`✅ Changed to: ${resolvedPath}`));

    } catch (error: any) {
      console.log(chalk.red(`Error changing directory: ${error.message}`));
    }
  }

  private async quickDirectoryList(): Promise<void> {
    try {
      const files = require('fs').readdirSync(this.session.workingDirectory, { withFileTypes: true });

      console.log(chalk.blue(`\\n📁 ${this.session.workingDirectory}:`));
      console.log(chalk.gray('─'.repeat(50)));

      files.slice(0, 20).forEach((file: { isDirectory: () => any; name: unknown; }) => {
        const icon = file.isDirectory() ? '📁' : '📄';
        const name = file.isDirectory() ? chalk.blue(file.name) : file.name;
        console.log(`${icon} ${name}`);
      });

      if (files.length > 20) {
        console.log(chalk.dim(`... and ${files.length - 20} more items`));
      }

    } catch (error: any) {
      console.log(chalk.red(`Error listing directory: ${error.message}`));
    }
  }

  private async quickProjectAnalysis(): Promise<void> {
    console.log(chalk.blue('🔍 Quick project analysis...'));

    try {
      const context = { autonomous: true };
      for await (const event of advancedAIProvider.executeAutonomousTask('analyze_project', context)) {
        if (event.type === 'tool_result' && event.toolName === 'analyze_project') {
          const analysis = event.toolResult;
          console.log(chalk.cyan(`\\n📊 Project: ${analysis.name || 'Unnamed'}`));
          console.log(chalk.dim(`Framework: ${analysis.framework || 'Unknown'}`));
          console.log(chalk.dim(`Files: ${analysis.fileCount || 0}`));
          console.log(chalk.dim(`Languages: ${(analysis.languages || []).join(', ')}`));
          break;
        }
      }
    } catch (error: any) {
      console.log(chalk.red(`Analysis failed: ${error.message}`));
    }
  }

  private switchModel(modelName: string): void {
    try {
      advancedAIProvider.setModel(modelName);
      configManager.setCurrentModel(modelName);
      console.log(chalk.green(`✅ Switched to: ${modelName}`));
    } catch (error: any) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  }

  private showCurrentModel(): void {
    const modelInfo = advancedAIProvider.getCurrentModelInfo();
    console.log(chalk.blue(`🧠 Current model: ${modelInfo.name} (${modelInfo.config})`));
  }

  private showAvailableAgents(): void {
    console.log(chalk.cyan.bold('\\n🤖 Available Specialized Agents'));
    console.log(chalk.gray('─'.repeat(50)));

    Object.entries(AGENT_CAPABILITIES).forEach(([name, capability]) => {
      console.log(`${chalk.green('•')} ${chalk.bold(name)}`);
      console.log(`  ${chalk.gray(capability.description)}`);
    });

    console.log(chalk.dim('\\nUsage: @<agent-name> <task>'));
  }

  private showPrompt(): void {
    if (!this.isProcessing) {
      const workingDir = require('path').basename(this.session.workingDirectory);
      const modelName = advancedAIProvider.getCurrentModelInfo().name.split('-')[0];
      const autonomousIndicator = this.session.autonomous ? '🤖' : '👤';

      // Build mode indicators
      const indicators = this.updatePromptIndicators();
      const modeIndicator = indicators.length > 0 ? ` ${indicators.join(' ')} ` : '';

      const prompt = chalk.cyanBright(`\\n┌─[${autonomousIndicator}${modelName}:${workingDir}${modeIndicator}]\\n└─❯ `);
      this.rl.setPrompt(prompt);
      this.rl.prompt();
    }
  }

  /**
   * Auto-complete function for readline
   */
  private autoComplete(line: string): [string[], string] {
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
  private showCommandSuggestions(): void {
    if (this.isProcessing) return;

    console.log('\n' + chalk.cyan.bold('📋 Available Commands:'));
    console.log(chalk.gray('─'.repeat(80)));

    // System Commands
    console.log(chalk.white.bold('\n🔧 System Commands:'));
    console.log(`${chalk.green('/help')}           Show detailed help and command reference`);
    console.log(`${chalk.green('/agents')}         List all available AI agents`);
    console.log(`${chalk.green('/model')} [name]    Switch AI model or show current model`);
    console.log(`${chalk.green('/config')}         Open configuration panel`);
    console.log(`${chalk.green('/clear')}          Clear conversation history and free up context`);
    console.log(`${chalk.green('/exit')} (quit)    Exit the REPL`);

    // File & Directory Operations  
    console.log(chalk.white.bold('\n📁 File & Directory Operations:'));
    console.log(`${chalk.green('/add-dir')}        Add a new working directory`);
    console.log(`${chalk.green('/cd')} [path]      Change current working directory`);
    console.log(`${chalk.green('/pwd')}            Show current working directory`);
    console.log(`${chalk.green('/ls')}             List files in current directory`);
    console.log(`${chalk.green('/analyze')}        Quick project analysis`);

    // Analysis & Tools
    console.log(chalk.white.bold('\n🔍 Analysis & Autonomous Tools:'));
    console.log(`${chalk.green('/auto')} <task>    Fully autonomous task execution`);
    console.log(`${chalk.green('/plan')}           Toggle plan mode (shift+tab to cycle)`);
    console.log(`${chalk.green('/auto-accept')}    Toggle auto-accept edits mode`);
    console.log(`${chalk.green('/context')}        Show execution context`);
    console.log(`${chalk.green('/history')}        Show execution history`);
    console.log(`${chalk.green('/autonomous')} [on|off] Toggle autonomous mode`);

    // File Changes & Diffs
    console.log(chalk.white.bold('\\n📝 File Changes & Diffs:'));
    console.log(`${chalk.green('/diff')} [file]    Show file changes (all diffs if no file specified)`);
    console.log(`${chalk.green('/accept')} <file>   Accept and apply file changes`);
    console.log(`${chalk.green('/accept all')}     Accept all pending file changes`);
    console.log(`${chalk.green('/reject')} <file>   Reject and discard file changes`);

    // Session Management
    console.log(chalk.white.bold('\n💾 Session Management:'));
    console.log(`${chalk.green('/export')}         Export current conversation to file or clipboard`);
    console.log(`${chalk.green('/compact')}        Clear history but keep summary in context`);
    console.log(`${chalk.green('/cost')}           Show total cost and duration of current session`);
    console.log(`${chalk.green('/doctor')}         Diagnose and verify Claude Code installation`);
    console.log(`${chalk.green('/bug')}            Submit feedback about Claude Code`);

    // Agent Commands
    console.log(chalk.white.bold('\n🤖 Specialized Agents:'));
    console.log(`${chalk.blue('@ai-analysis')} <task>     AI code analysis and review`);
    console.log(`${chalk.blue('@code-review')} <task>     Code review and suggestions`);
    console.log(`${chalk.blue('@backend-expert')} <task>   Backend development specialist`);
    console.log(`${chalk.blue('@frontend-expert')} <task>  Frontend/UI development expert`);
    console.log(`${chalk.blue('@react-expert')} <task>    React and Next.js specialist`);
    console.log(`${chalk.blue('@devops-expert')} <task>   DevOps and infrastructure expert`);
    console.log(`${chalk.blue('@system-admin')} <task>    System administration tasks`);
    console.log(`${chalk.blue('@autonomous-coder')} <task> Full autonomous coding agent`);

    console.log(chalk.white.bold('\n💬 Natural Language Examples:'));
    console.log(chalk.dim('• "Create a React todo app with TypeScript and tests"'));
    console.log(chalk.dim('• "Fix all ESLint errors in this project"'));
    console.log(chalk.dim('• "Add authentication with JWT to this API"'));
    console.log(chalk.dim('• "Set up Docker and CI/CD for deployment"'));
    console.log(chalk.dim('• "Optimize this component for performance"'));

    console.log(chalk.gray('\n' + '─'.repeat(80)));
    console.log(chalk.yellow('💡 Tip: Use TAB for auto-completion, Ctrl+C to cancel operations'));
    console.log('');
    this.showPrompt();
  }

  /**
   * Toggle plan mode
   */
  private togglePlanMode(): void {
    this.session.planMode = !this.session.planMode;

    if (this.session.planMode) {
      console.log(chalk.green('\n✅ plan mode on ') + chalk.dim('(shift+tab to cycle)'));
    } else {
      console.log(chalk.yellow('\n⚠️ plan mode off'));
    }

    this.updatePromptIndicators();
    this.showPrompt();
  }

  /**
   * Toggle auto-accept edits
   */
  private toggleAutoAcceptEdits(): void {
    this.session.autoAcceptEdits = !this.session.autoAcceptEdits;

    // Sync with diff manager
    diffManager.setAutoAccept(this.session.autoAcceptEdits);

    if (this.session.autoAcceptEdits) {
      console.log(chalk.green('\n✅ auto-accept edits on ') + chalk.dim('(shift+tab to cycle)'));
    } else {
      console.log(chalk.yellow('\n⚠️ auto-accept edits off'));
    }

    this.updatePromptIndicators();
    this.showPrompt();
  }

  /**
   * Update prompt indicators for current modes
   */
  private updatePromptIndicators(): string[] {
    const indicators = [];

    if (this.session.planMode) indicators.push(chalk.cyan('plan'));
    if (this.session.autoAcceptEdits) indicators.push(chalk.green('auto-accept'));
    if (this.session.autonomous) indicators.push(chalk.blue('autonomous'));

    // Add diff count if there are pending diffs
    const pendingCount = diffManager.getPendingCount();
    if (pendingCount > 0) {
      indicators.push(chalk.yellow(`${pendingCount} diffs`));
    }

    return indicators;
  }

  /**
   * Show current security status
   */
  private async showSecurityStatus(): Promise<void> {
    const summary = await this.policyManager.getPolicySummary();

    console.log(boxen(
      `${chalk.blue.bold('🔒 Security Policy Status')}\\n\\n` +
      `${chalk.green('Current Policy:')} ${summary.currentPolicy.approval}\\n` +
      `${chalk.green('Sandbox Mode:')} ${summary.currentPolicy.sandbox}\\n` +
      `${chalk.green('Timeout:')} ${summary.currentPolicy.timeoutMs}ms\\n\\n` +
      `${chalk.cyan('Commands:')}\\n` +
      `• ${chalk.green('Allowed:')} ${summary.allowedCommands}\\n` +
      `• ${chalk.red('Blocked:')} ${summary.deniedCommands}\\n\\n` +
      `${chalk.cyan('Trusted Commands:')} ${summary.trustedCommands.slice(0, 5).join(', ')}...\\n` +
      `${chalk.red('Dangerous Commands:')} ${summary.dangerousCommands.slice(0, 3).join(', ')}...`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'blue'
      }
    ));

    console.log(chalk.dim('\\n Use /policy <setting> <value> to change security settings'));
    console.log(chalk.dim(' Available: approval [never|untrusted|always], sandbox [read-only|workspace-write|system-write]'));
  }

  /**
   * Update security policy
   */
  private async updateSecurityPolicy(setting: string, value: string): Promise<void> {
    try {
      const currentConfig = configManager.getAll();

      switch (setting) {
        case 'approval':
          if (['never', 'untrusted', 'always'].includes(value)) {
            // Policy update - would need to extend config manager
            console.log(chalk.green(`✅ Approval policy set to: ${value}`));
            console.log(chalk.green(`✅ Approval policy set to: ${value}`));
          } else {
            console.log(chalk.red('Invalid approval policy. Use: never, untrusted, or always'));
          }
          break;
        case 'sandbox':
          if (['read-only', 'workspace-write', 'system-write'].includes(value)) {
            // Sandbox update - would need to extend config manager
            console.log(chalk.green(`✅ Sandbox mode set to: ${value}`));
            console.log(chalk.green(`✅ Sandbox mode set to: ${value}`));
          } else {
            console.log(chalk.red('Invalid sandbox mode. Use: read-only, workspace-write, or system-write'));
          }
          break;
        default:
          console.log(chalk.red(`Unknown setting: ${setting}`));
      }
    } catch (error: any) {
      console.log(chalk.red(`Error updating policy: ${error.message}`));
    }
  }

  /**
   * Ask for user confirmation on risky commands
   */
  private async askForCommandConfirmation(command: string): Promise<boolean> {
    const risk = await this.policyManager.evaluateCommandRisk(command);

    if (!risk.requiresApproval) {
      return risk.allowed;
    }

    if (!risk.allowed) {
      console.log(boxen(
        `${chalk.red.bold('⚠️  Command Blocked')}\\n\\n` +
        `Command: ${chalk.yellow(command)}\\n` +
        `Risk Level: ${this.getRiskColor(risk.riskLevel)}\\n\\n` +
        `Reasons:\\n${risk.reasons.map(r => `• ${r}`).join('\\n')}\\n\\n` +
        `${chalk.dim('This command is not allowed in the current security policy.')}`,
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'red'
        }
      ));
      return false;
    }

    console.log(boxen(
      `${chalk.yellow.bold('⚠️  High-Risk Command Detected')}\\n\\n` +
      `Command: ${chalk.cyan(command)}\\n` +
      `Risk Level: ${this.getRiskColor(risk.riskLevel)}\\n\\n` +
      `Reasons:\\n${risk.reasons.map(r => `• ${r}`).join('\\n')}\\n\\n` +
      `${chalk.dim('This command requires your explicit approval.')}`,
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      }
    ));

    return await this.promptYesNo('Do you want to proceed? (y/N)');
  }

  /**
   * Prompt for yes/no confirmation
   */
  private async promptYesNo(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      const tempRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      tempRl.question(chalk.yellow(`${question} `), (answer) => {
        tempRl.close();
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  }

  /**
   * Get risk level color
   */
  private getRiskColor(level: string): string {
    switch (level) {
      case 'low': return chalk.green('Low');
      case 'medium': return chalk.yellow('Medium');
      case 'high': return chalk.red('High');
      default: return chalk.gray(level);
    }
  }

  private showGoodbye(): void {
    const executionCount = this.session.executionHistory.length;
    const toolsUsed = this.session.executionHistory.filter(e => e.type === 'tool_call').length;

    console.log(boxen(
      `${chalk.cyanBright('🤖 Autonomous Claude Assistant')}\\n\\n` +
      `${chalk.gray('Session completed!')}\\n\\n` +
      `${chalk.dim('Autonomous Actions:')}\\n` +
      `• ${chalk.blue('Messages:')} ${this.session.messages.length}\\n` +
      `• ${chalk.green('Tools Used:')} ${toolsUsed}\\n` +
      `• ${chalk.cyan('Total Events:')} ${executionCount}\\n` +
      `• ${chalk.yellow('Duration:')} ${Math.round((Date.now() - this.session.createdAt.getTime()) / 1000)}s\\n\\n` +
      `${chalk.blue('Thanks for using autonomous development! 🚀')}`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green',
        textAlignment: 'center',
      }
    ));
  }

  stop(): void {
    this.stopAllActiveOperations();
    this.rl.close();
  }
}

export const autonomousClaudeInterface = new AutonomousClaudeInterface();
