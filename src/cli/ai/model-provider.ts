import { generateText, generateObject, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
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
    const apiKey = configManager.getApiKey(currentModelName);

    if (!apiKey) {
      throw new Error(`API key not found for model: ${currentModelName}. Use /set-key command to configure API keys`);
    }

    switch (config.provider) {
      case 'openai':
        const openaiProvider = createOpenAI({ apiKey });
        return openaiProvider(config.model);
      case 'anthropic':
        const anthropicProvider = createAnthropic({ apiKey });
        return anthropicProvider(config.model);
      case 'google':
        const googleProvider = createGoogleGenerativeAI({ apiKey });
        return googleProvider(config.model);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  async generateResponse(options: GenerateOptions): Promise<string> {
    const currentModel = configManager.getCurrentModel();
    const model = this.getModel(currentModel as any);

    const { text } = await generateText({
      model,
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
    const currentModel = configManager.getCurrentModel();
    const model = this.getModel(currentModel as any);

    const result = await streamText({
      model,
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
    const currentModel = configManager.getCurrentModel();
    const model = this.getModel(currentModel as any);

    const { object } = await generateObject({
      model,
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
    return {
      name: configManager.get('currentModel'),
      config: {},
    };
  }
}

export const modelProvider = new ModelProvider();