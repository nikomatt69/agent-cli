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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedPlanning = exports.EnhancedPlanningSystem = void 0;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const nanoid_1 = require("nanoid");
const model_provider_1 = require("../ai/model-provider");
const terminal_ui_1 = require("../ui/terminal-ui");
const workspace_context_1 = require("../context/workspace-context");
const boxen_1 = __importDefault(require("boxen"));
class EnhancedPlanningSystem {
    constructor(workingDirectory = process.cwd()) {
        this.activePlans = new Map();
        this.workingDirectory = workingDirectory;
    }
    /**
     * Generate a comprehensive plan with todo.md file
     */
    async generatePlan(goal, options = {}) {
        const { maxTodos = 20, includeContext = true, showDetails = true, saveTodoFile = true, todoFilePath = 'todo.md' } = options;
        console.log(chalk_1.default.blue.bold(`\\n🎯 Generating Plan: ${goal}`));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        // Get project context
        let projectContext = '';
        if (includeContext) {
            console.log(chalk_1.default.gray('📁 Analyzing project context...'));
            const context = workspace_context_1.workspaceContext.getContextForAgent('planner', 10);
            projectContext = context.projectSummary;
        }
        // Generate AI-powered plan
        console.log(chalk_1.default.gray('🧠 Generating AI plan...'));
        const todos = await this.generateTodosWithAI(goal, projectContext, maxTodos);
        // Create plan object
        const plan = {
            id: (0, nanoid_1.nanoid)(),
            title: this.extractPlanTitle(goal),
            description: goal,
            goal,
            todos,
            status: 'draft',
            estimatedTotalDuration: todos.reduce((sum, todo) => sum + todo.estimatedDuration, 0),
            createdAt: new Date(),
            workingDirectory: this.workingDirectory,
            context: {
                projectInfo: includeContext ? projectContext : undefined,
                userRequirements: [goal],
            },
        };
        this.activePlans.set(plan.id, plan);
        // Show plan details and real todos in structured UI
        if (showDetails) {
            this.displayPlan(plan);
            try {
                const { advancedUI } = await Promise.resolve().then(() => __importStar(require('../ui/advanced-cli-ui')));
                const todoItems = plan.todos.map(t => ({ content: t.title || t.description, status: t.status }));
                advancedUI.showTodos?.(todoItems, plan.title || 'Update Todos');
            }
            catch (_) {
                // UI not available; ignore
            }
        }
        // Save todo.md file
        if (saveTodoFile) {
            await this.saveTodoFile(plan, todoFilePath);
        }
        return plan;
    }
    /**
     * Request approval for plan execution
     */
    async requestPlanApproval(planId) {
        const plan = this.activePlans.get(planId);
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }
        console.log(chalk_1.default.yellow.bold('\\n⚠️  Plan Review Required'));
        console.log(chalk_1.default.gray('═'.repeat(60)));
        // Show plan summary
        this.displayPlanSummary(plan);
        // Ask for approval
        const approved = await terminal_ui_1.approvalSystem.quickApproval(`Execute Plan: ${plan.title}`, `Execute ${plan.todos.length} tasks with estimated duration of ${Math.round(plan.estimatedTotalDuration)} minutes`, this.assessPlanRisk(plan));
        if (approved) {
            plan.status = 'approved';
            plan.approvedAt = new Date();
            console.log(chalk_1.default.green('✅ Plan approved for execution'));
        }
        else {
            console.log(chalk_1.default.yellow('❌ Plan execution cancelled'));
        }
        return approved;
    }
    /**
     * Execute approved plan
     */
    async executePlan(planId) {
        const plan = this.activePlans.get(planId);
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }
        if (plan.status !== 'approved') {
            const approved = await this.requestPlanApproval(planId);
            if (!approved) {
                return;
            }
        }
        console.log(chalk_1.default.blue.bold(`\\n🚀 Executing Plan: ${plan.title}`));
        console.log(chalk_1.default.gray('═'.repeat(60)));
        plan.status = 'executing';
        plan.startedAt = new Date();
        try {
            // Execute todos in dependency order
            const executionOrder = this.resolveDependencyOrder(plan.todos);
            let completedCount = 0;
            for (const todo of executionOrder) {
                console.log(chalk_1.default.cyan(`\\n📋 [${completedCount + 1}/${plan.todos.length}] ${todo.title}`));
                console.log(chalk_1.default.gray(`   ${todo.description}`));
                todo.status = 'in_progress';
                todo.startedAt = new Date();
                try {
                    // Execute the todo
                    const startTime = Date.now();
                    await this.executeTodo(todo, plan);
                    const duration = Date.now() - startTime;
                    todo.status = 'completed';
                    todo.completedAt = new Date();
                    todo.actualDuration = Math.round(duration / 60000); // convert to minutes
                    console.log(chalk_1.default.green(`   ✅ Completed in ${Math.round(duration / 1000)}s`));
                    completedCount++;
                    // Update todo.md file
                    await this.updateTodoFile(plan);
                }
                catch (error) {
                    todo.status = 'failed';
                    console.log(chalk_1.default.red(`   ❌ Failed: ${error.message}`));
                    // Ask if should continue with remaining todos
                    const shouldContinue = await terminal_ui_1.approvalSystem.quickApproval('Continue Execution?', `Todo "${todo.title}" failed. Continue with remaining todos?`, 'medium');
                    if (!shouldContinue) {
                        console.log(chalk_1.default.yellow('🛑 Plan execution stopped by user'));
                        plan.status = 'failed';
                        return;
                    }
                }
                // Show progress
                const progress = Math.round((completedCount / plan.todos.length) * 100);
                console.log(chalk_1.default.blue(`   📊 Progress: ${progress}% (${completedCount}/${plan.todos.length})`));
            }
            // Plan completed
            plan.status = 'completed';
            plan.completedAt = new Date();
            plan.actualTotalDuration = plan.todos.reduce((sum, todo) => sum + (todo.actualDuration || 0), 0);
            console.log(chalk_1.default.green.bold(`\\n🎉 Plan Completed Successfully!`));
            console.log(chalk_1.default.gray(`✅ ${completedCount}/${plan.todos.length} todos completed`));
            console.log(chalk_1.default.gray(`⏱️  Total time: ${plan.actualTotalDuration} minutes`));
            // Update final todo.md
            await this.updateTodoFile(plan);
        }
        catch (error) {
            plan.status = 'failed';
            console.log(chalk_1.default.red(`\\n❌ Plan execution failed: ${error.message}`));
        }
    }
    /**
     * Generate todos using AI
     */
    async generateTodosWithAI(goal, context, maxTodos) {
        const messages = [
            {
                role: 'system',
                content: `You are an expert project planner. Create a detailed, actionable plan to accomplish the given goal.

Generate a JSON array of todo items with the following structure:
{
  "todos": [
    {
      "title": "Clear, actionable title",
      "description": "Detailed description of what needs to be done",
      "priority": "low|medium|high|critical",
      "category": "planning|setup|implementation|testing|documentation|deployment",
      "estimatedDuration": 30, // minutes
      "dependencies": [], // IDs of other todos that must be completed first
      "tags": ["tag1", "tag2"], // relevant tags
      "commands": ["command1", "command2"], // shell commands if needed
      "files": ["file1.ts", "file2.js"], // files that will be created/modified
      "reasoning": "Why this todo is necessary and how it fits in the overall plan"
    }
  ]
}

Guidelines:
1. Break down complex tasks into manageable todos (5-60 minutes each)
2. Consider dependencies between tasks
3. Include setup, implementation, testing, and documentation
4. Be specific about files and commands
5. Estimate realistic durations
6. Use appropriate priorities
7. Maximum ${maxTodos} todos

Project Context:
${context}

Generate a comprehensive plan that is practical and executable.`
            },
            {
                role: 'user',
                content: `Create a detailed plan to: ${goal}`
            }
        ];
        let lastModelOutput = '';
        try {
            const response = await model_provider_1.modelProvider.generateResponse({ messages });
            lastModelOutput = response || '';
            // Prefer fenced JSON blocks if present, otherwise fall back to broad match
            const raw = lastModelOutput.trim();
            const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
            let jsonString = fenceMatch ? fenceMatch[1].trim() : undefined;
            if (!jsonString) {
                const jsonMatch = raw.match(/\{[\s\S]*\}/);
                if (jsonMatch)
                    jsonString = jsonMatch[0];
            }
            if (!jsonString) {
                throw new Error('AI did not return valid JSON plan');
            }
            const planData = JSON.parse(jsonString);
            // Convert to TodoItem format
            const todos = planData.todos.map((todoData, index) => ({
                id: (0, nanoid_1.nanoid)(),
                title: todoData.title || `Task ${index + 1}`,
                description: todoData.description || '',
                status: 'pending',
                priority: todoData.priority || 'medium',
                category: todoData.category || 'implementation',
                estimatedDuration: todoData.estimatedDuration || 30,
                dependencies: todoData.dependencies || [],
                tags: todoData.tags || [],
                commands: todoData.commands || [],
                files: todoData.files || [],
                reasoning: todoData.reasoning || '',
                createdAt: new Date(),
            }));
            console.log(chalk_1.default.green(`✅ Generated ${todos.length} todos`));
            return todos;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to generate AI plan: ${error.message}`));
            if (lastModelOutput) {
                const preview = lastModelOutput.replace(/```/g, '```').slice(0, 400);
                console.log(chalk_1.default.gray(`↪ Raw AI output (truncated):\n${preview}${lastModelOutput.length > 400 ? '…' : ''}`));
            }
            // Fallback: create a simple todo
            return [{
                    id: (0, nanoid_1.nanoid)(),
                    title: 'Execute Task',
                    description: goal,
                    status: 'pending',
                    priority: 'medium',
                    category: 'implementation',
                    estimatedDuration: 60,
                    dependencies: [],
                    tags: ['manual'],
                    reasoning: 'Fallback todo when AI planning fails',
                    createdAt: new Date(),
                }];
        }
    }
    /**
     * Display plan in formatted view
     */
    displayPlan(plan) {
        console.log((0, boxen_1.default)(`${chalk_1.default.blue.bold(plan.title)}\\n\\n` +
            `${chalk_1.default.gray('Goal:')} ${plan.goal}\\n` +
            `${chalk_1.default.gray('Todos:')} ${plan.todos.length}\\n` +
            `${chalk_1.default.gray('Estimated Duration:')} ${Math.round(plan.estimatedTotalDuration)} minutes\\n` +
            `${chalk_1.default.gray('Status:')} ${this.getStatusColor(plan.status)(plan.status.toUpperCase())}`, {
            padding: 1,
            margin: { top: 1, bottom: 1, left: 0, right: 0 },
            borderStyle: 'round',
            borderColor: 'blue',
        }));
        console.log(chalk_1.default.blue.bold('\\n📋 Todo Items:'));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        plan.todos.forEach((todo, index) => {
            const priorityIcon = this.getPriorityIcon(todo.priority);
            const statusIcon = this.getStatusIcon(todo.status);
            const categoryColor = this.getCategoryColor(todo.category);
            console.log(`${index + 1}. ${statusIcon} ${priorityIcon} ${chalk_1.default.bold(todo.title)}`);
            console.log(`   ${chalk_1.default.gray(todo.description)}`);
            console.log(`   ${categoryColor(todo.category)} | ${chalk_1.default.gray(todo.estimatedDuration + 'min')} | ${chalk_1.default.gray(todo.tags.join(', '))}`);
            if (todo.dependencies.length > 0) {
                console.log(`   ${chalk_1.default.yellow('Dependencies:')} ${todo.dependencies.join(', ')}`);
            }
            if (todo.files && todo.files.length > 0) {
                console.log(`   ${chalk_1.default.blue('Files:')} ${todo.files.join(', ')}`);
            }
            console.log();
        });
    }
    /**
     * Display plan summary
     */
    displayPlanSummary(plan) {
        const stats = {
            byPriority: this.groupBy(plan.todos, 'priority'),
            byCategory: this.groupBy(plan.todos, 'category'),
            totalFiles: new Set(plan.todos.flatMap(t => t.files || [])).size,
            totalCommands: plan.todos.reduce((sum, t) => sum + (t.commands?.length || 0), 0),
        };
        console.log(chalk_1.default.cyan('📊 Plan Statistics:'));
        console.log(`  • Total Todos: ${plan.todos.length}`);
        console.log(`  • Estimated Duration: ${Math.round(plan.estimatedTotalDuration)} minutes`);
        console.log(`  • Files to modify: ${stats.totalFiles}`);
        console.log(`  • Commands to run: ${stats.totalCommands}`);
        console.log(chalk_1.default.cyan('\\n🎯 Priority Distribution:'));
        Object.entries(stats.byPriority).forEach(([priority, todos]) => {
            const icon = this.getPriorityIcon(priority);
            console.log(`  ${icon} ${priority}: ${todos.length} todos`);
        });
        console.log(chalk_1.default.cyan('\n📁 Category Distribution:'));
        Object.entries(stats.byCategory).forEach(([category, todos]) => {
            const color = this.getCategoryColor(category);
            console.log(`  • ${color(category)}: ${todos.length} todos`);
        });
    }
    /**
     * Save plan to todo.md file
     */
    async saveTodoFile(plan, filename = 'todo.md') {
        const todoPath = path.join(this.workingDirectory, filename);
        let content = `# Todo Plan: ${plan.title}\n\n`;
        content += `**Goal:** ${plan.goal}\n\n`;
        content += `**Status:** ${plan.status.toUpperCase()}\n`;
        content += `**Created:** ${plan.createdAt.toISOString()}\n`;
        content += `**Estimated Duration:** ${Math.round(plan.estimatedTotalDuration)} minutes\n\n`;
        if (plan.context.projectInfo) {
            content += `## Project Context\n\n`;
            const projectInfoBlock = typeof plan.context.projectInfo === 'string'
                ? plan.context.projectInfo
                : JSON.stringify(plan.context.projectInfo, null, 2);
            const fenceLang = typeof plan.context.projectInfo === 'string' ? '' : 'json';
            content += `\`\`\`${fenceLang}\n${projectInfoBlock}\n\`\`\`\n\n`;
        }
        content += `## Todo Items (${plan.todos.length})\n\n`;
        plan.todos.forEach((todo, index) => {
            const statusEmoji = this.getStatusEmoji(todo.status);
            const priorityEmoji = this.getPriorityEmoji(todo.priority);
            content += `### ${index + 1}. ${statusEmoji} ${todo.title} ${priorityEmoji}\n\n`;
            content += `**Description:** ${todo.description}\n\n`;
            content += `**Category:** ${todo.category} | **Priority:** ${todo.priority} | **Duration:** ${todo.estimatedDuration}min\n\n`;
            if (todo.reasoning) {
                content += `**Reasoning:** ${todo.reasoning}\n\n`;
            }
            if (todo.dependencies.length > 0) {
                content += `**Dependencies:** ${todo.dependencies.join(', ')}\n\n`;
            }
            if (todo.files && todo.files.length > 0) {
                content += `**Files:** \`${todo.files.join('\`, \`')}\`\n\n`;
            }
            if (todo.commands && todo.commands.length > 0) {
                content += `**Commands:**\n`;
                todo.commands.forEach(cmd => {
                    content += `- \`${cmd}\`\n`;
                });
                content += '\n';
            }
            if (todo.tags.length > 0) {
                content += `**Tags:** ${todo.tags.map(tag => `#${tag}`).join(' ')}\n\n`;
            }
            if (todo.status === 'completed' && todo.completedAt) {
                content += `**Completed:** ${todo.completedAt.toISOString()}\n`;
                if (todo.actualDuration) {
                    content += `**Actual Duration:** ${todo.actualDuration}min\n`;
                }
                content += '\n';
            }
            content += '---\n\n';
        });
        // Add statistics
        content += `## Statistics\n\n`;
        content += `- **Total Todos:** ${plan.todos.length}\n`;
        content += `- **Completed:** ${plan.todos.filter(t => t.status === 'completed').length}\n`;
        content += `- **In Progress:** ${plan.todos.filter(t => t.status === 'in_progress').length}\n`;
        content += `- **Pending:** ${plan.todos.filter(t => t.status === 'pending').length}\n`;
        content += `- **Failed:** ${plan.todos.filter(t => t.status === 'failed').length}\n`;
        if (plan.actualTotalDuration) {
            content += `- **Actual Duration:** ${plan.actualTotalDuration}min\n`;
            content += `- **Estimated vs Actual:** ${Math.round((plan.actualTotalDuration / plan.estimatedTotalDuration) * 100)}%\n`;
        }
        content += `\n---\n*Generated by NikCLI on ${new Date().toISOString()}*\n`;
        await fs.writeFile(todoPath, content, 'utf8');
        console.log(chalk_1.default.green(`📄 Todo file saved: ${todoPath}`));
    }
    /**
     * Update existing todo.md file
     */
    async updateTodoFile(plan, filename = 'todo.md') {
        await this.saveTodoFile(plan, filename);
    }
    /**
     * Execute a single todo
     */
    async executeTodo(todo, plan) {
        // This is a simplified execution - in a real implementation,
        // you would integrate with the actual tool execution system
        console.log(chalk_1.default.gray(`   🔍 Analyzing todo: ${todo.title}`));
        // Simulate execution time
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Execute commands if specified
        if (todo.commands && todo.commands.length > 0) {
            for (const command of todo.commands) {
                console.log(chalk_1.default.blue(`   ⚡ Running: ${command}`));
                // In real implementation, execute the command using tool system
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        // Create/modify files if specified
        if (todo.files && todo.files.length > 0) {
            for (const file of todo.files) {
                console.log(chalk_1.default.yellow(`   📄 Working on file: ${file}`));
                // In real implementation, create/modify the file
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
    }
    /**
     * Resolve todo execution order based on dependencies
     */
    resolveDependencyOrder(todos) {
        const resolved = [];
        const remaining = [...todos];
        const todoMap = new Map(todos.map(todo => [todo.id, todo]));
        while (remaining.length > 0) {
            const canExecute = remaining.filter(todo => todo.dependencies.every(depId => resolved.some(resolvedTodo => resolvedTodo.id === depId)));
            if (canExecute.length === 0) {
                // Break circular dependencies by taking the first remaining todo
                const next = remaining.shift();
                resolved.push(next);
            }
            else {
                // Execute todos with satisfied dependencies
                canExecute.forEach(todo => {
                    const index = remaining.indexOf(todo);
                    remaining.splice(index, 1);
                    resolved.push(todo);
                });
            }
        }
        return resolved;
    }
    /**
     * Assess plan risk level
     */
    assessPlanRisk(plan) {
        const criticalCount = plan.todos.filter(t => t.priority === 'critical').length;
        const highCount = plan.todos.filter(t => t.priority === 'high').length;
        const hasFileOperations = plan.todos.some(t => t.files && t.files.length > 0);
        const hasCommands = plan.todos.some(t => t.commands && t.commands.length > 0);
        if (criticalCount > 0)
            return 'critical';
        if (highCount > 3 || (highCount > 0 && hasCommands))
            return 'high';
        if (hasFileOperations || hasCommands)
            return 'medium';
        return 'low';
    }
    // Utility methods
    extractPlanTitle(goal) {
        return goal.length > 50 ? goal.substring(0, 47) + '...' : goal;
    }
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = String(item[key]);
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    }
    getStatusColor(status) {
        switch (status) {
            case 'completed': return chalk_1.default.green;
            case 'executing':
            case 'in_progress': return chalk_1.default.blue;
            case 'approved': return chalk_1.default.cyan;
            case 'failed': return chalk_1.default.red;
            case 'cancelled': return chalk_1.default.yellow;
            default: return chalk_1.default.gray;
        }
    }
    getStatusIcon(status) {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '🔄';
            case 'failed': return '❌';
            case 'skipped': return '⏭️';
            default: return '⏳';
        }
    }
    getStatusEmoji(status) {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '🔄';
            case 'failed': return '❌';
            case 'skipped': return '⏭️';
            default: return '⏳';
        }
    }
    getPriorityIcon(priority) {
        switch (priority) {
            case 'critical': return '🔴';
            case 'high': return '🟡';
            case 'medium': return '🟢';
            case 'low': return '🔵';
            default: return '⚪';
        }
    }
    getPriorityEmoji(priority) {
        switch (priority) {
            case 'critical': return '🔥';
            case 'high': return '⚡';
            case 'medium': return '📋';
            case 'low': return '📝';
            default: return '📄';
        }
    }
    getCategoryColor(category) {
        switch (category) {
            case 'planning': return chalk_1.default.cyan;
            case 'setup': return chalk_1.default.blue;
            case 'implementation': return chalk_1.default.green;
            case 'testing': return chalk_1.default.yellow;
            case 'documentation': return chalk_1.default.magenta;
            case 'deployment': return chalk_1.default.red;
            default: return chalk_1.default.gray;
        }
    }
    /**
     * Get all active plans
     */
    getActivePlans() {
        return Array.from(this.activePlans.values());
    }
    /**
     * Get plan by ID
     */
    getPlan(planId) {
        return this.activePlans.get(planId);
    }
    /**
     * Show plan status
     */
    showPlanStatus(planId) {
        if (planId) {
            const plan = this.activePlans.get(planId);
            if (plan) {
                this.displayPlan(plan);
            }
            else {
                console.log(chalk_1.default.red(`Plan ${planId} not found`));
            }
        }
        else {
            const plans = this.getActivePlans();
            if (plans.length === 0) {
                console.log(chalk_1.default.gray('No active plans'));
            }
            else {
                console.log(chalk_1.default.blue.bold('Active Plans:'));
                plans.forEach(plan => {
                    const statusColor = this.getStatusColor(plan.status);
                    console.log(`  ${statusColor(plan.status.toUpperCase())} ${plan.title} (${plan.todos.length} todos)`);
                });
            }
        }
    }
}
exports.EnhancedPlanningSystem = EnhancedPlanningSystem;
// Export singleton instance
exports.enhancedPlanning = new EnhancedPlanningSystem();
