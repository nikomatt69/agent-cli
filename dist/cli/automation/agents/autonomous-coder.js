"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutonomousCoder = void 0;
const base_agent_1 = require("./base-agent");
const model_provider_1 = require("../../ai/model-provider");
const tools_manager_1 = require("../../tools/tools-manager");
const chalk_1 = __importDefault(require("chalk"));
const zod_1 = require("zod");
const CodingTaskSchema = zod_1.z.object({
    tasks: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        type: zod_1.z.enum(['analyze', 'create', 'modify', 'test', 'build', 'debug']),
        description: zod_1.z.string(),
        files: zod_1.z.array(zod_1.z.string()).optional(),
        priority: zod_1.z.enum(['low', 'medium', 'high']),
    })),
    reasoning: zod_1.z.string(),
});
const CodeGenerationSchema = zod_1.z.object({
    files: zod_1.z.array(zod_1.z.object({
        path: zod_1.z.string(),
        content: zod_1.z.string(),
        description: zod_1.z.string(),
    })),
    dependencies: zod_1.z.array(zod_1.z.string()).optional(),
    commands: zod_1.z.array(zod_1.z.string()).optional(),
    explanation: zod_1.z.string(),
});
class AutonomousCoder extends base_agent_1.BaseAgent {
    constructor(workingDirectory = process.cwd()) {
        super(workingDirectory);
        this.id = 'autonomous-coder';
        this.capabilities = ["autonomous-coding", "file-operations", "code-generation", "debugging"];
        this.specialization = 'Autonomous coding with full file system access';
        this.name = 'autonomous-coder';
        this.description = 'Autonomous coding agent that can read, write, and modify files independently';
    }
    async onInitialize() {
        console.log('Autonomous Coder initialized');
    }
    async onStop() {
        console.log('Autonomous Coder stopped');
    }
    async analyzeProject() {
        console.log(chalk_1.default.blue('🔍 Analyzing project structure...'));
        const analysis = await tools_manager_1.toolsManager.analyzeProject();
        const messages = [
            {
                role: 'system',
                content: `You are an expert code analyst. Analyze the project structure and provide insights about:
        - Architecture and design patterns
        - Technologies used and their purposes
        - Potential improvements
        - Code quality observations
        - Recommendations for next steps`,
            },
            {
                role: 'user',
                content: `Analyze this project:
        
Framework: ${analysis.framework || 'Unknown'}
Technologies: ${analysis.technologies.join(', ')}
Structure: ${JSON.stringify(analysis.structure, null, 2)}
Package Info: ${analysis.packageInfo ? JSON.stringify({
                    name: analysis.packageInfo.name,
                    version: analysis.packageInfo.version,
                    scripts: Object.keys(analysis.packageInfo.scripts || {}),
                    dependencies: Object.keys(analysis.packageInfo.dependencies || {}),
                }, null, 2) : 'No package.json found'}`,
            },
        ];
        const analysisResult = await model_provider_1.modelProvider.generateResponse({ messages });
        return {
            projectAnalysis: analysis,
            insights: analysisResult,
        };
    }
    async createFeature(description) {
        console.log(chalk_1.default.blue(`🚀 Creating feature: ${description}`));
        // First analyze the current project
        console.log(chalk_1.default.cyan('📊 Analyzing current project structure...'));
        const projectInfo = await tools_manager_1.toolsManager.analyzeProject();
        // Check if dependencies need to be installed
        const requiredDeps = await this.analyzeRequiredDependencies(description, projectInfo);
        if (requiredDeps.length > 0) {
            console.log(chalk_1.default.yellow(`📦 Installing required dependencies: ${requiredDeps.join(', ')}`));
            for (const dep of requiredDeps) {
                await tools_manager_1.toolsManager.installPackage(dep);
            }
        }
        const messages = [
            {
                role: 'system',
                content: `You are an expert full-stack developer. Create a complete feature implementation based on the user's description.

Current project context:
- Framework: ${projectInfo.framework || 'Unknown'}
- Technologies: ${projectInfo.technologies.join(', ')}

Generate all necessary files including:
- Component files
- API routes (if needed)
- Types/interfaces
- Tests
- Styles (if needed)
- Database schemas (if needed)

Follow the project's existing patterns and conventions.`,
            },
            {
                role: 'user',
                content: `Create this feature: ${description}`,
            },
        ];
        try {
            const result = await model_provider_1.modelProvider.generateStructured({
                messages,
                schema: CodeGenerationSchema,
                schemaName: 'FeatureGeneration',
                schemaDescription: 'Complete feature implementation with all necessary files',
            });
            // Process the generated plan - cast to any to handle unknown type
            const planResult = result;
            // Create the files
            for (const file of planResult.files || []) {
                console.log(chalk_1.default.green(`📝 Creating file: ${file.path}`));
                await tools_manager_1.toolsManager.writeFile(file.path, file.content);
            }
            // Install dependencies if needed
            if (planResult.dependencies && planResult.dependencies.length > 0) {
                console.log(chalk_1.default.blue('📦 Installing dependencies...'));
                for (const dep of planResult.dependencies) {
                    await tools_manager_1.toolsManager.installPackage(dep);
                }
            }
            // Run commands if specified
            if (planResult.commands) {
                for (const command of planResult.commands) {
                    console.log(chalk_1.default.blue(`⚡ Running: ${command}`));
                    const [cmd, ...args] = command.split(' ');
                    await tools_manager_1.toolsManager.runCommand(cmd, args, { stream: true });
                }
            }
            // Automatically run build and tests
            console.log(chalk_1.default.blue('🔨 Building project...'));
            const buildResult = await tools_manager_1.toolsManager.build();
            if (!buildResult.success) {
                console.log(chalk_1.default.yellow('⚠️ Build has errors, attempting to fix...'));
                await this.debugErrors();
            }
            // Run tests if they exist
            console.log(chalk_1.default.blue('🧪 Running tests...'));
            const testResult = await tools_manager_1.toolsManager.runTests();
            if (!testResult.success) {
                console.log(chalk_1.default.yellow('⚠️ Some tests failed, this is normal for new features'));
            }
            console.log(chalk_1.default.green('✅ Feature created successfully!'));
            return {
                success: true,
                filesCreated: planResult.files?.map((f) => f.path) || [],
                dependencies: planResult.dependencies || [],
                commands: planResult.commands || [],
                explanation: planResult.explanation || 'Feature created successfully',
            };
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error creating feature: ${error.message}`));
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async debugErrors() {
        console.log(chalk_1.default.yellow('🐛 Analyzing and fixing errors...'));
        // Run build and collect errors
        const buildResult = await tools_manager_1.toolsManager.build();
        const lintResult = await tools_manager_1.toolsManager.lint();
        const typeResult = await tools_manager_1.toolsManager.typeCheck();
        const allErrors = [
            ...(buildResult.errors || []),
            ...(lintResult.errors || []),
            ...(typeResult.errors || []),
        ];
        if (allErrors.length === 0) {
            console.log(chalk_1.default.green('✅ No errors found!'));
            return { success: true, errorsFixed: 0 };
        }
        console.log(chalk_1.default.red(`Found ${allErrors.length} errors to fix`));
        const fixes = [];
        for (const error of allErrors.slice(0, 10)) { // Limit to first 10 errors
            try {
                const fix = await this.generateErrorFix(error);
                if (fix) {
                    fixes.push(fix);
                    await this.applyFix(fix);
                }
            }
            catch (err) {
                console.log(chalk_1.default.yellow(`⚠️ Could not fix error: ${error.message}`));
            }
        }
        // Re-run checks
        console.log(chalk_1.default.blue('🔄 Re-checking after fixes...'));
        const newBuildResult = await tools_manager_1.toolsManager.build();
        return {
            success: newBuildResult.success,
            originalErrors: allErrors.length,
            errorsFixed: fixes.length,
            fixes,
            remainingErrors: newBuildResult.errors?.length || 0,
        };
    }
    async generateErrorFix(error) {
        const messages = [
            {
                role: 'system',
                content: `You are an expert debugger. Given an error, provide a specific fix.

Return a JSON object with:
{
  "file": "path/to/file",
  "changes": [
    {
      "line": 42,
      "find": "old code",
      "replace": "fixed code"
    }
  ],
  "explanation": "What was wrong and how it was fixed"
}`,
            },
            {
                role: 'user',
                content: `Fix this error:
Type: ${error.type}
Severity: ${error.severity}
Message: ${error.message}
${error.file ? `File: ${error.file}` : ''}
${error.line ? `Line: ${error.line}` : ''}`,
            },
        ];
        try {
            const response = await model_provider_1.modelProvider.generateResponse({ messages });
            return JSON.parse(response);
        }
        catch (error) {
            return null;
        }
    }
    async applyFix(fix) {
        if (!fix.file || !fix.changes)
            return;
        console.log(chalk_1.default.cyan(`🔧 Applying fix to ${fix.file}`));
        try {
            // Read the file first to understand context
            const fileInfo = await tools_manager_1.toolsManager.readFile(fix.file);
            console.log(chalk_1.default.gray(`📄 File has ${fileInfo.content.split('\n').length} lines`));
            await tools_manager_1.toolsManager.editFile(fix.file, fix.changes);
            console.log(chalk_1.default.green(`✅ Fix applied: ${fix.explanation}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Could not apply fix to ${fix.file}`));
        }
    }
    async analyzeRequiredDependencies(description, projectInfo) {
        const messages = [
            {
                role: 'system',
                content: `Analyze the feature description and determine what npm packages are needed.
        
Current project dependencies: ${JSON.stringify(Object.keys(projectInfo.packageInfo?.dependencies || {}))}
        
Return only a JSON array of package names that need to be installed, like: ["lodash", "@types/lodash", "axios"]
Return empty array [] if no new dependencies needed.`,
            },
            {
                role: 'user',
                content: `Feature to implement: ${description}`,
            },
        ];
        try {
            const response = await model_provider_1.modelProvider.generateResponse({ messages });
            const deps = JSON.parse(response.trim());
            return Array.isArray(deps) ? deps : [];
        }
        catch {
            return [];
        }
    }
    async optimizeCode(filePath) {
        console.log(chalk_1.default.blue('⚡ Optimizing code...'));
        const files = filePath ? [filePath] : await tools_manager_1.toolsManager.listFiles('.', /\.(ts|tsx|js|jsx)$/);
        const optimizations = [];
        for (const file of files.slice(0, 5)) { // Limit to first 5 files
            try {
                const fileInfo = await tools_manager_1.toolsManager.readFile(file);
                const optimization = await this.generateOptimization(file, fileInfo.content);
                if (optimization && optimization.optimized) {
                    await tools_manager_1.toolsManager.writeFile(file, optimization.optimized);
                    optimizations.push({
                        file,
                        improvements: optimization.improvements,
                    });
                    console.log(chalk_1.default.green(`✅ Optimized: ${file}`));
                }
            }
            catch (error) {
                console.log(chalk_1.default.yellow(`⚠️ Could not optimize ${file}`));
            }
        }
        return {
            success: true,
            filesOptimized: optimizations.length,
            optimizations,
        };
    }
    async generateOptimization(filePath, content) {
        const messages = [
            {
                role: 'system',
                content: `You are a code optimization expert. Optimize the given code for:
        - Performance improvements
        - Memory efficiency  
        - Code clarity and readability
        - Modern language features
        - Best practices

Return JSON with:
{
  "optimized": "optimized code here",
  "improvements": ["list of improvements made"]
}`,
            },
            {
                role: 'user',
                content: `Optimize this ${path_1.default.extname(filePath)} file:\n\n${content}`,
            },
        ];
        try {
            const response = await model_provider_1.modelProvider.generateResponse({ messages });
            return JSON.parse(response);
        }
        catch (error) {
            return null;
        }
    }
    async runTests(pattern) {
        console.log(chalk_1.default.blue('🧪 Running tests...'));
        const result = await tools_manager_1.toolsManager.runTests(pattern);
        if (result.success) {
            console.log(chalk_1.default.green('✅ All tests passed!'));
        }
        else {
            console.log(chalk_1.default.red('❌ Some tests failed'));
            // Try to fix failing tests
            if (result.errors) {
                for (const error of result.errors) {
                    await this.generateErrorFix(error);
                }
            }
        }
        return result;
    }
    async onExecuteTask(task) {
        const taskData = typeof task === 'string' ? task : task.data;
        if (!taskData) {
            return {
                message: 'Autonomous Coder ready! I can analyze, create, debug, and optimize code independently.',
                capabilities: [
                    'Project analysis and insights',
                    'Feature creation with all necessary files',
                    'Automatic error detection and fixing',
                    'Code optimization and refactoring',
                    'Test execution and maintenance',
                    'Build process management',
                ],
            };
        }
        const lowerTask = taskData.toLowerCase();
        try {
            if (lowerTask.includes('analyze') || lowerTask.includes('overview')) {
                return await this.analyzeProject();
            }
            if (lowerTask.includes('create') || lowerTask.includes('build') || lowerTask.includes('implement')) {
                const description = taskData.replace(/(create|build|implement)\s*/i, '');
                return await this.createFeature(description);
            }
            if (lowerTask.includes('debug') || lowerTask.includes('fix') || lowerTask.includes('errors')) {
                return await this.debugErrors();
            }
            if (lowerTask.includes('optimize') || lowerTask.includes('improve')) {
                const fileMatch = taskData.match(/file:\s*([^\s]+)/);
                const filePath = fileMatch ? fileMatch[1] : undefined;
                return await this.optimizeCode(filePath);
            }
            if (lowerTask.includes('test')) {
                const patternMatch = taskData.match(/pattern:\s*([^\s]+)/);
                const pattern = patternMatch ? patternMatch[1] : undefined;
                return await this.runTests(pattern);
            }
            // Default: treat as a feature creation request
            return await this.createFeature(taskData);
        }
        catch (error) {
            return {
                error: `Autonomous coding failed: ${error.message}`,
                taskData,
            };
        }
    }
}
exports.AutonomousCoder = AutonomousCoder;
const path_1 = __importDefault(require("path"));
