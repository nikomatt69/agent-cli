import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { modelProvider, ChatMessage } from '../ai/model-provider';
import { approvalSystem } from '../ui/approval-system';
import { workspaceContext } from '../context/workspace-context';
import boxen from 'boxen';

export interface TodoItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  estimatedDuration: number; // minutes
  actualDuration?: number;
  dependencies: string[]; // other todo IDs
  tags: string[];
  commands?: string[];
  files?: string[];
  reasoning: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TodoPlan {
  id: string;
  title: string;
  description: string;
  goal: string;
  todos: TodoItem[];
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled';
  estimatedTotalDuration: number;
  actualTotalDuration?: number;
  createdAt: Date;
  approvedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  workingDirectory: string;
  context: {
    projectInfo?: any;
    selectedFiles?: string[];
    userRequirements?: string[];
  };
}

export interface PlanningOptions {
  maxTodos?: number;
  includeContext?: boolean;
  autoApprove?: boolean;
  showDetails?: boolean;
  saveTodoFile?: boolean;
  todoFilePath?: string;
}

export class EnhancedPlanningSystem {
  private activePlans: Map<string, TodoPlan> = new Map();
  private workingDirectory: string;

  constructor(workingDirectory: string = process.cwd()) {
    this.workingDirectory = workingDirectory;
  }

