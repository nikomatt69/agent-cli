"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizationAgent = void 0;
const ai_1 = require("ai");
const base_agent_1 = require("./base-agent");
const google_1 = require("@ai-sdk/google");
class OptimizationAgent extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.name = 'optimization';
        this.description = 'AI-powered code optimization agent using Gemini';
    }
    async initialize() {
        await super.initialize();
        console.log('Optimization Agent initialized successfully');
    }
    async run(task) {
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
            const { text } = await (0, ai_1.generateText)({
                model: (0, google_1.google)('gemini-pro'),
                prompt: prompt,
                maxTokens: 600,
            });
            return {
                optimization: text,
                originalCode: codeToOptimize,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('Error in code optimization:', error);
            return {
                error: error.message,
                originalCode: codeToOptimize,
                timestamp: new Date().toISOString()
            };
        }
    }
    async cleanup() {
        await super.cleanup();
        console.log('Optimization Agent cleaned up');
    }
}
exports.OptimizationAgent = OptimizationAgent;
