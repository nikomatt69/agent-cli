"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeGeneratorAgent = void 0;
const base_agent_1 = require("./base-agent");
const model_provider_1 = require("../../ai/model-provider");
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
        const generationTask = taskData || 'Create a TypeScript function that validates email addresses';
        const prompt = `Generate clean, well-documented TypeScript code for the following requirement:\n\n${generationTask}\n\nInclude proper types, error handling, and JSDoc comments.`;
        try {
            const messages = [
                { role: 'user', content: prompt },
            ];
            const text = await model_provider_1.modelProvider.generateResponse({
                messages,
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
    async run(taskData) {
        return await this.onExecuteTask(taskData);
    }
    async cleanup() {
        return await this.onStop();
    }
}
exports.CodeGeneratorAgent = CodeGeneratorAgent;
