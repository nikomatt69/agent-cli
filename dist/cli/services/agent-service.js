"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentService = exports.AgentService = void 0;
const chalk_1 = __importDefault(require("chalk"));
const events_1 = require("events");
const tool_service_1 = require("./tool-service");
const planning_service_1 = require("./planning-service");
class AgentService extends events_1.EventEmitter {
    constructor() {
        super();
        this.agents = new Map();
        this.activeTasks = new Map();
        this.taskQueue = [];
        this.maxConcurrentAgents = 3;
        this.runningCount = 0;
        this.registerDefaultAgents();
    }
    registerDefaultAgents() {
        // AI Analysis Agent
        this.registerAgent({
            name: 'ai-analysis',
            description: 'AI code analysis and review',
            specialization: ['code-review', 'bug-detection', 'optimization'],
            maxConcurrency: 1,
            handler: this.aiAnalysisHandler.bind(this)
        });
        // Code Review Agent
        this.registerAgent({
            name: 'code-review',
            description: 'Code review and suggestions',
            specialization: ['code-quality', 'best-practices', 'security'],
            maxConcurrency: 1,
            handler: this.codeReviewHandler.bind(this)
        });
        // Backend Expert Agent
        this.registerAgent({
            name: 'backend-expert',
            description: 'Backend development specialist',
            specialization: ['api-design', 'database', 'performance'],
            maxConcurrency: 1,
            handler: this.backendExpertHandler.bind(this)
        });
        // Frontend Expert Agent
        this.registerAgent({
            name: 'frontend-expert',
            description: 'Frontend/UI development expert',
            specialization: ['ui-design', 'responsive', 'accessibility'],
            maxConcurrency: 1,
            handler: this.frontendExpertHandler.bind(this)
        });
        // React Expert Agent
        this.registerAgent({
            name: 'react-expert',
            description: 'React and Next.js specialist',
            specialization: ['react', 'nextjs', 'hooks', 'performance'],
            maxConcurrency: 1,
            handler: this.reactExpertHandler.bind(this)
        });
        // DevOps Expert Agent
        this.registerAgent({
            name: 'devops-expert',
            description: 'DevOps and infrastructure expert',
            specialization: ['docker', 'kubernetes', 'ci-cd', 'monitoring'],
            maxConcurrency: 1,
            handler: this.devopsExpertHandler.bind(this)
        });
        // System Admin Agent
        this.registerAgent({
            name: 'system-admin',
            description: 'System administration tasks',
            specialization: ['server-management', 'security', 'automation'],
            maxConcurrency: 1,
            handler: this.systemAdminHandler.bind(this)
        });
        // Autonomous Coder Agent
        this.registerAgent({
            name: 'autonomous-coder',
            description: 'Full autonomous coding agent',
            specialization: ['full-stack', 'architecture', 'implementation'],
            maxConcurrency: 1,
            handler: this.autonomousCoderHandler.bind(this)
        });
    }
    registerAgent(agent) {
        this.agents.set(agent.name, agent);
        console.log(chalk_1.default.dim(`🤖 Registered agent: ${agent.name}`));
    }
    async executeTask(agentType, task) {
        const agent = this.agents.get(agentType);
        if (!agent) {
            throw new Error(`Agent '${agentType}' not found`);
        }
        const taskId = Date.now().toString();
        const agentTask = {
            id: taskId,
            agentType,
            task,
            status: 'pending'
        };
        this.activeTasks.set(taskId, agentTask);
        // Check if we can run immediately or need to queue
        if (this.runningCount < this.maxConcurrentAgents) {
            await this.runTask(agentTask);
        }
        else {
            this.taskQueue.push(agentTask);
            console.log(chalk_1.default.yellow(`⏳ Task queued (${this.taskQueue.length} in queue)`));
        }
        return taskId;
    }
    async runTask(agentTask) {
        const agent = this.agents.get(agentTask.agentType);
        agentTask.status = 'running';
        agentTask.startTime = new Date();
        this.runningCount++;
        console.log(chalk_1.default.blue(`🤖 Starting ${agentTask.agentType} agent...`));
        this.emit('task_start', agentTask);
        try {
            const context = {
                taskId: agentTask.id,
                workingDirectory: process.cwd(),
                tools: tool_service_1.toolService,
                planning: planning_service_1.planningService
            };
            // Execute agent with streaming updates
            for await (const update of agent.handler(agentTask.task, context)) {
                if (update.type === 'progress') {
                    agentTask.progress = update.progress;
                    this.emit('task_progress', agentTask, update);
                }
                else if (update.type === 'tool_use') {
                    console.log(chalk_1.default.cyan(`  🔧 ${update.tool}: ${update.description}`));
                    this.emit('tool_use', agentTask, update);
                }
                else if (update.type === 'result') {
                    agentTask.result = update.data;
                    this.emit('task_result', agentTask, update);
                }
                else if (update.type === 'error') {
                    throw new Error(update.error);
                }
            }
            agentTask.status = 'completed';
            agentTask.endTime = new Date();
            const duration = agentTask.endTime.getTime() - agentTask.startTime.getTime();
            console.log(chalk_1.default.green(`✅ ${agentTask.agentType} completed (${duration}ms)`));
        }
        catch (error) {
            agentTask.status = 'failed';
            agentTask.error = error.message;
            agentTask.endTime = new Date();
            console.log(chalk_1.default.red(`❌ ${agentTask.agentType} failed: ${error.message}`));
        }
        finally {
            this.runningCount--;
            this.emit('task_complete', agentTask);
            // Start next queued task if available
            if (this.taskQueue.length > 0 && this.runningCount < this.maxConcurrentAgents) {
                const nextTask = this.taskQueue.shift();
                await this.runTask(nextTask);
            }
        }
    }
    getActiveAgents() {
        return Array.from(this.activeTasks.values()).filter(t => t.status === 'running');
    }
    getQueuedTasks() {
        return [...this.taskQueue];
    }
    getAvailableAgents() {
        return Array.from(this.agents.values());
    }
    getTaskStatus(taskId) {
        return this.activeTasks.get(taskId);
    }
    cancelTask(taskId) {
        const task = this.activeTasks.get(taskId);
        if (!task)
            return false;
        if (task.status === 'pending') {
            // Remove from queue
            const queueIndex = this.taskQueue.findIndex(t => t.id === taskId);
            if (queueIndex >= 0) {
                this.taskQueue.splice(queueIndex, 1);
                task.status = 'failed';
                task.error = 'Cancelled by user';
                return true;
            }
        }
        // Cannot cancel running tasks easily
        return false;
    }
    // Agent implementations (simplified for now)
    async *aiAnalysisHandler(task, context) {
        yield { type: 'progress', progress: 10 };
        // Analyze project structure
        yield { type: 'tool_use', tool: 'analyze_project', description: 'Analyzing project structure' };
        const projectAnalysis = await context.tools.executeTool('analyze_project', {});
        yield { type: 'progress', progress: 50 };
        // Read key files for analysis
        yield { type: 'tool_use', tool: 'find_files', description: 'Finding relevant code files' };
        const files = await context.tools.executeTool('find_files', { pattern: '.ts' });
        yield { type: 'progress', progress: 80 };
        // Perform analysis
        const analysis = {
            project: projectAnalysis,
            files: files.matches.slice(0, 5), // Limit for demo
            recommendations: [
                'Consider adding TypeScript strict mode',
                'Add unit tests for critical functions',
                'Implement error handling for async operations'
            ]
        };
        yield { type: 'progress', progress: 100 };
        yield { type: 'result', data: analysis };
    }
    async *codeReviewHandler(task, context) {
        yield { type: 'progress', progress: 20 };
        // Get git status
        yield { type: 'tool_use', tool: 'git_status', description: 'Checking git status' };
        const gitStatus = await context.tools.executeTool('git_status', {});
        yield { type: 'progress', progress: 60 };
        // Get diff for review
        if (gitStatus.files.length > 0) {
            yield { type: 'tool_use', tool: 'git_diff', description: 'Getting code changes' };
            const diff = await context.tools.executeTool('git_diff', {});
        }
        yield { type: 'progress', progress: 100 };
        yield { type: 'result', data: { reviewed: true, suggestions: ['Add comments', 'Handle edge cases'] } };
    }
    async *backendExpertHandler(task, context) {
        yield { type: 'progress', progress: 25 };
        yield { type: 'tool_use', tool: 'find_files', description: 'Finding backend files' };
        // Simulate backend analysis
        await new Promise(resolve => setTimeout(resolve, 1000));
        yield { type: 'progress', progress: 100 };
        yield { type: 'result', data: { expertise: 'backend', recommendations: ['Use proper error handling', 'Add request validation'] } };
    }
    async *frontendExpertHandler(task, context) {
        yield { type: 'progress', progress: 30 };
        yield { type: 'tool_use', tool: 'find_files', description: 'Finding frontend components' };
        await new Promise(resolve => setTimeout(resolve, 800));
        yield { type: 'progress', progress: 100 };
        yield { type: 'result', data: { expertise: 'frontend', recommendations: ['Improve accessibility', 'Optimize bundle size'] } };
    }
    async *reactExpertHandler(task, context) {
        yield { type: 'progress', progress: 40 };
        yield { type: 'tool_use', tool: 'find_files', description: 'Finding React components' };
        await new Promise(resolve => setTimeout(resolve, 1200));
        yield { type: 'progress', progress: 100 };
        yield { type: 'result', data: { expertise: 'react', recommendations: ['Use React.memo for optimization', 'Implement error boundaries'] } };
    }
    async *devopsExpertHandler(task, context) {
        yield { type: 'progress', progress: 35 };
        yield { type: 'tool_use', tool: 'find_files', description: 'Looking for deployment configs' };
        await new Promise(resolve => setTimeout(resolve, 1500));
        yield { type: 'progress', progress: 100 };
        yield { type: 'result', data: { expertise: 'devops', recommendations: ['Add Docker health checks', 'Set up monitoring'] } };
    }
    async *systemAdminHandler(task, context) {
        yield { type: 'progress', progress: 20 };
        yield { type: 'tool_use', tool: 'execute_command', description: 'Checking system status' };
        await new Promise(resolve => setTimeout(resolve, 1000));
        yield { type: 'progress', progress: 100 };
        yield { type: 'result', data: { expertise: 'sysadmin', recommendations: ['Update dependencies', 'Review security settings'] } };
    }
    async *autonomousCoderHandler(task, context) {
        yield { type: 'progress', progress: 10 };
        // Create execution plan
        yield { type: 'tool_use', tool: 'planning', description: 'Creating execution plan' };
        const plan = await context.planning.createPlan(task, { showProgress: false, autoExecute: false, confirmSteps: false });
        yield { type: 'progress', progress: 50 };
        // Execute plan steps
        for (let i = 0; i < Math.min(plan.steps.length, 3); i++) {
            const step = plan.steps[i];
            yield { type: 'tool_use', tool: step.toolName || 'general', description: step.description };
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        yield { type: 'progress', progress: 100 };
        yield { type: 'result', data: { plan, completed: true } };
    }
}
exports.AgentService = AgentService;
exports.agentService = new AgentService();
