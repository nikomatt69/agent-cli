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
exports.SlashCommandHandler = void 0;
const chalk_1 = __importDefault(require("chalk"));
const chat_manager_1 = require("./chat-manager");
const config_manager_1 = require("../core/config-manager");
const model_provider_1 = require("../ai/model-provider");
const agent_manager_1 = require("../core/agent-manager");
const register_agents_1 = require("../register-agents");
const tools_manager_1 = require("../tools/tools-manager");
const agent_factory_1 = require("../core/agent-factory");
const agent_stream_1 = require("../core/agent-stream");
const workspace_context_1 = require("../context/workspace-context");
const enhanced_planning_1 = require("../planning/enhanced-planning");
const approval_system_1 = require("../ui/approval-system");
const diff_viewer_1 = require("../ui/diff-viewer");
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
const tool_service_1 = require("../services/tool-service");
const config_manager_2 = require("../core/config-manager");
const vm_orchestrator_1 = require("../virtualized-agents/vm-orchestrator");
const container_manager_1 = require("../virtualized-agents/container-manager");
class SlashCommandHandler {
    constructor() {
        this.commands = new Map();
        this.agentManager = new agent_manager_1.AgentManager(config_manager_1.configManager);
        (0, register_agents_1.registerAgents)(this.agentManager);
        const containerManager = new container_manager_1.ContainerManager();
        this.vmOrchestrator = new vm_orchestrator_1.VMOrchestrator(containerManager);
        this.registerCommands();
    }
    registerCommands() {
        this.commands.set('help', this.helpCommand.bind(this));
        this.commands.set('quit', this.quitCommand.bind(this));
        this.commands.set('exit', this.quitCommand.bind(this));
        this.commands.set('clear', this.clearCommand.bind(this));
        this.commands.set('default', this.defaultModeCommand.bind(this));
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
        this.commands.set('plan', this.planCommand.bind(this));
        this.commands.set('todo', this.todoCommand.bind(this));
        this.commands.set('todos', this.todosCommand.bind(this));
        this.commands.set('approval', this.approvalCommand.bind(this));
        this.commands.set('security', this.securityCommand.bind(this));
        this.commands.set('dev-mode', this.devModeCommand.bind(this));
        this.commands.set('safe-mode', this.safeModeCommand.bind(this));
        this.commands.set('clear-approvals', this.clearApprovalsCommand.bind(this));
        this.commands.set('read', this.readFileCommand.bind(this));
        this.commands.set('write', this.writeFileCommand.bind(this));
        this.commands.set('edit', this.editFileCommand.bind(this));
        this.commands.set('ls', this.listFilesCommand.bind(this));
        this.commands.set('search', this.searchCommand.bind(this));
        this.commands.set('grep', this.searchCommand.bind(this));
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
        this.commands.set('build', this.buildCommand.bind(this));
        this.commands.set('test', this.testCommand.bind(this));
        this.commands.set('lint', this.lintCommand.bind(this));
        this.commands.set('create', this.createProjectCommand.bind(this));
        this.commands.set('vm', this.vmCommand.bind(this));
        this.commands.set('vm-create', this.vmCreateCommand.bind(this));
        this.commands.set('vm-list', this.vmListCommand.bind(this));
        this.commands.set('vm-stop', this.vmStopCommand.bind(this));
        this.commands.set('vm-remove', this.vmRemoveCommand.bind(this));
        this.commands.set('vm-connect', this.vmConnectCommand.bind(this));
        this.commands.set('vm-create-pr', this.vmCreatePRCommand.bind(this));
        this.commands.set('vm-logs', this.vmLogsCommand.bind(this));
        this.commands.set('vm-mode', this.vmModeCommand.bind(this));
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
${chalk_1.default.cyan('/default')} - Switch to default chat mode

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

${chalk_1.default.blue.bold('VM Container Commands:')}
${chalk_1.default.cyan('/vm')} - Show VM management help
${chalk_1.default.cyan('/vm-create <repo-url>')} - Create new VM container
${chalk_1.default.cyan('/vm-list')} - List active containers
${chalk_1.default.cyan('/vm-stop <id>')} - Stop container
${chalk_1.default.cyan('/vm-remove <id>')} - Remove container
${chalk_1.default.cyan('/vm-connect <id>')} - Connect to container
${chalk_1.default.cyan('/vm-create-pr <id> "<title>" "<desc>" [branch] [base] [draft]')} - Create PR from container
${chalk_1.default.cyan('/vm-mode')} - Enter VM chat mode

${chalk_1.default.blue.bold('Security Commands:')}
${chalk_1.default.cyan('/security [status|set|help]')} - Manage security settings
${chalk_1.default.cyan('/dev-mode [enable|status|help]')} - Developer mode controls
${chalk_1.default.cyan('/safe-mode')} - Enable safe mode (maximum security)
${chalk_1.default.cyan('/clear-approvals')} - Clear session approvals

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
        console.log(config_manager_1.configManager.getConfig());
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async newSessionCommand(args) {
        const title = args.join(' ') || undefined;
        const session = chat_manager_1.chatManager.createNewSession(title);
        console.log(chalk_1.default.green(`✅ New session created: ${session.title} (${session.id.slice(0, 8)})`));
        return { shouldExit: false, shouldUpdatePrompt: true };
    }
    async vmCreatePRCommand(args) {
        if (args.length < 3) {
            console.log(chalk_1.default.red('Usage: /vm-create-pr <container-id> "<title>" "<description>" [branch] [baseBranch] [draft]'));
            console.log(chalk_1.default.gray('Example: /vm-create-pr abc123 "Add CI pipeline" "Adds GitHub Actions for CI" feature/ci main true'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const extractQuoted = (parts) => {
            if (parts.length === 0)
                return { value: '', rest: [] };
            const first = parts[0];
            const quote = (first.startsWith('"') && '"') || (first.startsWith('\'') && '\'') || '';
            if (!quote) {
                return { value: first, rest: parts.slice(1) };
            }
            const collected = [first.slice(1)];
            for (let i = 1; i < parts.length; i++) {
                const token = parts[i];
                if (token.endsWith(quote)) {
                    collected.push(token.slice(0, -1));
                    return { value: collected.join(' ').trim(), rest: parts.slice(i + 1) };
                }
                collected.push(token);
            }
            return { value: collected.join(' ').trim(), rest: [] };
        };
        try {
            const containerIdPrefix = args[0];
            let rest = args.slice(1);
            const titleParsed = extractQuoted(rest);
            const title = titleParsed.value;
            rest = titleParsed.rest;
            const descParsed = extractQuoted(rest);
            const description = descParsed.value;
            rest = descParsed.rest;
            const branch = rest[0];
            const baseBranch = rest[1];
            const draftRaw = rest[2];
            const draft = typeof draftRaw !== 'undefined' ? ['true', '1', 'yes', 'on', 'draft'].includes(draftRaw.toLowerCase()) : false;
            const containers = this.vmOrchestrator.getActiveContainers();
            const container = containers.find(c => c.id.startsWith(containerIdPrefix));
            if (!container) {
                console.log(chalk_1.default.red(`❌ Container ${containerIdPrefix} not found`));
                console.log(chalk_1.default.gray('Use /vm-list to see active containers'));
                return { shouldExit: false, shouldUpdatePrompt: false };
            }
            console.log(chalk_1.default.blue(`📝 Creating PR from container ${container.id.slice(0, 12)}`));
            if (!process.env.GITHUB_TOKEN) {
                console.log(chalk_1.default.yellow('⚠️ GITHUB_TOKEN not set. Will return a manual PR URL instead of creating via API.'));
            }
            const prUrl = await this.vmOrchestrator.createPullRequest(container.id, {
                title,
                description,
                branch,
                baseBranch,
                draft
            });
            console.log(chalk_1.default.green(`✅ Pull request ready: ${prUrl}`));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to create PR: ${error.message}`));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
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
    async debugCommand() {
        console.log(chalk_1.default.blue.bold('\n🔍 Debug Information:'));
        console.log(chalk_1.default.gray('═'.repeat(40)));
        try {
            const currentModel = config_manager_1.configManager.getCurrentModel();
            console.log(chalk_1.default.green(`Current Model: ${currentModel}`));
            const models = config_manager_1.configManager.get('models');
            const currentModelConfig = models[currentModel];
            if (!currentModelConfig) {
                console.log(chalk_1.default.red(`❌ Model configuration missing for: ${currentModel}`));
                return { shouldExit: false, shouldUpdatePrompt: false };
            }
            console.log(chalk_1.default.green(`Provider: ${currentModelConfig.provider}`));
            console.log(chalk_1.default.green(`Model: ${currentModelConfig.model}`));
            const apiKey = config_manager_1.configManager.getApiKey(currentModel);
            if (apiKey) {
                console.log(chalk_1.default.green(`✅ API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)} (${apiKey.length} chars)`));
            }
            else {
                console.log(chalk_1.default.red(`❌ API Key: Not configured`));
                console.log(chalk_1.default.yellow(`   Set with: /set-key ${currentModel} <your-api-key>`));
            }
            try {
                const isValid = model_provider_1.modelProvider.validateApiKey();
                console.log(chalk_1.default.green(`✅ Model Provider Validation: ${isValid ? 'Valid' : 'Invalid'}`));
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Model Provider Validation Failed: ${error.message}`));
            }
            try {
                console.log(chalk_1.default.blue('\n🧪 Testing AI Generation...'));
                const testResponse = await model_provider_1.modelProvider.generateResponse({
                    messages: [{ role: 'user', content: 'Say "test successful"' }],
                    maxTokens: 20
                });
                console.log(chalk_1.default.green(`✅ Test Generation: ${testResponse.trim()}`));
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Test Generation Failed: ${error.message}`));
            }
            console.log(chalk_1.default.blue('\n🌍 Environment Variables:'));
            const envVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'];
            envVars.forEach(envVar => {
                const value = process.env[envVar];
                if (value) {
                    console.log(chalk_1.default.green(`✅ ${envVar}: ${value.slice(0, 10)}...${value.slice(-4)}`));
                }
                else {
                    console.log(chalk_1.default.gray(`❌ ${envVar}: Not set`));
                }
            });
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Debug error: ${error.message}`));
        }
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
            const result = await agent.run?.({
                id: `task-${Date.now()}`,
                type: 'user_request',
                title: 'User Request',
                description: task,
                priority: 'medium',
                status: 'pending',
                data: { userInput: task },
                createdAt: new Date(),
                updatedAt: new Date(),
                progress: 0
            });
            await agent.cleanup?.();
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
                const result = await agent.run?.({
                    id: `task-${Date.now()}`,
                    type: 'user_request',
                    title: 'User Request',
                    description: task,
                    priority: 'medium',
                    status: 'pending',
                    data: { userInput: task },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    progress: 0
                });
                await agent.cleanup?.();
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
            const fileDiff = await diff_viewer_1.DiffViewer.createFileDiff(filePath);
            fileDiff.newContent = content;
            const approved = await approval_system_1.approvalSystem.requestFileApproval(`Write file: ${filePath}`, [fileDiff], 'medium');
            if (!approved) {
                console.log(chalk_1.default.yellow('❌ File write operation cancelled'));
                return { shouldExit: false, shouldUpdatePrompt: false };
            }
            const writeId = advanced_cli_ui_1.advancedUI.createIndicator('file-write', `Writing ${filePath}`).id;
            advanced_cli_ui_1.advancedUI.startSpinner(writeId, 'Writing file...');
            await tools_manager_1.toolsManager.writeFile(filePath, content);
            advanced_cli_ui_1.advancedUI.stopSpinner(writeId, true, `File written: ${filePath}`);
            console.log(chalk_1.default.green(`✅ File written: ${filePath}`));
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`Error writing file: ${error.message}`);
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
    async runCommandCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /run <command> [args...]'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const [command, ...commandArgs] = args;
            const fullCommand = `${command} ${commandArgs.join(' ')}`;
            const approved = await approval_system_1.approvalSystem.requestCommandApproval(command, commandArgs, process.cwd());
            if (!approved) {
                console.log(chalk_1.default.yellow('❌ Command execution cancelled'));
                return { shouldExit: false, shouldUpdatePrompt: false };
            }
            console.log(chalk_1.default.blue(`⚡ Running: ${fullCommand}`));
            const cmdId = advanced_cli_ui_1.advancedUI.createIndicator('command', `Executing: ${command}`).id;
            advanced_cli_ui_1.advancedUI.startSpinner(cmdId, `Running: ${fullCommand}`);
            const result = await tools_manager_1.toolsManager.runCommand(command, commandArgs, { stream: true });
            if (result.code === 0) {
                advanced_cli_ui_1.advancedUI.stopSpinner(cmdId, true, 'Command completed successfully');
                console.log(chalk_1.default.green('✅ Command completed successfully'));
            }
            else {
                advanced_cli_ui_1.advancedUI.stopSpinner(cmdId, false, `Command failed with exit code ${result.code}`);
                console.log(chalk_1.default.red(`❌ Command failed with exit code ${result.code}`));
            }
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`Error running command: ${error.message}`);
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
            const approved = await approval_system_1.approvalSystem.requestPackageApproval(packages, manager, isGlobal);
            if (!approved) {
                console.log(chalk_1.default.yellow('❌ Package installation cancelled'));
                return { shouldExit: false, shouldUpdatePrompt: false };
            }
            console.log(chalk_1.default.blue(`📦 Installing ${packages.join(', ')} with ${manager}...`));
            const installId = advanced_cli_ui_1.advancedUI.createIndicator('install', `Installing packages`).id;
            advanced_cli_ui_1.advancedUI.createProgressBar(installId, 'Installing packages', packages.length);
            for (let i = 0; i < packages.length; i++) {
                const pkg = packages[i];
                advanced_cli_ui_1.advancedUI.updateSpinner(installId, `Installing ${pkg}...`);
                const success = await tools_manager_1.toolsManager.installPackage(pkg, {
                    global: isGlobal,
                    dev: isDev,
                    manager: manager
                });
                if (!success) {
                    advanced_cli_ui_1.advancedUI.logWarning(`Failed to install ${pkg}`);
                    console.log(chalk_1.default.yellow(`⚠️ Failed to install ${pkg}`));
                }
                else {
                    advanced_cli_ui_1.advancedUI.logSuccess(`Installed ${pkg}`);
                }
                advanced_cli_ui_1.advancedUI.updateProgress(installId, i + 1, packages.length);
            }
            advanced_cli_ui_1.advancedUI.completeProgress(installId, `Completed installation of ${packages.length} packages`);
            console.log(chalk_1.default.green(`✅ Package installation completed`));
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`Error installing packages: ${error.message}`);
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
            console.log(chalk_1.default.gray('Types: react, node, python, rust'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const [type, name] = args;
            console.log(chalk_1.default.blue(`🏗️ Creating ${type} project: ${name}`));
            const result = { success: true, path: `./${name}` };
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
    async vmCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.blue.bold('🐳 VM Container Management'));
            console.log(chalk_1.default.gray('─'.repeat(40)));
            console.log(chalk_1.default.cyan('/vm-create <repo-url>') + ' - Create new VM container');
            console.log(chalk_1.default.cyan('/vm-list') + '              - List active containers');
            console.log(chalk_1.default.cyan('/vm-stop <id>') + '          - Stop container');
            console.log(chalk_1.default.cyan('/vm-remove <id>') + '        - Remove container');
            console.log(chalk_1.default.cyan('/vm-connect <id>') + '       - Connect to container');
            console.log(chalk_1.default.cyan('/vm-logs <id>') + '          - View container logs');
            console.log(chalk_1.default.cyan('/vm-create-pr <id> "<title>" "<desc>" [branch] [base] [draft]') + ' - Create PR from container');
            console.log(chalk_1.default.cyan('/vm-mode') + '               - Enter VM chat mode');
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const subcommand = args[0];
        const subArgs = args.slice(1);
        switch (subcommand) {
            case 'create':
                return await this.vmCreateCommand(subArgs);
            case 'list':
                return await this.vmListCommand();
            case 'stop':
                return await this.vmStopCommand(subArgs);
            case 'remove':
                return await this.vmRemoveCommand(subArgs);
            case 'connect':
                return await this.vmConnectCommand(subArgs);
            case 'mode':
                return await this.vmModeCommand();
            default:
                console.log(chalk_1.default.red(`Unknown VM command: ${subcommand}`));
                return { shouldExit: false, shouldUpdatePrompt: false };
        }
    }
    async vmCreateCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /vm-create <repository-url>'));
            console.log(chalk_1.default.gray('Example: /vm-create https://github.com/user/repo.git'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const repositoryUrl = args[0];
            console.log(chalk_1.default.blue(`🚀 Creating VM container for repository: ${repositoryUrl}`));
            const config = {
                agentId: `vm-agent-${Date.now()}`,
                repositoryUrl,
                sessionToken: `session-${Date.now()}`,
                proxyEndpoint: 'http://localhost:3000',
                capabilities: ['read', 'write', 'execute', 'network']
            };
            const containerId = await this.vmOrchestrator.createSecureContainer(config);
            await this.vmOrchestrator.setupRepository(containerId, repositoryUrl);
            await this.vmOrchestrator.setupDevelopmentEnvironment(containerId);
            await this.vmOrchestrator.setupVSCodeServer(containerId);
            const vscodePort = await this.vmOrchestrator.getVSCodePort(containerId);
            console.log(chalk_1.default.green(`✅ VM container created successfully!`));
            console.log(chalk_1.default.gray(`Container ID: ${containerId}`));
            console.log(chalk_1.default.gray(`VS Code Server: http://localhost:${vscodePort}`));
            console.log(chalk_1.default.gray(`Use /vm-connect ${containerId.slice(0, 8)} to interact`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to create VM container: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async vmListCommand() {
        try {
            const containers = this.vmOrchestrator.getActiveContainers();
            console.log(chalk_1.default.blue.bold('🐳 Active VM Containers'));
            console.log(chalk_1.default.gray('─'.repeat(50)));
            if (containers.length === 0) {
                console.log(chalk_1.default.yellow('No active containers'));
                console.log(chalk_1.default.gray('Use /vm-create <repo-url> to create one'));
                return { shouldExit: false, shouldUpdatePrompt: false };
            }
            containers.forEach(container => {
                const uptime = Math.round((Date.now() - container.createdAt.getTime()) / 1000 / 60);
                console.log(`${chalk_1.default.cyan('•')} ${chalk_1.default.bold(container.id.slice(0, 12))}`);
                console.log(`  Agent: ${container.agentId}`);
                console.log(`  Repository: ${container.repositoryUrl}`);
                console.log(`  Status: ${container.status === 'running' ? chalk_1.default.green('running') : chalk_1.default.yellow(container.status)}`);
                console.log(`  VS Code Port: ${container.vscodePort}`);
                console.log(`  Uptime: ${uptime} minutes`);
                console.log();
            });
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to list containers: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async vmStopCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /vm-stop <container-id>'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const containerId = args[0];
            console.log(chalk_1.default.blue(`🛑 Stopping container ${containerId}`));
            await this.vmOrchestrator.stopContainer(containerId);
            console.log(chalk_1.default.green(`✅ Container ${containerId} stopped`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to stop container: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async vmRemoveCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /vm-remove <container-id>'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const containerId = args[0];
            console.log(chalk_1.default.blue(`🗑️ Removing container ${containerId}`));
            await this.vmOrchestrator.removeContainer(containerId);
            console.log(chalk_1.default.green(`✅ Container ${containerId} removed`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to remove container: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async vmConnectCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /vm-connect <container-id>'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            const containerId = args[0];
            const containers = this.vmOrchestrator.getActiveContainers();
            const container = containers.find(c => c.id.startsWith(containerId));
            if (!container) {
                console.log(chalk_1.default.red(`❌ Container ${containerId} not found`));
                console.log(chalk_1.default.gray('Use /vm-list to see active containers'));
                return { shouldExit: false, shouldUpdatePrompt: false };
            }
            console.log(chalk_1.default.green(`🔗 Connected to container ${container.id.slice(0, 12)}`));
            console.log(chalk_1.default.gray(`VS Code Server: http://localhost:${container.vscodePort}`));
            console.log(chalk_1.default.gray(`Repository: ${container.repositoryUrl}`));
            console.log(chalk_1.default.blue('💬 You can now chat directly with the VM agent'));
            console.log(chalk_1.default.gray('Type /vm-mode to enter dedicated VM chat mode'));
            console.log(chalk_1.default.gray(`Container ${container.id} is now active for VM mode`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to connect to container: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: true };
    }
    async vmLogsCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /vm-logs <container-id> [lines]'));
            console.log(chalk_1.default.gray('Example: /vm-logs abc123 50'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const containerId = args[0];
        const lines = args[1] ? parseInt(args[1]) : 100;
        try {
            console.log(chalk_1.default.blue(`📋 Getting logs for container ${containerId}...`));
            const logs = await this.vmOrchestrator.getContainerLogs(containerId, lines);
            if (logs.trim()) {
                console.log(chalk_1.default.gray('─'.repeat(60)));
                console.log(chalk_1.default.blue.bold(`📋 Container Logs (last ${lines} lines):`));
                console.log(chalk_1.default.gray('─'.repeat(60)));
                console.log(logs);
                console.log(chalk_1.default.gray('─'.repeat(60)));
            }
            else {
                console.log(chalk_1.default.yellow('📋 No logs available for this container'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to get container logs: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async vmModeCommand() {
        const containers = this.vmOrchestrator.getActiveContainers();
        if (containers.length === 0) {
            console.log(chalk_1.default.yellow('⚠️ No VM containers available'));
            console.log(chalk_1.default.gray('Use /vm-create <repo-url> to create one first'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        if (global.__streamingOrchestrator) {
            const orchestrator = global.__streamingOrchestrator;
            if (orchestrator.context) {
                orchestrator.context.vmMode = true;
                orchestrator.context.planMode = false;
                orchestrator.context.autoAcceptEdits = false;
            }
        }
        if (global.__nikCLI) {
            global.__nikCLI.currentMode = 'vm';
        }
        console.log(chalk_1.default.blue.bold('🐳 Entering VM Chat Mode'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        console.log(chalk_1.default.green(`Available containers: ${containers.length}`));
        console.log(chalk_1.default.gray('All messages will be sent to VM agents'));
        console.log(chalk_1.default.gray('Type /default to exit VM mode'));
        return { shouldExit: false, shouldUpdatePrompt: true };
    }
    getActiveVMContainers() {
        return this.vmOrchestrator.getActiveContainers();
    }
    async factoryCommand() {
        agent_factory_1.agentFactory.showFactoryDashboard();
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async createAgentCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.red('Usage: /create-agent [--vm|--container] <specialization>'));
            console.log(chalk_1.default.gray('Examples:'));
            console.log(chalk_1.default.gray('  /create-agent "React Testing Expert"'));
            console.log(chalk_1.default.gray('  /create-agent --vm "Repository Analyzer"'));
            console.log(chalk_1.default.gray('  /create-agent --container "Isolated Developer"'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        try {
            let agentType = 'standard';
            let specialization = '';
            for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                if (arg === '--vm') {
                    agentType = 'vm';
                }
                else if (arg === '--container') {
                    agentType = 'container';
                }
                else {
                    specialization = args.slice(i).join(' ');
                    break;
                }
            }
            if (!specialization) {
                console.log(chalk_1.default.red('Error: No specialization specified'));
                console.log(chalk_1.default.gray('Usage: /create-agent [--vm|--container] <specialization>'));
                return { shouldExit: false, shouldUpdatePrompt: false };
            }
            const blueprint = await agent_factory_1.agentFactory.createAgentBlueprint({
                specialization,
                autonomyLevel: 'fully-autonomous',
                contextScope: 'project',
                agentType,
            });
            const typeIcon = agentType === 'vm' || agentType === 'container' ? '🐳' : '🤖';
            const typeLabel = agentType === 'vm' || agentType === 'container' ? 'VM Agent' : 'Standard Agent';
            console.log(chalk_1.default.green(`✅ ${typeLabel} blueprint created: ${blueprint.name}`));
            console.log(chalk_1.default.gray(`${typeIcon} Type: ${blueprint.agentType}`));
            console.log(chalk_1.default.gray(`📋 Blueprint ID: ${blueprint.id}`));
            if (blueprint.vmConfig) {
                console.log(chalk_1.default.gray(`🐳 Container Image: ${blueprint.vmConfig.containerImage}`));
                console.log(chalk_1.default.gray(`💾 Memory Limit: ${blueprint.vmConfig.resourceLimits?.memory}`));
            }
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
    async planCommand(args) {
        if (args.length === 0) {
            enhanced_planning_1.enhancedPlanning.showPlanStatus();
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const subcommand = args[0].toLowerCase();
        const restArgs = args.slice(1);
        try {
            switch (subcommand) {
                case 'create':
                case 'generate': {
                    if (restArgs.length === 0) {
                        console.log(chalk_1.default.red('Usage: /plan create <goal>'));
                        console.log(chalk_1.default.gray('Example: /plan create "Create a React todo app with backend"'));
                        return { shouldExit: false, shouldUpdatePrompt: false };
                    }
                    const goal = restArgs.join(' ');
                    console.log(chalk_1.default.blue(`🎯 Creating plan for: ${goal}`));
                    const plan = await enhanced_planning_1.enhancedPlanning.generatePlan(goal, {
                        maxTodos: 15,
                        includeContext: true,
                        showDetails: true,
                        saveTodoFile: true,
                    });
                    console.log(chalk_1.default.green(`✅ Plan created with ${plan.todos.length} todos`));
                    console.log(chalk_1.default.cyan(`📝 Plan ID: ${plan.id}`));
                    console.log(chalk_1.default.gray('Use /plan execute to run the plan or /plan approve to review it'));
                    break;
                }
                case 'execute':
                case 'run': {
                    const planId = restArgs[0];
                    if (!planId) {
                        const plans = enhanced_planning_1.enhancedPlanning.getActivePlans();
                        const latestPlan = plans[plans.length - 1];
                        if (!latestPlan) {
                            console.log(chalk_1.default.yellow('No active plans found. Create one with /plan create <goal>'));
                            return { shouldExit: false, shouldUpdatePrompt: false };
                        }
                        console.log(chalk_1.default.blue(`Executing latest plan: ${latestPlan.title}`));
                        await enhanced_planning_1.enhancedPlanning.executePlan(latestPlan.id);
                    }
                    else {
                        await enhanced_planning_1.enhancedPlanning.executePlan(planId);
                    }
                    break;
                }
                case 'approve': {
                    const planId = restArgs[0];
                    if (!planId) {
                        const plans = enhanced_planning_1.enhancedPlanning.getActivePlans().filter(p => p.status === 'draft');
                        if (plans.length === 0) {
                            console.log(chalk_1.default.yellow('No plans pending approval'));
                            return { shouldExit: false, shouldUpdatePrompt: false };
                        }
                        const latestPlan = plans[plans.length - 1];
                        console.log(chalk_1.default.blue(`Reviewing latest plan: ${latestPlan.title}`));
                        await enhanced_planning_1.enhancedPlanning.requestPlanApproval(latestPlan.id);
                    }
                    else {
                        await enhanced_planning_1.enhancedPlanning.requestPlanApproval(planId);
                    }
                    break;
                }
                case 'show':
                case 'status': {
                    const planId = restArgs[0];
                    enhanced_planning_1.enhancedPlanning.showPlanStatus(planId);
                    break;
                }
                case 'list': {
                    const plans = enhanced_planning_1.enhancedPlanning.getActivePlans();
                    if (plans.length === 0) {
                        console.log(chalk_1.default.gray('No active plans'));
                    }
                    else {
                        console.log(chalk_1.default.blue.bold('Active Plans:'));
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
                    console.log(chalk_1.default.red(`Unknown plan command: ${subcommand}`));
                    console.log(chalk_1.default.gray('Available commands: create, execute, approve, show, list'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Plan command failed: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async todoCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.blue('Usage: /todo <command>'));
            console.log(chalk_1.default.gray('Commands: list, show, open, edit'));
            return { shouldExit: false, shouldUpdatePrompt: false };
        }
        const subcommand = args[0].toLowerCase();
        try {
            switch (subcommand) {
                case 'list':
                case 'ls': {
                    const plans = enhanced_planning_1.enhancedPlanning.getActivePlans();
                    if (plans.length === 0) {
                        console.log(chalk_1.default.gray('No todo lists found'));
                        return { shouldExit: false, shouldUpdatePrompt: false };
                    }
                    console.log(chalk_1.default.blue.bold('Todo Lists:'));
                    plans.forEach((plan, index) => {
                        console.log(`\n${index + 1}. ${chalk_1.default.bold(plan.title)}`);
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
                        const plans = enhanced_planning_1.enhancedPlanning.getActivePlans();
                        const latestPlan = plans[plans.length - 1];
                        if (latestPlan) {
                            try {
                                const { advancedUI } = await Promise.resolve().then(() => __importStar(require('../ui/advanced-cli-ui')));
                                const todoItems = latestPlan.todos.map((t) => ({ content: t.title || t.description, status: t.status }));
                                advancedUI.showTodos?.(todoItems, latestPlan.title || 'Update Todos');
                            }
                            catch { }
                            enhanced_planning_1.enhancedPlanning.showPlanStatus(latestPlan.id);
                        }
                        else {
                            console.log(chalk_1.default.yellow('No todo lists found'));
                        }
                    }
                    else {
                        const plans = enhanced_planning_1.enhancedPlanning.getActivePlans();
                        const target = plans.find(p => p.id === planId);
                        if (target) {
                            try {
                                const { advancedUI } = await Promise.resolve().then(() => __importStar(require('../ui/advanced-cli-ui')));
                                const todoItems = target.todos.map((t) => ({ content: t.title || t.description, status: t.status }));
                                advancedUI.showTodos?.(todoItems, target.title || 'Update Todos');
                            }
                            catch { }
                        }
                        enhanced_planning_1.enhancedPlanning.showPlanStatus(planId);
                    }
                    break;
                }
                case 'open':
                case 'edit': {
                    const todoPath = 'todo.md';
                    console.log(chalk_1.default.blue(`Opening ${todoPath} in your default editor...`));
                    try {
                        await tools_manager_1.toolsManager.runCommand('code', [todoPath]);
                    }
                    catch {
                        try {
                            await tools_manager_1.toolsManager.runCommand('open', [todoPath]);
                        }
                        catch {
                            console.log(chalk_1.default.yellow(`Could not open ${todoPath}. Please open it manually.`));
                        }
                    }
                    break;
                }
                default:
                    console.log(chalk_1.default.red(`Unknown todo command: ${subcommand}`));
                    console.log(chalk_1.default.gray('Available commands: list, show, open, edit'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Todo command failed: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async todosCommand(args) {
        return await this.todoCommand(['list', ...args]);
    }
    async approvalCommand(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.blue('Approval System Configuration:'));
            const config = approval_system_1.approvalSystem.getConfig();
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
                        console.log(chalk_1.default.red('Usage: /approval auto-approve <type> <on|off>'));
                        console.log(chalk_1.default.gray('Types: low-risk, medium-risk, file-operations, package-installs'));
                        return { shouldExit: false, shouldUpdatePrompt: false };
                    }
                    const currentConfig = approval_system_1.approvalSystem.getConfig();
                    const newConfig = { ...currentConfig };
                    switch (type) {
                        case 'low-risk':
                            newConfig.autoApprove.lowRisk = enabled;
                            break;
                        case 'medium-risk':
                            newConfig.autoApprove.mediumRisk = enabled;
                            break;
                        case 'file-operations':
                            newConfig.autoApprove.fileOperations = enabled;
                            break;
                        case 'package-installs':
                            newConfig.autoApprove.packageInstalls = enabled;
                            break;
                        default:
                            console.log(chalk_1.default.red(`Unknown approval type: ${type}`));
                            return { shouldExit: false, shouldUpdatePrompt: false };
                    }
                    approval_system_1.approvalSystem.updateConfig(newConfig);
                    console.log(chalk_1.default.green(`✅ Auto-approval for ${type} ${enabled ? 'enabled' : 'disabled'}`));
                    break;
                }
                case 'test': {
                    console.log(chalk_1.default.blue('Testing approval system...'));
                    const approved = await approval_system_1.approvalSystem.quickApproval('Test Approval', 'This is a test of the approval system', 'low');
                    console.log(approved ? chalk_1.default.green('Approved') : chalk_1.default.yellow('Cancelled'));
                    break;
                }
                default:
                    console.log(chalk_1.default.red(`Unknown approval command: ${subcommand}`));
                    console.log(chalk_1.default.gray('Available commands: auto-approve, test'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Approval command failed: ${error.message}`));
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
    async defaultModeCommand(args = []) {
        if (global.__streamingOrchestrator) {
            const orchestrator = global.__streamingOrchestrator;
            if (orchestrator.context) {
                orchestrator.context.vmMode = false;
                orchestrator.context.planMode = false;
                orchestrator.context.autoAcceptEdits = false;
            }
        }
        if (global.__nikCLI) {
            global.__nikCLI.currentMode = 'default';
        }
        console.log(chalk_1.default.green('💬 Switched to Default Chat Mode'));
        console.log(chalk_1.default.gray('Use Shift+Tab to cycle through modes'));
        return { shouldExit: false, shouldUpdatePrompt: true };
    }
    async securityCommand(args) {
        const subcommand = args[0] || 'status';
        try {
            switch (subcommand) {
                case 'status': {
                    const securityStatus = tool_service_1.toolService.getSecurityStatus();
                    const config = config_manager_2.simpleConfigManager.getAll();
                    console.log(chalk_1.default.cyan.bold('\n🔒 Security Status'));
                    console.log(chalk_1.default.gray('═'.repeat(50)));
                    console.log(`${chalk_1.default.blue('Security Mode:')} ${this.formatSecurityMode(securityStatus.mode)}`);
                    console.log(`${chalk_1.default.blue('Developer Mode:')} ${securityStatus.devModeActive ? chalk_1.default.yellow('Active') : chalk_1.default.gray('Inactive')}`);
                    console.log(`${chalk_1.default.blue('Session Approvals:')} ${securityStatus.sessionApprovals}`);
                    console.log(`${chalk_1.default.blue('Approval Policy:')} ${config.approvalPolicy}`);
                    console.log(chalk_1.default.cyan.bold('\n📋 Tool Policies:'));
                    console.log(`${chalk_1.default.blue('File Operations:')} ${config.toolApprovalPolicies.fileOperations}`);
                    console.log(`${chalk_1.default.blue('Git Operations:')} ${config.toolApprovalPolicies.gitOperations}`);
                    console.log(`${chalk_1.default.blue('Package Operations:')} ${config.toolApprovalPolicies.packageOperations}`);
                    console.log(`${chalk_1.default.blue('System Commands:')} ${config.toolApprovalPolicies.systemCommands}`);
                    console.log(`${chalk_1.default.blue('Network Requests:')} ${config.toolApprovalPolicies.networkRequests}`);
                    console.log(chalk_1.default.cyan.bold('\n🛠️ Tools by Risk Level:'));
                    const tools = tool_service_1.toolService.getAvailableToolsWithSecurity();
                    const lowRisk = tools.filter(t => t.riskLevel === 'low');
                    const medRisk = tools.filter(t => t.riskLevel === 'medium');
                    const highRisk = tools.filter(t => t.riskLevel === 'high');
                    console.log(`${chalk_1.default.green('Low Risk:')} ${lowRisk.map(t => t.name).join(', ')}`);
                    console.log(`${chalk_1.default.yellow('Medium Risk:')} ${medRisk.map(t => t.name).join(', ')}`);
                    console.log(`${chalk_1.default.red('High Risk:')} ${highRisk.map(t => t.name).join(', ')}`);
                    break;
                }
                case 'set': {
                    if (args.length < 3) {
                        console.log(chalk_1.default.yellow('Usage: /security set <mode> <value>'));
                        console.log(chalk_1.default.gray('Available modes: security-mode, file-ops, git-ops, package-ops, system-cmds, network-reqs'));
                        break;
                    }
                    const mode = args[1];
                    const value = args[2];
                    const config = config_manager_2.simpleConfigManager.getAll();
                    switch (mode) {
                        case 'security-mode':
                            if (['safe', 'default', 'developer'].includes(value)) {
                                config_manager_2.simpleConfigManager.set('securityMode', value);
                                console.log(chalk_1.default.green(`✅ Security mode set to: ${value}`));
                            }
                            else {
                                console.log(chalk_1.default.red('❌ Invalid mode. Use: safe, default, or developer'));
                            }
                            break;
                        case 'file-ops':
                        case 'git-ops':
                        case 'package-ops':
                        case 'system-cmds':
                        case 'network-reqs':
                            if (['always', 'risky', 'never'].includes(value)) {
                                const policyKey = mode.replace('-', '').replace('ops', 'Operations').replace('cmds', 'Commands').replace('reqs', 'Requests');
                                const keyMap = {
                                    'fileOperations': 'fileOperations',
                                    'gitOperations': 'gitOperations',
                                    'packageOperations': 'packageOperations',
                                    'systemCommands': 'systemCommands',
                                    'networkRequests': 'networkRequests'
                                };
                                config.toolApprovalPolicies[keyMap[policyKey]] = value;
                                config_manager_2.simpleConfigManager.setAll(config);
                                console.log(chalk_1.default.green(`✅ ${mode} policy set to: ${value}`));
                            }
                            else {
                                console.log(chalk_1.default.red('❌ Invalid value. Use: always, risky, or never'));
                            }
                            break;
                        default:
                            console.log(chalk_1.default.red(`❌ Unknown setting: ${mode}`));
                    }
                    break;
                }
                case 'help':
                    console.log(chalk_1.default.cyan.bold('\n🔒 Security Command Help'));
                    console.log(chalk_1.default.gray('─'.repeat(40)));
                    console.log(`${chalk_1.default.green('/security status')} - Show current security settings`);
                    console.log(`${chalk_1.default.green('/security set <mode> <value>')} - Change security settings`);
                    console.log(`${chalk_1.default.green('/security help')} - Show this help`);
                    console.log(chalk_1.default.cyan('\nSecurity Modes:'));
                    console.log(`${chalk_1.default.green('safe')} - Maximum security, approval for most operations`);
                    console.log(`${chalk_1.default.yellow('default')} - Balanced security, approval for risky operations`);
                    console.log(`${chalk_1.default.red('developer')} - Minimal security, approval only for dangerous operations`);
                    break;
                default:
                    console.log(chalk_1.default.red(`Unknown security command: ${subcommand}`));
                    console.log(chalk_1.default.gray('Use /security help for available commands'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Security command failed: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async devModeCommand(args) {
        const action = args[0] || 'enable';
        try {
            switch (action) {
                case 'enable': {
                    const timeoutMs = args[1] ? parseInt(args[1]) * 60000 : undefined;
                    tool_service_1.toolService.enableDevMode(timeoutMs);
                    const timeout = timeoutMs ? ` for ${args[1]} minutes` : ' for 1 hour (default)';
                    console.log(chalk_1.default.yellow(`🛠️ Developer mode enabled${timeout}`));
                    console.log(chalk_1.default.gray('Reduced security restrictions active. Use /security status to see current settings.'));
                    break;
                }
                case 'status': {
                    const isActive = tool_service_1.toolService.isDevModeActive();
                    console.log(chalk_1.default.cyan.bold('\n🛠️ Developer Mode Status'));
                    console.log(chalk_1.default.gray('─'.repeat(30)));
                    console.log(`${chalk_1.default.blue('Status:')} ${isActive ? chalk_1.default.yellow('Active') : chalk_1.default.gray('Inactive')}`);
                    if (isActive) {
                        console.log(chalk_1.default.yellow('⚠️ Security restrictions are reduced'));
                    }
                    break;
                }
                case 'help':
                    console.log(chalk_1.default.cyan.bold('\n🛠️ Developer Mode Commands'));
                    console.log(chalk_1.default.gray('─'.repeat(35)));
                    console.log(`${chalk_1.default.green('/dev-mode enable [minutes]')} - Enable developer mode`);
                    console.log(`${chalk_1.default.green('/dev-mode status')} - Check developer mode status`);
                    console.log(`${chalk_1.default.green('/dev-mode help')} - Show this help`);
                    console.log(chalk_1.default.yellow('\n⚠️ Developer mode reduces security restrictions'));
                    break;
                default:
                    console.log(chalk_1.default.red(`Unknown dev-mode command: ${action}`));
                    console.log(chalk_1.default.gray('Use /dev-mode help for available commands'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Dev-mode command failed: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async safeModeCommand(args) {
        try {
            const config = config_manager_2.simpleConfigManager.getAll();
            config.securityMode = 'safe';
            config_manager_2.simpleConfigManager.setAll(config);
            console.log(chalk_1.default.green('🔒 Safe mode enabled - maximum security restrictions'));
            console.log(chalk_1.default.gray('All risky operations will require approval. Use /security status to see details.'));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Safe mode command failed: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    async clearApprovalsCommand(args) {
        try {
            tool_service_1.toolService.clearSessionApprovals();
            console.log(chalk_1.default.green('✅ All session approvals cleared'));
            console.log(chalk_1.default.gray('Next operations will require fresh approval'));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Clear approvals command failed: ${error.message}`));
        }
        return { shouldExit: false, shouldUpdatePrompt: false };
    }
    formatSecurityMode(mode) {
        switch (mode) {
            case 'safe':
                return chalk_1.default.green('🔒 Safe');
            case 'default':
                return chalk_1.default.yellow('🛡️ Default');
            case 'developer':
                return chalk_1.default.red('🛠️ Developer');
            default:
                return chalk_1.default.gray(mode);
        }
    }
}
exports.SlashCommandHandler = SlashCommandHandler;
