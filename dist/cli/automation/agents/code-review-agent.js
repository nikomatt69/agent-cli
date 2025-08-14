"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeReviewAgent = void 0;
const ai_1 = require("ai");
const base_agent_1 = require("./base-agent");
const google_1 = require("@ai-sdk/google");
class CodeReviewAgent extends base_agent_1.BaseAgent {
    constructor(workingDirectory = process.cwd()) {
        super(workingDirectory);
        this.id = 'code-review';
        this.capabilities = ["code-review", "quality-analysis", "best-practices"];
        this.specialization = 'Code review and quality analysis';
    }
    async onInitialize() {
        console.log('Code Review Agent initialized successfully');
    }
    async onExecuteTask(task) {
        const taskData = typeof task === 'string' ? task : task.data;
        console.log(`Running Code Review Agent`);
        if (taskData) {
            console.log(`Task: ${taskData}`);
        }
        const codeToReview = taskData || `
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
            const { text } = await (0, ai_1.generateText)({
                model: (0, google_1.google)('gemini-pro'),
                prompt: prompt,
                maxTokens: 600,
            });
            return {
                review: text,
                code: codeToReview,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('Error in code review:', error);
            return {
                error: error.message,
                code: codeToReview,
                timestamp: new Date().toISOString()
            };
        }
    }
    async onStop() {
        console.log('Code Review Agent cleaned up');
    }
    async run(taskData) {
        return await this.onExecuteTask(taskData);
    }
    async cleanup() {
        return await this.onStop();
    }
}
exports.CodeReviewAgent = CodeReviewAgent;
