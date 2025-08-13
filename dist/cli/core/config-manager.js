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
exports.configManager = exports.ConfigManager = exports.simpleConfigManager = exports.SimpleConfigManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const chalk_1 = __importDefault(require("chalk"));
const zod_1 = require("zod");
const ModelConfigSchema = zod_1.z.object({
    provider: zod_1.z.enum(['openai', 'anthropic', 'google', 'ollama']),
    model: zod_1.z.string(),
    temperature: zod_1.z.number().min(0).max(2).optional(),
    maxTokens: zod_1.z.number().min(1).max(8000).optional(),
});
const ConfigSchema = zod_1.z.object({
    currentModel: zod_1.z.string(),
    temperature: zod_1.z.number().min(0).max(2).default(0.7),
    maxTokens: zod_1.z.number().min(1).max(16000).default(12000),
    chatHistory: zod_1.z.boolean().default(true),
    maxHistoryLength: zod_1.z.number().min(1).max(1000).default(100),
    systemPrompt: zod_1.z.string().optional(),
    autoAnalyzeWorkspace: zod_1.z.boolean().default(true),
    enableAutoApprove: zod_1.z.boolean().default(false),
    preferredAgent: zod_1.z.string().optional(),
    models: zod_1.z.record(ModelConfigSchema),
    apiKeys: zod_1.z.record(zod_1.z.string()).optional(),
    mcpServers: zod_1.z.record(zod_1.z.object({
        name: zod_1.z.string(),
        type: zod_1.z.enum(['http', 'websocket', 'command', 'stdio']),
        endpoint: zod_1.z.string().optional(),
        command: zod_1.z.string().optional(),
        args: zod_1.z.array(zod_1.z.string()).optional(),
        headers: zod_1.z.record(zod_1.z.string()).optional(),
        timeout: zod_1.z.number().optional(),
        retries: zod_1.z.number().optional(),
        healthCheck: zod_1.z.string().optional(),
        enabled: zod_1.z.boolean(),
        priority: zod_1.z.number().optional(),
        capabilities: zod_1.z.array(zod_1.z.string()).optional(),
        authentication: zod_1.z.object({
            type: zod_1.z.enum(['bearer', 'basic', 'api_key']),
            token: zod_1.z.string().optional(),
            username: zod_1.z.string().optional(),
            password: zod_1.z.string().optional(),
            apiKey: zod_1.z.string().optional(),
            header: zod_1.z.string().optional(),
        }).optional(),
    })).optional(),
    maxConcurrentAgents: zod_1.z.number().min(1).max(10).default(3),
    enableGuidanceSystem: zod_1.z.boolean().default(true),
    defaultAgentTimeout: zod_1.z.number().min(1000).default(60000),
    logLevel: zod_1.z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    requireApprovalForNetwork: zod_1.z.boolean().default(true),
    approvalPolicy: zod_1.z.enum(['strict', 'moderate', 'permissive']).default('moderate'),
    securityMode: zod_1.z.enum(['safe', 'default', 'developer']).default('safe'),
    toolApprovalPolicies: zod_1.z.object({
        fileOperations: zod_1.z.enum(['always', 'risky', 'never']).default('risky'),
        gitOperations: zod_1.z.enum(['always', 'risky', 'never']).default('risky'),
        packageOperations: zod_1.z.enum(['always', 'risky', 'never']).default('risky'),
        systemCommands: zod_1.z.enum(['always', 'risky', 'never']).default('always'),
        networkRequests: zod_1.z.enum(['always', 'risky', 'never']).default('always'),
    }).default({
        fileOperations: 'risky',
        gitOperations: 'risky',
        packageOperations: 'risky',
        systemCommands: 'always',
        networkRequests: 'always',
    }),
    sessionSettings: zod_1.z.object({
        approvalTimeoutMs: zod_1.z.number().min(5000).max(300000).default(30000),
        devModeTimeoutMs: zod_1.z.number().min(60000).max(7200000).default(3600000),
        batchApprovalEnabled: zod_1.z.boolean().default(true),
        autoApproveReadOnly: zod_1.z.boolean().default(true),
    }).default({
        approvalTimeoutMs: 30000,
        devModeTimeoutMs: 3600000,
        batchApprovalEnabled: true,
        autoApproveReadOnly: true,
    }),
    sandbox: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        allowFileSystem: zod_1.z.boolean().default(true),
        allowNetwork: zod_1.z.boolean().default(false),
        allowCommands: zod_1.z.boolean().default(true),
    }).default({
        enabled: true,
        allowFileSystem: true,
        allowNetwork: false,
        allowCommands: true,
    }),
    cloudDocs: zod_1.z.object({
        enabled: zod_1.z.boolean().default(false),
        provider: zod_1.z.enum(['supabase', 'firebase', 'github']).default('supabase'),
        apiUrl: zod_1.z.string().optional(),
        apiKey: zod_1.z.string().optional(),
        autoSync: zod_1.z.boolean().default(true),
        contributionMode: zod_1.z.boolean().default(true),
        maxContextSize: zod_1.z.number().min(10000).max(100000).default(50000),
        autoLoadForAgents: zod_1.z.boolean().default(true),
        smartSuggestions: zod_1.z.boolean().default(true),
    }).default({
        enabled: false,
        provider: 'supabase',
        autoSync: true,
        contributionMode: true,
        maxContextSize: 50000,
        autoLoadForAgents: true,
        smartSuggestions: true,
    }),
});
class SimpleConfigManager {
    constructor() {
        this.defaultModels = {
            'claude-sonnet-4-20250514': {
                provider: 'anthropic',
                model: 'claude-sonnet-4-20250514',
            },
            'claude-3-haiku-20240229': {
                provider: 'anthropic',
                model: 'claude-3-haiku-20240229',
            },
            'gpt-4o-mini': {
                provider: 'openai',
                model: 'gpt-4o-mini',
            },
            'gpt-5': {
                provider: 'openai',
                model: 'gpt-5',
            },
            'gpt-4o': {
                provider: 'openai',
                model: 'gpt-4o',
            },
            'gpt-4.1': {
                provider: 'openai',
                model: 'gpt-4.1',
            },
            'gpt-4': {
                provider: 'openai',
                model: 'gpt-4',
            },
            'gpt-3.5-turbo': {
                provider: 'openai',
                model: 'gpt-3.5-turbo',
            },
            'gpt-3.5-turbo-16k': {
                provider: 'openai',
                model: 'gpt-3.5-turbo-16k',
            },
            'gemini-pro': {
                provider: 'google',
                model: 'gemini-pro',
            },
            'gemini-1.5-pro': {
                provider: 'google',
                model: 'gemini-1.5-pro',
            },
            'llama3.1:8b': {
                provider: 'ollama',
                model: 'llama3.1:8b',
            },
            'codellama:7b': {
                provider: 'ollama',
                model: 'codellama:7b',
            },
            'mistral:7b': {
                provider: 'ollama',
                model: 'mistral:7b',
            },
        };
        this.defaultConfig = {
            currentModel: 'claude-sonnet-4-20250514',
            temperature: 0.7,
            maxTokens: 12000,
            chatHistory: true,
            maxHistoryLength: 100,
            systemPrompt: undefined,
            autoAnalyzeWorkspace: true,
            enableAutoApprove: false,
            models: this.defaultModels,
            apiKeys: {},
            mcpServers: {},
            maxConcurrentAgents: 3,
            enableGuidanceSystem: true,
            defaultAgentTimeout: 60000,
            logLevel: 'info',
            requireApprovalForNetwork: true,
            approvalPolicy: 'moderate',
            securityMode: 'safe',
            toolApprovalPolicies: {
                fileOperations: 'risky',
                gitOperations: 'risky',
                packageOperations: 'risky',
                systemCommands: 'always',
                networkRequests: 'always',
            },
            sessionSettings: {
                approvalTimeoutMs: 30000,
                devModeTimeoutMs: 3600000,
                batchApprovalEnabled: true,
                autoApproveReadOnly: true,
            },
            sandbox: {
                enabled: true,
                allowFileSystem: true,
                allowNetwork: false,
                allowCommands: true,
            },
            cloudDocs: {
                enabled: true,
                provider: 'supabase',
                autoSync: true,
                contributionMode: true,
                maxContextSize: 50000,
                autoLoadForAgents: true,
                smartSuggestions: true,
            },
        };
        const configDir = path.join(os.homedir(), '.nikcli');
        this.configPath = path.join(configDir, 'config.json');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        this.loadConfig();
    }
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                this.config = { ...this.defaultConfig, ...configData };
            }
            else {
                this.config = { ...this.defaultConfig };
                this.saveConfig();
            }
        }
        catch (error) {
            console.warn(chalk_1.default.yellow('Warning: Failed to load config, using defaults'));
            this.config = { ...this.defaultConfig };
        }
    }
    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        }
        catch (error) {
            console.error(chalk_1.default.red('Error: Failed to save config'), error);
        }
    }
    get(key) {
        return this.config[key];
    }
    set(key, value) {
        this.config[key] = value;
        this.saveConfig();
    }
    getAll() {
        return { ...this.config };
    }
    setAll(newConfig) {
        this.config = { ...newConfig };
        this.saveConfig();
    }
    setApiKey(model, apiKey) {
        if (!this.config.apiKeys) {
            this.config.apiKeys = {};
        }
        this.config.apiKeys[model] = apiKey;
        this.saveConfig();
    }
    getApiKey(model) {
        if (this.config.apiKeys && this.config.apiKeys[model]) {
            return this.config.apiKeys[model];
        }
        const modelConfig = this.config.models[model];
        if (modelConfig) {
            switch (modelConfig.provider) {
                case 'openai':
                    return process.env.OPENAI_API_KEY;
                case 'anthropic':
                    return process.env.ANTHROPIC_API_KEY;
                case 'google':
                    return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
                case 'ollama':
                    return undefined;
            }
        }
        return undefined;
    }
    getCloudDocsApiKeys() {
        if (!this.config || !this.config.cloudDocs) {
            return {
                apiUrl: process.env.SUPABASE_URL,
                apiKey: process.env.SUPABASE_ANON_KEY
            };
        }
        const cloudDocsConfig = this.config.cloudDocs;
        return {
            apiUrl: cloudDocsConfig.apiUrl || process.env.SUPABASE_URL,
            apiKey: cloudDocsConfig.apiKey || process.env.SUPABASE_ANON_KEY
        };
    }
    setCurrentModel(model) {
        if (!this.config.models[model]) {
            throw new Error(`Model ${model} not found in configuration`);
        }
        this.config.currentModel = model;
        this.saveConfig();
    }
    getCurrentModel() {
        return this.config.currentModel;
    }
    addModel(name, config) {
        this.config.models[name] = config;
        this.saveConfig();
    }
    removeModel(name) {
        if (this.config.currentModel === name) {
            throw new Error('Cannot remove the currently active model');
        }
        delete this.config.models[name];
        this.saveConfig();
    }
    listModels() {
        return Object.entries(this.config.models).map(([name, config]) => ({
            name,
            config,
            hasApiKey: !!this.getApiKey(name),
        }));
    }
    validateConfig() {
        try {
            ConfigSchema.parse(this.config);
            return true;
        }
        catch (error) {
            console.error(chalk_1.default.red('Config validation failed:'), error);
            return false;
        }
    }
    reset() {
        this.config = { ...this.defaultConfig };
        this.saveConfig();
    }
    export() {
        return { ...this.config };
    }
    getConfig() {
        return { ...this.config };
    }
    import(config) {
        this.config = { ...this.defaultConfig, ...config };
        this.saveConfig();
    }
}
exports.SimpleConfigManager = SimpleConfigManager;
exports.simpleConfigManager = new SimpleConfigManager();
exports.ConfigManager = SimpleConfigManager;
exports.configManager = exports.simpleConfigManager;
