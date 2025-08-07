#!/usr/bin/env node

/**
 * Non-interactive CLI execution mode for CI/CD integration
 * Enterprise-ready execution with complete logging, cleanup, and error handling
 */

import { nanoid } from 'nanoid';
import chalk from 'chalk';
import * as process from 'process';

import { AgentManager } from './core/agent-manager';
import { ConfigManager } from './config/config-manager';
import { GuidanceManager } from './guidance/guidance-manager';
import { logger } from './utils/logger';
import { AgentTask, TaskStatus } from './core/types';

// Register all available agents
import { registerAgents } from './register-agents';

interface ExecOptions {
  agent?: string;
  task: string;
  timeout?: number;
  parallel?: boolean;
  concurrency?: number;
  output?: 'json' | 'text';
  silent?: boolean;
  config?: string;
  workspace?: string;
}

interface ExecResult {
  success: boolean;
  results: Array<{
    taskId: string;
    agentId: string;
    status: TaskStatus;
    duration?: number;
    output?: string;
    error?: string;
  }>;
  metrics: {
    totalTasks: number;
    successful: number;
    failed: number;
    totalDuration: number;
  };
  logs: string[];
}

/**
 * Enterprise CLI Executor
 * Handles non-interactive execution for CI/CD pipelines
 */
export class CliExecutor {
  private agentManager: AgentManager;
  private configManager: ConfigManager;
  private guidanceManager: GuidanceManager;
  private sessionId: string;
  private cleanupHandlers: Array<() => Promise<void>> = [];

  constructor(workspacePath: string = process.cwd()) {
    this.sessionId = nanoid();
    this.configManager = new ConfigManager();
    this.guidanceManager = new GuidanceManager(workspacePath);
    this.agentManager = new AgentManager(this.guidanceManager, this.configManager);

    this.setupSignalHandlers();
  }

  /**
   * Initialize the executor
   */
  async initialize(): Promise<void> {
    await logger.logSession('info', this.sessionId, 'Initializing CLI Executor', {
      workspace: process.cwd()
    });

    // Configure logger for non-interactive mode
    await logger.configure({
      level: this.configManager.get('logLevel'),
      enableConsole: !this.configManager.get('logLevel') || this.configManager.get('logLevel') !== 'error',
      enableFile: true,
      enableAudit: this.configManager.get('enableAuditLog')
    });

    // Initialize components
    await this.agentManager.initialize();
    await this.guidanceManager.initialize();

    // Register all available agents
    registerAgents(this.agentManager as AgentManager);

    await logger.logSession('info', this.sessionId, 'CLI Executor initialized successfully');
  }

