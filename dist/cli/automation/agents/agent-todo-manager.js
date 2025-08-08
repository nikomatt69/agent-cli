"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentTodoManager = void 0;
const nanoid_1 = require("nanoid");
class AgentTodoManager {
    constructor() {
        this.todos = new Map();
        this.plans = new Map();
    }
    createWorkPlan(agentId, goal) {
        const plan = {
            id: (0, nanoid_1.nanoid)(),
            agentId,
            goal,
            todos: [],
            estimatedTimeTotal: 0,
            status: 'pending',
            createdAt: new Date(),
        };
        this.plans.set(plan.id, plan);
        return plan;
    }
    async planTodos(agentId, goal) {
        const base = [];
        const lower = goal.toLowerCase();
        if (lower.includes('create') || lower.includes('build')) {
            base.push({
                title: 'Analyze requirements',
                description: 'Gather and analyse requirements for the requested feature.',
                priority: 'high',
                estimatedDuration: 10,
                tags: ['analysis'],
            }, {
                title: 'Design solution',
                description: 'Sketch the architecture and create a high level design.',
                priority: 'medium',
                estimatedDuration: 15,
                tags: ['design'],
            }, {
                title: 'Implement solution',
                description: 'Write code and tests to implement the feature.',
                priority: 'critical',
                estimatedDuration: 30,
                tags: ['implementation', 'coding'],
            }, {
                title: 'Validate implementation',
                description: 'Run tests and perform manual validation.',
                priority: 'high',
                estimatedDuration: 10,
                tags: ['testing'],
            });
        }
        if (lower.includes('fix') || lower.includes('debug')) {
            base.push({
                title: 'Identify root cause',
                description: 'Investigate logs and analyse code to find the source of the bug.',
                priority: 'critical',
                estimatedDuration: 20,
                tags: ['debugging'],
            }, {
                title: 'Implement fix',
                description: 'Modify code to resolve the identified issue.',
                priority: 'high',
                estimatedDuration: 15,
                tags: ['bugfix'],
            }, {
                title: 'Verify resolution',
                description: 'Ensure the bug is fixed by running tests.',
                priority: 'medium',
                estimatedDuration: 10,
                tags: ['testing'],
            });
        }
        const todos = base.map((t) => {
            const now = new Date();
            const todo = {
                id: (0, nanoid_1.nanoid)(),
                agentId,
                title: t.title,
                description: t.description,
                status: 'pending',
                priority: t.priority,
                createdAt: now,
                updatedAt: now,
                estimatedDuration: t.estimatedDuration,
                tags: t.tags,
                progress: 0,
            };
            this.todos.set(todo.id, todo);
            return todo;
        });
        return todos;
    }
    getAgentTodos(agentId) {
        return Array.from(this.todos.values()).filter((t) => t.agentId === agentId);
    }
    updateTodoStatus(todoId, status) {
        const todo = this.todos.get(todoId);
        if (todo) {
            todo.status = status;
            todo.updatedAt = new Date();
        }
    }
}
exports.AgentTodoManager = AgentTodoManager;
