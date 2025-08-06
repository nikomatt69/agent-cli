import { generateText } from 'ai';
import { BaseAgent } from './base-agent';
import { google } from '@ai-sdk/google';

export class OptimizationAgent extends BaseAgent {
  name = 'optimization';
  description = 'AI-powered code optimization agent using Gemini';

  async initialize(): Promise<void> {
    await super.initialize();
    console.log('Optimization Agent initialized successfully');
  }

  async run(task?: string): Promise<any> {
    console.log(`Running Optimization Agent`);
    if (task) {
      console.log(`Task: ${task}`);
    }

    // Default code to optimize if no task provided
    const codeToOptimize = task || `
function findUser(users, id) {
  for (let i = 0; i < users.length; i++) {
    if (users[i].id === id) {
      return users[i];
    }
  }
  return null;
}`;

    const prompt = `Optimize the following code for better performance, readability, and maintainability. Consider:
- Algorithm efficiency
- Memory usage
- Code readability
- Modern JavaScript/TypeScript features
- Error handling
- Type safety

Code to optimize:
\`\`\`
${codeToOptimize}
\`\`\`

Provide the optimized version with explanations of the improvements made.`;

    try {
      const { text } = await generateText({
        model: google('gemini-pro'),
        prompt: prompt,
        maxTokens: 600,
      });

      return {
        optimization: text,
        originalCode: codeToOptimize,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Error in code optimization:', error);
      return {
        error: error.message,
        originalCode: codeToOptimize,
        timestamp: new Date().toISOString()
      };
    }
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
    console.log('Optimization Agent cleaned up');
  }
}
