import { EventEmitter } from 'events';
import chalk from 'chalk';
import { nanoid } from 'nanoid';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { agentPersistence, AgentConfig } from '../persistence/agent-persistence';
import { AutoRunner, AutoModePolicy } from '../automation/agents/auto-runner';
import { BaseAgent } from '../automation/agents/base-agent';
import { UniversalAgent } from '../automation/agents/universal-agent';
import { CodingAgent } from '../automation/agents/coding-agent';
import { ReactAgent } from '../automation/agents/react-agent';
import { BackendAgent } from '../automation/agents/backend-agent';
import { DevOpsAgent } from '../automation/agents/devops-agent';
import { AIAnalysisAgent } from '../automation/agents/ai-agent';
import { CodeReviewAgent } from '../automation/agents/code-review-agent';
import { OptimizationAgent } from '../automation/agents/optimization-agent';
import { SystemAdminAgent } from '../automation/agents/system-admin-agent';
import { FrontendAgent } from '../automation/agents/frontend-agent';

// Schema di validazione
import agentConfigSchema from '../schemas/agent-config.schema.json';

export interface AgentProfile {
  name: string;
  description: string;
  specialization: string;
  systemPrompt: string;
  capabilities: string[];
  requiredTools: string[];
  personality: {
    proactive: number;
    collaborative: number;
    analytical: number;
    creative: number;
  };
  defaultConfig: Partial<AgentConfig>;
}

export interface AgentBuilder {
  (config: AgentConfig, workingDirectory?: string): BaseAgent;
}

export interface AgentInstance {
  agent: BaseAgent;
  config: AgentConfig;
  autoRunner?: AutoRunner;
  status: 'created' | 'running' | 'paused' | 'stopped' | 'error';
}

export class UnifiedAgentFactory extends EventEmitter {
  private profiles = new Map<string, AgentProfile>();
  private builders = new Map<string, AgentBuilder>();
  private instances = new Map<string, AgentInstance>();
  private validator: Ajv;

  constructor() {
    super();
    
    // Inizializza validatore JSON Schema
    this.validator = new Ajv({ allErrors: true });
    addFormats(this.validator);
    this.validator.addSchema(agentConfigSchema, 'agent-config');

    // Registra profili predefiniti
    this.registerDefaultProfiles();
  }

  /**
   * Registra un profilo di agente
   */
  registerProfile(name: string, profile: AgentProfile, builder: AgentBuilder): void {
    this.profiles.set(name, profile);
    this.builders.set(name, builder);
    
    this.emit('profile.registered', { name, profile });
  }

  /**
   * Crea un agente da configurazione
   */
  async createAgent(config: AgentConfig, workingDirectory?: string): Promise<AgentInstance> {
    // Valida la configurazione
    this.validateConfig(config);

    // Verifica che il profilo esista
    if (!this.profiles.has(config.profile)) {
      throw new Error(`Profile '${config.profile}' not found. Available profiles: ${Array.from(this.profiles.keys()).join(', ')}`);
    }

    // Crea l'agente usando il builder appropriato
    const builder = this.builders.get(config.profile)!;
    const agent = builder(config, workingDirectory);

    // Inizializza l'agente
    await agent.initialize();

    // Crea l'istanza
    const instance: AgentInstance = {
      agent,
      config,
      status: 'created'
    };

    // Salva la configurazione
    await agentPersistence.saveAgentConfig(config.name, config);

    // Registra l'istanza
    this.instances.set(config.name, instance);

    this.emit('agent.created', { name: config.name, config });
    
    return instance;
  }

  /**
   * Crea un agente da profilo con override
   */
  async createAgentFromProfile(
    profileName: string, 
    agentName: string, 
    overrides?: Partial<AgentConfig>
  ): Promise<AgentInstance> {
    const profile = this.profiles.get(profileName);
    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    const config: AgentConfig = {
      name: agentName,
      profile: profileName,
      specialization: profile.specialization,
      systemPrompt: profile.systemPrompt,
      capabilities: profile.capabilities,
      requiredTools: profile.requiredTools,
      personality: profile.personality,
      autonomyLevel: 'fully-autonomous',
      contextScope: 'project',
      workingStyle: 'adaptive',
      autoMode: {
        enabled: true,
        maxSteps: 50,
        maxTokens: 10000,
        maxCost: 5.0,
        timeLimit: '30m',
        safeToolsOnly: true,
        allowWrite: false
      },
      ...profile.defaultConfig,
      ...overrides
    };

    return this.createAgent(config);
  }

