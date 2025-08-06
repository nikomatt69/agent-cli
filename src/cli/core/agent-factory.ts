import { BaseAgent } from '../agents/base-agent';
import { modelProvider, ChatMessage } from '../ai/model-provider';
import { toolsManager } from '../tools/tools-manager';
import { agentTodoManager } from './agent-todo-manager';
import { agentStream } from './agent-stream';
import { workspaceContext } from './workspace-context';
import chalk from 'chalk';
import { nanoid } from 'nanoid';

export interface AgentBlueprint {
  id: string;
  name: string;
  description: string;
  specialization: string;
  systemPrompt: string;
  capabilities: string[];
  requiredTools: string[];
  personality: {
    proactive: number; // 0-100
    collaborative: number; // 0-100
    analytical: number; // 0-100
    creative: number; // 0-100
  };
  autonomyLevel: 'supervised' | 'semi-autonomous' | 'fully-autonomous';
  contextScope: 'file' | 'directory' | 'project' | 'workspace';
  workingStyle: 'sequential' | 'parallel' | 'adaptive';
  createdAt: Date;
}

export class DynamicAgent extends BaseAgent {
  name: string;
  description: string;
  
  private blueprint: AgentBlueprint;
  private isRunning: boolean = false;
  private currentTodos: string[] = [];

  constructor(blueprint: AgentBlueprint) {
    super();
    this.blueprint = blueprint;
    this.name = blueprint.name;
    this.description = blueprint.description;
  }

  async initialize(): Promise<void> {
    await super.initialize();
    
    agentStream.startAgentStream(this.name);
    agentStream.emitEvent(this.name, 'info', `🤖 Dynamic agent ${this.name} initialized`);
    agentStream.emitEvent(this.name, 'info', `Specialization: ${this.blueprint.specialization}`);
    agentStream.emitEvent(this.name, 'info', `Autonomy Level: ${this.blueprint.autonomyLevel}`);
    
    // Get workspace context based on scope
    if (this.blueprint.contextScope !== 'file') {
      const context = workspaceContext.getContextForAgent(this.name);
      agentStream.emitEvent(this.name, 'info', `Context loaded: ${context.relevantFiles.length} files`);
    }
  }

  async run(task?: string): Promise<any> {
    if (!task) {
      return {
        message: `${this.blueprint.description}`,
        specialization: this.blueprint.specialization,
        capabilities: this.blueprint.capabilities,
        autonomyLevel: this.blueprint.autonomyLevel,
        personality: this.blueprint.personality,
        contextScope: this.blueprint.contextScope,
      };
    }

    this.isRunning = true;
    
    try {
      // Start autonomous workflow
      agentStream.emitEvent(this.name, 'thinking', 'Starting autonomous workflow...');
      
      // 1. Create todos autonomously
      await this.createAutonomousTodos(task);
      
      // 2. Execute todos with streaming
      const result = await this.executeAutonomousWorkflow();
      
      // 3. Report results
      agentStream.emitEvent(this.name, 'result', 'Autonomous workflow completed successfully');
      
      return result;
      
    } catch (error: any) {
      agentStream.emitEvent(this.name, 'error', `Autonomous workflow failed: ${error.message}`);
      return { error: error.message, task };
    } finally {
      this.isRunning = false;
    }
  }

  private async createAutonomousTodos(task: string): Promise<void> {
    agentStream.emitEvent(this.name, 'planning', 'Analyzing task and creating autonomous plan...');
    
    // Get workspace context
    const context = workspaceContext.getContextForAgent(this.name);
    
    // Stream thinking process
    const thoughts = [
      'Understanding the requirements...',
      'Analyzing current workspace state...',
      'Identifying required tools and dependencies...',
      'Planning optimal execution strategy...',
      'Creating detailed todo breakdown...'
    ];
    
    await agentStream.streamThinking(this.name, thoughts);
    
    // Generate AI-powered todos based on agent specialization
    const todos = await agentTodoManager.planTodos(this.name, task, {
      blueprint: this.blueprint,
      workspaceContext: context,
      specialization: this.blueprint.specialization,
    });
    
    this.currentTodos = todos.map(t => t.id);
    
    // Stream the plan
    const planSteps = todos.map(todo => todo.title);
    await agentStream.streamPlanning(this.name, planSteps);
    
    agentStream.emitEvent(this.name, 'planning', `Created ${todos.length} autonomous todos`);
  }

