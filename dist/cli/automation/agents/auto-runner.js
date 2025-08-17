"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoRunner = void 0;
const events_1 = require("events");
const chalk_1 = __importDefault(require("chalk"));
const agent_persistence_1 = require("../../persistence/agent-persistence");
class AutoRunner extends events_1.EventEmitter {
    constructor(agent, config, policy) {
        super();
        this.steps = [];
        this.isRunning = false;
        this.shouldStop = false;
        this.agent = agent;
        this.config = config;
        this.policy = policy;
        this.runId = agent_persistence_1.agentPersistence.createRunId();
        this.budget = {
            stepsUsed: 0,
            tokensUsed: 0,
            costUsed: 0,
            startTime: new Date(),
            lastActivity: new Date()
        };
    }
    async start(initialTask) {
        if (this.isRunning) {
            throw new Error('AutoRunner is already running');
        }
        this.isRunning = true;
        this.shouldStop = false;
        console.log(chalk_1.default.blue(`🤖 Starting autonomous execution for agent: ${this.config.name}`));
        console.log(chalk_1.default.gray(`📋 Run ID: ${this.runId}`));
        console.log(chalk_1.default.gray(`🎯 Policy: ${this.policy.maxSteps} steps, ${this.policy.maxTokens} tokens, $${this.policy.maxCost} cost`));
        const initialState = {
            id: this.agent.id,
            name: this.config.name,
            status: 'running',
            runId: this.runId,
            currentStep: 0,
            totalSteps: 0,
            startTime: this.budget.startTime,
            lastActivity: this.budget.lastActivity,
            memory: [],
            artifacts: [],
            metrics: {
                stepsCompleted: 0,
                tokensUsed: 0,
                cost: 0,
                executionTime: 0
            }
        };
        await agent_persistence_1.agentPersistence.saveAgentState(this.config.name, this.runId, initialState);
        await this.log('info', 'AutoRunner started', { initialTask });
        try {
            while (!this.shouldStop && !this.isBudgetExceeded() && !this.isPolicyDone()) {
                await this.executeStep();
                await this.sleep(100);
            }
            if (this.shouldStop) {
                await this.log('info', 'AutoRunner stopped by user request');
            }
            else if (this.isBudgetExceeded()) {
                await this.log('warn', 'AutoRunner stopped due to budget limits exceeded');
            }
            else if (this.isPolicyDone()) {
                await this.log('info', 'AutoRunner completed successfully');
            }
        }
        catch (error) {
            await this.log('error', `AutoRunner failed: ${error.message}`, { error: error.stack });
            throw error;
        }
        finally {
            this.isRunning = false;
            await this.finalize();
        }
    }
    async executeStep() {
        const stepNumber = this.budget.stepsUsed + 1;
        const step = {
            stepNumber,
            type: 'perception',
            description: `Step ${stepNumber}: Perception phase`,
            startTime: new Date()
        };
        this.steps.push(step);
        this.budget.stepsUsed++;
        this.budget.lastActivity = new Date();
        await this.log('info', `Starting step ${stepNumber}`, { stepType: step.type });
        try {
            step.type = 'perception';
            step.description = `Step ${stepNumber}: Analyzing current state and context`;
            const perception = await this.perceptionPhase();
            step.result = perception;
            step.type = 'reasoning';
            step.description = `Step ${stepNumber}: Planning next action`;
            const reasoning = await this.reasoningPhase(perception);
            step.result = reasoning;
            step.type = 'action';
            step.description = `Step ${stepNumber}: Executing planned action`;
            const action = await this.actionPhase(reasoning);
            step.result = action;
            step.type = 'evaluation';
            step.description = `Step ${stepNumber}: Evaluating results`;
            const evaluation = await this.evaluationPhase(action);
            step.result = evaluation;
            step.endTime = new Date();
            await this.log('info', `Step ${stepNumber} completed successfully`, {
                duration: step.endTime.getTime() - step.startTime.getTime()
            });
            await this.saveSnapshot();
        }
        catch (error) {
            step.endTime = new Date();
            step.error = error.message;
            await this.log('error', `Step ${stepNumber} failed: ${error.message}`, {
                error: error.stack,
                stepType: step.type
            });
            if (this.shouldRetry(error)) {
                await this.handleRetry(stepNumber, error);
            }
            else {
                throw error;
            }
        }
    }
    async perceptionPhase() {
        const context = await this.getContext();
        const modifiedFiles = await this.getModifiedFiles();
        const projectState = await this.analyzeProjectState();
        return {
            context,
            modifiedFiles,
            projectState,
            timestamp: new Date()
        };
    }
    async reasoningPhase(perception) {
        const pendingTasks = await this.getPendingTasks();
        const actionPriority = await this.evaluateActionPriority(pendingTasks, perception);
        const nextAction = await this.selectNextAction(actionPriority);
        return {
            pendingTasks,
            actionPriority,
            nextAction,
            reasoning: `Selected action: ${nextAction?.type || 'none'}`
        };
    }
    async actionPhase(reasoning) {
        const { nextAction } = reasoning;
        if (!nextAction) {
            return { action: 'none', result: 'No actions to perform' };
        }
        if (!this.validateAction(nextAction)) {
            throw new Error(`Action not allowed by security policy: ${nextAction.type}`);
        }
        const result = await this.executeAction(nextAction);
        return {
            action: nextAction,
            result,
            timestamp: new Date()
        };
    }
    async evaluationPhase(action) {
        const { action: executedAction, result } = action;
        const success = this.evaluateSuccess(result);
        await this.updateMemory(executedAction, result, success);
        const shouldContinue = this.shouldContinue(result, success);
        return {
            success,
            shouldContinue,
            evaluation: `Action ${success ? 'succeeded' : 'failed'}, should ${shouldContinue ? 'continue' : 'stop'}`
        };
    }
    async pause() {
        if (!this.isRunning) {
            throw new Error('AutoRunner is not running');
        }
        this.shouldStop = true;
        await this.log('info', 'AutoRunner paused by user request');
        await this.saveSnapshot();
    }
    async resume() {
        if (this.isRunning) {
            throw new Error('AutoRunner is already running');
        }
        this.shouldStop = false;
        await this.log('info', 'AutoRunner resumed by user request');
        await this.start();
    }
    async stop() {
        this.shouldStop = true;
        this.isRunning = false;
        await this.log('info', 'AutoRunner stopped by user request');
        await this.finalize();
    }
    isBudgetExceeded() {
        const now = new Date();
        const timeElapsed = now.getTime() - this.budget.startTime.getTime();
        return (this.budget.stepsUsed >= this.policy.maxSteps ||
            this.budget.tokensUsed >= this.policy.maxTokens ||
            this.budget.costUsed >= this.policy.maxCost ||
            timeElapsed >= this.policy.timeLimit);
    }
    isPolicyDone() {
        return false;
    }
    async saveSnapshot() {
        const state = {
            id: this.agent.id,
            name: this.config.name,
            status: this.isRunning ? 'running' : 'paused',
            runId: this.runId,
            currentStep: this.budget.stepsUsed,
            totalSteps: this.steps.length,
            startTime: this.budget.startTime,
            lastActivity: this.budget.lastActivity,
            memory: await this.getMemory(),
            artifacts: await this.getArtifacts(),
            metrics: {
                stepsCompleted: this.budget.stepsUsed,
                tokensUsed: this.budget.tokensUsed,
                cost: this.budget.costUsed,
                executionTime: this.budget.lastActivity.getTime() - this.budget.startTime.getTime()
            }
        };
        await agent_persistence_1.agentPersistence.saveAgentState(this.config.name, this.runId, state);
    }
    async finalize() {
        const finalState = {
            id: this.agent.id,
            name: this.config.name,
            status: 'stopped',
            runId: this.runId,
            currentStep: this.budget.stepsUsed,
            totalSteps: this.steps.length,
            startTime: this.budget.startTime,
            lastActivity: new Date(),
            memory: await this.getMemory(),
            artifacts: await this.getArtifacts(),
            metrics: {
                stepsCompleted: this.budget.stepsUsed,
                tokensUsed: this.budget.tokensUsed,
                cost: this.budget.costUsed,
                executionTime: new Date().getTime() - this.budget.startTime.getTime()
            }
        };
        await agent_persistence_1.agentPersistence.saveAgentState(this.config.name, this.runId, finalState);
        await this.log('info', 'AutoRunner finalized', {
            totalSteps: this.budget.stepsUsed,
            totalCost: this.budget.costUsed
        });
    }
    async log(level, message, metadata) {
        await agent_persistence_1.agentPersistence.appendLog(this.config.name, this.runId, {
            timestamp: new Date(),
            level,
            message,
            metadata
        });
        this.emit('log', { level, message, metadata, timestamp: new Date() });
    }
    async getContext() {
        return {};
    }
    async getModifiedFiles() {
        return [];
    }
    async analyzeProjectState() {
        return {};
    }
    async getPendingTasks() {
        return [];
    }
    async evaluateActionPriority(tasks, perception) {
        return tasks;
    }
    async selectNextAction(actions) {
        return actions[0] || null;
    }
    validateAction(action) {
        if (this.policy.safeToolsOnly && !this.isSafeTool(action.tool)) {
            return false;
        }
        if (!this.policy.allowWrite && this.isWriteAction(action)) {
            return false;
        }
        return true;
    }
    async executeAction(action) {
        return { success: true, result: 'Action executed' };
    }
    evaluateSuccess(result) {
        return result?.success === true;
    }
    async updateMemory(action, result, success) {
    }
    shouldContinue(result, success) {
        return success && !this.isBudgetExceeded();
    }
    shouldRetry(error) {
        return this.budget.stepsUsed < this.policy.maxRetries;
    }
    async handleRetry(stepNumber, error) {
        const delay = Math.pow(this.policy.backoffMultiplier, stepNumber) * 1000;
        await this.sleep(delay);
    }
    async getMemory() {
        return [];
    }
    async getArtifacts() {
        return [];
    }
    isSafeTool(tool) {
        return true;
    }
    isWriteAction(action) {
        return action?.type?.includes('write') || action?.type?.includes('create');
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    get isActive() {
        return this.isRunning;
    }
    get currentStep() {
        return this.budget.stepsUsed;
    }
    get totalSteps() {
        return this.steps.length;
    }
    get budgetInfo() {
        return { ...this.budget };
    }
    get policyInfo() {
        return { ...this.policy };
    }
}
exports.AutoRunner = AutoRunner;
