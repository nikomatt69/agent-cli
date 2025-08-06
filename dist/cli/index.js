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
const commander_1 = require("commander");
const register_agents_1 = require("./register-agents");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const agent_manager_1 = require("./agents/agent-manager");
const chat_interface_1 = require("./chat/chat-interface");
const config_manager_1 = require("./config/config-manager");
const program = new commander_1.Command();
// Main CLI entry point
program
    .name('ai-agents-cli')
    .description('A CLI tool with parallel AI agents using TypeScript and Gemini')
    .version('1.0.0');
// Initialize agent manager and register agents
const agentManager = new agent_manager_1.AgentManager();
(0, register_agents_1.registerAgents)(agentManager);
// Run single agent command
program
    .command('run <agent-name>')
    .description('Run a specific AI agent')
    .option('-t, --task <task>', 'Task description for the agent')
    .action(async (agentName, options) => {
    const spinner = (0, ora_1.default)(`Starting agent: ${agentName}`).start();
    try {
        const agent = agentManager.getAgent(agentName);
        if (!agent) {
            spinner.fail(chalk_1.default.red(`Agent ${agentName} not found`));
            return;
        }
        spinner.text = `Running agent: ${agentName}`;
        await agent.initialize();
        const result = await agent.run(options.task);
        spinner.succeed(chalk_1.default.green(`Agent ${agentName} completed successfully`));
        console.log(chalk_1.default.blue('Result:'), result);
    }
    catch (error) {
        spinner.fail(chalk_1.default.red(`Error running agent ${agentName}: ${error.message}`));
    }
});
// Run multiple agents in parallel
program
    .command('run-parallel <agents...>')
    .description('Run multiple agents in parallel')
    .option('-t, --task <task>', 'Task description for all agents')
    .action(async (agents, options) => {
    const spinner = (0, ora_1.default)(`Starting ${agents.length} agents in parallel`).start();
    try {
        const agentInstances = agents.map((agentName) => {
            const agent = agentManager.getAgent(agentName);
            if (!agent) {
                throw new Error(`Agent ${agentName} not found`);
            }
            return { name: agentName, instance: agent };
        });
        spinner.text = 'Initializing agents...';
        await Promise.all(agentInstances.map(({ instance }) => instance.initialize()));
        spinner.text = 'Running agents in parallel...';
        const results = await Promise.all(agentInstances.map(async ({ name, instance }) => {
            try {
                const result = await instance.run(options.task);
                return { name, result, success: true };
            }
            catch (error) {
                return { name, error: error.message, success: false };
            }
        }));
        spinner.succeed(chalk_1.default.green(`Completed ${agents.length} agents`));
        results.forEach(({ name, result, error, success }) => {
            if (success) {
                console.log(chalk_1.default.green(`✓ ${name}:`), result);
            }
            else {
                console.log(chalk_1.default.red(`✗ ${name}:`), error);
            }
        });
    }
    catch (error) {
        spinner.fail(chalk_1.default.red(`Error running parallel agents: ${error.message}`));
    }
});
// List available agents
program
    .command('list')
    .description('List available agents')
    .action(() => {
    console.log(chalk_1.default.blue('Available AI Agents:'));
    const agents = agentManager.listAgents();
    if (agents.length === 0) {
        console.log(chalk_1.default.yellow('No agents registered'));
        return;
    }
    agents.forEach(agent => {
        console.log(`${chalk_1.default.green('•')} ${chalk_1.default.bold(agent.name)}: ${agent.description}`);
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
        console.log(chalk_1.default.green(`✅ Model set to: ${model}`));
    }
    catch (error) {
        console.log(chalk_1.default.red(`❌ ${error.message}`));
    }
});
program
    .command('set-key <model> <apiKey>')
    .description('Set API key for a specific model')
    .action((model, apiKey) => {
    try {
        config_manager_1.configManager.setApiKey(model, apiKey);
        console.log(chalk_1.default.green(`✅ API key set for: ${model}`));
    }
    catch (error) {
        console.log(chalk_1.default.red(`❌ ${error.message}`));
    }
});
program
    .command('models')
    .description('List available models')
    .action(() => {
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
});
// Agent management commands
program
    .command('agents')
    .description('List available agents')
    .action(() => {
    console.log(chalk_1.default.blue.bold('\n🤖 Available Agents:'));
    console.log(chalk_1.default.gray('─'.repeat(40)));
    const agents = agentManager.listAgents();
    if (agents.length === 0) {
        console.log(chalk_1.default.yellow('No agents registered'));
        return;
    }
    agents.forEach(agent => {
        console.log(`${chalk_1.default.green('•')} ${chalk_1.default.bold(agent.name)}`);
        console.log(`  ${chalk_1.default.gray(agent.description)}`);
    });
    console.log(chalk_1.default.gray('\nUse "npm run chat" for interactive mode'));
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
        console.log(chalk_1.default.green(`✅ Agent created: ${filename}`));
        console.log(chalk_1.default.gray('To use the agent:'));
        console.log(chalk_1.default.white(`1. Add import to src/cli/register-agents.ts`));
        console.log(chalk_1.default.white(`2. Register the agent in registerAgents function`));
        console.log(chalk_1.default.white(`3. Run "npm run chat" to use it`));
    }
    catch (error) {
        console.log(chalk_1.default.red(`❌ Error creating agent: ${error.message}`));
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
