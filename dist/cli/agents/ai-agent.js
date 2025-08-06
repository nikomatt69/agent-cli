"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAnalysisAgent = void 0;
const ai_1 = require("ai");
const base_agent_1 = require("./base-agent");
const google_1 = require("@ai-sdk/google");
class AIAnalysisAgent extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.name = 'ai-analysis';
        this.description = 'AI-powered code analysis agent using Gemini';
    }
    async initialize() {
        await super.initialize();
        console.log('AI Analysis Agent initialized successfully');
    }
    async run(task) {
        console.log(`Running AI Analysis Agent`);
        if (task) {
            console.log(`Task: ${task}`);
        }
        // Default code to analyze if no task provided
        const codeToAnalyze = task || 'function add(a: number, b: number): number { return a + b; }';
        const prompt = `Analyze this code and provide insights about its functionality, potential improvements, and best practices:\n\n${codeToAnalyze}`;
        try {
            const { text } = await (0, ai_1.generateText)({
                model: (0, google_1.google)('gemini-pro'),
                prompt: prompt,
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
    async cleanup() {
        await super.cleanup();
        console.log('AI Analysis Agent cleaned up');
    }
}
exports.AIAnalysisAgent = AIAnalysisAgent;
