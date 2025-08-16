import chalk from 'chalk';
import * as readline from 'readline';
import { EventEmitter } from 'events';
import { EventBus, EventTypes } from '../automation/agents/event-bus';
import { vmManager } from '../automation/vm/vm-manager';
import { CliUI } from '../utils/cli-ui';

export interface ActiveAgent {
  id: string;
  name: string;
  type: 'vm-agent' | 'analysis-agent' | 'deployment-agent' | 'custom';
  status: 'active' | 'idle' | 'working' | 'completed' | 'error';
  startTime: Date;
  lastUpdate: Date;
  progress?: number;
  currentTask?: string;
  vmId?: string;
  logs: string[];
}

export interface AgentStatusUI {
  showActiveAgents(): void;
  showAgentLogs(agentId: string): void;
  hideAgentLogs(): void;
  updateAgentStatus(agentId: string, status: Partial<ActiveAgent>): void;
  isAgentActive(agentId: string): boolean;
}

export class AgentStatusUIManager extends EventEmitter implements AgentStatusUI {
  private activeAgents: Map<string, ActiveAgent> = new Map();
  private eventBus: EventBus;
  private rl?: readline.Interface;
  private showingLogs = false;
  private currentLogAgentId?: string;
  private originalPrompt = '';
  private isInteractive = false;

  // Icons for different agent types
  private readonly agentIcons = {
    'vm-agent': '🐳',
    'analysis-agent': '🔍',
    'deployment-agent': '🚀',
    'custom': '🤖'
  };

  // Status indicators
  private readonly statusIndicators = {
    'active': chalk.green('●'),
    'idle': chalk.yellow('○'),
    'working': chalk.blue('◐'),
    'completed': chalk.green('✓'),
    'error': chalk.red('✗')
  };

  constructor() {
    super();
    this.eventBus = EventBus.getInstance();
    this.setupEventListeners();
  }

  /**
   * Initialize the UI manager
   */
  initialize(): void {
    this.setupReadline();
    this.setupKeyboardShortcuts();
  }

  /**
   * Show active agents in the prompt
   */
  showActiveAgents(): void {
    if (this.activeAgents.size === 0) return;

    const agentDisplay = Array.from(this.activeAgents.values())
      .map(agent => {
        const icon = this.agentIcons[agent.type] || '🤖';
        const status = this.statusIndicators[agent.status];
        const name = agent.name.length > 10 ? agent.name.substring(0, 10) + '...' : agent.name;
        return `${icon}${status}${name}`;
      })
      .join(' ');

    // Update prompt with active agents
    this.updatePromptWithAgents(agentDisplay);
  }

  /**
   * Show logs for a specific agent
   */
  showAgentLogs(agentId: string): void {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      CliUI.logWarning(`Agent not found: ${agentId}`);
      return;
    }

    this.showingLogs = true;
    this.currentLogAgentId = agentId;

    // Clear screen and show logs
    console.clear();
    console.log(chalk.blue.bold(`📋 Agent Logs: ${agent.name} (${agentId})`));
    console.log(chalk.gray('─'.repeat(80)));
    