  /**
   * Avvia un agente in modalità auto
   */
  async launchAgent(
    agentName: string, 
    autoMode: boolean = false,
    policy?: Partial<AutoModePolicy>
  ): Promise<AgentInstance> {
    const instance = this.instances.get(agentName);
    if (!instance) {
      throw new Error(`Agent '${agentName}' not found. Use create-agent first.`);
    }

    if (autoMode) {
      const defaultPolicy: AutoModePolicy = {
        maxSteps: instance.config.autoMode?.maxSteps || 50,
        maxTokens: instance.config.autoMode?.maxTokens || 10000,
        maxCost: instance.config.autoMode?.maxCost || 5.0,
        timeLimit: this.parseTimeLimit(instance.config.autoMode?.timeLimit || '30m'),
        safeToolsOnly: instance.config.autoMode?.safeToolsOnly || true,
        allowWrite: instance.config.autoMode?.allowWrite || false,
        backoffMultiplier: 2,
        maxRetries: 3
      };

      const finalPolicy = { ...defaultPolicy, ...policy };
      const autoRunner = new AutoRunner(instance.agent, instance.config, finalPolicy);
      
      instance.autoRunner = autoRunner;
      instance.status = 'running';

      // Avvia l'esecuzione autonoma
      autoRunner.start();

      this.emit('agent.launched', { name: agentName, autoMode: true, policy: finalPolicy });
    } else {
      instance.status = 'running';
      this.emit('agent.launched', { name: agentName, autoMode: false });
    }

    return instance;
  }

  /**
   * Pausa un agente
   */
  async pauseAgent(agentName: string): Promise<void> {
    const instance = this.instances.get(agentName);
    if (!instance) {
      throw new Error(`Agent '${agentName}' not found`);
    }

    if (instance.autoRunner) {
      await instance.autoRunner.pause();
    }
    
    instance.status = 'paused';
    this.emit('agent.paused', { name: agentName });
  }

  /**
   * Riprende un agente
   */
  async resumeAgent(agentName: string): Promise<void> {
    const instance = this.instances.get(agentName);
    if (!instance) {
      throw new Error(`Agent '${agentName}' not found`);
    }

    if (instance.autoRunner) {
      await instance.autoRunner.resume();
    }
    
    instance.status = 'running';
    this.emit('agent.resumed', { name: agentName });
  }

  /**
   * Ferma un agente
   */
  async stopAgent(agentName: string): Promise<void> {
    const instance = this.instances.get(agentName);
    if (!instance) {
      throw new Error(`Agent '${agentName}' not found`);
    }

    if (instance.autoRunner) {
      await instance.autoRunner.stop();
    }
    
    instance.status = 'stopped';
    this.emit('agent.stopped', { name: agentName });
  }

  /**
   * Elimina un agente
   */
  async deleteAgent(agentName: string): Promise<void> {
    const instance = this.instances.get(agentName);
    if (instance) {
      await this.stopAgent(agentName);
      this.instances.delete(agentName);
    }

    await agentPersistence.deleteAgent(agentName);
    this.emit('agent.deleted', { name: agentName });
  }

  /**
   * Lista tutti gli agenti
   */
  async listAgents(): Promise<Array<{
    name: string;
    profile: string;
    status: string;
    config: AgentConfig | null;
    latestState: any;
  }>> {
    const agentNames = await agentPersistence.listAgents();
    const results = [];

    for (const name of agentNames) {
      const info = await agentPersistence.getAgentInfo(name);
      const instance = this.instances.get(name);
      
      results.push({
        name,
        profile: info.config?.profile || 'unknown',
        status: instance?.status || 'not-loaded',
        config: info.config,
        latestState: info.latestState
      });
    }

    return results;
  }

