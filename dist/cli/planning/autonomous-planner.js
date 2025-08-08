"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutonomousPlanner = void 0;
const advanced_ai_provider_1 = require("../ai/advanced-ai-provider");
const workspace_rag_1 = require("../context/workspace-rag");
const nanoid_1 = require("nanoid");
const chalk_1 = __importDefault(require("chalk"));
const events_1 = require("events");
class AutonomousPlanner extends events_1.EventEmitter {
    constructor(workspacePath) {
        super();
        this.activePlans = new Map();
        this.executionHistory = [];
        this.toolchainRegistry = new Map();
        this.workspaceRAG = new workspace_rag_1.WorkspaceRAG(workspacePath);
        this.initializeToolchains();
    }
    initializeToolchains() {
        // Register common toolchains
        this.toolchainRegistry.set('create-react-component', {
            name: 'Create React Component',
            description: 'Create a React component with TypeScript and styling',
            tools: ['analyze_project', 'generate_code', 'write_file', 'execute_command'],
            pattern: 'sequential'
        });
        this.toolchainRegistry.set('setup-api-endpoint', {
            name: 'Setup API Endpoint',
            description: 'Create API endpoint with validation and error handling',
            tools: ['read_file', 'analyze_project', 'generate_code', 'write_file', 'manage_packages'],
            pattern: 'sequential'
        });
        this.toolchainRegistry.set('add-testing', {
            name: 'Add Testing Suite',
            description: 'Set up comprehensive testing for the project',
            tools: ['analyze_project', 'manage_packages', 'generate_code', 'write_file', 'execute_command'],
            pattern: 'parallel-then-sequential'
        });
        this.toolchainRegistry.set('optimize-performance', {
            name: 'Optimize Performance',
            description: 'Analyze and optimize application performance',
            tools: ['analyze_project', 'read_file', 'execute_command', 'generate_code', 'write_file'],
            pattern: 'analyze-then-fix'
        });
        this.toolchainRegistry.set('fix-errors', {
            name: 'Fix Errors',
            description: 'Analyze and fix TypeScript/ESLint errors',
            tools: ['execute_command', 'read_file', 'generate_code', 'write_file', 'execute_command'],
            pattern: 'iterative'
        });
    }
    // Main planning method - like Claude's internal planning
    async *createAndExecutePlan(userGoal, context) {
        const planId = (0, nanoid_1.nanoid)();
        yield {
            type: 'plan_start',
            planId,
            content: `🎯 Creating autonomous plan for: ${userGoal}`
        };
        try {
            // 1. Analyze the goal and workspace context
            const workspaceContext = this.workspaceRAG.getContextForTask(userGoal);
            // 2. Generate execution plan using AI
            const plan = await this.generateExecutionPlan(planId, userGoal, workspaceContext);
            this.activePlans.set(planId, plan);
            yield {
                type: 'plan_created',
                planId,
                content: `📋 Plan created with ${plan.todos.length} steps`,
                metadata: { todos: plan.todos.length, estimatedDuration: plan.estimatedTotalDuration }
            };
            // 3. Execute the plan autonomously
            yield* this.executePlan(plan);
        }
        catch (error) {
            yield {
                type: 'plan_failed',
                planId,
                error: error.message,
                content: `❌ Planning failed: ${error.message}`
            };
        }
    }
    async generateExecutionPlan(planId, goal, workspaceContext) {
        console.log(chalk_1.default.blue('🧠 AI Planning: Analyzing goal and creating execution plan...'));
        // Use AI to break down the goal into actionable todos
        const planningMessages = [
            {
                role: 'system',
                content: `You are an expert autonomous planner that breaks down development goals into executable todos.

WORKSPACE CONTEXT:
${JSON.stringify(workspaceContext.projectInfo, null, 2)}

RELEVANT FILES:
${workspaceContext.relevantFiles.map((f) => `- ${f.path}: ${f.summary}`).join('\n')}

AVAILABLE TOOLCHAINS:
${Array.from(this.toolchainRegistry.entries()).map(([key, chain]) => `- ${key}: ${chain.description} (tools: ${chain.tools.join(', ')})`).join('\n')}

AVAILABLE TOOLS:
- read_file: Read and analyze file contents
- write_file: Create or modify files
- explore_directory: Explore project structure
- execute_command: Run terminal commands
- analyze_project: Comprehensive project analysis
- manage_packages: Install/manage dependencies
- generate_code: Generate code with context awareness

Your task: Create a detailed execution plan for the goal "${goal}".

Response format (JSON):
{
  "reasoning": "Why this plan will achieve the goal",
  "todos": [
    {
      "id": "todo-1",
      "title": "Clear, actionable title",
      "description": "Detailed description of what to do",
      "tools": ["tool1", "tool2"],
      "dependencies": [],
      "reasoning": "Why this step is needed",
      "priority": "high|medium|low",
      "estimatedDuration": 30000
    }
  ],
  "toolchains": ["toolchain-name"],
  "estimatedDuration": 180000
}

Create a plan that is:
1. Specific and actionable
2. Uses appropriate tools for each task
3. Considers project context and existing patterns
4. Has proper step dependencies
5. Is realistic in timing estimates

IMPORTANT: Only use tools that are actually available. Be specific about file paths and commands.`
            },
            {
                role: 'user',
                content: goal
            }
        ];
        // Execute planning task and collect response
        let fullResponse = '';
        for await (const event of advanced_ai_provider_1.advancedAIProvider.executeAutonomousTask(planningMessages.join('\n'))) {
            if (event.type === 'text_delta' && event.content) {
                fullResponse += event.content;
            }
        }
        // Parse AI response into execution plan
        let planData;
        try {
            // Extract JSON from AI response
            const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('AI did not return valid JSON plan');
            }
            planData = JSON.parse(jsonMatch[0]);
        }
        catch (error) {
            throw new Error(`Failed to parse AI plan: ${error}`);
        }
        // Convert to ExecutionPlan format
        const todos = planData.todos.map((todo) => ({
            id: todo.id || (0, nanoid_1.nanoid)(),
            title: todo.title,
            description: todo.description,
            tools: todo.tools || [],
            dependencies: todo.dependencies || [],
            status: 'pending',
            reasoning: todo.reasoning || '',
            priority: todo.priority || 'medium',
        }));
        const plan = {
            id: planId,
            title: goal,
            description: goal,
            steps: [],
            status: 'pending',
            todos,
            estimatedTotalDuration: planData.estimatedDuration || 60000,
            riskAssessment: {
                overallRisk: planData.riskLevel || 'medium',
                destructiveOperations: 0,
                fileModifications: todos.length,
                externalCalls: 0
            },
            createdAt: new Date(),
            createdBy: 'autonomous-planner',
            context: {
                userRequest: goal,
                projectPath: workspaceContext.projectPath || process.cwd(),
                reasoning: planData.reasoning
            }
        };
        return plan;
    }
    async *executePlan(plan) {
        plan.status = 'running';
        let completedTodos = 0;
        try {
            // Execute todos based on dependencies
            const todoQueue = [...plan.todos];
            const completed = new Set();
            while (todoQueue.length > 0) {
                // Find todos ready to execute (dependencies satisfied)
                const readyTodos = todoQueue.filter(todo => todo?.dependencies?.every(dep => completed.has(dep)));
                if (readyTodos.length === 0) {
                    // Check if we're stuck due to failed dependencies
                    const remainingTodos = todoQueue.filter(todo => todo.status !== 'completed');
                    if (remainingTodos.length > 0) {
                        throw new Error('Circular dependencies or failed dependencies detected');
                    }
                    break;
                }
                // Execute ready todos (can be parallel if no inter-dependencies)
                for (const todo of readyTodos) {
                    yield {
                        type: 'todo_start',
                        planId: plan.id,
                        todoId: todo.id,
                        content: `🔧 Executing: ${todo.title}`
                    };
                    try {
                        // Execute the todo using toolchain
                        const result = await this.executeTodo(todo, plan.context);
                        todo.status = 'completed';
                        todo.completedAt = new Date();
                        completed.add(todo.id);
                        completedTodos++;
                        yield {
                            type: 'todo_complete',
                            planId: plan.id,
                            todoId: todo.id,
                            content: `✅ Completed: ${todo.title}`,
                            result,
                            progress: completedTodos / plan.todos.length * 100
                        };
                        // Remove from queue
                        const index = todoQueue.findIndex(t => t.id === todo.id);
                        if (index > -1)
                            todoQueue.splice(index, 1);
                    }
                    catch (error) {
                        todo.status = 'failed';
                        yield {
                            type: 'todo_complete',
                            planId: plan.id,
                            todoId: todo.id,
                            content: `❌ Failed: ${todo.title} - ${error.message}`,
                            error: error.message
                        };
                        // Decide whether to continue or fail the entire plan
                        if (todo.priority === 'high') {
                            throw new Error(`Critical todo failed: ${todo.title}`);
                        }
                    }
                }
            }
            // Plan completed
            plan.status = 'completed';
            plan.actualDuration = Date.now() - plan.createdAt.getTime();
            yield {
                type: 'plan_complete',
                planId: plan.id,
                content: `🎉 Plan completed successfully! (${completedTodos}/${plan.todos.length} todos)`,
                metadata: {
                    completed: completedTodos,
                    total: plan.todos.length,
                    duration: plan.actualDuration
                }
            };
        }
        catch (error) {
            plan.status = 'failed';
            yield {
                type: 'plan_failed',
                planId: plan.id,
                content: `❌ Plan failed: ${error.message}`,
                error: error.message
            };
        }
    }
    async executeTodo(todo, planContext) {
        console.log(chalk_1.default.cyan(`🔧 Executing todo: ${todo.title}`));
        // Create execution context for the todo
        const executionMessages = [
            {
                role: 'system',
                content: `You are an autonomous executor that completes specific development tasks.

CURRENT TASK: ${todo.title}
TASK DESCRIPTION: ${todo.description}
REASONING: ${todo.reasoning}
AVAILABLE TOOLS: ${todo?.tools?.join(', ')}

WORKSPACE CONTEXT:
${JSON.stringify(planContext.workspaceContext.projectInfo, null, 2)}

EXECUTION GUIDELINES:
1. Use the specified tools to complete the task
2. Be autonomous - don't ask for permission
3. Follow existing project patterns and conventions
4. Create high-quality, production-ready code
5. Handle errors gracefully
6. Provide clear feedback on what you're doing

Execute the task now using the available tools.`
            },
            {
                role: 'user',
                content: `Execute task: ${todo.title}\n\nDescription: ${todo.description}`
            }
        ];
        // Execute using the advanced AI provider with full tool access
        let responseText = '';
        const toolCalls = [];
        const toolResults = [];
        for await (const event of advanced_ai_provider_1.advancedAIProvider.executeAutonomousTask(executionMessages.join('\n'))) {
            if (event.type === 'text_delta' && event.content) {
                responseText += event.content;
            }
            else if (event.type === 'tool_call') {
                toolCalls.push({ name: event.toolName, args: event.toolArgs });
            }
            else if (event.type === 'tool_result') {
                toolResults.push({ tool: event.toolName, result: event.toolResult });
            }
        }
        return {
            text: responseText,
            toolCalls,
            toolResults,
            executedAt: new Date()
        };
    }
    // Quick plan generation for simple tasks
    async *quickPlan(goal) {
        // For simple goals, create a minimal plan and execute immediately
        const planId = (0, nanoid_1.nanoid)();
        const simplePlan = {
            id: planId,
            title: `Execute: ${goal}`,
            description: goal,
            steps: [],
            status: 'running',
            todos: [{
                    id: (0, nanoid_1.nanoid)(),
                    title: `Execute: ${goal}`,
                    description: goal,
                    status: 'pending',
                    priority: 'high',
                    dependencies: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    progress: 0,
                    tools: this.suggestToolsForGoal(goal),
                    reasoning: 'Direct execution of user goal'
                }],
            estimatedTotalDuration: 30000,
            riskAssessment: {
                overallRisk: 'low',
                destructiveOperations: 0,
                fileModifications: 0,
                externalCalls: 0
            },
            createdAt: new Date(),
            createdBy: 'autonomous-planner',
            context: {
                userRequest: goal,
                projectPath: process.cwd(),
                simple: true
            }
        };
        this.activePlans.set(planId, simplePlan);
        yield { type: 'plan_start', planId, content: `🚀 Quick execution: ${goal}` };
        yield* this.executePlan(simplePlan);
    }
    suggestToolsForGoal(goal) {
        const goalLower = goal.toLowerCase();
        const tools = [];
        // Smart tool suggestion based on goal
        if (goalLower.includes('read') || goalLower.includes('analyze')) {
            tools.push('read_file', 'analyze_project');
        }
        if (goalLower.includes('create') || goalLower.includes('generate')) {
            tools.push('analyze_project', 'generate_code', 'write_file');
        }
        if (goalLower.includes('install') || goalLower.includes('package')) {
            tools.push('manage_packages');
        }
        if (goalLower.includes('run') || goalLower.includes('command') || goalLower.includes('test')) {
            tools.push('execute_command');
        }
        if (goalLower.includes('fix') || goalLower.includes('error')) {
            tools.push('read_file', 'execute_command', 'write_file');
        }
        // Default tools if no specific match
        if (tools.length === 0) {
            tools.push('analyze_project', 'read_file', 'generate_code', 'write_file');
        }
        return [...new Set(tools)];
    }
    // Get planning insights for the chat
    getPlanningInsights(goal) {
        const goalLower = goal.toLowerCase();
        const suggestedToolchains = [];
        let complexity = 'simple';
        // Analyze goal complexity
        const complexityIndicators = [
            'full-stack', 'complete', 'comprehensive', 'entire', 'whole', 'all'
        ];
        const mediumComplexityIndicators = [
            'component', 'api', 'endpoint', 'feature', 'page', 'service'
        ];
        if (complexityIndicators.some(indicator => goalLower.includes(indicator))) {
            complexity = 'complex';
        }
        else if (mediumComplexityIndicators.some(indicator => goalLower.includes(indicator))) {
            complexity = 'medium';
        }
        // Suggest toolchains
        if (goalLower.includes('component') || goalLower.includes('react')) {
            suggestedToolchains.push('create-react-component');
        }
        if (goalLower.includes('api') || goalLower.includes('endpoint')) {
            suggestedToolchains.push('setup-api-endpoint');
        }
        if (goalLower.includes('test') || goalLower.includes('testing')) {
            suggestedToolchains.push('add-testing');
        }
        if (goalLower.includes('fix') || goalLower.includes('error')) {
            suggestedToolchains.push('fix-errors');
        }
        if (goalLower.includes('optimize') || goalLower.includes('performance')) {
            suggestedToolchains.push('optimize-performance');
        }
        const recommendedApproach = this.getRecommendedApproach(complexity, suggestedToolchains.length);
        return { suggestedToolchains, estimatedComplexity: complexity, recommendedApproach };
    }
    getRecommendedApproach(complexity, toolchainCount) {
        switch (complexity) {
            case 'simple':
                return 'Quick autonomous execution with minimal planning';
            case 'medium':
                return `Structured plan with ${toolchainCount > 0 ? 'specialized toolchains' : 'step-by-step execution'}`;
            case 'complex':
                return 'Comprehensive planning with multiple phases and toolchain orchestration';
            default:
                return 'Autonomous execution with adaptive planning';
        }
    }
    // Utility methods
    getActivePlans() {
        return Array.from(this.activePlans.values());
    }
    getPlan(planId) {
        return this.activePlans.get(planId);
    }
    getExecutionHistory() {
        return [...this.executionHistory];
    }
    // Update workspace context
    updateWorkspace() {
        this.workspaceRAG.analyzeWorkspace();
    }
}
exports.AutonomousPlanner = AutonomousPlanner;
