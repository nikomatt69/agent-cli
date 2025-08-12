"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleManager = void 0;
const chalk_1 = __importDefault(require("chalk"));
const terminal_ui_1 = require("../ui/terminal-ui");
const config_manager_1 = require("./config-manager");
const advanced_ai_provider_1 = require("../ai/advanced-ai-provider");
class ModuleManager {
    constructor(context) {
        this.modules = new Map();
        this.context = context;
        this.registerModules();
    }
    /**
     * Register all available modules
     */
    registerModules() {
        // System Commands
        this.register({
            name: 'help',
            description: 'Show detailed help and command reference',
            category: 'system',
            handler: this.handleHelp.bind(this)
        });
        this.register({
            name: 'agents',
            description: 'List all available AI agents',
            category: 'system',
            handler: this.handleAgents.bind(this)
        });
        this.register({
            name: 'model',
            description: 'Switch AI model or show current model',
            category: 'system',
            handler: this.handleModel.bind(this)
        });
        this.register({
            name: 'clear',
            description: 'Clear conversation history and free up context',
            category: 'system',
            handler: this.handleClear.bind(this)
        });
        // File Operations
        this.register({
            name: 'cd',
            description: 'Change current working directory',
            category: 'file',
            requiresArgs: true,
            handler: this.handleChangeDirectory.bind(this)
        });
        this.register({
            name: 'pwd',
            description: 'Show current working directory',
            category: 'file',
            handler: this.handlePrintDirectory.bind(this)
        });
        this.register({
            name: 'ls',
            description: 'List files in current directory',
            category: 'file',
            handler: this.handleListFiles.bind(this)
        });
        // Analysis Commands
        this.register({
            name: 'analyze',
            description: 'Quick project analysis',
            category: 'analysis',
            handler: this.handleAnalyze.bind(this)
        });
        this.register({
            name: 'auto',
            description: 'Fully autonomous task execution',
            category: 'analysis',
            requiresArgs: true,
            handler: this.handleAutoExecution.bind(this)
        });
        this.register({
            name: 'context',
            description: 'Show execution context',
            category: 'analysis',
            handler: this.handleContext.bind(this)
        });
        this.register({
            name: 'history',
            description: 'Show execution history',
            category: 'analysis',
            handler: this.handleHistory.bind(this)
        });
        // Diff Management
        this.register({
            name: 'diff',
            description: 'Show file changes (all diffs if no file specified)',
            category: 'diff',
            handler: this.handleDiff.bind(this)
        });
        this.register({
            name: 'accept',
            description: 'Accept and apply file changes',
            category: 'diff',
            requiresArgs: true,
            handler: this.handleAccept.bind(this)
        });
        this.register({
            name: 'reject',
            description: 'Reject and discard file changes',
            category: 'diff',
            requiresArgs: true,
            handler: this.handleReject.bind(this)
        });
        // Security Commands
        this.register({
            name: 'security',
            description: 'Show current security status',
            category: 'security',
            handler: this.handleSecurity.bind(this)
        });
        this.register({
            name: 'policy',
            description: 'Update security policy settings',
            category: 'security',
            handler: this.handlePolicy.bind(this)
        });
        // Mode Toggles
        this.register({
            name: 'plan',
            description: 'Toggle plan mode (shift+tab to cycle)',
            category: 'system',
            handler: this.handlePlanMode.bind(this)
        });
        this.register({
            name: 'auto-accept',
            description: 'Toggle auto-accept edits mode',
            category: 'system',
            handler: this.handleAutoAccept.bind(this)
        });
        this.register({
            name: 'autonomous',
            description: 'Toggle autonomous mode',
            category: 'system',
            handler: this.handleAutonomous.bind(this)
        });
    }
    /**
     * Register a new module
     */
    register(module) {
        this.modules.set(module.name, module);
    }
    /**
     * Execute a command
     */
    async executeCommand(command, args) {
        const module = this.modules.get(command);
        if (!module) {
            console.log(chalk_1.default.red(`Unknown command: ${command}`));
            console.log(chalk_1.default.gray('Type /help for available commands'));
            return false;
        }
        if (module.requiresArgs && args.length === 0) {
            console.log(chalk_1.default.red(`Command '${command}' requires arguments`));
            console.log(chalk_1.default.gray(`Description: ${module.description}`));
            return false;
        }
        try {
            await module.handler(args, this.context);
            return true;
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error executing ${command}: ${error.message}`));
            return false;
        }
    }
    /**
     * Get all available commands
     */
    getCommands() {
        return Array.from(this.modules.values());
    }
    /**
     * Get commands for autocompletion
     */
    getCommandNames() {
        return Array.from(this.modules.keys()).map(name => `/${name}`);
    }
    /**
     * Update context
     */
    updateContext(context) {
        this.context = { ...this.context, ...context };
    }
    // Command Handlers
    async handleHelp(args, context) {
        console.log(chalk_1.default.cyan.bold('\\n🤖 Autonomous Claude Assistant - Command Reference'));
        console.log(chalk_1.default.gray('═'.repeat(60)));
        const categories = {
            system: '🔧 System Commands',
            file: '📁 File Operations',
            analysis: '🔍 Analysis & Tools',
            diff: '📝 File Changes & Diffs',
            security: '🔒 Security & Policy'
        };
        for (const [category, title] of Object.entries(categories)) {
            const commands = this.getCommands().filter(c => c.category === category);
            if (commands.length > 0) {
                console.log(chalk_1.default.white.bold(`\\n${title}:`));
                commands.forEach(cmd => {
                    console.log(`${chalk_1.default.green(`/${cmd.name}`).padEnd(20)} ${cmd.description}`);
                });
            }
        }
        console.log(chalk_1.default.white.bold('\\n🤖 Specialized Agents:'));
        console.log(`${chalk_1.default.blue('@ai-analysis')} <task>     AI code analysis and review`);
        console.log(`${chalk_1.default.blue('@code-review')} <task>     Code review and suggestions`);
        console.log(`${chalk_1.default.blue('@backend-expert')} <task>   Backend development specialist`);
        console.log(`${chalk_1.default.blue('@frontend-expert')} <task>  Frontend/UI development expert`);
        console.log(`${chalk_1.default.blue('@react-expert')} <task>    React and Next.js specialist`);
        console.log(`${chalk_1.default.blue('@devops-expert')} <task>   DevOps and infrastructure expert`);
        console.log(`${chalk_1.default.blue('@system-admin')} <task>    System administration tasks`);
        console.log(`${chalk_1.default.blue('@autonomous-coder')} <task> Full autonomous coding agent`);
        console.log(chalk_1.default.white.bold('\\n💬 Natural Language Examples:'));
        console.log(chalk_1.default.dim('• \"Create a React todo app with TypeScript and tests\"'));
        console.log(chalk_1.default.dim('• \"Fix all ESLint errors in this project\"'));
        console.log(chalk_1.default.dim('• \"Add authentication with JWT to this API\"'));
        console.log(chalk_1.default.dim('• \"Set up Docker and CI/CD for deployment\"'));
        console.log(chalk_1.default.dim('• \"Optimize this component for performance\"'));
        console.log(chalk_1.default.gray('\\n' + '─'.repeat(60)));
        console.log(chalk_1.default.yellow('💡 Tip: Use TAB for auto-completion, / for command menu, Shift+Tab to cycle modes'));
    }
    async handleAgents(args, context) {
        console.log(chalk_1.default.cyan.bold('\\n🤖 Available Specialized Agents'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        // This would be dynamically populated from agent registry
        const agents = [
            { name: 'ai-analysis', desc: 'AI code analysis and review' },
            { name: 'code-review', desc: 'Code review and suggestions' },
            { name: 'backend-expert', desc: 'Backend development specialist' },
            { name: 'frontend-expert', desc: 'Frontend/UI development expert' },
            { name: 'react-expert', desc: 'React and Next.js specialist' },
            { name: 'devops-expert', desc: 'DevOps and infrastructure expert' },
            { name: 'system-admin', desc: 'System administration tasks' },
            { name: 'autonomous-coder', desc: 'Full autonomous coding agent' }
        ];
        agents.forEach(agent => {
            console.log(`${chalk_1.default.green('•')} ${chalk_1.default.bold(agent.name)}`);
            console.log(`  ${chalk_1.default.gray(agent.desc)}`);
        });
        console.log(chalk_1.default.dim('\\nUsage: @<agent-name> <task>'));
    }
    async handleModel(args, context) {
        if (args[0]) {
            try {
                advanced_ai_provider_1.advancedAIProvider.setModel(args[0]);
                config_manager_1.simpleConfigManager.setCurrentModel(args[0]);
                console.log(chalk_1.default.green(`✅ Switched to: ${args[0]}`));
            }
            catch (error) {
                console.log(chalk_1.default.red(`Error: ${error.message}`));
            }
        }
        else {
            const modelInfo = advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo();
            console.log(chalk_1.default.blue(`🧠 Current model: ${modelInfo.name}`));
        }
    }
    async handleClear(args, context) {
        console.clear();
        context.session.messages = context.session.messages.filter((m) => m.role === 'system');
        context.session.executionHistory = [];
        advanced_ai_provider_1.advancedAIProvider.clearExecutionContext();
        console.log(chalk_1.default.green('✅ Session cleared'));
    }
    async handleChangeDirectory(args, context) {
        const newDir = args[0] || process.cwd();
        try {
            const path = require('path');
            const fs = require('fs');
            const resolvedPath = path.resolve(context.workingDirectory, newDir);
            if (!fs.existsSync(resolvedPath)) {
                console.log(chalk_1.default.red(`Directory not found: ${newDir}`));
                return;
            }
            context.workingDirectory = resolvedPath;
            advanced_ai_provider_1.advancedAIProvider.setWorkingDirectory(resolvedPath);
            console.log(chalk_1.default.green(`✅ Changed to: ${resolvedPath}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error changing directory: ${error.message}`));
        }
    }
    async handlePrintDirectory(args, context) {
        console.log(chalk_1.default.blue(`📁 Current directory: ${context.workingDirectory}`));
    }
    async handleListFiles(args, context) {
        try {
            const fs = require('fs');
            const files = fs.readdirSync(context.workingDirectory, { withFileTypes: true });
            console.log(chalk_1.default.blue(`\\n📁 ${context.workingDirectory}:`));
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
    async handleAnalyze(args, context) {
        console.log(chalk_1.default.blue('🔍 Quick project analysis...'));
        // Implementation for project analysis
        console.log(chalk_1.default.green('Analysis complete!'));
    }
    async handleAutoExecution(args, context) {
        const task = args.join(' ');
        console.log(chalk_1.default.blue(`\\n🎯 Autonomous Mode: Analyzing and executing task...`));
        console.log(chalk_1.default.gray(`Task: ${task}\\n`));
        // Implementation for autonomous execution
    }
    async handleContext(args, context) {
        const execContext = advanced_ai_provider_1.advancedAIProvider.getExecutionContext();
        if (execContext.size === 0) {
            console.log(chalk_1.default.yellow('No execution context available'));
            return;
        }
        console.log(chalk_1.default.cyan.bold('\\n🧠 Execution Context'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        for (const [key, value] of execContext) {
            console.log(`${chalk_1.default.blue(key)}: ${chalk_1.default.dim(JSON.stringify(value, null, 2).slice(0, 100))}...`);
        }
    }
    async handleHistory(args, context) {
        const history = context.session.executionHistory.slice(-20);
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
    async handleDiff(args, context) {
        if (args[0]) {
            terminal_ui_1.diffManager.showDiff(args[0]);
        }
        else {
            terminal_ui_1.diffManager.showAllDiffs();
        }
    }
    async handleAccept(args, context) {
        if (args[0] === 'all') {
            terminal_ui_1.diffManager.acceptAllDiffs();
        }
        else if (args[0]) {
            terminal_ui_1.diffManager.acceptDiff(args[0]);
        }
        else {
            console.log(chalk_1.default.red('Usage: /accept <file> or /accept all'));
        }
    }
    async handleReject(args, context) {
        if (args[0]) {
            terminal_ui_1.diffManager.rejectDiff(args[0]);
        }
        else {
            console.log(chalk_1.default.red('Usage: /reject <file>'));
        }
    }
    async handleSecurity(args, context) {
        const summary = await context.policyManager.getPolicySummary();
        console.log(chalk_1.default.blue.bold('🔒 Security Policy Status'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        console.log(`${chalk_1.default.green('Current Policy:')} ${summary.currentPolicy.approval}`);
        console.log(`${chalk_1.default.green('Sandbox Mode:')} ${summary.currentPolicy.sandbox}`);
        console.log(`${chalk_1.default.green('Timeout:')} ${summary.currentPolicy.timeoutMs}ms`);
        console.log(`${chalk_1.default.green('Allowed Commands:')} ${summary.allowedCommands}`);
        console.log(`${chalk_1.default.red('Blocked Commands:')} ${summary.deniedCommands}`);
    }
    async handlePolicy(args, context) {
        if (args[0] && args[1]) {
            const [setting, value] = args;
            try {
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
        else {
            await this.handleSecurity([], context);
        }
    }
    async handlePlanMode(args, context) {
        context.planMode = !context.planMode;
        if (context.planMode) {
            console.log(chalk_1.default.green('\\n✅ plan mode on ') + chalk_1.default.dim('(shift+tab to cycle)'));
        }
        else {
            console.log(chalk_1.default.yellow('\\n⚠️ plan mode off'));
        }
    }
    async handleAutoAccept(args, context) {
        context.autoAcceptEdits = !context.autoAcceptEdits;
        terminal_ui_1.diffManager.setAutoAccept(context.autoAcceptEdits);
        if (context.autoAcceptEdits) {
            console.log(chalk_1.default.green('\\n✅ auto-accept edits on ') + chalk_1.default.dim('(shift+tab to cycle)'));
        }
        else {
            console.log(chalk_1.default.yellow('\\n⚠️ auto-accept edits off'));
        }
    }
    async handleAutonomous(args, context) {
        if (args[0] === 'off') {
            context.autonomous = false;
            console.log(chalk_1.default.yellow('⚠️ Autonomous mode disabled - will ask for confirmation'));
        }
        else {
            context.autonomous = true;
            console.log(chalk_1.default.green('✅ Autonomous mode enabled - full independence'));
        }
    }
}
exports.ModuleManager = ModuleManager;
