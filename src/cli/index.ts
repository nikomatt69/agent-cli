#!/usr/bin/env node
import { Command } from 'commander';
import { registerAgents } from './register-agents';
import { AgentManager } from './agents/agent-manager';
import { chatInterface } from './chat/chat-interface';
import { configManager } from './config/config-manager';
import { CliUI } from './utils/cli-ui';
import { PlanningManager } from './planning/planning-manager';

const program = new Command();

// Main CLI entry point
program
  .name('ai-agents-cli')
  .description('A CLI tool with parallel AI agents using TypeScript and Gemini')
  .version('1.0.0');

// Initialize agent manager and register agents
const agentManager = new AgentManager();
registerAgents(agentManager);

// Initialize planning manager
const planningManager = new PlanningManager(process.cwd());

// Run single agent command
program
  .command('run <agent-name>')
  .description('Run a specific AI agent')
  .option('-t, --task <task>', 'Task description for the agent')
  .action(async (agentName, options) => {
    CliUI.startSpinner(`Starting agent: ${CliUI.highlight(agentName)}`);
    try {
      const agent = agentManager.getAgent(agentName);
      if (!agent) {
        CliUI.failSpinner(`Agent ${CliUI.highlight(agentName)} not found`);
        return;
      }

      CliUI.updateSpinner(`Initializing agent: ${CliUI.highlight(agentName)}`);
      await agent.initialize();
      
      CliUI.updateSpinner(`Running agent: ${CliUI.highlight(agentName)}`);
      const task = {
        id: `task-${Date.now()}`,
        type: 'user_request',
        description: options.task,
        priority: 'normal' as const,
        data: { userInput: options.task }
      };
      const result = await agent.executeTask(task);

      CliUI.succeedSpinner(`Agent ${CliUI.highlight(agentName)} completed successfully`);
      CliUI.logInfo(`Result: ${result}`);
    } catch (error: any) {
      CliUI.failSpinner(`Error running agent ${CliUI.highlight(agentName)}`);
      console.error(CliUI.formatError(error, `Running agent ${agentName}`));
    }
  });

// Run multiple agents in parallel
program
  .command('run-parallel <agents...>')
  .description('Run multiple agents in parallel')
  .option('-t, --task <task>', 'Task description for all agents')
  .action(async (agents, options) => {
    CliUI.logSection(`Parallel Agent Execution`);
    CliUI.startSpinner(`Starting ${CliUI.highlight(agents.length.toString())} agents in parallel`);
    
    try {
      const agentInstances = agents.map((agentName: string) => {
        const agent = agentManager.getAgent(agentName);
        if (!agent) {
          throw new Error(`Agent ${agentName} not found`);
        }
        return { name: agentName, instance: agent };
      });

      CliUI.updateSpinner('Initializing agents...');
      await Promise.all(agentInstances.map(({ instance }: { instance: any }) => instance.initialize()));

      CliUI.updateSpinner('Running agents in parallel...');
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

      CliUI.succeedSpinner(`Completed ${CliUI.highlight(agents.length.toString())} agents`);

      CliUI.logSubsection('Results');
      results.forEach(({ name, result, error, success }) => {
        if (success) {
          CliUI.logSuccess(`${CliUI.bold(name)}: ${result}`);
        } else {
          CliUI.logError(`${CliUI.bold(name)}: ${error}`);
        }
      });
    } catch (error: any) {
      CliUI.failSpinner('Error running parallel agents');
      console.error(CliUI.formatError(error, 'Parallel agent execution'));
    }
  });

// List available agents
program
  .command('list')
  .description('List available agents')
  .action(() => {
    CliUI.logSection('Available AI Agents');
    const agents = agentManager.listAgents();
    if (agents.length === 0) {
      CliUI.logWarning('No agents registered');
      return;
    }

    agents.forEach(agent => {
      CliUI.logKeyValue(`• ${CliUI.bold(agent.id)}`, agent.specialization);
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
      CliUI.logSuccess(`Model set to: ${CliUI.highlight(model)}`);
    } catch (error: any) {
      CliUI.logError(error.message);
    }
  });

program
  .command('set-key <model> <apiKey>')
  .description('Set API key for a specific model')
  .action((model, apiKey) => {
    try {
      configManager.setApiKey(model, apiKey);
      CliUI.logSuccess(`API key set for: ${CliUI.highlight(model)}`);
    } catch (error: any) {
      CliUI.logError(error.message);
    }
  });

program
  .command('models')
  .description('List available models')
  .action(() => {
    CliUI.logSection('🤖 Available Models');
    
    const currentModel = configManager.get('currentModel');
    const models = configManager.get('models');
    
    Object.entries(models).forEach(([name, config]) => {
      const isCurrent = name === currentModel;
      const hasKey = configManager.getApiKey(name) !== undefined;
      const status = hasKey ? '✅' : '❌';
      const prefix = isCurrent ? '→ ' : '  ';
      
      console.log(`${prefix}${status} ${CliUI.bold(name)}`);
      console.log(`    ${CliUI.dim(`Provider: ${config.provider} | Model: ${config.model}`)}`);
    });
  });

// Agent management commands
program
  .command('agents')
  .description('List available agents')
  .action(() => {
    CliUI.logSection('🤖 Available Agents');
    
    const agents = agentManager.listAgents();
    if (agents.length === 0) {
      CliUI.logWarning('No agents registered');
      return;
    }

    agents.forEach(agent => {
      CliUI.logKeyValue(`• ${CliUI.bold(agent.id)}`, agent.specialization);
    });
    
    CliUI.logInfo('Use "npm run chat" for interactive mode');
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
      const { indexProject } = await import('./ai/rag-system');
      await indexProject(process.cwd());
    } catch (error: any) {
      CliUI.logError(`Error indexing project: ${error.message}`);
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
        CliUI.logSuccess(`Plan generated with ID: ${CliUI.highlight(plan.id)}`);
        CliUI.logInfo('Use "npm run cli execute-plan <plan-id>" to execute this plan');
      } else {
        await planningManager.planAndExecute(request, options.projectPath);
      }
    } catch (error: any) {
      CliUI.logError(`Planning failed: ${error.message}`);
    }
  });

