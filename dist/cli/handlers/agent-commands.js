"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentCommands = void 0;
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = require("fs");
const unified_agent_factory_1 = require("../core/unified-agent-factory");
const agent_persistence_1 = require("../persistence/agent-persistence");
class AgentCommands {
    static async createAgent(args) {
        try {
            const options = this.parseCreateAgentArgs(args);
            if (options.help) {
                return {
                    success: true,
                    message: this.getCreateAgentHelp()
                };
            }
            if (!options.name) {
                return {
                    success: false,
                    message: 'Agent name is required. Use --name <name>',
                    error: 'Agent name is required. Use --name <name>'
                };
            }
            const namePattern = /^[a-zA-Z0-9_-]+$/;
            if (!namePattern.test(options.name)) {
                return {
                    success: false,
                    message: 'Invalid agent name. Use only letters, numbers, underscores, and hyphens.',
                    error: 'Invalid agent configuration: name must match pattern ^[a-zA-Z0-9_-]+$'
                };
            }
            if (!options.profile && !options.config) {
                return {
                    success: false,
                    message: 'Either --profile or --config is required',
                    error: 'Either --profile or --config is required'
                };
            }
            let instance;
            if (options.config) {
                const configData = await fs_1.promises.readFile(options.config, 'utf-8');
                const config = JSON.parse(configData);
                instance = await unified_agent_factory_1.unifiedAgentFactory.createAgent(config);
            }
            else {
                instance = await unified_agent_factory_1.unifiedAgentFactory.createAgentFromProfile(options.profile, options.name, options.overrides);
            }
            return {
                success: true,
                message: `✅ Agent '${options.name}' created successfully`,
                data: {
                    name: instance.config.name,
                    profile: instance.config.profile,
                    status: instance.status
                }
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to create agent: ${error.message}`,
                error: `Failed to create agent: ${error.message}`
            };
        }
    }
    static async launchAgent(args) {
        try {
            const options = this.parseLaunchAgentArgs(args);
            if (options.help) {
                return {
                    success: true,
                    message: this.getLaunchAgentHelp()
                };
            }
            if (!options.name) {
                return {
                    success: false,
                    message: 'Agent name is required. Use --name <name>',
                    error: 'Agent name is required. Use --name <name>'
                };
            }
            const exists = await agent_persistence_1.agentPersistence.agentExists(options.name);
            if (!exists) {
                return {
                    success: false,
                    message: `Agent '${options.name}' not found. Use create-agent first.`,
                    error: `Agent '${options.name}' not found. Use create-agent first.`
                };
            }
            const info = await unified_agent_factory_1.unifiedAgentFactory.describeAgent(options.name);
            if (!info.instance) {
                if (info.config) {
                    await unified_agent_factory_1.unifiedAgentFactory.createAgent(info.config);
                }
                else {
                    return {
                        success: false,
                        message: `No configuration found for agent '${options.name}'`,
                        error: `No configuration found for agent '${options.name}'`
                    };
                }
            }
            let policy;
            if (options.auto) {
                policy = {
                    maxSteps: options.maxSteps,
                    maxTokens: options.maxTokens,
                    maxCost: options.maxCost,
                    timeLimit: options.timeLimit ? this.parseTimeLimit(options.timeLimit) : undefined,
                    safeToolsOnly: options.safeToolsOnly,
                    allowWrite: options.allowWrite
                };
            }
            const instance = await unified_agent_factory_1.unifiedAgentFactory.launchAgent(options.name, options.auto, policy);
            const mode = options.auto ? 'auto' : 'interactive';
            return {
                success: true,
                message: `✅ Agent '${options.name}' launched in ${mode} mode`,
                data: {
                    name: instance.config.name,
                    status: instance.status,
                    autoMode: options.auto
                }
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to launch agent: ${error.message}`,
                error: `Failed to launch agent: ${error.message}`
            };
        }
    }
    static async listAgents(args) {
        try {
            const options = this.parseListAgentsArgs(args);
            if (options.help) {
                return {
                    success: true,
                    message: this.getListAgentsHelp()
                };
            }
            const agents = await unified_agent_factory_1.unifiedAgentFactory.listAgents();
            if (options.json) {
                return {
                    success: true,
                    message: 'Agents listed successfully',
                    data: agents
                };
            }
            const table = this.formatAgentsTable(agents);
            return {
                success: true,
                message: table
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to list agents: ${error.message}`,
                error: `Failed to list agents: ${error.message}`
            };
        }
    }
    static async describeAgent(args) {
        try {
            const options = this.parseDescribeAgentArgs(args);
            if (options.help) {
                return {
                    success: true,
                    message: this.getDescribeAgentHelp()
                };
            }
            if (!options.name) {
                return {
                    success: false,
                    message: 'Agent name is required. Use --name <name>',
                    error: 'Agent name is required. Use --name <name>'
                };
            }
            const info = await unified_agent_factory_1.unifiedAgentFactory.describeAgent(options.name);
            if (!info.config) {
                return {
                    success: false,
                    message: `Agent '${options.name}' not found`,
                    error: `Agent '${options.name}' not found`
                };
            }
            if (options.json) {
                return {
                    success: true,
                    message: 'Agent information retrieved successfully',
                    data: info
                };
            }
            const description = this.formatAgentDescription(info);
            return {
                success: true,
                message: description
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to describe agent: ${error.message}`,
                error: `Failed to describe agent: ${error.message}`
            };
        }
    }
    static async pauseAgent(args) {
        try {
            const options = this.parsePauseAgentArgs(args);
            if (options.help) {
                return {
                    success: true,
                    message: this.getPauseAgentHelp()
                };
            }
            if (!options.name) {
                return {
                    success: false,
                    message: 'Agent name is required. Use --name <name>',
                    error: 'Agent name is required. Use --name <name>'
                };
            }
            await unified_agent_factory_1.unifiedAgentFactory.pauseAgent(options.name);
            return {
                success: true,
                message: `✅ Agent '${options.name}' paused successfully`
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to pause agent: ${error.message}`,
                error: `Failed to pause agent: ${error.message}`
            };
        }
    }
    static async resumeAgent(args) {
        try {
            const options = this.parseResumeAgentArgs(args);
            if (options.help) {
                return {
                    success: true,
                    message: this.getResumeAgentHelp()
                };
            }
            if (!options.name) {
                return {
                    success: false,
                    message: 'Agent name is required. Use --name <name>',
                    error: 'Agent name is required. Use --name <name>'
                };
            }
            await unified_agent_factory_1.unifiedAgentFactory.resumeAgent(options.name);
            return {
                success: true,
                message: `✅ Agent '${options.name}' resumed successfully`
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to resume agent: ${error.message}`,
                error: `Failed to resume agent: ${error.message}`
            };
        }
    }
    static async killAgent(args) {
        try {
            const options = this.parseKillAgentArgs(args);
            if (options.help) {
                return {
                    success: true,
                    message: this.getKillAgentHelp()
                };
            }
            if (!options.name) {
                return {
                    success: false,
                    message: 'Agent name is required. Use --name <name>',
                    error: 'Agent name is required. Use --name <name>'
                };
            }
            await unified_agent_factory_1.unifiedAgentFactory.deleteAgent(options.name);
            return {
                success: true,
                message: `✅ Agent '${options.name}' killed and removed successfully`
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to kill agent: ${error.message}`,
                error: `Failed to kill agent: ${error.message}`
            };
        }
    }
    static async factory(args) {
        try {
            const options = this.parseFactoryArgs(args);
            if (options.help) {
                return {
                    success: true,
                    message: this.getFactoryHelp()
                };
            }
            if (options.profile && options.name) {
                const namePattern = /^[a-zA-Z0-9_-]+$/;
                if (!namePattern.test(options.name)) {
                    return {
                        success: false,
                        message: 'Invalid agent name. Use only letters, numbers, underscores, and hyphens.',
                        error: 'Invalid agent configuration: name must match pattern ^[a-zA-Z0-9_-]+$'
                    };
                }
                const overrides = options.overrides ? JSON.parse(options.overrides) : {};
                const instance = await unified_agent_factory_1.unifiedAgentFactory.createAgentFromProfile(options.profile, options.name, overrides);
                return {
                    success: true,
                    message: `✅ Agent '${options.name}' created from profile '${options.profile}'`,
                    data: {
                        name: instance.config.name,
                        profile: instance.config.profile,
                        status: instance.status
                    }
                };
            }
            unified_agent_factory_1.unifiedAgentFactory.showFactoryDashboard();
            return {
                success: true,
                message: 'Factory dashboard displayed'
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Factory command failed: ${error.message}`,
                error: `Factory command failed: ${error.message}`
            };
        }
    }
    static parseCreateAgentArgs(args) {
        const options = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--help' || arg === '-h') {
                options.help = true;
            }
            else if (arg === '--name' || arg === '-n') {
                options.name = args[++i];
            }
            else if (arg === '--profile' || arg === '-p') {
                options.profile = args[++i];
            }
            else if (arg === '--config' || arg === '-c') {
                options.config = args[++i];
            }
            else if (arg === '--json') {
                options.json = true;
            }
            else if (arg.startsWith('--override.')) {
                const key = arg.substring(11);
                options.overrides = options.overrides || {};
                options.overrides[key] = args[++i];
            }
        }
        return options;
    }
    static parseLaunchAgentArgs(args) {
        const options = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--help' || arg === '-h') {
                options.help = true;
            }
            else if (arg === '--name' || arg === '-n') {
                options.name = args[++i];
            }
            else if (arg === '--auto') {
                options.auto = true;
            }
            else if (arg === '--max-steps') {
                options.maxSteps = parseInt(args[++i]);
            }
            else if (arg === '--max-tokens') {
                options.maxTokens = parseInt(args[++i]);
            }
            else if (arg === '--max-cost') {
                options.maxCost = parseFloat(args[++i]);
            }
            else if (arg === '--time-limit') {
                options.timeLimit = args[++i];
            }
            else if (arg === '--safe-tools-only') {
                options.safeToolsOnly = true;
            }
            else if (arg === '--allow-write') {
                options.allowWrite = true;
            }
            else if (arg === '--json') {
                options.json = true;
            }
        }
        return options;
    }
    static parseListAgentsArgs(args) {
        const options = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--help' || arg === '-h') {
                options.help = true;
            }
            else if (arg === '--json') {
                options.json = true;
            }
        }
        return options;
    }
    static parseDescribeAgentArgs(args) {
        const options = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--help' || arg === '-h') {
                options.help = true;
            }
            else if (arg === '--name' || arg === '-n') {
                options.name = args[++i];
            }
            else if (arg === '--json') {
                options.json = true;
            }
        }
        return options;
    }
    static parsePauseAgentArgs(args) {
        const options = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--help' || arg === '-h') {
                options.help = true;
            }
            else if (arg === '--name' || arg === '-n') {
                options.name = args[++i];
            }
        }
        return options;
    }
    static parseResumeAgentArgs(args) {
        const options = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--help' || arg === '-h') {
                options.help = true;
            }
            else if (arg === '--name' || arg === '-n') {
                options.name = args[++i];
            }
            else if (arg === '--auto') {
                options.auto = true;
            }
        }
        return options;
    }
    static parseKillAgentArgs(args) {
        const options = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--help' || arg === '-h') {
                options.help = true;
            }
            else if (arg === '--name' || arg === '-n') {
                options.name = args[++i];
            }
        }
        return options;
    }
    static parseFactoryArgs(args) {
        const options = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--help' || arg === '-h') {
                options.help = true;
            }
            else if (arg === '--profile' || arg === '-p') {
                options.profile = args[++i];
            }
            else if (arg === '--name' || arg === '-n') {
                options.name = args[++i];
            }
            else if (arg === '--overrides') {
                options.overrides = args[++i];
            }
        }
        return options;
    }
    static formatAgentsTable(agents) {
        if (agents.length === 0) {
            return chalk_1.default.yellow('No agents found');
        }
        const headers = ['Name', 'Profile', 'Status', 'Last Activity'];
        const rows = agents.map(agent => [
            agent.name,
            agent.profile,
            this.getStatusIcon(agent.status) + ' ' + agent.status,
            agent.latestState?.lastActivity ?
                new Date(agent.latestState.lastActivity).toLocaleString() :
                'Never'
        ]);
        const table = this.createTable(headers, rows);
        return table;
    }
    static formatAgentDescription(info) {
        const { config, instance, latestState } = info;
        let description = chalk_1.default.blue.bold(`\n🤖 Agent: ${config.name}\n`);
        description += chalk_1.default.gray('─'.repeat(40)) + '\n';
        description += chalk_1.default.cyan('Profile:') + ` ${config.profile}\n`;
        description += chalk_1.default.cyan('Specialization:') + ` ${config.specialization}\n`;
        description += chalk_1.default.cyan('Status:') + ` ${instance?.status || 'not-loaded'}\n`;
        description += chalk_1.default.cyan('Autonomy Level:') + ` ${config.autonomyLevel}\n`;
        description += chalk_1.default.cyan('Context Scope:') + ` ${config.contextScope}\n`;
        if (latestState) {
            description += chalk_1.default.cyan('Current Step:') + ` ${latestState.currentStep}/${latestState.totalSteps}\n`;
            description += chalk_1.default.cyan('Last Activity:') + ` ${new Date(latestState.lastActivity).toLocaleString()}\n`;
        }
        return description;
    }
    static createTable(headers, rows) {
        const maxWidths = headers.map((_, i) => {
            const columnValues = [headers[i], ...rows.map(row => row[i] || '')];
            return Math.max(...columnValues.map(val => val.length));
        });
        const separator = '│';
        const topBorder = '┌' + maxWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐';
        const bottomBorder = '└' + maxWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘';
        const middleBorder = '├' + maxWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤';
        const formatRow = (row) => {
            return separator + row.map((cell, i) => ' ' + cell.padEnd(maxWidths[i]) + ' ').join(separator) + separator;
        };
        let table = topBorder + '\n';
        table += formatRow(headers) + '\n';
        table += middleBorder + '\n';
        for (const row of rows) {
            table += formatRow(row) + '\n';
        }
        table += bottomBorder;
        return table;
    }
    static getStatusIcon(status) {
        switch (status) {
            case 'running': return '🟢';
            case 'paused': return '🟡';
            case 'stopped': return '🔴';
            case 'error': return '❌';
            default: return '⚪';
        }
    }
    static parseTimeLimit(timeLimit) {
        const match = timeLimit.match(/^(\d+)([smh])$/);
        if (!match) {
            throw new Error(`Invalid time limit format: ${timeLimit}. Use format like '30s', '30m' or '2h'`);
        }
        const value = parseInt(match[1]);
        const unit = match[2];
        if (unit === 's') {
            return value * 1000;
        }
        else if (unit === 'm') {
            return value * 60 * 1000;
        }
        else if (unit === 'h') {
            return value * 60 * 60 * 1000;
        }
        throw new Error(`Unsupported time unit: ${unit}`);
    }
    static getCreateAgentHelp() {
        return `
${chalk_1.default.blue.bold('create-agent - Create a new agent')}

${chalk_1.default.cyan('Usage:')}
  create-agent --name <name> --profile <profile> [options]
  create-agent --name <name> --config <config-file> [options]

${chalk_1.default.cyan('Options:')}
  --name, -n <name>           Agent name (required)
  --profile, -p <profile>     Agent profile (researcher, coder, planner, etc.)
  --config, -c <file>         Configuration file path
  --json                      Output in JSON format
  --override.<key> <value>    Override configuration value
  --help, -h                  Show this help

${chalk_1.default.cyan('Examples:')}
  create-agent --name demo --profile researcher
  create-agent --name demo --config ./agent-config.json
  create-agent --name demo --profile coder --override.autoMode.maxSteps 100
`;
    }
    static getLaunchAgentHelp() {
        return `
${chalk_1.default.blue.bold('launch-agent - Launch an agent')}

${chalk_1.default.cyan('Usage:')}
  launch-agent --name <name> [options]

${chalk_1.default.cyan('Options:')}
  --name, -n <name>           Agent name (required)
  --auto                      Launch in auto mode
  --max-steps <number>        Maximum steps for auto mode
  --max-tokens <number>       Maximum tokens for auto mode
  --max-cost <number>         Maximum cost for auto mode
  --time-limit <time>         Time limit (e.g., 30s, 30m, 2h)
  --safe-tools-only           Use only safe tools
  --allow-write               Allow write operations
  --json                      Output in JSON format
  --help, -h                  Show this help

${chalk_1.default.cyan('Examples:')}
  launch-agent --name demo
  launch-agent --name demo --auto --max-steps 50
  launch-agent --name demo --auto --time-limit 30m --safe-tools-only
`;
    }
    static getListAgentsHelp() {
        return `
${chalk_1.default.blue.bold('list-agents - List all agents')}

${chalk_1.default.cyan('Usage:')}
  list-agents [options]

${chalk_1.default.cyan('Options:')}
  --json                      Output in JSON format
  --help, -h                  Show this help

${chalk_1.default.cyan('Examples:')}
  list-agents
  list-agents --json
`;
    }
    static getDescribeAgentHelp() {
        return `
${chalk_1.default.blue.bold('describe-agent - Show agent details')}

${chalk_1.default.cyan('Usage:')}
  describe-agent --name <name> [options]

${chalk_1.default.cyan('Options:')}
  --name, -n <name>           Agent name (required)
  --json                      Output in JSON format
  --help, -h                  Show this help

${chalk_1.default.cyan('Examples:')}
  describe-agent --name demo
  describe-agent --name demo --json
`;
    }
    static getPauseAgentHelp() {
        return `
${chalk_1.default.blue.bold('pause-agent - Pause an agent')}

${chalk_1.default.cyan('Usage:')}
  pause-agent --name <name>

${chalk_1.default.cyan('Options:')}
  --name, -n <name>           Agent name (required)
  --help, -h                  Show this help

${chalk_1.default.cyan('Examples:')}
  pause-agent --name demo
`;
    }
    static getResumeAgentHelp() {
        return `
${chalk_1.default.blue.bold('resume-agent - Resume an agent')}

${chalk_1.default.cyan('Usage:')}
  resume-agent --name <name> [options]

${chalk_1.default.cyan('Options:')}
  --name, -n <name>           Agent name (required)
  --auto                      Resume in auto mode
  --help, -h                  Show this help

${chalk_1.default.cyan('Examples:')}
  resume-agent --name demo
  resume-agent --name demo --auto
`;
    }
    static getKillAgentHelp() {
        return `
${chalk_1.default.blue.bold('kill-agent - Stop and delete an agent')}

${chalk_1.default.cyan('Usage:')}
  kill-agent --name <name>

${chalk_1.default.cyan('Options:')}
  --name, -n <name>           Agent name (required)
  --help, -h                  Show this help

${chalk_1.default.cyan('Examples:')}
  kill-agent --name demo
`;
    }
    static getFactoryHelp() {
        return `
${chalk_1.default.blue.bold('factory - Agent factory dashboard')}

${chalk_1.default.cyan('Usage:')}
  factory [options]

${chalk_1.default.cyan('Options:')}
  --profile, -p <profile>     Create agent from profile
  --name, -n <name>           Agent name for profile creation
  --overrides <json>          JSON overrides for profile
  --help, -h                  Show this help

${chalk_1.default.cyan('Examples:')}
  factory
  factory --profile coder --name demo-coder
  factory --profile researcher --name demo-researcher --overrides '{"autoMode.maxSteps": 100}'
`;
    }
}
exports.AgentCommands = AgentCommands;
