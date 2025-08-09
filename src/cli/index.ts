#!/usr/bin/env node

/**
 * NikCLI - Unified Autonomous AI Development Assistant
 * Consolidated Entry Point with Modular Architecture
 */

import chalk from 'chalk';
import boxen from 'boxen';
import * as readline from 'readline';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';

// Core imports
import { NikCLI } from './nik-cli';
import { agentService } from './services/agent-service';
import { toolService } from './services/tool-service';
import { planningService } from './services/planning-service';
import { lspService } from './services/lsp-service';
import { diffManager } from './ui/diff-manager';
import { ExecutionPolicyManager } from './policies/execution-policy';
import { simpleConfigManager as configManager } from './core/config-manager';
import { registerAgents } from './register-agents';
import { AgentManager } from './core/agent-manager';

// Types from streaming orchestrator
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
}

// ASCII Art Banner
const banner = `
███╗   ██╗██╗██╗  ██╗ ██████╗██╗     ██╗
████╗  ██║██║██║ ██╔╝██╔════╝██║     ██║
██╔██╗ ██║██║█████╔╝ ██║     ██║     ██║
██║╚██╗██║██║██╔═██╗ ██║     ██║     ██║
██║ ╚████║██║██║  ██╗╚██████╗███████╗██║
╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝
`;

/**
 * Introduction Display Module
 */
class IntroductionModule {
  static displayBanner() {
    console.clear();
    // Use realistic solid colors instead of rainbow gradient
    console.log(chalk.cyanBright(banner));

    const welcomeBox = boxen(
      chalk.white.bold('🤖 Autonomous AI Development Assistant\n\n') +
      chalk.gray('• Intelligent code generation and analysis\n') +
      chalk.gray('• Autonomous planning and execution\n') +
      chalk.gray('• Real-time project understanding\n') +
      chalk.gray('• Interactive terminal interface\n\n') +
      chalk.cyan('Ready to transform your development workflow!'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        backgroundColor: '#1a1a1a'
      }
    );

    console.log(welcomeBox);
  }

  static displayApiKeySetup() {
    const setupBox = boxen(
      chalk.yellow.bold('⚠️  API Key Required\n\n') +
      chalk.white('To use NikCLI, please set at least one API key:\n\n') +
      chalk.green('• ANTHROPIC_API_KEY') + chalk.gray(' - for Claude models (recommended)\n') +
      chalk.blue('• OPENAI_API_KEY') + chalk.gray(' - for GPT models\n') +
      chalk.magenta('• GOOGLE_GENERATIVE_AI_API_KEY') + chalk.gray(' - for Gemini models\n\n') +
      chalk.white.bold('Setup Examples:\n') +
      chalk.dim('export ANTHROPIC_API_KEY="your-key-here"\n') +
      chalk.dim('export OPENAI_API_KEY="your-key-here"\n') +
      chalk.dim('export GOOGLE_GENERATIVE_AI_API_KEY="your-key-here"\n\n') +
      chalk.cyan('Then run: ') + chalk.white.bold('npm start'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
        backgroundColor: '#2a1a00'
      }
    );

    console.log(setupBox);
  }

  static displayStartupInfo() {
    const startupBox = boxen(
      chalk.green.bold('🚀 Starting NikCLI...\n\n') +
      chalk.white('Initializing autonomous AI assistant\n') +
      chalk.gray('• Loading project context\n') +
      chalk.gray('• Preparing planning system\n') +
      chalk.gray('• Setting up tool integrations\n\n') +
      chalk.cyan('Type ') + chalk.white.bold('/help') + chalk.cyan(' for available commands'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green',
        backgroundColor: '#001a00'
      }
    );

    console.log(startupBox);
  }
}

/**
 * System Requirements Module
 */
