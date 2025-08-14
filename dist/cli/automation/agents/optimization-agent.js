"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizationAgent = void 0;
const ai_1 = require("ai");
const base_agent_1 = require("./base-agent");
const google_1 = require("@ai-sdk/google");
class OptimizationAgent extends base_agent_1.BaseAgent {
    constructor(workingDirectory = process.cwd()) {
        super(workingDirectory);
        this.id = 'optimization';
        this.capabilities = ["performance-optimization", "code-analysis", "profiling"];
        this.specialization = 'Performance optimization and analysis';
    }
    async onInitialize() {
        console.log('Optimization Agent initialized successfully');
    }
    async onExecuteTask(task) {
        const taskData = typeof task === 'string' ? task : task.data;
        console.log(`Running Optimization Agent`);
        if (taskData) {
            console.log(`Task: ${taskData}`);
        }
        const codeToOptimize = taskData || `
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
    async onStop() {
        console.log('Optimization Agent cleaned up');
    }
    async run(taskData) {
        return await this.onExecuteTask(taskData);
    }
    async cleanup() {
        return await this.onStop();
    }
}
exports.OptimizationAgent = OptimizationAgent;
