"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptManager = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const cli_ui_1 = require("../utils/cli-ui");
class PromptManager {
    constructor(projectRoot) {
        this.promptCache = new Map();
        this.cacheEnabled = true;
        this.maxCacheSize = 100;
        this.cacheTTL = 30 * 60 * 1000;
        this.promptsDirectory = (0, path_1.resolve)((0, path_1.join)(projectRoot, 'src', 'prompts'));
        this.validatePromptsDirectory();
    }
    validatePromptsDirectory() {
        if (!(0, fs_1.existsSync)(this.promptsDirectory)) {
            cli_ui_1.CliUI.logWarning(`Prompts directory not found: ${this.promptsDirectory}`);
            cli_ui_1.CliUI.logWarning('Creating prompts directory structure...');
            this.createDefaultPromptStructure();
        }
    }
    createDefaultPromptStructure() {
        const fs = require('fs');
        const dirs = [
            'system',
            'tools/atomic-tools',
            'tools/analysis-tools',
            'tools/agent-actions',
            'tools/cli-commands',
            'tools/workflow-steps',
            'tools/safety-prompts'
        ];
        try {
            for (const dir of dirs) {
                const fullPath = (0, path_1.join)(this.promptsDirectory, dir);
                fs.mkdirSync(fullPath, { recursive: true });
            }
            cli_ui_1.CliUI.logSuccess('✅ Created default prompt directory structure');
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Failed to create prompt directories: ${error.message}`);
        }
    }
    isPathSafe(relativePath) {
        try {
            const fullPath = (0, path_1.resolve)((0, path_1.join)(this.promptsDirectory, relativePath));
            const normalizedPromptsDir = (0, path_1.resolve)(this.promptsDirectory);
            const relativeToPrompts = (0, path_1.relative)(normalizedPromptsDir, fullPath);
            return !relativeToPrompts.startsWith('..');
        }
        catch (error) {
            return false;
        }
    }
    static getInstance(projectRoot) {
        if (!PromptManager.instance && projectRoot) {
            PromptManager.instance = new PromptManager(projectRoot);
        }
        return PromptManager.instance;
    }
    async loadPromptForContext(context) {
        const promptPath = this.resolvePromptPath(context);
        if (!promptPath) {
            cli_ui_1.CliUI.logWarning(`⚠ No specific prompt found for context: ${JSON.stringify(context)}`);
            return this.getDefaultPrompt(context);
        }
        try {
            const prompt = await this.loadPrompt(promptPath);
            cli_ui_1.CliUI.logDebug(`Loaded prompt: ${promptPath}`);
            return this.interpolatePrompt(prompt.content, context);
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Failed to load prompt ${promptPath}: ${error.message}`);
            return this.getDefaultPrompt(context);
        }
    }
    resolvePromptPath(context) {
        const candidates = [];
        if (context.toolName) {
            candidates.push(`tools/atomic-tools/${context.toolName}.txt`);
            candidates.push(`tools/analysis-tools/${context.toolName}.txt`);
            candidates.push(`tools/atomic-tools/generic-tool.txt`);
        }
        if (context.agentId) {
            candidates.push(`system/${context.agentId}.txt`);
            candidates.push(`system/base-agent.txt`);
        }
        if (context.actionType) {
            candidates.push(`tools/agent-actions/${context.actionType}.txt`);
            candidates.push(`tools/agent-actions/generic-action.txt`);
        }
        if (context.commandName) {
            candidates.push(`tools/cli-commands/${context.commandName}.txt`);
            candidates.push(`tools/cli-commands/generic-command.txt`);
        }
        if (context.taskType) {
            candidates.push(`tools/workflow-steps/${context.taskType}.txt`);
            candidates.push(`tools/workflow-steps/generic-workflow.txt`);
        }
        if (context.riskLevel === 'high') {
            candidates.push(`tools/safety-prompts/approval-required.txt`);
        }
        else if (context.riskLevel === 'medium') {
            candidates.push(`tools/safety-prompts/caution-required.txt`);
        }
        candidates.push(`system/base-agent.txt`);
        candidates.push(`tools/generic-fallback.txt`);
        for (const candidate of candidates) {
            const fullPath = (0, path_1.join)(this.promptsDirectory, candidate);
            if ((0, fs_1.existsSync)(fullPath)) {
                return candidate;
            }
        }
        return null;
    }
    async loadPrompt(relativePath) {
        if (!this.isPathSafe(relativePath)) {
            throw new Error(`Unsafe path detected: ${relativePath}`);
        }
        const fullPath = (0, path_1.join)(this.promptsDirectory, relativePath);
        if (this.cacheEnabled && this.promptCache.has(relativePath)) {
            const cached = this.promptCache.get(relativePath);
            const now = new Date();
            const cacheAge = now.getTime() - cached.cacheTime.getTime();
            if (cacheAge > this.cacheTTL) {
                this.promptCache.delete(relativePath);
            }
            else {
                try {
                    const stats = require('fs').statSync(fullPath);
                    if (stats.mtime <= cached.lastModified) {
                        cached.accessCount++;
                        cached.lastAccessed = now;
                        return cached;
                    }
                }
                catch (error) {
                    this.promptCache.delete(relativePath);
                }
            }
        }
        if (!(0, fs_1.existsSync)(fullPath)) {
            throw new Error(`Prompt file not found: ${relativePath}`);
        }
        const content = (0, fs_1.readFileSync)(fullPath, 'utf-8');
        if (!content.trim()) {
            throw new Error(`Prompt file is empty: ${relativePath}`);
        }
        const stats = require('fs').statSync(fullPath);
        const now = new Date();
        const prompt = {
            content: content.trim(),
            filePath: fullPath,
            lastModified: stats.mtime,
            category: this.getCategoryFromPath(relativePath),
            cacheTime: now,
            accessCount: 1,
            lastAccessed: now
        };
        if (this.cacheEnabled) {
            if (this.promptCache.size >= this.maxCacheSize) {
                this.evictLeastRecentlyUsed();
            }
            this.promptCache.set(relativePath, prompt);
        }
        return prompt;
    }
    interpolatePrompt(content, context) {
        let interpolated = content;
        if (context.toolName) {
            interpolated = interpolated.replace(/\{toolName\}/g, context.toolName);
        }
        if (context.agentId) {
            interpolated = interpolated.replace(/\{agentId\}/g, context.agentId);
        }
        if (context.parameters) {
            for (const [key, value] of Object.entries(context.parameters)) {
                const placeholder = new RegExp(`\\{${key}\\}`, 'g');
                interpolated = interpolated.replace(placeholder, String(value));
            }
        }
        interpolated = interpolated.replace(/\{timestamp\}/g, new Date().toISOString());
        return interpolated;
    }
    getDefaultPrompt(context) {
        let prompt = '';
        if (context.toolName) {
            prompt = `SYSTEM PROMPT - ${context.toolName.toUpperCase()} TOOL

You are the ${context.toolName} tool, specialized in secure and efficient execution.

CORE CAPABILITIES:
- Execute ${context.toolName} operations safely
- Validate inputs and parameters
- Handle errors gracefully
- Provide structured output
- Follow security best practices

SECURITY CONTROLS:
- Validate all input parameters
- Check permissions before execution
- Monitor resource usage
- Log all operations for audit
- Handle timeouts appropriately

BEST PRACTICES:
- Always validate inputs before processing
- Provide clear error messages
- Follow the principle of least privilege
- Maintain operation logs
- Ensure consistent output format

PARAMETERS: ${context.parameters ? JSON.stringify(context.parameters, null, 2) : 'None provided'}

Execute the operation according to these guidelines.`;
        }
        else if (context.agentId) {
            prompt = `SYSTEM PROMPT - ${context.agentId.toUpperCase()} AGENT

You are the ${context.agentId} agent, part of a multi-agent development system.

AGENT IDENTITY:
- Specialized AI agent for software development
- Autonomous operation with human oversight
- Collaborative with other agents
- Security-conscious and safety-first

CORE RESPONSIBILITIES:
- Execute assigned tasks efficiently
- Coordinate with other agents when needed
- Maintain transparency in all actions
- Follow security protocols
- Provide structured results

OPERATIONAL MODE:
- Analyze tasks before execution
- Create step-by-step execution plans
- Monitor progress and handle errors
- Report results with clear explanations
- Suggest improvements when applicable

Execute tasks according to your specialization and these operational guidelines.`;
        }
        else if (context.actionType) {
            prompt = `SYSTEM PROMPT - ${context.actionType.toUpperCase()} ACTION

You are performing a ${context.actionType} action as part of an automated workflow.

ACTION GUIDELINES:
- Ensure proper execution and error handling
- Validate all preconditions
- Monitor execution progress
- Handle failures gracefully
- Provide detailed execution reports

SAFETY MEASURES:
- Check all parameters before execution
- Respect system limits and constraints
- Log all actions for audit trail
- Escalate critical decisions when needed
- Maintain system integrity

Follow these guidelines to ensure safe and effective action execution.`;
        }
        else {
            prompt = `SYSTEM PROMPT - AI ASSISTANT

You are an AI assistant specialized in software development tasks.

CORE PRINCIPLES:
- Safety first - always validate operations
- Efficiency - optimize for performance and accuracy
- Transparency - provide clear explanations
- Security - follow best practices and protocols
- Collaboration - work effectively with users and systems

OPERATIONAL GUIDELINES:
- Analyze requests thoroughly before execution
- Provide structured and actionable responses
- Handle errors gracefully with helpful messages
- Maintain context and conversation continuity
- Follow industry best practices

Execute the requested operation safely, efficiently, and with clear communication.`;
        }
        if (context.riskLevel === 'high') {
            prompt += '\n\n⚠️ HIGH RISK OPERATION: This operation requires special attention and may need approval before execution.';
        }
        else if (context.riskLevel === 'medium') {
            prompt += '\n\n⚠️ MEDIUM RISK OPERATION: Exercise caution and validate all parameters carefully.';
        }
        return prompt;
    }
    getCategoryFromPath(path) {
        const parts = path.split('/');
        if (parts.length >= 2) {
            return parts[1];
        }
        return 'general';
    }
    async preloadPrompts() {
        cli_ui_1.CliUI.logInfo('🔄 Pre-loading system prompts...');
        const promptDirs = [
            'tools/atomic-tools',
            'tools/analysis-tools',
            'tools/agent-actions',
            'tools/cli-commands',
            'tools/workflow-steps',
            'tools/safety-prompts',
            'system'
        ];
        let loadedCount = 0;
        for (const dir of promptDirs) {
            try {
                const dirPath = (0, path_1.join)(this.promptsDirectory, dir);
                if ((0, fs_1.existsSync)(dirPath)) {
                    const files = require('fs').readdirSync(dirPath);
                    for (const file of files) {
                        if (file.endsWith('.txt')) {
                            const relativePath = (0, path_1.join)(dir, file);
                            await this.loadPrompt(relativePath);
                            loadedCount++;
                        }
                    }
                }
            }
            catch (error) {
                cli_ui_1.CliUI.logWarning(`Failed to preload prompts from ${dir}: ${error.message}`);
            }
        }
        cli_ui_1.CliUI.logSuccess(`✅ Pre-loaded ${loadedCount} system prompts`);
    }
    listAvailablePrompts() {
        const categories = {};
        for (const [path, prompt] of Array.from(this.promptCache)) {
            const category = prompt.category;
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(path);
        }
        return Object.entries(categories).map(([category, prompts]) => ({
            category,
            prompts: prompts.sort()
        }));
    }
    clearCache() {
        this.promptCache.clear();
        cli_ui_1.CliUI.logInfo('🗑️ Prompt cache cleared');
    }
    evictLeastRecentlyUsed() {
        if (this.promptCache.size === 0)
            return;
        const entries = Array.from(this.promptCache.entries()).sort((a, b) => {
            return a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime();
        });
        const toRemove = Math.max(1, Math.floor(this.promptCache.size * 0.25));
        for (let i = 0; i < toRemove; i++) {
            this.promptCache.delete(entries[i][0]);
        }
        cli_ui_1.CliUI.logDebug(`🗑️ Evicted ${toRemove} cache entries (LRU)`);
    }
    cleanExpiredCache() {
        const now = new Date();
        let removedCount = 0;
        for (const [path, prompt] of this.promptCache.entries()) {
            const cacheAge = now.getTime() - prompt.cacheTime.getTime();
            if (cacheAge > this.cacheTTL) {
                this.promptCache.delete(path);
                removedCount++;
            }
        }
        if (removedCount > 0) {
            cli_ui_1.CliUI.logDebug(`🗑️ Cleaned ${removedCount} expired cache entries`);
        }
    }
    getCacheStats() {
        const categories = {};
        let totalAccessCount = 0;
        let totalAge = 0;
        const now = new Date();
        for (const prompt of Array.from(this.promptCache.values())) {
            const category = prompt.category;
            categories[category] = (categories[category] || 0) + 1;
            totalAccessCount += prompt.accessCount;
            totalAge += now.getTime() - prompt.cacheTime.getTime();
        }
        const averageAge = this.promptCache.size > 0 ? totalAge / this.promptCache.size : 0;
        const hitRate = totalAccessCount > this.promptCache.size ?
            (totalAccessCount - this.promptCache.size) / totalAccessCount : 0;
        return {
            size: this.promptCache.size,
            maxSize: this.maxCacheSize,
            categories,
            totalAccessCount,
            averageAge: averageAge / 1000,
            hitRate: Math.round(hitRate * 100) / 100
        };
    }
    configureCaching(options) {
        if (options.enabled !== undefined) {
            this.cacheEnabled = options.enabled;
        }
        if (options.maxSize !== undefined) {
            this.maxCacheSize = options.maxSize;
        }
        if (options.ttlMinutes !== undefined) {
            this.cacheTTL = options.ttlMinutes * 60 * 1000;
        }
        cli_ui_1.CliUI.logInfo(`📋 Cache configured: enabled=${this.cacheEnabled}, maxSize=${this.maxCacheSize}, ttl=${this.cacheTTL / 1000 / 60}min`);
    }
}
exports.PromptManager = PromptManager;