class SystemModule {
  static lastOllamaStatus: boolean | undefined;
  static async checkApiKeys(): Promise<boolean> {
    // Allow running without API keys when using an Ollama model
    try {
      const currentModel = configManager.get('currentModel');
      const modelCfg = (configManager.get('models') as any)[currentModel];
      if (modelCfg && modelCfg.provider === 'ollama') {
        return true;
      }
    } catch (_) {
      // ignore config read errors, fall back to env checks
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    return !!(anthropicKey || openaiKey || googleKey);
  }

  static checkNodeVersion(): boolean {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    
    if (major < 18) {
      console.log(chalk.red(`❌ Node.js ${major} is too old. Requires Node.js 18+`));
      return false;
    }
    
    console.log(chalk.green(`✅ Node.js ${version}`));
    return true;
  }
  
  static async checkOllamaAvailability(): Promise<boolean> {
    // Only enforce when current provider is Ollama
    try {
      const currentModel = configManager.get('currentModel');
      const modelCfg = (configManager.get('models') as any)[currentModel];
      if (!modelCfg || modelCfg.provider !== 'ollama') {
        // Not applicable – clear status indicator
        SystemModule.lastOllamaStatus = undefined;
        return true;
      }
    } catch (_) {
      return true; // don't block if config is unreadable
    }

    try {
      const host = process.env.OLLAMA_HOST || '127.0.0.1:11434';
      const base = host.startsWith('http') ? host : `http://${host}`;
      const res = await fetch(`${base}/api/tags`, { method: 'GET' } as any);
      if (!res.ok) {
        SystemModule.lastOllamaStatus = false;
        console.log(chalk.red(`❌ Ollama reachable at ${base} but returned status ${res.status}`));
        return false;
      }
      const data: any = await res.json().catch(() => null);
      if (!data || !Array.isArray(data.models)) {
        console.log(chalk.yellow('⚠️ Unexpected response from Ollama when listing models'));
      } else {
        const currentModel = configManager.get('currentModel');
        const modelCfg = (configManager.get('models') as any)[currentModel];
        const name = modelCfg?.model;
        const present = data.models.some((m: any) => m?.name === name || m?.model === name);
        if (!present && name) {
          console.log(chalk.yellow(`⚠️ Ollama is running but model "${name}" is not present.`));
          // Offer to pull the model now
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          const answer: string = await new Promise(resolve =>
            rl.question(`Pull model now with "ollama pull ${name}"? (Y/n): `, resolve)
          );
          rl.close();

          if (!answer || answer.toLowerCase().startsWith('y')) {
            console.log(chalk.blue(`⏳ Pulling model ${name}...`));
            const code: number = await new Promise<number>((resolve) => {
              const child = spawn('ollama', ['pull', name], { stdio: 'inherit' });
              child.on('close', (code) => resolve(code ?? 1));
              child.on('error', () => resolve(1));
            });
            if (code === 0) {
              console.log(chalk.green(`✅ Model ${name} pulled successfully`));
            } else {
              console.log(chalk.red(`❌ Failed to pull model ${name}. You can try manually: ollama pull ${name}`));
              SystemModule.lastOllamaStatus = false;
              return false;
            }
          } else {
            console.log(chalk.gray(`   You can pull it later with: ollama pull ${name}`));
            SystemModule.lastOllamaStatus = false;
            return false;
          }
        }
      }
      console.log(chalk.green('✅ Ollama service detected'));
      SystemModule.lastOllamaStatus = true;
      return true;
    } catch (err) {
      const host = process.env.OLLAMA_HOST || '127.0.0.1:11434';
      const base = host.startsWith('http') ? host : `http://${host}`;
      console.log(chalk.red(`❌ Ollama service not reachable at ${base}`));
      console.log(chalk.gray('   Start it with "ollama serve" or open the Ollama app. Install: https://ollama.com'));
      SystemModule.lastOllamaStatus = false;
      return false;
    }
  }

  static async checkSystemRequirements(): Promise<boolean> {
    console.log(chalk.blue('🔍 Checking system requirements...'));

    const checks = [
      this.checkNodeVersion(),
      await this.checkApiKeys(),
      await this.checkOllamaAvailability()
    ];

    const allPassed = checks.every(r => r);

    if (allPassed) {
      console.log(chalk.green('✅ All system checks passed'));
    } else {
      console.log(chalk.red('❌ System requirements not met'));
    }

    return allPassed;
  }
}

/**
 * Service Initialization Module
 */
class ServiceModule {
  private static initialized = false;
  private static agentManager: AgentManager | null = null;

  static async initializeServices(): Promise<void> {
    const workingDir = process.cwd();

    // Set working directory for all services
    toolService.setWorkingDirectory(workingDir);
    planningService.setWorkingDirectory(workingDir);
    lspService.setWorkingDirectory(workingDir);
    diffManager.setAutoAccept(true);

    console.log(chalk.dim('   Services configured'));
  }

  static async initializeAgents(): Promise<void> {
    // Create and initialize the core AgentManager
    if (!this.agentManager) {
      this.agentManager = new AgentManager(configManager as any);
      await this.agentManager.initialize();
    }

    // Register agent classes (e.g., UniversalAgent)
    registerAgents(this.agentManager);

    // Ensure at least one agent instance is created (universal-agent)
    try {
      await this.agentManager.createAgent('universal-agent');
    } catch (_) {
      // If already created or creation failed silently, proceed
    }

    const agents = this.agentManager.listAgents();
    console.log(chalk.dim(`   Loaded ${agents.length} agents`));
  }