    if (agent.logs.length === 0) {
      console.log(chalk.yellow('No logs available'));
    } else {
      agent.logs.forEach(log => {
        console.log(chalk.white(log));
      });
    }

    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.cyan('Press ESC to return to main chat'));
    console.log(chalk.cyan('Press R to refresh logs'));
    console.log(chalk.cyan('Press C to clear logs'));

    // Setup log view keyboard shortcuts
    this.setupLogViewShortcuts();
  }

  /**
   * Hide agent logs and return to main chat
   */
  hideAgentLogs(): void {
    this.showingLogs = false;
    this.currentLogAgentId = undefined;
    
    // Restore original prompt
    this.restoreOriginalPrompt();
    
    // Clear screen and show main interface
    console.clear();
    this.showActiveAgents();
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: Partial<ActiveAgent>): void {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      // Create new agent if doesn't exist
      const newAgent: ActiveAgent = {
        id: agentId,
        name: status.name || agentId,
        type: status.type || 'custom',
        status: status.status || 'active',
        startTime: status.startTime || new Date(),
        lastUpdate: new Date(),
        progress: status.progress,
        currentTask: status.currentTask,
        vmId: status.vmId,
        logs: status.logs || []
      };
      this.activeAgents.set(agentId, newAgent);
    } else {
      // Update existing agent
      Object.assign(agent, status, { lastUpdate: new Date() });
    }

    // Update display if not showing logs
    if (!this.showingLogs) {
      this.showActiveAgents();
    }

    // Emit status update event
    this.emit('agent:status-updated', agentId, this.activeAgents.get(agentId));
  }

  /**
   * Check if agent is active
   */
  isAgentActive(agentId: string): boolean {
    return this.activeAgents.has(agentId);
  }

  /**
   * Remove agent from active list
   */
  removeAgent(agentId: string): void {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      this.activeAgents.delete(agentId);
      
      // Update display
      if (!this.showingLogs) {
        this.showActiveAgents();
      }

      // Emit removal event
      this.emit('agent:removed', agentId, agent);
    }
  }



  /**
   * Add log entry to agent
   */
  addAgentLog(agentId: string, logEntry: string): void {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      const formattedLog = `[${timestamp}] ${logEntry}`;
      agent.logs.push(formattedLog);
      
      // Keep only last 100 logs
      if (agent.logs.length > 100) {
        agent.logs = agent.logs.slice(-100);
      }

      // Update display if showing this agent's logs
      if (this.showingLogs && this.currentLogAgentId === agentId) {
        this.showAgentLogs(agentId);
      }
    }
  }

  /**
   * Get all active agents
   */
  getActiveAgents(): ActiveAgent[] {
    return Array.from(this.activeAgents.values());
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for VM events
    vmManager.on('vm:created', (vm: any) => {
      this.updateAgentStatus(`vm-${vm.id}`, {
        name: `VM ${vm.config.name}`,
        type: 'vm-agent',
        status: 'active',
        vmId: vm.id,
        currentTask: 'VM created'
      });
    });

    vmManager.on('vm:destroyed', (vm: any) => {
      this.removeAgent(`vm-${vm.id}`);
    });

    vmManager.on('task:started', (task: any) => {
      this.updateAgentStatus(`task-${task.id}`, {
        name: `Task ${task.type}`,
        type: 'custom',
        status: 'working',
        currentTask: task.description
      });
    });

    vmManager.on('task:completed', (task: any) => {
      this.updateAgentStatus(`task-${task.id}`, {
        status: 'completed',
        currentTask: 'Task completed'
      });
      
      // Remove after a delay
      setTimeout(() => {
        this.removeAgent(`task-${task.id}`);
      }, 5000);
    });

    vmManager.on('task:failed', (task: any, error: any) => {
      this.updateAgentStatus(`task-${task.id}`, {
        status: 'error',
        currentTask: `Failed: ${error.message}`
      });
      
      // Remove after a delay
      setTimeout(() => {
        this.removeAgent(`task-${task.id}`);
      }, 10000);
    });
  }

  /**
   * Setup readline interface
   */
  private setupReadline(): void {
    if (this.rl) return;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.isInteractive = true;
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    if (!this.isInteractive) return;

    // Raw mode for better control
    process.stdin.setRawMode(true);
    require('readline').emitKeypressEvents(process.stdin);

    process.stdin.on('keypress', (str, key) => {
      // ESC key - return to main chat
      if (key && key.name === 'escape') {
        this.hideAgentLogs();
      }

      // L key - show agent logs
      if (key && key.name === 'l' && !this.showingLogs) {
        const activeAgents = this.getActiveAgents();
        if (activeAgents.length > 0) {
          this.showAgentLogs(activeAgents[0].id);
        }
      }

      // R key - refresh logs
      if (key && key.name === 'r' && this.showingLogs) {
        if (this.currentLogAgentId) {
          this.showAgentLogs(this.currentLogAgentId);
        }
      }

      // C key - clear logs
      if (key && key.name === 'c' && this.showingLogs) {
        if (this.currentLogAgentId) {
          const agent = this.activeAgents.get(this.currentLogAgentId);
          if (agent) {
            agent.logs = [];
            this.showAgentLogs(this.currentLogAgentId);
          }
        }
      }
    });
  }

  /**
   * Setup log view keyboard shortcuts
   */
  private setupLogViewShortcuts(): void {
    // Additional shortcuts for log view
    process.stdin.on('keypress', (str, key) => {
      if (!this.showingLogs) return;

      // N key - next agent logs
      if (key && key.name === 'n') {
        const activeAgents = this.getActiveAgents();
        const currentIndex = activeAgents.findIndex(a => a.id === this.currentLogAgentId);
        const nextIndex = (currentIndex + 1) % activeAgents.length;
        this.showAgentLogs(activeAgents[nextIndex].id);
      }

      // P key - previous agent logs
      if (key && key.name === 'p') {
        const activeAgents = this.getActiveAgents();
        const currentIndex = activeAgents.findIndex(a => a.id === this.currentLogAgentId);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : activeAgents.length - 1;
        this.showAgentLogs(activeAgents[prevIndex].id);
      }
    });
  }

  /**
   * Update prompt with active agents
   */
  private updatePromptWithAgents(agentDisplay: string): void {
    if (!this.originalPrompt) {
      this.originalPrompt = process.env.PROMPT || '[nikcli-main]';
    }

    const newPrompt = `${this.originalPrompt} ${agentDisplay}`;
    process.env.PROMPT = newPrompt;
    
    // Update readline prompt if available
    if (this.rl) {
      this.rl.setPrompt(newPrompt);
    }
  }

  /**
   * Restore original prompt
   */
  private restoreOriginalPrompt(): void {
    if (this.originalPrompt) {
      process.env.PROMPT = this.originalPrompt;
      if (this.rl) {
        this.rl.setPrompt(this.originalPrompt);
      }
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.rl) {
      this.rl.close();
    }
    
    if (this.isInteractive) {
      process.stdin.setRawMode(false);
    }
  }
}

// Singleton instance
export const agentStatusUI = new AgentStatusUIManager();