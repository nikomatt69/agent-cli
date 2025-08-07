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
        this.promptsDirectory = (0, path_1.join)(projectRoot, 'prompts');
    }
    static getInstance(projectRoot) {
        if (!PromptManager.instance && projectRoot) {
            PromptManager.instance = new PromptManager(projectRoot);
        }
        return PromptManager.instance;
    }
    /**
     * Carica il system prompt appropriato per il contesto dato
     */
    async loadPromptForContext(context) {
        const promptPath = this.resolvePromptPath(context);
        if (!promptPath) {
            cli_ui_1.CliUI.logWarning(`No specific prompt found for context: ${JSON.stringify(context)}`);
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
    /**
     * Risolve il percorso del prompt basato sul contesto
     */
    resolvePromptPath(context) {
        const candidates = [];
        // Tool-specific prompts
        if (context.toolName) {
            candidates.push(`tools/atomic-tools/${context.toolName}.txt`);
            candidates.push(`tools/analysis-tools/${context.toolName}.txt`);
        }
        // Agent-specific prompts
        if (context.agentId) {
            candidates.push(`system/${context.agentId}.txt`);
        }
        // Action-specific prompts
        if (context.actionType) {
            candidates.push(`tools/agent-actions/${context.actionType}.txt`);
        }
        // Command-specific prompts
        if (context.commandName) {
            candidates.push(`tools/cli-commands/${context.commandName}.txt`);
        }
        // Task-specific prompts
        if (context.taskType) {
            candidates.push(`tools/workflow-steps/${context.taskType}.txt`);
        }
        // Safety prompts based on risk level
        if (context.riskLevel === 'high') {
            candidates.push(`tools/safety-prompts/approval-required.txt`);
        }
        // Find first existing prompt file
        for (const candidate of candidates) {
            const fullPath = (0, path_1.join)(this.promptsDirectory, candidate);
            if ((0, fs_1.existsSync)(fullPath)) {
                return candidate;
            }
        }
        return null;
    }
    /**
     * Carica un prompt dal filesystem con caching
     */
    async loadPrompt(relativePath) {
        const fullPath = (0, path_1.join)(this.promptsDirectory, relativePath);
        // Check cache first
        if (this.cacheEnabled && this.promptCache.has(relativePath)) {
            const cached = this.promptCache.get(relativePath);
            // Verify file hasn't changed
            try {
                const stats = require('fs').statSync(fullPath);
                if (stats.mtime <= cached.lastModified) {
                    return cached;
                }
            }
            catch (error) {
                // File might have been deleted, remove from cache
                this.promptCache.delete(relativePath);
            }
        }
        // Load from filesystem
        const content = (0, fs_1.readFileSync)(fullPath, 'utf-8');
        const stats = require('fs').statSync(fullPath);
        const prompt = {
            content,
            filePath: fullPath,
            lastModified: stats.mtime,
            category: this.getCategoryFromPath(relativePath)
        };
        // Cache the prompt
        if (this.cacheEnabled) {
            this.promptCache.set(relativePath, prompt);
        }
        return prompt;
    }
    /**
     * Interpola variabili nel prompt usando il contesto
     */
    interpolatePrompt(content, context) {
        let interpolated = content;
        // Replace context variables
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
        // Add timestamp
        interpolated = interpolated.replace(/\{timestamp\}/g, new Date().toISOString());
        return interpolated;
    }
    /**
     * Ottiene un prompt di default se non trovato specifico
     */
    getDefaultPrompt(context) {
        if (context.toolName) {
            return `You are executing the ${context.toolName} tool. Follow best practices for safe and efficient execution.`;
        }
        if (context.agentId) {
            return `You are the ${context.agentId}. Execute tasks according to your specialization and capabilities.`;
        }
        if (context.actionType) {
            return `You are performing a ${context.actionType} action. Ensure proper execution and error handling.`;
        }
        return 'You are an AI assistant. Execute the requested operation safely and efficiently.';
    }
    /**
     * Ottiene la categoria dal percorso del prompt
     */
    getCategoryFromPath(path) {
        const parts = path.split('/');
        if (parts.length >= 2) {
            return parts[1]; // e.g., 'atomic-tools', 'agent-actions', etc.
        }
        return 'general';
    }
    /**
     * Pre-carica tutti i prompts per performance migliori
     */
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
    /**
     * Lista tutti i prompts disponibili
     */
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
    /**
     * Invalida la cache dei prompts
     */
    clearCache() {
        this.promptCache.clear();
        cli_ui_1.CliUI.logInfo('🗑️ Prompt cache cleared');
    }
    /**
     * Ottiene statistiche sulla cache
     */
    getCacheStats() {
        const categories = {};
        for (const prompt of Array.from(this.promptCache.values())) {
            const category = prompt.category;
            categories[category] = (categories[category] || 0) + 1;
        }
        return {
            size: this.promptCache.size,
            categories
        };
    }
}
exports.PromptManager = PromptManager;
