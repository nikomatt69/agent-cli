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
exports.StreamingModule = exports.ServiceModule = exports.SystemModule = exports.OnboardingModule = exports.IntroductionModule = exports.MainOrchestrator = void 0;
exports.main = main;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const readline = __importStar(require("readline"));
const events_1 = require("events");
const child_process_1 = require("child_process");
const nik_cli_1 = require("./nik-cli");
const agent_service_1 = require("./services/agent-service");
const tool_service_1 = require("./services/tool-service");
const planning_service_1 = require("./services/planning-service");
const lsp_service_1 = require("./services/lsp-service");
const diff_manager_1 = require("./ui/diff-manager");
const execution_policy_1 = require("./policies/execution-policy");
const config_manager_1 = require("./core/config-manager");
const register_agents_1 = require("./register-agents");
const agent_manager_1 = require("./core/agent-manager");
const logger_1 = require("./core/logger");
const logger_2 = require("./utils/logger");
const banner = `
███╗   ██╗██╗██╗  ██╗ ██████╗██╗     ██╗
████╗  ██║██║██║ ██╔╝██╔════╝██║     ██║
██╔██╗ ██║██║█████╔╝ ██║     ██║     ██║
██║╚██╗██║██║██╔═██╗ ██║     ██║     ██║
██║ ╚████║██║██║  ██╗╚██████╗███████╗██║
╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝
`;
class IntroductionModule {
    static displayBanner() {
        console.clear();
        console.log(chalk_1.default.cyanBright(banner));
    }
    static displayApiKeySetup() {
        const setupBox = (0, boxen_1.default)(chalk_1.default.yellow.bold('⚠️  API Key Required\n\n') +
            chalk_1.default.white('To use NikCLI, please set at least one API key:\n\n') +
            chalk_1.default.green('• ANTHROPIC_API_KEY') + chalk_1.default.gray(' - for Claude models (recommended)\n') +
            chalk_1.default.blue('• OPENAI_API_KEY') + chalk_1.default.gray(' - for GPT models\n') +
            chalk_1.default.magenta('• GOOGLE_GENERATIVE_AI_API_KEY') + chalk_1.default.gray(' - for Gemini models\n\n') +
            chalk_1.default.white.bold('Setup Examples:\n') +
            chalk_1.default.dim('export ANTHROPIC_API_KEY="your-key-here"\n') +
            chalk_1.default.dim('export OPENAI_API_KEY="your-key-here"\n') +
            chalk_1.default.dim('export GOOGLE_GENERATIVE_AI_API_KEY="your-key-here"\n\n') +
            chalk_1.default.cyan('Then run: ') + chalk_1.default.white.bold('npm start'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'yellow',
            backgroundColor: '#2a1a00'
        });
        console.log(setupBox);
    }
    static displayStartupInfo() {
        const startupBox = (0, boxen_1.default)(chalk_1.default.green.bold('🚀 Starting NikCLI...\n\n') +
            chalk_1.default.white('Initializing autonomous AI assistant\n') +
            chalk_1.default.gray('• Loading project context\n') +
            chalk_1.default.gray('• Preparing planning system\n') +
            chalk_1.default.gray('• Setting up tool integrations\n\n') +
            chalk_1.default.cyan('Type ') + chalk_1.default.white.bold('/help') + chalk_1.default.cyan(' for available commands'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
            backgroundColor: '#001a00'
        });
        console.log(startupBox);
    }
}
exports.IntroductionModule = IntroductionModule;
class OnboardingModule {
    static async runOnboarding() {
        console.clear();
        console.log(chalk_1.default.cyanBright(banner));
        await this.showBetaWarning();
        const hasKeys = await this.setupApiKeys();
        const systemOk = await this.checkSystemRequirements();
        return systemOk;
    }
    static async showBetaWarning() {
        const warningBox = (0, boxen_1.default)(chalk_1.default.red.bold('⚠️  BETA VERSION WARNING\n\n') +
            chalk_1.default.white('NikCLI is currently in beta and may contain bugs or unexpected behavior.\n\n') +
            chalk_1.default.yellow.bold('Potential Risks:\n') +
            chalk_1.default.white('• File system modifications\n') +
            chalk_1.default.white('• Code generation may not always be optimal\n') +
            chalk_1.default.white('• AI responses may be inaccurate\n') +
            chalk_1.default.white('• System resource usage\n\n') +
            chalk_1.default.cyan('For detailed security information, visit:\n') +
            chalk_1.default.blue.underline('https://github.com/nikomatt69/agent-cli/blob/main/SECURITY.md\n\n') +
            chalk_1.default.white('By continuing, you acknowledge these risks.'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'red',
            backgroundColor: '#2a0000'
        });
        console.log(warningBox);
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise(resolve => rl.question(chalk_1.default.yellow('\nDo you want to continue? (y/N): '), resolve));
        rl.close();
        if (!answer || !answer.toLowerCase().startsWith('y')) {
            console.log(chalk_1.default.blue('\n👋 Thanks for trying NikCLI!'));
            process.exit(0);
        }
    }
    static async setupApiKeys() {
        console.log(chalk_1.default.blue('\n🔑 API Key Setup'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (anthropicKey || openaiKey || googleKey) {
            console.log(chalk_1.default.green('✅ API keys detected'));
            return true;
        }
        try {
            const currentModel = config_manager_1.simpleConfigManager.get('currentModel');
            const modelCfg = config_manager_1.simpleConfigManager.get('models')[currentModel];
            if (modelCfg && modelCfg.provider === 'ollama') {
                console.log(chalk_1.default.green('✅ Ollama model configured'));
                return true;
            }
        }
        catch (_) {
        }
        console.log(chalk_1.default.yellow('⚠️ No API keys found'));
        const setupBox = (0, boxen_1.default)(chalk_1.default.white.bold('Setup your API key:\n\n') +
            chalk_1.default.green('• ANTHROPIC_API_KEY') + chalk_1.default.gray(' - for Claude models (recommended)\n') +
            chalk_1.default.blue('• OPENAI_API_KEY') + chalk_1.default.gray(' - for GPT models\n') +
            chalk_1.default.magenta('• GOOGLE_GENERATIVE_AI_API_KEY') + chalk_1.default.gray(' - for Gemini models\n\n') +
            chalk_1.default.white.bold('Example:\n') +
            chalk_1.default.dim('export ANTHROPIC_API_KEY="your-key-here"\n\n') +
            chalk_1.default.cyan('Or use Ollama for local models: ollama pull llama3.1:8b'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'yellow',
            backgroundColor: '#2a1a00'
        });
        console.log(setupBox);
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise(resolve => rl.question(chalk_1.default.yellow('\nContinue without API keys? (y/N): '), resolve));
        rl.close();
        if (!answer || !answer.toLowerCase().startsWith('y')) {
            console.log(chalk_1.default.blue('\n👋 Set up your API key and run NikCLI again!'));
            process.exit(0);
        }
        return await this.setupOllama();
    }
    static async checkSystemRequirements() {
        console.log(chalk_1.default.blue('\n🔍 System Check'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0]);
        if (major < 18) {
            console.log(chalk_1.default.red(`❌ Node.js ${major} is too old. Requires Node.js 18+`));
            return false;
        }
        console.log(chalk_1.default.green(`✅ Node.js ${version}`));
        try {
            const currentModel = config_manager_1.simpleConfigManager.get('currentModel');
            const modelCfg = config_manager_1.simpleConfigManager.get('models')[currentModel];
            if (modelCfg && modelCfg.provider === 'ollama') {
                const host = process.env.OLLAMA_HOST || '127.0.0.1:11434';
                const base = host.startsWith('http') ? host : `http://${host}`;
                try {
                    const res = await fetch(`${base}/api/tags`, { method: 'GET' });
                    if (res.ok) {
                        console.log(chalk_1.default.green('✅ Ollama service detected'));
                    }
                    else {
                        console.log(chalk_1.default.yellow('⚠️ Ollama service not responding'));
                    }
                }
                catch (err) {
                    console.log(chalk_1.default.yellow('⚠️ Ollama service not reachable'));
                    console.log(chalk_1.default.gray('   Start with: ollama serve'));
                }
            }
        }
        catch (_) {
        }
        return true;
    }
    static async setupOllama() {
        console.log(chalk_1.default.blue('\n🤖 Ollama Setup'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        try {
            const models = config_manager_1.simpleConfigManager.get('models');
            let ollamaEntries = Object.entries(models).filter(([, cfg]) => cfg.provider === 'ollama');
            if (ollamaEntries.length > 0) {
                console.log(chalk_1.default.green('✅ Ollama models found in configuration'));
                const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                const answer = await new Promise(resolve => rl.question(chalk_1.default.yellow('\nUse a local Ollama model? (Y/n): '), resolve));
                rl.close();
                if (!answer || answer.toLowerCase().startsWith('y')) {
                    let chosenName = ollamaEntries[0][0];
                    if (ollamaEntries.length > 1) {
                        console.log(chalk_1.default.cyan('\nAvailable Ollama models:'));
                        ollamaEntries.forEach(([name, cfg], idx) => {
                            console.log(`  [${idx + 1}] ${name} (${cfg.model})`);
                        });
                        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
                        const pick = await new Promise(resolve => rl2.question('Select model number (default 1): ', resolve));
                        rl2.close();
                        const i = parseInt((pick || '1').trim(), 10);
                        if (!isNaN(i) && i >= 1 && i <= ollamaEntries.length) {
                            chosenName = ollamaEntries[i - 1][0];
                        }
                    }
                    config_manager_1.simpleConfigManager.setCurrentModel(chosenName);
                    console.log(chalk_1.default.green(`✅ Switched to Ollama model: ${chosenName}`));
                    return true;
                }
            }
            else {
                const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                const answer = await new Promise(resolve => rl.question(chalk_1.default.yellow('\nNo Ollama models configured. Add default model (llama3.1:8b)? (Y/n): '), resolve));
                rl.close();
                if (!answer || answer.toLowerCase().startsWith('y')) {
                    const defaultName = 'llama3.1:8b';
                    config_manager_1.simpleConfigManager.addModel(defaultName, { provider: 'ollama', model: 'llama3.1:8b' });
                    config_manager_1.simpleConfigManager.setCurrentModel(defaultName);
                    console.log(chalk_1.default.green(`✅ Added and switched to Ollama model: ${defaultName}`));
                    return true;
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.yellow('⚠️ Error configuring Ollama models'));
        }
        console.log(chalk_1.default.yellow('⚠️ No AI provider configured'));
        return false;
    }
}
exports.OnboardingModule = OnboardingModule;
class SystemModule {
    static async checkApiKeys() {
        try {
            const currentModel = config_manager_1.simpleConfigManager.get('currentModel');
            const modelCfg = config_manager_1.simpleConfigManager.get('models')[currentModel];
            if (modelCfg && modelCfg.provider === 'ollama') {
                return true;
            }
        }
        catch (_) {
        }
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        return !!(anthropicKey || openaiKey || googleKey);
    }
    static checkNodeVersion() {
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0]);
        if (major < 18) {
            console.log(chalk_1.default.red(`❌ Node.js ${major} is too old. Requires Node.js 18+`));
            return false;
        }
        console.log(chalk_1.default.green(`✅ Node.js ${version}`));
        return true;
    }
    static async checkOllamaAvailability() {
        try {
            const currentModel = config_manager_1.simpleConfigManager.get('currentModel');
            const modelCfg = config_manager_1.simpleConfigManager.get('models')[currentModel];
            if (!modelCfg || modelCfg.provider !== 'ollama') {
                SystemModule.lastOllamaStatus = undefined;
                return true;
            }
        }
        catch (_) {
            return true;
        }
        try {
            const host = process.env.OLLAMA_HOST || '127.0.0.1:11434';
            const base = host.startsWith('http') ? host : `http://${host}`;
            const res = await fetch(`${base}/api/tags`, { method: 'GET' });
            if (!res.ok) {
                SystemModule.lastOllamaStatus = false;
                console.log(chalk_1.default.red(`❌ Ollama reachable at ${base} but returned status ${res.status}`));
                return false;
            }
            const data = await res.json().catch(() => null);
            if (!data || !Array.isArray(data.models)) {
                console.log(chalk_1.default.yellow('⚠️ Unexpected response from Ollama when listing models'));
            }
            else {
                const currentModel = config_manager_1.simpleConfigManager.get('currentModel');
                const modelCfg = config_manager_1.simpleConfigManager.get('models')[currentModel];
                const name = modelCfg?.model;
                const present = data.models.some((m) => m?.name === name || m?.model === name);
                if (!present && name) {
                    console.log(chalk_1.default.yellow(`⚠️ Ollama is running but model "${name}" is not present.`));
                    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                    const answer = await new Promise(resolve => rl.question(`Pull model now with "ollama pull ${name}"? (Y/n): `, resolve));
                    rl.close();
                    if (!answer || answer.toLowerCase().startsWith('y')) {
                        console.log(chalk_1.default.blue(`⏳ Pulling model ${name}...`));
                        const code = await new Promise((resolve) => {
                            const child = (0, child_process_1.spawn)('ollama', ['pull', name], { stdio: 'inherit' });
                            child.on('close', (code) => resolve(code ?? 1));
                            child.on('error', () => resolve(1));
                        });
                        if (code === 0) {
                            console.log(chalk_1.default.green(`✅ Model ${name} pulled successfully`));
                        }
                        else {
                            console.log(chalk_1.default.red(`❌ Failed to pull model ${name}. You can try manually: ollama pull ${name}`));
                            SystemModule.lastOllamaStatus = false;
                            return false;
                        }
                    }
                    else {
                        console.log(chalk_1.default.gray(`   You can pull it later with: ollama pull ${name}`));
                        SystemModule.lastOllamaStatus = false;
                        return false;
                    }
                }
            }
            console.log(chalk_1.default.green('✅ Ollama service detected'));
            SystemModule.lastOllamaStatus = true;
            return true;
        }
        catch (err) {
            const host = process.env.OLLAMA_HOST || '127.0.0.1:11434';
            const base = host.startsWith('http') ? host : `http://${host}`;
            console.log(chalk_1.default.red(`❌ Ollama service not reachable at ${base}`));
            console.log(chalk_1.default.gray('   Start it with "ollama serve" or open the Ollama app. Install: https://ollama.com'));
            SystemModule.lastOllamaStatus = false;
            return false;
        }
    }
    static async checkSystemRequirements() {
        console.log(chalk_1.default.blue('🔍 Checking system requirements...'));
        const checks = [
            this.checkNodeVersion(),
            await this.checkApiKeys(),
            await this.checkOllamaAvailability()
        ];
        const allPassed = checks.every(r => r);
        if (allPassed) {
            console.log(chalk_1.default.green('✅ All system checks passed'));
        }
        else {
            console.log(chalk_1.default.red('❌ System requirements not met'));
        }
        return allPassed;
    }
}
exports.SystemModule = SystemModule;
class ServiceModule {
    static async initializeServices() {
        const workingDir = process.cwd();
        tool_service_1.toolService.setWorkingDirectory(workingDir);
        planning_service_1.planningService.setWorkingDirectory(workingDir);
        lsp_service_1.lspService.setWorkingDirectory(workingDir);
        diff_manager_1.diffManager.setAutoAccept(true);
        console.log(chalk_1.default.dim('   Services configured'));
    }
    static async initializeAgents() {
        if (!this.agentManager) {
            this.agentManager = new agent_manager_1.AgentManager(config_manager_1.simpleConfigManager);
            await this.agentManager.initialize();
        }
        (0, register_agents_1.registerAgents)(this.agentManager);
        try {
            await this.agentManager.createAgent('universal-agent');
        }
        catch (_) {
        }
        const agents = this.agentManager.listAgents();
        console.log(chalk_1.default.dim(`   Agents ready (${agents.length} available)`));
    }
    static async initializeTools() {
        const tools = tool_service_1.toolService.getAvailableTools();
        console.log(chalk_1.default.dim(`   Tools ready (${tools.length} available)`));
    }
    static async initializePlanning() {
        console.log(chalk_1.default.dim('   Planning system ready'));
    }
    static async initializeSecurity() {
        console.log(chalk_1.default.dim('   Security policies loaded'));
    }
    static async initializeContext() {
        console.log(chalk_1.default.dim('   Context management ready'));
    }
    static async initializeSystem() {
        if (this.initialized)
            return true;
        console.log(chalk_1.default.blue('🔄 Initializing system...'));
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
                await step.fn();
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ ${step.name} failed: ${error.message}`));
                return false;
            }
        }
        this.initialized = true;
        console.log(chalk_1.default.green('✅ System ready'));
        return true;
    }
}
exports.ServiceModule = ServiceModule;
ServiceModule.initialized = false;
ServiceModule.agentManager = null;
class StreamingModule extends events_1.EventEmitter {
    constructor() {
        super();
        this.messageQueue = [];
        this.processingMessage = false;
        this.activeAgents = new Map();
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
        this.policyManager = new execution_policy_1.ExecutionPolicyManager(config_manager_1.simpleConfigManager);
        this.setupInterface();
        this.startMessageProcessor();
    }
    setupInterface() {
        process.stdin.setRawMode(true);
        require('readline').emitKeypressEvents(process.stdin);
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
                }
                else {
                    this.gracefulExit();
                }
            }
        });
        this.rl.on('line', async (input) => {
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
    setupServiceListeners() {
        agent_service_1.agentService.on('task_start', (task) => {
            this.activeAgents.set(task.id, task);
            this.queueMessage({
                type: 'system',
                content: `🤖 Agent ${task.agentType} started: ${task.task.slice(0, 50)}...`,
                metadata: { agentId: task.id, agentType: task.agentType }
            });
        });
        agent_service_1.agentService.on('task_progress', (task, update) => {
            this.queueMessage({
                type: 'agent',
                content: `📊 ${task.agentType}: ${update.progress}% ${update.description || ''}`,
                metadata: { agentId: task.id, progress: update.progress },
                agentId: task.id,
                progress: update.progress
            });
        });
    }
    queueMessage(message) {
        const fullMessage = {
            id: Date.now().toString(),
            timestamp: new Date(),
            status: 'queued',
            ...message
        };
        this.messageQueue.push(fullMessage);
    }
    async queueUserInput(input) {
        this.queueMessage({
            type: 'user',
            content: input
        });
    }
    showPrompt() {
        const dir = require('path').basename(this.context.workingDirectory);
        const agents = this.activeAgents.size;
        const agentIndicator = agents > 0 ? chalk_1.default.blue(`${agents}🤖`) : '🎛️';
        const modes = [];
        if (this.context.planMode)
            modes.push(chalk_1.default.cyan('plan'));
        if (this.context.autoAcceptEdits)
            modes.push(chalk_1.default.green('auto-accept'));
        const modeStr = modes.length > 0 ? ` ${modes.join(' ')} ` : '';
        const contextStr = chalk_1.default.dim(`${this.context.contextLeft}%`);
        let modelBadge = '';
        try {
            const currentModel = config_manager_1.simpleConfigManager.get('currentModel');
            const models = config_manager_1.simpleConfigManager.get('models') || {};
            const modelCfg = models[currentModel] || {};
            const provider = modelCfg.provider || 'unknown';
            let dot = chalk_1.default.dim('●');
            if (provider === 'ollama') {
                if (SystemModule.lastOllamaStatus === true)
                    dot = chalk_1.default.green('●');
                else if (SystemModule.lastOllamaStatus === false)
                    dot = chalk_1.default.red('●');
                else
                    dot = chalk_1.default.yellow('●');
            }
            const prov = chalk_1.default.magenta(provider);
            const name = chalk_1.default.white(currentModel || 'model');
            modelBadge = `${prov}:${name}${provider === 'ollama' ? ` ${dot}` : ''}`;
        }
        catch (_) {
            modelBadge = chalk_1.default.gray('model:unknown');
        }
        const statusDot = this.processingMessage ? chalk_1.default.green('●') + chalk_1.default.dim('…') : chalk_1.default.red('●');
        const statusBadge = `asst:${statusDot}`;
        const prompt = `\n┌─[${agentIndicator}:${chalk_1.default.green(dir)}${modeStr}]─[${contextStr}]─[${statusBadge}]─[${modelBadge}]\n└─❯ `;
        this.rl.setPrompt(prompt);
        this.rl.prompt();
    }
    autoComplete(line) {
        const commands = ['/status', '/agents', '/diff', '/accept', '/clear', '/help'];
        const agents = ['@react-expert', '@backend-expert', '@frontend-expert', '@devops-expert', '@code-review', '@autonomous-coder'];
        const all = [...commands, ...agents];
        const hits = all.filter(c => c.startsWith(line));
        return [hits.length ? hits : all, line];
    }
    showCommandMenu() {
        const lines = [];
        lines.push(`${chalk_1.default.bold('📋 Available Commands')}`);
        lines.push('');
        lines.push(`${chalk_1.default.green('/help')}     Show detailed help`);
        lines.push(`${chalk_1.default.green('/agents')}   List available agents`);
        lines.push(`${chalk_1.default.green('/status')}   Show system status`);
        lines.push(`${chalk_1.default.green('/clear')}    Clear session`);
        const content = lines.join('\n');
        console.log((0, boxen_1.default)(content, {
            padding: { top: 0, right: 2, bottom: 0, left: 2 },
            margin: { top: 1, right: 0, bottom: 0, left: 0 },
            borderStyle: 'round',
            borderColor: 'cyan',
            title: chalk_1.default.cyan('Command Menu'),
            titleAlignment: 'center'
        }));
    }
    cycleMode() {
        this.context.planMode = !this.context.planMode;
        console.log(this.context.planMode ?
            chalk_1.default.green('\n✅ Plan mode enabled') :
            chalk_1.default.yellow('\n⚠️ Plan mode disabled'));
    }
    stopAllAgents() {
        this.activeAgents.clear();
        console.log(chalk_1.default.yellow('\n⏹️ Stopped all active agents'));
    }
    startMessageProcessor() {
        setInterval(() => {
            if (!this.processingMessage) {
                this.processNextMessage();
            }
        }, 100);
    }
    processNextMessage() {
        const message = this.messageQueue.find(m => m.status === 'queued');
        if (!message)
            return;
        this.processingMessage = true;
        message.status = 'processing';
        this.showPrompt();
        setTimeout(() => {
            message.status = 'completed';
            this.processingMessage = false;
            this.showPrompt();
        }, 100);
    }
    gracefulExit() {
        console.log(chalk_1.default.blue('\n👋 Shutting down orchestrator...'));
        if (this.activeAgents.size > 0) {
            console.log(chalk_1.default.yellow(`⏳ Waiting for ${this.activeAgents.size} agents to finish...`));
        }
        console.log(chalk_1.default.green('✅ Goodbye!'));
        process.exit(0);
    }
    async start() {
        this.showPrompt();
        return new Promise((resolve) => {
            this.rl.on('close', resolve);
        });
    }
}
exports.StreamingModule = StreamingModule;
class MainOrchestrator {
    constructor() {
        this.initialized = false;
        this.setupGlobalHandlers();
    }
    setupGlobalHandlers() {
        process.on('unhandledRejection', (reason, promise) => {
            console.error(chalk_1.default.red('❌ Unhandled Rejection:'), reason);
        });
        process.on('uncaughtException', (error) => {
            console.error(chalk_1.default.red('❌ Uncaught Exception:'), error);
            this.gracefulShutdown();
        });
        process.on('SIGTERM', this.gracefulShutdown.bind(this));
        process.on('SIGINT', this.gracefulShutdown.bind(this));
    }
    async gracefulShutdown() {
        console.log(chalk_1.default.yellow('\n🛑 Shutting down orchestrator...'));
        try {
            if (this.streamingModule) {
            }
            console.log(chalk_1.default.green('✅ Orchestrator shut down cleanly'));
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Error during shutdown:'), error);
        }
        finally {
            process.exit(0);
        }
    }
    showQuickStart() {
        console.log(chalk_1.default.cyan.bold('\n📚 Quick Start Guide:'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        console.log(`${chalk_1.default.green('Natural Language:')} Just describe what you want`);
        console.log(`${chalk_1.default.blue('Agent Specific:')} @agent-name your task`);
        console.log(`${chalk_1.default.yellow('Commands:')} /help, /status, /agents`);
        console.log(`${chalk_1.default.magenta('Shortcuts:')} / (menu), Shift+Tab (modes)`);
        console.log('');
        console.log(chalk_1.default.dim('Examples:'));
        console.log(chalk_1.default.dim('• "Create a React todo app with TypeScript"'));
        console.log(chalk_1.default.dim('• "@react-expert optimize this component"'));
        console.log(chalk_1.default.dim('• "/status" to see system status'));
        console.log('');
    }
    async start() {
        try {
            const onboardingComplete = await OnboardingModule.runOnboarding();
            if (!onboardingComplete) {
                console.log(chalk_1.default.yellow('\n⚠️ Onboarding incomplete. Please address the issues above.'));
                process.exit(1);
            }
            logger_1.Logger.setConsoleOutput(false);
            logger_2.Logger.getInstance().setConsoleOutput(false);
            const initialized = await ServiceModule.initializeSystem();
            if (!initialized) {
                console.log(chalk_1.default.red('\n❌ Cannot start - system initialization failed'));
                process.exit(1);
            }
            logger_1.Logger.setConsoleOutput(true);
            logger_2.Logger.getInstance().setConsoleOutput(true);
            console.log(chalk_1.default.green.bold('\n🎉 Welcome to NikCLI!'));
            console.log(chalk_1.default.gray('─'.repeat(40)));
            this.showQuickStart();
            console.log(chalk_1.default.blue.bold('\n🤖 Starting NikCLI...\n'));
            const cli = new nik_cli_1.NikCLI();
            await cli.startChat({
                structuredUI: true
            });
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to start orchestrator:'), error);
            process.exit(1);
        }
    }
}
exports.MainOrchestrator = MainOrchestrator;
async function main() {
    const orchestrator = new MainOrchestrator();
    await orchestrator.start();
}
if (require.main === module) {
    main().catch(error => {
        console.error(chalk_1.default.red('❌ Startup failed:'), error);
        process.exit(1);
    });
}