  /**
   * Execute a task with specified options
   */
  async execute(options: ExecOptions): Promise<ExecResult> {
    const startTime = Date.now();

    await logger.logSession('info', this.sessionId, 'Starting task execution', {
      options: {
        ...options,
        task: options.task?.substring(0, 100) + (options.task?.length > 100 ? '...' : '')
      }
    });

    const results: ExecResult['results'] = [];
    const logs: string[] = [];

    try {
      // Create task
      const task: AgentTask = {
        id: nanoid(),
        type: 'user_request',
        title: 'CLI Execution Task',
        description: options.task,
        priority: 'high',
        status: 'pending',
        data: {
          userInput: options.task,
          executionMode: 'non-interactive',
          sessionId: this.sessionId
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        timeout: options.timeout || this.configManager.get('defaultAgentTimeout'),
        requiredCapabilities: this.inferRequiredCapabilities(options.task),
        progress: 0
      };

      let agentIds: string[] = [];

      if (options.agent) {
        // Use specified agent
        const agent = Array.from(this.agentManager.listAgents())
          .find(a => a.name.toLowerCase() === options.agent?.toLowerCase());

        if (!agent) {
          throw new Error(`Agent not found: ${options.agent}`);
        }
        agentIds = [agent.id];

      } else {
        // Auto-select best agent
        const bestAgent = this.agentManager.findBestAgentForTask(task);
        if (!bestAgent) {
          throw new Error('No suitable agent found for this task');
        }
        agentIds = [bestAgent.id];
      }

      // Execute task(s)
      if (options.parallel && agentIds.length > 1) {
        // Parallel execution
        await logger.logSession('info', this.sessionId, 'Starting parallel execution', {
          agentCount: agentIds.length,
          concurrency: options.concurrency
        });

        const promises = agentIds.map(async (agentId) => {
          const agentTask = { ...task, id: nanoid() };
          return this.executeAgentTask(agentId, agentTask);
        });

        const parallelResults = await Promise.allSettled(promises);

        parallelResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              taskId: task.id,
              agentId: agentIds[index],
              status: 'failed',
              error: result.reason?.message || 'Unknown error'
            });
          }
        });

      } else {
        // Sequential execution
        for (const agentId of agentIds) {
          const agentTask = { ...task, id: nanoid() };
          const result = await this.executeAgentTask(agentId, agentTask);
          results.push(result);
        }
      }

      // Calculate metrics
      const successful = results.filter(r => r.status === 'completed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const totalDuration = Date.now() - startTime;

      const execResult: ExecResult = {
        success: failed === 0,
        results,
        metrics: {
          totalTasks: results.length,
          successful,
          failed,
          totalDuration
        },
        logs
      };

      await logger.logSession('info', this.sessionId, 'Task execution completed', {
        success: execResult.success,
        metrics: execResult.metrics
      });

      // Audit log the execution
      await logger.audit('cli_execution_completed', {
        sessionId: this.sessionId,
        options,
        results: execResult.metrics,
        duration: totalDuration
      });

      return execResult;

    } catch (error: any) {
      await logger.logSession('error', this.sessionId, 'Task execution failed', {
        error: error.message
      });

      return {
        success: false,
        results: [{
          taskId: 'unknown',
          agentId: 'unknown',
          status: 'failed',
          error: error.message
        }],
        metrics: {
          totalTasks: 0,
          successful: 0,
          failed: 1,
          totalDuration: Date.now() - startTime
        },
        logs
      };
    }
  }

  /**
   * Execute a task on a specific agent
   */
  private async executeAgentTask(agentId: string, task: AgentTask): Promise<ExecResult['results'][0]> {
    const startTime = Date.now();

    try {
      await logger.logTask('info', task.id, agentId, 'Starting agent task execution');

      const result = await this.agentManager.executeTask(agentId, task);

      return {
        taskId: task.id,
        agentId,
        status: result.status,
        duration: result.duration,
        output: result.output,
        error: result.error
      };

    } catch (error: any) {
      await logger.logTask('error', task.id, agentId, 'Agent task execution failed', {
        error: error.message
      });

      return {
        taskId: task.id,
        agentId,
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Infer required capabilities from task description
   */
  private inferRequiredCapabilities(task: string): string[] {
    const capabilities: string[] = [];
    const taskLower = task.toLowerCase();

    // Code-related capabilities
    if (taskLower.includes('code') || taskLower.includes('program') || taskLower.includes('implement')) {
      capabilities.push('code-generation', 'code-analysis');
    }

    if (taskLower.includes('react') || taskLower.includes('component') || taskLower.includes('jsx')) {
      capabilities.push('react', 'frontend');
    }

    if (taskLower.includes('typescript') || taskLower.includes('types')) {
      capabilities.push('typescript');
    }

    if (taskLower.includes('api') || taskLower.includes('backend') || taskLower.includes('server')) {
      capabilities.push('backend', 'api-development');
    }

    // File operations
    if (taskLower.includes('file') || taskLower.includes('read') || taskLower.includes('write')) {
      capabilities.push('file-operations');
    }

    // Analysis capabilities
    if (taskLower.includes('review') || taskLower.includes('analyze') || taskLower.includes('audit')) {
      capabilities.push('code-review', 'analysis');
    }

    // Testing capabilities
    if (taskLower.includes('test') || taskLower.includes('spec')) {
      capabilities.push('testing');
    }

    // DevOps capabilities
    if (taskLower.includes('deploy') || taskLower.includes('docker') || taskLower.includes('ci')) {
      capabilities.push('devops', 'deployment');
    }

    return capabilities.length > 0 ? capabilities : ['general'];
  }

  /**
   * Format output based on specified format
   */
  formatOutput(result: ExecResult, format: 'json' | 'text' = 'text'): string {
    if (format === 'json') {
      return JSON.stringify(result, null, 2);
    }

    let output = '';

    // Header
    output += chalk.blue.bold('🤖 AI Coder CLI Execution Results\n');
    output += chalk.gray('─'.repeat(50)) + '\n';

    // Status
    const statusIcon = result.success ? '✅' : '❌';
    const statusColor = result.success ? chalk.green : chalk.red;
    output += `${statusIcon} Status: ${statusColor(result.success ? 'SUCCESS' : 'FAILED')}\n`;

    // Metrics
    output += chalk.cyan('\n📊 Metrics:\n');
    output += `  Total Tasks: ${result.metrics.totalTasks}\n`;
    output += `  Successful: ${chalk.green(result.metrics.successful)}\n`;
    output += `  Failed: ${chalk.red(result.metrics.failed)}\n`;
    output += `  Duration: ${result.metrics.totalDuration}ms\n`;

    // Task Results
    if (result.results.length > 0) {
      output += chalk.cyan('\n📋 Task Results:\n');
      result.results.forEach((taskResult, index) => {
        const taskIcon = taskResult.status === 'completed' ? '✅' : '❌';
        output += `  ${taskIcon} Task ${index + 1} (${taskResult.taskId.substring(0, 8)}...)\n`;
        output += `    Agent: ${taskResult.agentId}\n`;
        output += `    Status: ${taskResult.status}\n`;
        if (taskResult.duration) {
          output += `    Duration: ${taskResult.duration}ms\n`;
        }
        if (taskResult.error) {
          output += `    Error: ${chalk.red(taskResult.error)}\n`;
        }
        if (taskResult.output) {
          output += `    Output: ${taskResult.output.substring(0, 200)}${taskResult.output.length > 200 ? '...' : ''}\n`;
        }
        output += '\n';
      });
    }

    return output;
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const handleShutdown = async (signal: string) => {
      await logger.logSession('warn', this.sessionId, `Received ${signal}, shutting down gracefully`);
      await this.cleanup();
      process.exit(signal === 'SIGTERM' ? 0 : 1);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGQUIT', () => handleShutdown('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      await logger.logSession('error', this.sessionId, 'Uncaught exception', {
        error: error.message,
        stack: error.stack
      });
      await this.cleanup();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      await logger.logSession('error', this.sessionId, 'Unhandled promise rejection', {
        reason: String(reason),
        promise: String(promise)
      });
      await this.cleanup();
      process.exit(1);
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await logger.logSession('info', this.sessionId, 'Starting cleanup');

    try {
      // Run custom cleanup handlers
      for (const handler of this.cleanupHandlers) {
        try {
          await handler();
        } catch (error: any) {
          await logger.error('Cleanup handler failed', { error: error.message });
        }
      }

      // Cleanup components
      if (this.agentManager) {
        await this.agentManager.cleanup();
      }

      if (this.guidanceManager) {
        await this.guidanceManager.cleanup();
      }

      // Flush logs
      await logger.flush();

      await logger.logSession('info', this.sessionId, 'Cleanup completed');

    } catch (error: any) {
      console.error('Error during cleanup:', error.message);
    } finally {
      // Final shutdown
      await logger.shutdown();
    }
  }

  /**
   * Add cleanup handler
   */
  addCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }
}

/**
 * CLI entry point for non-interactive execution
 */
export async function executeCli(options: ExecOptions): Promise<ExecResult> {
  const executor = new CliExecutor(options.workspace);

  try {
    await executor.initialize();
    const result = await executor.execute(options);

    // Output results
    if (!options.silent) {
      const output = executor.formatOutput(result, options.output);
      console.log(output);
    }

    await executor.cleanup();
    return result;

  } catch (error: any) {
    await logger.error('CLI execution failed', { error: error.message });
    await executor.cleanup();
    throw error;
  }
}

function parseArgs(argv: string[]) {
  const opts: Record<string, any> = {};
  const pos: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];

      if (['agent', 'timeout', 'output', 'workspace', 'concurrency'].includes(key) && nextArg && !nextArg.startsWith('--')) {
        opts[key] = nextArg;
        i++;
      } else if (['parallel', 'silent', 'help'].includes(key)) {
        opts[key] = true;
      }
    } else {
      pos.push(arg);
    }
  }

  return { opts, pos };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const [, , ...args] = process.argv;
  const { opts, pos } = parseArgs(args);

  if (opts.help || pos.length === 0) {
    console.log(chalk.blue.bold('🤖 AI Coder CLI Non-Interactive Execution'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.green('\nUsage:'));
    console.log('  ai-coder-exec <task> [options]');
    console.log(chalk.green('\nOptions:'));
    console.log('  --agent <name>       Use specific agent');
    console.log('  --timeout <ms>       Task timeout in milliseconds');
    console.log('  --parallel           Execute tasks in parallel');
    console.log('  --concurrency <n>    Max parallel tasks');
    console.log('  --output <format>    Output format (json|text)');
    console.log('  --silent             Suppress output');
    console.log('  --workspace <path>   Working directory');
    console.log('  --help               Show this help');
    console.log(chalk.green('\nExamples:'));
    console.log('  ai-coder-exec "analyze this codebase" --agent coding-agent');
    console.log('  ai-coder-exec "create a React component" --output json');
    console.log('  ai-coder-exec "review all TypeScript files" --parallel');
    process.exit(0);
  }

  const task = pos.join(' ').trim();

  const options: ExecOptions = {
    task,
    agent: opts.agent,
    timeout: opts.timeout ? parseInt(opts.timeout) : undefined,
    parallel: opts.parallel || false,
    concurrency: opts.concurrency ? parseInt(opts.concurrency) : undefined,
    output: opts.output as 'json' | 'text' || 'text',
    silent: opts.silent || false,
    workspace: opts.workspace
  };

  try {
    const result = await executeCli(options);
    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error(chalk.red('❌ Execution failed:'), error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}