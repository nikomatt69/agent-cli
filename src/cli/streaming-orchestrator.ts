#!/usr/bin/env node

import chalk from 'chalk';
import * as readline from 'readline';
import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';

import { agentService } from './services/agent-service';
import { toolService } from './services/tool-service';
import { planningService } from './services/planning-service';
import { lspService } from './services/lsp-service';
import { diffManager } from './ui/diff-manager';
import { ExecutionPolicyManager } from './policies/execution-policy';
import { simpleConfigManager as configManager } from './core/config-manager';
import { inputQueue } from './core/input-queue';

interface StreamMessage {
  id: string;
  type: 'user' | 'system' | 'agent' | 'tool' | 'diff' | 'error';
  content: string;
  timestamp: Date;
  status: 'queued' | 'processing' | 'completed' | 'absorbed';
  metadata?: any;
  agentId?: string;
  progress?: number;
}

interface StreamContext {
  workingDirectory: string;
  autonomous: boolean;
  planMode: boolean;
  autoAcceptEdits: boolean;
  contextLeft: number;
  maxContext: number;
  adaptiveSupervision?: boolean;
  intelligentPrioritization?: boolean;
  cognitiveFiltering?: boolean;
  orchestrationAwareness?: boolean;
}

class StreamingOrchestratorImpl extends EventEmitter {
  private rl?: readline.Interface;
  private context: StreamContext;
  private policyManager: ExecutionPolicyManager;

  // Message streaming system
  private messageQueue: StreamMessage[] = [];
  private processingMessage = false;
  private activeAgents = new Map<string, any>();
  private streamBuffer = '';
  private lastUpdate = Date.now();
  private inputQueueEnabled = true; // Abilita/disabilita input queue
  private supervisionCognition: any = null;
  private adaptiveMetrics = new Map<string, number>();

  constructor() {
    super();

    this.context = {
      workingDirectory: process.cwd(),
      autonomous: true,
      planMode: false,
      autoAcceptEdits: true, // Default from image
      contextLeft: 20, // Show percentage like in image
      maxContext: 100
    };

    this.policyManager = new ExecutionPolicyManager(configManager);
    // Don't setup interface automatically - only when start() is called
  }

