"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.planningService = exports.PlanningService = void 0;
const chalk_1 = __importDefault(require("chalk"));
const plan_generator_1 = require("../planning/plan-generator");
const autonomous_planner_1 = require("../planning/autonomous-planner");
const nanoid_1 = require("nanoid");
const tool_service_1 = require("./tool-service");
class PlanningService {
    constructor() {
        this.activePlans = new Map();
        this.workingDirectory = process.cwd();
        this.availableTools = [];
        this.planGenerator = new plan_generator_1.PlanGenerator();
        this.autonomousPlanner = new autonomous_planner_1.AutonomousPlanner(this.workingDirectory);
        this.initializeTools();
    }
    initializeTools() {
        this.availableTools = tool_service_1.toolService.getAvailableTools();
    }
    refreshAvailableTools() {
        this.initializeTools();
    }
    convertToPlanningTools(tools) {
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            riskLevel: this.assessToolRisk(tool),
            reversible: this.isToolReversible(tool),
            estimatedDuration: this.estimateToolDuration(tool),
            requiredArgs: this.extractRequiredArgs(tool),
            optionalArgs: this.extractOptionalArgs(tool)
        }));
    }
    assessToolRisk(tool) {
        if (tool.category === 'command' || tool.name.includes('delete') || tool.name.includes('remove')) {
            return 'high';
        }
        if (tool.category === 'file' && (tool.name.includes('write') || tool.name.includes('modify'))) {
            return 'medium';
        }
        return 'low';
    }
    isToolReversible(tool) {
        const irreversibleOperations = ['delete', 'remove', 'execute', 'install'];
        return !irreversibleOperations.some(op => tool.name.toLowerCase().includes(op));
    }
    estimateToolDuration(tool) {
        switch (tool.category) {
            case 'command': return 10000;
            case 'package': return 30000;
            case 'analysis': return 5000;
            case 'git': return 3000;
            case 'file': return 1000;
            default: return 5000;
        }
    }
    extractRequiredArgs(tool) {
        if (tool.name.includes('file'))
            return ['filePath'];
        if (tool.name.includes('command'))
            return ['command'];
        if (tool.name.includes('git'))
            return [];
        return [];
    }
    extractOptionalArgs(tool) {
        if (tool.name.includes('file'))
            return ['encoding', 'backup'];
        if (tool.name.includes('command'))
            return ['timeout', 'cwd'];
        return [];
    }
    setWorkingDirectory(dir) {
        this.workingDirectory = dir;
    }
    async createPlan(userRequest, options = {
        showProgress: true,
        autoExecute: false,
        confirmSteps: true
    }) {
        console.log(chalk_1.default.blue('🎯 Creating execution plan...'));
        const context = {
            userRequest,
            availableTools: this.convertToPlanningTools(this.availableTools),
            projectPath: this.workingDirectory
        };
        const plan = await this.planGenerator.generatePlan(context);
        this.activePlans.set(plan.id, plan);
        if (options.showProgress) {
            this.displayPlan(plan);
        }
        return plan;
    }
    async executePlan(planId, options) {
        const plan = this.activePlans.get(planId);
        if (!plan) {
            console.log(chalk_1.default.red(`Plan ${planId} not found`));
            return;
        }
        console.log(chalk_1.default.green(`🚀 Executing plan: ${plan.title}`));
        try {
            for await (const event of this.autonomousPlanner.executePlan(plan)) {
                switch (event.type) {
                    case 'plan_start':
                        console.log(chalk_1.default.cyan(`📋 Starting: ${event.planId}`));
                        break;
                    case 'plan_created':
                        console.log(chalk_1.default.blue(`🔄 ${event.result}`));
                        break;
                    case 'todo_start':
                        console.log(chalk_1.default.green(`✅ ${event.todoId}`));
                        break;
                    case 'todo_progress':
                        console.log(chalk_1.default.red(`🔄 ${event.progress}`));
                        break;
                    case 'todo_complete':
                        console.log(chalk_1.default.green(`✅ Todo completed`));
                        break;
                    case 'plan_failed':
                        console.log(chalk_1.default.red(`❌ Plan execution failed: ${event.error}`));
                        break;
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Plan execution error: ${error.message}`));
            plan.status = 'failed';
        }
    }
    displayPlan(plan) {
        console.log(chalk_1.default.cyan.bold(`\\n📋 Execution Plan: ${plan.title}`));
        console.log(chalk_1.default.gray(`Description: ${plan.description}`));
        console.log(chalk_1.default.gray(`Steps: ${plan.steps.length} • Risk: ${plan.riskAssessment.overallRisk} • Est. ${Math.round(plan.estimatedTotalDuration / 1000)}s`));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        plan.steps.forEach((step, index) => {
            const statusIcon = '⏳';
            const riskColor = step.riskLevel === 'high' ? chalk_1.default.red :
                step.riskLevel === 'medium' ? chalk_1.default.yellow : chalk_1.default.green;
            console.log(`${index + 1}. ${statusIcon} ${chalk_1.default.bold(step.title)}`);
            console.log(`   ${chalk_1.default.dim(step.description)} ${riskColor(`[${step.riskLevel}]`)}`);
            if (step.dependencies && step.dependencies.length > 0) {
                console.log(`   ${chalk_1.default.dim('Dependencies:')} ${step.dependencies.join(', ')}`);
            }
        });
        console.log(chalk_1.default.gray('─'.repeat(60)));
        if (plan.riskAssessment.destructiveOperations > 0) {
            console.log(chalk_1.default.red(`⚠️  Contains ${plan.riskAssessment.destructiveOperations} destructive operations`));
        }
        if (plan.riskAssessment.fileModifications > 0) {
            console.log(chalk_1.default.yellow(`📝 Will modify ${plan.riskAssessment.fileModifications} files`));
        }
    }
    getActivePlans() {
        return Array.from(this.activePlans.values());
    }
    updatePlanStatus(planId, status) {
        const plan = this.activePlans.get(planId);
        if (plan) {
            plan.status = status;
        }
    }
    addTodoToPlan(planId, todo) {
        const plan = this.activePlans.get(planId);
        if (plan) {
            const newTodo = {
                ...todo,
                id: (0, nanoid_1.nanoid)()
            };
            plan.todos.push(newTodo);
        }
    }
    updateTodoStatus(planId, todoId, status) {
        const plan = this.activePlans.get(planId);
        if (plan) {
            const todo = plan.todos.find(t => t.id === todoId);
            if (todo) {
                todo.status = status;
            }
        }
    }
    clearCompletedPlans() {
        const completedCount = Array.from(this.activePlans.values())
            .filter(p => p.status === 'completed').length;
        for (const [id, plan] of this.activePlans) {
            if (plan.status === 'completed') {
                this.activePlans.delete(id);
            }
        }
        console.log(chalk_1.default.green(`🧹 Cleared ${completedCount} completed plans`));
        return completedCount;
    }
    getStatistics() {
        const plans = Array.from(this.activePlans.values());
        return {
            total: plans.length,
            pending: plans.filter(p => p.status === 'pending').length,
            running: plans.filter(p => p.status === 'running').length,
            completed: plans.filter(p => p.status === 'completed').length,
            failed: plans.filter(p => p.status === 'failed').length
        };
    }
}
exports.PlanningService = PlanningService;
exports.planningService = new PlanningService();
