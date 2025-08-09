"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelProvider = exports.ModelProvider = void 0;
const ai_1 = require("ai");
const openai_1 = require("@ai-sdk/openai");
const anthropic_1 = require("@ai-sdk/anthropic");
const google_1 = require("@ai-sdk/google");
const ollama_ai_provider_1 = require("ollama-ai-provider");
const config_manager_1 = require("../core/config-manager");
class ModelProvider {
    getModel(config) {
        const currentModelName = config_manager_1.configManager.get('currentModel');
        switch (config.provider) {
            case 'openai': {
                const apiKey = config_manager_1.configManager.getApiKey(currentModelName);
                if (!apiKey) {
                    throw new Error(`API key not found for model: ${currentModelName} (OpenAI). Use /set-key to configure.`);
                }
                const openaiProvider = (0, openai_1.createOpenAI)({ apiKey });
                return openaiProvider(config.model);
            }
            case 'anthropic': {
                const apiKey = config_manager_1.configManager.getApiKey(currentModelName);
                if (!apiKey) {
                    throw new Error(`API key not found for model: ${currentModelName} (Anthropic). Use /set-key to configure.`);
                }
                const anthropicProvider = (0, anthropic_1.createAnthropic)({ apiKey });
                return anthropicProvider(config.model);
            }
            case 'google': {
                const apiKey = config_manager_1.configManager.getApiKey(currentModelName);
                if (!apiKey) {
                    throw new Error(`API key not found for model: ${currentModelName} (Google). Use /set-key to configure.`);
                }
                const googleProvider = (0, google_1.createGoogleGenerativeAI)({ apiKey });
                return googleProvider(config.model);
            }
            case 'ollama': {
                // Ollama does not require API keys; assumes local daemon at default endpoint
                const ollamaProvider = (0, ollama_ai_provider_1.createOllama)({});
                return ollamaProvider(config.model);
            }
            default:
                throw new Error(`Unsupported provider: ${config.provider}`);
        }
    }
    async generateResponse(options) {
        const currentModelName = config_manager_1.configManager.getCurrentModel();
        const models = config_manager_1.configManager.get('models');
        const currentModelConfig = models[currentModelName];
        if (!currentModelConfig) {
            throw new Error(`Model configuration not found for: ${currentModelName}`);
        }
        const model = this.getModel(currentModelConfig);
        const { text } = await (0, ai_1.generateText)({
            model: model,
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
        const currentModelName = config_manager_1.configManager.getCurrentModel();
        const models = config_manager_1.configManager.get('models');
        const currentModelConfig = models[currentModelName];
        if (!currentModelConfig) {
            throw new Error(`Model configuration not found for: ${currentModelName}`);
        }
        const model = this.getModel(currentModelConfig);
        const result = await (0, ai_1.streamText)({
            model: model,
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
        const currentModelName = config_manager_1.configManager.getCurrentModel();
        const models = config_manager_1.configManager.get('models');
        const currentModelConfig = models[currentModelName];
        if (!currentModelConfig) {
            throw new Error(`Model configuration not found for: ${currentModelName}`);
        }
        const model = this.getModel(currentModelConfig);
        const { object } = await (0, ai_1.generateObject)({
            model: model,
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
        return config_manager_1.configManager.validateConfig();
    }
    getCurrentModelInfo() {
        const name = config_manager_1.configManager.get('currentModel');
        const models = config_manager_1.configManager.get('models');
        const cfg = models[name];
        if (!cfg) {
            throw new Error(`Model configuration not found for: ${name}`);
        }
        return {
            name,
            config: cfg,
        };
    }
}
exports.ModelProvider = ModelProvider;
exports.modelProvider = new ModelProvider();
