import { nanoid } from 'nanoid';
import chalk from 'chalk';

import { AgentManager } from '../core/agent-manager';
import { Agent, AgentStatus } from '../types/types';

import { AgentTodoManager } from '../core/agent-todo-manager';
import { SessionManager, SessionData, ChatMessage } from '../persistence/session-manager';
import { SimpleConfigManager } from '../core/config-manager';
import { GuidanceManager } from '../guidance/guidance-manager';

/**
 * ChatOrchestrator coordinates user input, planning and execution.
 */
export class ChatOrchestrator {
  private agentManager: AgentManager;
  private todoManager: AgentTodoManager;
  private sessionManager: SessionManager;
  private configManager: SimpleConfigManager;
  private guidanceManager: GuidanceManager;

  constructor(
    agentManager: AgentManager,
    todoManager: AgentTodoManager,
    sessionManager: SessionManager,
    configManager: SimpleConfigManager,
    guidanceManager?: GuidanceManager,
  ) {
    this.agentManager = agentManager;
    this.todoManager = todoManager;
    this.sessionManager = sessionManager;
    this.configManager = configManager;
    this.guidanceManager = guidanceManager || new GuidanceManager(process.cwd());
  }

  async initialize(): Promise<void> {
    console.log(chalk.blue('🚀 Initializing Chat Orchestrator...'));

    // Initialize guidance system
    await this.guidanceManager.initialize((context) => {
      console.log(chalk.green('📋 Guidance context updated - applying to future agents'));
    });

    console.log(chalk.green('✅ Chat Orchestrator initialized'));
  }

  async handleInput(sessionId: string, input: string): Promise<void> {
    let session = (await this.sessionManager.loadSession(sessionId)) || {
      id: sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };

    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date().toISOString() };
    session.messages.push(userMsg);

    if (input.trim().startsWith('/')) {
      await this.handleCommand(session, input.trim());
      await this.sessionManager.saveSession(session);
      return;
    }

    const agentId = nanoid();
    const agentName = `agent-${agentId.slice(0, 5)}`;

    // Get guidance context for this agent
    const guidanceContext = this.guidanceManager.getContextForAgent('general', process.cwd());

    const agent: Agent = {
      id: agentId,
      name: agentName,
      status: 'planning' as AgentStatus,
      description: 'Planned tasks',
      specialization: 'general',
      capabilities: [],
      version: '1.0.0',
      currentTasks: 0,
      maxConcurrentTasks: 1,
      initialize: async () => { },
      cleanup: async () => { },
      executeTodo: async (todo) => {
        await this.delay(500);
        console.log(chalk.cyan(`🤖 [${agentName}] executing: ${todo.title}`));

        // Add guidance context to todo execution if available
        if (guidanceContext) {
          console.log(chalk.blue(`📋 [${agentName}] applying guidance context`));
        }

        const duration = (todo.estimatedDuration || 5) * 100;
        await this.delay(duration);
        console.log(chalk.green(`✅ [${agentName}] done: ${todo.title}`));
      },
      // Missing required methods
      run: async (task) => {
        const startTime = new Date();
        return {
          taskId: task.id,
          agentId: agentId,
          status: 'completed' as any,
          result: `Task ${task.id} completed`,
          startTime,
          endTime: new Date(),
          duration: 100
        };
      },
      executeTask: async (task) => {
        const startTime = new Date();
        return {
          taskId: task.id,
          agentId: agentId,
          status: 'completed' as any,
          result: `Task ${task.id} executed`,
          startTime,
          endTime: new Date(),
          duration: 100
        };
      },
      getStatus: () => agent.status,
      getMetrics: () => ({
        tasksExecuted: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        tasksInProgress: agent.currentTasks,
        averageExecutionTime: 0,
        totalExecutionTime: 0,
        successRate: 100,
        tokensConsumed: 0,
        apiCallsTotal: 0,
        lastActive: new Date(),
        uptime: 0,
        productivity: 0,
        accuracy: 100
      }),
      getCapabilities: () => agent.capabilities,
      canHandle: (task) => true,
      updateGuidance: (guidance) => {
        console.log(`Updated guidance for ${agentName}`);
      },
      updateConfiguration: (config) => {
        console.log(`Updated configuration for ${agentName}`);
      }
    };

    this.agentManager.registerAgent(agent);

    // Create enhanced context for todo planning
    const planningContext = {
      userInput: input,
      guidance: guidanceContext,
      workingDirectory: process.cwd()
    };

    const todos = await this.todoManager.planTodos(agentId, input, planningContext);

    if (todos.length === 0) {
      session.messages.push({ role: 'assistant', content: `No tasks for: ${input}`, timestamp: new Date().toISOString() });
      await this.sessionManager.saveSession(session);
      return;
    }

    const summary = todos.map((t, i) => `${i + 1}. ${t.title} (${t.priority})`).join('\n');
    session.messages.push({
      role: 'assistant', content: `Planned ${todos.length} tasks:\n${summary}`, timestamp: new Date().toISOString()
    });
    await this.sessionManager.saveSession(session);

    // Execute todos with agent manager
    for (const todo of todos) {
      const task = {
        id: todo.id,
        type: 'internal' as const,
        title: todo.title,
        description: todo.description,
        priority: todo.priority as any,
        status: 'pending' as const,
        data: { todo },
        createdAt: new Date(),
        updatedAt: new Date(),
        progress: 0
      };
      await this.agentManager.executeTask(agentId, task);
    }

