"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeReviewAgent = void 0;
const ai_1 = require("ai");
const base_agent_1 = require("./base-agent");
const google_1 = require("@ai-sdk/google");
class CodeReviewAgent extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.name = 'code-review';
        this.description = 'AI-powered code review agent using Gemini';
    }
    async initialize() {
        await super.initialize();
        console.log('Code Review Agent initialized successfully');
    }
    async run(task) {
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
    async cleanup() {
        await super.cleanup();
        console.log('Code Review Agent cleaned up');
    }
}
exports.CodeReviewAgent = CodeReviewAgent;
