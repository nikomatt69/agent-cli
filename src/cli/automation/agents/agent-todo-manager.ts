import { nanoid } from 'nanoid';

/**
 * Describes a single unit of work to be performed by an agent.
 */
export interface AgentTodo {
  id: string;
  agentId: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  dependencies?: string[];
  tags: string[];
  context?: {
    files?: string[];
    commands?: string[];
    reasoning?: string;
  };
  progress?: number;
}

/** A higher level plan consisting of multiple todos. */
export interface AgentWorkPlan {
  id: string;
  agentId: string;
  goal: string;
  todos: AgentTodo[];
  estimatedTimeTotal: number;
  actualTimeTotal?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export class AgentTodoManager {
  private todos = new Map<string, AgentTodo>();
  private plans = new Map<string, AgentWorkPlan>();

  createWorkPlan(agentId: string, goal: string): AgentWorkPlan {
    const plan: AgentWorkPlan = {
      id: nanoid(),
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

  async planTodos(agentId: string, goal: string): Promise<AgentTodo[]> {
    const base: Array<Omit<AgentTodo, 'id' | 'agentId' | 'status' | 'createdAt' | 'updatedAt'>> = [];
    const lower = goal.toLowerCase();
    if (lower.includes('create') || lower.includes('build')) {
      base.push(
        {
          title: 'Analyze requirements',
          description: 'Gather and analyse requirements for the requested feature.',
          priority: 'high',
          estimatedDuration: 10,
          tags: ['analysis'],
        },
        {
          title: 'Design solution',
          description: 'Sketch the architecture and create a high level design.',
          priority: 'medium',
          estimatedDuration: 15,
          tags: ['design'],
        },
        {
          title: 'Implement solution',
          description: 'Write code and tests to implement the feature.',
          priority: 'critical',
          estimatedDuration: 30,
          tags: ['implementation', 'coding'],
        },
        {
          title: 'Validate implementation',
          description: 'Run tests and perform manual validation.',
          priority: 'high',
          estimatedDuration: 10,
          tags: ['testing'],
        },
      );
    }
    if (lower.includes('fix') || lower.includes('debug')) {
      base.push(
        {
          title: 'Identify root cause',
          description: 'Investigate logs and analyse code to find the source of the bug.',
          priority: 'critical',
          estimatedDuration: 20,
          tags: ['debugging'],
        },
        {
          title: 'Implement fix',
          description: 'Modify code to resolve the identified issue.',
          priority: 'high',
          estimatedDuration: 15,
          tags: ['bugfix'],
        },
        {
          title: 'Verify resolution',
          description: 'Ensure the bug is fixed by running tests.',
          priority: 'medium',
          estimatedDuration: 10,
          tags: ['testing'],
        },
      );
    }
    const todos = base.map((t) => {
      const now = new Date();
      const todo: AgentTodo = {
        id: nanoid(),
        agentId,
        title: t.title,
        description: t.description,
        status: 'pending',
        priority: t.priority as any,
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

  getAgentTodos(agentId: string): AgentTodo[] {
    return Array.from(this.todos.values()).filter((t) => t.agentId === agentId);
  }

  updateTodoStatus(todoId: string, status: AgentTodo['status']): void {
    const todo = this.todos.get(todoId);
    if (todo) {
      todo.status = status;
      todo.updatedAt = new Date();
    }
  }
}
