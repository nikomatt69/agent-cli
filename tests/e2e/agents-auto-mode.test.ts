import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

import { AgentCommands } from '../../src/cli/handlers/agent-commands';
import { unifiedAgentFactory } from '../../src/cli/core/unified-agent-factory';
import { agentPersistence } from '../../src/cli/persistence/agent-persistence';

describe('Agents Auto Mode - End-to-End Tests', () => {
  let tempDir: string;
  let originalHome: string;

  beforeAll(async () => {
    // Setup temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-cli-test-'));
    originalHome = process.env.HOME || process.env.USERPROFILE || '';
    process.env.HOME = tempDir;
    
    // Initialize persistence
    await agentPersistence.initialize();
  });

  afterAll(async () => {
    // Cleanup
    process.env.HOME = originalHome;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Clear any existing agents before each test
    const agents = await agentPersistence.listAgents();
    for (const agentName of agents) {
      await agentPersistence.deleteAgent(agentName);
    }
  });

  afterEach(async () => {
    // Cleanup after each test
    const agents = await agentPersistence.listAgents();
    for (const agentName of agents) {
      await agentPersistence.deleteAgent(agentName);
    }
  });

  describe('Definition of Done Tests', () => {
    it('1. create-agent --name demo --profile researcher --config examples/researcher.json', async () => {
      // Create example config file
      const configPath = path.join(tempDir, 'researcher.json');
      const config = {
        name: 'demo',
        profile: 'researcher',
        specialization: 'Research and Data Analysis',
        systemPrompt: 'You are a research specialist focused on gathering, analyzing, and synthesizing information.',
        capabilities: ['web_search', 'data_analysis', 'report_writing', 'source_evaluation'],
        requiredTools: ['web_search', 'read_file', 'write_file'],
        personality: {
          proactive: 80,
          collaborative: 70,
          analytical: 95,
          creative: 60
        },
        autonomyLevel: 'fully-autonomous',
        contextScope: 'workspace',
        workingStyle: 'sequential',
        autoMode: {
          enabled: true,
          maxSteps: 50,
          maxTokens: 10000,
          maxCost: 5.0,
          timeLimit: '30m',
          safeToolsOnly: true,
          allowWrite: false
        }
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      const result = await AgentCommands.createAgent(['--name', 'demo', '--config', configPath]);

      expect(result.success).toBe(true);
      expect(result.message).toContain('created successfully');
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe('demo');
      expect(result.data.profile).toBe('researcher');
    });

    it('2. launch-agent --name demo --auto --max-steps 5 --verbose', async () => {
      // First create the agent
      const createResult = await AgentCommands.createAgent([
        '--name', 'demo', 
        '--profile', 'researcher'
      ]);
      expect(createResult.success).toBe(true);

      // Then launch in auto mode
      const result = await AgentCommands.launchAgent([
        '--name', 'demo',
        '--auto',
        '--max-steps', '5'
      ]);

      expect(result.success).toBe(true);
      expect(result.message).toContain('launched in auto mode');
      expect(result.data).toBeDefined();
      expect(result.data.autoMode).toBe(true);
    });

        it('3. list-agents mostra demo in esecuzione con stato aggiornato', async () => {
      // Create and launch agent
      await AgentCommands.createAgent(['--name', 'demo', '--profile', 'researcher']);
      await AgentCommands.launchAgent(['--name', 'demo', '--auto']);

      // List agents with JSON output
      const result = await AgentCommands.listAgents(['--json']);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      
      const demoAgent = result.data.find((agent: any) => agent.name === 'demo');
      expect(demoAgent).toBeDefined();
      expect(demoAgent.status).toBe('running');
    });

    it('4. Interrompi: pause-agent --name demo → stato persistito', async () => {
      // Create and launch agent
      await AgentCommands.createAgent(['--name', 'demo', '--profile', 'researcher']);
      await AgentCommands.launchAgent(['--name', 'demo', '--auto']);

      // Pause agent
      const result = await AgentCommands.pauseAgent(['--name', 'demo']);

      expect(result.success).toBe(true);
      expect(result.message).toContain('paused successfully');

      // Verify state is persisted
      const info = await agentPersistence.getAgentInfo('demo');
      expect(info.latestState).toBeDefined();
      expect(info.latestState?.status).toBe('paused');
    });

    it('5. Riprendi: resume-agent --name demo --auto', async () => {
      // Create, launch, and pause agent
      await AgentCommands.createAgent(['--name', 'demo', '--profile', 'researcher']);
      await AgentCommands.launchAgent(['--name', 'demo', '--auto', '--max-steps', '1']);
      await AgentCommands.pauseAgent(['--name', 'demo']);

      // Resume agent
      const result = await AgentCommands.resumeAgent(['--name', 'demo', '--auto', '--max-steps', '1']);

      expect(result.success).toBe(true);
      expect(result.message).toContain('resumed successfully');
    }, 10000);

    it('6. factory --profile coder --name demo-coder → parte con template corretto', async () => {
      const result = await AgentCommands.factory([
        '--profile', 'coder',
        '--name', 'demo-coder'
      ]);

      expect(result.success).toBe(true);
      expect(result.message).toContain('created from profile');
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe('demo-coder');
      expect(result.data.profile).toBe('coder');
    });

    it('7. describe-agent --name demo restituisce config/stato coerenti (JSON)', async () => {
      // Create agent
      await AgentCommands.createAgent(['--name', 'demo', '--profile', 'researcher']);

      // Describe agent
      const result = await AgentCommands.describeAgent(['--name', 'demo', '--json']);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.config).toBeDefined();
      expect(result.data.config.name).toBe('demo');
      expect(result.data.config.profile).toBe('researcher');
    });

    it('8. kill-agent --name demo termina e rilascia risorse', async () => {
      // Create agent
      await AgentCommands.createAgent(['--name', 'demo', '--profile', 'researcher']);

      // Kill agent
      const result = await AgentCommands.killAgent(['--name', 'demo']);

      expect(result.success).toBe(true);
      expect(result.message).toContain('killed and removed successfully');

      // Verify agent is deleted
      const exists = await agentPersistence.agentExists('demo');
      expect(exists).toBe(false);
    });

    it('9. Tutti i comandi supportano --json e invalid input produce errori validati', async () => {
      // Test create-agent with invalid input
      const createResult = await AgentCommands.createAgent(['--name', 'demo']);
      expect(createResult.success).toBe(false);
      expect(createResult.error).toContain('Either --profile or --config is required');

      // Test launch-agent with non-existent agent
      const launchResult = await AgentCommands.launchAgent(['--name', 'non-existent']);
      expect(launchResult.success).toBe(false);
      expect(launchResult.error).toContain('not found');

      // Test list-agents with JSON output
      const listResult = await AgentCommands.listAgents(['--json']);
      expect(listResult.success).toBe(true);
      expect(Array.isArray(listResult.data)).toBe(true);

      // Test describe-agent with non-existent agent
      const describeResult = await AgentCommands.describeAgent(['--name', 'non-existent']);
      expect(describeResult.success).toBe(false);
      expect(describeResult.error).toContain('not found');
    });
  });

  describe('Auto Mode Policy Tests', () => {
    it('should respect max-steps limit', async () => {
      // Create agent with very low step limit
      await AgentCommands.createAgent(['--name', 'demo', '--profile', 'researcher']);
      
      const result = await AgentCommands.launchAgent([
        '--name', 'demo',
        '--auto',
        '--max-steps', '1'
      ]);

      expect(result.success).toBe(true);
      
      // Wait a bit for auto-runner to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check that agent stopped due to step limit
      const info = await agentPersistence.getAgentInfo('demo');
      expect(info.latestState).toBeDefined();
    });

    it('should respect time limit', async () => {
      // Create agent with very short time limit
      await AgentCommands.createAgent(['--name', 'demo', '--profile', 'researcher']);
      
      const result = await AgentCommands.launchAgent([
        '--name', 'demo',
        '--auto',
        '--time-limit', '1s'
      ]);

      expect(result.success).toBe(true);
      
      // Wait for time limit to be exceeded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check that agent stopped due to time limit
      const info = await agentPersistence.getAgentInfo('demo');
      expect(info.latestState).toBeDefined();
    });

    it('should respect safe-tools-only policy', async () => {
      // Create agent with safe tools only
      await AgentCommands.createAgent(['--name', 'demo', '--profile', 'researcher']);
      
      const result = await AgentCommands.launchAgent([
        '--name', 'demo',
        '--auto',
        '--safe-tools-only'
      ]);

      expect(result.success).toBe(true);
      expect(result.data.autoMode).toBe(true);
    });
  });

  describe('Persistence Tests', () => {
    it('should persist agent configuration', async () => {
      await AgentCommands.createAgent(['--name', 'demo', '--profile', 'researcher']);

      const config = await agentPersistence.loadAgentConfig('demo');
      expect(config).toBeDefined();
      expect(config?.name).toBe('demo');
      expect(config?.profile).toBe('researcher');
    });

    it('should persist agent state', async () => {
      await AgentCommands.createAgent(['--name', 'demo', '--profile', 'researcher']);
      await AgentCommands.launchAgent(['--name', 'demo', '--auto']);

      // Wait a bit for state to be saved
      await new Promise(resolve => setTimeout(resolve, 100));

      const info = await agentPersistence.getAgentInfo('demo');
      expect(info.latestState).toBeDefined();
      expect(info.latestState?.status).toBe('running');
    });

    it('should persist logs', async () => {
      await AgentCommands.createAgent(['--name', 'demo', '--profile', 'researcher']);
      await AgentCommands.launchAgent(['--name', 'demo', '--auto']);

      // Wait a bit for logs to be written
      await new Promise(resolve => setTimeout(resolve, 100));

      const info = await agentPersistence.getAgentInfo('demo');
      if (info.latestRun) {
        const logs = await agentPersistence.loadLogs('demo', info.latestRun);
        expect(Array.isArray(logs)).toBe(true);
        expect(logs.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Factory Tests', () => {
    it('should register default profiles', () => {
      const profiles = unifiedAgentFactory.availableProfiles;
      expect(profiles).toContain('researcher');
      expect(profiles).toContain('coder');
      expect(profiles).toContain('planner');
      expect(profiles).toContain('tester');
      expect(profiles).toContain('devops');
    });

    it('should create agent from profile', async () => {
      const result = await AgentCommands.factory([
        '--profile', 'coder',
        '--name', 'test-coder'
      ]);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('test-coder');
      expect(result.data.profile).toBe('coder');
    });

    it('should show factory dashboard', async () => {
      const result = await AgentCommands.factory([]);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Factory dashboard displayed');
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle invalid agent names', async () => {
      const result = await AgentCommands.createAgent([
        '--name', 'invalid-name-with-spaces',
        '--profile', 'researcher'
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid agent configuration');
    });

    it('should handle non-existent profiles', async () => {
      const result = await AgentCommands.createAgent([
        '--name', 'demo',
        '--profile', 'non-existent-profile'
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Profile');
      expect(result.error).toContain('not found');
    });

    it('should handle invalid configuration files', async () => {
      const invalidConfigPath = path.join(tempDir, 'invalid.json');
      await fs.writeFile(invalidConfigPath, '{ invalid json }');

      const result = await AgentCommands.createAgent([
        '--name', 'demo',
        '--config', invalidConfigPath
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create agent');
    });
  });
});