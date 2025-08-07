"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRouter = void 0;
const event_bus_1 = require("./event-bus");
const cli_ui_1 = require("../utils/cli-ui");
/**
 * Production-ready Agent Router
 * Intelligently routes tasks to specialized agents based on task type and context
 */
class AgentRouter {
    constructor() {
        this.agents = new Map();
        this.routingRules = [];
        this.taskQueue = [];
        this.activeRoutes = new Map();
        this.routingMetrics = {
            totalTasks: 0,
            successfulRoutes: 0,
            failedRoutes: 0,
            averageRoutingTime: 0,
            agentUtilization: new Map()
        };
        this.eventBus = event_bus_1.EventBus.getInstance();
        this.setupEventListeners();
        this.initializeDefaultRoutingRules();
    }
    /**
     * Register a specialized agent
     */
    registerAgent(agentId, agent) {
        if (this.agents.has(agentId)) {
            cli_ui_1.CliUI.logWarning(`Agent ${agentId} already registered. Overwriting...`);
        }
        this.agents.set(agentId, agent);
        this.routingMetrics.agentUtilization.set(agentId, {
            tasksAssigned: 0,
            tasksCompleted: 0,
            averageExecutionTime: 0,
            successRate: 0
        });
        cli_ui_1.CliUI.logInfo(`🤖 Agent registered: ${agentId} (${agent.capabilities.join(', ')})`);
        // Publish agent registration event
        this.eventBus.publish(event_bus_1.EventTypes.AGENT_STARTED, {
            agentId,
            capabilities: agent.capabilities,
            specialization: agent.specialization
        });
    }
    /**
     * Unregister an agent
     */
    unregisterAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent)
            return false;
        this.agents.delete(agentId);
        this.routingMetrics.agentUtilization.delete(agentId);
        cli_ui_1.CliUI.logInfo(`🤖 Agent unregistered: ${agentId}`);
        // Publish agent stop event
        this.eventBus.publish(event_bus_1.EventTypes.AGENT_STOPPED, { agentId });
        return true;
    }
    /**
     * Route a task to the most appropriate agent
     */
    async routeTask(task) {
        const startTime = Date.now();
        this.routingMetrics.totalTasks++;
        try {
            cli_ui_1.CliUI.logInfo(`🎯 Routing task: ${task.type} - ${task.description}`);
            // Analyze task to determine requirements
            const taskAnalysis = await this.analyzeTask(task);
            // Find best agent for the task
            const selectedAgent = await this.selectAgent(task, taskAnalysis);
            if (!selectedAgent) {
                throw new Error(`No suitable agent found for task: ${task.type}`);
            }
            // Create route execution
            const routeExecution = {
                taskId: task.id,
                agentId: selectedAgent.agentId,
                startTime: new Date(),
                status: 'routing',
                analysis: taskAnalysis
            };
            this.activeRoutes.set(task.id, routeExecution);
            // Assign task to agent
            const result = await this.assignTaskToAgent(selectedAgent, task);
            // Update metrics
            const routingTime = Date.now() - startTime;
            this.updateRoutingMetrics(selectedAgent.agentId, routingTime, true);
            // Update route execution
            routeExecution.status = 'assigned';
            routeExecution.endTime = new Date();
            routeExecution.result = result;
            cli_ui_1.CliUI.logSuccess(`✅ Task routed to ${selectedAgent.agentId} in ${routingTime}ms`);
            return {
                success: true,
                taskId: task.id,
                assignedAgent: selectedAgent.agentId,
                routingTime,
                analysis: taskAnalysis,
                result
            };
        }
        catch (error) {
            const routingTime = Date.now() - startTime;
            this.updateRoutingMetrics('unknown', routingTime, false);
            cli_ui_1.CliUI.logError(`❌ Task routing failed: ${error.message}`);
            return {
                success: false,
                taskId: task.id,
                assignedAgent: null,
                routingTime,
                error: error.message
            };
        }
    }
    /**
     * Add a custom routing rule
     */
    addRoutingRule(rule) {
        this.routingRules.push(rule);
        this.routingRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        cli_ui_1.CliUI.logInfo(`📋 Routing rule added: ${rule.name}`);
    }
    /**
     * Remove a routing rule
     */
    removeRoutingRule(ruleName) {
        const initialLength = this.routingRules.length;
        this.routingRules = this.routingRules.filter(rule => rule.name !== ruleName);
        const removed = this.routingRules.length < initialLength;
        if (removed) {
            cli_ui_1.CliUI.logInfo(`📋 Routing rule removed: ${ruleName}`);
        }
        return removed;
    }
    /**
     * Get routing metrics
     */
    getRoutingMetrics() {
        return { ...this.routingMetrics };
    }
    /**
     * Get active routes
     */
    getActiveRoutes() {
        return Array.from(this.activeRoutes.values());
    }
    /**
     * Get registered agents
     */
    getRegisteredAgents() {
        return Array.from(this.agents.entries()).map(([agentId, agent]) => ({
            agentId,
            capabilities: agent.capabilities,
            specialization: agent.specialization,
            status: agent.status,
            currentTasks: agent.currentTasks || 0,
            maxConcurrentTasks: agent.maxConcurrentTasks || 1
        }));
    }
    /**
     * Analyze task to determine requirements
     */
    async analyzeTask(task) {
        const analysis = {
            taskType: task.type,
            complexity: this.assessComplexity(task),
            requiredCapabilities: this.extractRequiredCapabilities(task),
            estimatedDuration: this.estimateDuration(task),
            priority: task.priority || 'normal',
            resourceRequirements: this.assessResourceRequirements(task),
            dependencies: task.dependencies || []
        };
        // Apply custom analysis rules
        for (const rule of this.routingRules) {
            if (rule.taskAnalyzer) {
                const customAnalysis = await rule.taskAnalyzer(task, analysis);
                Object.assign(analysis, customAnalysis);
            }
        }
        return analysis;
    }
    /**
     * Select the best agent for a task
     */
    async selectAgent(task, analysis) {
        const candidates = [];
        // Evaluate each agent
        for (const [agentId, agent] of Array.from(this.agents.entries())) {
            if (agent.status !== 'available')
                continue;
            const score = await this.scoreAgent(agent, task, analysis);
            if (score > 0) {
                candidates.push({
                    agentId,
                    agent,
                    score,
                    reasoning: this.generateReasoningForScore(agent, task, analysis, score)
                });
            }
        }
        // Sort by score (highest first)
        candidates.sort((a, b) => b.score - a.score);
        // Apply routing rules
        for (const rule of this.routingRules) {
            if (rule.agentSelector) {
                const selectedCandidate = await rule.agentSelector(candidates, task, analysis);
                if (selectedCandidate) {
                    return {
                        agentId: selectedCandidate.agentId,
                        agent: selectedCandidate.agent,
                        score: selectedCandidate.score,
                        reasoning: `Selected by rule: ${rule.name}. ${selectedCandidate.reasoning}`
                    };
                }
            }
        }
        // Return best candidate
        const bestCandidate = candidates[0];
        return bestCandidate ? {
            agentId: bestCandidate.agentId,
            agent: bestCandidate.agent,
            score: bestCandidate.score,
            reasoning: bestCandidate.reasoning
        } : null;
    }
    /**
     * Score an agent for a specific task
     */
    async scoreAgent(agent, task, analysis) {
        let score = 0;
        // Capability matching (40% of score)
        const capabilityMatch = this.calculateCapabilityMatch(agent.capabilities, analysis.requiredCapabilities);
        score += capabilityMatch * 0.4;
        // Specialization bonus (30% of score)
        if (agent.specialization === analysis.taskType ||
            analysis.requiredCapabilities.includes(agent.specialization)) {
            score += 0.3;
        }
        // Load balancing (20% of score)
        const currentLoad = (agent.currentTasks || 0) / (agent.maxConcurrentTasks || 1);
        score += (1 - currentLoad) * 0.2;
        // Performance history (10% of score)
        const utilization = this.routingMetrics.agentUtilization.get(agent.id);
        if (utilization && utilization.tasksCompleted > 0) {
            score += utilization.successRate * 0.1;
        }
        return Math.max(0, Math.min(1, score)); // Normalize to 0-1
    }
    /**
     * Assign task to selected agent
     */
    async assignTaskToAgent(selection, task) {
        const agent = selection.agent;
        // Update agent status
        agent.currentTasks = (agent.currentTasks || 0) + 1;
        if (agent.currentTasks >= (agent.maxConcurrentTasks || 1)) {
            agent.status = 'busy';
        }
        // Publish task assignment event
        await this.eventBus.publish(event_bus_1.EventTypes.TASK_ASSIGNED, {
            taskId: task.id,
            agentId: selection.agentId,
            reasoning: selection.reasoning,
            score: selection.score
        });
        try {
            // Execute task on agent
            const result = await agent.executeTask(task);
            // Update agent status
            agent.currentTasks = Math.max(0, (agent.currentTasks || 1) - 1);
            if (agent.currentTasks < (agent.maxConcurrentTasks || 1)) {
                agent.status = 'available';
            }
            // Publish completion event
            await this.eventBus.publish(event_bus_1.EventTypes.TASK_COMPLETED, {
                taskId: task.id,
                agentId: selection.agentId,
                result
            });
            return result;
        }
        catch (error) {
            // Update agent status
            agent.currentTasks = Math.max(0, (agent.currentTasks || 1) - 1);
            agent.status = 'available';
            // Publish failure event
            await this.eventBus.publish(event_bus_1.EventTypes.TASK_FAILED, {
                taskId: task.id,
                agentId: selection.agentId,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for system events
        this.eventBus.subscribe(event_bus_1.EventTypes.SYSTEM_SHUTDOWN, () => {
            cli_ui_1.CliUI.logInfo('🔄 AgentRouter shutting down...');
            this.cleanup();
        });
        // Listen for agent errors
        this.eventBus.subscribe(event_bus_1.EventTypes.AGENT_ERROR, (event) => {
            const { agentId, error } = event.data;
            cli_ui_1.CliUI.logError(`🤖 Agent ${agentId} error: ${error}`);
            // Mark agent as unavailable temporarily
            const agent = this.agents.get(agentId);
            if (agent) {
                agent.status = 'error';
                setTimeout(() => {
                    if (agent.status === 'error') {
                        agent.status = 'available';
                    }
                }, 30000); // Retry after 30 seconds
            }
        });
    }
    /**
     * Initialize default routing rules
     */
    initializeDefaultRoutingRules() {
        // Frontend specialization rule
        this.addRoutingRule({
            name: 'frontend-specialization',
            priority: 10,
            agentSelector: async (candidates, task) => {
                if (task.type.includes('frontend') || task.type.includes('ui') || task.type.includes('component')) {
                    return candidates.find(c => c.agent.specialization === 'frontend') || candidates[0];
                }
                return null;
            }
        });
        // Backend specialization rule
        this.addRoutingRule({
            name: 'backend-specialization',
            priority: 10,
            agentSelector: async (candidates, task) => {
                if (task.type.includes('backend') || task.type.includes('api') || task.type.includes('database')) {
                    return candidates.find(c => c.agent.specialization === 'backend') || candidates[0];
                }
                return null;
            }
        });
        // Testing specialization rule
        this.addRoutingRule({
            name: 'testing-specialization',
            priority: 10,
            agentSelector: async (candidates, task) => {
                if (task.type.includes('test') || task.type.includes('spec') || task.type.includes('e2e')) {
                    return candidates.find(c => c.agent.specialization === 'testing') || candidates[0];
                }
                return null;
            }
        });
        // Load balancing rule (fallback)
        this.addRoutingRule({
            name: 'load-balancing',
            priority: 1,
            agentSelector: async (candidates) => {
                // Return agent with lowest current load
                return candidates.reduce((best, current) => {
                    const currentLoad = (current.agent.currentTasks || 0) / (current.agent.maxConcurrentTasks || 1);
                    const bestLoad = (best.agent.currentTasks || 0) / (best.agent.maxConcurrentTasks || 1);
                    return currentLoad < bestLoad ? current : best;
                });
            }
        });
    }
    /**
     * Helper methods for task analysis
     */
    assessComplexity(task) {
        // Simple heuristic based on task description length and type
        const descriptionLength = task.description.length;
        const hasMultipleSteps = task.description.includes('and') || task.description.includes('then');
        if (descriptionLength > 200 || hasMultipleSteps)
            return 'high';
        if (descriptionLength > 100)
            return 'medium';
        return 'low';
    }
    extractRequiredCapabilities(task) {
        const capabilities = [];
        const description = task.description.toLowerCase();
        // File operations
        if (description.includes('read') || description.includes('file'))
            capabilities.push('file-read');
        if (description.includes('write') || description.includes('create'))
            capabilities.push('file-write');
        if (description.includes('delete') || description.includes('remove'))
            capabilities.push('file-delete');
        // Code operations
        if (description.includes('refactor') || description.includes('modify'))
            capabilities.push('code-modify');
        if (description.includes('test') || description.includes('spec'))
            capabilities.push('testing');
        if (description.includes('debug') || description.includes('fix'))
            capabilities.push('debugging');
        // System operations
        if (description.includes('command') || description.includes('run'))
            capabilities.push('command-execute');
        if (description.includes('install') || description.includes('setup'))
            capabilities.push('system-setup');
        return capabilities;
    }
    estimateDuration(task) {
        const complexity = this.assessComplexity(task);
        const baseTime = {
            'low': 30000, // 30 seconds
            'medium': 120000, // 2 minutes
            'high': 300000 // 5 minutes
        };
        return baseTime[complexity];
    }
    assessResourceRequirements(task) {
        return {
            memory: 'low',
            cpu: 'low',
            network: task.description.includes('download') || task.description.includes('fetch') ? 'medium' : 'low',
            storage: task.description.includes('large') || task.description.includes('backup') ? 'medium' : 'low'
        };
    }
    calculateCapabilityMatch(agentCapabilities, requiredCapabilities) {
        if (requiredCapabilities.length === 0)
            return 1;
        const matches = requiredCapabilities.filter(cap => agentCapabilities.includes(cap)).length;
        return matches / requiredCapabilities.length;
    }
    generateReasoningForScore(agent, task, analysis, score) {
        const reasons = [];
        if (agent.specialization === analysis.taskType) {
            reasons.push(`Specialized in ${agent.specialization}`);
        }
        const capabilityMatch = this.calculateCapabilityMatch(agent.capabilities, analysis.requiredCapabilities);
        if (capabilityMatch > 0.8) {
            reasons.push(`High capability match (${Math.round(capabilityMatch * 100)}%)`);
        }
        const currentLoad = (agent.currentTasks || 0) / (agent.maxConcurrentTasks || 1);
        if (currentLoad < 0.5) {
            reasons.push('Low current workload');
        }
        return reasons.join(', ') || 'Best available option';
    }
    updateRoutingMetrics(agentId, routingTime, success) {
        if (success) {
            this.routingMetrics.successfulRoutes++;
        }
        else {
            this.routingMetrics.failedRoutes++;
        }
        // Update average routing time
        const totalRoutes = this.routingMetrics.successfulRoutes + this.routingMetrics.failedRoutes;
        this.routingMetrics.averageRoutingTime =
            (this.routingMetrics.averageRoutingTime * (totalRoutes - 1) + routingTime) / totalRoutes;
        // Update agent utilization
        const utilization = this.routingMetrics.agentUtilization.get(agentId);
        if (utilization) {
            utilization.tasksAssigned++;
            if (success) {
                utilization.tasksCompleted++;
                utilization.successRate = utilization.tasksCompleted / utilization.tasksAssigned;
            }
        }
    }
    cleanup() {
        this.activeRoutes.clear();
        this.taskQueue = [];
    }
}
exports.AgentRouter = AgentRouter;
