import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { z } from 'zod';

// Validation schemas
const ModelConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google']),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(8000).optional(),
});

const ConfigSchema = z.object({
  currentModel: z.string(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(8000).default(4000),
  chatHistory: z.boolean().default(true),
  maxHistoryLength: z.number().min(1).max(1000).default(100),
  autoAnalyzeWorkspace: z.boolean().default(true),
  enableAutoApprove: z.boolean().default(false),
  preferredAgent: z.string().optional(),
  models: z.record(ModelConfigSchema),
  apiKeys: z.record(z.string()).optional(),
  // Agent Manager specific config
  maxConcurrentAgents: z.number().min(1).max(10).default(3),
  enableGuidanceSystem: z.boolean().default(true),
  defaultAgentTimeout: z.number().min(1000).default(60000),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  requireApprovalForNetwork: z.boolean().default(true),
  approvalPolicy: z.enum(['strict', 'moderate', 'permissive']).default('moderate'),
  sandbox: z.object({
    enabled: z.boolean().default(true),
    allowFileSystem: z.boolean().default(true),
    allowNetwork: z.boolean().default(false),
    allowCommands: z.boolean().default(true),
  }).default({
    enabled: true,
    allowFileSystem: true,
    allowNetwork: false,
    allowCommands: true,
  }),
});

export type ConfigType = z.infer<typeof ConfigSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type CliConfig = ConfigType;

export class SimpleConfigManager {
  private configPath: string;
  private config!: ConfigType;

  // Default models configuration
  private defaultModels: Record<string, ModelConfig> = {
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
  };

  private defaultConfig: ConfigType = {
    currentModel: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 4000,
    chatHistory: true,
    maxHistoryLength: 100,
    autoAnalyzeWorkspace: true,
    enableAutoApprove: false,
    models: this.defaultModels,
    apiKeys: {},
    maxConcurrentAgents: 3,
    enableGuidanceSystem: true,
    defaultAgentTimeout: 60000,
    logLevel: 'info' as const,
    requireApprovalForNetwork: true,
    approvalPolicy: 'moderate' as const,
    sandbox: {
      enabled: true,
      allowFileSystem: true,
      allowNetwork: false,
      allowCommands: true,
    },
  };

  constructor() {
    // Create config directory in user's home directory
    const configDir = path.join(os.homedir(), '.claude-code-clone');
    this.configPath = path.join(configDir, 'config.json');

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Load or create config
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        // Merge with defaults to ensure all fields exist
        this.config = { ...this.defaultConfig, ...configData };
      } else {
        this.config = { ...this.defaultConfig };
        this.saveConfig();
      }
    } catch (error) {
      console.warn(chalk.yellow('Warning: Failed to load config, using defaults'));
      this.config = { ...this.defaultConfig };
    }
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error(chalk.red('Error: Failed to save config'), error);
    }
  }

  get<K extends keyof ConfigType>(key: K): ConfigType[K] {
    return this.config[key];
  }

  set<K extends keyof ConfigType>(key: K, value: ConfigType[K]): void {
    this.config[key] = value;
    this.saveConfig();
  }

  getAll(): ConfigType {
    return { ...this.config };
  }

  // API Key management
  setApiKey(model: string, apiKey: string): void {
    if (!this.config.apiKeys) {
      this.config.apiKeys = {};
    }
    this.config.apiKeys[model] = apiKey;
    this.saveConfig();
  }

  getApiKey(model: string): string | undefined {
    // First check config file
    if (this.config.apiKeys && this.config.apiKeys[model]) {
      return this.config.apiKeys[model];
    }

    // Then check environment variables
    const modelConfig = this.config.models[model];
    if (modelConfig) {
      switch (modelConfig.provider) {
        case 'openai':
          return process.env.OPENAI_API_KEY;
        case 'anthropic':
          return process.env.ANTHROPIC_API_KEY;
        case 'google':
          return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      }
    }

    return undefined;
  }

  // Model management
  setCurrentModel(model: string): void {
    if (!this.config.models[model]) {
      throw new Error(`Model ${model} not found in configuration`);
    }
    this.config.currentModel = model;
    this.saveConfig();
  }

  getCurrentModel(): string {
    return this.config.currentModel;
  }

  addModel(name: string, config: ModelConfig): void {
    this.config.models[name] = config;
    this.saveConfig();
  }

  removeModel(name: string): void {
    if (this.config.currentModel === name) {
      throw new Error('Cannot remove the currently active model');
    }
    delete this.config.models[name];
    this.saveConfig();
  }

  listModels(): Array<{
    name: string;
    config: ModelConfig;
    hasApiKey: boolean;
  }> {
    return Object.entries(this.config.models).map(([name, config]) => ({
      name,
      config,
      hasApiKey: !!this.getApiKey(name),
    }));
  }

  // Validation
  validateConfig(): boolean {
    try {
      ConfigSchema.parse(this.config);
      return true;
    } catch (error) {
      console.error(chalk.red('Config validation failed:'), error);
      return false;
    }
  }

  // Reset to defaults
  reset(): void {
    this.config = { ...this.defaultConfig };
    this.saveConfig();
  }

  // Export/Import
  export(): ConfigType {
    return { ...this.config };
  }

  getConfig(): ConfigType {
    return { ...this.config };
  }

  import(config: Partial<ConfigType>): void {
    this.config = { ...this.defaultConfig, ...config };
    this.saveConfig();
  }
}

// Create and export singleton instance
export const simpleConfigManager = new SimpleConfigManager();

// Export aliases for compatibility
export const ConfigManager = SimpleConfigManager;
export const configManager = simpleConfigManager;
