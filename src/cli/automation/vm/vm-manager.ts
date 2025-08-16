import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { nanoid } from 'nanoid';

import { EventBus, EventTypes } from '../agents/event-bus';
import { CliUI } from '../../utils/cli-ui';
import { simpleConfigManager as configManager } from '../../core/config-manager';

const execAsync = promisify(exec);

export interface VMConfig {
  id: string;
  name: string;
  image: string;
  memory: string;
  cpu: string;
  ports: string[];
  volumes: string[];
  environment: Record<string, string>;
  workingDirectory: string;
  autoRemove: boolean;
}

export interface VMInstance {
  id: string;
  config: VMConfig;
  status: 'creating' | 'running' | 'stopped' | 'error' | 'destroyed';
  containerId?: string;
  ipAddress?: string;
  startTime?: Date;
  endTime?: Date;
  logs: string[];
  agentId?: string;
  taskId?: string;
}

export interface VMTask {
  id: string;
  vmId: string;
  type: 'repository-analysis' | 'code-generation' | 'testing' | 'deployment';
  description: string;
  repositoryUrl?: string;
  commands: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  results?: any;
  logs: string[];
}

export class VMManager extends EventEmitter {
  private instances: Map<string, VMInstance> = new Map();
  private tasks: Map<string, VMTask> = new Map();
  private eventBus: EventBus;
  private defaultConfig: VMConfig;

  constructor() {
    super();
    this.eventBus = EventBus.getInstance();
    this.defaultConfig = {
      id: '',
      name: 'nikcli-vm',
      image: 'ubuntu:22.04',
      memory: '2g',
      cpu: '2',
      ports: ['3000:3000', '8080:8080'],
      volumes: [],
      environment: {
        DEBIAN_FRONTEND: 'noninteractive',
        TERM: 'xterm-256color'
      },
      workingDirectory: '/workspace',
      autoRemove: true
    };
  }

  /**
   * Create a new VM instance
   */
  async createVM(config: Partial<VMConfig> = {}): Promise<VMInstance> {
    const vmId = nanoid();
    const fullConfig: VMConfig = {
      ...this.defaultConfig,
      ...config,
      id: vmId,
      name: `${this.defaultConfig.name}-${vmId}`
    };

    const instance: VMInstance = {
      id: vmId,
      config: fullConfig,
      status: 'creating',
      logs: []
    };

    this.instances.set(vmId, instance);
    this.emit('vm:creating', instance);

    try {
      CliUI.logInfo(`🐳 Creating VM: ${fullConfig.name}`);

      // Build Docker run command
      const dockerArgs = this.buildDockerRunCommand(fullConfig);
      
      // Start container
      const containerId = await this.startContainer(dockerArgs);
      
      instance.containerId = containerId;
      instance.status = 'running';
      instance.startTime = new Date();

      // Get container IP
      instance.ipAddress = await this.getContainerIP(containerId);

      // Setup workspace
      await this.setupWorkspace(instance);

      CliUI.logSuccess(`✅ VM created successfully: ${fullConfig.name} (${containerId})`);

      // Publish event
      await this.eventBus.publish(EventTypes.VM_CREATED, {
        vmId,
        config: fullConfig,
        containerId,
        ipAddress: instance.ipAddress
      });

      this.emit('vm:created', instance);
      return instance;

    } catch (error: any) {
      instance.status = 'error';
      instance.logs.push(`Error creating VM: ${error.message}`);
      
      CliUI.logError(`❌ Failed to create VM: ${error.message}`);
      this.emit('vm:error', instance, error);
      throw error;
    }
  }

  /**
   * Execute a task in a VM
   */
  async executeTask(vmId: string, task: Omit<VMTask, 'id' | 'vmId' | 'status' | 'logs'>): Promise<VMTask> {
    const instance = this.instances.get(vmId);
    if (!instance) {
      throw new Error(`VM not found: ${vmId}`);
    }

    const taskId = nanoid();
    const vmTask: VMTask = {
      ...task,
      id: taskId,
      vmId,
      status: 'pending',
      logs: []
    };

    this.tasks.set(taskId, vmTask);
    instance.taskId = taskId;

    this.emit('task:started', vmTask);

    try {
      CliUI.logInfo(`🎯 Executing task in VM ${vmId}: ${task.description}`);

      vmTask.status = 'running';
      vmTask.startTime = new Date();

      // Clone repository if provided
      if (task.repositoryUrl) {
        await this.cloneRepository(instance, task.repositoryUrl);
      }

      // Install VS Code if needed
      if (task.type === 'repository-analysis') {
        await this.installVSCode(instance);
      }

      // Execute commands
      const results = await this.executeCommands(instance, task.commands);
      
      vmTask.status = 'completed';
      vmTask.endTime = new Date();
      vmTask.results = results;

      CliUI.logSuccess(`✅ Task completed in VM ${vmId}: ${task.description}`);

      // Publish event
      await this.eventBus.publish(EventTypes.VM_TASK_COMPLETED, {
        taskId,
        vmId,
        results
      });

      this.emit('task:completed', vmTask);
      return vmTask;

    } catch (error: any) {
      vmTask.status = 'failed';
      vmTask.endTime = new Date();
      vmTask.logs.push(`Error: ${error.message}`);

      CliUI.logError(`❌ Task failed in VM ${vmId}: ${error.message}`);
      this.emit('task:failed', vmTask, error);
      throw error;
    }
  }

