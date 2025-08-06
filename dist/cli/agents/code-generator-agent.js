"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeGeneratorAgent = void 0;
const ai_1 = require("ai");
const base_agent_1 = require("./base-agent");
const google_1 = require("@ai-sdk/google");
class CodeGeneratorAgent extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.name = 'code-generator';
        this.description = 'AI-powered code generation agent using Gemini';
    }
    async initialize() {
        await super.initialize();
        console.log('Code Generator Agent initialized successfully');
    }
    async run(task) {
        console.log(`Running Code Generator Agent`);
        if (task) {
            console.log(`Task: ${task}`);
        }
        // Default task if none provided
        const generationTask = task || 'Create a TypeScript function that validates email addresses';
        const prompt = `Generate clean, well-documented TypeScript code for the following requirement:\n\n${generationTask}\n\nInclude proper types, error handling, and JSDoc comments.`;
        try {
            const { text } = await (0, ai_1.generateText)({
                model: (0, google_1.google)('gemini-2.5-flash'),
                prompt: prompt,
                maxTokens: 800,
            });
            return {
                generatedCode: text,
                task: generationTask,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('Error in code generation:', error);
            return {
                error: error.message,
                task: generationTask,
                timestamp: new Date().toISOString()
            };
        }
    }
    async cleanup() {
        await super.cleanup();
        console.log('Code Generator Agent cleaned up');
    }
}
exports.CodeGeneratorAgent = CodeGeneratorAgent;
