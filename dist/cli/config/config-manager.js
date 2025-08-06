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
exports.configManager = exports.ConfigManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const chalk_1 = __importDefault(require("chalk"));
const defaultConfig = {
    currentModel: 'claude-sonnet-4-20250514',
    models: {
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
    },
    systemPrompts: {
        default: 'You are a helpful AI coding assistant. You write clean, efficient, and well-documented code.',
        typescript: 'You are a TypeScript expert. Focus on type safety, modern patterns, and best practices.',
        react: 'You are a React expert. Focus on modern React patterns, hooks, and component design.',
        node: 'You are a Node.js expert. Focus on backend development, APIs, and server-side patterns.',
        fullstack: 'You are a full-stack developer. Consider both frontend and backend implications.',
    },
    chatHistory: true,
    maxHistoryLength: 50,
    temperature: 0.7,
};
class ConfigManager {
    constructor() {
        this.configPath = path.join(os.homedir(), '.ai-coder-cli.json');
        this.config = this.loadConfig();
    }
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                return { ...defaultConfig, ...JSON.parse(data) };
            }
        }
        catch (error) {
            console.log(chalk_1.default.yellow('⚠️ Could not load config, using defaults'));
        }
        return { ...defaultConfig };
    }
    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        }
        catch (error) {
            console.log(chalk_1.default.red('❌ Could not save config'));
        }
    }
    get(key) {
        return this.config[key];
    }
    set(key, value) {
        this.config[key] = value;
        this.saveConfig();
    }
    getCurrentModel() {
        const currentModelName = this.get('currentModel');
        const models = this.get('models');
        return models[currentModelName];
    }
    setCurrentModel(modelName) {
        const models = this.get('models');
        if (!models[modelName]) {
            throw new Error(`Model ${modelName} not found`);
        }
        this.set('currentModel', modelName);
    }
    getAvailableModels() {
        const models = this.get('models');
        return Object.keys(models);
    }
    setApiKey(modelName, apiKey) {
        const models = this.get('models');
        if (!models[modelName]) {
            throw new Error(`Model ${modelName} not found`);
        }
        models[modelName].apiKey = apiKey;
        this.set('models', models);
    }
    getApiKey(modelName) {
        const models = this.get('models');
        const model = models[modelName];
        if (!model) {
            console.log(chalk_1.default.red(`❌ Model ${modelName} not found in config`));
            return undefined;
        }
        // Check model-specific API key first
        if (model.apiKey && model.apiKey.trim() !== '') {
            return model.apiKey;
        }
        // Fall back to environment variables
        let envKey;
        switch (model.provider) {
            case 'openai':
                envKey = process.env.OPENAI_API_KEY;
                break;
            case 'anthropic':
                envKey = process.env.ANTHROPIC_API_KEY;
                break;
            case 'google':
                envKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
                break;
            default:
                return undefined;
        }
        if (envKey && envKey.trim() !== '') {
            return envKey;
        }
        return undefined;
    }
    validateCurrentModel() {
        try {
            const currentModel = this.getCurrentModel();
            const modelName = this.get('currentModel');
            const apiKey = this.getApiKey(modelName);
            if (!apiKey) {
                console.log(chalk_1.default.yellow(`⚠️  No API key found for ${modelName}`));
                console.log(chalk_1.default.gray(`Set it with: ${chalk_1.default.white(`ai-coder set-key ${modelName} YOUR_API_KEY`)}`));
                console.log(chalk_1.default.gray(`Or set environment variable: ${chalk_1.default.white(`${currentModel.provider.toUpperCase()}_API_KEY`)}`));
                return false;
            }
            return true;
        }
        catch (error) {
            console.log(chalk_1.default.red('❌ Invalid model configuration'));
            return false;
        }
    }
    showConfig() {
        console.log(chalk_1.default.blue.bold('\n🔧 Current Configuration:'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        const currentModel = this.get('currentModel');
        const model = this.getCurrentModel();
        console.log(chalk_1.default.green(`Current Model: ${currentModel}`));
        console.log(chalk_1.default.gray(`  Provider: ${model.provider}`));
        console.log(chalk_1.default.gray(`  Model: ${model.model}`));
        console.log(chalk_1.default.gray(`  API Key: ${this.getApiKey(currentModel) ? '✅ Set' : '❌ Not set'}`));
        console.log(chalk_1.default.green(`\nSettings:`));
        console.log(chalk_1.default.gray(`  Chat History: ${this.get('chatHistory') ? 'enabled' : 'disabled'}`));
        console.log(chalk_1.default.gray(`  Max History: ${this.get('maxHistoryLength')}`));
        console.log(chalk_1.default.gray(`  Temperature: ${this.get('temperature')}`));
        console.log(chalk_1.default.green(`\nAvailable Models:`));
        const models = this.get('models');
        Object.entries(models).forEach(([name, config]) => {
            const isCurrent = name === currentModel;
            const hasKey = this.getApiKey(name) !== undefined;
            const status = hasKey ? '✅' : '❌';
            const prefix = isCurrent ? chalk_1.default.yellow('→ ') : '  ';
            console.log(`${prefix}${status} ${name} (${config.provider})`);
        });
    }
    reset() {
        this.config = { ...defaultConfig };
        this.saveConfig();
        console.log(chalk_1.default.green('✅ Configuration reset to defaults'));
    }
    debugApiKeys() {
        console.log(chalk_1.default.blue.bold('\n🔍 API Key Debug Information:'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        const models = this.get('models');
        const currentModel = this.get('currentModel');
        console.log(chalk_1.default.yellow(`Current Model: ${currentModel}`));
        Object.entries(models).forEach(([name, config]) => {
            const isCurrent = name === currentModel;
            const prefix = isCurrent ? chalk_1.default.yellow('→ ') : '  ';
            console.log(`${prefix}${chalk_1.default.cyan(name)} (${config.provider})`);
            // Check stored API key
            const storedKey = config.apiKey;
            if (storedKey) {
                console.log(`    Stored Key: ${chalk_1.default.green('✅')} (${storedKey.substring(0, 8)}...)`);
            }
            else {
                console.log(`    Stored Key: ${chalk_1.default.red('❌ Not set')}`);
            }
            // Check environment variable
            let envVarName = '';
            let envKey = '';
            switch (config.provider) {
                case 'openai':
                    envVarName = 'OPENAI_API_KEY';
                    envKey = process.env.OPENAI_API_KEY || '';
                    break;
                case 'anthropic':
                    envVarName = 'ANTHROPIC_API_KEY';
                    envKey = process.env.ANTHROPIC_API_KEY || '';
                    break;
                case 'google':
                    envVarName = 'GOOGLE_GENERATIVE_AI_API_KEY';
                    envKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
                    break;
            }
            if (envKey) {
                console.log(`    ${envVarName}: ${chalk_1.default.green('✅')} (${envKey.substring(0, 8)}...)`);
            }
            else {
                console.log(`    ${envVarName}: ${chalk_1.default.red('❌ Not set')}`);
            }
            // Show final resolved key
            const resolvedKey = this.getApiKey(name);
            if (resolvedKey) {
                console.log(`    Resolved: ${chalk_1.default.green('✅')} (${resolvedKey.substring(0, 8)}...)`);
            }
            else {
                console.log(`    Resolved: ${chalk_1.default.red('❌ No key available')}`);
            }
            console.log('');
        });
    }
}
exports.ConfigManager = ConfigManager;
exports.configManager = new ConfigManager();