  /**
   * Destroy a VM instance
   */
  async destroyVM(vmId: string): Promise<void> {
    const instance = this.instances.get(vmId);
    if (!instance) {
      throw new Error(`VM not found: ${vmId}`);
    }

    try {
      CliUI.logInfo(`🗑️ Destroying VM: ${instance.config.name}`);

      if (instance.containerId) {
        await execAsync(`docker stop ${instance.containerId}`);
        await execAsync(`docker rm ${instance.containerId}`);
      }

      instance.status = 'destroyed';
      instance.endTime = new Date();

      this.instances.delete(vmId);

      // Publish event
      await this.eventBus.publish(EventTypes.VM_DESTROYED, { vmId });

      this.emit('vm:destroyed', instance);
      CliUI.logSuccess(`✅ VM destroyed: ${instance.config.name}`);

    } catch (error: any) {
      CliUI.logError(`❌ Failed to destroy VM: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get VM logs
   */
  async getVMLogs(vmId: string): Promise<string[]> {
    const instance = this.instances.get(vmId);
    if (!instance || !instance.containerId) {
      return [];
    }

    try {
      const { stdout } = await execAsync(`docker logs ${instance.containerId}`);
      return stdout.split('\n').filter(line => line.trim());
    } catch (error) {
      return instance.logs;
    }
  }

  /**
   * List all VM instances
   */
  listVMs(): VMInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get VM by ID
   */
  getVM(vmId: string): VMInstance | undefined {
    return this.instances.get(vmId);
  }

  /**
   * Build Docker run command
   */
  private buildDockerRunCommand(config: VMConfig): string[] {
    const args = [
      'run',
      '-d',
      '--name', config.name,
      '--memory', config.memory,
      '--cpus', config.cpu,
      '--workdir', config.workingDirectory
    ];

    // Add ports
    config.ports.forEach(port => {
      args.push('-p', port);
    });

    // Add volumes
    config.volumes.forEach(volume => {
      args.push('-v', volume);
    });

    // Add environment variables
    Object.entries(config.environment).forEach(([key, value]) => {
      args.push('-e', `${key}=${value}`);
    });

    // Add auto-remove flag
    if (config.autoRemove) {
      args.push('--rm');
    }

    args.push(config.image);
    args.push('tail', '-f', '/dev/null'); // Keep container running

    return args;
  }

  /**
   * Start Docker container
   */
  private async startContainer(args: string[]): Promise<string> {
    const { stdout } = await execAsync(`docker ${args.join(' ')}`);
    return stdout.trim();
  }

  /**
   * Get container IP address
   */
  private async getContainerIP(containerId: string): Promise<string> {
    const { stdout } = await execAsync(`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${containerId}`);
    return stdout.trim();
  }

  /**
   * Setup workspace in VM
   */
  private async setupWorkspace(instance: VMInstance): Promise<void> {
    if (!instance.containerId) return;

    const commands = [
      'apt-get update',
      'apt-get install -y git curl wget unzip software-properties-common',
      'mkdir -p /workspace',
      'chmod 755 /workspace'
    ];

    for (const command of commands) {
      await execAsync(`docker exec ${instance.containerId} bash -c "${command}"`);
    }
  }

  /**
   * Clone repository in VM
   */
  private async cloneRepository(instance: VMInstance, repositoryUrl: string): Promise<void> {
    if (!instance.containerId) return;

    const command = `cd /workspace && git clone ${repositoryUrl} .`;
    await execAsync(`docker exec ${instance.containerId} bash -c "${command}"`);
  }

  /**
   * Install VS Code in VM
   */
  private async installVSCode(instance: VMInstance): Promise<void> {
    if (!instance.containerId) return;

    const commands = [
      'wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg',
      'install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/',
      'sh -c \'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list\'',
      'apt-get update',
      'apt-get install -y code'
    ];

    for (const command of commands) {
      await execAsync(`docker exec ${instance.containerId} bash -c "${command}"`);
    }
  }

  /**
   * Execute commands in VM
   */
  private async executeCommands(instance: VMInstance, commands: string[]): Promise<any[]> {
    if (!instance.containerId) return [];

    const results = [];
    for (const command of commands) {
      try {
        const { stdout, stderr } = await execAsync(`docker exec ${instance.containerId} bash -c "${command}"`);
        results.push({ command, stdout, stderr, success: true });
      } catch (error: any) {
        results.push({ command, error: error.message, success: false });
      }
    }
    return results;
  }
}

// Singleton instance
export const vmManager = new VMManager();