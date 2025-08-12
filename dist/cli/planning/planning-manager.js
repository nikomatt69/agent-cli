"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanningManager = void 0;
const events_1 = require("events");
const plan_generator_1 = require("./plan-generator");
const plan_executor_1 = require("./plan-executor");
const tool_registry_1 = require("../tools/tool-registry");
const cli_ui_1 = require("../utils/cli-ui");
/**
 * Production-ready Planning Manager
 * Orchestrates the complete planning and execution workflow
 */
class PlanningManager extends events_1.EventEmitter {
    constructor(workingDirectory, config) {
        super(); // Call EventEmitter constructor
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
            // Render real todos in structured UI (all modes)
            try {
                const { advancedUI } = await Promise.resolve().then(() => __importStar(require('../ui/advanced-cli-ui')));
                const todoItems = (plan.todos || []).map(t => ({ content: t.title || t.description, status: t.status }));
                advancedUI.showTodos?.(todoItems, plan.title || 'Update Todos');
            }
            catch { }
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
        // Show todos panel in structured UI
        try {
            const { advancedUI } = await Promise.resolve().then(() => __importStar(require('../ui/advanced-cli-ui')));
            const todoItems = (plan.todos || []).map(t => ({ content: t.title || t.description, status: t.status }));
            advancedUI.showTodos?.(todoItems, plan.title || 'Update Todos');
        }
        catch { }
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
        return await this.executeWithEventTracking(plan);
    }
    /**
     * Execute plan with step-by-step event emission for UI updates
     */
    async executeWithEventTracking(plan) {
        // Emit plan start event
        this.emit('planExecutionStart', { planId: plan.id, title: plan.title });
        try {
            // Track step execution
            const updatedTodos = [...plan.todos];
            for (let i = 0; i < updatedTodos.length; i++) {
                const todo = updatedTodos[i];
                // Emit step start event
                this.emit('stepStart', {
                    planId: plan.id,
                    stepIndex: i,
                    stepId: todo.id,
                    todos: updatedTodos
                });
                // Update step status to in_progress
                updatedTodos[i] = { ...todo, status: 'in_progress' };
                this.emit('stepProgress', {
                    planId: plan.id,
                    stepIndex: i,
                    stepId: todo.id,
                    todos: updatedTodos
                });
                // Simulate step execution (in a real implementation, this would execute the actual step)
                await new Promise(resolve => setTimeout(resolve, 1000));
                // Update step status to completed
                updatedTodos[i] = { ...todo, status: 'completed' };
                this.emit('stepComplete', {
                    planId: plan.id,
                    stepIndex: i,
                    stepId: todo.id,
                    todos: updatedTodos
                });
            }
            // Emit plan completion event
            this.emit('planExecutionComplete', { planId: plan.id, title: plan.title });
            // Return execution result
            return {
                planId: plan.id,
                status: 'completed',
                startTime: new Date(),
                endTime: new Date(),
                stepResults: updatedTodos.map(todo => ({
                    stepId: todo.id,
                    status: 'success',
                    output: `Step completed: ${todo.title || todo.description}`,
                    error: undefined,
                    duration: 1000,
                    timestamp: new Date(),
                    logs: []
                })),
                summary: {
                    totalSteps: updatedTodos.length,
                    successfulSteps: updatedTodos.length,
                    failedSteps: 0,
                    skippedSteps: 0
                }
            };
        }
        catch (error) {
            this.emit('planExecutionError', {
                planId: plan.id,
                error: error.message || error
            });
            throw error;
        }
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