  static async initializeTools(): Promise<void> {
    const tools = toolService.getAvailableTools();
    console.log(chalk.dim(`   Loaded ${tools.length} tools`));
  }

  static async initializePlanning(): Promise<void> {
    console.log(chalk.dim('   Planning system ready'));
  }

  static async initializeSecurity(): Promise<void> {
    console.log(chalk.dim('   Security policies loaded'));
  }

  static async initializeContext(): Promise<void> {
    console.log(chalk.dim('   Context management ready'));
  }

  static async initializeSystem(): Promise<boolean> {
    if (this.initialized) return true;

    const steps = [
      { name: 'Services', fn: this.initializeServices.bind(this) },
      { name: 'Agents', fn: this.initializeAgents.bind(this) },
      { name: 'Tools', fn: this.initializeTools.bind(this) },
      { name: 'Planning', fn: this.initializePlanning.bind(this) },
      { name: 'Security', fn: this.initializeSecurity.bind(this) },
      { name: 'Context', fn: this.initializeContext.bind(this) }
    ];

    for (const step of steps) {
      try {
        console.log(chalk.blue(`🔄 ${step.name}...`));
        await step.fn();
        console.log(chalk.green(`✅ ${step.name} initialized`));
      } catch (error: any) {
        console.log(chalk.red(`❌ ${step.name} failed: ${error.message}`));
        return false;
      }
    }

    this.initialized = true;
    console.log(chalk.green.bold('\n🎉 System initialization complete!'));
    return true;
  }
}

/**
 * Streaming Orchestrator Module
 */
class StreamingModule extends EventEmitter {
  private rl: readline.Interface;
  private context: StreamContext;
  private policyManager: ExecutionPolicyManager;
  private messageQueue: StreamMessage[] = [];
  private processingMessage = false;
  private activeAgents = new Map<string, any>();

  constructor() {
    super();

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
      autoAcceptEdits: true,
      contextLeft: 20,
      maxContext: 100
    };

    this.policyManager = new ExecutionPolicyManager(configManager);
    this.setupInterface();
    this.startMessageProcessor();
  }