  /**
   * Ottieni informazioni su un agente
   */
  async describeAgent(agentName: string): Promise<{
    config: AgentConfig | null;
    instance: AgentInstance | null;
    info: any;
  }> {
    const instance = this.instances.get(agentName);
    const info = await agentPersistence.getAgentInfo(agentName);

    return {
      config: info.config,
      instance: instance || null,
      info
    };
  }

  /**
   * Mostra la dashboard della factory
   */
  showFactoryDashboard(): void {
    console.log(chalk.blue.bold('\n🏭 Unified Agent Factory Dashboard'));
    console.log(chalk.gray('─'.repeat(50)));

    // Profili disponibili
    console.log(chalk.cyan('\n📋 Available Profiles:'));
    for (const [name, profile] of this.profiles) {
      console.log(chalk.white(`  • ${name}: ${profile.description}`));
    }

    // Agenti attivi
    console.log(chalk.cyan('\n🤖 Active Agents:'));
    for (const [name, instance] of this.instances) {
      const statusIcon = this.getStatusIcon(instance.status);
      console.log(chalk.white(`  ${statusIcon} ${name} (${instance.config.profile}) - ${instance.status}`));
    }

    console.log(chalk.gray('\nUse /create-agent, /launch-agent, /list-agents for management'));
  }

  /**
   * Valida una configurazione
   */
  private validateConfig(config: AgentConfig): void {
    const valid = this.validator.validate('agent-config', config);
    if (!valid) {
      const errors = this.validator.errorsText();
      throw new Error(`Invalid agent configuration: ${errors}`);
    }
  }

