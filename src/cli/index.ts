#!/usr/bin/env node
import { Command } from 'commander';
import { registerAgents } from './register-agents';
import chalk from 'chalk';
import ora from 'ora';
import { AgentManager } from './agents/agent-manager';
import { chatInterface } from './chat/chat-interface';
import { configManager } from './config/config-manager';

const program = new Command();

// Main CLI entry point
program
  .name('ai-agents-cli')
  .description('A CLI tool with parallel AI agents using TypeScript and Gemini')
  .version('1.0.0');

// Initialize agent manager and register agents
const agentManager = new AgentManager();
registerAgents(agentManager);

// Run single agent command
program
  .command('run <agent-name>')
  .description('Run a specific AI agent')
  .option('-t, --task <task>', 'Task description for the agent')
  .action(async (agentName, options) => {
    const spinner = ora(`Starting agent: ${agentName}`).start();
    try {
      const agent = agentManager.getAgent(agentName);
      if (!agent) {
        spinner.fail(chalk.red(`Agent ${agentName} not found`));
        return;
      }

      spinner.text = `Running agent: ${agentName}`;
      await agent.initialize();
      const result = await agent.run(options.task);

      spinner.succeed(chalk.green(`Agent ${agentName} completed successfully`));
      console.log(chalk.blue('Result:'), result);
    } catch (error: any) {
      spinner.fail(chalk.red(`Error running agent ${agentName}: ${error.message}`));
    }
  });

// Run multiple agents in parallel
program
  .command('run-parallel <agents...>')
  .description('Run multiple agents in parallel')
  .option('-t, --task <task>', 'Task description for all agents')
  .action(async (agents, options) => {
    const spinner = ora(`Starting ${agents.length} agents in parallel`).start();
    try {
      const agentInstances = agents.map((agentName: string) => {
        const agent = agentManager.getAgent(agentName);
        if (!agent) {
          throw new Error(`Agent ${agentName} not found`);
        }
        return { name: agentName, instance: agent };
      });

      spinner.text = 'Initializing agents...';
      await Promise.all(agentInstances.map(({ instance }: { instance: any }) => instance.initialize()));

      spinner.text = 'Running agents in parallel...';
      const results = await Promise.all(
        agentInstances.map(async ({ name, instance }: { name: string; instance: any }) => {
          try {
            const result = await instance.run(options.task);
            return { name, result, success: true };
          } catch (error: any) {
            return { name, error: error.message, success: false };
          }
        })
      );

      spinner.succeed(chalk.green(`Completed ${agents.length} agents`));

      results.forEach(({ name, result, error, success }) => {
        if (success) {
          console.log(chalk.green(`✓ ${name}:`), result);
        } else {
          console.log(chalk.red(`✗ ${name}:`), error);
        }
      });
    } catch (error: any) {
      spinner.fail(chalk.red(`Error running parallel agents: ${error.message}`));
    }
  });

// List available agents
program
  .command('list')
  .description('List available agents')
  .action(() => {
    console.log(chalk.blue('Available AI Agents:'));
    const agents = agentManager.listAgents();
    if (agents.length === 0) {
      console.log(chalk.yellow('No agents registered'));
      return;
    }

    agents.forEach(agent => {
      console.log(`${chalk.green('•')} ${chalk.bold(agent.name)}: ${agent.description}`);
    });
  });

// Chat command - main interactive interface
program
  .command('chat')
  .description('Start interactive chat with AI coding assistants')
  .action(async () => {
    await chatInterface.start();
  });

// Configuration commands
program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    configManager.showConfig();
  });

program
  .command('set-model <model>')
  .description('Set the current AI model')
  .action((model) => {
    try {
      configManager.setCurrentModel(model);
      console.log(chalk.green(`✅ Model set to: ${model}`));
    } catch (error: any) {
      console.log(chalk.red(`❌ ${error.message}`));
    }
  });

program
  .command('set-key <model> <apiKey>')
  .description('Set API key for a specific model')
  .action((model, apiKey) => {
    try {
      configManager.setApiKey(model, apiKey);
      console.log(chalk.green(`✅ API key set for: ${model}`));
    } catch (error: any) {
      console.log(chalk.red(`❌ ${error.message}`));
    }
  });

program
  .command('models')
  .description('List available models')
  .action(() => {
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
  });

// Agent management commands
program
  .command('agents')
  .description('List available agents')
  .action(() => {
    console.log(chalk.blue.bold('\n🤖 Available Agents:'));
    console.log(chalk.gray('─'.repeat(40)));
    
    const agents = agentManager.listAgents();
    if (agents.length === 0) {
      console.log(chalk.yellow('No agents registered'));
      return;
    }

    agents.forEach(agent => {
      console.log(`${chalk.green('•')} ${chalk.bold(agent.name)}`);
      console.log(`  ${chalk.gray(agent.description)}`);
    });
    
    console.log(chalk.gray('\nUse "npm run chat" for interactive mode'));
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

async function createCustomAgent(name: string, description?: string, systemPrompt?: string): Promise<void> {
  const inquirer = await import('inquirer');
  
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
    
    console.log(chalk.green(`✅ Agent created: ${filename}`));
    console.log(chalk.gray('To use the agent:'));
    console.log(chalk.white(`1. Add import to src/cli/register-agents.ts`));
    console.log(chalk.white(`2. Register the agent in registerAgents function`));
    console.log(chalk.white(`3. Run "npm run chat" to use it`));
    
  } catch (error: any) {
    console.log(chalk.red(`❌ Error creating agent: ${error.message}`));
  }
}

function generateAgentCode(name: string, description: string, systemPrompt: string, template: string): string {
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
