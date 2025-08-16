import { BaseAgent } from './base-agent';
import { EventBus, EventTypes } from './event-bus';
import { vmManager, VMInstance, VMTask } from '../vm/vm-manager';
import { CliUI } from '../../utils/cli-ui';
import { nanoid } from 'nanoid';
import chalk from 'chalk';

export interface AutonomousVMTask {
  id: string;
  type: 'repository-analysis' | 'code-generation' | 'testing' | 'deployment' | 'custom';
  description: string;
  repositoryUrl?: string;
  commands: string[];
  requirements?: {
    vscode?: boolean;
    node?: boolean;
    python?: boolean;
    docker?: boolean;
    memory?: string;
    cpu?: string;
  };
  callback?: (results: any) => void;
}

export interface VMAgentMetrics {
  vmsCreated: number;
  vmsDestroyed: number;
  tasksCompleted: number;
  tasksFailed: number;
  totalExecutionTime: number;
  averageTaskDuration: number;
  lastActive: Date;
}

export class AutonomousVMAgent extends BaseAgent {
  id = 'autonomous-vm-agent';
  capabilities = [
    'vm-management',
    'repository-analysis',
    'code-generation',
    'testing',
    'deployment',
    'autonomous-operation'
  ];
  specialization = 'autonomous-vm-operations';

  private activeVMs: Map<string, VMInstance> = new Map();
  private activeTasks: Map<string, VMTask> = new Map();
  private metrics: VMAgentMetrics = {
    vmsCreated: 0,
    vmsDestroyed: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    totalExecutionTime: 0,
    averageTaskDuration: 0,
    lastActive: new Date()
  };

  constructor(workingDirectory: string) {
    super(workingDirectory);
    this.setupVMEventListeners();
  }

