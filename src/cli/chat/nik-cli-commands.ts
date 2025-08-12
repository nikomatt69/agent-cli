import chalk from 'chalk';
import { chatManager } from './chat-manager';
import { configManager } from '../core/config-manager';
import { modelProvider } from '../ai/model-provider';
import { AgentManager } from '../core/agent-manager';
import { registerAgents } from '../register-agents';
import { toolsManager } from '../tools/tools-manager';
import { agentFactory } from '../core/agent-factory';

import { agentStream } from '../core/agent-stream';
import { AgentTask } from '../types/types';
import { workspaceContext } from '../context/workspace-context';
import { enhancedPlanning } from '../planning/enhanced-planning';
import { approvalSystem } from '../ui/approval-system';
import { DiffViewer } from '../ui/diff-viewer';
import { advancedUI } from '../ui/advanced-cli-ui';
import { toolService } from '../services/tool-service';
import { simpleConfigManager } from '../core/config-manager';


export interface CommandResult {
  shouldExit: boolean;
  shouldUpdatePrompt: boolean;
}

export class SlashCommandHandler {
  private commands: Map<string, (args: string[]) => Promise<CommandResult>> = new Map();
  private agentManager: AgentManager;

  constructor() {
    this.agentManager = new AgentManager(configManager);
    registerAgents(this.agentManager);
    this.registerCommands();
  }

  private registerCommands(): void {
    this.commands.set('help', this.helpCommand.bind(this));
    this.commands.set('quit', this.quitCommand.bind(this));
    this.commands.set('exit', this.quitCommand.bind(this));
    this.commands.set('clear', this.clearCommand.bind(this));
    this.commands.set('model', this.modelCommand.bind(this));
    this.commands.set('models', this.modelsCommand.bind(this));
    this.commands.set('set-key', this.setKeyCommand.bind(this));
    this.commands.set('config', this.configCommand.bind(this));
    this.commands.set('new', this.newSessionCommand.bind(this));
    this.commands.set('sessions', this.sessionsCommand.bind(this));
    this.commands.set('export', this.exportCommand.bind(this));
    this.commands.set('system', this.systemCommand.bind(this));
    this.commands.set('stats', this.statsCommand.bind(this));
    this.commands.set('temp', this.temperatureCommand.bind(this));
    this.commands.set('history', this.historyCommand.bind(this));
    this.commands.set('debug', this.debugCommand.bind(this));
    this.commands.set('agent', this.agentCommand.bind(this));
    this.commands.set('agents', this.listAgentsCommand.bind(this));
    this.commands.set('auto', this.autonomousCommand.bind(this));
    this.commands.set('parallel', this.parallelCommand.bind(this));
    this.commands.set('factory', this.factoryCommand.bind(this));
    this.commands.set('create-agent', this.createAgentCommand.bind(this));
    this.commands.set('launch-agent', this.launchAgentCommand.bind(this));
    this.commands.set('context', this.contextCommand.bind(this));
    this.commands.set('stream', this.streamCommand.bind(this));

    // Planning and Todo Commands
    this.commands.set('plan', this.planCommand.bind(this));
    this.commands.set('todo', this.todoCommand.bind(this));
    this.commands.set('todos', this.todosCommand.bind(this));
    this.commands.set('approval', this.approvalCommand.bind(this));

    // Security Commands
    this.commands.set('security', this.securityCommand.bind(this));
    this.commands.set('dev-mode', this.devModeCommand.bind(this));
    this.commands.set('safe-mode', this.safeModeCommand.bind(this));
    this.commands.set('clear-approvals', this.clearApprovalsCommand.bind(this));

    // File operations
    this.commands.set('read', this.readFileCommand.bind(this));
    this.commands.set('write', this.writeFileCommand.bind(this));
    this.commands.set('edit', this.editFileCommand.bind(this));
    this.commands.set('ls', this.listFilesCommand.bind(this));
    this.commands.set('search', this.searchCommand.bind(this));
    this.commands.set('grep', this.searchCommand.bind(this));

    // Terminal operations
    this.commands.set('run', this.runCommandCommand.bind(this));
    this.commands.set('sh', this.runCommandCommand.bind(this));
    this.commands.set('bash', this.runCommandCommand.bind(this));
    this.commands.set('install', this.installCommand.bind(this));
    this.commands.set('npm', this.npmCommand.bind(this));
    this.commands.set('yarn', this.yarnCommand.bind(this));
    this.commands.set('git', this.gitCommand.bind(this));
    this.commands.set('docker', this.dockerCommand.bind(this));
    this.commands.set('ps', this.processCommand.bind(this));
    this.commands.set('kill', this.killCommand.bind(this));

    // Project operations
    this.commands.set('build', this.buildCommand.bind(this));
    this.commands.set('test', this.testCommand.bind(this));
    this.commands.set('lint', this.lintCommand.bind(this));
    this.commands.set('create', this.createProjectCommand.bind(this));
  }

