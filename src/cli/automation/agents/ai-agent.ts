import { generateText } from 'ai';
import { BaseAgent } from './base-agent';
import { google } from '@ai-sdk/google';

export class AIAnalysisAgent extends BaseAgent {
  id = 'ai-analysis';
  capabilities = ['code-analysis', 'ai-insights', 'best-practices'];
  specialization = 'AI-powered code analysis using Gemini';
  name = 'ai-analysis';
  description = 'AI-powered code analysis agent using Gemini';

  constructor(workingDirectory: string = process.cwd()) {
    super(workingDirectory);
  }

  protected async onInitialize(): Promise<void> {
    console.log('AI Analysis Agent initialized successfully');
  }

  protected async onExecuteTask(task: any): Promise<any> {
    const taskData = typeof task === 'string' ? task : task.data;
    console.log(`Running AI Analysis Agent`);
    if (taskData) {
      console.log(`Task: ${taskData}`);
    }
    
    // Default code to analyze if no task provided
    const codeToAnalyze = taskData || 'function add(a: number, b: number): number { return a + b; }';
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

  protected async onStop(): Promise<void> {
    console.log('AI Analysis Agent cleaned up');
  }

  // Keep legacy methods for backward compatibility
  async run(task?: string): Promise<any> {
    return await this.onExecuteTask(task);
  }

  async cleanup(): Promise<void> {
    return await this.onStop();
  }
}
