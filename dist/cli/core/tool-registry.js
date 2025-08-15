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
exports.toolRegistry = exports.ToolRegistry = exports.ToolRegistryConfigSchema = exports.ToolInstanceSchema = exports.ToolMetadataSchema = exports.ToolPermissionSchema = void 0;
const zod_1 = require("zod");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const nanoid_1 = require("nanoid");
const chalk_1 = __importDefault(require("chalk"));
const logger_1 = require("../utils/logger");
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
const lsp_manager_1 = require("../lsp/lsp-manager");
const context_aware_rag_1 = require("../context/context-aware-rag");
const analytics_manager_1 = require("./analytics-manager");
const performance_optimizer_1 = require("./performance-optimizer");
exports.ToolPermissionSchema = zod_1.z.object({
    canReadFiles: zod_1.z.boolean().default(true),
    canWriteFiles: zod_1.z.boolean().default(true),
    canDeleteFiles: zod_1.z.boolean().default(false),
    canExecuteCommands: zod_1.z.boolean().default(false),
    allowedPaths: zod_1.z.array(zod_1.z.string()).default([]),
    forbiddenPaths: zod_1.z.array(zod_1.z.string()).default([]),
    allowedCommands: zod_1.z.array(zod_1.z.string()).default([]),
    forbiddenCommands: zod_1.z.array(zod_1.z.string()).default([]),
    canAccessNetwork: zod_1.z.boolean().default(false),
    maxExecutionTime: zod_1.z.number().int().min(1000).default(300000),
    maxMemoryUsage: zod_1.z.number().int().min(1024 * 1024).default(512 * 1024 * 1024),
    requiresApproval: zod_1.z.boolean().default(false)
});
exports.ToolMetadataSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    version: zod_1.z.string().default('1.0.0'),
    author: zod_1.z.string().optional(),
    category: zod_1.z.enum(['file-ops', 'code-analysis', 'system', 'network', 'development', 'utility']),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    capabilities: zod_1.z.array(zod_1.z.string()).default([]),
    requiredCapabilities: zod_1.z.array(zod_1.z.string()).default([]),
    dependencies: zod_1.z.array(zod_1.z.string()).default([]),
    permissions: exports.ToolPermissionSchema,
    inputSchema: zod_1.z.any(),
    outputSchema: zod_1.z.any(),
    examples: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        input: zod_1.z.any(),
        expectedOutput: zod_1.z.any()
    })).default([]),
    documentation: zod_1.z.string().optional(),
    promptFile: zod_1.z.string().optional(),
    isBuiltIn: zod_1.z.boolean().default(true),
    isEnabled: zod_1.z.boolean().default(true),
    priority: zod_1.z.number().int().min(0).max(100).default(50),
    loadOrder: zod_1.z.number().int().default(0),
    createdAt: zod_1.z.date().default(() => new Date()),
    updatedAt: zod_1.z.date().default(() => new Date())
});
exports.ToolInstanceSchema = zod_1.z.object({
    metadata: exports.ToolMetadataSchema,
    instance: zod_1.z.any(),
    isLoaded: zod_1.z.boolean().default(false),
    isInitialized: zod_1.z.boolean().default(false),
    loadTime: zod_1.z.number().optional(),
    lastUsed: zod_1.z.date().optional(),
    usageCount: zod_1.z.number().int().default(0),
    successRate: zod_1.z.number().min(0).max(1).default(1),
    averageExecutionTime: zod_1.z.number().default(0),
    errors: zod_1.z.array(zod_1.z.string()).default([])
});
exports.ToolRegistryConfigSchema = zod_1.z.object({
    enabledCategories: zod_1.z.array(zod_1.z.string()).default([
        'file-ops', 'code-analysis', 'system', 'network', 'development', 'utility'
    ]),
    autoDiscovery: zod_1.z.boolean().default(true),
    discoveryPaths: zod_1.z.array(zod_1.z.string()).default([]),
    loadTimeout: zod_1.z.number().int().default(30000),
    enableMetrics: zod_1.z.boolean().default(true),
    enableCaching: zod_1.z.boolean().default(true),
    maxConcurrentTools: zod_1.z.number().int().default(10),
    toolValidation: zod_1.z.boolean().default(true),
    allowDynamicLoading: zod_1.z.boolean().default(true),
    requireDocumentation: zod_1.z.boolean().default(false),
    enforcePermissions: zod_1.z.boolean().default(true),
    enableHotReload: zod_1.z.boolean().default(false)
});
class ToolRegistry {
    constructor(workingDirectory, config = {}) {
        this.tools = new Map();
        this.categories = new Map();
        this.loadedTools = new Set();
        this.isInitialized = false;
        this.workingDirectory = workingDirectory;
        this.config = exports.ToolRegistryConfigSchema.parse(config);
        this.contextSystem = new context_aware_rag_1.ContextAwareRAGSystem(workingDirectory);
        this.analyticsManager = new analytics_manager_1.AnalyticsManager(workingDirectory);
        this.performanceOptimizer = new performance_optimizer_1.PerformanceOptimizer();
    }
    static getInstance(workingDirectory, config) {
        if (!ToolRegistry.instance && workingDirectory) {
            ToolRegistry.instance = new ToolRegistry(workingDirectory, config);
        }
        return ToolRegistry.instance;
    }
    async initialize() {
        if (this.isInitialized)
            return;
        advanced_cli_ui_1.advancedUI.logInfo('🔧 Initializing Tool Registry...');
        const startTime = Date.now();
        try {
            await this.registerBuiltInTools();
            if (this.config.autoDiscovery) {
                await this.discoverTools();
            }
            await this.validateTool(this.tools, this.config.toolValidation);
            await this.loadEssentialTools();
            this.isInitialized = true;
            const loadTime = Date.now() - startTime;
            advanced_cli_ui_1.advancedUI.logSuccess(`✅ Tool Registry initialized (${this.tools.size} tools, ${loadTime}ms)`);
            if (this.config.enableMetrics) {
                this.logRegistryStats();
            }
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`❌ Tool Registry initialization failed: ${error.message}`);
            throw error;
        }
    }
    async registerTool(toolClass, metadata) {
        try {
            const instance = new toolClass(this.workingDirectory);
            let toolMetadata;
            if (metadata) {
                toolMetadata = exports.ToolMetadataSchema.parse({
                    id: metadata.id || (0, nanoid_1.nanoid)(),
                    name: metadata.name || instance.constructor.name,
                    description: metadata.description || 'No description provided',
                    ...metadata
                });
            }
            else if (instance.getMetadata && typeof instance.getMetadata === 'function') {
                toolMetadata = exports.ToolMetadataSchema.parse(instance.getMetadata());
            }
            else {
                toolMetadata = exports.ToolMetadataSchema.parse({
                    id: (0, nanoid_1.nanoid)(),
                    name: instance.constructor.name,
                    description: 'Auto-registered tool',
                    category: 'utility'
                });
            }
            if (this.config.toolValidation) {
                await this.validateTool(instance, toolMetadata);
            }
            const toolInstance = {
                metadata: toolMetadata,
                usageCount: 0,
                successRate: 1,
                averageExecutionTime: 0,
                errors: [],
                instance,
                isLoaded: true,
                isInitialized: false,
                loadTime: Date.now()
            };
            this.tools.set(toolMetadata.id, toolInstance);
            this.addToCategory(toolMetadata.category, toolMetadata.id);
            this.loadedTools.add(toolMetadata.id);
            advanced_cli_ui_1.advancedUI.logSuccess(`🔧 Registered tool: ${toolMetadata.name} (${toolMetadata.id})`);
            return toolMetadata.id;
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`❌ Failed to register tool: ${error.message}`);
            throw error;
        }
    }
    async getTool(toolId) {
        const toolInstance = this.tools.get(toolId);
        if (!toolInstance)
            return null;
        if (!toolInstance.isInitialized && toolInstance.instance.initialize) {
            try {
                await toolInstance.instance.initialize();
                toolInstance.isInitialized = true;
                advanced_cli_ui_1.advancedUI.logInfo(`🔧 Initialized tool: ${toolInstance.metadata.name}`);
            }
            catch (error) {
                advanced_cli_ui_1.advancedUI.logWarning(`⚠️  Tool initialization failed: ${toolInstance.metadata.name} - ${error.message}`);
            }
        }
        toolInstance.lastUsed = new Date();
        toolInstance.usageCount++;
        return toolInstance.instance;
    }
    async executeTool(toolId, ...args) {
        const sessionId = `tool-${toolId}-${Date.now()}`;
        this.performanceOptimizer.startMonitoring();
        const toolInstance = this.tools.get(toolId);
        if (!toolInstance) {
            throw new Error(`Tool not found: ${toolId}`);
        }
        if (!toolInstance.metadata.isEnabled) {
            throw new Error(`Tool is disabled: ${toolInstance.metadata.name}`);
        }
        try {
            if (this.config.enforcePermissions) {
                await this.checkPermissions(toolInstance.metadata.permissions, args);
            }
            await this.performLSPContextAnalysis(toolInstance, args);
            const tool = await this.getTool(toolId);
            if (!tool) {
                throw new Error(`Failed to get tool instance: ${toolId}`);
            }
            const result = await tool.execute(...args);
            const metrics = this.performanceOptimizer.endMonitoring(sessionId, {
                toolCallCount: 1,
                responseQuality: 100
            });
            this.analyticsManager.trackToolCall(sessionId, toolInstance.metadata.name, true, metrics.processingTime);
            this.analyticsManager.trackPerformance(sessionId, {
                tool: toolInstance.metadata.name,
                category: toolInstance.metadata.category,
                duration: metrics.processingTime,
                success: true
            });
            this.contextSystem.recordInteraction(`Tool execution: ${toolInstance.metadata.name}`, `Successfully executed ${toolInstance.metadata.name} tool`, [{
                    type: 'execute_command',
                    target: toolInstance.metadata.name,
                    params: { args: args.map(a => typeof a), executionTime: metrics.processingTime },
                    result: 'success',
                    duration: metrics.processingTime
                }]);
            this.updateToolMetrics(toolId, true, metrics.processingTime);
            return result;
        }
        catch (error) {
            const metrics = this.performanceOptimizer.endMonitoring(sessionId, {
                toolCallCount: 1,
                responseQuality: 0
            });
            this.analyticsManager.trackToolCall(sessionId, toolInstance.metadata.name, false, metrics.processingTime);
            this.analyticsManager.trackEvent({
                eventType: 'error',
                sessionId,
                data: { tool: toolInstance.metadata.name, error: error.message, duration: metrics.processingTime }
            });
            this.updateToolMetrics(toolId, false, metrics.processingTime);
            toolInstance.errors.push(`${new Date().toISOString()}: ${error.message}`);
            this.contextSystem.recordInteraction(`Tool execution failed: ${toolInstance.metadata.name}`, `Failed to execute ${toolInstance.metadata.name}: ${error.message}`, [{
                    type: 'execute_command',
                    target: toolInstance.metadata.name,
                    params: { args: args.map(a => typeof a), executionTime: metrics.processingTime },
                    result: 'error',
                    duration: metrics.processingTime
                }]);
            throw error;
        }
    }
    getToolsByCategory(category) {
        const toolIds = this.categories.get(category) || [];
        return toolIds.map(id => this.tools.get(id)).filter(Boolean);
    }
    getAvailableTools() {
        return new Map([...this.tools.entries()].filter(([, tool]) => tool.metadata.isEnabled));
    }
    searchTools(query) {
        const searchTerm = query.toLowerCase();
        return Array.from(this.tools.values()).filter(tool => tool.metadata.name.toLowerCase().includes(searchTerm) ||
            tool.metadata.description.toLowerCase().includes(searchTerm) ||
            tool.metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
    }
    async unregisterTool(toolId) {
        const toolInstance = this.tools.get(toolId);
        if (!toolInstance)
            return false;
        try {
            if (toolInstance.instance.cleanup && typeof toolInstance.instance.cleanup === 'function') {
                await toolInstance.instance.cleanup();
            }
            this.tools.delete(toolId);
            this.loadedTools.delete(toolId);
            this.removeFromCategory(toolInstance.metadata.category, toolId);
            advanced_cli_ui_1.advancedUI.logInfo(`🗑️  Unregistered tool: ${toolInstance.metadata.name}`);
            return true;
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`❌ Failed to unregister tool ${toolId}: ${error.message}`);
            return false;
        }
    }
    async reloadTool(toolId) {
        const toolInstance = this.tools.get(toolId);
        if (!toolInstance || toolInstance.metadata.isBuiltIn)
            return false;
        try {
            const metadata = toolInstance.metadata;
            await this.unregisterTool(toolId);
            advanced_cli_ui_1.advancedUI.logInfo(`🔄 Reloaded tool: ${metadata.name}`);
            return true;
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`❌ Failed to reload tool ${toolId}: ${error.message}`);
            return false;
        }
    }
    getRegistryStats() {
        const stats = {
            totalTools: this.tools.size,
            loadedTools: this.loadedTools.size,
            enabledTools: Array.from(this.tools.values()).filter(t => t.metadata.isEnabled).length,
            categories: Object.fromEntries(this.categories.entries()),
            topTools: Array.from(this.tools.values())
                .sort((a, b) => b.usageCount - a.usageCount)
                .slice(0, 5)
                .map(t => ({ name: t.metadata.name, usage: t.usageCount, successRate: t.successRate }))
        };
        return stats;
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        advanced_cli_ui_1.advancedUI.logInfo('🔧 Tool Registry configuration updated');
    }
    async registerBuiltInTools() {
        const toolsDir = (0, path_1.join)(this.workingDirectory, 'src/cli/tools');
        try {
            const { WriteFileTool } = await Promise.resolve().then(() => __importStar(require('../tools/write-file-tool')));
            const { ReadFileTool } = await Promise.resolve().then(() => __importStar(require('../tools/read-file-tool')));
            await this.registerTool(WriteFileTool, {
                name: 'write-file',
                description: 'Write content to files with validation and backup',
                category: 'file-ops',
                capabilities: ['file-write', 'backup', 'validation'],
                permissions: {
                    canReadFiles: true,
                    canWriteFiles: true,
                    canDeleteFiles: false,
                    canExecuteCommands: false,
                    allowedPaths: [],
                    forbiddenPaths: [],
                    allowedCommands: [],
                    forbiddenCommands: [],
                    canAccessNetwork: false,
                    maxExecutionTime: 300000,
                    maxMemoryUsage: 512 * 1024 * 1024,
                    requiresApproval: false
                }
            });
            await this.registerTool(ReadFileTool, {
                name: 'read-file',
                description: 'Read file contents with processing options',
                category: 'file-ops',
                capabilities: ['file-read', 'processing'],
                permissions: {
                    canReadFiles: true,
                    canWriteFiles: false,
                    canDeleteFiles: false,
                    canExecuteCommands: false,
                    allowedPaths: [],
                    forbiddenPaths: [],
                    allowedCommands: [],
                    forbiddenCommands: [],
                    canAccessNetwork: false,
                    maxExecutionTime: 300000,
                    maxMemoryUsage: 512 * 1024 * 1024,
                    requiresApproval: false
                }
            });
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logWarning(`⚠️  Some built-in tools failed to load: ${error.message}`);
        }
    }
    async discoverTools() {
        const discoveryPaths = [
            (0, path_1.join)(this.workingDirectory, 'src/cli/tools'),
            (0, path_1.join)(this.workingDirectory, 'plugins'),
            ...this.config.discoveryPaths
        ];
        for (const discoveryPath of discoveryPaths) {
            try {
                await this.scanDirectory(discoveryPath);
            }
            catch (error) {
                logger_1.logger.debug(`Tool discovery failed for ${discoveryPath}: ${error.message}`);
            }
        }
    }
    async scanDirectory(dirPath) {
        try {
            const items = await (0, promises_1.readdir)(dirPath);
            for (const item of items) {
                const itemPath = (0, path_1.join)(dirPath, item);
                const itemStat = await (0, promises_1.stat)(itemPath);
                if (itemStat.isFile() && (0, path_1.extname)(item) === '.ts' && !item.includes('.spec.') && !item.includes('.test.')) {
                    await this.loadToolFromFile(itemPath);
                }
            }
        }
        catch (error) {
        }
    }
    async loadToolFromFile(filePath) {
        try {
            const module = await Promise.resolve(`${filePath}`).then(s => __importStar(require(s)));
            Object.values(module).forEach((exportedClass) => {
                if (typeof exportedClass === 'function' &&
                    exportedClass.prototype &&
                    exportedClass.prototype.execute) {
                    this.registerTool(exportedClass).catch(error => {
                        logger_1.logger.debug(`Failed to auto-register tool from ${filePath}: ${error.message}`);
                    });
                }
            });
        }
        catch (error) {
            logger_1.logger.debug(`Failed to load tool from ${filePath}: ${error.message}`);
        }
    }
    async validateTool(instance, metadata) {
        if (typeof instance.execute !== 'function') {
            throw new Error(`Tool ${metadata.name} must implement execute method`);
        }
        if (metadata.requiredCapabilities.length > 0) {
            const missingCapabilities = metadata.requiredCapabilities.filter(cap => !metadata.capabilities.includes(cap));
            if (missingCapabilities.length > 0) {
                throw new Error(`Tool ${metadata.name} missing required capabilities: ${missingCapabilities.join(', ')}`);
            }
        }
        if (this.config.requireDocumentation && !metadata.documentation) {
            throw new Error(`Tool ${metadata.name} requires documentation`);
        }
    }
    async loadEssentialTools() {
        const essentialTools = Array.from(this.tools.values()).filter(tool => tool.metadata.priority >= 90);
        for (const tool of essentialTools) {
            await this.getTool(tool.metadata.id);
        }
    }
    async checkPermissions(permissions, args) {
    }
    updateToolMetrics(toolId, success, executionTime) {
        const toolInstance = this.tools.get(toolId);
        if (!toolInstance || !this.config.enableMetrics)
            return;
        const totalExecutions = toolInstance.usageCount;
        const successCount = Math.round(toolInstance.successRate * (totalExecutions - 1)) + (success ? 1 : 0);
        toolInstance.successRate = successCount / totalExecutions;
        toolInstance.averageExecutionTime =
            ((toolInstance.averageExecutionTime * (totalExecutions - 1)) + executionTime) / totalExecutions;
    }
    addToCategory(category, toolId) {
        if (!this.categories.has(category)) {
            this.categories.set(category, []);
        }
        this.categories.get(category).push(toolId);
    }
    removeFromCategory(category, toolId) {
        const categoryTools = this.categories.get(category);
        if (categoryTools) {
            const index = categoryTools.indexOf(toolId);
            if (index > -1) {
                categoryTools.splice(index, 1);
            }
        }
    }
    logRegistryStats() {
        const stats = this.getRegistryStats();
        advanced_cli_ui_1.advancedUI.logInfo(`📊 Tool Registry Statistics:`);
        console.log(chalk_1.default.cyan(`   Total Tools: ${stats.totalTools}`));
        console.log(chalk_1.default.cyan(`   Loaded: ${stats.loadedTools}`));
        console.log(chalk_1.default.cyan(`   Enabled: ${stats.enabledTools}`));
        console.log(chalk_1.default.cyan(`   Categories: ${Object.keys(stats.categories).length}`));
        if (stats.topTools.length > 0) {
            console.log(chalk_1.default.cyan(`   Top Tools:`));
            stats.topTools.forEach(tool => {
                console.log(chalk_1.default.gray(`     ${tool.name}: ${tool.usage} uses (${(tool.successRate * 100).toFixed(1)}% success)`));
            });
        }
    }
    async performLSPContextAnalysis(toolInstance, args) {
        try {
            const insights = await lsp_manager_1.lspManager.getWorkspaceInsights(this.workingDirectory);
            if (insights.diagnostics.errors > 0) {
                advanced_cli_ui_1.advancedUI.logWarning(`⚠️  LSP found ${insights.diagnostics.errors} errors before ${toolInstance.metadata.name} execution`);
            }
            this.contextSystem.recordInteraction(`Preparing ${toolInstance.metadata.name} execution`, `Pre-execution analysis for ${toolInstance.metadata.name} tool`, [{
                    type: 'execute_command',
                    target: toolInstance.metadata.name,
                    params: {
                        category: toolInstance.metadata.category,
                        capabilities: toolInstance.metadata.capabilities,
                        argsCount: args.length
                    },
                    result: 'prepared',
                    duration: 0
                }]);
        }
        catch (error) {
            logger_1.logger.debug(`LSP/Context analysis failed for ${toolInstance.metadata.name}: ${error.message}`);
        }
    }
}
exports.ToolRegistry = ToolRegistry;
exports.toolRegistry = ToolRegistry.getInstance();
