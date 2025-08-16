import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { z } from 'zod';

// Validation schemas
const ModelConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'ollama']),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(8000).optional(),
});

const ConfigSchema = z.object({
  currentModel: z.string(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(16000).default(12000),
  chatHistory: z.boolean().default(true),
  maxHistoryLength: z.number().min(1).max(1000).default(100),
  // Optional system prompt for general chat mode
  systemPrompt: z.string().optional(),
  autoAnalyzeWorkspace: z.boolean().default(true),
  enableAutoApprove: z.boolean().default(false),
  preferredAgent: z.string().optional(),
  models: z.record(ModelConfigSchema),
  apiKeys: z.record(z.string()).optional(),
  // OAuth configuration
  oauth: z.object({
    enabled: z.boolean().default(false),
    providers: z.object({
      claude: z.object({
        enabled: z.boolean().default(false),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        redirectUri: z.string().optional(),
        scope: z.string().default('read write'),
        tokenRefreshInterval: z.number().min(300000).max(86400000).default(3600000), // 1 hour
      }).default({
        enabled: false,
        scope: 'read write',
        tokenRefreshInterval: 3600000,
      }),
      openai: z.object({
        enabled: z.boolean().default(false),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        redirectUri: z.string().optional(),
        scope: z.string().default('read write'),
        tokenRefreshInterval: z.number().min(300000).max(86400000).default(3600000), // 1 hour
      }).default({
        enabled: false,
        scope: 'read write',
        tokenRefreshInterval: 3600000,
      }),
    }).default({
      claude: { enabled: false, scope: 'read write', tokenRefreshInterval: 3600000 },
      openai: { enabled: false, scope: 'read write', tokenRefreshInterval: 3600000 },
    }),
    tokens: z.record(z.object({
      access_token: z.string(),
      refresh_token: z.string().optional(),
      expires_in: z.number(),
      token_type: z.string(),
      scope: z.string().optional(),
      expires_at: z.number().optional(),
    })).optional(),
  }).default({
    enabled: false,
    providers: {
      claude: { enabled: false, scope: 'read write', tokenRefreshInterval: 3600000 },
      openai: { enabled: false, scope: 'read write', tokenRefreshInterval: 3600000 },
    },
  }),
  // MCP (Model Context Protocol) servers configuration
  mcpServers: z.record(z.object({
    name: z.string(),
    type: z.enum(['http', 'websocket', 'command', 'stdio']),
    endpoint: z.string().optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    headers: z.record(z.string()).optional(),
    timeout: z.number().optional(),
    retries: z.number().optional(),
    healthCheck: z.string().optional(),
    enabled: z.boolean(),
    priority: z.number().optional(),
    capabilities: z.array(z.string()).optional(),
    authentication: z.object({
      type: z.enum(['bearer', 'basic', 'api_key']),
      token: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      apiKey: z.string().optional(),
      header: z.string().optional(),
    }).optional(),
  })).optional(),
  // Agent Manager specific config
  maxConcurrentAgents: z.number().min(1).max(10).default(3),
  enableGuidanceSystem: z.boolean().default(true),
  defaultAgentTimeout: z.number().min(1000).default(60000),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  requireApprovalForNetwork: z.boolean().default(true),
  approvalPolicy: z.enum(['strict', 'moderate', 'permissive']).default('moderate'),
  // Security configuration for different modes
  securityMode: z.enum(['safe', 'default', 'developer']).default('safe'),
  toolApprovalPolicies: z.object({
    fileOperations: z.enum(['always', 'risky', 'never']).default('risky'),
    gitOperations: z.enum(['always', 'risky', 'never']).default('risky'),
    packageOperations: z.enum(['always', 'risky', 'never']).default('risky'),
    systemCommands: z.enum(['always', 'risky', 'never']).default('always'),
    networkRequests: z.enum(['always', 'risky', 'never']).default('always'),
  }).default({
    fileOperations: 'risky',
    gitOperations: 'risky',
    packageOperations: 'risky',
    systemCommands: 'always',
    networkRequests: 'always',
  }),
  // Session-based settings
  sessionSettings: z.object({
    approvalTimeoutMs: z.number().min(5000).max(300000).default(30000),
    devModeTimeoutMs: z.number().min(60000).max(7200000).default(3600000),
    batchApprovalEnabled: z.boolean().default(true),
    autoApproveReadOnly: z.boolean().default(true),
  }).default({
    approvalTimeoutMs: 30000,
    devModeTimeoutMs: 3600000,
    batchApprovalEnabled: true,
    autoApproveReadOnly: true,
  }),
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
  // Cloud documentation system
  cloudDocs: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(['supabase', 'firebase', 'github']).default('supabase'),
    apiUrl: z.string().optional(),
    apiKey: z.string().optional(),
    autoSync: z.boolean().default(true),
    contributionMode: z.boolean().default(true),
    maxContextSize: z.number().min(10000).max(100000).default(50000),
    autoLoadForAgents: z.boolean().default(true),
    smartSuggestions: z.boolean().default(true),
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
    'gpt-5-mini-2025-08-07': {
      provider: 'openai',
      model: 'gpt-5-mini-2025-08-07',
    },
    'gpt-5-nano-2025-08-07': {
      provider: 'openai',
      model: 'gpt-5-nano-2025-08-07',
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

  private defaultConfig: ConfigType = {
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
    logLevel: 'info' as const,
    requireApprovalForNetwork: true,
    approvalPolicy: 'moderate' as const,
    securityMode: 'safe' as const,
    toolApprovalPolicies: {
      fileOperations: 'risky' as const,
      gitOperations: 'risky' as const,
      packageOperations: 'risky' as const,
      systemCommands: 'always' as const,
      networkRequests: 'always' as const,
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
      provider: 'supabase' as const,
      autoSync: true,
      contributionMode: true,
      maxContextSize: 50000,
      autoLoadForAgents: true,
      smartSuggestions: true,
    },
  };

  constructor() {
    // Create config directory in user's home directory
    const configDir = path.join(os.homedir(), '.nikcli');
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

  setAll(newConfig: ConfigType): void {
    this.config = { ...newConfig };
    this.saveConfig();
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
        case 'ollama':
          return undefined; // Ollama doesn't need API keys
      }
    }

    return undefined;
  }

  // Cloud documentation API keys
  getCloudDocsApiKeys(): { apiUrl?: string; apiKey?: string } {
    // Fallback to environment variables if config not loaded
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

  // OAuth token management
  saveOAuthToken(provider: string, token: any): void {
    if (!this.config.oauth.tokens) {
      this.config.oauth.tokens = {};
    }
    
    // Add expiration timestamp
    const tokenWithExpiry = {
      ...token,
      expires_at: Date.now() + (token.expires_in * 1000)
    };
    
    this.config.oauth.tokens[provider] = tokenWithExpiry;
    this.saveConfig();
  }

  getOAuthToken(provider: string): any | null {
    if (!this.config.oauth.tokens || !this.config.oauth.tokens[provider]) {
      return null;
    }

    const token = this.config.oauth.tokens[provider];
    
    // Check if token is expired
    if (token.expires_at && Date.now() > token.expires_at) {
      // Token is expired, remove it
      delete this.config.oauth.tokens[provider];
      this.saveConfig();
      return null;
    }

    return token;
  }

  removeOAuthToken(provider: string): void {
    if (this.config.oauth.tokens && this.config.oauth.tokens[provider]) {
      delete this.config.oauth.tokens[provider];
      this.saveConfig();
    }
  }

  isOAuthEnabled(provider: string): boolean {
    return this.config.oauth.enabled && 
           this.config.oauth.providers[provider as keyof typeof this.config.oauth.providers]?.enabled;
  }

  enableOAuthProvider(provider: string, config?: any): void {
    this.config.oauth.enabled = true;
    if (config) {
      this.config.oauth.providers[provider as keyof typeof this.config.oauth.providers] = {
        ...this.config.oauth.providers[provider as keyof typeof this.config.oauth.providers],
        ...config,
        enabled: true
      };
    } else {
      this.config.oauth.providers[provider as keyof typeof this.config.oauth.providers].enabled = true;
    }
    this.saveConfig();
  }

  disableOAuthProvider(provider: string): void {
    if (this.config.oauth.providers[provider as keyof typeof this.config.oauth.providers]) {
      this.config.oauth.providers[provider as keyof typeof this.config.oauth.providers].enabled = false;
      this.saveConfig();
    }
  }

  getOAuthProviders(): Array<{ name: string; enabled: boolean; hasToken: boolean }> {
    return Object.entries(this.config.oauth.providers).map(([name, config]) => ({
      name,
      enabled: config.enabled,
      hasToken: !!this.getOAuthToken(name)
    }));
  }
}

// Create and export singleton instance
export const simpleConfigManager = new SimpleConfigManager();

// Export aliases for compatibility
export const ConfigManager = SimpleConfigManager;
export const configManager = simpleConfigManager;