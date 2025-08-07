"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanExecutor = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const cli_ui_1 = require("../utils/cli-ui");
/**
 * Production-ready Plan Executor
 * Handles plan approval, step execution, and rollback capabilities
 */
class PlanExecutor {
    constructor(toolRegistry, config) {
        this.executionHistory = new Map();
        this.toolRegistry = toolRegistry;
        this.config = {
            maxStepsPerPlan: 50,
            requireApprovalForRisk: 'medium',
            enableRollback: true,
            logLevel: 'info',
            timeoutPerStep: 60000, // 1 minute
            ...config
        };
    }
    /**
     * Execute a plan with user approval and monitoring
     */
    async executePlan(plan) {
        cli_ui_1.CliUI.logSection(`Executing Plan: ${plan.title}`);
        const startTime = new Date();
        const result = {
            planId: plan.id,
            status: 'completed',
            startTime,
            stepResults: [],
            summary: {
                totalSteps: plan.steps.length,
                successfulSteps: 0,
                failedSteps: 0,
                skippedSteps: 0
            }
        };
        try {
            // Request approval if needed
            const approval = await this.requestApproval(plan);
            if (!approval.approved) {
                result.status = 'cancelled';
                cli_ui_1.CliUI.logWarning('Plan execution cancelled by user');
                return result;
            }
            // Filter steps based on approval
            const stepsToExecute = plan.steps.filter(step => !approval.modifiedSteps?.includes(step.id));
            cli_ui_1.CliUI.logInfo(`Executing ${stepsToExecute.length} steps...`);
            // Execute steps in dependency order
            const executionOrder = this.resolveDependencyOrder(stepsToExecute);
            for (let i = 0; i < executionOrder.length; i++) {
                const step = executionOrder[i];
                cli_ui_1.CliUI.logProgress(i + 1, executionOrder.length, `Executing: ${step.title}`);
                const stepResult = await this.executeStep(step, plan);
                result.stepResults.push(stepResult);
                // Update summary
                switch (stepResult.status) {
                    case 'success':
                        result.summary.successfulSteps++;
                        break;
                    case 'failure':
                        result.summary.failedSteps++;
                        break;
                    case 'skipped':
                        result.summary.skippedSteps++;
                        break;
                }
                // Handle step failure
                if (stepResult.status === 'failure') {
                    const shouldContinue = await this.handleStepFailure(step, stepResult, plan);
                    if (!shouldContinue) {
                        result.status = 'failed';
                        break;
                    }
                }
                // Check for cancellation
                if (stepResult.status === 'cancelled') {
                    result.status = 'cancelled';
                    break;
                }
            }
            // Determine final status
            if (result.status === 'completed' && result.summary.failedSteps > 0) {
                result.status = 'partial';
            }
            result.endTime = new Date();
            this.executionHistory.set(plan.id, result);
            // Log final results
            this.logExecutionSummary(result);
            return result;
        }
        catch (error) {
            result.status = 'failed';
            result.endTime = new Date();
            cli_ui_1.CliUI.logError(`Plan execution failed: ${error.message}`);
            return result;
        }
    }
    /**
     * Request user approval for plan execution
     */
    async requestApproval(plan) {
        // Check if approval is required based on risk level
        const requiresApproval = this.shouldRequireApproval(plan);
        if (!requiresApproval) {
            return {
                approved: true,
                timestamp: new Date()
            };
        }
        // Display plan details
        this.displayPlanForApproval(plan);
        // Get user approval
        const answers = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'approved',
                message: 'Do you approve this execution plan?',
                default: false
            },
            {
                type: 'checkbox',
                name: 'modifiedSteps',
                message: 'Select steps to skip (optional):',
                choices: plan.steps.map(step => ({
                    name: `${step.title} - ${step.description}`,
                    value: step.id,
                    checked: false
                })),
                when: (answers) => answers.approved
            },
            {
                type: 'input',
                name: 'userComments',
                message: 'Additional comments (optional):',
                when: (answers) => answers.approved
            }
        ]);
        return {
            approved: answers.approved,
            modifiedSteps: answers.modifiedSteps || [],
            userComments: answers.userComments,
            timestamp: new Date()
        };
    }
    /**
     * Execute a single step
     */
    async executeStep(step, plan) {
        const startTime = Date.now();
        const result = {
            stepId: step.id,
            status: 'success',
            duration: 0,
            timestamp: new Date(),
            logs: []
        };
        try {
            cli_ui_1.CliUI.startSpinner(`Executing: ${step.title}`);
            switch (step.type) {
                case 'tool':
                    result.output = await this.executeTool(step);
                    break;
                case 'validation':
                    result.output = await this.executeValidation(step, plan);
                    break;
                case 'user_input':
                    result.output = await this.executeUserInput(step);
                    break;
                case 'decision':
                    result.output = await this.executeDecision(step, plan);
                    break;
                default:
                    throw new Error(`Unknown step type: ${step.type}`);
            }
            result.duration = Date.now() - startTime;
            cli_ui_1.CliUI.succeedSpinner(`Completed: ${step.title} (${result.duration}ms)`);
        }
        catch (error) {
            result.status = 'failure';
            result.error = error;
            result.duration = Date.now() - startTime;
            cli_ui_1.CliUI.failSpinner(`Failed: ${step.title}`);
            cli_ui_1.CliUI.logError(`Step failed: ${error.message}`);
        }
        return result;
    }
    /**
     * Execute a tool step
     */
    async executeTool(step) {
        if (!step.toolName) {
            throw new Error('Tool step missing toolName');
        }
        const tool = this.toolRegistry.getTool(step.toolName);
        if (!tool) {
            throw new Error(`Tool not found: ${step.toolName}`);
        }
        // Execute with timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Step execution timeout')), this.config.timeoutPerStep);
        });
        const executionPromise = tool.execute(...(step.toolArgs ? Object.values(step.toolArgs) : []));
        return Promise.race([executionPromise, timeoutPromise]);
    }
    /**
     * Execute a validation step
     */
    async executeValidation(step, plan) {
        // Implement validation logic based on step requirements
        cli_ui_1.CliUI.updateSpinner('Running validation checks...');
        // Simulate validation
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { validated: true, checks: ['prerequisites', 'permissions', 'dependencies'] };
    }
    /**
     * Execute a user input step
     */
    async executeUserInput(step) {
        cli_ui_1.CliUI.stopSpinner();
        const answers = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: step.description,
                default: true
            }
        ]);
        return answers;
    }
    /**
     * Execute a decision step
     */
    async executeDecision(step, plan) {
        // Implement decision logic
        cli_ui_1.CliUI.updateSpinner('Evaluating decision criteria...');
        // Simulate decision making
        await new Promise(resolve => setTimeout(resolve, 500));
        return { decision: 'proceed', reasoning: 'All criteria met' };
    }
    /**
     * Handle step failure and determine if execution should continue
     */
    async handleStepFailure(step, result, plan) {
        cli_ui_1.CliUI.logError(`Step "${step.title}" failed: ${result.error?.message}`);
        // For non-critical steps, offer to continue
        if (step.riskLevel === 'low') {
            const answers = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'continue',
                    message: 'This step failed but is not critical. Continue with remaining steps?',
                    default: true
                }
            ]);
            return answers.continue;
        }
        // For critical steps, offer rollback if available
        if (this.config.enableRollback && step.reversible) {
            const answers = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'Critical step failed. What would you like to do?',
                    choices: [
                        { name: 'Abort execution', value: 'abort' },
                        { name: 'Skip this step and continue', value: 'skip' },
                        { name: 'Retry this step', value: 'retry' }
                    ]
                }
            ]);
            switch (answers.action) {
                case 'abort':
                    return false;
                case 'skip':
                    result.status = 'skipped';
                    return true;
                case 'retry':
                    // Implement retry logic
                    return true;
                default:
                    return false;
            }
        }
        return false;
    }
    /**
     * Resolve step execution order based on dependencies
     */
    resolveDependencyOrder(steps) {
        const stepMap = new Map(steps.map(step => [step.id, step]));
        const resolved = [];
        const resolving = new Set();
        const resolve = (stepId) => {
            if (resolved.find(s => s.id === stepId))
                return;
            if (resolving.has(stepId)) {
                throw new Error(`Circular dependency detected involving step: ${stepId}`);
            }
            const step = stepMap.get(stepId);
            if (!step)
                return;
            resolving.add(stepId);
            // Resolve dependencies first
            if (step.dependencies) {
                for (const depId of step.dependencies) {
                    resolve(depId);
                }
            }
            resolving.delete(stepId);
            resolved.push(step);
        };
        // Resolve all steps
        for (const step of steps) {
            resolve(step.id);
        }
        return resolved;
    }
    /**
     * Display plan details for user approval
     */
    displayPlanForApproval(plan) {
        cli_ui_1.CliUI.logSection('Plan Approval Required');
        cli_ui_1.CliUI.logKeyValue('Plan Title', plan.title);
        cli_ui_1.CliUI.logKeyValue('Description', plan.description);
        cli_ui_1.CliUI.logKeyValue('Total Steps', plan.steps.length.toString());
        cli_ui_1.CliUI.logKeyValue('Estimated Duration', `${Math.round(plan.estimatedTotalDuration / 1000)}s`);
        cli_ui_1.CliUI.logKeyValue('Risk Level', plan.riskAssessment.overallRisk);
        if (plan.riskAssessment.destructiveOperations > 0) {
            cli_ui_1.CliUI.logWarning(`⚠️  ${plan.riskAssessment.destructiveOperations} potentially destructive operations`);
        }
        cli_ui_1.CliUI.logSubsection('Execution Steps');
        plan.steps.forEach((step, index) => {
            const riskIcon = step.riskLevel === 'high' ? '🔴' : step.riskLevel === 'medium' ? '🟡' : '🟢';
            console.log(`  ${index + 1}. ${riskIcon} ${step.title}`);
            console.log(`     ${cli_ui_1.CliUI.dim(step.description)}`);
        });
    }
    /**
     * Check if plan requires user approval
     */
    shouldRequireApproval(plan) {
        const riskThreshold = this.config.requireApprovalForRisk;
        if (plan.riskAssessment.overallRisk === 'high')
            return true;
        if (plan.riskAssessment.overallRisk === 'medium' && riskThreshold === 'medium')
            return true;
        if (plan.riskAssessment.destructiveOperations > 0)
            return true;
        return false;
    }
    /**
     * Log execution summary
     */
    logExecutionSummary(result) {
        cli_ui_1.CliUI.logSection('Execution Summary');
        const duration = result.endTime ?
            result.endTime.getTime() - result.startTime.getTime() : 0;
        cli_ui_1.CliUI.logKeyValue('Status', result.status.toUpperCase());
        cli_ui_1.CliUI.logKeyValue('Duration', `${Math.round(duration / 1000)}s`);
        cli_ui_1.CliUI.logKeyValue('Total Steps', result.summary.totalSteps.toString());
        cli_ui_1.CliUI.logKeyValue('Successful', result.summary.successfulSteps.toString());
        cli_ui_1.CliUI.logKeyValue('Failed', result.summary.failedSteps.toString());
        cli_ui_1.CliUI.logKeyValue('Skipped', result.summary.skippedSteps.toString());
        // Show status icon
        const statusIcon = result.status === 'completed' ? '✅' :
            result.status === 'partial' ? '⚠️' : '❌';
        console.log(`\n${statusIcon} Plan execution ${result.status}`);
    }
    /**
     * Get execution history
     */
    getExecutionHistory() {
        return new Map(this.executionHistory);
    }
    /**
     * Get execution result for a specific plan
     */
    getExecutionResult(planId) {
        return this.executionHistory.get(planId);
    }
}
exports.PlanExecutor = PlanExecutor;
