"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodingAgent = void 0;
const base_agent_1 = require("./base-agent");
const model_provider_1 = require("../../ai/model-provider");
const chalk_1 = __importDefault(require("chalk"));
const zod_1 = require("zod");
const CodeAnalysisSchema = zod_1.z.object({
    language: zod_1.z.string(),
    complexity: zod_1.z.enum(['low', 'medium', 'high']),
    issues: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['bug', 'performance', 'security', 'style', 'maintainability']),
        severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
        message: zod_1.z.string(),
        line: zod_1.z.number().optional(),
        suggestion: zod_1.z.string().optional(),
    })),
    metrics: zod_1.z.object({
        linesOfCode: zod_1.z.number(),
        functions: zod_1.z.number(),
        complexity: zod_1.z.number(),
    }),
});
const CodeGenerationSchema = zod_1.z.object({
    code: zod_1.z.string(),
    language: zod_1.z.string(),
    explanation: zod_1.z.string(),
    dependencies: zod_1.z.array(zod_1.z.string()).optional(),
    usage: zod_1.z.string().optional(),
    tests: zod_1.z.string().optional(),
});
class CodingAgent extends base_agent_1.BaseAgent {
    constructor(workingDirectory = process.cwd()) {
        super(workingDirectory);
        this.id = 'coding';
        this.capabilities = ["general-coding", "refactoring", "problem-solving"];
        this.specialization = 'General purpose coding assistance';
        this.name = 'coding-agent';
        this.description = 'Advanced coding assistant for analysis, generation, and optimization';
    }
    async onInitialize() {
        console.log('Coding Agent initialized');
    }
    async onStop() {
        console.log('Coding Agent stopped');
    }
    async analyzeCode(code) {
        const messages = [
            {
                role: 'system',
                content: `You are an expert code analyzer. Analyze the provided code and return structured information about:
        - Programming language
        - Code complexity (low/medium/high)
        - Issues found (bugs, performance, security, style, maintainability)
        - Code metrics (lines of code, functions, complexity score)
        
        For each issue, provide:
        - Type and severity
        - Clear message describing the issue  
        - Line number if applicable
        - Suggestion for improvement`,
            },
            {
                role: 'user',
                content: `Analyze this code:\n\n\`\`\`\n${code}\n\`\`\``,
            },
        ];
        try {
            return await model_provider_1.modelProvider.generateStructured({
                messages,
                schema: CodeAnalysisSchema,
                schemaName: 'CodeAnalysis',
                schemaDescription: 'Structured code analysis with issues and metrics',
            });
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error in code analysis: ${error}`));
            return { error: 'Code analysis failed', code };
        }
    }
    async generateCode(description, language = 'typescript') {
        const messages = [
            {
                role: 'system',
                content: `You are an expert ${language} developer. Generate clean, well-documented, production-ready code based on the user's description.
        
        Include:
        - Clean, readable code following best practices
        - Proper error handling
        - Type safety (for TypeScript)
        - Clear explanation of the implementation
        - Required dependencies if any
        - Usage examples
        - Basic tests if applicable`,
            },
            {
                role: 'user',
                content: `Generate ${language} code for: ${description}`,
            },
        ];
        try {
            return await model_provider_1.modelProvider.generateStructured({
                messages,
                schema: CodeGenerationSchema,
                schemaName: 'CodeGeneration',
                schemaDescription: 'Generated code with explanation and metadata',
            });
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error in code generation: ${error}`));
            return { error: 'Code generation failed', description };
        }
    }
    async optimizeCode(code) {
        const messages = [
            {
                role: 'system',
                content: `You are an expert code optimizer. Improve the provided code for:
        - Performance optimization
        - Memory efficiency
        - Readability and maintainability
        - Modern language features
        - Best practices
        
        Provide the optimized code with comments explaining the improvements.`,
            },
            {
                role: 'user',
                content: `Optimize this code:\n\n\`\`\`\n${code}\n\`\`\``,
            },
        ];
        try {
            return await model_provider_1.modelProvider.generateResponse({ messages });
        }
        catch (error) {
            return `Error in code optimization: ${error.message}`;
        }
    }
    async explainCode(code) {
        const messages = [
            {
                role: 'system',
                content: `You are a code explainer. Break down the provided code into clear, understandable explanations:
        - What the code does (high-level purpose)
        - How it works (step-by-step breakdown)
        - Key concepts and patterns used
        - Potential improvements or considerations
        
        Use clear, educational language suitable for developers learning the codebase.`,
            },
            {
                role: 'user',
                content: `Explain this code:\n\n\`\`\`\n${code}\n\`\`\``,
            },
        ];
        try {
            return await model_provider_1.modelProvider.generateResponse({ messages });
        }
        catch (error) {
            return `Error in code explanation: ${error.message}`;
        }
    }
    async debugCode(code, error) {
        const messages = [
            {
                role: 'system',
                content: `You are an expert debugger. Help identify and fix issues in the provided code:
        - Identify potential bugs and errors
        - Suggest fixes with explanations
        - Provide corrected code if needed
        - Explain debugging techniques used`,
            },
            {
                role: 'user',
                content: `Debug this code${error ? ` (Error: ${error})` : ''}:\n\n\`\`\`\n${code}\n\`\`\``,
            },
        ];
        try {
            return await model_provider_1.modelProvider.generateResponse({ messages });
        }
        catch (error) {
            return `Error in debugging: ${error.message}`;
        }
    }
    async generateTests(code, framework = 'jest') {
        const messages = [
            {
                role: 'system',
                content: `You are a testing expert. Generate comprehensive tests for the provided code using ${framework}:
        - Unit tests covering main functionality
        - Edge cases and error conditions
        - Mock external dependencies if needed
        - Clear test descriptions
        - Good test structure and organization`,
            },
            {
                role: 'user',
                content: `Generate ${framework} tests for this code:\n\n\`\`\`\n${code}\n\`\`\``,
            },
        ];
        try {
            return await model_provider_1.modelProvider.generateResponse({ messages });
        }
        catch (error) {
            return `Error in test generation: ${error.message}`;
        }
    }
    async onExecuteTask(task) {
        const taskData = typeof task === 'string' ? task : task.data;
        if (!taskData) {
            return {
                message: 'Coding agent ready! Available commands: analyze, generate, optimize, explain, debug, test',
                capabilities: [
                    'Code analysis with issue detection',
                    'Code generation from descriptions',
                    'Performance optimization',
                    'Code explanation and documentation',
                    'Bug debugging and fixes',
                    'Test generation',
                ],
            };
        }
        // Parse taskData to determine action
        const lowerTask = taskData.toLowerCase();
        if (lowerTask.includes('analyze') || lowerTask.includes('review')) {
            // Extract code from taskData (assume code is in backticks or after "analyze:")
            const codeMatch = taskData.match(/```[\s\S]*?```|analyze:\s*([\s\S]*)/i);
            if (codeMatch) {
                const code = codeMatch[0].replace(/```/g, '').trim();
                return await this.analyzeCode(code);
            }
        }
        if (lowerTask.includes('generate') || lowerTask.includes('create')) {
            const description = taskData.replace(/(generate|create)\s*/i, '');
            return await this.generateCode(description);
        }
        if (lowerTask.includes('optimize') || lowerTask.includes('improve')) {
            const codeMatch = taskData.match(/```[\s\S]*?```|optimize:\s*([\s\S]*)/i);
            if (codeMatch) {
                const code = codeMatch[0].replace(/```/g, '').trim();
                return await this.optimizeCode(code);
            }
        }
        if (lowerTask.includes('explain') || lowerTask.includes('understand')) {
            const codeMatch = taskData.match(/```[\s\S]*?```|explain:\s*([\s\S]*)/i);
            if (codeMatch) {
                const code = codeMatch[0].replace(/```/g, '').trim();
                return await this.explainCode(code);
            }
        }
        if (lowerTask.includes('debug') || lowerTask.includes('fix')) {
            const codeMatch = taskData.match(/```[\s\S]*?```|debug:\s*([\s\S]*)/i);
            if (codeMatch) {
                const code = codeMatch[0].replace(/```/g, '').trim();
                return await this.debugCode(code);
            }
        }
        if (lowerTask.includes('test') || lowerTask.includes('spec')) {
            const codeMatch = taskData.match(/```[\s\S]*?```|test:\s*([\s\S]*)/i);
            if (codeMatch) {
                const code = codeMatch[0].replace(/```/g, '').trim();
                return await this.generateTests(code);
            }
        }
        // Default: treat as a general coding question
        const messages = [
            {
                role: 'system',
                content: `You are an expert coding assistant specializing in TypeScript, JavaScript, and modern web development.
        
Your capabilities include:
        - Writing clean, efficient, and well-documented code
        - Debugging and fixing code issues
        - Code review and optimization suggestions
        - Explaining complex programming concepts
        - Following best practices and modern patterns
        
Always provide clear explanations with your code solutions.`,
            },
            {
                role: 'user',
                content: taskData,
            },
        ];
        try {
            const response = await model_provider_1.modelProvider.generateResponse({ messages });
            return { response, taskData };
        }
        catch (error) {
            return { error: error.message, taskData };
        }
    }
    // Keep legacy methods for backward compatibility
    async run(taskData) {
        return await this.onExecuteTask(taskData);
    }
    async cleanup() {
        return await this.onStop();
    }
}
exports.CodingAgent = CodingAgent;
