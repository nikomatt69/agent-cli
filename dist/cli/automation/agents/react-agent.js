"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactAgent = void 0;
const base_agent_1 = require("./base-agent");
const model_provider_1 = require("../../ai/model-provider");
const tools_manager_1 = require("../../tools/tools-manager");
const chalk_1 = __importDefault(require("chalk"));
class ReactAgent extends base_agent_1.BaseAgent {
    constructor(workingDirectory = process.cwd()) {
        super(workingDirectory);
        this.id = 'react';
        this.capabilities = ["react", "jsx", "frontend", "components"];
        this.specialization = 'React and frontend development';
    }
    async onInitialize() {
        console.log('React Agent initialized');
    }
    async onStop() {
        console.log('React Agent stopped');
    }
    async onExecuteTask(task) {
        const taskData = typeof task === 'string' ? task : task.data;
        if (!taskData) {
            return {
                message: 'React Expert ready! I can help with components, hooks, state management, and Next.js',
                specialties: [
                    'React components and JSX with automatic file creation',
                    'Custom hooks and state management setup',
                    'Next.js routing and SSR/SSG with project analysis',
                    'Performance optimization with code review',
                    'TypeScript integration with automatic type checking',
                    'Testing with React Testing Library setup',
                    'Automatic dependency installation and project setup',
                ],
            };
        }
        try {
            console.log(chalk_1.default.cyan('📊 Analyzing React/Next.js project...'));
            const projectInfo = await tools_manager_1.toolsManager.analyzeProject();
            const isReactProject = projectInfo.framework === 'React' || projectInfo.framework === 'Next.js' ||
                projectInfo.technologies.some(tech => tech.includes('React') || tech.includes('Next'));
            if (!isReactProject) {
                console.log(chalk_1.default.yellow('⚠️ This doesn\'t appear to be a React project. Setting up React environment...'));
                const reactDeps = ['react', '@types/react'];
                if (projectInfo.framework !== 'Next.js') {
                    reactDeps.push('react-dom', '@types/react-dom');
                }
                for (const dep of reactDeps) {
                    await tools_manager_1.toolsManager.installPackage(dep);
                }
            }
            const messages = [
                {
                    role: 'system',
                    content: `You are a React/Next.js expert developer who can create files, install dependencies, and set up complete React solutions.

Current Project Context:
- Framework: ${projectInfo.framework || 'Generic'}
- Technologies: ${projectInfo.technologies.join(', ')}
- Has React: ${isReactProject ? 'Yes' : 'Newly added'}

You have access to tools to:
- Create and modify files automatically
- Install npm packages
- Run build commands
- Set up project structure

When creating React components or features:
1. Determine what files need to be created
2. Check if additional dependencies are needed
3. Create the files with proper TypeScript types
4. Follow modern React patterns (hooks, functional components)
5. Include proper imports and exports
6. Add basic tests if appropriate

Always provide complete, working solutions with:
- Clean, type-safe code
- Modern React patterns
- Performance considerations
- Accessibility best practices
- Proper file structure`,
                },
                {
                    role: 'user',
                    content: taskData,
                },
            ];
            const response = await model_provider_1.modelProvider.generateResponse({ messages });
            await this.processReactResponse(response, taskData);
            return {
                response,
                taskData,
                agent: 'React Expert',
                projectAnalyzed: true,
                frameworkDetected: projectInfo.framework,
            };
        }
        catch (error) {
            return { error: error.message, taskData, agent: 'React Expert' };
        }
    }
    async processReactResponse(response, originalTask) {
        const fileMatches = response.match(/```[\w]*\n([\s\S]*?)\n```/g);
        if (fileMatches && originalTask.toLowerCase().includes('create')) {
            console.log(chalk_1.default.blue('🚀 Creating React files based on response...'));
            for (let i = 0; i < fileMatches.length; i++) {
                const codeBlock = fileMatches[i];
                const code = codeBlock.replace(/```[\w]*\n/, '').replace(/\n```$/, '');
                let filename = this.extractFilename(response, codeBlock) || `component-${i + 1}.tsx`;
                if (!filename.includes('/')) {
                    filename = `src/components/${filename}`;
                }
                try {
                    await tools_manager_1.toolsManager.writeFile(filename, code);
                    console.log(chalk_1.default.green(`✅ Created React file: ${filename}`));
                }
                catch (error) {
                    console.log(chalk_1.default.yellow(`⚠️ Could not create file: ${filename}`));
                }
            }
            console.log(chalk_1.default.blue('🔍 Running TypeScript type check...'));
            const typeResult = await tools_manager_1.toolsManager.typeCheck();
            if (!typeResult.success) {
                console.log(chalk_1.default.yellow('⚠️ Type errors detected, this is normal for new components'));
            }
        }
    }
    extractFilename(response, codeBlock) {
        const lines = response.split('\n');
        const codeIndex = lines.findIndex(line => line.includes(codeBlock.split('\n')[0]));
        for (let i = Math.max(0, codeIndex - 5); i < codeIndex; i++) {
            const line = lines[i];
            const filenameMatch = line.match(/([a-zA-Z][a-zA-Z0-9-_]*\.(tsx?|jsx?))/);
            if (filenameMatch) {
                return filenameMatch[1];
            }
        }
        const componentMatch = codeBlock.match(/(?:export\s+(?:default\s+)?(?:function|const)\s+|class\s+)([A-Z][a-zA-Z0-9]*)/);
        if (componentMatch) {
            return `${componentMatch[1]}.tsx`;
        }
        return null;
    }
    async run(taskData) {
        return await this.onExecuteTask(taskData);
    }
    async cleanup() {
        return await this.onStop();
    }
}
exports.ReactAgent = ReactAgent;
