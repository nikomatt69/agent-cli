"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const event_bus_1 = require("./event-bus");
const tool_registry_1 = require("../../tools/tool-registry");
const cli_ui_1 = require("../../utils/cli-ui");
class BaseAgent {
    constructor(workingDirectory) {
        this.status = 'offline';
        this.currentTasks = 0;
        this.maxConcurrentTasks = 3;
        this.taskHistory = [];
        this.eventBus = event_bus_1.EventBus.getInstance();
        this.toolRegistry = new tool_registry_1.ToolRegistry(workingDirectory);
        this.agentMetrics = {
            tasksExecuted: 0,
            tasksSucceeded: 0,
            tasksFailed: 0,
            averageExecutionTime: 0,
            totalExecutionTime: 0,
            lastActive: new Date()
        };
    }
    async initialize() {
        try {
            cli_ui_1.CliUI.logInfo(`🤖 Initializing agent: ${this.id}`);
            this.setupEventListeners();
            await this.onInitialize();
            this.status = 'available';
            await this.eventBus.publish(event_bus_1.EventTypes.AGENT_STARTED, {
                agentId: this.id,
                capabilities: this.capabilities,
                specialization: this.specialization
            });
            cli_ui_1.CliUI.logSuccess(`✅ Agent ${this.id} initialized successfully`);
        }
        catch (error) {
            this.status = 'error';
            cli_ui_1.CliUI.logError(`❌ Failed to initialize agent ${this.id}: ${error.message}`);
            throw error;
        }
    }
    async executeTask(task) {
        const execution = {
            taskId: task.id,
            startTime: new Date(),
            status: 'running'
        };
        this.taskHistory.push(execution);
        this.currentTasks++;
        this.agentMetrics.tasksExecuted++;
        this.agentMetrics.lastActive = new Date();
        try {
            cli_ui_1.CliUI.logInfo(`🎯 Agent ${this.id} executing task: ${task.type}`);
            await this.validateTask(task);
            await this.eventBus.publish(event_bus_1.EventTypes.TASK_STARTED, {
                taskId: task.id,
                agentId: this.id,
                taskType: task.type
            });
            const result = await this.onExecuteTask(task);
            execution.endTime = new Date();
            execution.status = 'completed';
            execution.result = result;
            execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
            this.agentMetrics.tasksSucceeded++;
            this.updateAverageExecutionTime(execution.duration);
            await this.eventBus.publish(event_bus_1.EventTypes.TASK_COMPLETED, {
                taskId: task.id,
                agentId: this.id,
                result,
                duration: execution.duration
            });
            cli_ui_1.CliUI.logSuccess(`✅ Task ${task.id} completed in ${execution.duration}ms`);
            return result;
        }
        catch (error) {
            execution.endTime = new Date();
            execution.status = 'failed';
            execution.error = error.message;
            execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
            this.agentMetrics.tasksFailed++;
            await this.eventBus.publish(event_bus_1.EventTypes.TASK_FAILED, {
                taskId: task.id,
                agentId: this.id,
                error: error.message,
                duration: execution.duration
            });
            cli_ui_1.CliUI.logError(`❌ Task ${task.id} failed: ${error.message}`);
            throw error;
        }
        finally {
            this.currentTasks = Math.max(0, this.currentTasks - 1);
            if (this.currentTasks < this.maxConcurrentTasks) {
                this.status = 'available';
            }
        }
    }
    async stop() {
        try {
            cli_ui_1.CliUI.logInfo(`🛑 Stopping agent: ${this.id}`);
            while (this.currentTasks > 0) {
                cli_ui_1.CliUI.logInfo(`⏳ Waiting for ${this.currentTasks} tasks to complete...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            await this.onStop();
            this.status = 'offline';
            await this.eventBus.publish(event_bus_1.EventTypes.AGENT_STOPPED, {
                agentId: this.id
            });
            cli_ui_1.CliUI.logSuccess(`✅ Agent ${this.id} stopped successfully`);
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to stop agent ${this.id}: ${error.message}`);
            throw error;
        }
    }
    getMetrics() {
        return { ...this.agentMetrics };
    }
    getTaskHistory(limit) {
        const history = [...this.taskHistory].reverse();
        return limit ? history.slice(0, limit) : history;
    }
    canHandle(taskType) {
        return this.capabilities.some(cap => taskType.toLowerCase().includes(cap.toLowerCase()) ||
            cap.toLowerCase().includes(taskType.toLowerCase())) || this.specialization.toLowerCase().includes(taskType.toLowerCase());
    }
    async executeTool(toolName, ...args) {
        const tool = this.toolRegistry.getTool(toolName);
        if (!tool) {
            throw new Error(`Tool not found: ${toolName}`);
        }
        cli_ui_1.CliUI.logDebug(`🔧 Agent ${this.id} executing tool: ${toolName}`);
        try {
            const result = await tool.execute(...args);
            await this.eventBus.publish(event_bus_1.EventTypes.TOOL_EXECUTED, {
                agentId: this.id,
                toolName,
                args,
                result
            });
            return result;
        }
        catch (error) {
            await this.eventBus.publish(event_bus_1.EventTypes.TOOL_FAILED, {
                agentId: this.id,
                toolName,
                args,
                error: error.message
            });
            throw error;
        }
    }
    async sendMessage(targetAgentId, message) {
        await this.eventBus.publish(event_bus_1.EventTypes.AGENT_MESSAGE, {
            fromAgent: this.id,
            toAgent: targetAgentId,
            message
        });
    }
    async broadcast(message) {
        await this.eventBus.publish(event_bus_1.EventTypes.AGENT_MESSAGE, {
            fromAgent: this.id,
            toAgent: 'all',
            message
        });
    }
    async run(task) {
        return await this.onExecuteTask({
            id: `task_${Date.now()}`,
            type: 'legacy',
            description: 'Legacy agent task',
            priority: 'normal'
        });
    }
    async cleanup() {
        return await this.onStop();
    }
    async validateTask(task) {
        if (!this.canHandle(task.type)) {
            throw new Error(`Agent ${this.id} cannot handle task type: ${task.type}`);
        }
        if (this.currentTasks >= this.maxConcurrentTasks) {
            throw new Error(`Agent ${this.id} is at maximum capacity`);
        }
        if (this.status !== 'available' && this.status !== 'busy') {
            throw new Error(`Agent ${this.id} is not available (status: ${this.status})`);
        }
    }
    setupEventListeners() {
        this.eventBus.subscribe(event_bus_1.EventTypes.AGENT_MESSAGE, async (event) => {
            const { toAgent, fromAgent, message } = event.data;
            if (toAgent === this.id || toAgent === 'all') {
                await this.onMessage(fromAgent, message);
            }
        });
        this.eventBus.subscribe(event_bus_1.EventTypes.SYSTEM_SHUTDOWN, async () => {
            await this.stop();
        });
    }
    async onMessage(fromAgent, message) {
        cli_ui_1.CliUI.logDebug(`📨 Agent ${this.id} received message from ${fromAgent}:`, message);
    }
    updateAverageExecutionTime(duration) {
        this.agentMetrics.totalExecutionTime += duration;
        this.agentMetrics.averageExecutionTime =
            this.agentMetrics.totalExecutionTime / this.agentMetrics.tasksExecuted;
    }
}
exports.BaseAgent = BaseAgent;