  private setupInterface(): void {
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

      await this.queueUserInput(trimmed);
      this.showPrompt();
    });

    this.rl.on('close', () => {
      this.gracefulExit();
    });

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
  }

  private queueMessage(message: Partial<StreamMessage>): void {
    const fullMessage: StreamMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      status: 'queued',
      ...message
    } as StreamMessage;

    this.messageQueue.push(fullMessage);
  }

  private async queueUserInput(input: string): Promise<void> {
    this.queueMessage({
      type: 'user',
      content: input
    });
  }

  private showPrompt(): void {
    const dir = require('path').basename(this.context.workingDirectory);
    const agents = this.activeAgents.size;
    const agentIndicator = agents > 0 ? chalk.blue(`${agents}🤖`) : '🎛️';

    const modes = [];
    if (this.context.planMode) modes.push(chalk.cyan('plan'));
    if (this.context.autoAcceptEdits) modes.push(chalk.green('auto-accept'));
    const modeStr = modes.length > 0 ? ` ${modes.join(' ')} ` : '';

    const contextStr = chalk.dim(`${this.context.contextLeft}%`);

    // Model/provider badge with Ollama status dot
    let modelBadge = '';
    try {
      const currentModel = configManager.get('currentModel');
      const models = (configManager.get('models') as any) || {};
      const modelCfg = models[currentModel] || {};
      const provider = modelCfg.provider || 'unknown';
      // Status dot only meaningful for Ollama
      let dot = chalk.dim('●');
      if (provider === 'ollama') {
        if (SystemModule.lastOllamaStatus === true) dot = chalk.green('●');
        else if (SystemModule.lastOllamaStatus === false) dot = chalk.red('●');
        else dot = chalk.yellow('●');
      }
      const prov = chalk.magenta(provider);
      const name = chalk.white(currentModel || 'model');
      modelBadge = `${prov}:${name}${provider === 'ollama' ? ` ${dot}` : ''}`;
    } catch (_) {
      modelBadge = chalk.gray('model:unknown');
    }

    // Assistant status dot: green when active (with …), red when waiting for input
    const statusDot = this.processingMessage ? chalk.green('●') + chalk.dim('…') : chalk.red('●');
    const statusBadge = `asst:${statusDot}`;

    // Realistic prompt styling (no rainbow)
    const prompt = `\n┌─[${agentIndicator}:${chalk.green(dir)}${modeStr}]─[${contextStr}]─[${statusBadge}]─[${modelBadge}]\n└─❯ `;
    this.rl.setPrompt(prompt);
    this.rl.prompt();
  }

  private autoComplete(line: string): [string[], string] {
    const commands = ['/status', '/agents', '/diff', '/accept', '/clear', '/help'];
    const agents = ['@react-expert', '@backend-expert', '@frontend-expert', '@devops-expert', '@code-review', '@autonomous-coder'];

    const all = [...commands, ...agents];
    const hits = all.filter(c => c.startsWith(line));
    return [hits.length ? hits : all, line];
  }

  private showCommandMenu(): void {
    const lines: string[] = [];
    lines.push(`${chalk.bold('📋 Available Commands')}`);
    lines.push('');
    lines.push(`${chalk.green('/help')}     Show detailed help`);
    lines.push(`${chalk.green('/agents')}   List available agents`);
    lines.push(`${chalk.green('/status')}   Show system status`);
    lines.push(`${chalk.green('/clear')}    Clear session`);
    const content = lines.join('\n');
    console.log(
      boxen(content, {
        padding: { top: 0, right: 2, bottom: 0, left: 2 },
        margin: { top: 1, right: 0, bottom: 0, left: 0 },
        borderStyle: 'round',
        borderColor: 'cyan',
        title: chalk.cyan('Command Menu'),
        titleAlignment: 'center'
      })
    );
  }

  private cycleMode(): void {
    this.context.planMode = !this.context.planMode;
    console.log(this.context.planMode ?
      chalk.green('\n✅ Plan mode enabled') :
      chalk.yellow('\n⚠️ Plan mode disabled')
    );
  }

  private stopAllAgents(): void {
    this.activeAgents.clear();
    console.log(chalk.yellow('\n⏹️ Stopped all active agents'));
  }

  private startMessageProcessor(): void {
    setInterval(() => {
      if (!this.processingMessage) {
        this.processNextMessage();
      }
    }, 100);
  }

  private processNextMessage(): void {
    const message = this.messageQueue.find(m => m.status === 'queued');
    if (!message) return;

    this.processingMessage = true;
    message.status = 'processing';
    // Update prompt to reflect active status
    this.showPrompt();

    // Process message based on type
    setTimeout(() => {
      message.status = 'completed';
      this.processingMessage = false;
      // Update prompt to reflect idle status
      this.showPrompt();
    }, 100);
  }

  private gracefulExit(): void {
    console.log(chalk.blue('\n👋 Shutting down orchestrator...'));

    if (this.activeAgents.size > 0) {
      console.log(chalk.yellow(`⏳ Waiting for ${this.activeAgents.size} agents to finish...`));
    }

    console.log(chalk.green('✅ Goodbye!'));
    process.exit(0);
  }

  async start(): Promise<void> {
    this.showPrompt();

    return new Promise<void>((resolve) => {
      this.rl.on('close', resolve);
    });
  }
}

/**
 * Main Orchestrator - Unified Entry Point
 */
class MainOrchestrator {
  private streamingModule?: StreamingModule;
  private initialized = false;

