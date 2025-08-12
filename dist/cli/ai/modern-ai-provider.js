"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.modernAIProvider = exports.ModernAIProvider = void 0;
const anthropic_1 = require("@ai-sdk/anthropic");
const openai_1 = require("@ai-sdk/openai");
const google_1 = require("@ai-sdk/google");
const ai_1 = require("ai");
const zod_1 = require("zod");
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
const config_manager_1 = require("../core/config-manager");
class ModernAIProvider {
    constructor() {
        this.workingDirectory = process.cwd();
        this.currentModel = config_manager_1.simpleConfigManager.get('currentModel');
    }
    // Core file operations tools - Claude Code style
    getFileOperationsTools() {
        return {
            read_file: (0, ai_1.tool)({
                description: 'Read the contents of a file',
                parameters: zod_1.z.object({
                    path: zod_1.z.string().describe('The file path to read'),
                }),
                execute: async ({ path }) => {
                    try {
                        const fullPath = (0, path_1.resolve)(this.workingDirectory, path);
                        if (!(0, fs_1.existsSync)(fullPath)) {
                            return { error: `File not found: ${path}` };
                        }
                        const content = (0, fs_1.readFileSync)(fullPath, 'utf-8');
                        const stats = (0, fs_1.statSync)(fullPath);
                        return {
                            content,
                            size: stats.size,
                            modified: stats.mtime,
                            path: (0, path_1.relative)(this.workingDirectory, fullPath)
                        };
                    }
                    catch (error) {
                        return { error: `Failed to read file: ${error.message}` };
                    }
                },
            }),
            write_file: (0, ai_1.tool)({
                description: 'Write content to a file',
                parameters: zod_1.z.object({
                    path: zod_1.z.string().describe('The file path to write to'),
                    content: zod_1.z.string().describe('The content to write'),
                }),
                execute: async ({ path, content }) => {
                    try {
                        const fullPath = (0, path_1.resolve)(this.workingDirectory, path);
                        const dir = (0, path_1.dirname)(fullPath);
                        // Create directory if it doesn't exist
                        const { mkdirSync } = await Promise.resolve().then(() => __importStar(require('fs')));
                        mkdirSync(dir, { recursive: true });
                        (0, fs_1.writeFileSync)(fullPath, content, 'utf-8');
                        const stats = (0, fs_1.statSync)(fullPath);
                        console.log(chalk_1.default.green(`✓ Created/updated: ${path}`));
                        return {
                            path: (0, path_1.relative)(this.workingDirectory, fullPath),
                            size: stats.size,
                            created: true
                        };
                    }
                    catch (error) {
                        return { error: `Failed to write file: ${error.message}` };
                    }
                },
            }),
            list_directory: (0, ai_1.tool)({
                description: 'List files and directories in a path',
                parameters: zod_1.z.object({
                    path: zod_1.z.string().describe('The directory path to list').optional(),
                    pattern: zod_1.z.string().describe('Optional glob pattern to filter files').optional(),
                }),
                execute: async ({ path = '.', pattern }) => {
                    try {
                        const fullPath = (0, path_1.resolve)(this.workingDirectory, path);
                        if (!(0, fs_1.existsSync)(fullPath)) {
                            return { error: `Directory not found: ${path}` };
                        }
                        const items = (0, fs_1.readdirSync)(fullPath, { withFileTypes: true });
                        const files = [];
                        const directories = [];
                        for (const item of items) {
                            if (pattern && !item.name.includes(pattern))
                                continue;
                            const itemPath = (0, path_1.join)(fullPath, item.name);
                            const stats = (0, fs_1.statSync)(itemPath);
                            const itemInfo = {
                                name: item.name,
                                path: (0, path_1.relative)(this.workingDirectory, itemPath),
                                size: stats.size,
                                modified: stats.mtime,
                            };
                            if (item.isDirectory()) {
                                directories.push(itemInfo);
                            }
                            else {
                                files.push(itemInfo);
                            }
                        }
                        return {
                            path: (0, path_1.relative)(this.workingDirectory, fullPath),
                            files,
                            directories,
                            total: files.length + directories.length
                        };
                    }
                    catch (error) {
                        return { error: `Failed to list directory: ${error.message}` };
                    }
                },
            }),
            execute_command: (0, ai_1.tool)({
                description: 'Execute a shell command',
                parameters: zod_1.z.object({
                    command: zod_1.z.string().describe('The command to execute'),
                    args: zod_1.z.array(zod_1.z.string()).describe('Command arguments').optional(),
                }),
                execute: async ({ command, args = [] }) => {
                    try {
                        const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
                        console.log(chalk_1.default.blue(`$ ${fullCommand}`));
                        const output = (0, child_process_1.execSync)(fullCommand, {
                            cwd: this.workingDirectory,
                            encoding: 'utf-8',
                            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                        });
                        return {
                            command: fullCommand,
                            output: output.trim(),
                            success: true
                        };
                    }
                    catch (error) {
                        console.log(chalk_1.default.red(`Command failed: ${error.message}`));
                        return {
                            command: `${command} ${args.join(' ')}`,
                            error: error.message,
                            success: false
                        };
                    }
                },
            }),
            analyze_workspace: (0, ai_1.tool)({
                description: 'Analyze the current workspace/project structure',
                parameters: zod_1.z.object({
                    depth: zod_1.z.number().describe('Directory depth to analyze').optional(),
                }),
                execute: async ({ depth = 2 }) => {
                    try {
                        const analysis = await this.analyzeWorkspaceStructure(this.workingDirectory, depth);
                        return analysis;
                    }
                    catch (error) {
                        return { error: `Failed to analyze workspace: ${error.message}` };
                    }
                },
            }),
        };
    }
    async analyzeWorkspaceStructure(rootPath, maxDepth) {
        const packageJsonPath = (0, path_1.join)(rootPath, 'package.json');
        let packageInfo = null;
        if ((0, fs_1.existsSync)(packageJsonPath)) {
            try {
                packageInfo = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf-8'));
            }
            catch (e) {
                // Invalid package.json
            }
        }
        const structure = this.buildDirectoryTree(rootPath, maxDepth);
        const framework = this.detectFramework(packageInfo);
        const technologies = this.detectTechnologies(packageInfo, structure);
        return {
            rootPath: (0, path_1.relative)(process.cwd(), rootPath),
            packageInfo: packageInfo ? {
                name: packageInfo.name,
                version: packageInfo.version,
                description: packageInfo.description,
            } : null,
            framework,
            technologies,
            structure,
            files: this.countFiles(structure),
        };
    }
    buildDirectoryTree(dirPath, maxDepth, currentDepth = 0) {
        if (currentDepth >= maxDepth || !(0, fs_1.existsSync)(dirPath)) {
            return null;
        }
        const items = (0, fs_1.readdirSync)(dirPath, { withFileTypes: true });
        const result = {
            directories: [],
            files: []
        };
        const skipDirs = ['node_modules', '.git', '.next', 'dist', 'build'];
        for (const item of items) {
            if (skipDirs.includes(item.name))
                continue;
            const itemPath = (0, path_1.join)(dirPath, item.name);
            if (item.isDirectory()) {
                const subTree = this.buildDirectoryTree(itemPath, maxDepth, currentDepth + 1);
                if (subTree) {
                    result.directories.push({
                        name: item.name,
                        path: (0, path_1.relative)(this.workingDirectory, itemPath),
                        ...subTree
                    });
                }
            }
            else {
                result.files.push({
                    name: item.name,
                    path: (0, path_1.relative)(this.workingDirectory, itemPath),
                    extension: item.name.split('.').pop() || ''
                });
            }
        }
        return result;
    }
    detectFramework(packageInfo) {
        if (!packageInfo?.dependencies)
            return 'Unknown';
        const deps = { ...packageInfo.dependencies, ...packageInfo.devDependencies };
        if (deps.next)
            return 'Next.js';
        if (deps.nuxt)
            return 'Nuxt.js';
        if (deps['@angular/core'])
            return 'Angular';
        if (deps.vue)
            return 'Vue.js';
        if (deps.react)
            return 'React';
        if (deps.express)
            return 'Express';
        if (deps.fastify)
            return 'Fastify';
        return 'JavaScript/Node.js';
    }
    detectTechnologies(packageInfo, structure) {
        const technologies = new Set();
        if (packageInfo?.dependencies) {
            const allDeps = { ...packageInfo.dependencies, ...packageInfo.devDependencies };
            Object.keys(allDeps).forEach(dep => {
                if (dep.includes('typescript') || dep.includes('@types/'))
                    technologies.add('TypeScript');
                if (dep.includes('tailwind'))
                    technologies.add('Tailwind CSS');
                if (dep.includes('prisma'))
                    technologies.add('Prisma');
                if (dep.includes('next'))
                    technologies.add('Next.js');
                if (dep.includes('react'))
                    technologies.add('React');
                if (dep.includes('vue'))
                    technologies.add('Vue.js');
                if (dep.includes('express'))
                    technologies.add('Express');
                if (dep.includes('jest'))
                    technologies.add('Jest');
                if (dep.includes('vitest'))
                    technologies.add('Vitest');
            });
        }
        // Detect from file extensions
        this.extractFileExtensions(structure).forEach(ext => {
            switch (ext) {
                case 'ts':
                case 'tsx':
                    technologies.add('TypeScript');
                    break;
                case 'py':
                    technologies.add('Python');
                    break;
                case 'go':
                    technologies.add('Go');
                    break;
                case 'rs':
                    technologies.add('Rust');
                    break;
                case 'java':
                    technologies.add('Java');
                    break;
            }
        });
        return Array.from(technologies);
    }
    extractFileExtensions(structure) {
        const extensions = new Set();
        if (structure?.files) {
            structure.files.forEach((file) => {
                if (file.extension)
                    extensions.add(file.extension);
            });
        }
        if (structure?.directories) {
            structure.directories.forEach((dir) => {
                this.extractFileExtensions(dir).forEach(ext => extensions.add(ext));
            });
        }
        return Array.from(extensions);
    }
    countFiles(structure) {
        let count = 0;
        if (structure?.files)
            count += structure.files.length;
        if (structure?.directories) {
            structure.directories.forEach((dir) => {
                count += this.countFiles(dir);
            });
        }
        return count;
    }
    getModel(modelName) {
        const model = modelName || this.currentModel;
        const config = config_manager_1.simpleConfigManager?.getCurrentModel();
        if (!config) {
            throw new Error(`Model ${model} not found in configuration`);
        }
        const apiKey = config_manager_1.simpleConfigManager.getApiKey(model);
        if (!apiKey) {
            throw new Error(`No API key found for model ${model}`);
        }
        switch (config.provider) {
            case 'openai':
                // OpenAI provider is already response-API compatible via model options; no chainable helper here.
                return (0, openai_1.openai)(config.model);
            case 'anthropic':
                return (0, anthropic_1.anthropic)(config.model);
            case 'google':
                return (0, google_1.google)(config.model);
            default:
                throw new Error(`Unsupported provider: ${config.provider}`);
        }
    }
    // Claude Code style streaming with tool support
    async *streamChatWithTools(messages) {
        const model = this.getModel();
        const tools = this.getFileOperationsTools();
        try {
            const result = await (0, ai_1.streamText)({
                model,
                messages,
                tools,
                maxTokens: 1000,
                temperature: 1,
            });
            for await (const delta of result.textStream) {
                yield {
                    type: 'text',
                    content: delta,
                };
            }
            const finishResult = await result.finishReason;
            yield {
                type: 'finish',
                finishReason: finishResult,
            };
        }
        catch (error) {
            throw new Error(`Stream generation failed: ${error.message}`);
        }
    }
    // Generate complete response with tools
    async generateWithTools(messages) {
        const model = this.getModel();
        const tools = this.getFileOperationsTools();
        try {
            const result = await (0, ai_1.generateText)({
                model,
                messages,
                tools,
                maxToolRoundtrips: 5,
                maxTokens: 4000,
                temperature: 0.7,
            });
            return {
                text: result.text,
                toolCalls: result.toolCalls || [],
                toolResults: result.toolResults || [],
            };
        }
        catch (error) {
            throw new Error(`Generation failed: ${error.message}`);
        }
    }
    // Set working directory for file operations
    setWorkingDirectory(directory) {
        this.workingDirectory = (0, path_1.resolve)(directory);
    }
    // Get current working directory
    getWorkingDirectory() {
        return this.workingDirectory;
    }
    // Set current model
    setModel(modelName) {
        this.currentModel = modelName;
    }
    // Get current model info
    getCurrentModelInfo() {
        const config = config_manager_1.simpleConfigManager.get('models');
        return {
            name: this.currentModel,
            config: config || { provider: 'unknown', model: 'unknown' },
        };
    }
    // Validate API key for current model
    validateApiKey() {
        try {
            const apiKey = config_manager_1.simpleConfigManager.getApiKey(this.currentModel);
            return !!apiKey;
        }
        catch {
            return false;
        }
    }
}
exports.ModernAIProvider = ModernAIProvider;
exports.modernAIProvider = new ModernAIProvider();