    session.messages.push({ role: 'assistant', content: `All tasks complete.`, timestamp: new Date().toISOString() });
    await this.sessionManager.saveSession(session);
  }

  private async handleCommand(session: SessionData, cmd: string): Promise<void> {
    const tokens = cmd.split(/\s+/);
    switch (tokens[0].toLowerCase()) {
      case '/help':
        const helpText = `Commands available:
/help - Show this help message
/sessions - List all sessions
/config - Show current configuration
/guidance - Show guidance system status
/guidance list - List all guidance files
/guidance create <type> <location> - Create sample guidance file (claude|codex|agents, global|project)
/guidance reload - Reload guidance files
/guidance stats - Show guidance statistics`;
        session.messages.push({ role: 'assistant', content: helpText, timestamp: new Date().toISOString() });
        break;
      case '/sessions':
        const list = await this.sessionManager.listSessions();
        session.messages.push({ role: 'assistant', content: list.length ? list.map(s => s.id).join(',') : 'None', timestamp: new Date().toISOString() });
        break;
      case '/config':
        this.configManager.getConfig();
        session.messages.push({ role: 'assistant', content: 'Configuration displayed in console', timestamp: new Date().toISOString() });
        break;
      case '/guidance':
        await this.handleGuidanceCommand(session, tokens.slice(1));
        break;
      default:
        session.messages.push({ role: 'assistant', content: `Unknown command: ${cmd}. Use /help for available commands.`, timestamp: new Date().toISOString() });
    }
  }

  private async handleGuidanceCommand(session: SessionData, args: string[]): Promise<void> {
    if (args.length === 0) {
      // Show guidance status
      const context = this.guidanceManager.getContext();
      const stats = this.guidanceManager.getStats();

      const statusText = `🧠 Guidance System Status:
Total files: ${stats.totalFiles}
Types: Claude (${stats.byType.claude}), Codex (${stats.byType.codex}), Agents (${stats.byType.agents})
Levels: Global (${stats.byLevel.global}), Project (${stats.byLevel.project}), Subdirectory (${stats.byLevel.subdirectory})
Total size: ${Math.round(stats.totalSize / 1024)}KB
Last updated: ${context?.lastUpdated ? new Date(context.lastUpdated).toLocaleString() : 'Never'}`;

      session.messages.push({ role: 'assistant', content: statusText, timestamp: new Date().toISOString() });
      return;
    }

    const subCommand = args[0].toLowerCase();
    switch (subCommand) {
      case 'list':
        const files = this.guidanceManager.listGuidanceFiles();
        const fileList = files.length === 0 ? 'No guidance files found.' :
          files.map(f => `📋 ${f.type.toUpperCase()} (${f.level}) - ${f.path}`).join('\n');
        session.messages.push({ role: 'assistant', content: fileList, timestamp: new Date().toISOString() });
        break;

      case 'create':
        if (args.length < 3) {
          session.messages.push({ role: 'assistant', content: 'Usage: /guidance create <type> <location>\nType: claude|codex|agents\nLocation: global|project', timestamp: new Date().toISOString() });
          return;
        }

        const type = args[1] as 'claude' | 'codex' | 'agents';
        const location = args[2] as 'global' | 'project';

        if (!['claude', 'codex', 'agents'].includes(type)) {
          session.messages.push({ role: 'assistant', content: 'Invalid type. Use: claude, codex, or agents', timestamp: new Date().toISOString() });
          return;
        }

        if (!['global', 'project'].includes(location)) {
          session.messages.push({ role: 'assistant', content: 'Invalid location. Use: global or project', timestamp: new Date().toISOString() });
          return;
        }

        try {
          const createdPath = this.guidanceManager.createSampleGuidanceFile(type, location);
          session.messages.push({ role: 'assistant', content: `✅ Created sample ${type} guidance file at: ${createdPath}`, timestamp: new Date().toISOString() });
        } catch (error: any) {
          session.messages.push({ role: 'assistant', content: `❌ Failed to create guidance file: ${error.message}`, timestamp: new Date().toISOString() });
        }
        break;

      case 'reload':
        try {
          await this.guidanceManager.cleanup();
          await this.guidanceManager.initialize();
          session.messages.push({ role: 'assistant', content: '✅ Guidance system reloaded successfully', timestamp: new Date().toISOString() });
        } catch (error: any) {
          session.messages.push({ role: 'assistant', content: `❌ Failed to reload guidance: ${error.message}`, timestamp: new Date().toISOString() });
        }
        break;

      case 'stats':
        const stats = this.guidanceManager.getStats();
        const context = this.guidanceManager.getContext();
        const statsText = `📊 Guidance Statistics:
Total Files: ${stats.totalFiles}
By Type:
  - Claude: ${stats.byType.claude}
  - Codex: ${stats.byType.codex}
  - Agents: ${stats.byType.agents}
By Level:
  - Global: ${stats.byLevel.global}
  - Project: ${stats.byLevel.project}
  - Subdirectory: ${stats.byLevel.subdirectory}
Total Content Size: ${Math.round(stats.totalSize / 1024)}KB
Last Updated: ${context?.lastUpdated ? new Date(context.lastUpdated).toLocaleString() : 'Never'}`;
        session.messages.push({ role: 'assistant', content: statsText, timestamp: new Date().toISOString() });
        break;

      default:
        session.messages.push({ role: 'assistant', content: `Unknown guidance command: ${subCommand}. Use /help for available commands.`, timestamp: new Date().toISOString() });
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }
}
