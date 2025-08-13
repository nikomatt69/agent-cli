"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowOrchestrator = void 0;
const event_bus_1 = require("./agents/event-bus");
const tool_registry_1 = require("../tools/tool-registry");
const cli_ui_1 = require("../utils/cli-ui");
class WorkflowOrchestrator {
    constructor(workingDirectory) {
        this.activeChains = new Map();
        this.chainDefinitions = new Map();
        this.eventBus = event_bus_1.EventBus.getInstance();
        this.toolRegistry = new tool_registry_1.ToolRegistry(workingDirectory);
        this.initializeDefaultChains();
    }
    async executeChain(chainId, initialParams = {}) {
        const chain = this.chainDefinitions.get(chainId);
        if (!chain) {
            throw new Error(`Workflow chain '${chainId}' not found`);
        }
        cli_ui_1.CliUI.logSection(`🔗 Executing Workflow Chain: ${chain.name}`);
        cli_ui_1.CliUI.logInfo(`Goal: ${chain.goal}`);
        const context = {
            workingDirectory: this.toolRegistry.getWorkingDirectory(),
            previousResults: [],
            currentStep: 0,
            totalSteps: chain.steps.length,
            startTime: new Date(),
            variables: { ...initialParams }
        };
        this.activeChains.set(chainId, context);
        try {
            await this.eventBus.publish(event_bus_1.EventTypes.TASK_STARTED, {
                taskId: chainId,
                agentId: 'workflow-orchestrator',
                taskType: 'workflow-chain',
                chainName: chain.name
            });
            const result = await this.executeSteps(chain, context);
            await this.eventBus.publish(event_bus_1.EventTypes.TASK_COMPLETED, {
                taskId: chainId,
                agentId: 'workflow-orchestrator',
                result,
                duration: result.duration
            });
            return result;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Workflow chain failed: ${error.message}`);
            await this.eventBus.publish(event_bus_1.EventTypes.TASK_FAILED, {
                taskId: chainId,
                agentId: 'workflow-orchestrator',
                error: error.message
            });
            throw error;
        }
        finally {
            this.activeChains.delete(chainId);
        }
    }
    async executeSteps(chain, context) {
        const results = [];
        const errors = [];
        const logs = [];
        for (let i = 0; i < chain.steps.length; i++) {
            const step = chain.steps[i];
            context.currentStep = i + 1;
            try {
                cli_ui_1.CliUI.logInfo(`📋 Step ${context.currentStep}/${context.totalSteps}: ${step.toolName}`);
                if (step.condition && !step.condition(context.previousResults)) {
                    cli_ui_1.CliUI.logWarning(`⏭️ Skipping step ${step.id} - condition not met`);
                    continue;
                }
                await this.performSafetyChecks(step, context, chain.safetyChecks);
                const needsApproval = await this.checkApprovalRequired(step, chain.autoApprovalRules);
                if (needsApproval) {
                    const approved = await this.requestHumanApproval(step, context);
                    if (!approved) {
                        throw new Error(`Step ${step.id} was not approved by human reviewer`);
                    }
                }
                const result = await this.executeStep(step, context);
                results.push(result);
                context.previousResults.push(result);
                logs.push(`✅ Step ${step.id} completed successfully`);
                cli_ui_1.CliUI.logSuccess(`✅ Step completed: ${step.toolName}`);
                if (step.onSuccess) {
                    const additionalSteps = step.onSuccess(result);
                    if (additionalSteps.length > 0) {
                        chain.steps.splice(i + 1, 0, ...additionalSteps);
                        context.totalSteps += additionalSteps.length;
                        cli_ui_1.CliUI.logInfo(`📈 Added ${additionalSteps.length} dynamic steps`);
                    }
                }
            }
            catch (error) {
                cli_ui_1.CliUI.logError(`❌ Step ${step.id} failed: ${error.message}`);
                errors.push({ step: step.id, error: error.message });
                const retryCount = step.retryCount || 0;
                if (retryCount > 0) {
                    cli_ui_1.CliUI.logWarning(`🔄 Retrying step ${step.id} (${retryCount} attempts remaining)`);
                    step.retryCount = retryCount - 1;
                    i--;
                    continue;
                }
                if (step.onError) {
                    const recoverySteps = step.onError(error);
                    if (recoverySteps.length > 0) {
                        chain.steps.splice(i + 1, 0, ...recoverySteps);
                        context.totalSteps += recoverySteps.length;
                        cli_ui_1.CliUI.logInfo(`🔧 Added ${recoverySteps.length} recovery steps`);
                        continue;
                    }
                }
                throw error;
            }
        }
        const duration = new Date().getTime() - context.startTime.getTime();
        return {
            success: errors.length === 0,
            chainId: chain.id,
            executedSteps: results.length,
            totalSteps: context.totalSteps,
            duration,
            results,
            errors,
            logs
        };
    }
    async executeStep(step, context) {
        const tool = this.toolRegistry.getTool(step.toolName);
        if (!tool) {
            throw new Error(`Tool '${step.toolName}' not found in registry`);
        }
        const resolvedParams = this.resolveParameters(step.parameters, context);
        const timeout = step.timeout || 30000;
        const result = await Promise.race([
            tool.execute(resolvedParams),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Step ${step.id} timed out after ${timeout}ms`)), timeout))
        ]);
        return result;
    }
    resolveParameters(params, context) {
        const resolved = {};
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string' && value.startsWith('$')) {
                const varName = value.substring(1);
                if (varName === 'workingDirectory') {
                    resolved[key] = context.workingDirectory;
                }
                else if (varName.startsWith('result[')) {
                    const match = varName.match(/result\[(\d+)\]\.(.+)/);
                    if (match) {
                        const index = parseInt(match[1]);
                        const property = match[2];
                        resolved[key] = context.previousResults[index]?.[property];
                    }
                }
                else if (context.variables[varName] !== undefined) {
                    resolved[key] = context.variables[varName];
                }
                else {
                    resolved[key] = value;
                }
            }
            else {
                resolved[key] = value;
            }
        }
        return resolved;
    }
    async checkApprovalRequired(step, rules) {
        if (step.autoApprove === true)
            return false;
        if (step.autoApprove === false)
            return true;
        for (const rule of rules) {
            if (this.matchesPattern(step.toolName, rule.toolPattern)) {
                if (rule.parameterConditions) {
                    const matches = this.matchesParameterConditions(step.parameters, rule.parameterConditions);
                    if (matches)
                        return !rule.autoApprove;
                }
                else {
                    return !rule.autoApprove;
                }
            }
        }
        return true;
    }
    matchesPattern(toolName, pattern) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(toolName);
    }
    matchesParameterConditions(params, conditions) {
        for (const [key, expectedValue] of Object.entries(conditions)) {
            if (params[key] !== expectedValue) {
                return false;
            }
        }
        return true;
    }
    async performSafetyChecks(step, context, checks) {
        for (const check of checks) {
            if (!check.check(step, context)) {
                throw new Error(`Safety check failed: ${check.errorMessage}`);
            }
        }
    }
    async requestHumanApproval(step, context) {
        cli_ui_1.CliUI.logWarning(`🚨 Human approval required for step: ${step.id}`);
        cli_ui_1.CliUI.logInfo(`Tool: ${step.toolName}`);
        cli_ui_1.CliUI.logInfo(`Parameters: ${JSON.stringify(step.parameters, null, 2)}`);
        const safeTools = ['read-file-tool', 'grep-search', 'find-files-tool'];
        return safeTools.includes(step.toolName);
    }
    initializeDefaultChains() {
        this.chainDefinitions.set('implement-feature', {
            id: 'implement-feature',
            name: 'Implement New Feature',
            description: 'Complete workflow for implementing a new feature',
            goal: 'Implement, test, and document a new feature',
            steps: [
                {
                    id: 'analyze-requirements',
                    toolName: 'read-file-tool',
                    parameters: { filePath: '$requirementsFile' },
                    autoApprove: true
                },
                {
                    id: 'create-implementation',
                    toolName: 'write-file-tool',
                    parameters: {
                        filePath: '$implementationFile',
                        content: '$implementationCode'
                    },
                    autoApprove: false
                },
                {
                    id: 'create-tests',
                    toolName: 'write-file-tool',
                    parameters: {
                        filePath: '$testFile',
                        content: '$testCode'
                    },
                    autoApprove: true
                },
                {
                    id: 'run-tests',
                    toolName: 'run-command-tool',
                    parameters: { command: 'npm test' },
                    autoApprove: true,
                    retryCount: 2
                }
            ],
            autoApprovalRules: [
                {
                    toolPattern: 'read-*',
                    riskLevel: 'low',
                    autoApprove: true
                },
                {
                    toolPattern: 'write-file-tool',
                    parameterConditions: { filePath: '*.test.*' },
                    riskLevel: 'low',
                    autoApprove: true
                },
                {
                    toolPattern: 'run-command-tool',
                    parameterConditions: { command: 'npm test' },
                    riskLevel: 'low',
                    autoApprove: true
                }
            ],
            safetyChecks: [
                {
                    name: 'no-destructive-operations',
                    check: (step) => !step.parameters.command?.includes('rm -rf'),
                    errorMessage: 'Destructive operations not allowed'
                }
            ]
        });
        cli_ui_1.CliUI.logInfo(`🔗 Initialized ${this.chainDefinitions.size} workflow chains`);
    }
    registerChain(chain) {
        this.chainDefinitions.set(chain.id, chain);
        cli_ui_1.CliUI.logInfo(`📝 Registered workflow chain: ${chain.name}`);
    }
    listChains() {
        return Array.from(this.chainDefinitions.values());
    }
    getChainStatus(chainId) {
        return this.activeChains.get(chainId) || null;
    }
}
exports.WorkflowOrchestrator = WorkflowOrchestrator;