program
  .command('execute-plan <plan-id>')
  .description('Execute a previously generated plan')
  .action(async (planId) => {
    try {
      await planningManager.executePlan(planId);
    } catch (error: any) {
      CliUI.logError(`Plan execution failed: ${error.message}`);
    }
  });

program
  .command('list-plans')
  .description('List all generated plans')
  .action(() => {
    try {
      const plans = planningManager.listPlans();
      
      if (plans.length === 0) {
        CliUI.logWarning('No plans found');
        return;
      }

      CliUI.logSection('Generated Plans');
      plans.forEach(plan => {
        const riskIcon = plan.riskAssessment.overallRisk === 'high' ? '🔴' : 
                        plan.riskAssessment.overallRisk === 'medium' ? '🟡' : '🟢';
        
        console.log(`${riskIcon} ${CliUI.bold(plan.id.substring(0, 8))} - ${plan.title}`);
        console.log(`  ${CliUI.dim(plan.description)}`);
        console.log(`  ${CliUI.dim(`Steps: ${plan.steps.length} | Duration: ~${Math.round(plan.estimatedTotalDuration / 1000)}s`)}`);
        console.log();
      });
      
      CliUI.logInfo('Use "npm run cli execute-plan <plan-id>" to execute a plan');
    } catch (error: any) {
      CliUI.logError(`Failed to list plans: ${error.message}`);
    }
  });

program
  .command('planning-stats')
  .description('Show planning system statistics')
  .action(() => {
    try {
      const stats = planningManager.getPlanningStats();
      
      CliUI.logSection('Planning System Statistics');
      CliUI.logKeyValue('Total Plans Generated', stats.totalPlansGenerated.toString());
      CliUI.logKeyValue('Total Plans Executed', stats.totalPlansExecuted.toString());
      CliUI.logKeyValue('Successful Executions', stats.successfulExecutions.toString());
      CliUI.logKeyValue('Failed Executions', stats.failedExecutions.toString());
      CliUI.logKeyValue('Average Steps per Plan', Math.round(stats.averageStepsPerPlan).toString());
      CliUI.logKeyValue('Average Execution Time', `${Math.round(stats.averageExecutionTime / 1000)}s`);
      
      if (Object.keys(stats.riskDistribution).length > 0) {
        CliUI.logSubsection('Risk Distribution');
        Object.entries(stats.riskDistribution).forEach(([risk, count]) => {
          const icon = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
          CliUI.logKeyValue(`${icon} ${risk}`, count.toString());
        });
      }
      
      if (Object.keys(stats.toolUsageStats).length > 0) {
        CliUI.logSubsection('Most Used Tools');
        const sortedTools = Object.entries(stats.toolUsageStats)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5);
        
        sortedTools.forEach(([tool, count]) => {
          CliUI.logKeyValue(`🔧 ${tool}`, count.toString());
        });
      }
    } catch (error: any) {
      CliUI.logError(`Failed to get planning stats: ${error.message}`);
    }
  });

program
  .command('tools')
  .description('Show available tools in the planning system')
  .action(() => {
    try {
      planningManager.displayToolRegistry();
    } catch (error: any) {
      CliUI.logError(`Failed to display tools: ${error.message}`);
    }
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
    
    CliUI.logSuccess(`Agent created: ${CliUI.highlight(filename)}`);
    CliUI.logInfo('To use the agent:');
    console.log(`1. Add import to src/cli/register-agents.ts`);
    console.log(`2. Register the agent in registerAgents function`);
    console.log(`3. Run "npm run chat" to use it`);
    
  } catch (error: any) {
    CliUI.logError(`Error creating agent: ${error.message}`);
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
