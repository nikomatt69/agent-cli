import chalk from 'chalk';
import { chatManager } from './chat-manager';
import { configManager } from '../config/config-manager';
import { modelProvider } from '../ai/model-provider';
import { AgentManager } from '../agents/agent-manager';
import { registerAgents } from '../register-agents';
import { toolsManager } from '../tools/tools-manager';
import { agentFactory } from '../core/agent-factory';
import { workspaceContext } from '../core/workspace-context';
import { agentStream } from '../core/agent-stream';

export interface CommandResult {
  shouldExit: boolean;
  shouldUpdatePrompt: boolean;
}

export class SlashCommandHandler {
  private commands: Map<string, (args: string[]) => Promise<CommandResult>> = new Map();
  private agentManager: AgentManager;

  constructor() {
    this.agentManager = new AgentManager();
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
    this.commands.set('agent', this.agentCommand.bind(this));
    this.commands.set('agents', this.listAgentsCommand.bind(this));
    this.commands.set('auto', this.autonomousCommand.bind(this));
    this.commands.set('parallel', this.parallelCommand.bind(this));
    this.commands.set('factory', this.factoryCommand.bind(this));
    this.commands.set('create-agent', this.createAgentCommand.bind(this));
    this.commands.set('launch-agent', this.launchAgentCommand.bind(this));
    this.commands.set('context', this.contextCommand.bind(this));
    this.commands.set('stream', this.streamCommand.bind(this));
    
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
    configManager.showConfig();
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
      const result = await agent.run(task);
      await agent.cleanup();

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
        const result = await agent.run(task);
        await agent.cleanup();
        
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
      
      await toolsManager.writeFile(filePath, content);
      console.log(chalk.green(`✅ File written: ${filePath}`));
      
    } catch (error: any) {
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
      console.log(chalk.blue(`⚡ Running: ${command} ${commandArgs.join(' ')}`));
      
      const result = await toolsManager.runCommand(command, commandArgs, { stream: true });
      
      if (result.code === 0) {
        console.log(chalk.green('✅ Command completed successfully'));
      } else {
        console.log(chalk.red(`❌ Command failed with exit code ${result.code}`));
      }
      
    } catch (error: any) {
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

      console.log(chalk.blue(`📦 Installing ${packages.join(', ')} with ${manager}...`));
      
      for (const pkg of packages) {
        const success = await toolsManager.installPackage(pkg, { global: isGlobal, dev: isDev, manager: manager as any });
        if (!success) {
          console.log(chalk.yellow(`⚠️ Failed to install ${pkg}`));
        }
      }
      
    } catch (error: any) {
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
}