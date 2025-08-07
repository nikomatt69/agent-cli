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
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const register_agents_1 = require("./register-agents");
const agent_manager_1 = require("./agents/agent-manager");
const chat_interface_1 = require("./chat/chat-interface");
const config_manager_1 = require("./config/config-manager");
const cli_ui_1 = require("./utils/cli-ui");
const planning_manager_1 = require("./planning/planning-manager");
const program = new commander_1.Command();
// Main CLI entry point
program
    .name('ai-agents-cli')
    .description('A CLI tool with parallel AI agents using TypeScript and Gemini')
    .version('1.0.0');
// Initialize agent manager and register agents
const agentManager = new agent_manager_1.AgentManager();
(0, register_agents_1.registerAgents)(agentManager);
// Initialize planning manager
const planningManager = new planning_manager_1.PlanningManager(process.cwd());
// Run single agent command
program
    .command('run <agent-name>')
    .description('Run a specific AI agent')
    .option('-t, --task <task>', 'Task description for the agent')
    .action(async (agentName, options) => {
    cli_ui_1.CliUI.startSpinner(`Starting agent: ${cli_ui_1.CliUI.highlight(agentName)}`);
    try {
        const agent = agentManager.getAgent(agentName);
        if (!agent) {
            cli_ui_1.CliUI.failSpinner(`Agent ${cli_ui_1.CliUI.highlight(agentName)} not found`);
            return;
        }
        cli_ui_1.CliUI.updateSpinner(`Initializing agent: ${cli_ui_1.CliUI.highlight(agentName)}`);
        await agent.initialize();
        cli_ui_1.CliUI.updateSpinner(`Running agent: ${cli_ui_1.CliUI.highlight(agentName)}`);
        const task = {
            id: `task-${Date.now()}`,
            type: 'user_request',
            description: options.task,
            priority: 'normal',
            data: { userInput: options.task }
        };
        const result = await agent.executeTask(task);
        cli_ui_1.CliUI.succeedSpinner(`Agent ${cli_ui_1.CliUI.highlight(agentName)} completed successfully`);
        cli_ui_1.CliUI.logInfo(`Result: ${result}`);
    }
    catch (error) {
        cli_ui_1.CliUI.failSpinner(`Error running agent ${cli_ui_1.CliUI.highlight(agentName)}`);
        console.error(cli_ui_1.CliUI.formatError(error, `Running agent ${agentName}`));
    }
});
// Run multiple agents in parallel
program
    .command('run-parallel <agents...>')
    .description('Run multiple agents in parallel')
    .option('-t, --task <task>', 'Task description for all agents')
    .action(async (agents, options) => {
    cli_ui_1.CliUI.logSection(`Parallel Agent Execution`);
    cli_ui_1.CliUI.startSpinner(`Starting ${cli_ui_1.CliUI.highlight(agents.length.toString())} agents in parallel`);
    try {
        const agentInstances = agents.map((agentName) => {
            const agent = agentManager.getAgent(agentName);
            if (!agent) {
                throw new Error(`Agent ${agentName} not found`);
            }
            return { name: agentName, instance: agent };
        });
        cli_ui_1.CliUI.updateSpinner('Initializing agents...');
        await Promise.all(agentInstances.map(({ instance }) => instance.initialize()));
        cli_ui_1.CliUI.updateSpinner('Running agents in parallel...');
        const results = await Promise.all(agentInstances.map(async ({ name, instance }) => {
            try {
                const result = await instance.run(options.task);
                return { name, result, success: true };
            }
            catch (error) {
                return { name, error: error.message, success: false };
            }
        }));
        cli_ui_1.CliUI.succeedSpinner(`Completed ${cli_ui_1.CliUI.highlight(agents.length.toString())} agents`);
        cli_ui_1.CliUI.logSubsection('Results');
        results.forEach(({ name, result, error, success }) => {
            if (success) {
                cli_ui_1.CliUI.logSuccess(`${cli_ui_1.CliUI.bold(name)}: ${result}`);
            }
            else {
                cli_ui_1.CliUI.logError(`${cli_ui_1.CliUI.bold(name)}: ${error}`);
            }
        });
    }
    catch (error) {
        cli_ui_1.CliUI.failSpinner('Error running parallel agents');
        console.error(cli_ui_1.CliUI.formatError(error, 'Parallel agent execution'));
    }
});
// List available agents
program
    .command('list')
    .description('List available agents')
    .action(() => {
    cli_ui_1.CliUI.logSection('Available AI Agents');
    const agents = agentManager.listAgents();
    if (agents.length === 0) {
        cli_ui_1.CliUI.logWarning('No agents registered');
        return;
    }
    agents.forEach(agent => {
        cli_ui_1.CliUI.logKeyValue(`• ${cli_ui_1.CliUI.bold(agent.id)}`, agent.specialization);
    });
});
// Chat command - main interactive interface
program
    .command('chat')
    .description('Start interactive chat with AI coding assistants')
    .action(async () => {
    await chat_interface_1.chatInterface.start();
});
// Configuration commands
program
    .command('config')
    .description('Show current configuration')
    .action(() => {
    config_manager_1.configManager.showConfig();
});
program
    .command('set-model <model>')
    .description('Set the current AI model')
    .action((model) => {
    try {
        config_manager_1.configManager.setCurrentModel(model);
        cli_ui_1.CliUI.logSuccess(`Model set to: ${cli_ui_1.CliUI.highlight(model)}`);
    }
    catch (error) {
        cli_ui_1.CliUI.logError(error.message);
    }
});
program
    .command('set-key <model> <apiKey>')
    .description('Set API key for a specific model')
    .action((model, apiKey) => {
    try {
        config_manager_1.configManager.setApiKey(model, apiKey);
        cli_ui_1.CliUI.logSuccess(`API key set for: ${cli_ui_1.CliUI.highlight(model)}`);
    }
    catch (error) {
        cli_ui_1.CliUI.logError(error.message);
    }
});
program
    .command('models')
    .description('List available models')
    .action(() => {
    cli_ui_1.CliUI.logSection('🤖 Available Models');
    const currentModel = config_manager_1.configManager.get('currentModel');
    const models = config_manager_1.configManager.get('models');
    Object.entries(models).forEach(([name, config]) => {
        const isCurrent = name === currentModel;
        const hasKey = config_manager_1.configManager.getApiKey(name) !== undefined;
        const status = hasKey ? '✅' : '❌';
        const prefix = isCurrent ? '→ ' : '  ';
        console.log(`${prefix}${status} ${cli_ui_1.CliUI.bold(name)}`);
        console.log(`    ${cli_ui_1.CliUI.dim(`Provider: ${config.provider} | Model: ${config.model}`)}`);
    });
});
// Agent management commands
program
    .command('agents')
    .description('List available agents')
    .action(() => {
    cli_ui_1.CliUI.logSection('🤖 Available Agents');
    const agents = agentManager.listAgents();
    if (agents.length === 0) {
        cli_ui_1.CliUI.logWarning('No agents registered');
        return;
    }
    agents.forEach(agent => {
        cli_ui_1.CliUI.logKeyValue(`• ${cli_ui_1.CliUI.bold(agent.id)}`, agent.specialization);
    });
    cli_ui_1.CliUI.logInfo('Use "npm run chat" for interactive mode');
});
// Create custom agent command
program
    .command('create-agent <name>')
    .description('Create a new custom agent')
    .option('-d, --description <desc>', 'Agent description')
    .option('-p, --prompt <prompt>', 'System prompt for the agent')
    .action(async (name, options) => {
    await createCustomAgent(name, options.description, options.prompt);
});
// Index project command
program
    .command('index-project')
    .description('Index the current project for RAG')
    .action(async () => {
    try {
        const { indexProject } = await Promise.resolve().then(() => __importStar(require('./ai/rag-system')));
        await indexProject(process.cwd());
    }
    catch (error) {
        cli_ui_1.CliUI.logError(`Error indexing project: ${error.message}`);
    }
});
// Planning system commands
program
    .command('plan <request>')
    .description('Generate and execute an AI plan for the given request')
    .option('-g, --generate-only', 'Only generate the plan without executing')
    .option('-p, --project-path <path>', 'Project path to analyze', process.cwd())
    .action(async (request, options) => {
    try {
        if (options.generateOnly) {
            const plan = await planningManager.generatePlanOnly(request, options.projectPath);
            cli_ui_1.CliUI.logSuccess(`Plan generated with ID: ${cli_ui_1.CliUI.highlight(plan.id)}`);
            cli_ui_1.CliUI.logInfo('Use "npm run cli execute-plan <plan-id>" to execute this plan');
        }
        else {
            await planningManager.planAndExecute(request, options.projectPath);
        }
    }
    catch (error) {
        cli_ui_1.CliUI.logError(`Planning failed: ${error.message}`);
    }
});
program
    .command('execute-plan <plan-id>')
    .description('Execute a previously generated plan')
    .action(async (planId) => {
    try {
        await planningManager.executePlan(planId);
    }
    catch (error) {
        cli_ui_1.CliUI.logError(`Plan execution failed: ${error.message}`);
    }
});
program
    .command('list-plans')
    .description('List all generated plans')
    .action(() => {
    try {
        const plans = planningManager.listPlans();
        if (plans.length === 0) {
            cli_ui_1.CliUI.logWarning('No plans found');
            return;
        }
        cli_ui_1.CliUI.logSection('Generated Plans');
        plans.forEach(plan => {
            const riskIcon = plan.riskAssessment.overallRisk === 'high' ? '🔴' :
                plan.riskAssessment.overallRisk === 'medium' ? '🟡' : '🟢';
            console.log(`${riskIcon} ${cli_ui_1.CliUI.bold(plan.id.substring(0, 8))} - ${plan.title}`);
            console.log(`  ${cli_ui_1.CliUI.dim(plan.description)}`);
            console.log(`  ${cli_ui_1.CliUI.dim(`Steps: ${plan.steps.length} | Duration: ~${Math.round(plan.estimatedTotalDuration / 1000)}s`)}`);
            console.log();
        });
        cli_ui_1.CliUI.logInfo('Use "npm run cli execute-plan <plan-id>" to execute a plan');
    }
    catch (error) {
        cli_ui_1.CliUI.logError(`Failed to list plans: ${error.message}`);
    }
});
program
    .command('planning-stats')
    .description('Show planning system statistics')
    .action(() => {
    try {
        const stats = planningManager.getPlanningStats();
        cli_ui_1.CliUI.logSection('Planning System Statistics');
        cli_ui_1.CliUI.logKeyValue('Total Plans Generated', stats.totalPlansGenerated.toString());
        cli_ui_1.CliUI.logKeyValue('Total Plans Executed', stats.totalPlansExecuted.toString());
        cli_ui_1.CliUI.logKeyValue('Successful Executions', stats.successfulExecutions.toString());
        cli_ui_1.CliUI.logKeyValue('Failed Executions', stats.failedExecutions.toString());
        cli_ui_1.CliUI.logKeyValue('Average Steps per Plan', Math.round(stats.averageStepsPerPlan).toString());
        cli_ui_1.CliUI.logKeyValue('Average Execution Time', `${Math.round(stats.averageExecutionTime / 1000)}s`);
        if (Object.keys(stats.riskDistribution).length > 0) {
            cli_ui_1.CliUI.logSubsection('Risk Distribution');
            Object.entries(stats.riskDistribution).forEach(([risk, count]) => {
                const icon = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
                cli_ui_1.CliUI.logKeyValue(`${icon} ${risk}`, count.toString());
            });
        }
        if (Object.keys(stats.toolUsageStats).length > 0) {
            cli_ui_1.CliUI.logSubsection('Most Used Tools');
            const sortedTools = Object.entries(stats.toolUsageStats)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5);
            sortedTools.forEach(([tool, count]) => {
                cli_ui_1.CliUI.logKeyValue(`🔧 ${tool}`, count.toString());
            });
        }
    }
    catch (error) {
        cli_ui_1.CliUI.logError(`Failed to get planning stats: ${error.message}`);
    }
});
program
    .command('tools')
    .description('Show available tools in the planning system')
    .action(() => {
    try {
        planningManager.displayToolRegistry();
    }
    catch (error) {
        cli_ui_1.CliUI.logError(`Failed to display tools: ${error.message}`);
    }
});
// Parse arguments
program.parse();
async function createCustomAgent(name, description, systemPrompt) {
    const inquirer = await Promise.resolve().then(() => __importStar(require('inquirer')));
    try {
        const answers = await inquirer.default.prompt([
            {
                type: 'input',
                name: 'description',
                message: 'Agent description:',
                default: description || `Custom ${name} agent`,
            },
            {
                type: 'editor',
                name: 'systemPrompt',
                message: 'System prompt (opens in editor):',
                default: systemPrompt || `You are a helpful AI assistant specialized in ${name}. Provide clear, accurate, and helpful responses.`,
            },
            {
                type: 'list',
                name: 'template',
                message: 'Choose a template:',
                choices: [
                    { name: 'General Purpose', value: 'general' },
                    { name: 'Code Specialist', value: 'coding' },
                    { name: 'Language Expert', value: 'language' },
                    { name: 'Tool/Framework Expert', value: 'framework' },
                ],
            },
        ]);
        const agentCode = generateAgentCode(name, answers.description, answers.systemPrompt, answers.template);
        const filename = `src/cli/agents/${name.toLowerCase().replace(/\s+/g, '-')}-agent.ts`;
        require('fs').writeFileSync(filename, agentCode);
        cli_ui_1.CliUI.logSuccess(`Agent created: ${cli_ui_1.CliUI.highlight(filename)}`);
        cli_ui_1.CliUI.logInfo('To use the agent:');
        console.log(`1. Add import to src/cli/register-agents.ts`);
        console.log(`2. Register the agent in registerAgents function`);
        console.log(`3. Run "npm run chat" to use it`);
    }
    catch (error) {
        cli_ui_1.CliUI.logError(`Error creating agent: ${error.message}`);
    }
}
function generateAgentCode(name, description, systemPrompt, template) {
    const className = name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '') + 'Agent';
    const agentName = name.toLowerCase().replace(/\s+/g, '-');
    let specialMethods = '';
    if (template === 'coding') {
        specialMethods = `
  async analyzeCode(code: string): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: \`Analyze this code:\\n\\n\\\`\\\`\\\`\\n\${code}\\n\\\`\\\`\\\`\` },
    ];
    
    return await modelProvider.generateResponse({ messages });
  }

  async generateCode(description: string): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: \`Generate code for: \${description}\` },
    ];
    
    return await modelProvider.generateResponse({ messages });
  }`;
    }
    return `import { BaseAgent } from './base-agent';
import { modelProvider, ChatMessage } from '../ai/model-provider';

export class ${className} extends BaseAgent {
  name = '${agentName}';
  description = '${description}';

  private getSystemPrompt(): string {
    return \`${systemPrompt}\`;
  }
${specialMethods}

  async run(task?: string): Promise<any> {
    if (!task) {
      return {
        message: '${description}',
        agent: '${name}',
        capabilities: [
          'General assistance',
          'Question answering',
          'Problem solving',
        ],
      };
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(),
      },
      {
        role: 'user',
        content: task,
      },
    ];

    try {
      const response = await modelProvider.generateResponse({ messages });
      return { response, task, agent: '${name}' };
    } catch (error: any) {
      return { error: error.message, task, agent: '${name}' };
    }
  }
}`;
}
