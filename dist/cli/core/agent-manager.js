"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentManager = void 0;
const nanoid_1 = require("nanoid");
const events_1 = require("events");
const logger_1 = require("../utils/logger");
const guidance_manager_1 = require("../guidance/guidance-manager");
class AgentManager extends events_1.EventEmitter {
    constructor(configManager, guidanceManager) {
        super();
        this.agents = new Map();
        this.taskQueues = new Map();
        this.agentRegistry = new Map();
        this.activeTaskCount = 0;
        this.taskHistory = new Map();
        this.configManager = configManager;
        this.guidanceManager = guidanceManager || new guidance_manager_1.GuidanceManager(process.cwd());
        this.config = this.configManager.getConfig();
        this.setupEventHandlers();
    }
    async initialize() {
        await logger_1.logger.info('Initializing AgentManager', {
            maxConcurrentAgents: this.config.maxConcurrentAgents,
            enableGuidanceSystem: this.config.enableGuidanceSystem
        });
        if (this.config.enableGuidanceSystem) {
            await this.guidanceManager.initialize((context) => {
                this.onGuidanceUpdated(context);
            });
        }
        await logger_1.logger.info('AgentManager initialized successfully');
    }
    async registerAgent(agent) {
        await logger_1.logger.logAgent('info', agent.id, 'Registering agent', {
            name: agent.name,
            specialization: agent.specialization,
            capabilities: agent.capabilities
        });
        const context = await this.buildAgentContext(agent);
        await agent.initialize(context);
        this.agents.set(agent.id, agent);
        this.taskQueues.set(agent.id, []);
        this.emit('agent.registered', {
            id: (0, nanoid_1.nanoid)(),
            type: 'agent.initialized',
            agentId: agent.id,
            timestamp: new Date(),
            data: { agent: this.getAgentInfo(agent) }
        });
        await logger_1.logger.logAgent('info', agent.id, 'Agent registered successfully');
    }
    registerAgentClass(agentClass, metadata) {
        this.agentRegistry.set(metadata.id, {
            agentClass,
            metadata,
            isEnabled: true
        });
        logger_1.logger.info('Agent class registered', {
            agentId: metadata.id,
            name: metadata.name,
            specialization: metadata.specialization
        });
    }
    async createAgent(agentId, config) {
        const registryEntry = this.agentRegistry.get(agentId);
        if (!registryEntry) {
            throw new Error(`Agent class not found in registry: ${agentId}`);
        }
        if (!registryEntry.isEnabled) {
            throw new Error(`Agent class is disabled: ${agentId}`);
        }
        const agent = new registryEntry.agentClass(process.cwd());
        if (config) {
            agent.updateConfiguration(config);
        }
        await this.registerAgent(agent);
        return agent;
    }
    getAgent(agentId) {
        return this.agents.get(agentId);
    }
    listAgents() {
        return Array.from(this.agents.values()).map(agent => ({
            id: agent.id,
            name: agent.name,
            status: agent.status,
            specialization: agent.specialization,
            description: agent.description,
            capabilities: agent.capabilities,
            currentTasks: agent.currentTasks,
            metrics: agent.getMetrics()
        }));
    }
    getAvailableAgentNames() {
        return Array.from(this.agents.values()).map(agent => agent.name);
    }
    getAgentsByCapability(capability) {
        return Array.from(this.agents.values())
            .filter(agent => agent.capabilities.includes(capability));
    }
    findBestAgentForTask(task) {
        let bestAgent = null;
        let bestScore = 0;
        for (const agent of this.agents.values()) {
            if (agent.status !== 'ready' && agent.status !== 'busy') {
                continue;
            }
            if (agent.currentTasks >= agent.maxConcurrentTasks) {
                continue;
            }
            if (!agent.canHandle(task)) {
                continue;
            }
            let score = 0;
            if (task.requiredCapabilities) {
                const matchingCapabilities = task.requiredCapabilities.filter((cap) => agent.capabilities.includes(cap));
                score += matchingCapabilities.length * 10;
            }
            score += (agent.maxConcurrentTasks - agent.currentTasks) * 5;
            const metrics = agent.getMetrics();
            score += metrics.successRate * 2;
            if (score > bestScore) {
                bestScore = score;
                bestAgent = agent;
            }
        }
        return bestAgent;
    }
    async scheduleTask(task, preferredAgentId) {
        await logger_1.logger.logTask('info', task.id, preferredAgentId || 'auto', 'Scheduling task', {
            title: task.title,
            priority: task.priority,
            requiredCapabilities: task.requiredCapabilities
        });
        let agent = null;
        if (preferredAgentId) {
            agent = this.getAgent(preferredAgentId) || null;
            if (!agent || !agent.canHandle(task)) {
                throw new Error(`Preferred agent ${preferredAgentId} cannot handle this task`);
            }
        }
        else {
            agent = this.findBestAgentForTask(task);
            if (!agent) {
                throw new Error('No suitable agent available for this task');
            }
        }
        const queue = this.taskQueues.get(agent.id) || [];
        queue.push(task);
        this.taskQueues.set(agent.id, queue);
        await logger_1.logger.logTask('info', task.id, agent.id, 'Task scheduled', {
            queueLength: queue.length
        });
        if (agent.currentTasks < agent.maxConcurrentTasks) {
            setImmediate(() => this.processAgentQueue(agent.id));
        }
        return agent.id;
    }
    async executeTask(agentId, task) {
        const agent = this.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        if (!agent.canHandle(task)) {
            throw new Error(`Agent ${agentId} cannot handle this task`);
        }
        await logger_1.logger.logTask('info', task.id, agentId, 'Starting task execution');
        try {
            this.activeTaskCount++;
            task.status = 'in_progress';
            task.startedAt = new Date();
            const result = await agent.executeTask(task);
            this.taskHistory.set(task.id, result);
            await logger_1.logger.logTask('info', task.id, agentId, 'Task completed successfully', {
                duration: result.duration,
                status: result.status
            });
            return result;
        }
        catch (error) {
            const result = {
                taskId: task.id,
                agentId,
                status: 'failed',
                startTime: task.startedAt,
                endTime: new Date(),
                error: error.message,
                errorDetails: error
            };
            this.taskHistory.set(task.id, result);
            await logger_1.logger.logTask('error', task.id, agentId, 'Task failed', {
                error: error.message
            });
            throw error;
        }
        finally {
            this.activeTaskCount--;
        }
    }
    scheduleTodo(agentId, todo) {
        const task = {
            id: todo.id,
            type: 'internal',
            title: todo.title,
            description: todo.description,
            priority: todo.priority,
            status: todo.status,
            data: { todo },
            createdAt: todo.createdAt,
            updatedAt: todo.updatedAt,
            estimatedDuration: todo.estimatedDuration,
            progress: todo.progress
        };
        this.scheduleTask(task, agentId);
    }
    async runSequential() {
        await logger_1.logger.info('Starting sequential task execution');
        for (const [agentId, tasks] of this.taskQueues.entries()) {
            if (tasks.length === 0)
                continue;
            const agent = this.getAgent(agentId);
            if (!agent)
                continue;
            await logger_1.logger.logAgent('info', agentId, `Executing ${tasks.length} tasks sequentially`);
            for (const task of tasks) {
                try {
                    await this.executeTask(agentId, task);
                }
                catch (error) {
                    await logger_1.logger.logTask('error', task.id, agentId, 'Sequential execution failed', { error: error.message });
                }
            }
            this.taskQueues.set(agentId, []);
        }
        await logger_1.logger.info('Sequential task execution completed');
    }
    async runParallel(concurrency) {
        const maxConcurrency = concurrency || this.config.maxConcurrentAgents;
        await logger_1.logger.info('Starting parallel task execution', {
            maxConcurrency,
            totalTasks: this.getTotalPendingTasks()
        });
        const promises = [];
        for (const agentId of this.taskQueues.keys()) {
            if (promises.length >= (maxConcurrency || 5)) {
                await Promise.race(promises);
            }
            promises.push(this.processAgentQueue(agentId));
        }
        await Promise.all(promises);
        await logger_1.logger.info('Parallel task execution completed');
    }
    async processAgentQueue(agentId) {
        const agent = this.getAgent(agentId);
        const queue = this.taskQueues.get(agentId);
        if (!agent || !queue || queue.length === 0) {
            return;
        }
        while (queue.length > 0 && agent.currentTasks < agent.maxConcurrentTasks) {
            const task = queue.shift();
            try {
                await this.executeTask(agentId, task);
            }
            catch (error) {
                await logger_1.logger.logTask('error', task.id, agentId, 'Queue processing failed', { error: error.message });
            }
        }
    }
    async buildAgentContext(agent) {
        const guidance = this.config.enableGuidanceSystem ?
            this.guidanceManager.getContextForAgent(agent.specialization, process.cwd()) : '';
        return {
            workingDirectory: process.cwd(),
            projectPath: process.cwd(),
            guidance,
            configuration: {
                autonomyLevel: 'semi-autonomous',
                maxConcurrentTasks: agent.maxConcurrentTasks,
                defaultTimeout: this.config.defaultAgentTimeout || 300000,
                retryPolicy: {
                    maxAttempts: 3,
                    backoffMs: 1000,
                    backoffMultiplier: 2,
                    retryableErrors: ['NetworkError', 'TimeoutError']
                },
                enabledTools: [],
                guidanceFiles: [],
                logLevel: this.config.logLevel || 'info',
                permissions: {
                    canReadFiles: true,
                    canWriteFiles: this.config.sandbox.allowFileSystem,
                    canDeleteFiles: this.config.sandbox.allowFileSystem,
                    allowedPaths: [process.cwd()],
                    forbiddenPaths: ['/etc', '/usr', '/var'],
                    canExecuteCommands: this.config.sandbox.allowCommands,
                    allowedCommands: ['npm', 'git', 'ls', 'cat'],
                    forbiddenCommands: ['rm -rf', 'sudo', 'su'],
                    canAccessNetwork: this.config.sandbox.allowNetwork,
                    allowedDomains: [],
                    canInstallPackages: this.config.sandbox.allowFileSystem,
                    canModifyConfig: false,
                    canAccessSecrets: false
                },
                sandboxRestrictions: this.getSandboxRestrictions()
            },
            executionPolicy: {
                approval: 'moderate',
                sandbox: 'workspace-write',
                timeoutMs: this.config.defaultAgentTimeout || 300000,
                maxRetries: 3
            },
            approvalRequired: this.config.approvalPolicy === 'strict'
        };
    }
    getSandboxRestrictions() {
        const restrictions = [];
        if (!this.config.sandbox.enabled) {
            return restrictions;
        }
        if (!this.config.sandbox.allowFileSystem) {
            restrictions.push('no-file-write', 'no-file-delete');
        }
        if (!this.config.sandbox.allowNetwork) {
            restrictions.push('no-network-access');
        }
        if (!this.config.sandbox.allowCommands) {
            restrictions.push('no-command-execution');
        }
        return restrictions;
    }
    setupEventHandlers() {
        this.on('agent.registered', (event) => {
            logger_1.logger.info('Agent registered event', event);
        });
        this.on('task.completed', (event) => {
            logger_1.logger.info('Task completed event', event);
        });
        this.on('task.failed', (event) => {
            logger_1.logger.warn('Task failed event', event);
        });
    }
    onGuidanceUpdated(context) {
        logger_1.logger.info('Guidance context updated, notifying agents');
        for (const agent of this.agents.values()) {
            const guidance = this.guidanceManager.getContextForAgent(agent.specialization, process.cwd());
            agent.updateGuidance(guidance);
        }
    }
    getAgentInfo(agent) {
        return {
            id: agent.id,
            name: agent.name,
            specialization: agent.specialization,
            capabilities: agent.capabilities,
            status: agent.status
        };
    }
    getTotalPendingTasks() {
        return Array.from(this.taskQueues.values())
            .reduce((total, queue) => total + queue.length, 0);
    }
    getStats() {
        const agents = Array.from(this.agents.values());
        const results = Array.from(this.taskHistory.values());
        const completedResults = results.filter(r => r.status === 'completed');
        const failedResults = results.filter(r => r.status === 'failed');
        const totalDuration = completedResults
            .filter(r => r.duration !== undefined)
            .reduce((sum, r) => sum + (r.duration || 0), 0);
        return {
            totalAgents: agents.length,
            activeAgents: agents.filter(a => a.status === 'ready' || a.status === 'busy').length,
            totalTasks: results.length,
            pendingTasks: this.getTotalPendingTasks(),
            completedTasks: completedResults.length,
            failedTasks: failedResults.length,
            averageTaskDuration: completedResults.length > 0 ?
                totalDuration / completedResults.length : 0
        };
    }
    async cleanup() {
        await logger_1.logger.info('Shutting down AgentManager');
        for (const agent of this.agents.values()) {
            try {
                await agent.cleanup();
            }
            catch (error) {
                await logger_1.logger.error(`Error cleaning up agent ${agent.id}`, { error: error.message });
            }
        }
        if (this.config.enableGuidanceSystem) {
            await this.guidanceManager.cleanup();
        }
        this.agents.clear();
        this.taskQueues.clear();
        this.taskHistory.clear();
        await logger_1.logger.info('AgentManager shutdown complete');
    }
    async executeTasksParallel(tasks) {
        const promises = tasks.map(async (task) => {
            try {
                return await this.executeTask('universal-agent', task);
            }
            catch (error) {
                return {
                    taskId: task.id,
                    agentId: 'universal-agent',
                    status: 'failed',
                    startTime: task.createdAt,
                    endTime: new Date(),
                    error: error.message
                };
            }
        });
        return Promise.all(promises);
    }
    listRegisteredAgents() {
        return Array.from(this.agentRegistry.entries()).map(([id, entry]) => ({
            id,
            specialization: entry.metadata.specialization
        }));
    }
}
exports.AgentManager = AgentManager;