  /**
   * Registra i profili predefiniti
   */
  private registerDefaultProfiles(): void {
    // Researcher Profile
    this.registerProfile('researcher', {
      name: 'researcher',
      description: 'Research and analysis specialist',
      specialization: 'Research and Data Analysis',
      systemPrompt: `You are a research specialist focused on gathering, analyzing, and synthesizing information. 
      You excel at finding relevant data, evaluating sources, and presenting findings clearly.`,
      capabilities: ['web_search', 'data_analysis', 'report_writing', 'source_evaluation'],
      requiredTools: ['web_search', 'read_file', 'write_file'],
      personality: {
        proactive: 80,
        collaborative: 70,
        analytical: 95,
        creative: 60
      },
      defaultConfig: {
        autonomyLevel: 'fully-autonomous',
        contextScope: 'workspace',
        workingStyle: 'sequential'
      }
    }, (config, workingDirectory) => {
      const agent = new UniversalAgent(workingDirectory || process.cwd());
      // Estendi l'agente con le proprietà richieste da BaseAgent
      (agent as any).eventBus = agent['eventBus'] || {};
      (agent as any).toolRegistry = agent['toolRegistry'] || {};
      (agent as any).taskHistory = agent['taskHistory'] || [];
      (agent as any).agentMetrics = agent['agentMetrics'] || {};
      return agent as any;
    });

    // Coder Profile
    this.registerProfile('coder', {
      name: 'coder',
      description: 'Software development and coding expert',
      specialization: 'Software Development',
      systemPrompt: `You are a software development expert with deep knowledge of programming languages, 
      best practices, and software architecture. You excel at writing clean, efficient, and maintainable code.`,
      capabilities: ['code_generation', 'code_review', 'refactoring', 'testing', 'debugging'],
      requiredTools: ['read_file', 'write_file', 'run_command', 'git'],
      personality: {
        proactive: 85,
        collaborative: 75,
        analytical: 90,
        creative: 80
      },
      defaultConfig: {
        autonomyLevel: 'fully-autonomous',
        contextScope: 'project',
        workingStyle: 'adaptive'
      }
    }, (config, workingDirectory) => {
      return new CodingAgent(workingDirectory || process.cwd());
    });

    // Planner Profile
    this.registerProfile('planner', {
      name: 'planner',
      description: 'Strategic planning and project management',
      specialization: 'Strategic Planning',
      systemPrompt: `You are a strategic planner and project manager. You excel at breaking down complex 
      projects into manageable tasks, creating timelines, and coordinating resources.`,
      capabilities: ['project_planning', 'task_breakdown', 'timeline_creation', 'resource_coordination'],
      requiredTools: ['read_file', 'write_file'],
      personality: {
        proactive: 90,
        collaborative: 85,
        analytical: 85,
        creative: 70
      },
      defaultConfig: {
        autonomyLevel: 'semi-autonomous',
        contextScope: 'project',
        workingStyle: 'sequential'
      }
    }, (config, workingDirectory) => {
      const agent = new UniversalAgent(workingDirectory || process.cwd());
      // Estendi l'agente con le proprietà richieste da BaseAgent
      (agent as any).eventBus = agent['eventBus'] || {};
      (agent as any).toolRegistry = agent['toolRegistry'] || {};
      (agent as any).taskHistory = agent['taskHistory'] || [];
      (agent as any).agentMetrics = agent['agentMetrics'] || {};
      return agent as any;
    });

    // Tester Profile
    this.registerProfile('tester', {
      name: 'tester',
      description: 'Quality assurance and testing specialist',
      specialization: 'Quality Assurance',
      systemPrompt: `You are a quality assurance specialist focused on testing, validation, and ensuring 
      software quality. You excel at creating test plans, executing tests, and reporting issues.`,
      capabilities: ['test_planning', 'test_execution', 'bug_reporting', 'quality_assurance'],
      requiredTools: ['read_file', 'write_file', 'run_command'],
      personality: {
        proactive: 75,
        collaborative: 80,
        analytical: 90,
        creative: 65
      },
      defaultConfig: {
        autonomyLevel: 'semi-autonomous',
        contextScope: 'project',
        workingStyle: 'sequential'
      }
    }, (config, workingDirectory) => {
      return new CodeReviewAgent(workingDirectory || process.cwd());
    });

    // DevOps Profile
    this.registerProfile('devops', {
      name: 'devops',
      description: 'DevOps and infrastructure specialist',
      specialization: 'DevOps and Infrastructure',
      systemPrompt: `You are a DevOps specialist focused on automation, infrastructure, and deployment. 
      You excel at CI/CD pipelines, containerization, and infrastructure as code.`,
      capabilities: ['ci_cd', 'containerization', 'infrastructure_as_code', 'monitoring', 'automation'],
      requiredTools: ['run_command', 'read_file', 'write_file', 'docker'],
      personality: {
        proactive: 85,
        collaborative: 80,
        analytical: 85,
        creative: 75
      },
      defaultConfig: {
        autonomyLevel: 'fully-autonomous',
        contextScope: 'project',
        workingStyle: 'parallel'
      }
    }, (config, workingDirectory) => {
      return new DevOpsAgent(workingDirectory || process.cwd());
    });
  }

  /**
   * Converte un limite di tempo in millisecondi
   */
  private parseTimeLimit(timeLimit: string): number {
    const match = timeLimit.match(/^(\d+)([mh])$/);
    if (!match) {
      throw new Error(`Invalid time limit format: ${timeLimit}. Use format like '30m' or '2h'`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    if (unit === 'm') {
      return value * 60 * 1000; // minuti in millisecondi
    } else if (unit === 'h') {
      return value * 60 * 60 * 1000; // ore in millisecondi
    }

    throw new Error(`Unsupported time unit: ${unit}`);
  }

  /**
   * Ottieni l'icona per lo stato
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'running': return '🟢';
      case 'paused': return '🟡';
      case 'stopped': return '🔴';
      case 'error': return '❌';
      default: return '⚪';
    }
  }

  // Getters per accesso pubblico
  get availableProfiles(): string[] {
    return Array.from(this.profiles.keys());
  }

  get activeAgents(): string[] {
    return Array.from(this.instances.keys());
  }
}

// Esporta un'istanza singleton
export const unifiedAgentFactory = new UnifiedAgentFactory();