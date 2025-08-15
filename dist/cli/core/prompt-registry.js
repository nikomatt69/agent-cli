"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptRegistry = exports.PromptRegistry = exports.PromptRegistryConfigSchema = exports.PromptTemplateSchema = exports.PromptMetadataSchema = void 0;
const zod_1 = require("zod");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const chalk_1 = __importDefault(require("chalk"));
const logger_1 = require("../utils/logger");
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
exports.PromptMetadataSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    category: zod_1.z.enum(['tool', 'agent', 'system', 'validation', 'error-handling', 'reasoning']),
    version: zod_1.z.string().default('1.0.0'),
    author: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    language: zod_1.z.string().default('en'),
    targetAudience: zod_1.z.enum(['ai', 'human', 'mixed']).default('ai'),
    complexity: zod_1.z.enum(['basic', 'intermediate', 'advanced', 'expert']).default('intermediate'),
    usageCount: zod_1.z.number().int().default(0),
    successRate: zod_1.z.number().min(0).max(1).default(1),
    lastUsed: zod_1.z.date().optional(),
    isEnabled: zod_1.z.boolean().default(true),
    requiresContext: zod_1.z.boolean().default(false),
    contextTypes: zod_1.z.array(zod_1.z.string()).default([]),
    variables: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        type: zod_1.z.string(),
        required: zod_1.z.boolean().default(false),
        description: zod_1.z.string(),
        defaultValue: zod_1.z.any().optional()
    })).default([]),
    examples: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        input: zod_1.z.record(zod_1.z.any()),
        expectedOutput: zod_1.z.string()
    })).default([]),
    createdAt: zod_1.z.date().default(() => new Date()),
    updatedAt: zod_1.z.date().default(() => new Date())
});
exports.PromptTemplateSchema = zod_1.z.object({
    metadata: exports.PromptMetadataSchema,
    template: zod_1.z.string(),
    isLoaded: zod_1.z.boolean().default(false),
    compiledTemplate: zod_1.z.function().optional(),
    loadTime: zod_1.z.number().optional(),
    filePath: zod_1.z.string().optional()
});
exports.PromptRegistryConfigSchema = zod_1.z.object({
    promptsDirectory: zod_1.z.string().default('src/cli/prompts'),
    autoDiscovery: zod_1.z.boolean().default(true),
    enableCaching: zod_1.z.boolean().default(true),
    enableMetrics: zod_1.z.boolean().default(true),
    enableVersioning: zod_1.z.boolean().default(false),
    templateEngine: zod_1.z.enum(['handlebars', 'mustache', 'simple']).default('simple'),
    maxPromptSize: zod_1.z.number().int().default(50000),
    enableHotReload: zod_1.z.boolean().default(false),
    validatePrompts: zod_1.z.boolean().default(true)
});
class PromptRegistry {
    constructor(workingDirectory, config = {}) {
        this.prompts = new Map();
        this.categories = new Map();
        this.loadedPrompts = new Set();
        this.isInitialized = false;
        this.workingDirectory = workingDirectory;
        this.config = exports.PromptRegistryConfigSchema.parse(config);
    }
    static getInstance(workingDirectory, config) {
        if (!PromptRegistry.instance && workingDirectory) {
            PromptRegistry.instance = new PromptRegistry(workingDirectory, config);
        }
        return PromptRegistry.instance;
    }
    async initialize() {
        if (this.isInitialized)
            return;
        advanced_cli_ui_1.advancedUI.logInfo('🧠 Initializing Prompt Registry...');
        const startTime = Date.now();
        try {
            await this.registerBuiltInPrompts();
            if (this.config.autoDiscovery) {
                await this.discoverPrompts();
            }
            if (this.config.validatePrompts) {
                await this.validateAllPrompts();
            }
            this.isInitialized = true;
            const loadTime = Date.now() - startTime;
            advanced_cli_ui_1.advancedUI.logSuccess(`✅ Prompt Registry initialized (${this.prompts.size} prompts, ${loadTime}ms)`);
            if (this.config.enableMetrics) {
                this.logRegistryStats();
            }
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`❌ Prompt Registry initialization failed: ${error.message}`);
            throw error;
        }
    }
    async registerPrompt(promptId, templateContent, metadata) {
        try {
            const promptMetadata = exports.PromptMetadataSchema.parse({
                id: promptId,
                name: metadata.name || promptId,
                description: metadata.description || 'No description provided',
                category: metadata.category || 'system',
                ...metadata
            });
            if (templateContent.length > this.config.maxPromptSize) {
                throw new Error(`Prompt ${promptId} exceeds maximum size limit`);
            }
            const promptTemplate = {
                metadata: promptMetadata,
                template: templateContent,
                isLoaded: true,
                loadTime: Date.now()
            };
            this.prompts.set(promptId, promptTemplate);
            this.addToCategory(promptMetadata.category, promptId);
            this.loadedPrompts.add(promptId);
            advanced_cli_ui_1.advancedUI.logSuccess(`🧠 Registered prompt: ${promptMetadata.name} (${promptId})`);
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`❌ Failed to register prompt ${promptId}: ${error.message}`);
            throw error;
        }
    }
    async getPrompt(promptId, context = {}) {
        const promptTemplate = this.prompts.get(promptId);
        if (!promptTemplate) {
            throw new Error(`Prompt not found: ${promptId}`);
        }
        if (!promptTemplate.metadata.isEnabled) {
            throw new Error(`Prompt is disabled: ${promptId}`);
        }
        try {
            promptTemplate.metadata.usageCount++;
            promptTemplate.metadata.lastUsed = new Date();
            const compiledPrompt = await this.compileTemplate(promptTemplate.template, context);
            if (promptTemplate.metadata.requiresContext && Object.keys(context).length === 0) {
                advanced_cli_ui_1.advancedUI.logWarning(`⚠️  Prompt ${promptId} requires context but none provided`);
            }
            return compiledPrompt;
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`❌ Failed to get prompt ${promptId}: ${error.message}`);
            throw error;
        }
    }
    async getPromptsByCategory(category) {
        const promptIds = this.categories.get(category) || [];
        return promptIds.map(id => this.prompts.get(id)).filter(Boolean);
    }
    searchPrompts(query) {
        const searchTerm = query.toLowerCase();
        return Array.from(this.prompts.values()).filter(prompt => prompt.metadata.name.toLowerCase().includes(searchTerm) ||
            prompt.metadata.description.toLowerCase().includes(searchTerm) ||
            prompt.metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
    }
    async updatePrompt(promptId, newContent, metadata) {
        const existingPrompt = this.prompts.get(promptId);
        if (!existingPrompt) {
            throw new Error(`Prompt not found: ${promptId}`);
        }
        const updatedMetadata = metadata ?
            exports.PromptMetadataSchema.parse({ ...existingPrompt.metadata, ...metadata, updatedAt: new Date() }) :
            { ...existingPrompt.metadata, updatedAt: new Date() };
        const updatedPrompt = {
            ...existingPrompt,
            template: newContent,
            metadata: updatedMetadata,
            loadTime: Date.now()
        };
        this.prompts.set(promptId, updatedPrompt);
        advanced_cli_ui_1.advancedUI.logSuccess(`✅ Updated prompt: ${promptId}`);
    }
    async deletePrompt(promptId) {
        const promptTemplate = this.prompts.get(promptId);
        if (!promptTemplate)
            return false;
        this.prompts.delete(promptId);
        this.loadedPrompts.delete(promptId);
        this.removeFromCategory(promptTemplate.metadata.category, promptId);
        advanced_cli_ui_1.advancedUI.logInfo(`🗑️  Deleted prompt: ${promptId}`);
        return true;
    }
    getAvailablePrompts() {
        return new Map([...this.prompts.entries()].filter(([, prompt]) => prompt.metadata.isEnabled));
    }
    getPromptMetadata(promptId) {
        const prompt = this.prompts.get(promptId);
        return prompt ? prompt.metadata : null;
    }
    getRegistryStats() {
        const stats = {
            totalPrompts: this.prompts.size,
            loadedPrompts: this.loadedPrompts.size,
            enabledPrompts: Array.from(this.prompts.values()).filter(p => p.metadata.isEnabled).length,
            categories: Object.fromEntries(this.categories.entries()),
            topPrompts: Array.from(this.prompts.values())
                .sort((a, b) => b.metadata.usageCount - a.metadata.usageCount)
                .slice(0, 5)
                .map(p => ({
                name: p.metadata.name,
                usage: p.metadata.usageCount,
                successRate: p.metadata.successRate,
                category: p.metadata.category
            }))
        };
        return stats;
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        advanced_cli_ui_1.advancedUI.logInfo('🧠 Prompt Registry configuration updated');
    }
    async registerBuiltInPrompts() {
        await this.registerPrompt('universal-agent-system', `
You are the Universal Agent, a comprehensive AI assistant for autonomous software development.

## Core Capabilities
- Full-stack development (React, TypeScript, Node.js, databases)
- Code generation, analysis, review, and optimization
- DevOps operations and deployment
- Autonomous project creation and management
- LSP integration for code intelligence
- Context-aware workspace understanding

## Operating Principles
1. **Enterprise Quality**: Always produce production-ready code
2. **Security First**: Follow security best practices
3. **Clean Architecture**: Use proper separation of concerns
4. **Type Safety**: Leverage TypeScript for type safety
5. **Testing**: Include comprehensive tests
6. **Documentation**: Provide clear documentation
7. **Performance**: Optimize for performance and scalability
8. **Accessibility**: Follow accessibility guidelines

## Integration Requirements
- Always use LSP for code intelligence
- Integrate with Context system for workspace awareness  
- Use Zod for runtime validation
- Follow existing code patterns and conventions
- Leverage existing tools and services

## Communication Style
- Be concise but comprehensive
- Explain complex decisions
- Provide actionable recommendations
- Focus on practical solutions
`, {
            name: 'Universal Agent System Prompt',
            description: 'Core system prompt for the Universal Agent',
            category: 'agent',
            tags: ['system', 'agent', 'universal'],
            complexity: 'expert'
        });
        await this.registerPrompt('tool-execution-system', `
## Tool Execution Guidelines

### Pre-Execution Analysis
1. Analyze the task requirements and context
2. Select appropriate tools based on capabilities
3. Validate inputs and permissions
4. Check LSP diagnostics for code operations
5. Review context history for patterns

### Execution Process
1. Use tools in logical sequence
2. Handle errors gracefully with rollback
3. Validate outputs and results
4. Record operations for learning
5. Provide clear feedback

### Quality Assurance
1. Validate all inputs with Zod schemas
2. Use appropriate error handling
3. Follow security best practices
4. Ensure type safety throughout
5. Test critical operations

Context Variables:
- workingDirectory: {{workingDirectory}}
- agentId: {{agentId}}
- toolName: {{toolName}}
- timestamp: {{timestamp}}
`, {
            name: 'Tool Execution System',
            description: 'System prompt for tool execution operations',
            category: 'tool',
            tags: ['execution', 'tools', 'validation'],
            complexity: 'advanced',
            requiresContext: true,
            contextTypes: ['workingDirectory', 'agentId', 'toolName'],
            variables: [
                { name: 'workingDirectory', type: 'string', required: true, description: 'Current working directory' },
                { name: 'agentId', type: 'string', required: false, description: 'Executing agent ID' },
                { name: 'toolName', type: 'string', required: false, description: 'Tool being executed' }
            ]
        });
        await this.registerPrompt('error-handling-system', `
## Error Handling Protocol

### Error Classification
1. **Critical Errors**: System failures, security violations, data corruption
2. **Operational Errors**: Tool failures, validation errors, network issues
3. **User Errors**: Invalid input, missing permissions, configuration issues
4. **Warning Conditions**: Non-blocking issues, performance concerns

### Response Strategy
- Critical: Immediate stop with rollback
- Operational: Retry with backoff, fallback strategies
- User: Clear error messages with solutions
- Warning: Log and continue with notification

### Recovery Actions
1. Automatic rollback for file operations
2. State restoration for agent tasks
3. Error reporting with context
4. Learning from error patterns
5. Prevention strategies for future

Error Context:
- errorType: {{errorType}}
- errorMessage: {{errorMessage}}
- stackTrace: {{stackTrace}}
- recoveryOptions: {{recoveryOptions}}
`, {
            name: 'Error Handling System',
            description: 'System prompt for error handling and recovery',
            category: 'error-handling',
            tags: ['error', 'recovery', 'system'],
            complexity: 'advanced',
            requiresContext: true
        });
    }
    async discoverPrompts() {
        const promptsDir = (0, path_1.join)(this.workingDirectory, this.config.promptsDirectory);
        try {
            const files = await (0, promises_1.readdir)(promptsDir);
            for (const file of files) {
                if ((0, path_1.extname)(file) === '.txt' || (0, path_1.extname)(file) === '.md') {
                    await this.loadPromptFromFile((0, path_1.join)(promptsDir, file));
                }
            }
        }
        catch (error) {
            logger_1.logger.debug(`Prompt discovery failed for ${promptsDir}`);
        }
    }
    async loadPromptFromFile(filePath) {
        try {
            const content = await (0, promises_1.readFile)(filePath, 'utf8');
            const filename = filePath.split('/').pop()?.replace(/\.(txt|md)$/, '') || 'unknown';
            const metadataMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            let metadata = {};
            let template = content;
            if (metadataMatch) {
                try {
                    const metadataLines = metadataMatch[1].split('\n');
                    for (const line of metadataLines) {
                        const [key, ...valueParts] = line.split(':');
                        if (key && valueParts.length > 0) {
                            const value = valueParts.join(':').trim();
                            metadata[key.trim()] = value.replace(/^["']|["']$/g, '');
                        }
                    }
                    template = metadataMatch[2];
                }
                catch (parseError) {
                }
            }
            await this.registerPrompt(filename, template, {
                ...metadata,
                category: metadata['category'] || 'system'
            });
        }
        catch (error) {
            logger_1.logger.debug(`Failed to load prompt from ${filePath}: ${error.message}`);
        }
    }
    async validateAllPrompts() {
        for (const [promptId, prompt] of this.prompts.entries()) {
            try {
                await this.validatePrompt(prompt);
            }
            catch (error) {
                advanced_cli_ui_1.advancedUI.logWarning(`⚠️  Prompt validation failed for ${promptId}: ${error.message}`);
            }
        }
    }
    async validatePrompt(prompt) {
        if (!prompt.template || prompt.template.trim().length === 0) {
            throw new Error('Prompt template is empty');
        }
        if (prompt.template.length > this.config.maxPromptSize) {
            throw new Error('Prompt exceeds maximum size limit');
        }
        const variablePattern = /\{\{(\w+)\}\}/g;
        const foundVariables = [];
        let match;
        while ((match = variablePattern.exec(prompt.template)) !== null) {
            foundVariables.push(match[1]);
        }
        const declaredVariables = prompt.metadata.variables.map(v => v.name);
        const undeclaredVariables = foundVariables.filter(v => !declaredVariables.includes(v));
        if (undeclaredVariables.length > 0) {
            advanced_cli_ui_1.advancedUI.logWarning(`Undeclared variables in ${prompt.metadata.id}: ${undeclaredVariables.join(', ')}`);
        }
    }
    async compileTemplate(template, context) {
        let compiled = template;
        const variablePattern = /\{\{(\w+)\}\}/g;
        compiled = compiled.replace(variablePattern, (match, variableName) => {
            if (context.hasOwnProperty(variableName)) {
                return String(context[variableName]);
            }
            return match;
        });
        return compiled;
    }
    addToCategory(category, promptId) {
        if (!this.categories.has(category)) {
            this.categories.set(category, []);
        }
        this.categories.get(category).push(promptId);
    }
    removeFromCategory(category, promptId) {
        const categoryPrompts = this.categories.get(category);
        if (categoryPrompts) {
            const index = categoryPrompts.indexOf(promptId);
            if (index > -1) {
                categoryPrompts.splice(index, 1);
            }
        }
    }
    logRegistryStats() {
        const stats = this.getRegistryStats();
        advanced_cli_ui_1.advancedUI.logInfo(`🧠 Prompt Registry Statistics:`);
        console.log(chalk_1.default.cyan(`   Total Prompts: ${stats.totalPrompts}`));
        console.log(chalk_1.default.cyan(`   Loaded: ${stats.loadedPrompts}`));
        console.log(chalk_1.default.cyan(`   Enabled: ${stats.enabledPrompts}`));
        console.log(chalk_1.default.cyan(`   Categories: ${Object.keys(stats.categories).length}`));
        if (stats.topPrompts.length > 0) {
            console.log(chalk_1.default.cyan(`   Top Prompts:`));
            stats.topPrompts.forEach(prompt => {
                console.log(chalk_1.default.gray(`     ${prompt.name}: ${prompt.usage} uses (${(prompt.successRate * 100).toFixed(1)}% success)`));
            });
        }
    }
}
exports.PromptRegistry = PromptRegistry;
exports.promptRegistry = PromptRegistry.getInstance();
