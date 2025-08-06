import { generateText } from 'ai';
import { BaseAgent } from './base-agent';
import { google } from '@ai-sdk/google';

export class AIAnalysisAgent extends BaseAgent {
  name = 'ai-analysis';
  description = 'AI-powered code analysis agent using Gemini';

  async initialize(): Promise<void> {
    await super.initialize();
    console.log('AI Analysis Agent initialized successfully');
  }

  async run(task?: string): Promise<any> {
    console.log(`Running AI Analysis Agent`);
    if (task) {
      console.log(`Task: ${task}`);
    }
    
    // Default code to analyze if no task provided
    const codeToAnalyze = task || 'function add(a: number, b: number): number { return a + b; }';
    const prompt = `Analyze this code and provide insights about its functionality, potential improvements, and best practices:\n\n${codeToAnalyze}`;
    
    try {
      const { text } = await generateText({
        model: google('gemini-pro'),
        prompt: prompt,
        maxTokens: 500,
      });
      
      return {
        analysis: text,
        code: codeToAnalyze,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Error in AI analysis:', error);
      return {
        error: error.message,
        code: codeToAnalyze,
        timestamp: new Date().toISOString()
      };
    }
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
    console.log('AI Analysis Agent cleaned up');
  }
}
