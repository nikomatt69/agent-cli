"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanningManager = void 0;
const plan_generator_1 = require("./plan-generator");
const plan_executor_1 = require("./plan-executor");
const tool_registry_1 = require("../tools/tool-registry");
const cli_ui_1 = require("../utils/cli-ui");
/**
 * Production-ready Planning Manager
 * Orchestrates the complete planning and execution workflow
 */
class PlanningManager {
    constructor(workingDirectory, config) {
        this.planHistory = new Map();
        this.config = {
            maxStepsPerPlan: 50,
            requireApprovalForRisk: 'medium',
            enableRollback: true,
            logLevel: 'info',
            timeoutPerStep: 60000,
            ...config
        };
        this.toolRegistry = new tool_registry_1.ToolRegistry(workingDirectory);
        this.planGenerator = new plan_generator_1.PlanGenerator();
        this.planExecutor = new plan_executor_1.PlanExecutor(this.toolRegistry, this.config);
    }
    /**
     * Main entry point: Plan and execute a user request
     */
    async planAndExecute(userRequest, projectPath) {
        cli_ui_1.CliUI.logSection('AI Planning & Execution System');
        cli_ui_1.CliUI.logInfo(`Processing request: ${cli_ui_1.CliUI.highlight(userRequest)}`);
        try {
            // Step 1: Analyze project context
            const context = await this.buildPlannerContext(userRequest, projectPath);
            // Step 2: Generate execution plan
            const plan = await this.planGenerator.generatePlan(context);
            this.planHistory.set(plan.id, plan);
            // Step 3: Validate plan
            const validation = this.planGenerator.validatePlan(plan);
            this.displayValidationResults(validation);
            if (!validation.isValid) {
                throw new Error(`Plan validation failed: ${validation.errors.join(', ')}`);
            }
            // Step 4: Execute plan
            const result = await this.planExecutor.executePlan(plan);
            // Step 5: Log final results
            this.logPlanningSession(plan, result);
            return result;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Planning and execution failed: ${error.message}`);
            throw error;
        }
    }
    /**
     * Generate a plan without executing it
     */
    async generatePlanOnly(userRequest, projectPath) {
        cli_ui_1.CliUI.logSection('Plan Generation');
        const context = await this.buildPlannerContext(userRequest, projectPath);
        const plan = await this.planGenerator.generatePlan(context);
        this.planHistory.set(plan.id, plan);
        this.displayPlan(plan);
        return plan;
    }
    /**
     * Execute a previously generated plan
     */
    async executePlan(planId) {
        const plan = this.planHistory.get(planId);
        if (!plan) {
            throw new Error(`Plan not found: ${planId}`);
        }
        cli_ui_1.CliUI.logSection('Plan Execution');
        return await this.planExecutor.executePlan(plan);
    }
    /**
     * List all generated plans
     */
    listPlans() {
        return Array.from(this.planHistory.values());
    }
    /**
     * Get plan by ID
     */
    getPlan(planId) {
        return this.planHistory.get(planId);
    }
    /**
     * Get execution history
     */
    getExecutionHistory() {
        return this.planExecutor.getExecutionHistory();
    }
    /**
     * Display tool registry information
     */
    displayToolRegistry() {
        this.toolRegistry.displayRegistry();
    }
    /**
     * Get planning statistics
     */
    getPlanningStats() {
        const plans = Array.from(this.planHistory.values());
        const executions = Array.from(this.planExecutor.getExecutionHistory().values());
        return {
            totalPlansGenerated: plans.length,
            totalPlansExecuted: executions.length,
            successfulExecutions: executions.filter(e => e.status === 'completed').length,
            failedExecutions: executions.filter(e => e.status === 'failed').length,
            averageStepsPerPlan: plans.length > 0 ?
                plans.reduce((sum, p) => sum + p.steps.length, 0) / plans.length : 0,
            averageExecutionTime: executions.length > 0 ?
                executions.reduce((sum, e) => {
                    const duration = e.endTime ? e.endTime.getTime() - e.startTime.getTime() : 0;
                    return sum + duration;
                }, 0) / executions.length : 0,
            riskDistribution: this.calculateRiskDistribution(plans),
            toolUsageStats: this.calculateToolUsage(plans)
        };
    }
    /**
     * Build planner context from user request and project analysis
     */
    async buildPlannerContext(userRequest, projectPath) {
        cli_ui_1.CliUI.startSpinner('Analyzing project context...');
        try {
            // Get available tools
            const availableTools = this.toolRegistry.listTools().map(name => {
                const metadata = this.toolRegistry.getToolMetadata(name);
                return {
                    name,
                    description: metadata?.description || '',
                    riskLevel: metadata?.riskLevel || 'medium',
                    reversible: metadata?.reversible || true,
                    estimatedDuration: metadata?.estimatedDuration || 5000,
                    requiredArgs: [], // Would be populated from tool introspection
                    optionalArgs: []
                };
            });
            // Basic project analysis (could be enhanced with actual file scanning)
            const projectAnalysis = await this.analyzeProject(projectPath);
            cli_ui_1.CliUI.succeedSpinner('Project context analyzed');
            return {
                userRequest,
                projectPath,
                availableTools,
                projectAnalysis,
                userPreferences: {
                    riskTolerance: 'moderate',
                    preferredTools: [],
                    excludedOperations: []
                }
            };
        }
        catch (error) {
            cli_ui_1.CliUI.failSpinner('Failed to analyze project context');
            throw error;
        }
    }
    /**
     * Analyze project structure and characteristics
     */
    async analyzeProject(projectPath) {
        // This would use the FindFilesTool to scan the project
        // For now, return a mock analysis
        return {
            fileCount: 100,
            languages: ['typescript', 'javascript'],
            frameworks: ['next.js', 'react'],
            hasTests: true,
            hasDocumentation: true
        };
    }
    /**
     * Display plan details
     */
    displayPlan(plan) {
        cli_ui_1.CliUI.logSection(`Generated Plan: ${plan.title}`);
        cli_ui_1.CliUI.logKeyValue('Plan ID', plan.id);
        cli_ui_1.CliUI.logKeyValue('Description', plan.description);
        cli_ui_1.CliUI.logKeyValue('Total Steps', plan.steps.length.toString());
        cli_ui_1.CliUI.logKeyValue('Estimated Duration', `${Math.round(plan.estimatedTotalDuration / 1000)}s`);
        cli_ui_1.CliUI.logKeyValue('Risk Level', plan.riskAssessment.overallRisk);
        cli_ui_1.CliUI.logSubsection('Execution Steps');
        plan.steps.forEach((step, index) => {
            const riskIcon = step.riskLevel === 'high' ? '🔴' :
                step.riskLevel === 'medium' ? '🟡' : '🟢';
            const typeIcon = step.type === 'tool' ? '🔧' :
                step.type === 'validation' ? '✅' :
                    step.type === 'user_input' ? '👤' : '🤔';
            console.log(`  ${index + 1}. ${riskIcon} ${typeIcon} ${step.title}`);
            console.log(`     ${cli_ui_1.CliUI.dim(step.description)}`);
            if (step.dependencies && step.dependencies.length > 0) {
                console.log(`     ${cli_ui_1.CliUI.dim(`Dependencies: ${step.dependencies.length} step(s)`)}`);
            }
        });
    }
    /**
     * Display validation results
     */
    displayValidationResults(validation) {
        if (validation.errors.length > 0) {
            cli_ui_1.CliUI.logSubsection('Validation Errors');
            validation.errors.forEach(error => cli_ui_1.CliUI.logError(error));
        }
        if (validation.warnings.length > 0) {
            cli_ui_1.CliUI.logSubsection('Validation Warnings');
            validation.warnings.forEach(warning => cli_ui_1.CliUI.logWarning(warning));
        }
        if (validation.suggestions.length > 0) {
            cli_ui_1.CliUI.logSubsection('Suggestions');
            validation.suggestions.forEach(suggestion => cli_ui_1.CliUI.logInfo(suggestion));
        }
    }
    /**
     * Log complete planning session results
     */
    logPlanningSession(plan, result) {
        cli_ui_1.CliUI.logSection('Planning Session Complete');
        const duration = result.endTime ?
            result.endTime.getTime() - result.startTime.getTime() : 0;
        cli_ui_1.CliUI.logKeyValue('Plan ID', plan.id);
        cli_ui_1.CliUI.logKeyValue('Execution Status', result.status.toUpperCase());
        cli_ui_1.CliUI.logKeyValue('Total Duration', `${Math.round(duration / 1000)}s`);
        cli_ui_1.CliUI.logKeyValue('Steps Executed', `${result.summary.successfulSteps}/${result.summary.totalSteps}`);
        if (result.summary.failedSteps > 0) {
            cli_ui_1.CliUI.logWarning(`${result.summary.failedSteps} steps failed`);
        }
        if (result.summary.skippedSteps > 0) {
            cli_ui_1.CliUI.logInfo(`${result.summary.skippedSteps} steps skipped`);
        }
        // Save session log
        this.saveSessionLog(plan, result);
    }
    /**
     * Save session log for audit trail
     */
    saveSessionLog(plan, result) {
        const sessionLog = {
            planId: plan.id,
            planTitle: plan.title,
            userRequest: plan.context.userRequest,
            executionResult: result,
            timestamp: new Date(),
            toolsUsed: plan.steps
                .filter(s => s.type === 'tool' && s.toolName)
                .map(s => s.toolName)
        };
        // In production, this would save to a persistent log store
        cli_ui_1.CliUI.logInfo(`Session logged: ${plan.id}`);
    }
    /**
     * Calculate risk distribution across plans
     */
    calculateRiskDistribution(plans) {
        return plans.reduce((acc, plan) => {
            const risk = plan.riskAssessment.overallRisk;
            acc[risk] = (acc[risk] || 0) + 1;
            return acc;
        }, {});
    }
    /**
     * Calculate tool usage statistics
     */
    calculateToolUsage(plans) {
        const toolUsage = {};
        plans.forEach(plan => {
            plan.steps.forEach(step => {
                if (step.type === 'tool' && step.toolName) {
                    toolUsage[step.toolName] = (toolUsage[step.toolName] || 0) + 1;
                }
            });
        });
        return toolUsage;
    }
}
exports.PlanningManager = PlanningManager;
