import { BaseAgent } from './base-agent';
import { modelProvider, ChatMessage } from '../ai/model-provider';
import { AgentManager } from './agent-manager';
import chalk from 'chalk';
import { z } from 'zod';

const TaskPlanSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    description: z.string(),
    agent: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    dependencies: z.array(z.string()).optional(),
    estimatedTime: z.string().optional(),
  })),
  reasoning: z.string(),
  executionOrder: z.array(z.string()),
});

export interface TaskResult {
  taskId: string;
  agent: string;
  success: boolean;
  result?: any;
  error?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
}

export class AutonomousOrchestrator extends BaseAgent {
  id = 'autonomous-orchestrator';
  capabilities = ['task-orchestration', 'multi-agent-coordination', 'planning', 'execution'];
  specialization = 'Autonomous agent orchestrator that plans and executes complex multi-agent tasks';
  name = 'autonomous-orchestrator';
  description = 'Autonomous agent orchestrator that plans and executes complex multi-agent tasks';

  private agentManager: AgentManager;
  private runningTasks: Map<string, Promise<TaskResult>> = new Map();

  constructor(agentManager: AgentManager, workingDirectory: string = process.cwd()) {
    super(workingDirectory);
    this.agentManager = agentManager;
  }

  async planTasks(userRequest: string): Promise<any> {
    const availableAgents = this.agentManager.getAvailableAgentNames();
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an intelligent task orchestrator. Given a user request, break it down into specific tasks that can be executed by available AI agents.

Available agents: ${availableAgents.join(', ')}

Agent capabilities:
- coding-agent: General coding tasks, analysis, generation, optimization
- react-expert: React/Next.js development, components, hooks, state management
- backend-expert: Node.js, APIs, databases, server architecture
- devops-expert: CI/CD, Docker, Kubernetes, cloud deployment
- ai-analysis: General code analysis
- code-generator: Code generation
- code-review: Code review and quality assessment
- optimization: Performance optimization

Create a task plan with:
- Specific, actionable tasks
- Appropriate agent assignment for each task
- Task priorities and dependencies
- Logical execution order

Consider parallel execution where possible.`,
      },
      {
        role: 'user',
        content: `Plan tasks for: ${userRequest}`,
      },
    ];

    try {
      return await modelProvider.generateStructured({
        messages,
        schema: TaskPlanSchema,
        schemaName: 'TaskPlan',
        schemaDescription: 'Structured plan for multi-agent task execution',
      });
    } catch (error: any) {
      return {
        error: `Failed to plan tasks: ${error.message}`,
        userRequest,
      };
    }
  }

  async executeTaskPlan(plan: any): Promise<TaskResult[]> {
    if (!plan.tasks || !Array.isArray(plan.tasks)) {
      throw new Error('Invalid task plan');
    }

    console.log(chalk.blue.bold('\n🚀 Starting autonomous task execution'));
    console.log(chalk.gray(`Executing ${plan.tasks.length} tasks`));
    console.log(chalk.gray(`Strategy: ${plan.reasoning}`));
    
    const results: TaskResult[] = [];
    const completedTasks = new Set<string>();
    
    // Execute tasks according to dependencies and priorities
    for (const taskId of plan.executionOrder) {
      const task = plan.tasks.find((t: any) => t.id === taskId);
      if (!task) continue;

      // Check if dependencies are met
      if (task.dependencies) {
        const unmetDeps = task.dependencies.filter((dep: string) => !completedTasks.has(dep));
        if (unmetDeps.length > 0) {
          console.log(chalk.yellow(`⏳ Waiting for dependencies: ${unmetDeps.join(', ')}`));
          continue;
        }
      }

      // Execute task
      const result = await this.executeTask(task);
      results.push(result);
      
      if (result.success) {
        completedTasks.add(task.id);
        console.log(chalk.green(`✅ Task ${task.id} completed (${result.duration}ms)`));
      } else {
        console.log(chalk.red(`❌ Task ${task.id} failed: ${result.error}`));
      }
    }

    return results;
  }

  protected async onInitialize(): Promise<void> {
    console.log('Autonomous Orchestrator initialized');
  }

  protected async onExecuteTask(task: any): Promise<any> {
    const taskData = typeof task === 'string' ? task : task.data;
    return await this.planTasks(taskData);
  }

  protected async onStop(): Promise<void> {
    // Wait for all running tasks to complete
    await Promise.all(this.runningTasks.values());
    console.log('Autonomous Orchestrator stopped');
  }

  public async executeTask(task: any): Promise<TaskResult> {
    const startTime = new Date();
    console.log(chalk.cyan(`🔄 Starting task: ${task.description} (${task.agent})`));
    
    try {
      const agent = this.agentManager.getAgent(task.agent);
      if (!agent) {
        throw new Error(`Agent ${task.agent} not found`);
      }

      await agent.initialize();
      const result = await agent.run?.(task.description);
      await agent.cleanup?.();

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        taskId: task.id,
        agent: task.agent,
        success: true,
        result,
        startTime,
        endTime,
        duration,
      };

    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        taskId: task.id,
        agent: task.agent,
        success: false,
        error: error.message,
        startTime,
        endTime,
        duration,
      };
    }
  }

  async executeParallelTasks(tasks: any[]): Promise<TaskResult[]> {
    console.log(chalk.blue.bold(`\n⚡ Executing ${tasks.length} tasks in parallel`));
    
    const promises = tasks.map(task => this.executeTask(task));
    const results = await Promise.all(promises);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(chalk.green(`✅ Parallel execution complete: ${successful} successful, ${failed} failed`));
    
    return results;
  }

  async run(task?: string): Promise<any> {
    if (!task) {
      return {
        message: 'Autonomous Orchestrator ready! I can break down complex requests into multi-agent workflows.',
        capabilities: [
          'Task planning and decomposition',
          'Multi-agent coordination',
          'Parallel task execution',
          'Dependency management',
          'Progress monitoring',
        ],
      };
    }

    try {
      // Plan the tasks
      console.log(chalk.blue('🧠 Planning task execution...'));
      const plan = await this.planTasks(task);
      
      if (plan.error) {
        return plan;
      }

      console.log(chalk.blue.bold('\n📋 Task Plan:'));
      plan.tasks.forEach((t: any, index: number) => {
        const priority = t.priority === 'critical' ? chalk.red('🔴') : 
                        t.priority === 'high' ? chalk.yellow('🟡') : 
                        chalk.green('🟢');
        console.log(`${index + 1}. ${priority} ${t.description} → ${chalk.cyan(t.agent)}`);
      });

      console.log(chalk.gray(`\nReasoning: ${plan.reasoning}`));
      
      // Ask for confirmation in interactive mode
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const confirm = await new Promise<boolean>((resolve) => {
        readline.question(chalk.yellow('\nProceed with execution? (y/N): '), (answer: string) => {
          readline.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });

      if (!confirm) {
        console.log(chalk.yellow('Execution cancelled'));
        return { cancelled: true, plan };
      }

      // Execute the plan
      const results = await this.executeTaskPlan(plan);
      
      // Summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

      console.log(chalk.blue.bold('\n📊 Execution Summary:'));
      console.log(chalk.green(`✅ Successful tasks: ${successful}`));
      console.log(chalk.red(`❌ Failed tasks: ${failed}`));
      console.log(chalk.gray(`⏱️  Total time: ${totalTime}ms`));

      return {
        plan,
        results,
        summary: {
          totalTasks: results.length,
          successful,
          failed,
          totalTime,
        },
      };

    } catch (error: any) {
      return {
        error: `Orchestration failed: ${error.message}`,
        task,
      };
    }
  }
}