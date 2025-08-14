"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSchema = exports.AgentTodoSchema = exports.AgentTaskResultSchema = exports.AgentTaskSchema = exports.AgentContextSchema = exports.AgentConfigSchema = exports.AgentMetricsSchema = exports.TaskPrioritySchema = exports.TaskStatusSchema = exports.AgentStatusSchema = void 0;
const zod_1 = require("zod");
exports.AgentStatusSchema = zod_1.z.enum(['initializing', 'ready', 'busy', 'error', 'offline']);
exports.TaskStatusSchema = zod_1.z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']);
exports.TaskPrioritySchema = zod_1.z.enum(['low', 'medium', 'high', 'critical']);
exports.AgentMetricsSchema = zod_1.z.object({
    tasksExecuted: zod_1.z.number().int().min(0),
    tasksSucceeded: zod_1.z.number().int().min(0),
    tasksFailed: zod_1.z.number().int().min(0),
    tasksInProgress: zod_1.z.number().int().min(0),
    averageExecutionTime: zod_1.z.number().min(0),
    totalExecutionTime: zod_1.z.number().min(0),
    successRate: zod_1.z.number().min(0).max(1),
    tokensConsumed: zod_1.z.number().int().min(0),
    apiCallsTotal: zod_1.z.number().int().min(0),
    memoryUsage: zod_1.z.number().min(0),
    efficiency: zod_1.z.number().min(0).max(1),
    productivity: zod_1.z.number().min(0).max(1),
    accuracy: zod_1.z.number().min(0).max(1)
});
exports.AgentConfigSchema = zod_1.z.object({
    autonomyLevel: zod_1.z.enum(['autonomous', 'semi-autonomous', 'supervised']),
    maxConcurrentTasks: zod_1.z.number().int().min(1).max(50),
    defaultTimeout: zod_1.z.number().int().min(1000),
    retryPolicy: zod_1.z.object({
        maxAttempts: zod_1.z.number().int().min(1).max(10),
        backoffMs: zod_1.z.number().int().min(100),
        backoffMultiplier: zod_1.z.number().min(1).max(10),
        retryableErrors: zod_1.z.array(zod_1.z.string()).optional()
    }),
    permissions: zod_1.z.object({
        fileSystem: zod_1.z.object({
            read: zod_1.z.boolean(),
            write: zod_1.z.boolean(),
            execute: zod_1.z.boolean()
        }),
        network: zod_1.z.object({
            enabled: zod_1.z.boolean(),
            allowedHosts: zod_1.z.array(zod_1.z.string()).optional()
        }),
        commands: zod_1.z.object({
            enabled: zod_1.z.boolean(),
            whitelist: zod_1.z.array(zod_1.z.string()).optional(),
            blacklist: zod_1.z.array(zod_1.z.string()).optional()
        })
    }).optional()
});
exports.AgentContextSchema = zod_1.z.object({
    workingDirectory: zod_1.z.string().min(1),
    projectInfo: zod_1.z.object({
        name: zod_1.z.string(),
        type: zod_1.z.string(),
        framework: zod_1.z.string().optional(),
        language: zod_1.z.string().optional()
    }).optional(),
    environment: zod_1.z.record(zod_1.z.string()).optional(),
    tools: zod_1.z.array(zod_1.z.string()).optional(),
    capabilities: zod_1.z.array(zod_1.z.string()).optional()
});
exports.AgentTaskSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    type: zod_1.z.string().min(1),
    priority: exports.TaskPrioritySchema,
    status: exports.TaskStatusSchema,
    requiredCapabilities: zod_1.z.array(zod_1.z.string()),
    parameters: zod_1.z.record(zod_1.z.any()).optional(),
    constraints: zod_1.z.object({
        timeout: zod_1.z.number().int().min(1000).optional(),
        maxRetries: zod_1.z.number().int().min(0).max(10).optional(),
        requiresApproval: zod_1.z.boolean().optional(),
        riskLevel: zod_1.z.enum(['low', 'medium', 'high']).optional()
    }).optional(),
    createdAt: zod_1.z.date().optional(),
    startedAt: zod_1.z.date().optional(),
    completedAt: zod_1.z.date().optional(),
    createdBy: zod_1.z.string().optional(),
    assignedTo: zod_1.z.string().optional()
});
exports.AgentTaskResultSchema = zod_1.z.object({
    taskId: zod_1.z.string().min(1),
    success: zod_1.z.boolean(),
    result: zod_1.z.any().optional(),
    error: zod_1.z.string().optional(),
    metadata: zod_1.z.object({
        executionTime: zod_1.z.number().min(0),
        tokensUsed: zod_1.z.number().int().min(0).optional(),
        apiCalls: zod_1.z.number().int().min(0).optional(),
        filesModified: zod_1.z.array(zod_1.z.string()).optional(),
        commandsExecuted: zod_1.z.array(zod_1.z.string()).optional()
    }).optional(),
    artifacts: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string(),
        path: zod_1.z.string(),
        size: zod_1.z.number().int().min(0).optional(),
        checksum: zod_1.z.string().optional()
    })).optional(),
    warnings: zod_1.z.array(zod_1.z.string()).optional(),
    suggestions: zod_1.z.array(zod_1.z.string()).optional()
});
exports.AgentTodoSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    content: zod_1.z.string().min(1),
    status: zod_1.z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
    priority: exports.TaskPrioritySchema,
    assignedAgent: zod_1.z.string().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date().optional(),
    completedAt: zod_1.z.date().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    dependencies: zod_1.z.array(zod_1.z.string()).optional(),
    estimatedTime: zod_1.z.number().int().min(0).optional()
});
exports.AgentSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    specialization: zod_1.z.string().min(1),
    capabilities: zod_1.z.array(zod_1.z.string().min(1)),
    version: zod_1.z.string().min(1),
    status: exports.AgentStatusSchema,
    currentTasks: zod_1.z.number().int().min(0),
    maxConcurrentTasks: zod_1.z.number().int().min(1)
});
