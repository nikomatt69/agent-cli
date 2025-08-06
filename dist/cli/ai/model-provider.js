"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelProvider = exports.ModelProvider = void 0;
const ai_1 = require("ai");
const openai_1 = require("@ai-sdk/openai");
const anthropic_1 = require("@ai-sdk/anthropic");
const google_1 = require("@ai-sdk/google");
const config_manager_1 = require("../config/config-manager");
class ModelProvider {
    getModel(config) {
        const currentModelName = config_manager_1.configManager.get('currentModel');
        const apiKey = config_manager_1.configManager.getApiKey(currentModelName);
        if (!apiKey) {
            throw new Error(`API key not found for model: ${currentModelName}. Use /set-key command to configure API keys`);
        }
        switch (config.provider) {
            case 'openai':
                const openaiProvider = (0, openai_1.createOpenAI)({ apiKey });
                return openaiProvider(config.model);
            case 'anthropic':
                const anthropicProvider = (0, anthropic_1.createAnthropic)({ apiKey });
                return anthropicProvider(config.model);
            case 'google':
                const googleProvider = (0, google_1.createGoogleGenerativeAI)({ apiKey });
                return googleProvider(config.model);
            default:
                throw new Error(`Unsupported provider: ${config.provider}`);
        }
    }
    async generateResponse(options) {
        const currentModel = config_manager_1.configManager.getCurrentModel();
        const model = this.getModel(currentModel);
        const { text } = await (0, ai_1.generateText)({
            model,
            messages: options.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            temperature: options.temperature ?? config_manager_1.configManager.get('temperature'),
            maxTokens: options.maxTokens ?? 4000,
        });
        return text;
    }
    async *streamResponse(options) {
        const currentModel = config_manager_1.configManager.getCurrentModel();
        const model = this.getModel(currentModel);
        const result = await (0, ai_1.streamText)({
            model,
            messages: options.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            temperature: options.temperature ?? config_manager_1.configManager.get('temperature'),
            maxTokens: options.maxTokens ?? 4000,
        });
        for await (const delta of result.textStream) {
            yield delta;
        }
    }
    async generateStructured(options) {
        const currentModel = config_manager_1.configManager.getCurrentModel();
        const model = this.getModel(currentModel);
        const { object } = await (0, ai_1.generateObject)({
            model,
            messages: options.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            schema: options.schema,
            schemaName: options.schemaName,
            schemaDescription: options.schemaDescription,
            temperature: options.temperature ?? config_manager_1.configManager.get('temperature'),
        });
        return object;
    }
    validateApiKey() {
        return config_manager_1.configManager.validateCurrentModel();
    }
    getCurrentModelInfo() {
        return {
            name: config_manager_1.configManager.get('currentModel'),
            config: config_manager_1.configManager.getCurrentModel(),
        };
    }
}
exports.ModelProvider = ModelProvider;
exports.modelProvider = new ModelProvider();
