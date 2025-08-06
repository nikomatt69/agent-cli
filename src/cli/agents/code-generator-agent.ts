import { generateText } from 'ai';
import { BaseAgent } from './base-agent';
import { google } from '@ai-sdk/google';

export class CodeGeneratorAgent extends BaseAgent {
  name = 'code-generator';
  description = 'AI-powered code generation agent using Gemini';

  async initialize(): Promise<void> {
    await super.initialize();
    console.log('Code Generator Agent initialized successfully');
  }

  async run(task?: string): Promise<any> {
    console.log(`Running Code Generator Agent`);
    if (task) {
      console.log(`Task: ${task}`);
    }

    // Default task if none provided
    const generationTask = task || 'Create a TypeScript function that validates email addresses';
    const prompt = `Generate clean, well-documented TypeScript code for the following requirement:\n\n${generationTask}\n\nInclude proper types, error handling, and JSDoc comments.`;

    try {
      const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        prompt: prompt,
        maxTokens: 800,
      });

      return {
        generatedCode: text,
        task: generationTask,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Error in code generation:', error);
      return {
        error: error.message,
        task: generationTask,
        timestamp: new Date().toISOString()
      };
    }
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
    console.log('Code Generator Agent cleaned up');
  }
}