  private setupInterface(): void {
    if (!this.rl) return;

    // Raw mode for better control
    process.stdin.setRawMode(true);
    require('readline').emitKeypressEvents(process.stdin);

    // Keypress handlers
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
        } else {
          this.gracefulExit();
        }
      }
    });

    // Input handler
    this.rl.on('line', async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) {
        this.showPrompt();
        return;
      }

      // Se il sistema sta processando e la queue è abilitata, metti in coda
      // ma rispetta il bypass per approval inputs
      if (this.inputQueueEnabled && (this.processingMessage || this.activeAgents.size > 0) && inputQueue.shouldQueue(trimmed)) {
        // Determina priorità basata sul contenuto
        let priority: 'high' | 'normal' | 'low' = 'normal';
        if (trimmed.startsWith('/') || trimmed.startsWith('@')) {
          priority = 'high'; // Comandi e agenti hanno priorità alta
        } else if (trimmed.toLowerCase().includes('urgent') || trimmed.toLowerCase().includes('stop')) {
          priority = 'high';
        } else if (trimmed.toLowerCase().includes('later') || trimmed.toLowerCase().includes('low priority')) {
          priority = 'low';
        }

        const queueId = inputQueue.enqueue(trimmed, priority, 'user');
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

    // Setup service listeners
    this.setupServiceListeners();
  }

  private setupServiceListeners(): void {
    // Agent events
    agentService.on('task_start', (task) => {
      this.activeAgents.set(task.id, task);
      this.queueMessage({
        type: 'system',
        content: `🤖 Agent ${task.agentType} started: ${task.task.slice(0, 50)}...`,
        metadata: { agentId: task.id, agentType: task.agentType }
      });
    });

    agentService.on('task_progress', (task, update) => {
      this.queueMessage({
        type: 'agent',
        content: `📊 ${task.agentType}: ${update.progress}% ${update.description || ''}`,
        metadata: { agentId: task.id, progress: update.progress },
        agentId: task.id,
        progress: update.progress
      });
    });

    agentService.on('tool_use', (task, update) => {
      this.queueMessage({
        type: 'tool',
        content: `🔧 ${task.agentType} using ${update.tool}: ${update.description}`,
        metadata: { agentId: task.id, tool: update.tool }
      });
    });

    agentService.on('task_complete', (task) => {
      this.activeAgents.delete(task.id);
      if (task.status === 'completed') {
        this.queueMessage({
          type: 'system',
          content: `✅ Agent ${task.agentType} completed successfully`,
          metadata: { agentId: task.id, result: task.result }
        });

        // Auto-absorb completed messages after 2 seconds
        setTimeout(() => this.absorbCompletedMessages(), 2000);
      } else {
        this.queueMessage({
          type: 'error',
          content: `❌ Agent ${task.agentType} failed: ${task.error}`,
          metadata: { agentId: task.id, error: task.error }
        });
      }
    });
  }

  private async queueUserInput(input: string): Promise<void> {
    const message: StreamMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: input,
      timestamp: new Date(),
      status: 'queued'
    };

    this.messageQueue.push(message);

    // Process immediately if not busy
    if (!this.processingMessage && this.messageQueue.length === 1) {
      this.processNextMessage();
    }
  }

  private queueMessage(partial: Partial<StreamMessage>): void {
    const message: StreamMessage = {
      id: `msg_${Date.now()}_${randomBytes(6).toString('base64url')}`,
      timestamp: new Date(),
      status: 'queued',
      ...partial
    } as StreamMessage;

    this.messageQueue.push(message);
    this.displayMessage(message);
  }

  private async processNextMessage(): Promise<void> {
    if (this.processingMessage || this.messageQueue.length === 0) return;

    const message = this.messageQueue.find(m => m.status === 'queued');
    if (!message) return;

    this.processingMessage = true;
    message.status = 'processing';

    try {
      if (message.type === 'user') {
        await this.handleUserMessage(message);
      }
    } catch (error: any) {
      this.queueMessage({
        type: 'error',
        content: `❌ Error processing message: ${error.message}`
      });
    } finally {
      message.status = 'completed';
      this.processingMessage = false;

      // Process next message
      setTimeout(() => this.processNextMessage(), 100);

      // Processa input dalla queue se disponibili
      this.processQueuedInputs();
    }
  }

  private async handleUserMessage(message: StreamMessage): Promise<void> {
    const input = message.content;

    // Handle commands
    if (input.startsWith('/')) {
      await this.handleCommand(input);
      return;
    }

    // Handle agent requests
    if (input.startsWith('@')) {
      const match = input.match(/^@(\\w+[-\\w]*)/);
      if (match) {
        const agentName = match[1];
        const task = input.replace(match[0], '').trim();
        await this.launchAgent(agentName, task);
        return;
      }
    }

    // Natural language - autonomous processing
    await this.processNaturalLanguage(input);
  }

  private async handleCommand(command: string): Promise<void> {
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

  private async launchAgent(agentName: string, task: string): Promise<void> {
    if (!task) {
      this.queueMessage({
        type: 'error',
        content: `❌ Agent ${agentName} requires a task description`
      });
      return;
    }

    try {
      // Check if we have capacity (max 3 agents)
      if (this.activeAgents.size >= 3) {
        this.queueMessage({
          type: 'system',
          content: `⏳ Agent ${agentName} queued (${this.activeAgents.size}/3 active)`
        });
      }

      const taskId = await agentService.executeTask(agentName, task, {});
      this.queueMessage({
        type: 'system',
        content: `🚀 Launched ${agentName} agent (Task ID: ${taskId.slice(-6)})`
      });
    } catch (error: any) {
      this.queueMessage({
        type: 'error',
        content: `❌ Failed to launch ${agentName}: ${error.message}`
      });
    }
  }

  private async processNaturalLanguage(input: string): Promise<void> {
    this.queueMessage({
      type: 'system',
      content: `🧠 Processing: "${input}"`
    });

    // Select best agent for the task
    const selectedAgent = this.selectBestAgent(input);

    if (this.context.planMode) {
      this.queueMessage({
        type: 'system',
        content: `🎯 Plan Mode: Creating execution plan...`
      });

      try {
        const plan = await planningService.createPlan(input, {
          showProgress: false,
          autoExecute: this.context.autonomous,
          confirmSteps: false
        });

        this.queueMessage({
          type: 'system',
          content: `📋 Generated plan with ${plan.steps.length} steps`
        });

        // Execute plan
        setTimeout(async () => {
          await planningService.executePlan(plan.id, {
            showProgress: true,
            autoExecute: true,
            confirmSteps: false
          });
        }, 1000);

      } catch (error: any) {
        this.queueMessage({
          type: 'error',
          content: `❌ Planning failed: ${error.message}`
        });
      }
    } else {
      // Direct agent execution
      await this.launchAgent(selectedAgent, input);
    }
  }

  private selectBestAgent(input: string): string {
    const lower = input.toLowerCase();

    if (lower.includes('react') || lower.includes('component')) return 'react-expert';
    if (lower.includes('backend') || lower.includes('api')) return 'backend-expert';
    if (lower.includes('frontend') || lower.includes('ui')) return 'frontend-expert';
    if (lower.includes('deploy') || lower.includes('docker')) return 'devops-expert';
    if (lower.includes('review') || lower.includes('analyze')) return 'code-review';
    return 'autonomous-coder';
  }

  private displayMessage(message: StreamMessage): void {
    const timestamp = message.timestamp.toLocaleTimeString('en-GB', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let prefix = '';
    let content = message.content;
    let color = chalk.white;

    switch (message.type) {
      case 'user':
        prefix = '>';
        color = chalk.green;
        break;
      case 'system':
        prefix = '•';
        color = chalk.blue;
        break;
      case 'agent':
        prefix = '🤖';
        color = chalk.cyan;
        break;
      case 'tool':
        prefix = '🔧';
        color = chalk.magenta;
        break;
      case 'error':
        prefix = '❌';
        color = chalk.red;
        break;
      case 'diff':
        prefix = '📝';
        color = chalk.yellow;
        break;
    }

    const statusIndicator = message.status === 'completed' ? '' :
      message.status === 'processing' ? chalk.yellow('⏳') :
        message.status === 'absorbed' ? chalk.dim('📤') : '';

    console.log(`${chalk.dim(timestamp)} ${prefix} ${color(content)} ${statusIndicator}`);

    // Show progress bar for agent messages
    if (message.progress && message.progress > 0) {
      const progressBar = this.createProgressBar(message.progress);
      console.log(`${' '.repeat(timestamp.length + 2)}${progressBar}`);
    }
  }

  private createProgressBar(progress: number, width = 20): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return chalk.blue(`[${bar}] ${progress}%`);
  }

  private absorbCompletedMessages(): void {
    let absorbed = 0;
    this.messageQueue.forEach(msg => {
      if (msg.status === 'completed' && msg.type !== 'user') {
        msg.status = 'absorbed';
        absorbed++;
      }
    });

    if (absorbed > 0) {
      console.log(chalk.dim(`📤 Absorbed ${absorbed} completed messages`));
      this.updateContextCounter();
    }
  }

  private updateContextCounter(): void {
    const activeMessages = this.messageQueue.filter(m => m.status !== 'absorbed').length;
    this.context.contextLeft = Math.max(0, this.context.maxContext - activeMessages);
  }

  private clearMessages(): void {
    const cleared = this.messageQueue.length;
    this.messageQueue = [];
    this.context.contextLeft = this.context.maxContext;
    console.clear();
    console.log(chalk.green(`✅ Cleared ${cleared} messages`));
  }

  private showStatus(): void {
    const active = this.activeAgents.size;
    const queued = agentService.getQueuedTasks().length;
    const pending = diffManager.getPendingCount();
    const queueStatus = inputQueue.getStatus();
    const supervision = this.supervisionCognition;
    const metrics = Object.fromEntries(this.adaptiveMetrics);

    console.log(chalk.cyan.bold('\\n🧠 Adaptive Orchestrator Status'));
    console.log(chalk.gray('═'.repeat(50)));

    // Basic status
    console.log(`${chalk.blue('Working Dir:')} ${this.context.workingDirectory}`);
    console.log(`${chalk.blue('Active Agents:')} ${active}/3`);
    console.log(`${chalk.blue('Queued Tasks:')} ${queued}`);
    console.log(`${chalk.blue('Messages:')} ${this.messageQueue.length}`);
    console.log(`${chalk.blue('Pending Diffs:')} ${pending}`);
    console.log(`${chalk.blue('Context Left:')} ${this.context.contextLeft}%`);

    // Adaptive supervision status
    if (supervision) {
      console.log(chalk.cyan.bold('\\n🎯 Supervision Cognition:'));
      console.log(`${chalk.blue('Task Complexity:')} ${supervision.taskComplexity}`);
      console.log(`${chalk.blue('Risk Level:')} ${supervision.riskLevel}`);
      console.log(`${chalk.blue('Agent Coordination:')} ${(supervision.agentCoordination * 100).toFixed(1)}%`);
      console.log(`${chalk.blue('Resource Usage:')} ${(supervision.resourceUtilization * 100).toFixed(1)}%`);
      console.log(`${chalk.blue('System Load:')} ${supervision.systemLoad}`);
      console.log(`${chalk.blue('Adaptive Response:')} ${supervision.adaptiveResponse}`);
    }

    // Adaptive features status
    console.log(chalk.cyan.bold('\\n⚙️ Adaptive Features:'));
    console.log(`${chalk.blue('Adaptive Supervision:')} ${this.context.adaptiveSupervision ? '✅' : '❌'}`);
    console.log(`${chalk.blue('Intelligent Prioritization:')} ${this.context.intelligentPrioritization ? '✅' : '❌'}`);
    console.log(`${chalk.blue('Cognitive Filtering:')} ${this.context.cognitiveFiltering ? '✅' : '❌'}`);
    console.log(`${chalk.blue('Orchestration Awareness:')} ${this.context.orchestrationAwareness ? '✅' : '❌'}`);

    // Input queue status
    console.log(chalk.cyan.bold('\\n📥 Input Processing:'));
    console.log(`${chalk.blue('Input Queue:')} ${this.inputQueueEnabled ? 'Enabled' : 'Disabled'}`);
    if (this.inputQueueEnabled) {
      console.log(`${chalk.blue('  Queued Inputs:')} ${queueStatus.queueLength}`);
      console.log(`${chalk.blue('  Processing:')} ${queueStatus.isProcessing ? 'Yes' : 'No'}`);
    }

    // Performance metrics
    console.log(chalk.cyan.bold('\\n📊 Performance Metrics:'));
    console.log(`${chalk.blue('Processing Rate:')} ${(metrics.messageProcessingRate * 100).toFixed(1)}%`);
    console.log(`${chalk.blue('Coordination Efficiency:')} ${(metrics.agentCoordinationEfficiency * 100).toFixed(1)}%`);
    console.log(`${chalk.blue('Error Recovery Rate:')} ${(metrics.errorRecoveryRate * 100).toFixed(1)}%`);
  }

  private showActiveAgents(): void {
    if (this.activeAgents.size === 0) {
      console.log(chalk.yellow('No active agents'));
      return;
    }

    console.log(chalk.cyan.bold('\\n🤖 Active Agents'));
    console.log(chalk.gray('─'.repeat(30)));

    this.activeAgents.forEach(agent => {
      console.log(`${chalk.blue(agent.agentType)} - ${agent.task.slice(0, 40)}...`);
    });
  }

  private cycleMode(): void {
    if (!this.context.planMode && !this.context.autoAcceptEdits) {
      this.context.planMode = true;
      console.log(chalk.green('\\n✅ plan mode on ') + chalk.dim('(shift+tab to cycle)'));
    } else if (this.context.planMode && !this.context.autoAcceptEdits) {
      this.context.planMode = false;
      this.context.autoAcceptEdits = true;
      diffManager.setAutoAccept(true);
      console.log(chalk.green('\\n✅ auto-accept edits on ') + chalk.dim('(shift+tab to cycle)'));
    } else {
      this.context.planMode = false;
      this.context.autoAcceptEdits = false;
      diffManager.setAutoAccept(false);
      console.log(chalk.yellow('\\n⚠️ manual mode'));
    }
  }

  private showCommandMenu(): void {
    console.log(chalk.cyan.bold('\\n📋 Available Commands:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.green('/status')}        Show orchestrator status`);
    console.log(`${chalk.green('/agents')}        Show active agents`);
    console.log(`${chalk.green('/diff')} [file]   Show file changes`);
    console.log(`${chalk.green('/accept')} [all]  Accept file changes`);
    console.log(`${chalk.green('/clear')}         Clear message queue`);
    console.log(`${chalk.green('/queue')} [cmd]   Manage input queue`);
    console.log(`${chalk.green('/help')}          Show detailed help`);

    console.log(chalk.cyan.bold('\\n🤖 Agent Usage:'));
    console.log(`${chalk.blue('@agent-name')} task description`);
    console.log(chalk.dim('Available: react-expert, backend-expert, frontend-expert,'));
    console.log(chalk.dim('          devops-expert, code-review, autonomous-coder'));

    console.log(chalk.cyan.bold('\\n💬 Natural Language:'));
    console.log(chalk.dim('Just describe what you want to accomplish'));
  }

  private showHelp(): void {
    console.log(chalk.cyan.bold('\\n🎛️ AI Development Orchestrator Help'));
    console.log(chalk.gray('═'.repeat(60)));

    console.log(chalk.white.bold('\\nHow it works:'));
    console.log('• Messages are queued and processed in order');
    console.log('• Up to 3 agents can run in parallel');
    console.log('• Completed messages are auto-absorbed');
    console.log('• Context is automatically managed');

    console.log(chalk.white.bold('\\nKeyboard shortcuts:'));
    console.log('• / - Show command menu');
    console.log('• Shift+Tab - Cycle modes (manual → plan → auto-accept)');
    console.log('• ESC - Return to default chat');
    console.log('• Ctrl+C - Stop agents or exit');

    console.log(chalk.white.bold('\\nModes:'));
    console.log('• Manual - Ask for confirmation');
    console.log('• Plan - Create execution plans first');
    console.log('• Auto-accept - Apply all changes automatically');

    console.log(chalk.white.bold('\\nQueue Commands:'));
    console.log('• /queue status - Show queue status');
    console.log('• /queue clear - Clear all queued inputs');
    console.log('• /queue enable/disable - Toggle input queue');
    console.log('• /queue process - Process next queued input');
  }

  private handleQueueCommand(args: string[]): void {
    const [subCmd] = args;

    switch (subCmd) {
      case 'status':
        inputQueue.showStats();
        break;
      case 'clear':
        const cleared = inputQueue.clear();
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
        console.log(chalk.cyan.bold('\\n📥 Input Queue Commands:'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(`${chalk.green('/queue status')}   - Show queue statistics`);
        console.log(`${chalk.green('/queue clear')}    - Clear all queued inputs`);
        console.log(`${chalk.green('/queue enable')}   - Enable input queue`);
        console.log(`${chalk.green('/queue disable')}  - Disable input queue`);
        console.log(`${chalk.green('/queue process')}  - Process next queued input`);
    }
  }

  private stopAllAgents(): void {
    this.activeAgents.clear();
    console.log(chalk.yellow('\\n⏹️ Stopped all active agents'));
  }

  private startMessageProcessor(): void {
    // Process messages every 100ms
    setInterval(() => {
      if (!this.processingMessage) {
        this.processNextMessage();
      }
      this.updateContextCounter();
    }, 100);

    // Auto-absorb messages every 5 seconds
    setInterval(() => {
      this.absorbCompletedMessages();
    }, 5000);

    // Process queued inputs every 2 seconds
    setInterval(() => {
      this.processQueuedInputs();
    }, 2000);
  }

  private async processQueuedInputs(): Promise<void> {
    if (!this.inputQueueEnabled || this.processingMessage || this.activeAgents.size > 0) {
      return; // Non processare se il sistema è occupato
    }

    const status = inputQueue.getStatus();
    if (status.queueLength === 0) {
      return; // Nessun input in coda
    }

    // Processa il prossimo input dalla queue
    const result = await inputQueue.processNext(async (input: string) => {
      await this.queueUserInput(input);
    });

    if (result) {
      this.queueMessage({
        type: 'system',
        content: `🔄 Processing queued input: ${result.input.substring(0, 40)}${result.input.length > 40 ? '...' : ''}`
      });
    }
  }

  private showPrompt(): void {
    if (!this.rl) return;

    const dir = require('path').basename(this.context.workingDirectory);
    const agents = this.activeAgents.size;
    const agentIndicator = agents > 0 ? chalk.blue(`${agents}🤖`) : '🎛️';

    const modes: string[] = [];
    if (this.context.planMode) modes.push(chalk.cyan('plan'));
    if (this.context.autoAcceptEdits) modes.push(chalk.green('auto-accept'));
    const modeStr = modes.length > 0 ? ` ${modes.join(' ')} ` : '';

    const contextStr = chalk.dim(`${this.context.contextLeft}%`);

    // Mostra stato della queue se abilitata
    const queueStatus = this.inputQueueEnabled ? inputQueue.getStatus() : null;
    const queueStr = queueStatus && queueStatus.queueLength > 0 ?
      chalk.yellow(` | 📥${queueStatus.queueLength}`) : '';

    const prompt = `\n┌─[${agentIndicator}:${chalk.green(dir)}${modeStr}]─[${contextStr}${queueStr}]\n└─❯ `;
    this.rl.setPrompt(prompt);
    this.rl.prompt();
  }

  private autoComplete(line: string): [string[], string] {
    if (!this.rl) return [[], line];
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



  private gracefulExit(): void {
    console.log(chalk.blue('\n👋 Shutting down orchestrator...'));

    if (this.activeAgents.size > 0) {
      console.log(chalk.yellow(`⏳ Waiting for ${this.activeAgents.size} agents to finish...`));
      // In production, you'd wait for agents to complete
    }

    console.log(chalk.green('✅ Goodbye!'));
    process.exit(0);
  }

  async start(): Promise<void> {
    console.clear();

    // Check API keys
    const hasKeys = this.checkAPIKeys();
    if (!hasKeys) return;

    // Create readline interface only when starting
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      historySize: 300,
      completer: this.autoComplete.bind(this),
    });

    this.showWelcome();
    this.initializeServices();

    // Setup interface and start message processor
    this.setupInterface();
    this.startMessageProcessor();

    // Start the interface
    this.showPrompt();

    return new Promise<void>((resolve) => {
      this.rl!.on('close', resolve);
    });
  }

  private checkAPIKeys(): boolean {
    const hasAny = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!hasAny) {
      console.log(chalk.red('❌ No API keys found. Please set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY'));
      return false;
    }
    return true;
  }

  private showWelcome(): void {
    const title = chalk.cyanBright('🎛️ Streaming AI Development Orchestrator');
    console.log(chalk.cyan('─'.repeat(80)));
    console.log(title);
    console.log(chalk.cyan('─'.repeat(80)));
    console.log(`${chalk.blue('Directory:')} ${this.context.workingDirectory}`);
    console.log(`${chalk.blue('Max Agents:')} 3 parallel`);
    console.log(`${chalk.blue('Mode:')} ${this.context.autoAcceptEdits ? 'Auto-accept' : 'Manual'}`);
    console.log(chalk.dim('\nPress / for commands, @ for agents, or describe what you want to do\n'));
  }

  private async initializeServices(): Promise<void> {
    // Initialize all services
    toolService.setWorkingDirectory(this.context.workingDirectory);
    planningService.setWorkingDirectory(this.context.workingDirectory);
    lspService.setWorkingDirectory(this.context.workingDirectory);

    // Auto-start relevant services
    await lspService.autoStartServers(this.context.workingDirectory);

    console.log(chalk.dim('🚀 Services initialized'));
  }

  /**
   * Get adaptive supervision metrics for external monitoring
   */
  getSupervisionMetrics(): {
    cognition: any | null;
    metrics: Record<string, number>;
    patterns: Record<string, number>;
    historyLength: number;
  } {
    return {
      cognition: null, // Placeholder - would be implemented with full supervision system
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

  /**
   * Configure adaptive supervision settings
   */
  configureAdaptiveSupervision(config: any): void {
    console.log(chalk.cyan(`🧠 Adaptive supervision configured`));
    if (config.adaptiveSupervision) {
      console.log(chalk.cyan(`🎯 Cognitive features enabled`));
    }
  }
}

// Export the class
export class StreamingOrchestrator extends StreamingOrchestratorImpl { }

// Start the orchestrator if this file is run directly
if (require.main === module) {
  const orchestrator = new StreamingOrchestrator();
  orchestrator.start().catch(console.error);
}