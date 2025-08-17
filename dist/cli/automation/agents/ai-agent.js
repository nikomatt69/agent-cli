"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAnalysisAgent = void 0;
const base_agent_1 = require("./base-agent");
const model_provider_1 = require("../../ai/model-provider");
class AIAnalysisAgent extends base_agent_1.BaseAgent {
    constructor(workingDirectory = process.cwd()) {
        super(workingDirectory);
        this.id = 'ai-analysis';
        this.capabilities = ['code-analysis', 'ai-insights', 'best-practices'];
        this.specialization = 'AI-powered code analysis using Gemini';
        this.name = 'ai-analysis';
        this.description = 'AI-powered code analysis agent using Gemini';
    }
    async onInitialize() {
        console.log('AI Analysis Agent initialized successfully');
    }
    async onExecuteTask(task) {
        const taskData = typeof task === 'string' ? task : task.data;
        console.log(`Running AI Analysis Agent`);
        if (taskData) {
            console.log(`Task: ${taskData}`);
        }
        const codeToAnalyze = taskData || 'function add(a: number, b: number): number { return a + b; }';
        const prompt = `Analyze this code and provide insights about its functionality, potential improvements, and best practices:\n\n${codeToAnalyze}`;
        try {
            const messages = [
                { role: 'user', content: prompt },
            ];
            const text = await model_provider_1.modelProvider.generateResponse({
                messages,
                maxTokens: 500,
            });
            return {
                analysis: text,
                code: codeToAnalyze,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('Error in AI analysis:', error);
            return {
                error: error.message,
                code: codeToAnalyze,
                timestamp: new Date().toISOString()
            };
        }
    }
    async onStop() {
        console.log('AI Analysis Agent cleaned up');
    }
    async run(task) {
        return await this.onExecuteTask(task);
    }
    async cleanup() {
        return await this.onStop();
    }
}
exports.AIAnalysisAgent = AIAnalysisAgent;
