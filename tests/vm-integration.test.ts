import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vmManager } from '../src/cli/automation/vm/vm-manager';
import { AutonomousVMAgent } from '../src/cli/automation/agents/autonomous-vm-agent';
import { agentStatusUI } from '../src/cli/ui/agent-status-ui';
import { vmIntegration } from '../src/cli/core/vm-integration';

// Mock Docker commands
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn()
}));

// Mock file system
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn()
}));

describe('VM Integration System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup any created VMs
    const vms = vmManager.listVMs();
    for (const vm of vms) {
      try {
        await vmManager.destroyVM(vm.id);
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('VM Manager', () => {
    it('should create a VM instance', async () => {
      const config = {
        name: 'test-vm',
        memory: '1g',
        cpu: '1'
      };

      const vm = await vmManager.createVM(config);
      
      expect(vm).toBeDefined();
      expect(vm.id).toBeDefined();
      expect(vm.config.name).toContain('test-vm');
      expect(vm.status).toBe('running');
    });

    it('should list VMs', () => {
      const vms = vmManager.listVMs();
      expect(Array.isArray(vms)).toBe(true);
    });

    it('should get VM by ID', async () => {
      const config = { name: 'test-vm' };
      const createdVM = await vmManager.createVM(config);
      
      const vm = vmManager.getVM(createdVM.id);
      expect(vm).toBeDefined();
      expect(vm?.id).toBe(createdVM.id);
    });
  });

  describe('Autonomous VM Agent', () => {
    it('should initialize correctly', async () => {
      const agent = new AutonomousVMAgent('/tmp/test');
      await agent.initialize();
      
      expect(agent.id).toBe('autonomous-vm-agent');
      expect(agent.capabilities).toContain('vm-management');
      expect(agent.status).toBe('available');
    });

    it('should execute autonomous task', async () => {
      const agent = new AutonomousVMAgent('/tmp/test');
      await agent.initialize();

      const task = {
        type: 'custom' as const,
        description: 'Test task',
        commands: ['echo "Hello World"'],
        requirements: {
          vscode: false,
          node: false
        }
      };

      const results = await agent.executeAutonomousTask(task);
      expect(results).toBeDefined();
    });

    it('should get agent status', () => {
      const agent = new AutonomousVMAgent('/tmp/test');
      const status = agent.getStatus();
      
      expect(status.id).toBe('autonomous-vm-agent');
      expect(status.activeVMs).toBe(0);
      expect(status.activeTasks).toBe(0);
    });
  });

  describe('Agent Status UI', () => {
    it('should initialize correctly', () => {
      agentStatusUI.initialize();
      expect(agentStatusUI.getActiveAgents()).toEqual([]);
    });

    it('should update agent status', () => {
      const agentId = 'test-agent';
      const status = {
        name: 'Test Agent',
        type: 'vm-agent' as const,
        status: 'active' as const
      };

      agentStatusUI.updateAgentStatus(agentId, status);
      const agents = agentStatusUI.getActiveAgents();
      
      expect(agents.length).toBe(1);
      expect(agents[0].id).toBe(agentId);
      expect(agents[0].name).toBe('Test Agent');
    });

    it('should remove agent', () => {
      const agentId = 'test-agent';
      agentStatusUI.updateAgentStatus(agentId, {
        name: 'Test Agent',
        type: 'vm-agent' as const,
        status: 'active' as const
      });

      agentStatusUI.removeAgent(agentId);
      const agents = agentStatusUI.getActiveAgents();
      
      expect(agents.length).toBe(0);
    });

    it('should add log entries', () => {
      const agentId = 'test-agent';
      agentStatusUI.updateAgentStatus(agentId, {
        name: 'Test Agent',
        type: 'vm-agent' as const,
        status: 'active' as const
      });

      agentStatusUI.addAgentLog(agentId, 'Test log entry');
      const agents = agentStatusUI.getActiveAgents();
      
      expect(agents[0].logs.length).toBe(1);
      expect(agents[0].logs[0]).toContain('Test log entry');
    });
  });

  describe('VM Integration', () => {
    it('should initialize correctly', async () => {
      await vmIntegration.initialize();
      const status = vmIntegration.getStatus();
      
      expect(status.enabled).toBe(true);
      expect(status.activeVMs).toBe(0);
      expect(status.activeTasks).toBe(0);
    });

    it('should handle repository analysis request', async () => {
      const repositoryUrl = 'https://github.com/test/repo';
      const analysisPrompt = 'analizza la repository e verifica la sicurezza';

      const results = await vmIntegration.handleRepositoryAnalysis(repositoryUrl, analysisPrompt);
      expect(results).toBeDefined();
    });

    it('should handle autonomous task request', async () => {
      const taskDescription = 'Test autonomous task';
      const commands = ['echo "Hello World"', 'ls -la'];

      const results = await vmIntegration.handleAutonomousTask(taskDescription, commands);
      expect(results).toBeDefined();
    });

    it('should update configuration', () => {
      const newConfig = {
        maxConcurrentVMs: 5,
        defaultMemory: '4g'
      };

      vmIntegration.updateConfig(newConfig);
      const status = vmIntegration.getStatus();
      
      expect(status.config.maxConcurrentVMs).toBe(5);
      expect(status.config.defaultMemory).toBe('4g');
    });

    it('should list VMs', () => {
      const vms = vmIntegration.listVMs();
      expect(Array.isArray(vms)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow', async () => {
      // Initialize systems
      await vmIntegration.initialize();
      agentStatusUI.initialize();

      // Create VM agent
      const agent = new AutonomousVMAgent('/tmp/test');
      await agent.initialize();

      // Execute task
      const task = {
        type: 'repository-analysis' as const,
        description: 'Test repository analysis',
        repositoryUrl: 'https://github.com/test/repo',
        commands: ['echo "Analysis completed"'],
        requirements: {
          vscode: false,
          node: false
        }
      };

      const results = await agent.executeAutonomousTask(task);

      // Verify results
      expect(results).toBeDefined();
      expect(agent.getStatus().tasksCompleted).toBeGreaterThan(0);

      // Verify UI updates
      const activeAgents = agentStatusUI.getActiveAgents();
      expect(activeAgents.length).toBeGreaterThan(0);
    });
  });
});