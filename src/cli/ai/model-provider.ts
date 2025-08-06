import { generateText, generateObject, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { ModelConfig, configManager } from '../config/config-manager';

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
    const apiKey = configManager.getApiKey(configManager.get('currentModel'));
    
    switch (config.provider) {
      case 'openai':
        return openai(config.model);
      case 'anthropic':
        return anthropic(config.model);
      case 'google':
        return google(config.model);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  async generateResponse(options: GenerateOptions): Promise<string> {
    const currentModel = configManager.getCurrentModel();
    const model = this.getModel(currentModel);

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
    const model = this.getModel(currentModel);

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
    const model = this.getModel(currentModel);

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
    return configManager.validateCurrentModel();
  }

  getCurrentModelInfo(): { name: string; config: ModelConfig } {
    return {
      name: configManager.get('currentModel'),
      config: configManager.getCurrentModel(),
    };
  }
}

export const modelProvider = new ModelProvider();