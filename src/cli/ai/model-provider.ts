import { generateText, generateObject, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider';
import { ModelConfig, configManager } from '../core/config-manager';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface GenerateOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export class ModelProvider {
  private getModel(config: ModelConfig) {
    const currentModelName = configManager.get('currentModel');

    switch (config.provider) {
      case 'openai': {
        const apiKey = configManager.getApiKey(currentModelName);
        if (!apiKey) {
          throw new Error(`API key not found for model: ${currentModelName} (OpenAI). Use /set-key to configure.`);
        }
        const openaiProvider = createOpenAI({ apiKey });
        return openaiProvider(config.model);
      }
      case 'anthropic': {
        const apiKey = configManager.getApiKey(currentModelName);
        if (!apiKey) {
          throw new Error(`API key not found for model: ${currentModelName} (Anthropic). Use /set-key to configure.`);
        }
        const anthropicProvider = createAnthropic({ apiKey });
        return anthropicProvider(config.model);
      }
      case 'google': {
        const apiKey = configManager.getApiKey(currentModelName);
        if (!apiKey) {
          throw new Error(`API key not found for model: ${currentModelName} (Google). Use /set-key to configure.`);
        }
        const googleProvider = createGoogleGenerativeAI({ apiKey });
        return googleProvider(config.model);
      }
      case 'ollama': {
        // Ollama does not require API keys; assumes local daemon at default endpoint
        const ollamaProvider = createOllama({});
        return ollamaProvider(config.model);
      }
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  async generateResponse(options: GenerateOptions): Promise<string> {
    const currentModelName = configManager.getCurrentModel();
    const models = configManager.get('models');
    const currentModelConfig = models[currentModelName];

    if (!currentModelConfig) {
      throw new Error(`Model configuration not found for: ${currentModelName}`);
    }

    const model = this.getModel(currentModelConfig);

    const { text } = await generateText({
      model: model as any,
      messages: options.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options.temperature ?? configManager.get('temperature'),
      maxTokens: options.maxTokens ?? 4000,
    });

    return text;
  }

  async *streamResponse(options: GenerateOptions): AsyncGenerator<string, void, unknown> {
    const currentModelName = configManager.getCurrentModel();
    const models = configManager.get('models');
    const currentModelConfig = models[currentModelName];

    if (!currentModelConfig) {
      throw new Error(`Model configuration not found for: ${currentModelName}`);
    }

    const model = this.getModel(currentModelConfig);

    const result = await streamText({
      model: model as any,
      messages: options.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options.temperature ?? configManager.get('temperature'),
      maxTokens: options.maxTokens ?? 4000,
    });

    for await (const delta of result.textStream) {
      yield delta;
    }
  }

  async generateStructured<T>(
    options: GenerateOptions & {
      schema: any;
      schemaName?: string;
      schemaDescription?: string;
    }
  ): Promise<T> {
    const currentModelName = configManager.getCurrentModel();
    const models = configManager.get('models');
    const currentModelConfig = models[currentModelName];

    if (!currentModelConfig) {
      throw new Error(`Model configuration not found for: ${currentModelName}`);
    }

    const model = this.getModel(currentModelConfig);

    const { object } = await generateObject({
      model: model as any,
      messages: options.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      schema: options.schema,
      schemaName: options.schemaName,
      schemaDescription: options.schemaDescription,
      temperature: options.temperature ?? configManager.get('temperature'),
    });

    return object as T;
  }

  validateApiKey(): boolean {
    return configManager.validateConfig();
  }

  getCurrentModelInfo(): { name: string; config: ModelConfig } {
    const name = configManager.get('currentModel');
    const models = configManager.get('models');
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

export const modelProvider = new ModelProvider();