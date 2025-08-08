"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeGeneratorAgent = void 0;
const ai_1 = require("ai");
const base_agent_1 = require("./base-agent");
const google_1 = require("@ai-sdk/google");
class CodeGeneratorAgent extends base_agent_1.BaseAgent {
    constructor(workingDirectory = process.cwd()) {
        super(workingDirectory);
        this.id = 'code-generator';
        this.capabilities = ["code-generation", "template-creation", "scaffolding"];
        this.specialization = 'Code generation and template creation';
        this.name = 'code-generator';
        this.description = 'Code generation and template creation';
    }
    async onInitialize() {
        console.log('Code Generator Agent initialized successfully');
    }
    async onExecuteTask(task) {
        const taskData = typeof task === 'string' ? task : task.data;
        console.log(`Running Code Generator Agent`);
        if (taskData) {
            console.log(`Task: ${taskData}`);
        }
        // Default taskData if none provided
        const generationTask = taskData || 'Create a TypeScript function that validates email addresses';
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
    async onStop() {
        console.log('Code Generator Agent cleaned up');
    }
    // Keep legacy methods for backward compatibility
    async run(taskData) {
        return await this.onExecuteTask(taskData);
    }
    async cleanup() {
        return await this.onStop();
    }
}
exports.CodeGeneratorAgent = CodeGeneratorAgent;
