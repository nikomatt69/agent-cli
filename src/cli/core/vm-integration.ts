import { EventBus, EventTypes } from '../automation/agents/event-bus';
import { vmManager } from '../automation/vm/vm-manager';
import { AutonomousVMAgent } from '../automation/agents/autonomous-vm-agent';
import { agentStatusUI } from '../ui/agent-status-ui';
import { CliUI } from '../utils/cli-ui';
import { simpleConfigManager as configManager } from './config-manager';
import { advancedAIProvider } from '../ai/advanced-ai-provider';

export interface VMIntegrationConfig {
  enabled: boolean;
  autoCleanup: boolean;
  maxConcurrentVMs: number;
  defaultMemory: string;
  defaultCPU: string;
  timeoutMinutes: number;
}

export class VMIntegration {
  private eventBus: EventBus;
  private vmAgent: AutonomousVMAgent;
  private config: VMIntegrationConfig;
  private activeTasks: Map<string, any> = new Map();

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.vmAgent = new AutonomousVMAgent(process.cwd());
    this.config = {
      enabled: true,
      autoCleanup: true,
      maxConcurrentVMs: 3,
      defaultMemory: '2g',
      defaultCPU: '2',
      timeoutMinutes: 30
    };

    this.setupEventListeners();
  }

  /**
   * Initialize VM integration
   */
  async initialize(): Promise<void> {
    try {
      CliUI.logInfo('🚀 Initializing VM Integration...');

      // Initialize VM agent
      await this.vmAgent.initialize();

      // Initialize UI
      agentStatusUI.initialize();

      // Check Docker availability
      await this.checkDockerAvailability();

      CliUI.logSuccess('✅ VM Integration initialized successfully');

      // Publish system ready event
      await this.eventBus.publish(EventTypes.SYSTEM_READY, {
        component: 'vm-integration',
        capabilities: ['vm-management', 'autonomous-agents', 'repository-analysis']
      });

    } catch (error: any) {
      CliUI.logError(`❌ Failed to initialize VM Integration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle repository analysis request
   */
  async handleRepositoryAnalysis(repositoryUrl: string, analysisPrompt: string): Promise<any> {
    if (!this.config.enabled) {
      throw new Error('VM Integration is disabled');
    }

    const taskId = `analysis-${Date.now()}`;
    
    try {
      CliUI.logInfo(`🔍 Starting repository analysis: ${repositoryUrl}`);

      // Create analysis commands based on prompt
      const analysisCommands = await this.generateAnalysisCommands(analysisPrompt);

      // Execute autonomous task
      const results = await this.vmAgent.analyzeRepositoryAndCreatePR(
        repositoryUrl,
        analysisCommands
      );

      // Store task results
      this.activeTasks.set(taskId, {
        type: 'repository-analysis',
        repositoryUrl,
        results,
        completedAt: new Date()
      });

      // Notify completion in main chat
      await this.notifyCompletionInMainChat(repositoryUrl, results);

      return results;

    } catch (error: any) {
      CliUI.logError(`❌ Repository analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle autonomous task request
   */
  async handleAutonomousTask(taskDescription: string, commands: string[]): Promise<any> {
    if (!this.config.enabled) {
      throw new Error('VM Integration is disabled');
    }

    const taskId = `autonomous-${Date.now()}`;

    try {
      CliUI.logInfo(`🤖 Starting autonomous task: ${taskDescription}`);

      const task = {
        type: 'custom' as const,
        description: taskDescription,
        commands,
        requirements: {
          vscode: true,
          node: true,
          python: true
        }
      };

      const results = await this.vmAgent.executeAutonomousTask(task);

      // Store task results
      this.activeTasks.set(taskId, {
        type: 'autonomous-task',
        description: taskDescription,
        results,
        completedAt: new Date()
      });

      // Notify completion in main chat
      await this.notifyCompletionInMainChat(taskDescription, results);

      return results;

    } catch (error: any) {
      CliUI.logError(`❌ Autonomous task failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get VM integration status
   */
  getStatus(): any {
    return {
      enabled: this.config.enabled,
      activeVMs: vmManager.listVMs().length,
      activeTasks: this.activeTasks.size,
      vmAgentStatus: this.vmAgent.getStatus(),
      config: this.config
    };
  }

  /**
   * List all VMs
   */
  listVMs(): any[] {
    return vmManager.listVMs();
  }

  /**
   * Create a VM
   */
  async createVM(config: any): Promise<any> {
    return vmManager.createVM(config);
  }

  /**
   * Destroy a VM
   */
  async destroyVM(vmId: string): Promise<void> {
    return vmManager.destroyVM(vmId);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<VMIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    CliUI.logInfo('⚙️ VM Integration configuration updated');
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    try {
      CliUI.logInfo('🧹 Cleaning up VM Integration...');

      // Stop all VMs
      await this.vmAgent.stopAllVMs();

      // Cleanup UI
      agentStatusUI.cleanup();

      // Shutdown VM agent
      await this.vmAgent.onShutdown();

      CliUI.logSuccess('✅ VM Integration cleanup completed');

    } catch (error: any) {
      CliUI.logError(`❌ VM Integration cleanup failed: ${error.message}`);
    }
  }

  /**
   * Check Docker availability
   */
  private async checkDockerAvailability(): Promise<void> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      await execAsync('docker --version');
      CliUI.logSuccess('✅ Docker is available');

    } catch (error: any) {
      CliUI.logWarning('⚠️ Docker not available - VM features will be limited');
      this.config.enabled = false;
    }
  }

  /**
   * Generate analysis commands based on prompt
   */
  private async generateAnalysisCommands(analysisPrompt: string): Promise<string[]> {
    try {
      const prompt = `
        Generate a list of bash commands to analyze a repository based on this request: "${analysisPrompt}"
        
        The commands should:
        1. Clone the repository (already done)
        2. Analyze the codebase structure
        3. Check for common issues
        4. Generate a report
        5. Create a pull request with findings
        
        Return only the commands, one per line, without explanations.
      `;

      const response = await advancedAIProvider.generateText(prompt);
      const commands = response.split('\n')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd && !cmd.startsWith('#'))
        .filter(cmd => cmd.startsWith('git') || cmd.startsWith('npm') || cmd.startsWith('node') || cmd.startsWith('ls') || cmd.startsWith('find') || cmd.startsWith('echo'));

      return commands.length > 0 ? commands : [
        'ls -la',
        'find . -name "*.js" -o -name "*.ts" -o -name "*.py" | head -20',
        'echo "Analysis completed" > analysis-report.txt',
        'git add analysis-report.txt',
        'git commit -m "Add analysis report"'
      ];

    } catch (error: any) {
      CliUI.logWarning(`⚠️ Failed to generate analysis commands: ${error.message}`);
      
      // Fallback commands
      return [
        'ls -la',
        'find . -name "*.js" -o -name "*.ts" -o -name "*.py" | head -20',
        'echo "Analysis completed" > analysis-report.txt',
        'git add analysis-report.txt',
        'git commit -m "Add analysis report"'
      ];
    }
  }

  /**
   * Notify completion in main chat
   */
  private async notifyCompletionInMainChat(taskName: string, results: any): Promise<void> {
    const message = `✅ **Task Completed**: ${taskName}\n\n` +
      `**Results**:\n` +
      `- Status: ${results?.some((r: any) => !r.success) ? '❌ Failed' : '✅ Success'}\n` +
      `- Commands executed: ${results?.length || 0}\n` +
      `- VM cleaned up automatically\n\n` +
      `The autonomous agent has completed the task and cleaned up the VM.`;

    // Publish completion message
    await this.eventBus.publish(EventTypes.AGENT_MESSAGE, {
      agentId: 'autonomous-vm-agent',
      message,
      type: 'completion-notification'
    });
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for VM events
    vmManager.on('vm:created', (vm: any) => {
      agentStatusUI.updateAgentStatus(`vm-${vm.id}`, {
        name: `VM ${vm.config.name}`,
        type: 'vm-agent',
        status: 'active',
        vmId: vm.id,
        currentTask: 'VM created'
      });
    });

    vmManager.on('vm:destroyed', (vm: any) => {
      agentStatusUI.removeAgent(`vm-${vm.id}`);
    });

    vmManager.on('task:started', (task: any) => {
      agentStatusUI.updateAgentStatus(`task-${task.id}`, {
        name: `Task ${task.type}`,
        type: 'custom',
        status: 'working',
        currentTask: task.description
      });
    });

    vmManager.on('task:completed', (task: any) => {
      agentStatusUI.updateAgentStatus(`task-${task.id}`, {
        status: 'completed',
        currentTask: 'Task completed'
      });
      
      // Remove after delay
      setTimeout(() => {
        agentStatusUI.removeAgent(`task-${task.id}`);
      }, 5000);
    });

    vmManager.on('task:failed', (task: any, error: any) => {
      agentStatusUI.updateAgentStatus(`task-${task.id}`, {
        status: 'error',
        currentTask: `Failed: ${error.message}`
      });
      
      // Remove after delay
      setTimeout(() => {
        agentStatusUI.removeAgent(`task-${task.id}`);
      }, 10000);
    });

    // Listen for system shutdown
    this.eventBus.subscribe(EventTypes.SYSTEM_SHUTDOWN, async () => {
      await this.cleanup();
    });
  }
}

// Singleton instance
export const vmIntegration = new VMIntegration();