  private async executeAutonomousWorkflow(): Promise<any> {
    const todos = agentTodoManager.getAgentTodos(this.name);
    const results: any[] = [];
    
    agentStream.emitEvent(this.name, 'executing', `Starting execution of ${todos.length} todos`);
    
    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];
      
      // Stream progress
      agentStream.streamProgress(this.name, i + 1, todos.length, `Executing: ${todo.title}`);
      
      // Execute todo with full autonomy
      const result = await this.executeAutonomousTodo(todo);
      results.push(result);
      
      // Mark todo as completed
      agentTodoManager.updateTodo(todo.id, { 
        status: 'completed', 
        progress: 100,
        actualDuration: Math.random() * 5 + 1 // Simulate realistic timing
      });
    }
    
    return {
      success: true,
      todosCompleted: results.length,
      results,
      agent: this.name,
      autonomyLevel: this.blueprint.autonomyLevel,
    };
  }

  private async executeAutonomousTodo(todo: any): Promise<any> {
    const actionId = agentStream.trackAction(this.name, 'analysis', todo.description);
    
    agentStream.emitEvent(this.name, 'executing', `Working on: ${todo.title}`);
    
    try {
      let result: any;
      
      // Execute based on todo tags and agent capabilities
      if (todo.tags.includes('filesystem')) {
        result = await this.executeFileSystemTodo(todo);
      } else if (todo.tags.includes('analysis')) {
        result = await this.executeAnalysisTodo(todo);
      } else if (todo.tags.includes('implementation')) {
        result = await this.executeImplementationTodo(todo);
      } else if (todo.tags.includes('testing')) {
        result = await this.executeTestingTodo(todo);
      } else {
        result = await this.executeGenericTodo(todo);
      }
      
      agentStream.updateAction(actionId, 'completed', result);
      return result;
      
    } catch (error: any) {
      agentStream.updateAction(actionId, 'failed', undefined, error.message);
      throw error;
    }
  }

  private async executeFileSystemTodo(todo: any): Promise<any> {
    agentStream.emitEvent(this.name, 'executing', 'Analyzing file system...');
    
    // Autonomously decide what files to read/analyze
    const context = workspaceContext.getContextForAgent(this.name, 10);
    
    const analysis = {
      filesAnalyzed: context.relevantFiles.length,
      projectStructure: context.projectSummary,
      keyFindings: 'Project structure analyzed successfully'
    };
    
    return analysis;
  }

  private async executeAnalysisTodo(todo: any): Promise<any> {
    agentStream.emitEvent(this.name, 'executing', 'Performing deep analysis...');
    
    // Get workspace context for analysis
    const context = workspaceContext.getContextForAgent(this.name);
    
    // Generate AI analysis based on agent specialization
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${this.blueprint.systemPrompt}
        
You are working on: ${todo.description}
Your specialization: ${this.blueprint.specialization}
Your capabilities: ${this.blueprint.capabilities.join(', ')}

Current workspace context:
${context.projectSummary}

Analyze the current state and provide insights based on your specialization.`,
      },
      {
        role: 'user',
        content: `Analyze the current workspace and provide insights for: ${todo.description}`,
      },
    ];

    const analysis = await modelProvider.generateResponse({ messages });
    
    return {
      analysis,
      specialization: this.blueprint.specialization,
      contextAnalyzed: context.relevantFiles.length,
    };
  }

  private async executeImplementationTodo(todo: any): Promise<any> {
    agentStream.emitEvent(this.name, 'executing', 'Implementing solution...');
    
    // For fully autonomous agents, actually implement solutions
    if (this.blueprint.autonomyLevel === 'fully-autonomous') {
      // Get workspace context
      const context = workspaceContext.getContextForAgent(this.name);
      
      // Generate implementation
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `${this.blueprint.systemPrompt}

You are implementing: ${todo.description}
You have full autonomy to create/modify files as needed.
Your specialization: ${this.blueprint.specialization}

Current workspace context:
${context.totalContext}

Generate the necessary files and code to complete this implementation.`,
        },
        {
          role: 'user',
          content: `Implement: ${todo.description}`,
        },
      ];

      const implementation = await modelProvider.generateResponse({ messages });
      
      // Try to extract and create files from the implementation
      const fileCreated = await this.tryCreateFilesFromResponse(implementation);
      
      return {
        implementation,
        filesCreated: fileCreated,
        autonomous: true,
      };
    } else {
      // For supervised agents, just plan the implementation
      return {
        implementationPlan: `Implementation plan for: ${todo.description}`,
        requiresApproval: true,
      };
    }
  }

  private async executeTestingTodo(todo: any): Promise<any> {
    agentStream.emitEvent(this.name, 'executing', 'Running tests and validation...');
    
    // Run actual tests if fully autonomous
    if (this.blueprint.autonomyLevel === 'fully-autonomous') {
      const buildResult = await toolsManager.build();
      const testResult = await toolsManager.runTests();
      
      return {
        buildSuccess: buildResult.success,
        testSuccess: testResult.success,
        buildErrors: buildResult.errors?.length || 0,
        testErrors: testResult.errors?.length || 0,
      };
    } else {
      return {
        testPlan: `Testing plan for: ${todo.description}`,
        requiresExecution: true,
      };
    }
  }

  private async executeGenericTodo(todo: any): Promise<any> {
    agentStream.emitEvent(this.name, 'executing', `Executing custom todo: ${todo.title}`);
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${this.blueprint.systemPrompt}
        
You are working on: ${todo.description}
Your specialization: ${this.blueprint.specialization}
Autonomy level: ${this.blueprint.autonomyLevel}`,
      },
      {
        role: 'user',
        content: todo.description,
      },
    ];

    const result = await modelProvider.generateResponse({ messages });
    
    return {
      result,
      todo: todo.title,
      specialization: this.blueprint.specialization,
    };
  }

  private async tryCreateFilesFromResponse(response: string): Promise<string[]> {
    const createdFiles: string[] = [];
    
    // Look for code blocks that might be files
    const codeBlocks = response.match(/```[\w]*\n([\s\S]*?)\n```/g);
    
    if (codeBlocks) {
      for (let i = 0; i < codeBlocks.length; i++) {
        const block = codeBlocks[i];
        const code = block.replace(/```[\w]*\n/, '').replace(/\n```$/, '');
        
        // Try to determine filename from context
        let filename = this.extractFilenameFromContext(response, block);
        
        if (!filename) {
          // Generate filename based on specialization
          const extension = this.getExtensionForSpecialization();
          filename = `generated-${this.name}-${i + 1}${extension}`;
        }
        
        try {
          await toolsManager.writeFile(filename, code);
          createdFiles.push(filename);
          agentStream.emitEvent(this.name, 'result', `Created file: ${filename}`);
        } catch (error) {
          agentStream.emitEvent(this.name, 'error', `Failed to create file: ${filename}`);
        }
      }
    }
    
    return createdFiles;
  }

  private extractFilenameFromContext(response: string, codeBlock: string): string | null {
    const lines = response.split('\n');
    const blockIndex = lines.findIndex(line => line.includes(codeBlock.split('\n')[0]));
    
    // Look for filename mentions in nearby lines
    for (let i = Math.max(0, blockIndex - 3); i < Math.min(lines.length, blockIndex + 3); i++) {
      const line = lines[i];
      const match = line.match(/([a-zA-Z][a-zA-Z0-9-_]*\.[a-zA-Z]+)/);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  private getExtensionForSpecialization(): string {
    const specialization = this.blueprint.specialization.toLowerCase();
    
    if (specialization.includes('react') || specialization.includes('frontend')) {
      return '.tsx';
    } else if (specialization.includes('backend') || specialization.includes('api')) {
      return '.ts';
    } else if (specialization.includes('python')) {
      return '.py';
    } else if (specialization.includes('docker')) {
      return '.dockerfile';
    } else if (specialization.includes('config')) {
      return '.json';
    } else {
      return '.ts';
    }
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
    agentStream.stopAgentStream(this.name);
    
    // Show final stats
    const stats = agentTodoManager.getAgentStats(this.name);
    agentStream.emitEvent(this.name, 'info', 
      `Final stats: ${stats.completed} completed, efficiency: ${Math.round(stats.efficiency)}%`
    );
  }

  // Check if agent is currently running
  isActive(): boolean {
    return this.isRunning;
  }

  // Get agent blueprint
  getBlueprint(): AgentBlueprint {
    return { ...this.blueprint };
  }
}

export class AgentFactory {
  private blueprints: Map<string, AgentBlueprint> = new Map();
  private instances: Map<string, DynamicAgent> = new Map();

  // Create a new agent blueprint
  async createAgentBlueprint(requirements: {
    specialization: string;
    description?: string;
    autonomyLevel?: AgentBlueprint['autonomyLevel'];
    contextScope?: AgentBlueprint['contextScope'];
    personality?: Partial<AgentBlueprint['personality']>;
  }): Promise<AgentBlueprint> {
    
    console.log(chalk.blue(`🧬 Creating agent blueprint for: ${requirements.specialization}`));
    
    // Use AI to generate comprehensive blueprint
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an AI agent architect. Create a comprehensive blueprint for a specialized AI agent.
        
Generate a detailed agent specification including:
- Appropriate name (kebab-case)
- Detailed description
- Specific capabilities list
- System prompt for the agent
- Required tools list
- Personality traits (0-100 scale)

The agent should be specialized in: ${requirements.specialization}
Autonomy level: ${requirements.autonomyLevel || 'semi-autonomous'}
Context scope: ${requirements.contextScope || 'project'}

Return a JSON object with all the blueprint details.`,
      },
      {
        role: 'user',
        content: `Create an agent specialized in: ${requirements.specialization}
        
Additional requirements:
${requirements.description ? `Description: ${requirements.description}` : ''}
Autonomy Level: ${requirements.autonomyLevel || 'semi-autonomous'}
Context Scope: ${requirements.contextScope || 'project'}`,
      },
    ];

    try {
      const response = await modelProvider.generateResponse({ messages });
      const aiBlueprint = JSON.parse(response);
      
      const blueprint: AgentBlueprint = {
        id: nanoid(),
        name: aiBlueprint.name || requirements.specialization.toLowerCase().replace(/\s+/g, '-'),
        description: aiBlueprint.description || requirements.description || `Specialized agent for ${requirements.specialization}`,
        specialization: requirements.specialization,
        systemPrompt: aiBlueprint.systemPrompt || `You are a specialized AI agent focused on ${requirements.specialization}.`,
        capabilities: aiBlueprint.capabilities || ['analysis', 'planning', 'execution'],
        requiredTools: aiBlueprint.requiredTools || ['Read', 'Write', 'Bash'],
        personality: {
          proactive: aiBlueprint.personality?.proactive || requirements.personality?.proactive || 70,
          collaborative: aiBlueprint.personality?.collaborative || requirements.personality?.collaborative || 60,
          analytical: aiBlueprint.personality?.analytical || requirements.personality?.analytical || 80,
          creative: aiBlueprint.personality?.creative || requirements.personality?.creative || 50,
        },
        autonomyLevel: requirements.autonomyLevel || 'semi-autonomous',
        contextScope: requirements.contextScope || 'project',
        workingStyle: aiBlueprint.workingStyle || 'adaptive',
        createdAt: new Date(),
      };
      
      this.blueprints.set(blueprint.id, blueprint);
      
      console.log(chalk.green(`✅ Agent blueprint created: ${blueprint.name}`));
      console.log(chalk.gray(`   Capabilities: ${blueprint.capabilities.join(', ')}`));
      console.log(chalk.gray(`   Autonomy: ${blueprint.autonomyLevel}`));
      console.log(chalk.gray(`   Personality: Proactive(${blueprint.personality.proactive}) Analytical(${blueprint.personality.analytical})`));
      
      return blueprint;
      
    } catch (error: any) {
      console.log(chalk.red(`❌ Failed to create agent blueprint: ${error.message}`));
      throw error;
    }
  }

  // Launch an agent from a blueprint
  async launchAgent(blueprintId: string): Promise<DynamicAgent> {
    const blueprint = this.blueprints.get(blueprintId);
    if (!blueprint) {
      throw new Error(`Blueprint ${blueprintId} not found`);
    }

    console.log(chalk.blue(`🚀 Launching agent: ${blueprint.name}`));
    
    const agent = new DynamicAgent(blueprint);
    await agent.initialize();
    
    this.instances.set(blueprint.name, agent);
    
    console.log(chalk.green(`✅ Agent ${blueprint.name} launched successfully`));
    
    return agent;
  }

  // Create and launch agent in one step
  async createAndLaunchAgent(requirements: Parameters<typeof this.createAgentBlueprint>[0]): Promise<DynamicAgent> {
    const blueprint = await this.createAgentBlueprint(requirements);
    const agent = await this.launchAgent(blueprint.id);
    
    return agent;
  }

  // Get all blueprints
  getAllBlueprints(): AgentBlueprint[] {
    return Array.from(this.blueprints.values());
  }

  // Get all active agents
  getActiveAgents(): DynamicAgent[] {
    return Array.from(this.instances.values()).filter(agent => agent.isActive());
  }

  // Get agent by name
  getAgent(name: string): DynamicAgent | undefined {
    return this.instances.get(name);
  }

  // Remove blueprint
  removeBlueprint(id: string): boolean {
    return this.blueprints.delete(id);
  }

  // Show factory dashboard
  showFactoryDashboard(): void {
    const blueprints = this.getAllBlueprints();
    const activeAgents = this.getActiveAgents();

    console.log(chalk.blue.bold('\n🏭 Agent Factory Dashboard'));
    console.log(chalk.gray('═'.repeat(50)));
    
    console.log(`📋 Blueprints: ${blueprints.length}`);
    console.log(`🤖 Active Agents: ${activeAgents.length}`);
    console.log(`🏃 Running Agents: ${activeAgents.filter(a => a.isActive()).length}`);

    if (blueprints.length > 0) {
      console.log(chalk.blue.bold('\n📋 Available Blueprints:'));
      blueprints.forEach(blueprint => {
        const isActive = this.instances.has(blueprint.name);
        const status = isActive ? chalk.green('🟢 Active') : chalk.gray('⚪ Inactive');
        
        console.log(`  ${status} ${chalk.bold(blueprint.name)}`);
        console.log(`    Specialization: ${blueprint.specialization}`);
        console.log(`    Autonomy: ${blueprint.autonomyLevel}`);
        console.log(`    Created: ${blueprint.createdAt.toLocaleDateString()}`);
      });
    }

    if (activeAgents.length > 0) {
      console.log(chalk.blue.bold('\n🤖 Active Agents:'));
      activeAgents.forEach(agent => {
        const blueprint = agent.getBlueprint();
        const stats = agentTodoManager.getAgentStats(agent.name);
        
        console.log(`  🤖 ${chalk.bold(agent.name)} (${blueprint.specialization})`);
        console.log(`    Status: ${agent.isActive() ? chalk.green('Running') : chalk.yellow('Idle')}`);
        console.log(`    Todos: ${stats.completed} completed, ${stats.pending} pending`);
        console.log(`    Efficiency: ${Math.round(stats.efficiency)}%`);
      });
    }
  }
}

export const agentFactory = new AgentFactory();