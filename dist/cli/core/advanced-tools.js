"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedTools = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
const util_1 = require("util");
const chalk_1 = __importDefault(require("chalk"));
const openai_1 = require("@ai-sdk/openai");
const anthropic_1 = require("@ai-sdk/anthropic");
const config_manager_1 = require("./config-manager");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class AdvancedTools {
    getModel() {
        const currentModelName = config_manager_1.configManager.get('currentModel');
        const models = config_manager_1.configManager.get('models');
        const configData = models[currentModelName];
        if (!configData) {
            throw new Error(`Model configuration not found for: ${currentModelName}`);
        }
        switch (configData.provider) {
            case 'openai': {
                const apiKey = config_manager_1.configManager.getApiKey(currentModelName);
                if (!apiKey)
                    throw new Error(`No API key found for model ${currentModelName} (OpenAI)`);
                const openaiProvider = (0, openai_1.createOpenAI)({ apiKey });
                return openaiProvider(configData.model);
            }
            case 'anthropic': {
                const apiKey = config_manager_1.configManager.getApiKey(currentModelName);
                if (!apiKey)
                    throw new Error(`No API key found for model ${currentModelName} (Anthropic)`);
                const anthropicProvider = (0, anthropic_1.createAnthropic)({ apiKey });
                return anthropicProvider(configData.model);
            }
            default:
                throw new Error(`Unsupported provider: ${configData.provider}`);
        }
    }
    getEmbeddingModel() {
        const apiKey = config_manager_1.configManager.getApiKey('gpt-4o-mini') || config_manager_1.configManager.getApiKey('claude-sonnet-4-20250514');
        if (!apiKey)
            throw new Error('No API key found for embeddings');
        const openaiProvider = (0, openai_1.createOpenAI)({ apiKey });
        return openaiProvider('text-embedding-3-small');
    }
    getSemanticSearchTool() {
        return (0, ai_1.tool)({
            description: 'Search for semantically similar content in the codebase using embeddings',
            parameters: zod_1.z.object({
                query: zod_1.z.string().describe('Search query to find similar content'),
                searchPath: zod_1.z.string().default('.').describe('Path to search in'),
                fileTypes: zod_1.z.array(zod_1.z.string()).default(['.ts', '.js', '.tsx', '.jsx']).describe('File types to search'),
                maxResults: zod_1.z.number().default(5).describe('Maximum number of results')
            }),
            execute: async ({ query, searchPath, fileTypes, maxResults }) => {
                try {
                    console.log(chalk_1.default.blue(`🔍 Semantic search for: "${query}"`));
                    const queryEmbedding = await (0, ai_1.embed)({
                        model: this.getEmbeddingModel(),
                        value: query
                    });
                    const files = this.findFiles(searchPath, fileTypes);
                    const results = [];
                    for (const file of files.slice(0, 20)) {
                        try {
                            const content = (0, fs_1.readFileSync)(file, 'utf-8');
                            const fileEmbedding = await (0, ai_1.embed)({
                                model: this.getEmbeddingModel(),
                                value: content.substring(0, 1000)
                            });
                            const similarity = (0, ai_1.cosineSimilarity)(queryEmbedding.embedding, fileEmbedding.embedding);
                            results.push({
                                file,
                                similarity,
                                content: content.substring(0, 200) + '...'
                            });
                        }
                        catch (error) {
                        }
                    }
                    const topResults = results
                        .sort((a, b) => b.similarity - a.similarity)
                        .slice(0, maxResults);
                    return {
                        query,
                        results: topResults,
                        totalFiles: files.length,
                        searchTime: new Date().toISOString()
                    };
                }
                catch (error) {
                    return {
                        error: `Semantic search failed: ${error.message}`,
                        query
                    };
                }
            }
        });
    }
    getCodeAnalysisTool() {
        return (0, ai_1.tool)({
            description: 'Analyze code quality, patterns, and provide improvement suggestions',
            parameters: zod_1.z.object({
                filePath: zod_1.z.string().describe('Path to the file to analyze'),
                analysisType: zod_1.z.enum(['quality', 'patterns', 'security', 'performance']).default('quality').describe('Type of analysis to perform')
            }),
            execute: async ({ filePath, analysisType }) => {
                try {
                    console.log(chalk_1.default.blue(`🔍 Analyzing code: ${filePath} (${analysisType})`));
                    if (!(0, fs_1.existsSync)(filePath)) {
                        return { error: `File not found: ${filePath}` };
                    }
                    const content = (0, fs_1.readFileSync)(filePath, 'utf-8');
                    const extension = (0, path_1.extname)(filePath);
                    const analysis = await (0, ai_1.generateObject)({
                        model: this.getModel(),
                        schema: zod_1.z.object({
                            quality: zod_1.z.object({
                                score: zod_1.z.number().min(0).max(100),
                                issues: zod_1.z.array(zod_1.z.string()),
                                suggestions: zod_1.z.array(zod_1.z.string())
                            }),
                            patterns: zod_1.z.object({
                                detected: zod_1.z.array(zod_1.z.string()),
                                recommendations: zod_1.z.array(zod_1.z.string())
                            }),
                            complexity: zod_1.z.object({
                                cyclomatic: zod_1.z.number(),
                                cognitive: zod_1.z.number(),
                                halstead: zod_1.z.object({
                                    volume: zod_1.z.number(),
                                    difficulty: zod_1.z.number(),
                                    effort: zod_1.z.number()
                                })
                            })
                        }),
                        prompt: `Analyze this ${extension} code for ${analysisType}:

\`\`\`${extension}
${content}
\`\`\`

Provide detailed analysis including:
1. Code quality score and issues
2. Detected patterns and recommendations  
3. Complexity metrics
4. Specific improvement suggestions`
                    });
                    return {
                        filePath,
                        analysisType,
                        analysis: analysis.object,
                        timestamp: new Date().toISOString()
                    };
                }
                catch (error) {
                    return {
                        error: `Code analysis failed: ${error.message}`,
                        filePath,
                        analysisType
                    };
                }
            }
        });
    }
    getDependencyAnalysisTool() {
        return (0, ai_1.tool)({
            description: 'Analyze project dependencies, security vulnerabilities, and optimization opportunities',
            parameters: zod_1.z.object({
                includeDevDeps: zod_1.z.boolean().default(true).describe('Include dev dependencies in analysis'),
                checkSecurity: zod_1.z.boolean().default(true).describe('Check for security vulnerabilities'),
                suggestOptimizations: zod_1.z.boolean().default(true).describe('Suggest dependency optimizations')
            }),
            execute: async ({ includeDevDeps, checkSecurity, suggestOptimizations }) => {
                try {
                    console.log(chalk_1.default.blue('📦 Analyzing project dependencies...'));
                    if (!(0, fs_1.existsSync)('package.json')) {
                        return { error: 'No package.json found in current directory' };
                    }
                    const packageJson = JSON.parse((0, fs_1.readFileSync)('package.json', 'utf-8'));
                    const analysis = await (0, ai_1.generateObject)({
                        model: this.getModel(),
                        schema: zod_1.z.object({
                            summary: zod_1.z.object({
                                totalDeps: zod_1.z.number(),
                                prodDeps: zod_1.z.number(),
                                devDeps: zod_1.z.number(),
                                outdatedCount: zod_1.z.number(),
                                securityIssues: zod_1.z.number()
                            }),
                            recommendations: zod_1.z.array(zod_1.z.object({
                                type: zod_1.z.enum(['security', 'performance', 'maintenance', 'optimization']),
                                priority: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
                                description: zod_1.z.string(),
                                action: zod_1.z.string()
                            })),
                            outdated: zod_1.z.array(zod_1.z.object({
                                package: zod_1.z.string(),
                                current: zod_1.z.string(),
                                latest: zod_1.z.string(),
                                type: zod_1.z.enum(['patch', 'minor', 'major'])
                            }))
                        }),
                        prompt: `Analyze this package.json for dependency management:

\`\`\`json
${JSON.stringify(packageJson, null, 2)}
\`\`\`

Provide:
1. Summary of dependencies
2. Security and optimization recommendations
3. List of outdated packages
4. Specific actions to improve dependency management`
                    });
                    return {
                        analysis: analysis.object,
                        packageJson: {
                            name: packageJson.name,
                            version: packageJson.version,
                            dependencies: Object.keys(packageJson.dependencies || {}).length,
                            devDependencies: Object.keys(packageJson.devDependencies || {}).length
                        },
                        timestamp: new Date().toISOString()
                    };
                }
                catch (error) {
                    return {
                        error: `Dependency analysis failed: ${error.message}`
                    };
                }
            }
        });
    }
    getGitWorkflowTool() {
        return (0, ai_1.tool)({
            description: 'Analyze Git repository, commit patterns, and suggest workflow improvements',
            parameters: zod_1.z.object({
                analyzeCommits: zod_1.z.boolean().default(true).describe('Analyze recent commit patterns'),
                checkBranching: zod_1.z.boolean().default(true).describe('Check branching strategy'),
                suggestWorkflow: zod_1.z.boolean().default(true).describe('Suggest workflow improvements')
            }),
            execute: async ({ analyzeCommits, checkBranching, suggestWorkflow }) => {
                try {
                    console.log(chalk_1.default.blue('📊 Analyzing Git workflow...'));
                    const { stdout: branch } = await execAsync('git branch --show-current');
                    const { stdout: status } = await execAsync('git status --porcelain');
                    const { stdout: recentCommits } = await execAsync('git log --oneline -10');
                    const { stdout: allBranches } = await execAsync('git branch -a');
                    const analysis = await (0, ai_1.generateObject)({
                        model: this.getModel(),
                        schema: zod_1.z.object({
                            currentState: zod_1.z.object({
                                branch: zod_1.z.string(),
                                hasChanges: zod_1.z.boolean(),
                                changeCount: zod_1.z.number(),
                                lastCommit: zod_1.z.string()
                            }),
                            workflow: zod_1.z.object({
                                score: zod_1.z.number().min(0).max(100),
                                issues: zod_1.z.array(zod_1.z.string()),
                                suggestions: zod_1.z.array(zod_1.z.string())
                            }),
                            recommendations: zod_1.z.array(zod_1.z.object({
                                category: zod_1.z.enum(['branching', 'commits', 'workflow', 'collaboration']),
                                priority: zod_1.z.enum(['low', 'medium', 'high']),
                                description: zod_1.z.string(),
                                action: zod_1.z.string()
                            }))
                        }),
                        prompt: `Analyze this Git repository state and suggest improvements:

**Current Branch**: ${branch.trim()}
**Status**: ${status.trim() || 'Clean'}
**Recent Commits**:
${recentCommits}
**All Branches**:
${allBranches}

Provide:
1. Current repository state analysis
2. Workflow quality score and issues
3. Specific recommendations for improvement
4. Best practices for this type of project`
                    });
                    return {
                        analysis: analysis.object,
                        gitInfo: {
                            branch: branch.trim(),
                            hasChanges: status.trim().length > 0,
                            changeCount: status.split('\n').filter(line => line.trim()).length
                        },
                        timestamp: new Date().toISOString()
                    };
                }
                catch (error) {
                    return {
                        error: `Git workflow analysis failed: ${error.message}`
                    };
                }
            }
        });
    }
    findFiles(dir, extensions) {
        const files = [];
        try {
            const items = (0, fs_1.readdirSync)(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = (0, path_1.join)(dir, item.name);
                if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
                    files.push(...this.findFiles(fullPath, extensions));
                }
                else if (item.isFile() && extensions.includes((0, path_1.extname)(item.name))) {
                    files.push(fullPath);
                }
            }
        }
        catch (error) {
        }
        return files;
    }
}
exports.AdvancedTools = AdvancedTools;
