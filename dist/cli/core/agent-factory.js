"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentFactory = exports.AgentFactory = exports.DynamicAgent = void 0;
const base_agent_1 = require("../automation/agents/base-agent");
const model_provider_1 = require("../ai/model-provider");
const migration_to_secure_tools_1 = require("../tools/migration-to-secure-tools");
const agent_todo_manager_1 = require("./agent-todo-manager");
const agent_stream_1 = require("./agent-stream");
const workspace_context_1 = require("../context/workspace-context");
const chalk_1 = __importDefault(require("chalk"));
const nanoid_1 = require("nanoid");
const config_manager_1 = require("./config-manager");
const events_1 = require("events");
function extractJsonFromMarkdown(text) {
    const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
        return jsonBlockMatch[1].trim();
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        return jsonMatch[0].trim();
    }
    return text.trim();
}
class DynamicAgent extends base_agent_1.BaseAgent {
    constructor(blueprint, workingDirectory = process.cwd()) {
        super(workingDirectory);
        this.isRunning = false;
        this.currentTodos = [];
        this.id = blueprint.name;
        this.capabilities = blueprint.capabilities;
        this.specialization = blueprint.description;
        this.blueprint = blueprint;
    }
    async onInitialize() {
        agent_stream_1.agentStream.startAgentStream(this.id);
        agent_stream_1.agentStream.emitEvent(this.id, 'info', `🤖 Dynamic agent ${this.id} initialized`);
        agent_stream_1.agentStream.emitEvent(this.id, 'info', `Specialization: ${this.blueprint.specialization}`);
        agent_stream_1.agentStream.emitEvent(this.id, 'info', `Autonomy Level: ${this.blueprint.autonomyLevel}`);
    }
    async onStop() {
        this.isRunning = false;
        agent_stream_1.agentStream.emitEvent(this.id, 'info', `🛑 Dynamic agent ${this.id} stopped`);
    }
    async onExecuteTask(task) {
        const taskData = typeof task === 'string' ? task : task.data;
        return this.executeTask(taskData);
    }
    async executeTask(task) {
        const taskData = typeof task === 'string' ? task : (task?.description || task?.data);
        if (!taskData) {
            return {
                message: `${this.blueprint.description}`,
                specialization: this.blueprint.specialization,
                capabilities: this.blueprint.capabilities,
                autonomyLevel: this.blueprint.autonomyLevel,
            };
        }
        if (this.blueprint.contextScope !== 'file') {
            const context = workspace_context_1.workspaceContext.getContextForAgent(this.id);
            agent_stream_1.agentStream.emitEvent(this.id, 'info', `Context loaded: ${context.relevantFiles.length} files`);
        }
        return await this.run(taskData);
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
            agent_stream_1.agentStream.emitEvent(this.id, 'thinking', 'Starting autonomous workflow...');
            await this.createAutonomousTodos(task);
            const result = await this.executeAutonomousWorkflow();
            agent_stream_1.agentStream.emitEvent(this.id, 'result', 'Autonomous workflow completed successfully');
            return result;
        }
        catch (error) {
            agent_stream_1.agentStream.emitEvent(this.id, 'error', `Autonomous workflow failed: ${error.message}`);
            return { error: error.message, task };
        }
        finally {
            this.isRunning = false;
        }
    }
    async createAutonomousTodos(task) {
        agent_stream_1.agentStream.emitEvent(this.id, 'planning', 'Analyzing task and creating autonomous plan...');
        const context = workspace_context_1.workspaceContext.getContextForAgent(this.id);
        const thoughts = [
            'Understanding the requirements...',
            'Analyzing current workspace state...',
            'Identifying required tools and dependencies...',
            'Planning optimal execution strategy...',
            'Creating detailed todo breakdown...'
        ];
        await agent_stream_1.agentStream.streamThinking(this.id, thoughts);
        const todos = await agent_todo_manager_1.agentTodoManager.planTodos(this.id, task, {
            blueprint: this.blueprint,
            workspaceContext: context,
            specialization: this.blueprint.specialization,
        });
        this.currentTodos = todos.map(t => t.id);
        const planSteps = todos.map(todo => todo.title);
        await agent_stream_1.agentStream.streamPlanning(this.id, planSteps);
        agent_stream_1.agentStream.emitEvent(this.id, 'planning', `Created ${todos.length} autonomous todos`);
    }
    async executeAutonomousWorkflow() {
        const todos = agent_todo_manager_1.agentTodoManager.getAgentTodos(this.id);
        const results = [];
        agent_stream_1.agentStream.emitEvent(this.id, 'executing', `Starting execution of ${todos.length} todos`);
        for (let i = 0; i < todos.length; i++) {
            const todo = todos[i];
            agent_stream_1.agentStream.streamProgress(this.id, i + 1, todos.length, `Executing: ${todo.title}`);
            const result = await this.executeAutonomousTodo(todo);
            results.push(result);
            agent_todo_manager_1.agentTodoManager.updateTodo(todo.id, {
                status: 'completed',
                progress: 100,
                actualDuration: Math.random() * 5 + 1
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
    async executeAutonomousTodo(todo) {
        const actionId = agent_stream_1.agentStream.trackAction(this.id, 'analysis', todo.description);
        agent_stream_1.agentStream.emitEvent(this.id, 'executing', `Working on: ${todo.title}`);
        try {
            let result;
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
        agent_stream_1.agentStream.emitEvent(this.id, 'executing', 'Analyzing file system...');
        const context = workspace_context_1.workspaceContext.getContextForAgent(this.id, 10);
        const analysis = {
            filesAnalyzed: context.relevantFiles.length,
            projectStructure: context.projectSummary,
            keyFindings: 'Project structure analyzed successfully'
        };
        return analysis;
    }
    async executeAnalysisTodo(todo) {
        agent_stream_1.agentStream.emitEvent(this.id, 'executing', 'Performing deep analysis...');
        const context = workspace_context_1.workspaceContext.getContextForAgent(this.id);
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
        agent_stream_1.agentStream.emitEvent(this.id, 'executing', 'Implementing solution...');
        if (this.blueprint.autonomyLevel === 'fully-autonomous') {
            const context = workspace_context_1.workspaceContext.getContextForAgent(this.id);
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
            const fileCreated = await this.tryCreateFilesFromResponse(implementation);
            return {
                implementation,
                filesCreated: fileCreated,
                autonomous: true,
            };
        }
        else {
            return {
                implementationPlan: `Implementation plan for: ${todo.description}`,
                requiresApproval: true,
            };
        }
    }
    async executeTestingTodo(todo) {
        agent_stream_1.agentStream.emitEvent(this.id, 'executing', 'Running tests and validation...');
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
        agent_stream_1.agentStream.emitEvent(this.id, 'executing', `Executing custom todo: ${todo.title}`);
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
        const codeBlocks = response.match(/```[\w]*\n([\s\S]*?)\n```/g);
        if (codeBlocks) {
            for (let i = 0; i < codeBlocks.length; i++) {
                const block = codeBlocks[i];
                const code = block.replace(/```[\w]*\n/, '').replace(/\n```$/, '');
                let filename = this.extractFilenameFromContext(response, block);
                if (!filename) {
                    const extension = this.getExtensionForSpecialization();
                    filename = `generated-${this.id}-${i + 1}${extension}`;
                }
                try {
                    await migration_to_secure_tools_1.toolsManager.writeFile(filename, code);
                    createdFiles.push(filename);
                    agent_stream_1.agentStream.emitEvent(this.id, 'result', `Created file: ${filename}`);
                }
                catch (error) {
                    agent_stream_1.agentStream.emitEvent(this.id, 'error', `Failed to create file: ${filename}`);
                }
            }
        }
        return createdFiles;
    }
    extractFilenameFromContext(response, codeBlock) {
        const lines = response.split('\n');
        const blockIndex = lines.findIndex(line => line.includes(codeBlock.split('\n')[0]));
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
        await super.cleanup?.();
        agent_stream_1.agentStream.stopAgentStream(this.id);
        const stats = agent_todo_manager_1.agentTodoManager.getAgentStats(this.id);
        agent_stream_1.agentStream.emitEvent(this.id, 'info', `Final stats: ${stats.completed} completed, efficiency: ${Math.round(stats.efficiency)}%`);
    }
    isActive() {
        return this.isRunning;
    }
    getBlueprint() {
        return { ...this.blueprint };
    }
}
exports.DynamicAgent = DynamicAgent;
class AgentFactory extends events_1.EventEmitter {
    constructor() {
        super();
        this.blueprints = new Map();
        this.instances = new Map();
    }
    createFallbackBlueprint(specialization) {
        const lowerSpec = specialization.toLowerCase();
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
    async createAgentBlueprint(requirements) {
        console.log(chalk_1.default.blue(`🧬 Creating agent blueprint for: ${requirements.specialization}`));
        try {
            const modelInfo = model_provider_1.modelProvider.getCurrentModelInfo();
            const hasApiKey = model_provider_1.modelProvider.validateApiKey();
            if (!hasApiKey) {
                const currentModel = config_manager_1.configManager.getCurrentModel();
                throw new Error(`API key not configured for model: ${currentModel}. Use /set-key ${currentModel} <your-api-key>`);
            }
            console.log(chalk_1.default.gray(`Using model: ${modelInfo.name} (${modelInfo.config.provider})`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Model configuration error: ${error.message}`));
            throw error;
        }
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
            console.log(chalk_1.default.gray('Generating AI blueprint...'));
            const response = await model_provider_1.modelProvider.generateResponse({ messages });
            console.log(chalk_1.default.gray('Parsing AI response...'));
            const jsonText = extractJsonFromMarkdown(response);
            let aiBlueprint;
            try {
                aiBlueprint = JSON.parse(jsonText);
            }
            catch (parseError) {
                console.log(chalk_1.default.yellow('⚠️ Failed to parse AI response, using fallback blueprint'));
                aiBlueprint = this.createFallbackBlueprint(requirements.specialization);
            }
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
            console.log(chalk_1.default.yellow('🔄 Creating fallback blueprint...'));
            try {
                const fallbackBlueprint = this.createFallbackBlueprint(requirements.specialization);
                const blueprint = {
                    id: (0, nanoid_1.nanoid)(),
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
                console.log(chalk_1.default.green(`✅ Fallback agent blueprint created: ${blueprint.name}`));
                console.log(chalk_1.default.gray(`   Capabilities: ${blueprint.capabilities.join(', ')}`));
                return blueprint;
            }
            catch (fallbackError) {
                console.log(chalk_1.default.red(`❌ Fallback blueprint creation also failed: ${fallbackError}`));
                throw error;
            }
        }
    }
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
    async createAndLaunchAgent(requirements) {
        const blueprint = await this.createAgentBlueprint(requirements);
        const agent = await this.launchAgent(blueprint.id);
        return agent;
    }
    getAllBlueprints() {
        return Array.from(this.blueprints.values());
    }
    getActiveAgents() {
        return Array.from(this.instances.values()).filter(agent => agent.isActive());
    }
    getAgent(name) {
        return this.instances.get(name);
    }
    removeBlueprint(id) {
        return this.blueprints.delete(id);
    }
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
                const stats = agent_todo_manager_1.agentTodoManager.getAgentStats(agent.id);
                console.log(`  🤖 ${chalk_1.default.bold(agent.id)} (${blueprint.specialization})`);
                console.log(`    Status: ${agent.isActive() ? chalk_1.default.green('Running') : chalk_1.default.yellow('Idle')}`);
                console.log(`    Todos: ${stats.completed} completed, ${stats.pending} pending`);
                console.log(`    Efficiency: ${Math.round(stats.efficiency)}%`);
            });
        }
    }
    async selectOptimalAgentsForTask(taskDescription, requiredCapabilities, estimatedComplexity, riskLevel, urgency) {
        console.log(chalk_1.default.blue(`🎯 Multi-dimensional agent selection for: ${taskDescription.slice(0, 50)}...`));
        const availableAgents = this.getActiveAgents();
        const agentScores = new Map();
        const agentReasons = new Map();
        for (const agent of availableAgents) {
            const blueprint = agent.getBlueprint();
            const score = this.calculateAgentScore(blueprint, requiredCapabilities, estimatedComplexity, riskLevel, urgency, taskDescription);
            agentScores.set(agent.id, score.totalScore);
            agentReasons.set(agent.id, score.reasons);
        }
        const rankedAgents = availableAgents
            .sort((a, b) => (agentScores.get(b.id) || 0) - (agentScores.get(a.id) || 0));
        const primary = rankedAgents[0];
        const secondary = rankedAgents.slice(1, Math.min(3, rankedAgents.length));
        const fallbackOptions = rankedAgents.slice(3, 6);
        const primaryReasons = agentReasons.get(primary.id) || [];
        const reasoning = this.generateSelectionReasoning(primary, secondary, primaryReasons);
        const topScore = agentScores.get(primary.id) || 0;
        const secondScore = agentScores.get(secondary[0]?.id || '') || 0;
        const confidence = Math.min(0.95, topScore / Math.max(secondScore, 0.1));
        console.log(chalk_1.default.green(`✅ Selected ${primary.getBlueprint().name} as primary agent (confidence: ${Math.round(confidence * 100)}%)`));
        return {
            primary,
            secondary,
            reasoning,
            confidence,
            fallbackOptions
        };
    }
    calculateAgentScore(blueprint, requiredCapabilities, estimatedComplexity, riskLevel, urgency, taskDescription) {
        let totalScore = 0;
        const reasons = [];
        const maxScore = 100;
        const capabilityMatch = this.scoreCapabilityMatch(blueprint.capabilities, requiredCapabilities);
        totalScore += capabilityMatch.score * 0.25;
        if (capabilityMatch.score > 0.7) {
            reasons.push(`Strong capability match (${Math.round(capabilityMatch.score * 100)}%)`);
        }
        const specializationScore = this.scoreSpecializationRelevance(blueprint.specialization, taskDescription);
        totalScore += specializationScore * 0.20;
        if (specializationScore > 0.7) {
            reasons.push(`Highly relevant specialization`);
        }
        const complexityScore = this.scoreComplexityHandling(blueprint, estimatedComplexity);
        totalScore += complexityScore * 0.15;
        if (complexityScore > 0.8) {
            reasons.push(`Excellent complexity handling`);
        }
        const autonomyScore = this.scoreAutonomyLevel(blueprint.autonomyLevel, riskLevel);
        totalScore += autonomyScore * 0.10;
        if (autonomyScore > 0.8) {
            reasons.push(`Appropriate autonomy level`);
        }
        const personalityScore = this.scorePersonalityFit(blueprint.personality, urgency, estimatedComplexity);
        totalScore += personalityScore * 0.08;
        const workingStyleScore = this.scoreWorkingStyle(blueprint.workingStyle, estimatedComplexity);
        totalScore += workingStyleScore * 0.07;
        const contextScore = this.scoreContextScope(blueprint.contextScope, requiredCapabilities);
        totalScore += contextScore * 0.05;
        const performanceScore = this.scoreRecentPerformance(blueprint.name);
        totalScore += performanceScore * 0.05;
        const availabilityScore = this.scoreAvailability(blueprint.name);
        totalScore += availabilityScore * 0.03;
        const freshnessScore = this.scoreFreshness(blueprint.createdAt);
        totalScore += freshnessScore * 0.02;
        return {
            totalScore: Math.min(totalScore, maxScore),
            reasons
        };
    }
    scoreCapabilityMatch(agentCapabilities, requiredCapabilities) {
        if (requiredCapabilities.length === 0)
            return { score: 0.5 };
        let matches = 0;
        let semanticMatches = 0;
        const semanticMappings = {
            'react': ['frontend', 'components', 'jsx', 'tsx', 'ui'],
            'backend': ['api', 'server', 'nodejs', 'database'],
            'testing': ['test', 'qa', 'validation', 'verification'],
            'devops': ['deployment', 'ci-cd', 'docker', 'infrastructure']
        };
        for (const required of requiredCapabilities) {
            if (agentCapabilities.includes(required)) {
                matches++;
                continue;
            }
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
    scoreSpecializationRelevance(specialization, taskDescription) {
        const specLower = specialization.toLowerCase();
        const taskLower = taskDescription.toLowerCase();
        const specWords = specLower.split(/\s+/);
        const taskWords = taskLower.split(/\s+/);
        let relevanceScore = 0;
        for (const specWord of specWords) {
            if (specWord.length > 3 && taskWords.some(tw => tw.includes(specWord) || specWord.includes(tw))) {
                relevanceScore += 0.2;
            }
        }
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
    scoreComplexityHandling(blueprint, estimatedComplexity) {
        const capabilityBonus = Math.min(blueprint.capabilities.length / 20, 0.5);
        const autonomyBonus = {
            'supervised': 0.3,
            'semi-autonomous': 0.7,
            'fully-autonomous': 1.0
        }[blueprint.autonomyLevel];
        const personalityBonus = (blueprint.personality.analytical * 0.4 +
            blueprint.personality.proactive * 0.3 +
            blueprint.personality.creative * 0.3) / 100;
        const baseScore = (10 - Math.abs(estimatedComplexity - 5)) / 10;
        return Math.min(baseScore + capabilityBonus + autonomyBonus + personalityBonus, 1.0);
    }
    scoreAutonomyLevel(autonomyLevel, riskLevel) {
        const scores = {
            'low': { 'supervised': 0.6, 'semi-autonomous': 0.9, 'fully-autonomous': 1.0 },
            'medium': { 'supervised': 0.8, 'semi-autonomous': 1.0, 'fully-autonomous': 0.7 },
            'high': { 'supervised': 1.0, 'semi-autonomous': 0.6, 'fully-autonomous': 0.3 }
        };
        return scores[riskLevel][autonomyLevel];
    }
    scorePersonalityFit(personality, urgency, estimatedComplexity) {
        let score = 0;
        const urgencyWeights = {
            'low': { proactive: 0.3, collaborative: 0.5 },
            'normal': { proactive: 0.5, collaborative: 0.4 },
            'high': { proactive: 0.8, collaborative: 0.3 },
            'critical': { proactive: 1.0, collaborative: 0.2 }
        };
        const urgencyWeight = urgencyWeights[urgency];
        score += (personality.proactive / 100) * urgencyWeight.proactive * 0.4;
        score += (personality.collaborative / 100) * urgencyWeight.collaborative * 0.2;
        if (estimatedComplexity >= 7) {
            score += (personality.analytical / 100) * 0.3;
            score += (personality.creative / 100) * 0.1;
        }
        else {
            score += (personality.analytical / 100) * 0.2;
            score += (personality.creative / 100) * 0.2;
        }
        return Math.min(score, 1.0);
    }
    scoreWorkingStyle(workingStyle, estimatedComplexity) {
        const styleScores = {
            'sequential': estimatedComplexity <= 5 ? 0.8 : 0.4,
            'parallel': estimatedComplexity >= 5 ? 0.9 : 0.5,
            'adaptive': 0.85
        };
        return styleScores[workingStyle];
    }
    scoreContextScope(contextScope, requiredCapabilities) {
        const complexCapabilities = ['full-stack-development', 'architecture-review', 'system-administration'];
        const needsLargeScope = requiredCapabilities.some(cap => complexCapabilities.includes(cap));
        if (needsLargeScope) {
            return { 'file': 0.3, 'directory': 0.6, 'project': 0.9, 'workspace': 1.0 }[contextScope];
        }
        else {
            return { 'file': 1.0, 'directory': 0.9, 'project': 0.7, 'workspace': 0.5 }[contextScope];
        }
    }
    scoreRecentPerformance(agentName) {
        return 0.75;
    }
    scoreAvailability(agentName) {
        const agent = this.instances.get(agentName);
        if (!agent)
            return 0;
        return agent.isActive() ? 0.3 : 1.0;
    }
    scoreFreshness(createdAt) {
        const daysSinceCreation = (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
        return Math.max(0, 1 - (daysSinceCreation / 30));
    }
    generateSelectionReasoning(primary, secondary, primaryReasons) {
        const blueprint = primary.getBlueprint();
        let reasoning = `Selected **${blueprint.name}** as primary agent because:\n`;
        reasoning += primaryReasons.map(reason => `• ${reason}`).join('\n');
        if (secondary.length > 0) {
            reasoning += `\n\nSecondary agents available for collaboration:\n`;
            reasoning += secondary.map(agent => `• ${agent.getBlueprint().name} (${agent.getBlueprint().specialization})`).join('\n');
        }
        reasoning += `\n\nAgent characteristics:\n`;
        reasoning += `• Autonomy Level: ${blueprint.autonomyLevel}\n`;
        reasoning += `• Working Style: ${blueprint.workingStyle}\n`;
        reasoning += `• Context Scope: ${blueprint.contextScope}\n`;
        reasoning += `• Capabilities: ${blueprint.capabilities.length} total`;
        return reasoning;
    }
    async rebalanceAgentSelection(taskId, currentPrimary, performanceMetrics) {
        console.log(chalk_1.default.yellow(`🔄 Evaluating agent rebalancing for task ${taskId}...`));
        const shouldRebalance = (performanceMetrics.executionTime > 300000 ||
            performanceMetrics.successRate < 0.7 ||
            performanceMetrics.errorCount > 3);
        if (!shouldRebalance) {
            return {
                shouldRebalance: false,
                reasoning: 'Current agent performance is satisfactory - no rebalancing needed'
            };
        }
        const alternatives = this.getActiveAgents()
            .filter(agent => agent.id !== currentPrimary.id)
            .filter(agent => !agent.isActive());
        if (alternatives.length === 0) {
            return {
                shouldRebalance: false,
                reasoning: 'No alternative agents available for rebalancing'
            };
        }
        const newPrimary = alternatives[0];
        console.log(chalk_1.default.green(`✅ Rebalancing recommended: ${currentPrimary.getBlueprint().name} → ${newPrimary.getBlueprint().name}`));
        return {
            shouldRebalance: true,
            newPrimary,
            reasoning: `Switching from ${currentPrimary.getBlueprint().name} to ${newPrimary.getBlueprint().name} due to performance issues`
        };
    }
    getSelectionAnalytics() {
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
exports.AgentFactory = AgentFactory;
exports.agentFactory = new AgentFactory();
