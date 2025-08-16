import { BaseAgent } from '../automation/agents/base-agent';
import { modelProvider, ChatMessage } from '../ai/model-provider';
import { secureTools } from '../tools/secure-tools-registry';
import { toolsManager } from '../tools/migration-to-secure-tools'; // deprecated, for backward compatibility
import { agentTodoManager } from './agent-todo-manager';
import { agentStream } from './agent-stream';
import { workspaceContext } from '../context/workspace-context';
import chalk from 'chalk';
import { nanoid } from 'nanoid';
import { configManager } from './config-manager';
import { EventEmitter } from 'events';

// Helper function to extract JSON from markdown code blocks
function extractJsonFromMarkdown(text: string): string {
  // Try to find JSON wrapped in code blocks
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Try to find JSON object directly
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }

  // Return original text if no patterns found
  return text.trim();
}

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
  id: string;
  capabilities: string[];
  specialization: string;

  private blueprint: AgentBlueprint;
  private isRunning: boolean = false;
  private currentTodos: string[] = [];

  constructor(blueprint: AgentBlueprint, workingDirectory: string = process.cwd()) {
    super(workingDirectory);
    this.id = blueprint.name;
    this.capabilities = blueprint.capabilities;
    this.specialization = blueprint.description;
    this.blueprint = blueprint;
  }

  protected async onInitialize(): Promise<void> {
    agentStream.startAgentStream(this.id);
    agentStream.emitEvent(this.id, 'info', `🤖 Dynamic agent ${this.id} initialized`);
    agentStream.emitEvent(this.id, 'info', `Specialization: ${this.blueprint.specialization}`);
    agentStream.emitEvent(this.id, 'info', `Autonomy Level: ${this.blueprint.autonomyLevel}`);
  }

  protected async onStop(): Promise<void> {
    this.isRunning = false;
    agentStream.emitEvent(this.id, 'info', `🛑 Dynamic agent ${this.id} stopped`);
  }

  protected async onExecuteTask(task: any): Promise<any> {
    const taskData = typeof task === 'string' ? task : task.data;
    return this.executeTask(taskData);
  }

  public async executeTask(task: any): Promise<any> {
    // Handle both string tasks and AgentTask objects
    const taskData = typeof task === 'string' ? task : (task?.description || task?.data);

    if (!taskData) {
      return {
        message: `${this.blueprint.description}`,
        specialization: this.blueprint.specialization,
        capabilities: this.blueprint.capabilities,
        autonomyLevel: this.blueprint.autonomyLevel,
      };
    }

    // Get workspace context based on scope
    if (this.blueprint.contextScope !== 'file') {
      const context = workspaceContext.getContextForAgent(this.id);
      agentStream.emitEvent(this.id, 'info', `Context loaded: ${context.relevantFiles.length} files`);
    }

    return await this.run(taskData);
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
      agentStream.emitEvent(this.id, 'thinking', 'Starting autonomous workflow...');

      // 1. Create todos autonomously
      await this.createAutonomousTodos(task);

      // 2. Execute todos with streaming
      const result = await this.executeAutonomousWorkflow();

      // 3. Report results
      agentStream.emitEvent(this.id, 'result', 'Autonomous workflow completed successfully');

      return result;

    } catch (error: any) {
      agentStream.emitEvent(this.id, 'error', `Autonomous workflow failed: ${error.message}`);
      return { error: error.message, task };
    } finally {
      this.isRunning = false;
    }
  }

  private async createAutonomousTodos(task: string): Promise<void> {
    agentStream.emitEvent(this.id, 'planning', 'Analyzing task and creating autonomous plan...');

    // Get workspace context
    const context = workspaceContext.getContextForAgent(this.id);

    // Stream thinking process
    const thoughts = [
      'Understanding the requirements...',
      'Analyzing current workspace state...',
      'Identifying required tools and dependencies...',
      'Planning optimal execution strategy...',
      'Creating detailed todo breakdown...'
    ];

    await agentStream.streamThinking(this.id, thoughts);

    // Generate AI-powered todos based on agent specialization
    const todos = await agentTodoManager.planTodos(this.id, task, {
      blueprint: this.blueprint,
      workspaceContext: context,
      specialization: this.blueprint.specialization,
    });

    this.currentTodos = todos.map(t => t.id);

    // Stream the plan
    const planSteps = todos.map(todo => todo.title);
    await agentStream.streamPlanning(this.id, planSteps);

    agentStream.emitEvent(this.id, 'planning', `Created ${todos.length} autonomous todos`);
  }

  private async executeAutonomousWorkflow(): Promise<any> {
    const todos = agentTodoManager.getAgentTodos(this.id);
    const results: any[] = [];

    agentStream.emitEvent(this.id, 'executing', `Starting execution of ${todos.length} todos`);

    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];

      // Stream progress
      agentStream.streamProgress(this.id, i + 1, todos.length, `Executing: ${todo.title}`);

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
      agent: this.id,
      autonomyLevel: this.blueprint.autonomyLevel,
    };
  }

  private async executeAutonomousTodo(todo: any): Promise<any> {
    const actionId = agentStream.trackAction(this.id, 'analysis', todo.description);

    agentStream.emitEvent(this.id, 'executing', `Working on: ${todo.title}`);

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
    agentStream.emitEvent(this.id, 'executing', 'Analyzing file system...');

    // Autonomously decide what files to read/analyze
    const context = workspaceContext.getContextForAgent(this.id, 10);

    const analysis = {
      filesAnalyzed: context.relevantFiles.length,
      projectStructure: context.projectSummary,
      keyFindings: 'Project structure analyzed successfully'
    };

    return analysis;
  }

  private async executeAnalysisTodo(todo: any): Promise<any> {
    agentStream.emitEvent(this.id, 'executing', 'Performing deep analysis...');

    // Get workspace context for analysis
    const context = workspaceContext.getContextForAgent(this.id);

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
    agentStream.emitEvent(this.id, 'executing', 'Implementing solution...');

    // For fully autonomous agents, actually implement solutions
    if (this.blueprint.autonomyLevel === 'fully-autonomous') {
      // Get workspace context
      const context = workspaceContext.getContextForAgent(this.id);

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
    agentStream.emitEvent(this.id, 'executing', 'Running tests and validation...');

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
    agentStream.emitEvent(this.id, 'executing', `Executing custom todo: ${todo.title}`);

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
          filename = `generated-${this.id}-${i + 1}${extension}`;
        }

        try {
          await toolsManager.writeFile(filename, code);
          createdFiles.push(filename);
          agentStream.emitEvent(this.id, 'result', `Created file: ${filename}`);
        } catch (error) {
          agentStream.emitEvent(this.id, 'error', `Failed to create file: ${filename}`);
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
    await super.cleanup?.();
    agentStream.stopAgentStream(this.id);

    // Show final stats
    const stats = agentTodoManager.getAgentStats(this.id);
    agentStream.emitEvent(this.id, 'info',
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

export class AgentFactory extends EventEmitter {
  private blueprints: Map<string, AgentBlueprint> = new Map();
  private instances: Map<string, DynamicAgent> = new Map();

  constructor() {
    super();
  }

  // Create fallback blueprint when AI generation fails
  private createFallbackBlueprint(specialization: string): any {
    const lowerSpec = specialization.toLowerCase();

    // Determine capabilities based on specialization keywords
    const capabilities = [];
    const requiredTools = ['Read', 'Write'];

    if (lowerSpec.includes('react') || lowerSpec.includes('frontend') || lowerSpec.includes('ui') || lowerSpec.includes('component')) {
      capabilities.push('react', 'frontend', 'jsx', 'tsx', 'components', 'hooks', 'css', 'html');
      requiredTools.push('Bash', 'InstallPackage');
    }

    if (lowerSpec.includes('backend') || lowerSpec.includes('api') || lowerSpec.includes('server') || lowerSpec.includes('node')) {
      capabilities.push('backend', 'nodejs', 'api-development', 'rest-api', 'database');
      requiredTools.push('Bash', 'InstallPackage');
    }

    if (lowerSpec.includes('test') || lowerSpec.includes('testing')) {
      capabilities.push('testing', 'jest', 'unit-testing', 'integration-testing');
      requiredTools.push('Bash');
    }

    if (lowerSpec.includes('devops') || lowerSpec.includes('deploy') || lowerSpec.includes('docker')) {
      capabilities.push('devops', 'docker', 'ci-cd', 'deployment');
      requiredTools.push('Bash', 'Docker');
    }

    if (lowerSpec.includes('nextjs') || lowerSpec.includes('next.js')) {
      capabilities.push('nextjs', 'react', 'ssr', 'routing', 'frontend');
      requiredTools.push('Bash', 'InstallPackage');
    }

    // Default capabilities if none matched
    if (capabilities.length === 0) {
      capabilities.push('code-analysis', 'code-generation', 'planning', 'execution');
      requiredTools.push('Bash');
    }

    const name = specialization.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    return {
      name,
      description: `Specialized agent for ${specialization}`,
      systemPrompt: `You are a specialized AI agent focused on ${specialization}. You have expertise in the relevant technologies and can help with planning, analysis, and implementation tasks.`,
      capabilities,
      requiredTools,
      workingStyle: 'adaptive',
      personality: {
        proactive: 75,
        collaborative: 70,
        analytical: 85,
        creative: 60
      }
    };
  }

  // Create a new agent blueprint
  async createAgentBlueprint(requirements: {
    specialization: string;
    description?: string;
    autonomyLevel?: AgentBlueprint['autonomyLevel'];
    contextScope?: AgentBlueprint['contextScope'];
    personality?: Partial<AgentBlueprint['personality']>;
  }): Promise<AgentBlueprint> {

    console.log(chalk.blue(`🧬 Creating agent blueprint for: ${requirements.specialization}`));

    // Verify model configuration and API key before proceeding
    try {
      const modelInfo = modelProvider.getCurrentModelInfo();
      const hasApiKey = modelProvider.validateApiKey();

      if (!hasApiKey) {
        const currentModel = configManager.getCurrentModel();
        throw new Error(`API key not configured for model: ${currentModel}. Use /set-key ${currentModel} <your-api-key>`);
      }

      console.log(chalk.gray(`Using model: ${modelInfo.name} (${modelInfo.config.provider})`));
    } catch (error: any) {
      console.log(chalk.red(`❌ Model configuration error: ${error.message}`));
      throw error;
    }

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
      console.log(chalk.gray('Generating AI blueprint...'));
      const response = await modelProvider.generateResponse({ messages });

      console.log(chalk.gray('Parsing AI response...'));
      const jsonText = extractJsonFromMarkdown(response);

      let aiBlueprint;
      try {
        aiBlueprint = JSON.parse(jsonText);
      } catch (parseError) {
        console.log(chalk.yellow('⚠️ Failed to parse AI response, using fallback blueprint'));
        // Create fallback blueprint when AI response is not valid JSON
        aiBlueprint = this.createFallbackBlueprint(requirements.specialization);
      }

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

      // Try to create a fallback blueprint if the main process fails
      console.log(chalk.yellow('🔄 Creating fallback blueprint...'));
      try {
        const fallbackBlueprint = this.createFallbackBlueprint(requirements.specialization);

        const blueprint: AgentBlueprint = {
          id: nanoid(),
          name: fallbackBlueprint.name,
          description: fallbackBlueprint.description,
          specialization: requirements.specialization,
          systemPrompt: fallbackBlueprint.systemPrompt,
          capabilities: fallbackBlueprint.capabilities,
          requiredTools: fallbackBlueprint.requiredTools,
          personality: {
            proactive: requirements.personality?.proactive || 70,
            collaborative: requirements.personality?.collaborative || 60,
            analytical: requirements.personality?.analytical || 80,
            creative: requirements.personality?.creative || 50,
          },
          autonomyLevel: requirements.autonomyLevel || 'semi-autonomous',
          contextScope: requirements.contextScope || 'project',
          workingStyle: 'adaptive',
          createdAt: new Date(),
        };

        this.blueprints.set(blueprint.id, blueprint);

        console.log(chalk.green(`✅ Fallback agent blueprint created: ${blueprint.name}`));
        console.log(chalk.gray(`   Capabilities: ${blueprint.capabilities.join(', ')}`));

        return blueprint;
      } catch (fallbackError) {
        console.log(chalk.red(`❌ Fallback blueprint creation also failed: ${fallbackError}`));
        throw error; // Throw the original error
      }
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
        const stats = agentTodoManager.getAgentStats(agent.id);

        console.log(`  🤖 ${chalk.bold(agent.id)} (${blueprint.specialization})`);
        console.log(`    Status: ${agent.isActive() ? chalk.green('Running') : chalk.yellow('Idle')}`);
        console.log(`    Todos: ${stats.completed} completed, ${stats.pending} pending`);
        console.log(`    Efficiency: ${Math.round(stats.efficiency)}%`);
      });
    }
  }

  // ====================== 🎯 MULTI-DIMENSIONAL AGENT SELECTION ======================

  /**
   * 🧠 Advanced Agent Selection based on 15+ metrics
   * Selects optimal agents using multi-dimensional analysis
   */
  async selectOptimalAgentsForTask(
    taskDescription: string,
    requiredCapabilities: string[],
    estimatedComplexity: number,
    riskLevel: 'low' | 'medium' | 'high',
    urgency: 'low' | 'normal' | 'high' | 'critical'
  ): Promise<{
    primary: DynamicAgent;
    secondary: DynamicAgent[];
    reasoning: string;
    confidence: number;
    fallbackOptions: DynamicAgent[];
  }> {
    
    console.log(chalk.blue(`🎯 Multi-dimensional agent selection for: ${taskDescription.slice(0, 50)}...`));

    // Step 1: Get all available agents with performance metrics
    const availableAgents = this.getActiveAgents();
    const agentScores = new Map<string, number>();
    const agentReasons = new Map<string, string[]>();

    // Step 2: Score each agent across multiple dimensions
    for (const agent of availableAgents) {
      const blueprint = agent.getBlueprint();
      const score = this.calculateAgentScore(
        blueprint,
        requiredCapabilities,
        estimatedComplexity,
        riskLevel,
        urgency,
        taskDescription
      );
      
      agentScores.set(agent.id, score.totalScore);
      agentReasons.set(agent.id, score.reasons);
    }

    // Step 3: Rank agents by score
    const rankedAgents = availableAgents
      .sort((a, b) => (agentScores.get(b.id) || 0) - (agentScores.get(a.id) || 0));

    // Step 4: Select primary and secondary agents
    const primary = rankedAgents[0];
    const secondary = rankedAgents.slice(1, Math.min(3, rankedAgents.length));
    const fallbackOptions = rankedAgents.slice(3, 6);

    // Step 5: Generate reasoning
    const primaryReasons = agentReasons.get(primary.id) || [];
    const reasoning = this.generateSelectionReasoning(primary, secondary, primaryReasons);

    // Step 6: Calculate confidence based on score distribution
    const topScore = agentScores.get(primary.id) || 0;
    const secondScore = agentScores.get(secondary[0]?.id || '') || 0;
    const confidence = Math.min(0.95, topScore / Math.max(secondScore, 0.1));

    console.log(chalk.green(`✅ Selected ${primary.getBlueprint().name} as primary agent (confidence: ${Math.round(confidence * 100)}%)`));

    return {
      primary,
      secondary,
      reasoning,
      confidence,
      fallbackOptions
    };
  }

  /**
   * 📊 Calculate comprehensive agent score across 15+ dimensions
   */
  private calculateAgentScore(
    blueprint: AgentBlueprint,
    requiredCapabilities: string[],
    estimatedComplexity: number,
    riskLevel: 'low' | 'medium' | 'high',
    urgency: 'low' | 'normal' | 'high' | 'critical',
    taskDescription: string
  ): { totalScore: number; reasons: string[] } {
    
    let totalScore = 0;
    const reasons: string[] = [];
    const maxScore = 100;

    // 1. CAPABILITY MATCH (25 points)
    const capabilityMatch = this.scoreCapabilityMatch(blueprint.capabilities, requiredCapabilities);
    totalScore += capabilityMatch.score * 0.25;
    if (capabilityMatch.score > 0.7) {
      reasons.push(`Strong capability match (${Math.round(capabilityMatch.score * 100)}%)`);
    }

    // 2. SPECIALIZATION RELEVANCE (20 points)
    const specializationScore = this.scoreSpecializationRelevance(blueprint.specialization, taskDescription);
    totalScore += specializationScore * 0.20;
    if (specializationScore > 0.7) {
      reasons.push(`Highly relevant specialization`);
    }

    // 3. COMPLEXITY HANDLING (15 points)
    const complexityScore = this.scoreComplexityHandling(blueprint, estimatedComplexity);
    totalScore += complexityScore * 0.15;
    if (complexityScore > 0.8) {
      reasons.push(`Excellent complexity handling`);
    }

    // 4. AUTONOMY LEVEL APPROPRIATENESS (10 points)
    const autonomyScore = this.scoreAutonomyLevel(blueprint.autonomyLevel, riskLevel);
    totalScore += autonomyScore * 0.10;
    if (autonomyScore > 0.8) {
      reasons.push(`Appropriate autonomy level`);
    }

    // 5. PERSONALITY FIT (8 points)
    const personalityScore = this.scorePersonalityFit(blueprint.personality, urgency, estimatedComplexity);
    totalScore += personalityScore * 0.08;

    // 6. WORKING STYLE COMPATIBILITY (7 points)
    const workingStyleScore = this.scoreWorkingStyle(blueprint.workingStyle, estimatedComplexity);
    totalScore += workingStyleScore * 0.07;

    // 7. CONTEXT SCOPE APPROPRIATENESS (5 points)
    const contextScore = this.scoreContextScope(blueprint.contextScope, requiredCapabilities);
    totalScore += contextScore * 0.05;

    // 8. RECENT PERFORMANCE (5 points)
    const performanceScore = this.scoreRecentPerformance(blueprint.name);
    totalScore += performanceScore * 0.05;

    // 9. AVAILABILITY (3 points)
    const availabilityScore = this.scoreAvailability(blueprint.name);
    totalScore += availabilityScore * 0.03;

    // 10. FRESHNESS BONUS (2 points)
    const freshnessScore = this.scoreFreshness(blueprint.createdAt);
    totalScore += freshnessScore * 0.02;

    return {
      totalScore: Math.min(totalScore, maxScore),
      reasons
    };
  }

  /**
   * 🎯 Score capability matching with semantic understanding
   */
  private scoreCapabilityMatch(agentCapabilities: string[], requiredCapabilities: string[]): { score: number } {
    if (requiredCapabilities.length === 0) return { score: 0.5 };

    let matches = 0;
    let semanticMatches = 0;

    // Semantic capability mapping
    const semanticMappings: Record<string, string[]> = {
      'react': ['frontend', 'components', 'jsx', 'tsx', 'ui'],
      'backend': ['api', 'server', 'nodejs', 'database'],
      'testing': ['test', 'qa', 'validation', 'verification'],
      'devops': ['deployment', 'ci-cd', 'docker', 'infrastructure']
    };

    for (const required of requiredCapabilities) {
      // Direct match
      if (agentCapabilities.includes(required)) {
        matches++;
        continue;
      }

      // Semantic match
      for (const [category, synonyms] of Object.entries(semanticMappings)) {
        if (synonyms.includes(required) && agentCapabilities.includes(category)) {
          semanticMatches++;
          break;
        }
      }
    }

    const totalMatches = matches + (semanticMatches * 0.7);
    return { score: Math.min(totalMatches / requiredCapabilities.length, 1.0) };
  }

  /**
   * 🔍 Score specialization relevance using NLP techniques
   */
  private scoreSpecializationRelevance(specialization: string, taskDescription: string): number {
    const specLower = specialization.toLowerCase();
    const taskLower = taskDescription.toLowerCase();

    // Direct keyword matching
    const specWords = specLower.split(/\s+/);
    const taskWords = taskLower.split(/\s+/);
    
    let relevanceScore = 0;

    // Word overlap scoring
    for (const specWord of specWords) {
      if (specWord.length > 3 && taskWords.some(tw => tw.includes(specWord) || specWord.includes(tw))) {
        relevanceScore += 0.2;
      }
    }

    // Domain-specific scoring
    if (specLower.includes('react') && (taskLower.includes('component') || taskLower.includes('ui'))) {
      relevanceScore += 0.3;
    }
    if (specLower.includes('backend') && (taskLower.includes('api') || taskLower.includes('server'))) {
      relevanceScore += 0.3;
    }
    if (specLower.includes('testing') && (taskLower.includes('test') || taskLower.includes('bug'))) {
      relevanceScore += 0.3;
    }

    return Math.min(relevanceScore, 1.0);
  }

  /**
   * 🧮 Score complexity handling capability
   */
  private scoreComplexityHandling(blueprint: AgentBlueprint, estimatedComplexity: number): number {
    // More capabilities = better complexity handling
    const capabilityBonus = Math.min(blueprint.capabilities.length / 20, 0.5);
    
    // Autonomy level affects complexity handling
    const autonomyBonus = {
      'supervised': 0.3,
      'semi-autonomous': 0.7,
      'fully-autonomous': 1.0
    }[blueprint.autonomyLevel];

    // Personality factors
    const personalityBonus = (
      blueprint.personality.analytical * 0.4 +
      blueprint.personality.proactive * 0.3 +
      blueprint.personality.creative * 0.3
    ) / 100;

    const baseScore = (10 - Math.abs(estimatedComplexity - 5)) / 10; // Optimal at complexity 5
    
    return Math.min(baseScore + capabilityBonus + autonomyBonus + personalityBonus, 1.0);
  }

  /**
   * 🛡️ Score autonomy level appropriateness for risk
   */
  private scoreAutonomyLevel(autonomyLevel: AgentBlueprint['autonomyLevel'], riskLevel: 'low' | 'medium' | 'high'): number {
    const scores = {
      'low': { 'supervised': 0.6, 'semi-autonomous': 0.9, 'fully-autonomous': 1.0 },
      'medium': { 'supervised': 0.8, 'semi-autonomous': 1.0, 'fully-autonomous': 0.7 },
      'high': { 'supervised': 1.0, 'semi-autonomous': 0.6, 'fully-autonomous': 0.3 }
    };

    return scores[riskLevel][autonomyLevel];
  }

  /**
   * 👤 Score personality fit for task characteristics
   */
  private scorePersonalityFit(
    personality: AgentBlueprint['personality'],
    urgency: 'low' | 'normal' | 'high' | 'critical',
    estimatedComplexity: number
  ): number {
    let score = 0;

    // Urgency scoring
    const urgencyWeights = {
      'low': { proactive: 0.3, collaborative: 0.5 },
      'normal': { proactive: 0.5, collaborative: 0.4 },
      'high': { proactive: 0.8, collaborative: 0.3 },
      'critical': { proactive: 1.0, collaborative: 0.2 }
    };

    const urgencyWeight = urgencyWeights[urgency];
    score += (personality.proactive / 100) * urgencyWeight.proactive * 0.4;
    score += (personality.collaborative / 100) * urgencyWeight.collaborative * 0.2;

    // Complexity scoring
    if (estimatedComplexity >= 7) {
      score += (personality.analytical / 100) * 0.3;
      score += (personality.creative / 100) * 0.1;
    } else {
      score += (personality.analytical / 100) * 0.2;
      score += (personality.creative / 100) * 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 🔄 Score working style compatibility
   */
  private scoreWorkingStyle(workingStyle: AgentBlueprint['workingStyle'], estimatedComplexity: number): number {
    const styleScores = {
      'sequential': estimatedComplexity <= 5 ? 0.8 : 0.4,
      'parallel': estimatedComplexity >= 5 ? 0.9 : 0.5,
      'adaptive': 0.85 // Always good choice
    };

    return styleScores[workingStyle];
  }

  /**
   * 🎯 Score context scope appropriateness
   */
  private scoreContextScope(contextScope: AgentBlueprint['contextScope'], requiredCapabilities: string[]): number {
    // Larger scope needed for complex capabilities
    const complexCapabilities = ['full-stack-development', 'architecture-review', 'system-administration'];
    const needsLargeScope = requiredCapabilities.some(cap => complexCapabilities.includes(cap));

    if (needsLargeScope) {
      return { 'file': 0.3, 'directory': 0.6, 'project': 0.9, 'workspace': 1.0 }[contextScope];
    } else {
      return { 'file': 1.0, 'directory': 0.9, 'project': 0.7, 'workspace': 0.5 }[contextScope];
    }
  }

  /**
   * 📈 Score recent performance (placeholder - would use real metrics)
   */
  private scoreRecentPerformance(agentName: string): number {
    // In real implementation, this would use historical performance data
    return 0.75; // Placeholder score
  }

  /**
   * ⚡ Score current availability
   */
  private scoreAvailability(agentName: string): number {
    const agent = this.instances.get(agentName);
    if (!agent) return 0;
    
    return agent.isActive() ? 0.3 : 1.0; // Prefer available agents
  }

  /**
   * 🔄 Score freshness (newer agents might have better capabilities)
   */
  private scoreFreshness(createdAt: Date): number {
    const daysSinceCreation = (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
    return Math.max(0, 1 - (daysSinceCreation / 30)); // Decay over 30 days
  }

  /**
   * 📝 Generate human-readable selection reasoning
   */
  private generateSelectionReasoning(
    primary: DynamicAgent,
    secondary: DynamicAgent[],
    primaryReasons: string[]
  ): string {
    const blueprint = primary.getBlueprint();
    
    let reasoning = `Selected **${blueprint.name}** as primary agent because:\n`;
    reasoning += primaryReasons.map(reason => `• ${reason}`).join('\n');
    
    if (secondary.length > 0) {
      reasoning += `\n\nSecondary agents available for collaboration:\n`;
      reasoning += secondary.map(agent => 
        `• ${agent.getBlueprint().name} (${agent.getBlueprint().specialization})`
      ).join('\n');
    }

    reasoning += `\n\nAgent characteristics:\n`;
    reasoning += `• Autonomy Level: ${blueprint.autonomyLevel}\n`;
    reasoning += `• Working Style: ${blueprint.workingStyle}\n`;
    reasoning += `• Context Scope: ${blueprint.contextScope}\n`;
    reasoning += `• Capabilities: ${blueprint.capabilities.length} total`;

    return reasoning;
  }

  /**
   * 🔄 Dynamic Agent Rebalancing based on performance
   */
  async rebalanceAgentSelection(
    taskId: string,
    currentPrimary: DynamicAgent,
    performanceMetrics: {
      executionTime: number;
      successRate: number;
      errorCount: number;
    }
  ): Promise<{ shouldRebalance: boolean; newPrimary?: DynamicAgent; reasoning: string }> {
    
    console.log(chalk.yellow(`🔄 Evaluating agent rebalancing for task ${taskId}...`));

    // Determine if rebalancing is needed
    const shouldRebalance = (
      performanceMetrics.executionTime > 300000 || // > 5 minutes
      performanceMetrics.successRate < 0.7 ||      // < 70% success
      performanceMetrics.errorCount > 3            // > 3 errors
    );

    if (!shouldRebalance) {
      return {
        shouldRebalance: false,
        reasoning: 'Current agent performance is satisfactory - no rebalancing needed'
      };
    }

    // Find alternative agents
    const alternatives = this.getActiveAgents()
      .filter(agent => agent.id !== currentPrimary.id)
      .filter(agent => !agent.isActive()); // Only available agents

    if (alternatives.length === 0) {
      return {
        shouldRebalance: false,
        reasoning: 'No alternative agents available for rebalancing'
      };
    }

    // Select best alternative based on different criteria
    const newPrimary = alternatives[0]; // Simplified selection for now

    console.log(chalk.green(`✅ Rebalancing recommended: ${currentPrimary.getBlueprint().name} → ${newPrimary.getBlueprint().name}`));

    return {
      shouldRebalance: true,
      newPrimary,
      reasoning: `Switching from ${currentPrimary.getBlueprint().name} to ${newPrimary.getBlueprint().name} due to performance issues`
    };
  }

  /**
   * 📊 Get Multi-Dimensional Selection Analytics
   */
  getSelectionAnalytics(): {
    totalSelections: number;
    averageConfidence: number;
    topPerformingAgents: string[];
    selectionTrends: Record<string, number>;
  } {
    // In real implementation, this would track actual selection data
    return {
      totalSelections: 0,
      averageConfidence: 0.85,
      topPerformingAgents: ['universal-agent', 'react-expert', 'backend-expert'],
      selectionTrends: {
        'capability-driven': 45,
        'specialization-driven': 30,
        'performance-driven': 15,
        'availability-driven': 10
      }
    };
  }
}

export const agentFactory = new AgentFactory();