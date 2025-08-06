"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlashCommandHandler = void 0;
const chalk_1 = __importDefault(require("chalk"));
const chat_manager_1 = require("./chat-manager");
const config_manager_1 = require("../config/config-manager");
const model_provider_1 = require("../ai/model-provider");
const agent_manager_1 = require("../agents/agent-manager");
const register_agents_1 = require("../register-agents");
const tools_manager_1 = require("../tools/tools-manager");
const agent_factory_1 = require("../core/agent-factory");
const workspace_context_1 = require("../core/workspace-context");
const agent_stream_1 = require("../core/agent-stream");
class SlashCommandHandler {
    constructor() {
        this.commands = new Map();
        this.agentManager = new agent_manager_1.AgentManager();
        (0, register_agents_1.registerAgents)(this.agentManager);
        this.registerCommands();
    }
    registerCommands() {
        this.commands.set('help', this.helpCommand.bind(this));
        this.commands.set('quit', this.quitCommand.bind(this));
        this.commands.set('exit', this.quitCommand.bind(this));
        this.commands.set('clear', this.clearCommand.bind(this));
        this.commands.set('model', this.modelCommand.bind(this));
        this.commands.set('models', this.modelsCommand.bind(this));
        this.commands.set('set-key', this.setKeyCommand.bind(this));
        this.commands.set('config', this.configCommand.bind(this));
        this.commands.set('debug', this.debugCommand.bind(this));
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
    async handle(input) {
        const parts = input.slice(1).split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);
        const handler = this.commands.get(command);
        if (!handler) {
            console.log(chalk_1.default.red(`❌ Unknown command: ${command}`));
            console.log(chalk_1.default.gray('Type /help for available commands'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        return await handler(args);
    }
    async helpCommand() {
        const help = `
${chalk_1.default.blue.bold('🔧 Available Commands:')}
${chalk_1.default.gray('─'.repeat(40))}

${chalk_1.default.cyan('/help')} - Show this help message
${chalk_1.default.cyan('/quit, /exit')} - Exit the chat
${chalk_1.default.cyan('/clear')} - Clear current chat session
${chalk_1.default.cyan('/new [title]')} - Start a new chat session

${chalk_1.default.blue.bold('Model Management:')}
${chalk_1.default.cyan('/model <name>')} - Switch to a model
${chalk_1.default.cyan('/models')} - List available models
${chalk_1.default.cyan('/set-key <model> <key>')} - Set API key for a model

${chalk_1.default.blue.bold('Configuration:')}
${chalk_1.default.cyan('/config')} - Show current configuration
${chalk_1.default.cyan('/debug')} - Debug API key configuration
${chalk_1.default.cyan('/temp <0.0-2.0>')} - Set temperature (creativity)
${chalk_1.default.cyan('/history <on|off>')} - Enable/disable chat history
${chalk_1.default.cyan('/system <prompt>')} - Set system prompt for current session

${chalk_1.default.blue.bold('Session Management:')}
${chalk_1.default.cyan('/sessions')} - List all chat sessions
${chalk_1.default.cyan('/export [sessionId]')} - Export session to markdown
${chalk_1.default.cyan('/stats')} - Show usage statistics

${chalk_1.default.blue.bold('Agent Management:')}
${chalk_1.default.cyan('/agents')} - List all available agents
${chalk_1.default.cyan('/agent <name> <task>')} - Run specific agent with task
${chalk_1.default.cyan('/auto <description>')} - Autonomous multi-agent execution
${chalk_1.default.cyan('/parallel <agents> <task>')} - Run multiple agents in parallel
${chalk_1.default.cyan('/factory')} - Show agent factory dashboard
${chalk_1.default.cyan('/create-agent <specialization>')} - Create new specialized agent
${chalk_1.default.cyan('/launch-agent <blueprint-id>')} - Launch agent from blueprint
${chalk_1.default.cyan('/context <paths>')} - Select workspace context paths
${chalk_1.default.cyan('/stream')} - Show live agent stream dashboard

${chalk_1.default.blue.bold('File Operations:')}
${chalk_1.default.cyan('/read <file>')} - Read file contents
${chalk_1.default.cyan('/write <file> <content>')} - Write content to file
${chalk_1.default.cyan('/edit <file>')} - Edit file interactively
${chalk_1.default.cyan('/ls [directory]')} - List files in directory
${chalk_1.default.cyan('/search <query>')} - Search in files (like grep)

${chalk_1.default.blue.bold('Terminal Commands:')}
${chalk_1.default.cyan('/run <command>')} - Execute any terminal command
${chalk_1.default.cyan('/install <packages>')} - Install npm/yarn packages
${chalk_1.default.cyan('/npm <args>')} - Run npm commands
${chalk_1.default.cyan('/yarn <args>')} - Run yarn commands
${chalk_1.default.cyan('/git <args>')} - Run git commands
${chalk_1.default.cyan('/docker <args>')} - Run docker commands
${chalk_1.default.cyan('/ps')} - List running processes
${chalk_1.default.cyan('/kill <pid>')} - Kill process by PID

${chalk_1.default.blue.bold('Project Commands:')}
${chalk_1.default.cyan('/build')} - Build the project
${chalk_1.default.cyan('/test [pattern]')} - Run tests
${chalk_1.default.cyan('/lint')} - Run linting
${chalk_1.default.cyan('/create <type> <name>')} - Create new project

${chalk_1.default.gray('Tip: Use Ctrl+C to stop streaming responses')}
    `;
        console.log(help);
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async quitCommand() {
        console.log(chalk_1.default.yellow('👋 Thanks for using AI Coder CLI!'));
        return { shouldExit: true, shouldUpdatePrompt: false };
    }
    async clearCommand() {
        chat_manager_1.chatManager.clearCurrentSession();
        console.log(chalk_1.default.green('✅ Chat history cleared'));
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async modelCommand(args) {
        if (args.length === 0) {
            const current = model_provider_1.modelProvider.getCurrentModelInfo();
            console.log(chalk_1.default.green(`Current model: ${current.name} (${current.config.provider})`));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const modelName = args[0];
        try {
            config_manager_1.configManager.setCurrentModel(modelName);
            // Validate the new model
            if (model_provider_1.modelProvider.validateApiKey()) {
                console.log(chalk_1.default.green(`✅ Switched to model: ${modelName}`));
                return { shouldExit: false, shouldUpdatePrompt: true };
            }
            else {
                console.log(chalk_1.default.yellow(`⚠️  Switched to model: ${modelName} (API key needed)`));
                return { shouldExit: false, shouldUpdatePrompt: true };
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ ${error.message}`));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
    }
    async modelsCommand() {
        console.log(chalk_1.default.blue.bold('\n🤖 Available Models:'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        const currentModel = config_manager_1.configManager.get('currentModel');
        const models = config_manager_1.configManager.get('models');
        Object.entries(models).forEach(([name, config]) => {
            const isCurrent = name === currentModel;
            const hasKey = config_manager_1.configManager.getApiKey(name) !== undefined;
            const status = hasKey ? chalk_1.default.green('✅') : chalk_1.default.red('❌');
            const prefix = isCurrent ? chalk_1.default.yellow('→ ') : '  ';
            console.log(`${prefix}${status} ${chalk_1.default.bold(name)}`);
            console.log(`    ${chalk_1.default.gray(`Provider: ${config.provider} | Model: ${config.model}`)}`);
        });
        console.log(chalk_1.default.gray('\nUse /model <name> to switch models'));
        console.log(chalk_1.default.gray('Use /set-key <model> <key> to add API keys'));
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async setKeyCommand(args) {
        if (args.length < 2) {
            console.log(chalk_1.default.red('Usage: /set-key <model> <api-key>'));
            console.log(chalk_1.default.gray('Example: /set-key claude-3-5-sonnet sk-ant-...'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const [modelName, apiKey] = args;
        try {
            config_manager_1.configManager.setApiKey(modelName, apiKey);
            console.log(chalk_1.default.green(`✅ API key set for ${modelName}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async configCommand() {
        config_manager_1.configManager.showConfig();
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async debugCommand() {
        config_manager_1.configManager.debugApiKeys();
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async newSessionCommand(args) {
        const title = args.join(' ') || undefined;
        const session = chat_manager_1.chatManager.createNewSession(title);
        console.log(chalk_1.default.green(`✅ New session created: ${session.title} (${session.id.slice(0, 8)})`));
        return { shouldExit: false, shouldUpdatePrompt: true };
    }
    async sessionsCommand() {
        const sessions = chat_manager_1.chatManager.listSessions();
        const current = chat_manager_1.chatManager.getCurrentSession();
        console.log(chalk_1.default.blue.bold('\n📝 Chat Sessions:'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        if (sessions.length === 0) {
            console.log(chalk_1.default.gray('No sessions found'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        sessions.forEach((session, index) => {
            const isCurrent = session.id === current?.id;
            const prefix = isCurrent ? chalk_1.default.yellow('→ ') : '  ';
            const messageCount = session.messages.filter(m => m.role !== 'system').length;
            console.log(`${prefix}${chalk_1.default.bold(session.title)} ${chalk_1.default.gray(`(${session.id.slice(0, 8)})`)}`);
            console.log(`    ${chalk_1.default.gray(`${messageCount} messages | ${session.updatedAt.toLocaleString()}`)}`);
        });
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async exportCommand(args) {
        try {
            const sessionId = args[0];
            const markdown = chat_manager_1.chatManager.exportSession(sessionId);
            const filename = `chat-export-${Date.now()}.md`;
            require('fs').writeFileSync(filename, markdown);
            console.log(chalk_1.default.green(`✅ Session exported to ${filename}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async systemCommand(args) {
        if (args.length === 0) {
            const session = chat_manager_1.chatManager.getCurrentSession();
            console.log(chalk_1.default.green('Current system prompt:'));
            console.log(chalk_1.default.gray(session?.systemPrompt || 'None'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const prompt = args.join(' ');
        const session = chat_manager_1.chatManager.getCurrentSession();
        if (session) {
            session.systemPrompt = prompt;
            // Update the system message
            const systemMsgIndex = session.messages.findIndex(m => m.role === 'system');
            if (systemMsgIndex >= 0) {
                session.messages[systemMsgIndex].content = prompt;
            }
            else {
                session.messages.unshift({
                    role: 'system',
                    content: prompt,
                    timestamp: new Date(),
                });
            }
            console.log(chalk_1.default.green('✅ System prompt updated'));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async statsCommand() {
        const stats = chat_manager_1.chatManager.getSessionStats();
        const modelInfo = model_provider_1.modelProvider.getCurrentModelInfo();
        console.log(chalk_1.default.blue.bold('\n📊 Usage Statistics:'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        console.log(chalk_1.default.green(`Current Model: ${modelInfo.name}`));
        console.log(chalk_1.default.green(`Total Sessions: ${stats.totalSessions}`));
        console.log(chalk_1.default.green(`Total Messages: ${stats.totalMessages}`));
        console.log(chalk_1.default.green(`Current Session Messages: ${stats.currentSessionMessages}`));
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async temperatureCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.green(`Current temperature: ${config_manager_1.configManager.get('temperature')}`));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const temp = parseFloat(args[0]);
        if (isNaN(temp) || temp < 0 || temp > 2) {
            console.log(chalk_1.default.red('Temperature must be between 0.0 and 2.0'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        config_manager_1.configManager.set('temperature', temp);
        console.log(chalk_1.default.green(`✅ Temperature set to ${temp}`));
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async historyCommand(args) {
        if (args.length === 0) {
            const enabled = config_manager_1.configManager.get('chatHistory');
            console.log(chalk_1.default.green(`Chat history: ${enabled ? 'enabled' : 'disabled'}`));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const setting = args[0].toLowerCase();
        if (setting !== 'on' && setting !== 'off') {
            console.log(chalk_1.default.red('Usage: /history <on|off>'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        config_manager_1.configManager.set('chatHistory', setting === 'on');
        console.log(chalk_1.default.green(`✅ Chat history ${setting === 'on' ? 'enabled' : 'disabled'}`));
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async listAgentsCommand() {
        console.log(chalk_1.default.blue.bold('\n🤖 Available Agents:'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        const agents = this.agentManager.listAgents();
        if (agents.length === 0) {
            console.log(chalk_1.default.yellow('No agents registered'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        agents.forEach(agent => {
            console.log(`${chalk_1.default.green('•')} ${chalk_1.default.bold(agent.name)}`);
            console.log(`  ${chalk_1.default.gray(agent.description)}`);
        });
        console.log(chalk_1.default.gray('\nUse /agent <name> <task> to run a specific agent'));
        console.log(chalk_1.default.gray('Use /auto <description> for autonomous multi-agent execution'));
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async agentCommand(args) {
        if (args.length < 2) {
            console.log(chalk_1.default.red('Usage: /agent <name> <task>'));
            console.log(chalk_1.default.gray('Example: /agent coding-agent "analyze this function: function add(a,b) { return a + b; }"'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const agentName = args[0];
        const task = args.slice(1).join(' ');
        try {
            const agent = this.agentManager.getAgent(agentName);
            if (!agent) {
                console.log(chalk_1.default.red(`❌ Agent '${agentName}' not found`));
                console.log(chalk_1.default.gray('Use /agents to see available agents'));
                return { shouldExit: false, shouldUpdatePrompt: false };
            }
            console.log(chalk_1.default.blue(`🤖 Running ${agentName}...`));
            await agent.initialize();
            const result = await agent.run(task);
            await agent.cleanup();
            console.log(chalk_1.default.green(`✅ ${agentName} completed:`));
            if (typeof result === 'string') {
                console.log(result);
            }
            else {
                console.log(JSON.stringify(result, null, 2));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error running agent: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async autonomousCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /auto <description>'));
            console.log(chalk_1.default.gray('Example: /auto "Create a React todo app with backend API"'));
            console.log(chalk_1.default.gray('Example: /auto "Fix all TypeScript errors in the project"'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const description = args.join(' ');
        try {
            console.log(chalk_1.default.blue('🧠 Creating autonomous agent for task...'));
            // Create specialized agent for this task
            const agent = await agent_factory_1.agentFactory.createAndLaunchAgent({
                specialization: `Autonomous Developer for: ${description}`,
                autonomyLevel: 'fully-autonomous',
                contextScope: 'project',
                description: `Specialized agent to autonomously complete: ${description}`,
            });
            console.log(chalk_1.default.blue('🚀 Starting autonomous execution with streaming...'));
            const result = await agent.run(description);
            await agent.cleanup();
            if (result.error) {
                console.log(chalk_1.default.red(`❌ ${result.error}`));
            }
            else {
                console.log(chalk_1.default.green('✅ Autonomous execution completed!'));
                console.log(chalk_1.default.gray('Use /stream to see execution details'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error in autonomous execution: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async parallelCommand(args) {
        if (args.length < 2) {
            console.log(chalk_1.default.red('Usage: /parallel <agent1,agent2,...> <task>'));
            console.log(chalk_1.default.gray('Example: /parallel "coding-agent,react-expert" "create a login component"'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const agentNames = args[0].split(',').map(name => name.trim());
        const task = args.slice(1).join(' ');
        try {
            console.log(chalk_1.default.blue(`⚡ Running ${agentNames.length} agents in parallel...`));
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
            console.log(chalk_1.default.green('✅ Parallel execution completed:'));
            results.forEach(({ agentName, result }) => {
                console.log(chalk_1.default.blue(`\n--- ${agentName} ---`));
                if (typeof result === 'string') {
                    console.log(result);
                }
                else {
                    console.log(JSON.stringify(result, null, 2));
                }
            });
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error in parallel execution: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    // File Operations
    async readFileCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /read <filepath>'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const filePath = args[0];
            const fileInfo = await tools_manager_1.toolsManager.readFile(filePath);
            console.log(chalk_1.default.blue(`📄 File: ${filePath} (${fileInfo.size} bytes, ${fileInfo.language || 'unknown'})`));
            console.log(chalk_1.default.gray('─'.repeat(50)));
            console.log(fileInfo.content);
            console.log(chalk_1.default.gray('─'.repeat(50)));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error reading file: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async writeFileCommand(args) {
        if (args.length < 2) {
            console.log(chalk_1.default.red('Usage: /write <filepath> <content>'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const filePath = args[0];
            const content = args.slice(1).join(' ');
            await tools_manager_1.toolsManager.writeFile(filePath, content);
            console.log(chalk_1.default.green(`✅ File written: ${filePath}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error writing file: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async editFileCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /edit <filepath>'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const filePath = args[0];
            console.log(chalk_1.default.blue(`📝 Use your system editor to edit: ${filePath}`));
            // Use system editor
            await tools_manager_1.toolsManager.runCommand('code', [filePath]);
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error opening editor: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async listFilesCommand(args) {
        try {
            const directory = args[0] || '.';
            const files = await tools_manager_1.toolsManager.listFiles(directory);
            console.log(chalk_1.default.blue(`📁 Files in ${directory}:`));
            console.log(chalk_1.default.gray('─'.repeat(40)));
            if (files.length === 0) {
                console.log(chalk_1.default.yellow('No files found'));
            }
            else {
                files.slice(0, 50).forEach(file => {
                    console.log(`${chalk_1.default.cyan('•')} ${file}`);
                });
                if (files.length > 50) {
                    console.log(chalk_1.default.gray(`... and ${files.length - 50} more files`));
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error listing files: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async searchCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /search <query> [directory]'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const query = args[0];
            const directory = args[1] || '.';
            console.log(chalk_1.default.blue(`🔍 Searching for "${query}" in ${directory}...`));
            const results = await tools_manager_1.toolsManager.searchInFiles(query, directory);
            if (results.length === 0) {
                console.log(chalk_1.default.yellow('No matches found'));
            }
            else {
                console.log(chalk_1.default.green(`Found ${results.length} matches:`));
                console.log(chalk_1.default.gray('─'.repeat(50)));
                results.slice(0, 20).forEach(result => {
                    console.log(chalk_1.default.cyan(`${result.file}:${result.line}`));
                    console.log(`  ${result.content}`);
                });
                if (results.length > 20) {
                    console.log(chalk_1.default.gray(`... and ${results.length - 20} more matches`));
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error searching: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    // Terminal Operations
    async runCommandCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /run <command> [args...]'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const [command, ...commandArgs] = args;
            console.log(chalk_1.default.blue(`⚡ Running: ${command} ${commandArgs.join(' ')}`));
            const result = await tools_manager_1.toolsManager.runCommand(command, commandArgs, { stream: true });
            if (result.code === 0) {
                console.log(chalk_1.default.green('✅ Command completed successfully'));
            }
            else {
                console.log(chalk_1.default.red(`❌ Command failed with exit code ${result.code}`));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error running command: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async installCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /install <packages...>'));
            console.log(chalk_1.default.gray('Options: --global, --dev, --yarn, --pnpm'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const packages = args.filter(arg => !arg.startsWith('--'));
            const isGlobal = args.includes('--global') || args.includes('-g');
            const isDev = args.includes('--dev') || args.includes('-D');
            const manager = args.includes('--yarn') ? 'yarn' :
                args.includes('--pnpm') ? 'pnpm' : 'npm';
            console.log(chalk_1.default.blue(`📦 Installing ${packages.join(', ')} with ${manager}...`));
            for (const pkg of packages) {
                const success = await tools_manager_1.toolsManager.installPackage(pkg, { global: isGlobal, dev: isDev, manager: manager });
                if (!success) {
                    console.log(chalk_1.default.yellow(`⚠️ Failed to install ${pkg}`));
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error installing packages: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async npmCommand(args) {
        return await this.runCommandCommand(['npm', ...args]);
    }
    async yarnCommand(args) {
        return await this.runCommandCommand(['yarn', ...args]);
    }
    async gitCommand(args) {
        return await this.runCommandCommand(['git', ...args]);
    }
    async dockerCommand(args) {
        return await this.runCommandCommand(['docker', ...args]);
    }
    async processCommand() {
        try {
            const processes = tools_manager_1.toolsManager.getRunningProcesses();
            console.log(chalk_1.default.blue('🔄 Running Processes:'));
            console.log(chalk_1.default.gray('─'.repeat(50)));
            if (processes.length === 0) {
                console.log(chalk_1.default.yellow('No processes currently running'));
            }
            else {
                processes.forEach(proc => {
                    const duration = Date.now() - proc.startTime.getTime();
                    console.log(`${chalk_1.default.cyan('PID')} ${proc.pid}: ${chalk_1.default.bold(proc.command)} ${proc.args.join(' ')}`);
                    console.log(`  Status: ${proc.status} | Duration: ${Math.round(duration / 1000)}s`);
                    console.log(`  Working Dir: ${proc.cwd}`);
                });
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error listing processes: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async killCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /kill <pid>'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const pid = parseInt(args[0]);
            if (isNaN(pid)) {
                console.log(chalk_1.default.red('Invalid PID'));
                return { shouldExit: false, shouldUpdatePrompt: false };
            }
            console.log(chalk_1.default.yellow(`⚠️ Attempting to kill process ${pid}...`));
            const success = await tools_manager_1.toolsManager.killProcess(pid);
            if (success) {
                console.log(chalk_1.default.green(`✅ Process ${pid} terminated`));
            }
            else {
                console.log(chalk_1.default.red(`❌ Could not kill process ${pid}`));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error killing process: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    // Project Operations
    async buildCommand() {
        try {
            console.log(chalk_1.default.blue('🔨 Building project...'));
            const result = await tools_manager_1.toolsManager.build();
            if (result.success) {
                console.log(chalk_1.default.green('✅ Build completed successfully'));
            }
            else {
                console.log(chalk_1.default.red('❌ Build failed'));
                if (result.errors && result.errors.length > 0) {
                    console.log(chalk_1.default.yellow('Errors found:'));
                    result.errors.forEach(error => {
                        console.log(`  ${chalk_1.default.red('•')} ${error.message}`);
                    });
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error building: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async testCommand(args) {
        try {
            const pattern = args[0];
            console.log(chalk_1.default.blue(`🧪 Running tests${pattern ? ` (${pattern})` : ''}...`));
            const result = await tools_manager_1.toolsManager.runTests(pattern);
            if (result.success) {
                console.log(chalk_1.default.green('✅ All tests passed'));
            }
            else {
                console.log(chalk_1.default.red('❌ Some tests failed'));
                if (result.errors && result.errors.length > 0) {
                    console.log(chalk_1.default.yellow('Test errors:'));
                    result.errors.forEach(error => {
                        console.log(`  ${chalk_1.default.red('•')} ${error.message}`);
                    });
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error running tests: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async lintCommand() {
        try {
            console.log(chalk_1.default.blue('🔍 Running linter...'));
            const result = await tools_manager_1.toolsManager.lint();
            if (result.success) {
                console.log(chalk_1.default.green('✅ No linting errors found'));
            }
            else {
                console.log(chalk_1.default.yellow('⚠️ Linting issues found'));
                if (result.errors && result.errors.length > 0) {
                    result.errors.forEach(error => {
                        const severity = error.severity === 'error' ? chalk_1.default.red('ERROR') : chalk_1.default.yellow('WARNING');
                        console.log(`  ${severity}: ${error.message}`);
                    });
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error running linter: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async createProjectCommand(args) {
        if (args.length < 2) {
            console.log(chalk_1.default.red('Usage: /create <type> <name>'));
            console.log(chalk_1.default.gray('Types: react, next, node, express'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const [type, name] = args;
            console.log(chalk_1.default.blue(`🚀 Creating ${type} project: ${name}`));
            const result = await tools_manager_1.toolsManager.setupProject(type, name);
            if (result.success) {
                console.log(chalk_1.default.green(`✅ Project ${name} created successfully!`));
                console.log(chalk_1.default.gray(`📁 Location: ${result.path}`));
            }
            else {
                console.log(chalk_1.default.red(`❌ Failed to create project ${name}`));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error creating project: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    // Agent Factory Commands
    async factoryCommand() {
        agent_factory_1.agentFactory.showFactoryDashboard();
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async createAgentCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /create-agent <specialization>'));
            console.log(chalk_1.default.gray('Example: /create-agent "React Testing Expert"'));
            console.log(chalk_1.default.gray('Example: /create-agent "API Integration Specialist"'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const specialization = args.join(' ');
            const blueprint = await agent_factory_1.agentFactory.createAgentBlueprint({
                specialization,
                autonomyLevel: 'fully-autonomous',
                contextScope: 'project',
            });
            console.log(chalk_1.default.green(`✅ Agent blueprint created: ${blueprint.name}`));
            console.log(chalk_1.default.gray(`Blueprint ID: ${blueprint.id}`));
            console.log(chalk_1.default.gray('Use /launch-agent <id> to launch this agent'));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error creating agent: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async launchAgentCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /launch-agent <blueprint-id> [task]'));
            console.log(chalk_1.default.gray('Use /factory to see available blueprints'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const blueprintId = args[0];
            const task = args.slice(1).join(' ');
            const agent = await agent_factory_1.agentFactory.launchAgent(blueprintId);
            if (task) {
                console.log(chalk_1.default.blue(`🚀 Running agent with task: ${task}`));
                const result = await agent.run(task);
                console.log(chalk_1.default.green('✅ Agent execution completed:'));
                console.log(JSON.stringify(result, null, 2));
            }
            else {
                console.log(chalk_1.default.blue('🤖 Agent launched and ready'));
                console.log(chalk_1.default.gray('Use /agent <name> <task> to run tasks'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error launching agent: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async contextCommand(args) {
        if (args.length === 0) {
            workspace_context_1.workspaceContext.showContextSummary();
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const paths = args;
            await workspace_context_1.workspaceContext.selectPaths(paths);
            console.log(chalk_1.default.green('✅ Workspace context updated'));
            console.log(chalk_1.default.gray('Use /context with no args to see current context'));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error updating context: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async streamCommand(args) {
        if (args.length > 0 && args[0] === 'clear') {
            const activeAgents = agent_stream_1.agentStream.getActiveAgents();
            activeAgents.forEach(agentId => {
                agent_stream_1.agentStream.clearAgentStream(agentId);
            });
            console.log(chalk_1.default.green('✅ All agent streams cleared'));
        }
        else {
            agent_stream_1.agentStream.showLiveDashboard();
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
}
exports.SlashCommandHandler = SlashCommandHandler;
