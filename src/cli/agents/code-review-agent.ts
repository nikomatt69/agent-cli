import { generateText } from 'ai';
import { BaseAgent } from './base-agent';
import { google } from '@ai-sdk/google';

export class CodeReviewAgent extends BaseAgent {
  name = 'code-review';
  description = 'AI-powered code review agent using Gemini';

  async initialize(): Promise<void> {
    await super.initialize();
    console.log('Code Review Agent initialized successfully');
  }

  async run(task?: string): Promise<any> {
    console.log(`Running Code Review Agent`);
    if (task) {
      console.log(`Task: ${task}`);
    }
    
    // Default code to review if no task provided
    const codeToReview = task || `
function processUser(user) {
  if (user.name && user.email) {
    return user.name + " - " + user.email;
  }
  return null;
}`;
    
    const prompt = `Perform a comprehensive code review of the following code. Check for:
- Code quality and best practices
- Potential bugs or issues
- Security vulnerabilities
- Performance optimizations
- Type safety improvements
- Documentation needs

Code to review:
\`\`\`
${codeToReview}
\`\`\`

Provide specific suggestions for improvement.`;
    
    try {
      const { text } = await generateText({
        model: google('gemini-pro'),
        prompt: prompt,
        maxTokens: 600,
      });
      
      return {
        review: text,
        code: codeToReview,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Error in code review:', error);
      return {
        error: error.message,
        code: codeToReview,
        timestamp: new Date().toISOString()
      };
    }
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
    console.log('Code Review Agent cleaned up');
  }
}
