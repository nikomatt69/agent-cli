"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutonomousOrchestrator = void 0;
const base_agent_1 = require("./base-agent");
const model_provider_1 = require("../ai/model-provider");
const chalk_1 = __importDefault(require("chalk"));
const zod_1 = require("zod");
const TaskPlanSchema = zod_1.z.object({
    tasks: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        description: zod_1.z.string(),
        agent: zod_1.z.string(),
        priority: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
        dependencies: zod_1.z.array(zod_1.z.string()).optional(),
        estimatedTime: zod_1.z.string().optional(),
    })),
    reasoning: zod_1.z.string(),
    executionOrder: zod_1.z.array(zod_1.z.string()),
});
class AutonomousOrchestrator extends base_agent_1.BaseAgent {
    constructor(agentManager) {
        super();
        this.name = 'autonomous-orchestrator';
        this.description = 'Autonomous agent orchestrator that plans and executes complex multi-agent tasks';
        this.runningTasks = new Map();
        this.agentManager = agentManager;
    }
    async planTasks(userRequest) {
        const availableAgents = this.agentManager.getAvailableAgentNames();
        const messages = [
            {
                role: 'system',
                content: `You are an intelligent task orchestrator. Given a user request, break it down into specific tasks that can be executed by available AI agents.

Available agents: ${availableAgents.join(', ')}

Agent capabilities:
- coding-agent: General coding tasks, analysis, generation, optimization
- react-expert: React/Next.js development, components, hooks, state management
- backend-expert: Node.js, APIs, databases, server architecture
- devops-expert: CI/CD, Docker, Kubernetes, cloud deployment
- ai-analysis: General code analysis
- code-generator: Code generation
- code-review: Code review and quality assessment
- optimization: Performance optimization

Create a task plan with:
- Specific, actionable tasks
- Appropriate agent assignment for each task
- Task priorities and dependencies
- Logical execution order

Consider parallel execution where possible.`,
            },
            {
                role: 'user',
                content: `Plan tasks for: ${userRequest}`,
            },
        ];
        try {
            return await model_provider_1.modelProvider.generateStructured({
                messages,
                schema: TaskPlanSchema,
                schemaName: 'TaskPlan',
                schemaDescription: 'Structured plan for multi-agent task execution',
            });
        }
        catch (error) {
            return {
                error: `Failed to plan tasks: ${error.message}`,
                userRequest,
            };
        }
    }
    async executeTaskPlan(plan) {
        if (!plan.tasks || !Array.isArray(plan.tasks)) {
            throw new Error('Invalid task plan');
        }
        console.log(chalk_1.default.blue.bold('\n🚀 Starting autonomous task execution'));
        console.log(chalk_1.default.gray(`Executing ${plan.tasks.length} tasks`));
        console.log(chalk_1.default.gray(`Strategy: ${plan.reasoning}`));
        const results = [];
        const completedTasks = new Set();
        // Execute tasks according to dependencies and priorities
        for (const taskId of plan.executionOrder) {
            const task = plan.tasks.find((t) => t.id === taskId);
            if (!task)
                continue;
            // Check if dependencies are met
            if (task.dependencies) {
                const unmetDeps = task.dependencies.filter((dep) => !completedTasks.has(dep));
                if (unmetDeps.length > 0) {
                    console.log(chalk_1.default.yellow(`⏳ Waiting for dependencies: ${unmetDeps.join(', ')}`));
                    continue;
                }
            }
            // Execute task
            const result = await this.executeTask(task);
            results.push(result);
            if (result.success) {
                completedTasks.add(task.id);
                console.log(chalk_1.default.green(`✅ Task ${task.id} completed (${result.duration}ms)`));
            }
            else {
                console.log(chalk_1.default.red(`❌ Task ${task.id} failed: ${result.error}`));
            }
        }
        return results;
    }
    async executeTask(task) {
        const startTime = new Date();
        console.log(chalk_1.default.cyan(`🔄 Starting task: ${task.description} (${task.agent})`));
        try {
            const agent = this.agentManager.getAgent(task.agent);
            if (!agent) {
                throw new Error(`Agent ${task.agent} not found`);
            }
            await agent.initialize();
            const result = await agent.run(task.description);
            await agent.cleanup();
            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();
            return {
                taskId: task.id,
                agent: task.agent,
                success: true,
                result,
                startTime,
                endTime,
                duration,
            };
        }
        catch (error) {
            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();
            return {
                taskId: task.id,
                agent: task.agent,
                success: false,
                error: error.message,
                startTime,
                endTime,
                duration,
            };
        }
    }
    async executeParallelTasks(tasks) {
        console.log(chalk_1.default.blue.bold(`\n⚡ Executing ${tasks.length} tasks in parallel`));
        const promises = tasks.map(task => this.executeTask(task));
        const results = await Promise.all(promises);
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        console.log(chalk_1.default.green(`✅ Parallel execution complete: ${successful} successful, ${failed} failed`));
        return results;
    }
    async run(task) {
        if (!task) {
            return {
                message: 'Autonomous Orchestrator ready! I can break down complex requests into multi-agent workflows.',
                capabilities: [
                    'Task planning and decomposition',
                    'Multi-agent coordination',
                    'Parallel task execution',
                    'Dependency management',
                    'Progress monitoring',
                ],
            };
        }
        try {
            // Plan the tasks
            console.log(chalk_1.default.blue('🧠 Planning task execution...'));
            const plan = await this.planTasks(task);
            if (plan.error) {
                return plan;
            }
            console.log(chalk_1.default.blue.bold('\n📋 Task Plan:'));
            plan.tasks.forEach((t, index) => {
                const priority = t.priority === 'critical' ? chalk_1.default.red('🔴') :
                    t.priority === 'high' ? chalk_1.default.yellow('🟡') :
                        chalk_1.default.green('🟢');
                console.log(`${index + 1}. ${priority} ${t.description} → ${chalk_1.default.cyan(t.agent)}`);
            });
            console.log(chalk_1.default.gray(`\nReasoning: ${plan.reasoning}`));
            // Ask for confirmation in interactive mode
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            const confirm = await new Promise((resolve) => {
                readline.question(chalk_1.default.yellow('\nProceed with execution? (y/N): '), (answer) => {
                    readline.close();
                    resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
                });
            });
            if (!confirm) {
                console.log(chalk_1.default.yellow('Execution cancelled'));
                return { cancelled: true, plan };
            }
            // Execute the plan
            const results = await this.executeTaskPlan(plan);
            // Summary
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
            console.log(chalk_1.default.blue.bold('\n📊 Execution Summary:'));
            console.log(chalk_1.default.green(`✅ Successful tasks: ${successful}`));
            console.log(chalk_1.default.red(`❌ Failed tasks: ${failed}`));
            console.log(chalk_1.default.gray(`⏱️  Total time: ${totalTime}ms`));
            return {
                plan,
                results,
                summary: {
                    totalTasks: results.length,
                    successful,
                    failed,
                    totalTime,
                },
            };
        }
        catch (error) {
            return {
                error: `Orchestration failed: ${error.message}`,
                task,
            };
        }
    }
}
exports.AutonomousOrchestrator = AutonomousOrchestrator;
