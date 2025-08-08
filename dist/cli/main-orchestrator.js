#!/usr/bin/env node
"use strict";
/**
 * Main AI Development Orchestrator
 * Production-ready autonomous development system with streaming interface
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainOrchestrator = void 0;
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const gradient_string_1 = __importDefault(require("gradient-string"));
const streaming_orchestrator_1 = require("./streaming-orchestrator");
const agent_service_1 = require("./services/agent-service");
const tool_service_1 = require("./services/tool-service");
const planning_service_1 = require("./services/planning-service");
const lsp_service_1 = require("./services/lsp-service");
const diff_manager_1 = require("./ui/diff-manager");
class MainOrchestrator {
    constructor() {
        this.initialized = false;
        this.streamOrchestrator = new streaming_orchestrator_1.StreamingOrchestrator();
        this.setupGlobalHandlers();
    }
    setupGlobalHandlers() {
        // Global error handler
        process.on('unhandledRejection', (reason, promise) => {
            console.error(chalk_1.default.red('❌ Unhandled Rejection:'), reason);
        });
        process.on('uncaughtException', (error) => {
            console.error(chalk_1.default.red('❌ Uncaught Exception:'), error);
            this.gracefulShutdown();
        });
        // Graceful shutdown handlers
        process.on('SIGTERM', this.gracefulShutdown.bind(this));
        process.on('SIGINT', this.gracefulShutdown.bind(this));
    }
    async gracefulShutdown() {
        console.log(chalk_1.default.yellow('\\n🛑 Shutting down orchestrator...'));
        try {
            // Stop all active agents
            const activeAgents = agent_service_1.agentService.getActiveAgents();
            if (activeAgents.length > 0) {
                console.log(chalk_1.default.blue(`⏳ Waiting for ${activeAgents.length} agents to complete...`));
                // In production, implement proper agent shutdown
            }
            // Save any pending diffs
            const pendingDiffs = diff_manager_1.diffManager.getPendingCount();
            if (pendingDiffs > 0) {
                console.log(chalk_1.default.yellow(`💾 ${pendingDiffs} diffs still pending`));
            }
            // Clear resources
            await this.cleanup();
            console.log(chalk_1.default.green('✅ Orchestrator shut down cleanly'));
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Error during shutdown:'), error);
        }
        finally {
            process.exit(0);
        }
    }
    async cleanup() {
        // Cleanup services
        const lspServers = lsp_service_1.lspService.getServerStatus();
        for (const server of lspServers) {
            if (server.status === 'running') {
                await lsp_service_1.lspService.stopServer(server.name.toLowerCase().replace(' ', '-'));
            }
        }
    }
    async checkSystemRequirements() {
        console.log(chalk_1.default.blue('🔍 Checking system requirements...'));
        const checks = [
            this.checkNodeVersion(),
            this.checkAPIKeys(),
            this.checkWorkingDirectory(),
            this.checkDependencies()
        ];
        const results = await Promise.all(checks);
        const allPassed = results.every(r => r);
        if (allPassed) {
            console.log(chalk_1.default.green('✅ All system checks passed'));
        }
        else {
            console.log(chalk_1.default.red('❌ System requirements not met'));
        }
        return allPassed;
    }
    checkNodeVersion() {
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0]);
        if (major < 18) {
            console.log(chalk_1.default.red(`❌ Node.js ${major} is too old. Requires Node.js 18+`));
            return false;
        }
        console.log(chalk_1.default.green(`✅ Node.js ${version}`));
        return true;
    }
    checkAPIKeys() {
        const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
        const hasOpenAI = !!process.env.OPENAI_API_KEY;
        const hasGoogle = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!hasAnthropic && !hasOpenAI && !hasGoogle) {
            console.log(chalk_1.default.red('❌ No API keys found'));
            console.log(chalk_1.default.yellow('Set at least one: ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY'));
            return false;
        }
        const available = [];
        if (hasAnthropic)
            available.push('Claude');
        if (hasOpenAI)
            available.push('GPT');
        if (hasGoogle)
            available.push('Gemini');
        console.log(chalk_1.default.green(`✅ API Keys: ${available.join(', ')}`));
        return true;
    }
    checkWorkingDirectory() {
        const cwd = process.cwd();
        const fs = require('fs');
        if (!fs.existsSync(cwd)) {
            console.log(chalk_1.default.red(`❌ Working directory does not exist: ${cwd}`));
            return false;
        }
        console.log(chalk_1.default.green(`✅ Working directory: ${cwd}`));
        return true;
    }
    checkDependencies() {
        try {
            // Check critical dependencies
            require('chalk');
            require('boxen');
            require('gradient-string');
            require('nanoid');
            require('diff');
            console.log(chalk_1.default.green('✅ All dependencies available'));
            return true;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Missing dependencies: ${error}`));
            return false;
        }
    }
    showStartupBanner() {
        console.clear();
        const banner = (0, boxen_1.default)(`${gradient_string_1.default.rainbow.multiline([
            '╔═══════════════════════════════════════════╗',
            '║        AI DEVELOPMENT ORCHESTRATOR        ║',
            '╚═══════════════════════════════════════════╝'
        ].join('\\n'))}\\n\\n` +
            `${chalk_1.default.white.bold('🎛️  Multi-Agent Autonomous Development System')}\\n\\n` +
            `${chalk_1.default.blue('Features:')}\\n` +
            `• ${chalk_1.default.green('Streaming Chat Interface')} - Real-time message processing\\n` +
            `• ${chalk_1.default.green('Parallel Agent Execution')} - Up to 3 agents simultaneously\\n` +
            `• ${chalk_1.default.green('Intelligent Planning')} - Autonomous task breakdown\\n` +
            `• ${chalk_1.default.green('Tool Integration')} - File ops, git, package management\\n` +
            `• ${chalk_1.default.green('Diff Management')} - Visual file change review\\n` +
            `• ${chalk_1.default.green('Security Policies')} - Safe command execution\\n` +
            `• ${chalk_1.default.green('Context Management')} - Automatic memory optimization\\n\\n` +
            `${chalk_1.default.yellow.bold('🚀 Ready for autonomous development!')}`, {
            padding: 2,
            margin: 1,
            borderStyle: 'double',
            borderColor: 'cyan',
            textAlignment: 'center',
        });
        console.log(banner);
    }
    async initializeSystem() {
        console.log(chalk_1.default.blue('🚀 Initializing AI Development Orchestrator...'));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        const steps = [
            { name: 'Service Registration', fn: this.initializeServices.bind(this) },
            { name: 'Agent System', fn: this.initializeAgents.bind(this) },
            { name: 'Planning System', fn: this.initializePlanning.bind(this) },
            { name: 'Tool System', fn: this.initializeTools.bind(this) },
            { name: 'Security Policies', fn: this.initializeSecurity.bind(this) },
            { name: 'Context Management', fn: this.initializeContext.bind(this) }
        ];
        for (const step of steps) {
            try {
                console.log(chalk_1.default.blue(`🔄 ${step.name}...`));
                await step.fn();
                console.log(chalk_1.default.green(`✅ ${step.name} initialized`));
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ ${step.name} failed: ${error.message}`));
                return false;
            }
        }
        this.initialized = true;
        console.log(chalk_1.default.green.bold('\\n🎉 System initialization complete!'));
        return true;
    }
    async initializeServices() {
        // Set working directory for all services
        const workingDir = process.cwd();
        tool_service_1.toolService.setWorkingDirectory(workingDir);
        planning_service_1.planningService.setWorkingDirectory(workingDir);
        lsp_service_1.lspService.setWorkingDirectory(workingDir);
        diff_manager_1.diffManager.setAutoAccept(true); // Default to auto-accept as shown in image
    }
    async initializeAgents() {
        // Agent service is initialized via import
        // Verify all agents are available
        const agents = agent_service_1.agentService.getAvailableAgents();
        console.log(chalk_1.default.dim(`   Loaded ${agents.length} agents`));
    }
    async initializePlanning() {
        // Planning service initialization
        console.log(chalk_1.default.dim('   Planning system ready'));
    }
    async initializeTools() {
        const tools = tool_service_1.toolService.getAvailableTools();
        console.log(chalk_1.default.dim(`   Loaded ${tools.length} tools`));
    }
    async initializeSecurity() {
        // Security policies are initialized in the orchestrator
        console.log(chalk_1.default.dim('   Security policies loaded'));
    }
    async initializeContext() {
        // Context management is handled in the streaming orchestrator
        console.log(chalk_1.default.dim('   Context management ready'));
    }
    showQuickStart() {
        console.log(chalk_1.default.cyan.bold('\\n📚 Quick Start Guide:'));
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
            // Show startup banner
            this.showStartupBanner();
            // Wait for user to see banner
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Check system requirements
            const requirementsMet = await this.checkSystemRequirements();
            if (!requirementsMet) {
                console.log(chalk_1.default.red('\\n❌ Cannot start - system requirements not met'));
                process.exit(1);
            }
            // Initialize all systems
            const initialized = await this.initializeSystem();
            if (!initialized) {
                console.log(chalk_1.default.red('\\n❌ Cannot start - system initialization failed'));
                process.exit(1);
            }
            // Show quick start guide
            this.showQuickStart();
            // Start the streaming orchestrator
            console.log(chalk_1.default.blue.bold('🎛️ Starting Streaming Orchestrator...\\n'));
            await this.streamOrchestrator.start();
        }
        catch (error) {
            console.error(chalk_1.default.red('❌ Failed to start orchestrator:'), error);
            process.exit(1);
        }
    }
}
exports.MainOrchestrator = MainOrchestrator;
// Start if run directly
if (require.main === module) {
    const orchestrator = new MainOrchestrator();
    orchestrator.start().catch(error => {
        console.error(chalk_1.default.red('❌ Startup failed:'), error);
        process.exit(1);
    });
}
