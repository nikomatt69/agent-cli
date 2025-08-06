import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  apiKey?: string;
}

export interface AppConfig {
  currentModel: string;
  models: Record<string, ModelConfig>;
  systemPrompts: Record<string, string>;
  chatHistory: boolean;
  maxHistoryLength: number;
  temperature: number;
}

const defaultConfig: AppConfig = {
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

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), '.ai-coder-cli.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return { ...defaultConfig, ...JSON.parse(data) };
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️ Could not load config, using defaults'));
    }
    return { ...defaultConfig };
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.log(chalk.red('❌ Could not save config'));
    }
  }

  get<T extends keyof AppConfig>(key: T): AppConfig[T] {
    return this.config[key];
  }

  set<T extends keyof AppConfig>(key: T, value: AppConfig[T]): void {
    this.config[key] = value;
    this.saveConfig();
  }

  getCurrentModel(): ModelConfig {
    const currentModelName = this.get('currentModel');
    const models = this.get('models');
    return models[currentModelName];
  }

  setCurrentModel(modelName: string): void {
    const models = this.get('models');
    if (!models[modelName]) {
      throw new Error(`Model ${modelName} not found`);
    }
    this.set('currentModel', modelName);
  }

  getAvailableModels(): string[] {
    const models = this.get('models');
    return Object.keys(models);
  }

  setApiKey(modelName: string, apiKey: string): void {
    const models = this.get('models');
    if (!models[modelName]) {
      throw new Error(`Model ${modelName} not found`);
    }

    models[modelName].apiKey = apiKey;
    this.set('models', models);
  }

  getApiKey(modelName: string): string | undefined {
    const models = this.get('models');
    const model = models[modelName];
    if (!model) {
      console.log(chalk.red(`❌ Model ${modelName} not found in config`));
      return undefined;
    }

    // Check model-specific API key first
    if (model.apiKey && model.apiKey.trim() !== '') {
      return model.apiKey;
    }

    // Fall back to environment variables
    let envKey: string | undefined;
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

  validateCurrentModel(): boolean {
    try {
      const currentModel = this.getCurrentModel();
      const modelName = this.get('currentModel');
      const apiKey = this.getApiKey(modelName);

      if (!apiKey) {
        console.log(chalk.yellow(`⚠️  No API key found for ${modelName}`));
        console.log(chalk.gray(`Set it with: ${chalk.white(`ai-coder set-key ${modelName} YOUR_API_KEY`)}`));
        console.log(chalk.gray(`Or set environment variable: ${chalk.white(`${currentModel.provider.toUpperCase()}_API_KEY`)}`));
        return false;
      }

      return true;
    } catch (error) {
      console.log(chalk.red('❌ Invalid model configuration'));
      return false;
    }
  }

  showConfig(): void {
    console.log(chalk.blue.bold('\n🔧 Current Configuration:'));
    console.log(chalk.gray('─'.repeat(40)));

    const currentModel = this.get('currentModel');
    const model = this.getCurrentModel();

    console.log(chalk.green(`Current Model: ${currentModel}`));
    console.log(chalk.gray(`  Provider: ${model.provider}`));
    console.log(chalk.gray(`  Model: ${model.model}`));
    console.log(chalk.gray(`  API Key: ${this.getApiKey(currentModel) ? '✅ Set' : '❌ Not set'}`));

    console.log(chalk.green(`\nSettings:`));
    console.log(chalk.gray(`  Chat History: ${this.get('chatHistory') ? 'enabled' : 'disabled'}`));
    console.log(chalk.gray(`  Max History: ${this.get('maxHistoryLength')}`));
    console.log(chalk.gray(`  Temperature: ${this.get('temperature')}`));

    console.log(chalk.green(`\nAvailable Models:`));
    const models = this.get('models');
    Object.entries(models).forEach(([name, config]) => {
      const isCurrent = name === currentModel;
      const hasKey = this.getApiKey(name) !== undefined;
      const status = hasKey ? '✅' : '❌';
      const prefix = isCurrent ? chalk.yellow('→ ') : '  ';
      console.log(`${prefix}${status} ${name} (${config.provider})`);
    });
  }

  reset(): void {
    this.config = { ...defaultConfig };
    this.saveConfig();
    console.log(chalk.green('✅ Configuration reset to defaults'));
  }

  debugApiKeys(): void {
    console.log(chalk.blue.bold('\n🔍 API Key Debug Information:'));
    console.log(chalk.gray('─'.repeat(40)));
    
    const models = this.get('models');
    const currentModel = this.get('currentModel');
    
    console.log(chalk.yellow(`Current Model: ${currentModel}`));
    
    Object.entries(models).forEach(([name, config]) => {
      const isCurrent = name === currentModel;
      const prefix = isCurrent ? chalk.yellow('→ ') : '  ';
      
      console.log(`${prefix}${chalk.cyan(name)} (${config.provider})`);
      
      // Check stored API key
      const storedKey = config.apiKey;
      if (storedKey) {
        console.log(`    Stored Key: ${chalk.green('✅')} (${storedKey.substring(0, 8)}...)`);
      } else {
        console.log(`    Stored Key: ${chalk.red('❌ Not set')}`);
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
        console.log(`    ${envVarName}: ${chalk.green('✅')} (${envKey.substring(0, 8)}...)`);
      } else {
        console.log(`    ${envVarName}: ${chalk.red('❌ Not set')}`);
      }
      
      // Show final resolved key
      const resolvedKey = this.getApiKey(name);
      if (resolvedKey) {
        console.log(`    Resolved: ${chalk.green('✅')} (${resolvedKey.substring(0, 8)}...)`);
      } else {
        console.log(`    Resolved: ${chalk.red('❌ No key available')}`);
      }
      
      console.log('');
    });
  }
}

export const configManager = new ConfigManager();