  /**
   * Execute an autonomous task in a VM
   */
  async executeAutonomousTask(task: Omit<AutonomousVMTask, 'id'>): Promise<any> {
    const taskId = nanoid();
    const fullTask: AutonomousVMTask = { ...task, id: taskId };

    try {
      CliUI.logInfo(`🤖 Autonomous VM Agent starting task: ${task.description}`);

      // Create VM for the task
      const vm = await this.createVMForTask(fullTask);

      // Execute task in VM
      const results = await this.executeTaskInVM(vm, fullTask);

      // Cleanup VM
      await this.cleanupVM(vm.id);

      // Update metrics
      this.updateMetrics(fullTask, results);

      // Publish completion event
      await this.eventBus.publish(EventTypes.AGENT_TASK_COMPLETED, {
        agentId: this.id,
        taskId,
        results,
        vmId: vm.id
      });

      CliUI.logSuccess(`✅ Autonomous task completed: ${task.description}`);

      // Call callback if provided
      if (task.callback) {
        task.callback(results);
      }

      return results;

    } catch (error: any) {
      CliUI.logError(`❌ Autonomous task failed: ${error.message}`);
      
      // Publish failure event
      await this.eventBus.publish(EventTypes.AGENT_TASK_FAILED, {
        agentId: this.id,
        taskId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Analyze repository and create pull request
   */
  async analyzeRepositoryAndCreatePR(repositoryUrl: string, analysisCommands: string[]): Promise<any> {
    const task: Omit<AutonomousVMTask, 'id'> = {
      type: 'repository-analysis',
      description: `Analyze repository and create pull request for ${repositoryUrl}`,
      repositoryUrl,
      commands: [
        // Clone and analyze
        'git clone ' + repositoryUrl + ' .',
        'git checkout -b feature/automated-analysis',
        // Analysis commands
        ...analysisCommands,
        // Create pull request
        'gh pr create --title "Automated Analysis Results" --body "Analysis completed by NikCLI Autonomous Agent"'
      ],
      requirements: {
        vscode: true,
        node: true,
        python: true
      }
    };

    return this.executeAutonomousTask(task);
  }

  /**
   * Create VM optimized for task requirements
   */
  private async createVMForTask(task: AutonomousVMTask): Promise<VMInstance> {
    const vmConfig = this.buildVMConfig(task);
    
    CliUI.logInfo(`🐳 Creating VM for task: ${task.description}`);
    
    const vm = await vmManager.createVM(vmConfig);
    this.activeVMs.set(vm.id, vm);
    this.metrics.vmsCreated++;

    // Publish VM creation event
    await this.eventBus.publish(EventTypes.VM_AGENT_CREATED, {
      agentId: this.id,
      vmId: vm.id,
      taskId: task.id
    });

    return vm;
  }

  /**
   * Execute task in VM
   */
  private async executeTaskInVM(vm: VMInstance, task: AutonomousVMTask): Promise<any> {
    const startTime = Date.now();

    const vmTask = await vmManager.executeTask(vm.id, {
      type: task.type,
      description: task.description,
      repositoryUrl: task.repositoryUrl,
      commands: task.commands
    });

    this.activeTasks.set(vmTask.id, vmTask);
    const executionTime = Date.now() - startTime;

    // Update metrics
    this.metrics.totalExecutionTime += executionTime;
    this.metrics.tasksCompleted++;
    this.metrics.averageTaskDuration = this.metrics.totalExecutionTime / this.metrics.tasksCompleted;
    this.metrics.lastActive = new Date();

    return vmTask.results;
  }

  /**
   * Cleanup VM after task completion
   */
  private async cleanupVM(vmId: string): Promise<void> {
    const vm = this.activeVMs.get(vmId);
    if (!vm) return;

    try {
      await vmManager.destroyVM(vmId);
      this.activeVMs.delete(vmId);
      this.metrics.vmsDestroyed++;

      // Publish VM destruction event
      await this.eventBus.publish(EventTypes.VM_AGENT_DESTROYED, {
        agentId: this.id,
        vmId
      });

    } catch (error: any) {
      CliUI.logWarning(`⚠️ Failed to cleanup VM ${vmId}: ${error.message}`);
    }
  }

  /**
   * Build VM configuration based on task requirements
   */
  private buildVMConfig(task: AutonomousVMTask): any {
    const baseConfig = {
      memory: '2g',
      cpu: '2',
      ports: ['3000:3000', '8080:8080'],
      environment: {
        DEBIAN_FRONTEND: 'noninteractive',
        TERM: 'xterm-256color'
      }
    };

    // Adjust based on requirements
    if (task.requirements?.memory) {
      baseConfig.memory = task.requirements.memory;
    }

    if (task.requirements?.cpu) {
      baseConfig.cpu = task.requirements.cpu;
    }

    // Add development tools if needed
    if (task.requirements?.node || task.requirements?.python) {
      baseConfig.environment.NODE_ENV = 'development';
    }

    return baseConfig;
  }

  /**
   * Update agent metrics
   */
  private updateMetrics(task: AutonomousVMTask, results: any): void {
    this.metrics.lastActive = new Date();
    
    if (results && results.some((r: any) => !r.success)) {
      this.metrics.tasksFailed++;
    }
  }

  /**
   * Setup VM event listeners
   */
  private setupVMEventListeners(): void {
    vmManager.on('vm:created', (vm: VMInstance) => {
      CliUI.logInfo(`🤖 VM Agent: VM created ${vm.id}`);
    });

    vmManager.on('vm:destroyed', (vm: VMInstance) => {
      CliUI.logInfo(`🤖 VM Agent: VM destroyed ${vm.id}`);
    });

    vmManager.on('task:completed', (task: VMTask) => {
      CliUI.logInfo(`🤖 VM Agent: Task completed ${task.id}`);
    });

    vmManager.on('task:failed', (task: VMTask, error: any) => {
      CliUI.logError(`🤖 VM Agent: Task failed ${task.id}: ${error.message}`);
    });
  }

  /**
   * Get agent status
   */
  getStatus(): any {
    return {
      id: this.id,
      status: this.status,
      activeVMs: this.activeVMs.size,
      activeTasks: this.activeTasks.size,
      metrics: this.metrics
    };
  }

  /**
   * Get active VMs
   */
  getActiveVMs(): VMInstance[] {
    return Array.from(this.activeVMs.values());
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): VMTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Stop all active VMs
   */
  async stopAllVMs(): Promise<void> {
    CliUI.logInfo(`🤖 Stopping all active VMs (${this.activeVMs.size})`);

    const vmIds = Array.from(this.activeVMs.keys());
    for (const vmId of vmIds) {
      await this.cleanupVM(vmId);
    }
  }

  /**
   * Override base agent methods
   */
  async onInitialize(): Promise<void> {
    CliUI.logInfo(`🤖 Initializing Autonomous VM Agent`);
    // Additional initialization if needed
  }

  async onShutdown(): Promise<void> {
    CliUI.logInfo(`🤖 Shutting down Autonomous VM Agent`);
    await this.stopAllVMs();
  }
}