  constructor() {
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers(): void {
    // Global error handler
    process.on('unhandledRejection', (reason, promise) => {
      console.error(chalk.red('❌ Unhandled Rejection:'), reason);
    });

    process.on('uncaughtException', (error) => {
      console.error(chalk.red('❌ Uncaught Exception:'), error);
      this.gracefulShutdown();
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  private async gracefulShutdown(): Promise<void> {
    console.log(chalk.yellow('\n🛑 Shutting down orchestrator...'));

    try {
      // Stop autonomous interface if running (not used in unified NikCLI entrypoint)
      // No specific stop required here

      // Stop streaming module if running
      if (this.streamingModule) {
        // Streaming module handles its own cleanup
      }

      console.log(chalk.green('✅ Orchestrator shut down cleanly'));
    } catch (error) {
      console.error(chalk.red('❌ Error during shutdown:'), error);
    } finally {
      process.exit(0);
    }
  }

  private showQuickStart(): void {
    console.log(chalk.cyan.bold('\n📚 Quick Start Guide:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`${chalk.green('Natural Language:')} Just describe what you want`);
    console.log(`${chalk.blue('Agent Specific:')} @agent-name your task`);
    console.log(`${chalk.yellow('Commands:')} /help, /status, /agents`);
    console.log(`${chalk.magenta('Shortcuts:')} / (menu), Shift+Tab (modes)`);
    console.log('');
    console.log(chalk.dim('Examples:'));
    console.log(chalk.dim('• "Create a React todo app with TypeScript"'));
    console.log(chalk.dim('• "@react-expert optimize this component"'));
    console.log(chalk.dim('• "/status" to see system status'));
    console.log('');
  }

  async start(): Promise<void> {
    try {
      // Display introduction
      IntroductionModule.displayBanner();

      // Wait a moment for visual effect
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check system requirements
      let requirementsMet = await SystemModule.checkSystemRequirements();
      if (!requirementsMet) {
        const hasKeysOrOllama = await SystemModule.checkApiKeys();
        if (!hasKeysOrOllama) {
          // Interactive fallback to switch to an Ollama model
          try {
            const models = configManager.get('models') as any;
            let ollamaEntries = Object.entries(models).filter(([, cfg]: any) => cfg.provider === 'ollama');
            if (ollamaEntries.length > 0) {
              const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
              const answer: string = await new Promise(resolve =>
                rl.question('No API keys found. Use a local Ollama model instead? (Y/n): ', resolve)
              );
              rl.close();
              if (!answer || answer.toLowerCase().startsWith('y')) {
                // Choose Ollama model
                let chosenName = ollamaEntries[0][0] as string;
                if (ollamaEntries.length > 1) {
                  console.log(chalk.cyan('\nAvailable Ollama models:'));
                  ollamaEntries.forEach(([name, cfg]: any, idx: number) => {
                    console.log(`  [${idx + 1}] ${name} (${cfg.model})`);
                  });
                  const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
                  const pick = await new Promise<string>(resolve =>
                    rl2.question('Select model number (default 1): ', resolve)
                  );
                  rl2.close();
                  const i = parseInt((pick || '1').trim(), 10);
                  if (!isNaN(i) && i >= 1 && i <= ollamaEntries.length) {
                    chosenName = ollamaEntries[i - 1][0] as string;
                  }
                }
                configManager.setCurrentModel(chosenName);
                console.log(chalk.green(`\n✅ Switched to Ollama model: ${chosenName}`));
              } else {
                IntroductionModule.displayApiKeySetup();
              }
            } else {
              // Offer to add a default Ollama model if none configured
              const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
              const answer: string = await new Promise(resolve =>
                rl.question('No API keys and no Ollama models configured. Add default Ollama model (llama3.1:8b)? (Y/n): ', resolve)
              );
              rl.close();
              if (!answer || answer.toLowerCase().startsWith('y')) {
                const defaultName = 'llama3.1:8b';
                configManager.addModel(defaultName, { provider: 'ollama', model: 'llama3.1:8b' } as any);
                configManager.setCurrentModel(defaultName);
                // refresh entries so re-check passes
                const refreshed = configManager.get('models') as any;
                ollamaEntries = Object.entries(refreshed).filter(([, cfg]: any) => cfg.provider === 'ollama');
                console.log(chalk.green(`\n✅ Added and switched to Ollama model: ${defaultName}`));
              } else {
                IntroductionModule.displayApiKeySetup();
              }
            }
          } catch (_) {
            IntroductionModule.displayApiKeySetup();
          }
        }

        // Re-check after potential switch; do not exit if still not met
        requirementsMet = await SystemModule.checkSystemRequirements();
        if (!requirementsMet) {
          console.log(chalk.yellow('\n⚠️ Continuing without API keys. You can set them later with /set-key or switch models.'));
        }
      }

      // Display startup info
      IntroductionModule.displayStartupInfo();

      // Wait a moment before starting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Initialize all systems
      const initialized = await ServiceModule.initializeSystem();
      if (!initialized) {
        console.log(chalk.red('\n❌ Cannot start - system initialization failed'));
        process.exit(1);
      }

      // Show quick start guide
      this.showQuickStart();

      // Start unified NikCLI interface
      console.log(chalk.blue.bold('🤖 Starting NikCLI...\n'));
      const cli = new NikCLI();
      await cli.startChat({});

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to start orchestrator:'), error);
      process.exit(1);
    }
  }
}

/**
 * Main entry point function
 */
async function main() {
  const orchestrator = new MainOrchestrator();
  await orchestrator.start();
}

// Start the application
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Startup failed:'), error);
    process.exit(1);
  });
}

// Export for programmatic use
export {
  main,
  MainOrchestrator,
  IntroductionModule,
  SystemModule,
  ServiceModule,
  StreamingModule
};
