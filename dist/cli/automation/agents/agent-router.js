"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRouter = void 0;
const event_bus_1 = require("./event-bus");
const cli_ui_1 = require("../../utils/cli-ui");
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
        this.eventBus.publish(event_bus_1.EventTypes.AGENT_STARTED, {
            agentId,
            capabilities: agent.capabilities,
            specialization: agent.specialization
        });
    }
    unregisterAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent)
            return false;
        this.agents.delete(agentId);
        this.routingMetrics.agentUtilization.delete(agentId);
        cli_ui_1.CliUI.logInfo(`🤖 Agent unregistered: ${agentId}`);
        this.eventBus.publish(event_bus_1.EventTypes.AGENT_STOPPED, { agentId });
        return true;
    }
    async routeTask(task) {
        const startTime = Date.now();
        this.routingMetrics.totalTasks++;
        try {
            cli_ui_1.CliUI.logInfo(`🎯 Routing task: ${task.type} - ${task.description}`);
            const taskAnalysis = await this.analyzeTask(task);
            const selectedAgent = await this.selectAgent(task, taskAnalysis);
            if (!selectedAgent) {
                throw new Error(`No suitable agent found for task: ${task.type}`);
            }
            const routeExecution = {
                taskId: task.id,
                agentId: selectedAgent.agentId,
                startTime: new Date(),
                status: 'routing',
                analysis: taskAnalysis
            };
            this.activeRoutes.set(task.id, routeExecution);
            const result = await this.assignTaskToAgent(selectedAgent, task);
            const routingTime = Date.now() - startTime;
            this.updateRoutingMetrics(selectedAgent.agentId, routingTime, true);
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
    addRoutingRule(rule) {
        this.routingRules.push(rule);
        this.routingRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        cli_ui_1.CliUI.logInfo(`📋 Routing rule added: ${rule.name}`);
    }
    removeRoutingRule(ruleName) {
        const initialLength = this.routingRules.length;
        this.routingRules = this.routingRules.filter(rule => rule.name !== ruleName);
        const removed = this.routingRules.length < initialLength;
        if (removed) {
            cli_ui_1.CliUI.logInfo(`📋 Routing rule removed: ${ruleName}`);
        }
        return removed;
    }
    getRoutingMetrics() {
        return { ...this.routingMetrics };
    }
    getActiveRoutes() {
        return Array.from(this.activeRoutes.values());
    }
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
        for (const rule of this.routingRules) {
            if (rule.taskAnalyzer) {
                const customAnalysis = await rule.taskAnalyzer(task, analysis);
                Object.assign(analysis, customAnalysis);
            }
        }
        return analysis;
    }
    async selectAgent(task, analysis) {
        const candidates = [];
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
        candidates.sort((a, b) => b.score - a.score);
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
        const bestCandidate = candidates[0];
        return bestCandidate ? {
            agentId: bestCandidate.agentId,
            agent: bestCandidate.agent,
            score: bestCandidate.score,
            reasoning: bestCandidate.reasoning
        } : null;
    }
    async scoreAgent(agent, task, analysis) {
        let score = 0;
        const capabilityMatch = this.calculateCapabilityMatch(agent.capabilities, analysis.requiredCapabilities);
        score += capabilityMatch * 0.4;
        if (agent.specialization === analysis.taskType ||
            analysis.requiredCapabilities.includes(agent.specialization)) {
            score += 0.3;
        }
        const currentLoad = (agent.currentTasks || 0) / (agent.maxConcurrentTasks || 1);
        score += (1 - currentLoad) * 0.2;
        const utilization = this.routingMetrics.agentUtilization.get(agent.id);
        if (utilization && utilization.tasksCompleted > 0) {
            score += utilization.successRate * 0.1;
        }
        return Math.max(0, Math.min(1, score));
    }
    async assignTaskToAgent(selection, task) {
        const agent = selection.agent;
        agent.currentTasks = (agent.currentTasks || 0) + 1;
        if (agent.currentTasks >= (agent.maxConcurrentTasks || 1)) {
            agent.status = 'busy';
        }
        await this.eventBus.publish(event_bus_1.EventTypes.TASK_ASSIGNED, {
            taskId: task.id,
            agentId: selection.agentId,
            reasoning: selection.reasoning,
            score: selection.score
        });
        try {
            const result = await agent.executeTask(task);
            agent.currentTasks = Math.max(0, (agent.currentTasks || 1) - 1);
            if (agent.currentTasks < (agent.maxConcurrentTasks || 1)) {
                agent.status = 'available';
            }
            await this.eventBus.publish(event_bus_1.EventTypes.TASK_COMPLETED, {
                taskId: task.id,
                agentId: selection.agentId,
                result
            });
            return result;
        }
        catch (error) {
            agent.currentTasks = Math.max(0, (agent.currentTasks || 1) - 1);
            agent.status = 'available';
            await this.eventBus.publish(event_bus_1.EventTypes.TASK_FAILED, {
                taskId: task.id,
                agentId: selection.agentId,
                error: error.message
            });
            throw error;
        }
    }
    setupEventListeners() {
        this.eventBus.subscribe(event_bus_1.EventTypes.SYSTEM_SHUTDOWN, () => {
            cli_ui_1.CliUI.logInfo('🔄 AgentRouter shutting down...');
            this.cleanup();
        });
        this.eventBus.subscribe(event_bus_1.EventTypes.AGENT_ERROR, (event) => {
            const { agentId, error } = event.data;
            cli_ui_1.CliUI.logError(`🤖 Agent ${agentId} error: ${error}`);
            const agent = this.agents.get(agentId);
            if (agent) {
                agent.status = 'error';
                setTimeout(() => {
                    if (agent.status === 'error') {
                        agent.status = 'available';
                    }
                }, 30000);
            }
        });
    }
    initializeDefaultRoutingRules() {
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
        this.addRoutingRule({
            name: 'load-balancing',
            priority: 1,
            agentSelector: async (candidates) => {
                return candidates.reduce((best, current) => {
                    const currentLoad = (current.agent.currentTasks || 0) / (current.agent.maxConcurrentTasks || 1);
                    const bestLoad = (best.agent.currentTasks || 0) / (best.agent.maxConcurrentTasks || 1);
                    return currentLoad < bestLoad ? current : best;
                });
            }
        });
    }
    assessComplexity(task) {
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
        if (description.includes('read') || description.includes('file'))
            capabilities.push('file-read');
        if (description.includes('write') || description.includes('create'))
            capabilities.push('file-write');
        if (description.includes('delete') || description.includes('remove'))
            capabilities.push('file-delete');
        if (description.includes('refactor') || description.includes('modify'))
            capabilities.push('code-modify');
        if (description.includes('test') || description.includes('spec'))
            capabilities.push('testing');
        if (description.includes('debug') || description.includes('fix'))
            capabilities.push('debugging');
        if (description.includes('command') || description.includes('run'))
            capabilities.push('command-execute');
        if (description.includes('install') || description.includes('setup'))
            capabilities.push('system-setup');
        return capabilities;
    }
    estimateDuration(task) {
        const complexity = this.assessComplexity(task);
        const baseTime = {
            'low': 30000,
            'medium': 120000,
            'high': 300000
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
        const totalRoutes = this.routingMetrics.successfulRoutes + this.routingMetrics.failedRoutes;
        this.routingMetrics.averageRoutingTime =
            (this.routingMetrics.averageRoutingTime * (totalRoutes - 1) + routingTime) / totalRoutes;
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
