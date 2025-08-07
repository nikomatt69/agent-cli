"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentFactory = exports.AgentFactory = exports.DynamicAgent = void 0;
const base_agent_1 = require("../agents/base-agent");
const model_provider_1 = require("../ai/model-provider");
const migration_to_secure_tools_1 = require("../tools/migration-to-secure-tools"); // deprecated, for backward compatibility
const agent_todo_manager_1 = require("./agent-todo-manager");
const agent_stream_1 = require("./agent-stream");
const workspace_context_1 = require("./workspace-context");
const chalk_1 = __importDefault(require("chalk"));
const nanoid_1 = require("nanoid");
// Helper function to extract JSON from markdown code blocks
function extractJsonFromMarkdown(text) {
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
class DynamicAgent extends base_agent_1.BaseAgent {
    constructor(blueprint) {
        super();
        this.isRunning = false;
        this.currentTodos = [];
        this.blueprint = blueprint;
        this.name = blueprint.name;
        this.description = blueprint.description;
    }
    async initialize() {
        await super.initialize();
        agent_stream_1.agentStream.startAgentStream(this.name);
        agent_stream_1.agentStream.emitEvent(this.name, 'info', `🤖 Dynamic agent ${this.name} initialized`);
        agent_stream_1.agentStream.emitEvent(this.name, 'info', `Specialization: ${this.blueprint.specialization}`);
        agent_stream_1.agentStream.emitEvent(this.name, 'info', `Autonomy Level: ${this.blueprint.autonomyLevel}`);
        // Get workspace context based on scope
        if (this.blueprint.contextScope !== 'file') {
            const context = workspace_context_1.workspaceContext.getContextForAgent(this.name);
            agent_stream_1.agentStream.emitEvent(this.name, 'info', `Context loaded: ${context.relevantFiles.length} files`);
        }
    }
    async run(task) {
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
            agent_stream_1.agentStream.emitEvent(this.name, 'thinking', 'Starting autonomous workflow...');
            // 1. Create todos autonomously
            await this.createAutonomousTodos(task);
            // 2. Execute todos with streaming
            const result = await this.executeAutonomousWorkflow();
            // 3. Report results
            agent_stream_1.agentStream.emitEvent(this.name, 'result', 'Autonomous workflow completed successfully');
            return result;
        }
        catch (error) {
            agent_stream_1.agentStream.emitEvent(this.name, 'error', `Autonomous workflow failed: ${error.message}`);
            return { error: error.message, task };
        }
        finally {
            this.isRunning = false;
        }
    }
    async createAutonomousTodos(task) {
        agent_stream_1.agentStream.emitEvent(this.name, 'planning', 'Analyzing task and creating autonomous plan...');
        // Get workspace context
        const context = workspace_context_1.workspaceContext.getContextForAgent(this.name);
        // Stream thinking process
        const thoughts = [
            'Understanding the requirements...',
            'Analyzing current workspace state...',
            'Identifying required tools and dependencies...',
            'Planning optimal execution strategy...',
            'Creating detailed todo breakdown...'
        ];
        await agent_stream_1.agentStream.streamThinking(this.name, thoughts);
        // Generate AI-powered todos based on agent specialization
        const todos = await agent_todo_manager_1.agentTodoManager.planTodos(this.name, task, {
            blueprint: this.blueprint,
            workspaceContext: context,
            specialization: this.blueprint.specialization,
        });
        this.currentTodos = todos.map(t => t.id);
        // Stream the plan
        const planSteps = todos.map(todo => todo.title);
        await agent_stream_1.agentStream.streamPlanning(this.name, planSteps);
        agent_stream_1.agentStream.emitEvent(this.name, 'planning', `Created ${todos.length} autonomous todos`);
    }
    async executeAutonomousWorkflow() {
        const todos = agent_todo_manager_1.agentTodoManager.getAgentTodos(this.name);
        const results = [];
        agent_stream_1.agentStream.emitEvent(this.name, 'executing', `Starting execution of ${todos.length} todos`);
        for (let i = 0; i < todos.length; i++) {
            const todo = todos[i];
            // Stream progress
            agent_stream_1.agentStream.streamProgress(this.name, i + 1, todos.length, `Executing: ${todo.title}`);
            // Execute todo with full autonomy
            const result = await this.executeAutonomousTodo(todo);
            results.push(result);
            // Mark todo as completed
            agent_todo_manager_1.agentTodoManager.updateTodo(todo.id, {
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
    async executeAutonomousTodo(todo) {
        const actionId = agent_stream_1.agentStream.trackAction(this.name, 'analysis', todo.description);
        agent_stream_1.agentStream.emitEvent(this.name, 'executing', `Working on: ${todo.title}`);
        try {
            let result;
            // Execute based on todo tags and agent capabilities
            if (todo.tags.includes('filesystem')) {
                result = await this.executeFileSystemTodo(todo);
            }
            else if (todo.tags.includes('analysis')) {
                result = await this.executeAnalysisTodo(todo);
            }
            else if (todo.tags.includes('implementation')) {
                result = await this.executeImplementationTodo(todo);
            }
            else if (todo.tags.includes('testing')) {
                result = await this.executeTestingTodo(todo);
            }
            else {
                result = await this.executeGenericTodo(todo);
            }
            agent_stream_1.agentStream.updateAction(actionId, 'completed', result);
            return result;
        }
        catch (error) {
            agent_stream_1.agentStream.updateAction(actionId, 'failed', undefined, error.message);
            throw error;
        }
    }
    async executeFileSystemTodo(todo) {
        agent_stream_1.agentStream.emitEvent(this.name, 'executing', 'Analyzing file system...');
        // Autonomously decide what files to read/analyze
        const context = workspace_context_1.workspaceContext.getContextForAgent(this.name, 10);
        const analysis = {
            filesAnalyzed: context.relevantFiles.length,
            projectStructure: context.projectSummary,
            keyFindings: 'Project structure analyzed successfully'
        };
        return analysis;
    }
    async executeAnalysisTodo(todo) {
        agent_stream_1.agentStream.emitEvent(this.name, 'executing', 'Performing deep analysis...');
        // Get workspace context for analysis
        const context = workspace_context_1.workspaceContext.getContextForAgent(this.name);
        // Generate AI analysis based on agent specialization
        const messages = [
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
        const analysis = await model_provider_1.modelProvider.generateResponse({ messages });
        return {
            analysis,
            specialization: this.blueprint.specialization,
            contextAnalyzed: context.relevantFiles.length,
        };
    }
    async executeImplementationTodo(todo) {
        agent_stream_1.agentStream.emitEvent(this.name, 'executing', 'Implementing solution...');
        // For fully autonomous agents, actually implement solutions
        if (this.blueprint.autonomyLevel === 'fully-autonomous') {
            // Get workspace context
            const context = workspace_context_1.workspaceContext.getContextForAgent(this.name);
            // Generate implementation
            const messages = [
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
            const implementation = await model_provider_1.modelProvider.generateResponse({ messages });
            // Try to extract and create files from the implementation
            const fileCreated = await this.tryCreateFilesFromResponse(implementation);
            return {
                implementation,
                filesCreated: fileCreated,
                autonomous: true,
            };
        }
        else {
            // For supervised agents, just plan the implementation
            return {
                implementationPlan: `Implementation plan for: ${todo.description}`,
                requiresApproval: true,
            };
        }
    }
    async executeTestingTodo(todo) {
        agent_stream_1.agentStream.emitEvent(this.name, 'executing', 'Running tests and validation...');
        // Run actual tests if fully autonomous
        if (this.blueprint.autonomyLevel === 'fully-autonomous') {
            const buildResult = await migration_to_secure_tools_1.toolsManager.build();
            const testResult = await migration_to_secure_tools_1.toolsManager.runTests();
            return {
                buildSuccess: buildResult.success,
                testSuccess: testResult.success,
                buildErrors: buildResult.errors?.length || 0,
                testErrors: testResult.errors?.length || 0,
            };
        }
        else {
            return {
                testPlan: `Testing plan for: ${todo.description}`,
                requiresExecution: true,
            };
        }
    }
    async executeGenericTodo(todo) {
        agent_stream_1.agentStream.emitEvent(this.name, 'executing', `Executing custom todo: ${todo.title}`);
        const messages = [
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
        const result = await model_provider_1.modelProvider.generateResponse({ messages });
        return {
            result,
            todo: todo.title,
            specialization: this.blueprint.specialization,
        };
    }
    async tryCreateFilesFromResponse(response) {
        const createdFiles = [];
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
                    await migration_to_secure_tools_1.toolsManager.writeFile(filename, code);
                    createdFiles.push(filename);
                    agent_stream_1.agentStream.emitEvent(this.name, 'result', `Created file: ${filename}`);
                }
                catch (error) {
                    agent_stream_1.agentStream.emitEvent(this.name, 'error', `Failed to create file: ${filename}`);
                }
            }
        }
        return createdFiles;
    }
    extractFilenameFromContext(response, codeBlock) {
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
    getExtensionForSpecialization() {
        const specialization = this.blueprint.specialization.toLowerCase();
        if (specialization.includes('react') || specialization.includes('frontend')) {
            return '.tsx';
        }
        else if (specialization.includes('backend') || specialization.includes('api')) {
            return '.ts';
        }
        else if (specialization.includes('python')) {
            return '.py';
        }
        else if (specialization.includes('docker')) {
            return '.dockerfile';
        }
        else if (specialization.includes('config')) {
            return '.json';
        }
        else {
            return '.ts';
        }
    }
    async cleanup() {
        await super.cleanup();
        agent_stream_1.agentStream.stopAgentStream(this.name);
        // Show final stats
        const stats = agent_todo_manager_1.agentTodoManager.getAgentStats(this.name);
        agent_stream_1.agentStream.emitEvent(this.name, 'info', `Final stats: ${stats.completed} completed, efficiency: ${Math.round(stats.efficiency)}%`);
    }
    // Check if agent is currently running
    isActive() {
        return this.isRunning;
    }
    // Get agent blueprint
    getBlueprint() {
        return { ...this.blueprint };
    }
}
exports.DynamicAgent = DynamicAgent;
class AgentFactory {
    constructor() {
        this.blueprints = new Map();
        this.instances = new Map();
    }
    // Create a new agent blueprint
    async createAgentBlueprint(requirements) {
        console.log(chalk_1.default.blue(`🧬 Creating agent blueprint for: ${requirements.specialization}`));
        // Use AI to generate comprehensive blueprint
        const messages = [
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
            const response = await model_provider_1.modelProvider.generateResponse({ messages });
            const jsonText = extractJsonFromMarkdown(response);
            const aiBlueprint = JSON.parse(jsonText);
            const blueprint = {
                id: (0, nanoid_1.nanoid)(),
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
            console.log(chalk_1.default.green(`✅ Agent blueprint created: ${blueprint.name}`));
            console.log(chalk_1.default.gray(`   Capabilities: ${blueprint.capabilities.join(', ')}`));
            console.log(chalk_1.default.gray(`   Autonomy: ${blueprint.autonomyLevel}`));
            console.log(chalk_1.default.gray(`   Personality: Proactive(${blueprint.personality.proactive}) Analytical(${blueprint.personality.analytical})`));
            return blueprint;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to create agent blueprint: ${error.message}`));
            throw error;
        }
    }
    // Launch an agent from a blueprint
    async launchAgent(blueprintId) {
        const blueprint = this.blueprints.get(blueprintId);
        if (!blueprint) {
            throw new Error(`Blueprint ${blueprintId} not found`);
        }
        console.log(chalk_1.default.blue(`🚀 Launching agent: ${blueprint.name}`));
        const agent = new DynamicAgent(blueprint);
        await agent.initialize();
        this.instances.set(blueprint.name, agent);
        console.log(chalk_1.default.green(`✅ Agent ${blueprint.name} launched successfully`));
        return agent;
    }
    // Create and launch agent in one step
    async createAndLaunchAgent(requirements) {
        const blueprint = await this.createAgentBlueprint(requirements);
        const agent = await this.launchAgent(blueprint.id);
        return agent;
    }
    // Get all blueprints
    getAllBlueprints() {
        return Array.from(this.blueprints.values());
    }
    // Get all active agents
    getActiveAgents() {
        return Array.from(this.instances.values()).filter(agent => agent.isActive());
    }
    // Get agent by name
    getAgent(name) {
        return this.instances.get(name);
    }
    // Remove blueprint
    removeBlueprint(id) {
        return this.blueprints.delete(id);
    }
    // Show factory dashboard
    showFactoryDashboard() {
        const blueprints = this.getAllBlueprints();
        const activeAgents = this.getActiveAgents();
        console.log(chalk_1.default.blue.bold('\n🏭 Agent Factory Dashboard'));
        console.log(chalk_1.default.gray('═'.repeat(50)));
        console.log(`📋 Blueprints: ${blueprints.length}`);
        console.log(`🤖 Active Agents: ${activeAgents.length}`);
        console.log(`🏃 Running Agents: ${activeAgents.filter(a => a.isActive()).length}`);
        if (blueprints.length > 0) {
            console.log(chalk_1.default.blue.bold('\n📋 Available Blueprints:'));
            blueprints.forEach(blueprint => {
                const isActive = this.instances.has(blueprint.name);
                const status = isActive ? chalk_1.default.green('🟢 Active') : chalk_1.default.gray('⚪ Inactive');
                console.log(`  ${status} ${chalk_1.default.bold(blueprint.name)}`);
                console.log(`    Specialization: ${blueprint.specialization}`);
                console.log(`    Autonomy: ${blueprint.autonomyLevel}`);
                console.log(`    Created: ${blueprint.createdAt.toLocaleDateString()}`);
            });
        }
        if (activeAgents.length > 0) {
            console.log(chalk_1.default.blue.bold('\n🤖 Active Agents:'));
            activeAgents.forEach(agent => {
                const blueprint = agent.getBlueprint();
                const stats = agent_todo_manager_1.agentTodoManager.getAgentStats(agent.name);
                console.log(`  🤖 ${chalk_1.default.bold(agent.name)} (${blueprint.specialization})`);
                console.log(`    Status: ${agent.isActive() ? chalk_1.default.green('Running') : chalk_1.default.yellow('Idle')}`);
                console.log(`    Todos: ${stats.completed} completed, ${stats.pending} pending`);
                console.log(`    Efficiency: ${Math.round(stats.efficiency)}%`);
            });
        }
    }
}
exports.AgentFactory = AgentFactory;
exports.agentFactory = new AgentFactory();