  async handle(input: string): Promise<CommandResult> {
    const parts = input.slice(1).split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    const handler = this.commands.get(command);
    if (!handler) {
      console.log(chalk.red(`❌ Unknown command: ${command}`));
      console.log(chalk.gray('Type /help for available commands'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    return await handler(args);
  }

  private async helpCommand(): Promise<CommandResult> {
    const help = `
${chalk.blue.bold('🔧 Available Commands:')}
${chalk.gray('─'.repeat(40))}

${chalk.cyan('/help')} - Show this help message
${chalk.cyan('/quit, /exit')} - Exit the chat
${chalk.cyan('/clear')} - Clear current chat session
${chalk.cyan('/new [title]')} - Start a new chat session

${chalk.blue.bold('Model Management:')}
${chalk.cyan('/model <name>')} - Switch to a model
${chalk.cyan('/models')} - List available models
${chalk.cyan('/set-key <model> <key>')} - Set API key for a model

${chalk.blue.bold('Configuration:')}
${chalk.cyan('/config')} - Show current configuration
${chalk.cyan('/debug')} - Debug API key configuration
${chalk.cyan('/temp <0.0-2.0>')} - Set temperature (creativity)
${chalk.cyan('/history <on|off>')} - Enable/disable chat history
${chalk.cyan('/system <prompt>')} - Set system prompt for current session

${chalk.blue.bold('Session Management:')}
${chalk.cyan('/sessions')} - List all chat sessions
${chalk.cyan('/export [sessionId]')} - Export session to markdown
${chalk.cyan('/stats')} - Show usage statistics

${chalk.blue.bold('Agent Management:')}
${chalk.cyan('/agents')} - List all available agents
${chalk.cyan('/agent <name> <task>')} - Run specific agent with task
${chalk.cyan('/auto <description>')} - Autonomous multi-agent execution
${chalk.cyan('/parallel <agents> <task>')} - Run multiple agents in parallel
${chalk.cyan('/factory')} - Show agent factory dashboard
${chalk.cyan('/create-agent <specialization>')} - Create new specialized agent
${chalk.cyan('/launch-agent <blueprint-id>')} - Launch agent from blueprint
${chalk.cyan('/context <paths>')} - Select workspace context paths
${chalk.cyan('/stream')} - Show live agent stream dashboard

${chalk.blue.bold('File Operations:')}
${chalk.cyan('/read <file>')} - Read file contents
${chalk.cyan('/write <file> <content>')} - Write content to file
${chalk.cyan('/edit <file>')} - Edit file interactively
${chalk.cyan('/ls [directory]')} - List files in directory
${chalk.cyan('/search <query>')} - Search in files (like grep)

${chalk.blue.bold('Terminal Commands:')}
${chalk.cyan('/run <command>')} - Execute any terminal command
${chalk.cyan('/install <packages>')} - Install npm/yarn packages
${chalk.cyan('/npm <args>')} - Run npm commands
${chalk.cyan('/yarn <args>')} - Run yarn commands
${chalk.cyan('/git <args>')} - Run git commands
${chalk.cyan('/docker <args>')} - Run docker commands
${chalk.cyan('/ps')} - List running processes
${chalk.cyan('/kill <pid>')} - Kill process by PID

${chalk.blue.bold('Project Commands:')}
${chalk.cyan('/build')} - Build the project
${chalk.cyan('/test [pattern]')} - Run tests
${chalk.cyan('/lint')} - Run linting
${chalk.cyan('/create <type> <name>')} - Create new project

${chalk.blue.bold('Security Commands:')}
${chalk.cyan('/security [status|set|help]')} - Manage security settings
${chalk.cyan('/dev-mode [enable|status|help]')} - Developer mode controls
${chalk.cyan('/safe-mode')} - Enable safe mode (maximum security)
${chalk.cyan('/clear-approvals')} - Clear session approvals

${chalk.gray('Tip: Use Ctrl+C to stop streaming responses')}
    `;

    console.log(help);
    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async quitCommand(): Promise<CommandResult> {
    console.log(chalk.yellow('👋 Thanks for using AI Coder CLI!'));
    return { shouldExit: true, shouldUpdatePrompt: false };
  }

  private async clearCommand(): Promise<CommandResult> {
    chatManager.clearCurrentSession();
    console.log(chalk.green('✅ Chat history cleared'));
    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async modelCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      const current = modelProvider.getCurrentModelInfo();
      console.log(chalk.green(`Current model: ${current.name} (${current.config.provider})`));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    const modelName = args[0];
    try {
      configManager.setCurrentModel(modelName);

      // Validate the new model
      if (modelProvider.validateApiKey()) {
        console.log(chalk.green(`✅ Switched to model: ${modelName}`));
        return { shouldExit: false, shouldUpdatePrompt: true };
      } else {
        console.log(chalk.yellow(`⚠️  Switched to model: ${modelName} (API key needed)`));
        return { shouldExit: false, shouldUpdatePrompt: true };
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ ${error.message}`));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }
  }

  private async modelsCommand(): Promise<CommandResult> {
    console.log(chalk.blue.bold('\n🤖 Available Models:'));
    console.log(chalk.gray('─'.repeat(40)));

    const currentModel = configManager.get('currentModel');
    const models = configManager.get('models');

    Object.entries(models).forEach(([name, config]) => {
      const isCurrent = name === currentModel;
      const hasKey = configManager.getApiKey(name) !== undefined;
      const status = hasKey ? chalk.green('✅') : chalk.red('❌');
      const prefix = isCurrent ? chalk.yellow('→ ') : '  ';

      console.log(`${prefix}${status} ${chalk.bold(name)}`);
      console.log(`    ${chalk.gray(`Provider: ${config.provider} | Model: ${config.model}`)}`);
    });

    console.log(chalk.gray('\nUse /model <name> to switch models'));
    console.log(chalk.gray('Use /set-key <model> <key> to add API keys'));

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async setKeyCommand(args: string[]): Promise<CommandResult> {
    if (args.length < 2) {
      console.log(chalk.red('Usage: /set-key <model> <api-key>'));
      console.log(chalk.gray('Example: /set-key claude-3-5-sonnet sk-ant-...'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    const [modelName, apiKey] = args;
    try {
      configManager.setApiKey(modelName, apiKey);
      console.log(chalk.green(`✅ API key set for ${modelName}`));
    } catch (error: any) {
      console.log(chalk.red(`❌ ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async configCommand(): Promise<CommandResult> {
    console.log(configManager.getConfig());
    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async newSessionCommand(args: string[]): Promise<CommandResult> {
    const title = args.join(' ') || undefined;
    const session = chatManager.createNewSession(title);
    console.log(chalk.green(`✅ New session created: ${session.title} (${session.id.slice(0, 8)})`));
    return { shouldExit: false, shouldUpdatePrompt: true };
  }

  private async sessionsCommand(): Promise<CommandResult> {
    const sessions = chatManager.listSessions();
    const current = chatManager.getCurrentSession();

    console.log(chalk.blue.bold('\n📝 Chat Sessions:'));
    console.log(chalk.gray('─'.repeat(40)));

    if (sessions.length === 0) {
      console.log(chalk.gray('No sessions found'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    sessions.forEach((session, index) => {
      const isCurrent = session.id === current?.id;
      const prefix = isCurrent ? chalk.yellow('→ ') : '  ';
      const messageCount = session.messages.filter(m => m.role !== 'system').length;

      console.log(`${prefix}${chalk.bold(session.title)} ${chalk.gray(`(${session.id.slice(0, 8)})`)}`);
      console.log(`    ${chalk.gray(`${messageCount} messages | ${session.updatedAt.toLocaleString()}`)}`);
    });

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async exportCommand(args: string[]): Promise<CommandResult> {
    try {
      const sessionId = args[0];
      const markdown = chatManager.exportSession(sessionId);

      const filename = `chat-export-${Date.now()}.md`;
      require('fs').writeFileSync(filename, markdown);

      console.log(chalk.green(`✅ Session exported to ${filename}`));
    } catch (error: any) {
      console.log(chalk.red(`❌ ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async systemCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      const session = chatManager.getCurrentSession();
      console.log(chalk.green('Current system prompt:'));
      console.log(chalk.gray(session?.systemPrompt || 'None'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    const prompt = args.join(' ');
    const session = chatManager.getCurrentSession();
    if (session) {
      session.systemPrompt = prompt;
      // Update the system message
      const systemMsgIndex = session.messages.findIndex(m => m.role === 'system');
      if (systemMsgIndex >= 0) {
        session.messages[systemMsgIndex].content = prompt;
      } else {
        session.messages.unshift({
          role: 'system',
          content: prompt,
          timestamp: new Date(),
        });
      }
      console.log(chalk.green('✅ System prompt updated'));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async statsCommand(): Promise<CommandResult> {
    const stats = chatManager.getSessionStats();
    const modelInfo = modelProvider.getCurrentModelInfo();

    console.log(chalk.blue.bold('\n📊 Usage Statistics:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.green(`Current Model: ${modelInfo.name}`));
    console.log(chalk.green(`Total Sessions: ${stats.totalSessions}`));
    console.log(chalk.green(`Total Messages: ${stats.totalMessages}`));
    console.log(chalk.green(`Current Session Messages: ${stats.currentSessionMessages}`));

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async temperatureCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      console.log(chalk.green(`Current temperature: ${configManager.get('temperature')}`));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    const temp = parseFloat(args[0]);
    if (isNaN(temp) || temp < 0 || temp > 2) {
      console.log(chalk.red('Temperature must be between 0.0 and 2.0'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    configManager.set('temperature', temp);
    console.log(chalk.green(`✅ Temperature set to ${temp}`));

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async historyCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      const enabled = configManager.get('chatHistory');
      console.log(chalk.green(`Chat history: ${enabled ? 'enabled' : 'disabled'}`));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    const setting = args[0].toLowerCase();
    if (setting !== 'on' && setting !== 'off') {
      console.log(chalk.red('Usage: /history <on|off>'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    configManager.set('chatHistory', setting === 'on');
    console.log(chalk.green(`✅ Chat history ${setting === 'on' ? 'enabled' : 'disabled'}`));

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async debugCommand(): Promise<CommandResult> {
    console.log(chalk.blue.bold('\n🔍 Debug Information:'));
    console.log(chalk.gray('═'.repeat(40)));

    try {
      // Test model configuration
      const currentModel = configManager.getCurrentModel();
      console.log(chalk.green(`Current Model: ${currentModel}`));

      const models = configManager.get('models');
      const currentModelConfig = models[currentModel];

      if (!currentModelConfig) {
        console.log(chalk.red(`❌ Model configuration missing for: ${currentModel}`));
        return { shouldExit: false, shouldUpdatePrompt: false };
      }

      console.log(chalk.green(`Provider: ${currentModelConfig.provider}`));
      console.log(chalk.green(`Model: ${currentModelConfig.model}`));

      // Test API key
      const apiKey = configManager.getApiKey(currentModel);
      if (apiKey) {
        console.log(chalk.green(`✅ API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)} (${apiKey.length} chars)`));
      } else {
        console.log(chalk.red(`❌ API Key: Not configured`));
        console.log(chalk.yellow(`   Set with: /set-key ${currentModel} <your-api-key>`));
      }

      // Test model provider validation
      try {
        const isValid = modelProvider.validateApiKey();
        console.log(chalk.green(`✅ Model Provider Validation: ${isValid ? 'Valid' : 'Invalid'}`));
      } catch (error: any) {
        console.log(chalk.red(`❌ Model Provider Validation Failed: ${error.message}`));
      }

      // Test a simple generation
      try {
        console.log(chalk.blue('\n🧪 Testing AI Generation...'));
        const testResponse = await modelProvider.generateResponse({
          messages: [{ role: 'user', content: 'Say "test successful"' }],
          maxTokens: 20
        });
        console.log(chalk.green(`✅ Test Generation: ${testResponse.trim()}`));
      } catch (error: any) {
        console.log(chalk.red(`❌ Test Generation Failed: ${error.message}`));
      }

      // Environment variables
      console.log(chalk.blue('\n🌍 Environment Variables:'));
      const envVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'];
      envVars.forEach(envVar => {
        const value = process.env[envVar];
        if (value) {
          console.log(chalk.green(`✅ ${envVar}: ${value.slice(0, 10)}...${value.slice(-4)}`));
        } else {
          console.log(chalk.gray(`❌ ${envVar}: Not set`));
        }
      });

    } catch (error: any) {
      console.log(chalk.red(`❌ Debug error: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async listAgentsCommand(): Promise<CommandResult> {
    console.log(chalk.blue.bold('\n🤖 Available Agents:'));
    console.log(chalk.gray('─'.repeat(40)));

    const agents = this.agentManager.listAgents();
    if (agents.length === 0) {
      console.log(chalk.yellow('No agents registered'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    agents.forEach(agent => {
      console.log(`${chalk.green('•')} ${chalk.bold(agent.name)}`);
      console.log(`  ${chalk.gray(agent.description)}`);
    });

    console.log(chalk.gray('\nUse /agent <name> <task> to run a specific agent'));
    console.log(chalk.gray('Use /auto <description> for autonomous multi-agent execution'));

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async agentCommand(args: string[]): Promise<CommandResult> {
    if (args.length < 2) {
      console.log(chalk.red('Usage: /agent <name> <task>'));
      console.log(chalk.gray('Example: /agent coding-agent "analyze this function: function add(a,b) { return a + b; }"'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    const agentName = args[0];
    const task = args.slice(1).join(' ');

    try {
      const agent = this.agentManager.getAgent(agentName);
      if (!agent) {
        console.log(chalk.red(`❌ Agent '${agentName}' not found`));
        console.log(chalk.gray('Use /agents to see available agents'));
        return { shouldExit: false, shouldUpdatePrompt: false };
      }

      console.log(chalk.blue(`🤖 Running ${agentName}...`));

      await agent.initialize();
      const result = await agent.run?.({
        id: `task-${Date.now()}`,
        type: 'user_request' as const,
        title: 'User Request',
        description: task,
        priority: 'medium' as const,
        status: 'pending' as const,
        data: { userInput: task },
        createdAt: new Date(),
        updatedAt: new Date(),
        progress: 0
      } as AgentTask);
      await agent.cleanup?.();

      console.log(chalk.green(`✅ ${agentName} completed:`));
      if (typeof result === 'string') {
        console.log(result);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ Error running agent: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async autonomousCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      console.log(chalk.red('Usage: /auto <description>'));
      console.log(chalk.gray('Example: /auto "Create a React todo app with backend API"'));
      console.log(chalk.gray('Example: /auto "Fix all TypeScript errors in the project"'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    const description = args.join(' ');

    try {
      console.log(chalk.blue('🧠 Creating autonomous agent for task...'));

      // Create specialized agent for this task
      const agent = await agentFactory.createAndLaunchAgent({
        specialization: `Autonomous Developer for: ${description}`,
        autonomyLevel: 'fully-autonomous',
        contextScope: 'project',
        description: `Specialized agent to autonomously complete: ${description}`,
      });

      console.log(chalk.blue('🚀 Starting autonomous execution with streaming...'));

      const result = await agent.run(description);
      await agent.cleanup();

      if (result.error) {
        console.log(chalk.red(`❌ ${result.error}`));
      } else {
        console.log(chalk.green('✅ Autonomous execution completed!'));
        console.log(chalk.gray('Use /stream to see execution details'));
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ Error in autonomous execution: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async parallelCommand(args: string[]): Promise<CommandResult> {
    if (args.length < 2) {
      console.log(chalk.red('Usage: /parallel <agent1,agent2,...> <task>'));
      console.log(chalk.gray('Example: /parallel "coding-agent,react-expert" "create a login component"'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    const agentNames = args[0].split(',').map(name => name.trim());
    const task = args.slice(1).join(' ');

    try {
      console.log(chalk.blue(`⚡ Running ${agentNames.length} agents in parallel...`));

      const promises = agentNames.map(async (agentName) => {
        const agent = this.agentManager.getAgent(agentName);
        if (!agent) {
          throw new Error(`Agent '${agentName}' not found`);
        }

        await agent.initialize();
        const result = await agent.run?.({
          id: `task-${Date.now()}`,
          type: 'user_request' as const,
          title: 'User Request',
          description: task,
          priority: 'medium' as const,
          status: 'pending' as const,
          data: { userInput: task },
          createdAt: new Date(),
          updatedAt: new Date(),
          progress: 0
        } as AgentTask);
        await agent.cleanup?.();

        return { agentName, result };
      });

      const results = await Promise.all(promises);

      console.log(chalk.green('✅ Parallel execution completed:'));
      results.forEach(({ agentName, result }) => {
        console.log(chalk.blue(`\n--- ${agentName} ---`));
        if (typeof result === 'string') {
          console.log(result);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
      });

    } catch (error: any) {
      console.log(chalk.red(`❌ Error in parallel execution: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  // File Operations
  private async readFileCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      console.log(chalk.red('Usage: /read <filepath>'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    try {
      const filePath = args[0];
      const fileInfo = await toolsManager.readFile(filePath);

      console.log(chalk.blue(`📄 File: ${filePath} (${fileInfo.size} bytes, ${fileInfo.language || 'unknown'})`));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(fileInfo.content);
      console.log(chalk.gray('─'.repeat(50)));

    } catch (error: any) {
      console.log(chalk.red(`❌ Error reading file: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async writeFileCommand(args: string[]): Promise<CommandResult> {
    if (args.length < 2) {
      console.log(chalk.red('Usage: /write <filepath> <content>'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    try {
      const filePath = args[0];
      const content = args.slice(1).join(' ');

      // Create FileDiff for approval
      const fileDiff = await DiffViewer.createFileDiff(filePath);
      fileDiff.newContent = content;

      // Request approval before writing
      const approved = await approvalSystem.requestFileApproval(
        `Write file: ${filePath}`,
        [fileDiff],
        'medium'
      );

      if (!approved) {
        console.log(chalk.yellow('❌ File write operation cancelled'));
        return { shouldExit: false, shouldUpdatePrompt: false };
      }

      // Create progress indicator
      const writeId = advancedUI.createIndicator('file-write', `Writing ${filePath}`).id;
      advancedUI.startSpinner(writeId, 'Writing file...');

      await toolsManager.writeFile(filePath, content);

      advancedUI.stopSpinner(writeId, true, `File written: ${filePath}`);
      console.log(chalk.green(`✅ File written: ${filePath}`));

    } catch (error: any) {
      advancedUI.logError(`Error writing file: ${error.message}`);
      console.log(chalk.red(`❌ Error writing file: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async editFileCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      console.log(chalk.red('Usage: /edit <filepath>'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    try {
      const filePath = args[0];
      console.log(chalk.blue(`📝 Use your system editor to edit: ${filePath}`));

      // Use system editor
      await toolsManager.runCommand('code', [filePath]);

    } catch (error: any) {
      console.log(chalk.red(`❌ Error opening editor: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async listFilesCommand(args: string[]): Promise<CommandResult> {
    try {
      const directory = args[0] || '.';
      const files = await toolsManager.listFiles(directory);

      console.log(chalk.blue(`📁 Files in ${directory}:`));
      console.log(chalk.gray('─'.repeat(40)));

      if (files.length === 0) {
        console.log(chalk.yellow('No files found'));
      } else {
        files.slice(0, 50).forEach(file => { // Limit to 50 files
          console.log(`${chalk.cyan('•')} ${file}`);
        });

        if (files.length > 50) {
          console.log(chalk.gray(`... and ${files.length - 50} more files`));
        }
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ Error listing files: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async searchCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      console.log(chalk.red('Usage: /search <query> [directory]'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    try {
      const query = args[0];
      const directory = args[1] || '.';

      console.log(chalk.blue(`🔍 Searching for "${query}" in ${directory}...`));

      const results = await toolsManager.searchInFiles(query, directory);

      if (results.length === 0) {
        console.log(chalk.yellow('No matches found'));
      } else {
        console.log(chalk.green(`Found ${results.length} matches:`));
        console.log(chalk.gray('─'.repeat(50)));

        results.slice(0, 20).forEach(result => { // Limit to 20 results
          console.log(chalk.cyan(`${result.file}:${result.line}`));
          console.log(`  ${result.content}`);
        });

        if (results.length > 20) {
          console.log(chalk.gray(`... and ${results.length - 20} more matches`));
        }
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ Error searching: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  // Terminal Operations
  private async runCommandCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      console.log(chalk.red('Usage: /run <command> [args...]'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    try {
      const [command, ...commandArgs] = args;
      const fullCommand = `${command} ${commandArgs.join(' ')}`;

      // Request approval for command execution
      const approved = await approvalSystem.requestCommandApproval(
        command,
        commandArgs,
        process.cwd()
      );

      if (!approved) {
        console.log(chalk.yellow('❌ Command execution cancelled'));
        return { shouldExit: false, shouldUpdatePrompt: false };
      }

      console.log(chalk.blue(`⚡ Running: ${fullCommand}`));

      // Create progress indicator
      const cmdId = advancedUI.createIndicator('command', `Executing: ${command}`).id;
      advancedUI.startSpinner(cmdId, `Running: ${fullCommand}`);

      const result = await toolsManager.runCommand(command, commandArgs, { stream: true });

      if (result.code === 0) {
        advancedUI.stopSpinner(cmdId, true, 'Command completed successfully');
        console.log(chalk.green('✅ Command completed successfully'));
      } else {
        advancedUI.stopSpinner(cmdId, false, `Command failed with exit code ${result.code}`);
        console.log(chalk.red(`❌ Command failed with exit code ${result.code}`));
      }

    } catch (error: any) {
      advancedUI.logError(`Error running command: ${error.message}`);
      console.log(chalk.red(`❌ Error running command: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async installCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      console.log(chalk.red('Usage: /install <packages...>'));
      console.log(chalk.gray('Options: --global, --dev, --yarn, --pnpm'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    try {
      const packages = args.filter(arg => !arg.startsWith('--'));
      const isGlobal = args.includes('--global') || args.includes('-g');
      const isDev = args.includes('--dev') || args.includes('-D');
      const manager = args.includes('--yarn') ? 'yarn' :
        args.includes('--pnpm') ? 'pnpm' : 'npm';

      // Request approval for package installation
      const approved = await approvalSystem.requestPackageApproval(
        packages,
        manager,
        isGlobal
      );

      if (!approved) {
        console.log(chalk.yellow('❌ Package installation cancelled'));
        return { shouldExit: false, shouldUpdatePrompt: false };
      }

      console.log(chalk.blue(`📦 Installing ${packages.join(', ')} with ${manager}...`));

      // Create progress indicator
      const installId = advancedUI.createIndicator('install', `Installing packages`).id;
      advancedUI.createProgressBar(installId, 'Installing packages', packages.length);

      for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];
        advancedUI.updateSpinner(installId, `Installing ${pkg}...`);

        const success = await toolsManager.installPackage(pkg, {
          global: isGlobal,
          dev: isDev,
          manager: manager as any
        });

        if (!success) {
          advancedUI.logWarning(`Failed to install ${pkg}`);
          console.log(chalk.yellow(`⚠️ Failed to install ${pkg}`));
        } else {
          advancedUI.logSuccess(`Installed ${pkg}`);
        }

        advancedUI.updateProgress(installId, i + 1, packages.length);
      }

      advancedUI.completeProgress(installId, `Completed installation of ${packages.length} packages`);
      console.log(chalk.green(`✅ Package installation completed`));

    } catch (error: any) {
      advancedUI.logError(`Error installing packages: ${error.message}`);
      console.log(chalk.red(`❌ Error installing packages: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async npmCommand(args: string[]): Promise<CommandResult> {
    return await this.runCommandCommand(['npm', ...args]);
  }

  private async yarnCommand(args: string[]): Promise<CommandResult> {
    return await this.runCommandCommand(['yarn', ...args]);
  }

  private async gitCommand(args: string[]): Promise<CommandResult> {
    return await this.runCommandCommand(['git', ...args]);
  }

  private async dockerCommand(args: string[]): Promise<CommandResult> {
    return await this.runCommandCommand(['docker', ...args]);
  }

  private async processCommand(): Promise<CommandResult> {
    try {
      const processes = toolsManager.getRunningProcesses();

      console.log(chalk.blue('🔄 Running Processes:'));
      console.log(chalk.gray('─'.repeat(50)));

      if (processes.length === 0) {
        console.log(chalk.yellow('No processes currently running'));
      } else {
        processes.forEach(proc => {
          const duration = Date.now() - proc.startTime.getTime();
          console.log(`${chalk.cyan('PID')} ${proc.pid}: ${chalk.bold(proc.command)} ${proc.args.join(' ')}`);
          console.log(`  Status: ${proc.status} | Duration: ${Math.round(duration / 1000)}s`);
          console.log(`  Working Dir: ${proc.cwd}`);
        });
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ Error listing processes: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async killCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      console.log(chalk.red('Usage: /kill <pid>'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    try {
      const pid = parseInt(args[0]);
      if (isNaN(pid)) {
        console.log(chalk.red('Invalid PID'));
        return { shouldExit: false, shouldUpdatePrompt: false };
      }

      console.log(chalk.yellow(`⚠️ Attempting to kill process ${pid}...`));

      const success = await toolsManager.killProcess(pid);

      if (success) {
        console.log(chalk.green(`✅ Process ${pid} terminated`));
      } else {
        console.log(chalk.red(`❌ Could not kill process ${pid}`));
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ Error killing process: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  // Project Operations
  private async buildCommand(): Promise<CommandResult> {
    try {
      console.log(chalk.blue('🔨 Building project...'));

      const result = await toolsManager.build();

      if (result.success) {
        console.log(chalk.green('✅ Build completed successfully'));
      } else {
        console.log(chalk.red('❌ Build failed'));
        if (result.errors && result.errors.length > 0) {
          console.log(chalk.yellow('Errors found:'));
          result.errors.forEach(error => {
            console.log(`  ${chalk.red('•')} ${error.message}`);
          });
        }
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ Error building: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async testCommand(args: string[]): Promise<CommandResult> {
    try {
      const pattern = args[0];
      console.log(chalk.blue(`🧪 Running tests${pattern ? ` (${pattern})` : ''}...`));

      const result = await toolsManager.runTests(pattern);

      if (result.success) {
        console.log(chalk.green('✅ All tests passed'));
      } else {
        console.log(chalk.red('❌ Some tests failed'));
        if (result.errors && result.errors.length > 0) {
          console.log(chalk.yellow('Test errors:'));
          result.errors.forEach(error => {
            console.log(`  ${chalk.red('•')} ${error.message}`);
          });
        }
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ Error running tests: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async lintCommand(): Promise<CommandResult> {
    try {
      console.log(chalk.blue('🔍 Running linter...'));

      const result = await toolsManager.lint();

      if (result.success) {
        console.log(chalk.green('✅ No linting errors found'));
      } else {
        console.log(chalk.yellow('⚠️ Linting issues found'));
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach(error => {
            const severity = error.severity === 'error' ? chalk.red('ERROR') : chalk.yellow('WARNING');
            console.log(`  ${severity}: ${error.message}`);
          });
        }
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ Error running linter: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async createProjectCommand(args: string[]): Promise<CommandResult> {
    if (args.length < 2) {
      console.log(chalk.red('Usage: /create <type> <name>'));
      console.log(chalk.gray('Types: react, next, node, express'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    try {
      const [type, name] = args;
      console.log(chalk.blue(`🚀 Creating ${type} project: ${name}`));

      const result = await toolsManager.setupProject(type as any, name);

      if (result.success) {
        console.log(chalk.green(`✅ Project ${name} created successfully!`));
        console.log(chalk.gray(`📁 Location: ${result.path}`));
      } else {
        console.log(chalk.red(`❌ Failed to create project ${name}`));
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ Error creating project: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  // Agent Factory Commands
  private async factoryCommand(): Promise<CommandResult> {
    agentFactory.showFactoryDashboard();
    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async createAgentCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      console.log(chalk.red('Usage: /create-agent <specialization>'));
      console.log(chalk.gray('Example: /create-agent "React Testing Expert"'));
      console.log(chalk.gray('Example: /create-agent "API Integration Specialist"'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    try {
      const specialization = args.join(' ');

      const blueprint = await agentFactory.createAgentBlueprint({
        specialization,
        autonomyLevel: 'fully-autonomous',
        contextScope: 'project',
      });

      console.log(chalk.green(`✅ Agent blueprint created: ${blueprint.name}`));
      console.log(chalk.gray(`Blueprint ID: ${blueprint.id}`));
      console.log(chalk.gray('Use /launch-agent <id> to launch this agent'));

    } catch (error: any) {
      console.log(chalk.red(`❌ Error creating agent: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async launchAgentCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      console.log(chalk.red('Usage: /launch-agent <blueprint-id> [task]'));
      console.log(chalk.gray('Use /factory to see available blueprints'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    try {
      const blueprintId = args[0];
      const task = args.slice(1).join(' ');

      const agent = await agentFactory.launchAgent(blueprintId);

      if (task) {
        console.log(chalk.blue(`🚀 Running agent with task: ${task}`));
        const result = await agent.run(task);
        console.log(chalk.green('✅ Agent execution completed:'));
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.blue('🤖 Agent launched and ready'));
        console.log(chalk.gray('Use /agent <name> <task> to run tasks'));
      }

    } catch (error: any) {
      console.log(chalk.red(`❌ Error launching agent: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async contextCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      workspaceContext.showContextSummary();
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    try {
      const paths = args;
      await workspaceContext.selectPaths(paths);

      console.log(chalk.green('✅ Workspace context updated'));
      console.log(chalk.gray('Use /context with no args to see current context'));

    } catch (error: any) {
      console.log(chalk.red(`❌ Error updating context: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  // Planning and Todo Commands
  private async planCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      // Show plan status
      enhancedPlanning.showPlanStatus();
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    const subcommand = args[0].toLowerCase();
    const restArgs = args.slice(1);

    try {
      switch (subcommand) {
        case 'create':
        case 'generate': {
          if (restArgs.length === 0) {
            console.log(chalk.red('Usage: /plan create <goal>'));
            console.log(chalk.gray('Example: /plan create "Create a React todo app with backend"'));
            return { shouldExit: false, shouldUpdatePrompt: false };
          }

          const goal = restArgs.join(' ');
          console.log(chalk.blue(`🎯 Creating plan for: ${goal}`));

          const plan = await enhancedPlanning.generatePlan(goal, {
            maxTodos: 15,
            includeContext: true,
            showDetails: true,
            saveTodoFile: true,
          });

          console.log(chalk.green(`✅ Plan created with ${plan.todos.length} todos`));
          console.log(chalk.cyan(`📝 Plan ID: ${plan.id}`));
          console.log(chalk.gray('Use /plan execute to run the plan or /plan approve to review it'));
          break;
        }

        case 'execute':
        case 'run': {
          const planId = restArgs[0];
          if (!planId) {
            // Get the most recent plan
            const plans = enhancedPlanning.getActivePlans();
            const latestPlan = plans[plans.length - 1];

            if (!latestPlan) {
              console.log(chalk.yellow('No active plans found. Create one with /plan create <goal>'));
              return { shouldExit: false, shouldUpdatePrompt: false };
            }

            console.log(chalk.blue(`Executing latest plan: ${latestPlan.title}`));
            await enhancedPlanning.executePlan(latestPlan.id);
          } else {
            await enhancedPlanning.executePlan(planId);
          }
          break;
        }

        case 'approve': {
          const planId = restArgs[0];
          if (!planId) {
            const plans = enhancedPlanning.getActivePlans().filter(p => p.status === 'draft');
            if (plans.length === 0) {
              console.log(chalk.yellow('No plans pending approval'));
              return { shouldExit: false, shouldUpdatePrompt: false };
            }

            const latestPlan = plans[plans.length - 1];
            console.log(chalk.blue(`Reviewing latest plan: ${latestPlan.title}`));
            await enhancedPlanning.requestPlanApproval(latestPlan.id);
          } else {
            await enhancedPlanning.requestPlanApproval(planId);
          }
          break;
        }

        case 'show':
        case 'status': {
          const planId = restArgs[0];
          enhancedPlanning.showPlanStatus(planId);
          break;
        }

        case 'list': {
          const plans = enhancedPlanning.getActivePlans();
          if (plans.length === 0) {
            console.log(chalk.gray('No active plans'));
          } else {
            console.log(chalk.blue.bold('Active Plans:'));
            plans.forEach((plan, index) => {
              const statusIcon = plan.status === 'completed' ? '✅' :
                plan.status === 'executing' ? '🔄' :
                  plan.status === 'approved' ? '🟢' :
                    plan.status === 'failed' ? '❌' : '⏳';
              console.log(`  ${index + 1}. ${statusIcon} ${plan.title} (${plan.todos.length} todos)`);
              console.log(`     Status: ${plan.status} | Created: ${plan.createdAt.toLocaleDateString()}`);
            });
          }
          break;
        }

        default:
          console.log(chalk.red(`Unknown plan command: ${subcommand}`));
          console.log(chalk.gray('Available commands: create, execute, approve, show, list'));
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ Plan command failed: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async todoCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      console.log(chalk.blue('Usage: /todo <command>'));
      console.log(chalk.gray('Commands: list, show, open, edit'));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    const subcommand = args[0].toLowerCase();

    try {
      switch (subcommand) {
        case 'list':
        case 'ls': {
          const plans = enhancedPlanning.getActivePlans();
          if (plans.length === 0) {
            console.log(chalk.gray('No todo lists found'));
            return { shouldExit: false, shouldUpdatePrompt: false };
          }

          console.log(chalk.blue.bold('Todo Lists:'));
          plans.forEach((plan, index) => {
            console.log(`\n${index + 1}. ${chalk.bold(plan.title)}`);
            console.log(`   Status: ${plan.status} | Todos: ${plan.todos.length}`);

            const completed = plan.todos.filter(t => t.status === 'completed').length;
            const inProgress = plan.todos.filter(t => t.status === 'in_progress').length;
            const pending = plan.todos.filter(t => t.status === 'pending').length;
            const failed = plan.todos.filter(t => t.status === 'failed').length;

            console.log(`   ✅ ${completed} | 🔄 ${inProgress} | ⏳ ${pending} | ❌ ${failed}`);
          });
          break;
        }

        case 'show': {
          const planId = args[1];
          if (!planId) {
            const plans = enhancedPlanning.getActivePlans();
            const latestPlan = plans[plans.length - 1];
            if (latestPlan) {
              // Render structured panel with real todos
              try {
                const { advancedUI } = await import('../ui/advanced-cli-ui');
                const todoItems = latestPlan.todos.map((t: any) => ({ content: t.title || t.description, status: t.status }));
                (advancedUI as any).showTodos?.(todoItems, latestPlan.title || 'Update Todos');
              } catch { }
              enhancedPlanning.showPlanStatus(latestPlan.id);
            } else {
              console.log(chalk.yellow('No todo lists found'));
            }
          } else {
            const plans = enhancedPlanning.getActivePlans();
            const target = plans.find(p => p.id === planId);
            if (target) {
              try {
                const { advancedUI } = await import('../ui/advanced-cli-ui');
                const todoItems = target.todos.map((t: any) => ({ content: t.title || t.description, status: t.status }));
                (advancedUI as any).showTodos?.(todoItems, target.title || 'Update Todos');
              } catch { }
            }
            enhancedPlanning.showPlanStatus(planId);
          }
          break;
        }

        case 'open':
        case 'edit': {
          const todoPath = 'todo.md';
          console.log(chalk.blue(`Opening ${todoPath} in your default editor...`));
          try {
            await toolsManager.runCommand('code', [todoPath]);
          } catch {
            try {
              await toolsManager.runCommand('open', [todoPath]);
            } catch {
              console.log(chalk.yellow(`Could not open ${todoPath}. Please open it manually.`));
            }
          }
          break;
        }

        default:
          console.log(chalk.red(`Unknown todo command: ${subcommand}`));
          console.log(chalk.gray('Available commands: list, show, open, edit'));
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ Todo command failed: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async todosCommand(args: string[]): Promise<CommandResult> {
    // Alias for /todo list
    return await this.todoCommand(['list', ...args]);
  }

  private async approvalCommand(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      console.log(chalk.blue('Approval System Configuration:'));
      const config = approvalSystem.getConfig();
      console.log(JSON.stringify(config, null, 2));
      return { shouldExit: false, shouldUpdatePrompt: false };
    }

    const subcommand = args[0].toLowerCase();

    try {
      switch (subcommand) {
        case 'auto-approve': {
          const type = args[1];
          const enabled = args[2] === 'true' || args[2] === 'on';

          if (!type) {
            console.log(chalk.red('Usage: /approval auto-approve <type> <on|off>'));
            console.log(chalk.gray('Types: low-risk, medium-risk, file-operations, package-installs'));
            return { shouldExit: false, shouldUpdatePrompt: false };
          }

          const currentConfig = approvalSystem.getConfig();
          const newConfig = { ...currentConfig };

          switch (type) {
            case 'low-risk':
              newConfig.autoApprove!.lowRisk = enabled;
              break;
            case 'medium-risk':
              newConfig.autoApprove!.mediumRisk = enabled;
              break;
            case 'file-operations':
              newConfig.autoApprove!.fileOperations = enabled;
              break;
            case 'package-installs':
              newConfig.autoApprove!.packageInstalls = enabled;
              break;
            default:
              console.log(chalk.red(`Unknown approval type: ${type}`));
              return { shouldExit: false, shouldUpdatePrompt: false };
          }

          approvalSystem.updateConfig(newConfig);
          console.log(chalk.green(`✅ Auto-approval for ${type} ${enabled ? 'enabled' : 'disabled'}`));
          break;
        }

        case 'test': {
          console.log(chalk.blue('Testing approval system...'));
          const approved = await approvalSystem.quickApproval(
            'Test Approval',
            'This is a test of the approval system',
            'low'
          );
          console.log(approved ? chalk.green('Approved') : chalk.yellow('Cancelled'));
          break;
        }

        default:
          console.log(chalk.red(`Unknown approval command: ${subcommand}`));
          console.log(chalk.gray('Available commands: auto-approve, test'));
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ Approval command failed: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async streamCommand(args: string[]): Promise<CommandResult> {
    if (args.length > 0 && args[0] === 'clear') {
      const activeAgents = agentStream.getActiveAgents();
      activeAgents.forEach(agentId => {
        agentStream.clearAgentStream(agentId);
      });
      console.log(chalk.green('✅ All agent streams cleared'));
    } else {
      agentStream.showLiveDashboard();
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  // Security Commands Implementation

  private async securityCommand(args: string[]): Promise<CommandResult> {
    const subcommand = args[0] || 'status';

    try {
      switch (subcommand) {
        case 'status': {
          const securityStatus = toolService.getSecurityStatus();
          const config = simpleConfigManager.getAll();
          
          console.log(chalk.cyan.bold('\n🔒 Security Status'));
          console.log(chalk.gray('═'.repeat(50)));
          console.log(`${chalk.blue('Security Mode:')} ${this.formatSecurityMode(securityStatus.mode)}`);
          console.log(`${chalk.blue('Developer Mode:')} ${securityStatus.devModeActive ? chalk.yellow('Active') : chalk.gray('Inactive')}`);
          console.log(`${chalk.blue('Session Approvals:')} ${securityStatus.sessionApprovals}`);
          console.log(`${chalk.blue('Approval Policy:')} ${config.approvalPolicy}`);
          
          console.log(chalk.cyan.bold('\n📋 Tool Policies:'));
          console.log(`${chalk.blue('File Operations:')} ${config.toolApprovalPolicies.fileOperations}`);
          console.log(`${chalk.blue('Git Operations:')} ${config.toolApprovalPolicies.gitOperations}`);
          console.log(`${chalk.blue('Package Operations:')} ${config.toolApprovalPolicies.packageOperations}`);
          console.log(`${chalk.blue('System Commands:')} ${config.toolApprovalPolicies.systemCommands}`);
          console.log(`${chalk.blue('Network Requests:')} ${config.toolApprovalPolicies.networkRequests}`);
          
          console.log(chalk.cyan.bold('\n🛠️ Tools by Risk Level:'));
          const tools = toolService.getAvailableToolsWithSecurity();
          const lowRisk = tools.filter(t => t.riskLevel === 'low');
          const medRisk = tools.filter(t => t.riskLevel === 'medium');
          const highRisk = tools.filter(t => t.riskLevel === 'high');
          
          console.log(`${chalk.green('Low Risk:')} ${lowRisk.map(t => t.name).join(', ')}`);
          console.log(`${chalk.yellow('Medium Risk:')} ${medRisk.map(t => t.name).join(', ')}`);
          console.log(`${chalk.red('High Risk:')} ${highRisk.map(t => t.name).join(', ')}`);
          break;
        }

        case 'set': {
          if (args.length < 3) {
            console.log(chalk.yellow('Usage: /security set <mode> <value>'));
            console.log(chalk.gray('Available modes: security-mode, file-ops, git-ops, package-ops, system-cmds, network-reqs'));
            break;
          }

          const mode = args[1];
          const value = args[2];
          const config = simpleConfigManager.getAll();
          
          switch (mode) {
            case 'security-mode':
              if (['safe', 'default', 'developer'].includes(value)) {
                simpleConfigManager.set('securityMode', value as 'safe' | 'default' | 'developer');
                console.log(chalk.green(`✅ Security mode set to: ${value}`));
              } else {
                console.log(chalk.red('❌ Invalid mode. Use: safe, default, or developer'));
              }
              break;
            
            case 'file-ops':
            case 'git-ops':
            case 'package-ops':
            case 'system-cmds':
            case 'network-reqs':
              if (['always', 'risky', 'never'].includes(value)) {
                const policyKey = mode.replace('-', '').replace('ops', 'Operations').replace('cmds', 'Commands').replace('reqs', 'Requests');
                const keyMap: Record<string, string> = {
                  'fileOperations': 'fileOperations',
                  'gitOperations': 'gitOperations',
                  'packageOperations': 'packageOperations',
                  'systemCommands': 'systemCommands',
                  'networkRequests': 'networkRequests'
                };
                config.toolApprovalPolicies[keyMap[policyKey] as keyof typeof config.toolApprovalPolicies] = value as any;
                simpleConfigManager.setAll(config);
                console.log(chalk.green(`✅ ${mode} policy set to: ${value}`));
              } else {
                console.log(chalk.red('❌ Invalid value. Use: always, risky, or never'));
              }
              break;
            
            default:
              console.log(chalk.red(`❌ Unknown setting: ${mode}`));
          }
          break;
        }

        case 'help':
          console.log(chalk.cyan.bold('\n🔒 Security Command Help'));
          console.log(chalk.gray('─'.repeat(40)));
          console.log(`${chalk.green('/security status')} - Show current security settings`);
          console.log(`${chalk.green('/security set <mode> <value>')} - Change security settings`);
          console.log(`${chalk.green('/security help')} - Show this help`);
          console.log(chalk.cyan('\nSecurity Modes:'));
          console.log(`${chalk.green('safe')} - Maximum security, approval for most operations`);
          console.log(`${chalk.yellow('default')} - Balanced security, approval for risky operations`);
          console.log(`${chalk.red('developer')} - Minimal security, approval only for dangerous operations`);
          break;

        default:
          console.log(chalk.red(`Unknown security command: ${subcommand}`));
          console.log(chalk.gray('Use /security help for available commands'));
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ Security command failed: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async devModeCommand(args: string[]): Promise<CommandResult> {
    const action = args[0] || 'enable';
    
    try {
      switch (action) {
        case 'enable': {
          const timeoutMs = args[1] ? parseInt(args[1]) * 60000 : undefined; // Convert minutes to ms
          toolService.enableDevMode(timeoutMs);
          const timeout = timeoutMs ? ` for ${args[1]} minutes` : ' for 1 hour (default)';
          console.log(chalk.yellow(`🛠️ Developer mode enabled${timeout}`));
          console.log(chalk.gray('Reduced security restrictions active. Use /security status to see current settings.'));
          break;
        }
        
        case 'status': {
          const isActive = toolService.isDevModeActive();
          console.log(chalk.cyan.bold('\n🛠️ Developer Mode Status'));
          console.log(chalk.gray('─'.repeat(30)));
          console.log(`${chalk.blue('Status:')} ${isActive ? chalk.yellow('Active') : chalk.gray('Inactive')}`);
          if (isActive) {
            console.log(chalk.yellow('⚠️ Security restrictions are reduced'));
          }
          break;
        }
        
        case 'help':
          console.log(chalk.cyan.bold('\n🛠️ Developer Mode Commands'));
          console.log(chalk.gray('─'.repeat(35)));
          console.log(`${chalk.green('/dev-mode enable [minutes]')} - Enable developer mode`);
          console.log(`${chalk.green('/dev-mode status')} - Check developer mode status`);
          console.log(`${chalk.green('/dev-mode help')} - Show this help`);
          console.log(chalk.yellow('\n⚠️ Developer mode reduces security restrictions'));
          break;
          
        default:
          console.log(chalk.red(`Unknown dev-mode command: ${action}`));
          console.log(chalk.gray('Use /dev-mode help for available commands'));
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ Dev-mode command failed: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async safeModeCommand(args: string[]): Promise<CommandResult> {
    try {
      const config = simpleConfigManager.getAll();
      config.securityMode = 'safe';
      simpleConfigManager.setAll(config);
      console.log(chalk.green('🔒 Safe mode enabled - maximum security restrictions'));
      console.log(chalk.gray('All risky operations will require approval. Use /security status to see details.'));
    } catch (error: any) {
      console.log(chalk.red(`❌ Safe mode command failed: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private async clearApprovalsCommand(args: string[]): Promise<CommandResult> {
    try {
      toolService.clearSessionApprovals();
      console.log(chalk.green('✅ All session approvals cleared'));
      console.log(chalk.gray('Next operations will require fresh approval'));
    } catch (error: any) {
      console.log(chalk.red(`❌ Clear approvals command failed: ${error.message}`));
    }

    return { shouldExit: false, shouldUpdatePrompt: false };
  }

  private formatSecurityMode(mode: string): string {
    switch (mode) {
      case 'safe':
        return chalk.green('🔒 Safe');
      case 'default':
        return chalk.yellow('🛡️ Default');
      case 'developer':
        return chalk.red('🛠️ Developer');
      default:
        return chalk.gray(mode);
    }
  }
}