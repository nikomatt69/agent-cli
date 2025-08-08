"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const events_1 = require("events");
const types_1 = require("../core/types");
/**
 * Base agent class that all agents should extend
 */
class BaseAgent extends events_1.EventEmitter {
    constructor(id, name, description, capabilities = []) {
        super();
        this.currentTask = null;
        this.id = id;
        this.name = name;
        this.description = description;
        this.capabilities = capabilities;
        this.status = types_1.AgentStatus.IDLE;
    }
    /**
     * Initialize the agent
     */
    async initialize() {
        this.status = types_1.AgentStatus.IDLE;
        this.emit('initialized', { agentId: this.id });
    }
    /**
     * Execute a task
     */
    async executeTask(task) {
        this.currentTask = task;
        this.status = types_1.AgentStatus.RUNNING;
        this.emit('taskStarted', { agentId: this.id, taskId: task.id });
        try {
            const result = await this.performTask(task);
            this.status = types_1.AgentStatus.COMPLETED;
            this.currentTask = null;
            this.emit('taskCompleted', { agentId: this.id, taskId: task.id, result });
            return result;
        }
        catch (error) {
            this.status = types_1.AgentStatus.ERROR;
            this.currentTask = null;
            this.emit('taskError', { agentId: this.id, taskId: task.id, error });
            throw error;
        }
    }
    /**
     * Check if agent can handle a specific task
     */
    canHandle(task) {
        return this.capabilities.length === 0 ||
            this.capabilities.some(cap => task.description.toLowerCase().includes(cap.toLowerCase()));
    }
    /**
     * Get agent information
     */
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            capabilities: this.capabilities,
            status: this.status,
            lastActivity: new Date()
        };
    }
    /**
     * Get current status
     */
    getStatus() {
        return this.status;
    }
    /**
     * Get current task
     */
    getCurrentTask() {
        return this.currentTask;
    }
    /**
     * Stop the agent
     */
    async stop() {
        if (this.currentTask) {
            this.currentTask.status = types_1.TaskStatus.CANCELLED;
        }
        this.status = types_1.AgentStatus.IDLE;
        this.currentTask = null;
        this.emit('stopped', { agentId: this.id });
    }
    /**
     * Pause the agent
     */
    async pause() {
        this.status = types_1.AgentStatus.PAUSED;
        this.emit('paused', { agentId: this.id });
    }
    /**
     * Resume the agent
     */
    async resume() {
        this.status = types_1.AgentStatus.RUNNING;
        this.emit('resumed', { agentId: this.id });
    }
}
exports.BaseAgent = BaseAgent;