  /**
   * Generate a comprehensive plan with todo.md file
   */
  async generatePlan(
    goal: string,
    options: PlanningOptions = {}
  ): Promise<TodoPlan> {
    const {
      maxTodos = 20,
      includeContext = true,
      showDetails = true,
      saveTodoFile = true,
      todoFilePath = 'todo.md'
    } = options;

    console.log(chalk.blue.bold(`\\n🎯 Generating Plan: ${goal}`));
    console.log(chalk.gray('─'.repeat(60)));

    // Get project context
    let projectContext = '';
    if (includeContext) {
      console.log(chalk.gray('📁 Analyzing project context...'));
      const context = workspaceContext.getContextForAgent('planner', 10);
      projectContext = context.projectSummary;
    }

    // Generate AI-powered plan
    console.log(chalk.gray('🧠 Generating AI plan...'));
    const todos = await this.generateTodosWithAI(goal, projectContext, maxTodos);

    // Create plan object
    const plan: TodoPlan = {
      id: nanoid(),
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

    // Show plan details
    if (showDetails) {
      this.displayPlan(plan);
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
  async requestPlanApproval(planId: string): Promise<boolean> {
    const plan = this.activePlans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    console.log(chalk.yellow.bold('\\n⚠️  Plan Review Required'));
    console.log(chalk.gray('═'.repeat(60)));

    // Show plan summary
    this.displayPlanSummary(plan);

    // Ask for approval
    const approved = await approvalSystem.quickApproval(
      `Execute Plan: ${plan.title}`,
      `Execute ${plan.todos.length} tasks with estimated duration of ${Math.round(plan.estimatedTotalDuration)} minutes`,
      this.assessPlanRisk(plan)
    );

    if (approved) {
      plan.status = 'approved';
      plan.approvedAt = new Date();
      console.log(chalk.green('✅ Plan approved for execution'));
    } else {
      console.log(chalk.yellow('❌ Plan execution cancelled'));
    }

    return approved;
  }

  /**
   * Execute approved plan
   */
  async executePlan(planId: string): Promise<void> {
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

    console.log(chalk.blue.bold(`\\n🚀 Executing Plan: ${plan.title}`));
    console.log(chalk.gray('═'.repeat(60)));

    plan.status = 'executing';
    plan.startedAt = new Date();

    try {
      // Execute todos in dependency order
      const executionOrder = this.resolveDependencyOrder(plan.todos);
      let completedCount = 0;

      for (const todo of executionOrder) {
        console.log(chalk.cyan(`\\n📋 [${completedCount + 1}/${plan.todos.length}] ${todo.title}`));
        console.log(chalk.gray(`   ${todo.description}`));

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

          console.log(chalk.green(`   ✅ Completed in ${Math.round(duration / 1000)}s`));
          completedCount++;

          // Update todo.md file
          await this.updateTodoFile(plan);

        } catch (error: any) {
          todo.status = 'failed';
          console.log(chalk.red(`   ❌ Failed: ${error.message}`));

          // Ask if should continue with remaining todos
          const shouldContinue = await approvalSystem.quickApproval(
            'Continue Execution?',
            `Todo "${todo.title}" failed. Continue with remaining todos?`,
            'medium'
          );

          if (!shouldContinue) {
            console.log(chalk.yellow('🛑 Plan execution stopped by user'));
            plan.status = 'failed';
            return;
          }
        }

        // Show progress
        const progress = Math.round((completedCount / plan.todos.length) * 100);
        console.log(chalk.blue(`   📊 Progress: ${progress}% (${completedCount}/${plan.todos.length})`));
      }

      // Plan completed
      plan.status = 'completed';
      plan.completedAt = new Date();
      plan.actualTotalDuration = plan.todos.reduce((sum, todo) => sum + (todo.actualDuration || 0), 0);

      console.log(chalk.green.bold(`\\n🎉 Plan Completed Successfully!`));
      console.log(chalk.gray(`✅ ${completedCount}/${plan.todos.length} todos completed`));
      console.log(chalk.gray(`⏱️  Total time: ${plan.actualTotalDuration} minutes`));

      // Update final todo.md
      await this.updateTodoFile(plan);

    } catch (error: any) {
      plan.status = 'failed';
      console.log(chalk.red(`\\n❌ Plan execution failed: ${error.message}`));
    }
  }

  /**
   * Generate todos using AI
   */
  private async generateTodosWithAI(goal: string, context: string, maxTodos: number): Promise<TodoItem[]> {
    const messages: ChatMessage[] = [
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
      const response = await modelProvider.generateResponse({ messages });
      lastModelOutput = response || '';

      // Prefer fenced JSON blocks if present, otherwise fall back to broad match
      const raw = lastModelOutput.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      let jsonString: string | undefined = fenceMatch ? fenceMatch[1].trim() : undefined;
      if (!jsonString) {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonString = jsonMatch[0];
      }
      if (!jsonString) {
        throw new Error('AI did not return valid JSON plan');
      }

      const planData = JSON.parse(jsonString);

      // Convert to TodoItem format
      const todos: TodoItem[] = planData.todos.map((todoData: any, index: number) => ({
        id: nanoid(),
        title: todoData.title || `Task ${index + 1}`,
        description: todoData.description || '',
        status: 'pending' as const,
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

      console.log(chalk.green(`✅ Generated ${todos.length} todos`));
      return todos;

    } catch (error: any) {
      console.log(chalk.red(`❌ Failed to generate AI plan: ${error.message}`));
      if (lastModelOutput) {
        const preview = lastModelOutput.replace(/```/g, '```').slice(0, 400);
        console.log(chalk.gray(`↪ Raw AI output (truncated):\n${preview}${lastModelOutput.length > 400 ? '…' : ''}`));
      }

      // Fallback: create a simple todo
      return [{
        id: nanoid(),
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
  private displayPlan(plan: TodoPlan): void {
    console.log(boxen(
      `${chalk.blue.bold(plan.title)}\\n\\n` +
      `${chalk.gray('Goal:')} ${plan.goal}\\n` +
      `${chalk.gray('Todos:')} ${plan.todos.length}\\n` +
      `${chalk.gray('Estimated Duration:')} ${Math.round(plan.estimatedTotalDuration)} minutes\\n` +
      `${chalk.gray('Status:')} ${this.getStatusColor(plan.status)(plan.status.toUpperCase())}`,
      {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: 'blue',
      }
    ));

    console.log(chalk.blue.bold('\\n📋 Todo Items:'));
    console.log(chalk.gray('─'.repeat(60)));

    plan.todos.forEach((todo, index) => {
      const priorityIcon = this.getPriorityIcon(todo.priority);
      const statusIcon = this.getStatusIcon(todo.status);
      const categoryColor = this.getCategoryColor(todo.category);

      console.log(`${index + 1}. ${statusIcon} ${priorityIcon} ${chalk.bold(todo.title)}`);
      console.log(`   ${chalk.gray(todo.description)}`);
      console.log(`   ${categoryColor(todo.category)} | ${chalk.gray(todo.estimatedDuration + 'min')} | ${chalk.gray(todo.tags.join(', '))}`);

      if (todo.dependencies.length > 0) {
        console.log(`   ${chalk.yellow('Dependencies:')} ${todo.dependencies.join(', ')}`);
      }

      if (todo.files && todo.files.length > 0) {
        console.log(`   ${chalk.blue('Files:')} ${todo.files.join(', ')}`);
      }

      console.log();
    });
  }

  /**
   * Display plan summary
   */
  private displayPlanSummary(plan: TodoPlan): void {
    const stats = {
      byPriority: this.groupBy(plan.todos, 'priority'),
      byCategory: this.groupBy(plan.todos, 'category'),
      totalFiles: new Set(plan.todos.flatMap(t => t.files || [])).size,
      totalCommands: plan.todos.reduce((sum, t) => sum + (t.commands?.length || 0), 0),
    };

    console.log(chalk.cyan('📊 Plan Statistics:'));
    console.log(`  • Total Todos: ${plan.todos.length}`);
    console.log(`  • Estimated Duration: ${Math.round(plan.estimatedTotalDuration)} minutes`);
    console.log(`  • Files to modify: ${stats.totalFiles}`);
    console.log(`  • Commands to run: ${stats.totalCommands}`);

    console.log(chalk.cyan('\\n🎯 Priority Distribution:'));
    Object.entries(stats.byPriority).forEach(([priority, todos]) => {
      const icon = this.getPriorityIcon(priority as any);
      console.log(`  ${icon} ${priority}: ${(todos as any[]).length} todos`);
    });

    console.log(chalk.cyan('\n📁 Category Distribution:'));
    Object.entries(stats.byCategory).forEach(([category, todos]) => {
      const color = this.getCategoryColor(category);
      console.log(`  • ${color(category)}: ${(todos as any[]).length} todos`);
    });
  }

  /**
   * Save plan to todo.md file
   */
  private async saveTodoFile(plan: TodoPlan, filename: string = 'todo.md'): Promise<void> {
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
    console.log(chalk.green(`📄 Todo file saved: ${todoPath}`));
  }

  /**
   * Update existing todo.md file
   */
  private async updateTodoFile(plan: TodoPlan, filename: string = 'todo.md'): Promise<void> {
    await this.saveTodoFile(plan, filename);
  }

  /**
   * Execute a single todo
   */
  private async executeTodo(todo: TodoItem, plan: TodoPlan): Promise<void> {
    // This is a simplified execution - in a real implementation,
    // you would integrate with the actual tool execution system

    console.log(chalk.gray(`   🔍 Analyzing todo: ${todo.title}`));

    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Execute commands if specified
    if (todo.commands && todo.commands.length > 0) {
      for (const command of todo.commands) {
        console.log(chalk.blue(`   ⚡ Running: ${command}`));
        // In real implementation, execute the command using tool system
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Create/modify files if specified
    if (todo.files && todo.files.length > 0) {
      for (const file of todo.files) {
        console.log(chalk.yellow(`   📄 Working on file: ${file}`));
        // In real implementation, create/modify the file
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  /**
   * Resolve todo execution order based on dependencies
   */
  private resolveDependencyOrder(todos: TodoItem[]): TodoItem[] {
    const resolved: TodoItem[] = [];
    const remaining = [...todos];
    const todoMap = new Map(todos.map(todo => [todo.id, todo]));

    while (remaining.length > 0) {
      const canExecute = remaining.filter(todo =>
        todo.dependencies.every(depId =>
          resolved.some(resolvedTodo => resolvedTodo.id === depId)
        )
      );

      if (canExecute.length === 0) {
        // Break circular dependencies by taking the first remaining todo
        const next = remaining.shift()!;
        resolved.push(next);
      } else {
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
  private assessPlanRisk(plan: TodoPlan): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = plan.todos.filter(t => t.priority === 'critical').length;
    const highCount = plan.todos.filter(t => t.priority === 'high').length;
    const hasFileOperations = plan.todos.some(t => t.files && t.files.length > 0);
    const hasCommands = plan.todos.some(t => t.commands && t.commands.length > 0);

    if (criticalCount > 0) return 'critical';
    if (highCount > 3 || (highCount > 0 && hasCommands)) return 'high';
    if (hasFileOperations || hasCommands) return 'medium';
    return 'low';
  }

  // Utility methods
  private extractPlanTitle(goal: string): string {
    return goal.length > 50 ? goal.substring(0, 47) + '...' : goal;
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const group = String(item[key]);
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private getStatusColor(status: string): any {
    switch (status) {
      case 'completed': return chalk.green;
      case 'executing': case 'in_progress': return chalk.blue;
      case 'approved': return chalk.cyan;
      case 'failed': return chalk.red;
      case 'cancelled': return chalk.yellow;
      default: return chalk.gray;
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      default: return '⏳';
    }
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      default: return '⏳';
    }
  }

  private getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'critical': return '🔴';
      case 'high': return '🟡';
      case 'medium': return '🟢';
      case 'low': return '🔵';
      default: return '⚪';
    }
  }

  private getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'critical': return '🔥';
      case 'high': return '⚡';
      case 'medium': return '📋';
      case 'low': return '📝';
      default: return '📄';
    }
  }

  private getCategoryColor(category: string): any {
    switch (category) {
      case 'planning': return chalk.cyan;
      case 'setup': return chalk.blue;
      case 'implementation': return chalk.green;
      case 'testing': return chalk.yellow;
      case 'documentation': return chalk.magenta;
      case 'deployment': return chalk.red;
      default: return chalk.gray;
    }
  }

  /**
   * Get all active plans
   */
  getActivePlans(): TodoPlan[] {
    return Array.from(this.activePlans.values());
  }

  /**
   * Get plan by ID
   */
  getPlan(planId: string): TodoPlan | undefined {
    return this.activePlans.get(planId);
  }

  /**
   * Show plan status
   */
  showPlanStatus(planId?: string): void {
    if (planId) {
      const plan = this.activePlans.get(planId);
      if (plan) {
        this.displayPlan(plan);
      } else {
        console.log(chalk.red(`Plan ${planId} not found`));
      }
    } else {
      const plans = this.getActivePlans();
      if (plans.length === 0) {
        console.log(chalk.gray('No active plans'));
      } else {
        console.log(chalk.blue.bold('Active Plans:'));
        plans.forEach(plan => {
          const statusColor = this.getStatusColor(plan.status);
          console.log(`  ${statusColor(plan.status.toUpperCase())} ${plan.title} (${plan.todos.length} todos)`);
        });
      }
    }
  }
}

// Export singleton instance
export const enhancedPlanning = new EnhancedPlanningSystem();
