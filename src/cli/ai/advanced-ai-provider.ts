import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  generateText,
  streamText,
  tool,
  CoreMessage,
  CoreTool,
  ToolCallPart,
  ToolResultPart,
  generateObject
} from 'ai';
import { z } from 'zod';
import { simpleConfigManager as configManager } from '../core/config-manager';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'fs';
import { join, relative, resolve, dirname, extname } from 'path';
import { exec, execSync } from 'child_process';
import chalk from 'chalk';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface StreamEvent {
  type: 'start' | 'thinking' | 'tool_call' | 'tool_result' | 'text_delta' | 'complete' | 'error';
  content?: string;
  toolName?: string;
  toolArgs?: any;
  toolResult?: any;
  error?: string;
  metadata?: any;
}

export interface AutonomousProvider {
  streamChatWithFullAutonomy(messages: CoreMessage[]): AsyncGenerator<StreamEvent>;
  executeAutonomousTask(task: string, context?: any): AsyncGenerator<StreamEvent>;
}

export class AdvancedAIProvider implements AutonomousProvider {
  generateWithTools(planningMessages: CoreMessage[]) {
    throw new Error('Method not implemented.');
  }
  private currentModel: string;
  private workingDirectory: string = process.cwd();
  private executionContext: Map<string, any> = new Map();

  constructor() {
    this.currentModel = configManager.get('currentModel') || 'claude-sonnet-4-20250514';
  }

  // Advanced file operations with context awareness
  private getAdvancedTools(): Record<string, CoreTool> {
    return {
      // Enhanced file reading with analysis
      read_file: tool({
        description: 'Read and analyze file contents with metadata',
        parameters: z.object({
          path: z.string().describe('File path to read'),
          analyze: z.boolean().default(true).describe('Whether to analyze file structure'),
        }),
        execute: async ({ path, analyze }) => {
          try {
            const fullPath = resolve(this.workingDirectory, path);
            if (!existsSync(fullPath)) {
              return { error: `File not found: ${path}` };
            }

            const content = readFileSync(fullPath, 'utf-8');
            const stats = statSync(fullPath);
            const extension = extname(fullPath);

            let analysis = null;
            if (analyze) {
              analysis = this.analyzeFileContent(content, extension);
            }

            // Store in context for future operations
            this.executionContext.set(`file:${path}`, {
              content,
              stats,
              analysis,
              lastRead: new Date()
            });

            return {
              content,
              size: stats.size,
              modified: stats.mtime,
              path: relative(this.workingDirectory, fullPath),
              extension,
              analysis,
              lines: content.split('\n').length
            };
          } catch (error: any) {
            return { error: `Failed to read file: ${error.message}` };
          }
        },
      }),

      // Smart file writing with backups
      write_file: tool({
        description: 'Write content to file with automatic backup and validation',
        parameters: z.object({
          path: z.string().describe('File path to write'),
          content: z.string().describe('Content to write'),
          backup: z.boolean().default(true).describe('Create backup if file exists'),
          validate: z.boolean().default(true).describe('Validate syntax if applicable'),
        }),
        execute: async ({ path, content, backup, validate }) => {
          try {
            const fullPath = resolve(this.workingDirectory, path);
            const dir = dirname(fullPath);

            // Ensure directory exists
            if (!existsSync(dir)) {
              mkdirSync(dir, { recursive: true });
            }

            // Create backup if file exists
            let backedUp = false;
            if (backup && existsSync(fullPath)) {
              const backupPath = `${fullPath}.backup.${Date.now()}`;
              writeFileSync(backupPath, readFileSync(fullPath, 'utf-8'));
              backedUp = true;
            }

            // Validate syntax if applicable
            let validation = null;
            if (validate) {
              validation = this.validateFileContent(content, extname(fullPath));
            }

            // Write file
            writeFileSync(fullPath, content, 'utf-8');
            const stats = statSync(fullPath);

            // Update context
            this.executionContext.set(`file:${path}`, {
              content,
              stats,
              lastWritten: new Date(),
              backedUp
            });

            console.log(chalk.green(`✅ ${backedUp ? 'Updated' : 'Created'}: ${path}`));

            return {
              path: relative(this.workingDirectory, fullPath),
              size: stats.size,
              created: !backedUp,
              updated: backedUp,
              backedUp,
              validation
            };
          } catch (error: any) {
            return { error: `Failed to write file: ${error.message}` };
          }
        },
      }),

      // Intelligent directory operations
      explore_directory: tool({
        description: 'Explore directory structure with intelligent filtering',
        parameters: z.object({
          path: z.string().default('.').describe('Directory to explore'),
          depth: z.number().default(2).describe('Maximum depth to explore'),
          includeHidden: z.boolean().default(false).describe('Include hidden files'),
          filterBy: z.enum(['all', 'code', 'config', 'docs']).default('all').describe('Filter files by type'),
        }),
        execute: async ({ path, depth, includeHidden, filterBy }) => {
          try {
            const fullPath = resolve(this.workingDirectory, path);
            const structure = this.exploreDirectoryStructure(fullPath, depth, includeHidden, filterBy);

            // Update context with directory understanding
            this.executionContext.set(`dir:${path}`, {
              structure,
              explored: new Date(),
              fileCount: this.countFiles(structure)
            });

            return {
              path: relative(this.workingDirectory, fullPath),
              structure,
              summary: this.generateDirectorySummary(structure),
              fileCount: this.countFiles(structure),
              recommendations: this.generateDirectoryRecommendations(structure)
            };
          } catch (error: any) {
            return { error: `Failed to explore directory: ${error.message}` };
          }
        },
      }),

      // Autonomous command execution with intelligence
      execute_command: tool({
        description: 'Execute commands autonomously with context awareness',
        parameters: z.object({
          command: z.string().describe('Command to execute'),
          args: z.array(z.string()).default([]).describe('Command arguments'),
          autonomous: z.boolean().default(true).describe('Execute without confirmation'),
          timeout: z.number().default(30000).describe('Timeout in milliseconds'),
        }),
        execute: async ({ command, args, autonomous, timeout }) => {
          try {
            const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

            // Safety check for dangerous commands
            const isDangerous = this.isDangerousCommand(fullCommand);
            if (isDangerous && !autonomous) {
              return {
                error: 'Command requires manual confirmation',
                command: fullCommand,
                reason: isDangerous
              };
            }

            console.log(chalk.blue(`🚀 Executing: ${fullCommand}`));

            const startTime = Date.now();
            const { stdout, stderr } = await execAsync(fullCommand, {
              cwd: this.workingDirectory,
              timeout,
              maxBuffer: 1024 * 1024 * 10, // 10MB
            });

            const duration = Date.now() - startTime;

            // Store execution context
            this.executionContext.set(`cmd:${command}`, {
              command: fullCommand,
              stdout,
              stderr,
              duration,
              executed: new Date()
            });

            console.log(chalk.green(`✅ Completed in ${duration}ms`));

            return {
              command: fullCommand,
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              success: true,
              duration
            };
          } catch (error: any) {
            console.log(chalk.red(`❌ Command failed: ${error.message}`));
            return {
              command: `${command} ${args.join(' ')}`,
              error: error.message,
              success: false,
              code: error.code
            };
          }
        },
      }),

      // Advanced project analysis
      analyze_project: tool({
        description: 'Comprehensive autonomous project analysis',
        parameters: z.object({
          includeMetrics: z.boolean().default(true).describe('Include code metrics'),
          analyzeDependencies: z.boolean().default(true).describe('Analyze dependencies'),
          securityScan: z.boolean().default(true).describe('Basic security analysis'),
        }),
        execute: async ({ includeMetrics, analyzeDependencies, securityScan }) => {
          try {
            console.log(chalk.blue('🔍 Starting comprehensive project analysis...'));

            const analysis = await this.performAdvancedProjectAnalysis({
              includeMetrics,
              analyzeDependencies,
              securityScan
            });

            // Store complete analysis in context
            this.executionContext.set('project:analysis', analysis);

            return analysis;
          } catch (error: any) {
            return { error: `Project analysis failed: ${error.message}` };
          }
        },
      }),

      // Autonomous package management
      manage_packages: tool({
        description: 'Autonomously manage project dependencies',
        parameters: z.object({
          action: z.enum(['install', 'add', 'remove', 'update', 'audit']).describe('Package action'),
          packages: z.array(z.string()).default([]).describe('Package names'),
          dev: z.boolean().default(false).describe('Development dependency'),
          global: z.boolean().default(false).describe('Global installation'),
        }),
        execute: async ({ action, packages, dev, global }) => {
          try {
            let command = 'yarn';
            let args: string[] = [];

            switch (action) {
              case 'install':
                args = ['install'];
                break;
              case 'add':
                args = ['add', ...packages];
                if (dev) args.push('--dev');
                if (global) args.push('--global');
                break;
              case 'remove':
                args = ['remove', ...packages];
                break;
              case 'update':
                args = ['upgrade', ...packages];
                break;
              case 'audit':
                args = ['audit'];
                break;
            }

            console.log(chalk.blue(`📦 ${action} packages: ${packages.join(', ') || 'all'}`));

            const { stdout, stderr } = await execAsync(`${command} ${args.join(' ')}`, {
              cwd: this.workingDirectory,
              timeout: 120000, // 2 minutes for package operations
            });

            return {
              action,
              packages,
              success: true,
              output: stdout.trim(),
              warnings: stderr.trim()
            };
          } catch (error: any) {
            return {
              action,
              packages,
              success: false,
              error: error.message
            };
          }
        },
      }),

      // Intelligent code generation
      generate_code: tool({
        description: 'Generate code with context awareness and best practices',
        parameters: z.object({
          type: z.enum(['component', 'function', 'class', 'test', 'config']).describe('Code type'),
          description: z.string().describe('What to generate'),
          language: z.string().default('typescript').describe('Programming language'),
          framework: z.string().optional().describe('Framework context (react, node, etc)'),
          outputPath: z.string().optional().describe('Where to save the generated code'),
        }),
        execute: async ({ type, description, language, framework, outputPath }) => {
          try {
            console.log(chalk.blue(`🎨 Generating ${type}: ${description}`));

            const projectContext = this.executionContext.get('project:analysis');
            const codeGenResult = await this.generateIntelligentCode({
              type,
              description,
              language,
              framework: framework || projectContext?.framework,
              projectContext,
              outputPath
            });

            if (outputPath && codeGenResult.code) {
              writeFileSync(resolve(this.workingDirectory, outputPath), codeGenResult.code);
              console.log(chalk.green(`✅ Generated: ${outputPath}`));
            }

            return codeGenResult;
          } catch (error: any) {
            return { error: `Code generation failed: ${error.message}` };
          }
        },
      }),
    };
  }

  // Claude Code style streaming with full autonomy
  async *streamChatWithFullAutonomy(messages: CoreMessage[]): AsyncGenerator<StreamEvent> {
    const model = this.getModel();
    const tools = this.getAdvancedTools();

    try {
      yield { type: 'start', content: 'Initializing autonomous AI assistant...' };

      const result = streamText({
        model,
        messages,
        tools,
        maxToolRoundtrips: 10, // Allow multiple tool calls
        maxTokens: 4000,
        temperature: 0.7,
        onStepFinish: ({ stepType, toolCalls, toolResults }) => {
          // This will be handled by the stream
        },
      });

      let currentToolCalls: ToolCallPart[] = [];
      let accumulatedText = '';

      for await (const delta of (await result).fullStream) {
        switch (delta.type) {
          case 'text-delta':
            if (delta.textDelta) {
              accumulatedText += delta.textDelta;
              yield {
                type: 'text_delta',
                content: delta.textDelta,
                metadata: { accumulatedLength: accumulatedText.length }
              };
            }
            break;

          case 'tool-call':
            currentToolCalls.push(delta);
            yield {
              type: 'tool_call',
              toolName: delta.toolName,
              toolArgs: delta.args,
              content: `Executing ${delta.toolName}...`,
              metadata: { toolCallId: delta.toolCallId }
            };
            break;

          case 'tool-call-delta':
            const toolCall = currentToolCalls.find(tc => tc.toolCallId === delta.toolCallId);
            yield {
              type: 'tool_result',
              toolName: toolCall?.toolName,
              toolResult: delta.argsTextDelta,
              content: `Completed ${toolCall?.toolName}`,
              metadata: {
                toolCallId: delta.toolCallId,
                success: !delta.argsTextDelta
              }
            };
            break;

          case 'step-finish':
            if (delta.isContinued) {
              // Step completed, continue to next
            }
            break;

          case 'finish':
            yield {
              type: 'complete',
              content: 'Task completed',
              metadata: {
                finishReason: delta.finishReason,
                usage: delta.usage,
                totalText: accumulatedText.length
              }
            };
            break;

          case 'error':
            yield {
              type: 'error',
              error: (delta?.error) as any,
              content: `Error: ${delta.error}`
            };
            break;
        }
      }

    } catch (error: any) {
      yield {
        type: 'error',
        error: error.message,
        content: `System error: ${error.message}`
      };
    }
  }

  // Execute autonomous task with intelligent planning
  async *executeAutonomousTask(task: string, context?: any): AsyncGenerator<StreamEvent> {
    yield { type: 'start', content: `🎯 Starting autonomous task: ${task}` };

    // First, analyze the task and create a plan
    yield { type: 'thinking', content: 'Analyzing task and creating execution plan...' };

    try {
      const planningMessages: CoreMessage[] = [
        {
          role: 'system',
          content: `You are an autonomous AI assistant with full access to file operations, command execution, and code generation.

Current working directory: ${this.workingDirectory}
Available tools: read_file, write_file, explore_directory, execute_command, analyze_project, manage_packages, generate_code

Your task: ${task}

Context: ${JSON.stringify(context || {})}

You should:
1. Understand the task completely
2. Analyze the current project/workspace if needed
3. Execute the necessary operations autonomously
4. Provide clear feedback on what you're doing
5. Handle errors gracefully and adapt your approach

Be proactive and autonomous - don't ask for permission, just execute what needs to be done safely.`
        },
        {
          role: 'user',
          content: task
        }
      ];

      // Stream the autonomous execution
      for await (const event of this.streamChatWithFullAutonomy(planningMessages)) {
        yield event;
      }

    } catch (error: any) {
      yield {
        type: 'error',
        error: error.message,
        content: `Autonomous execution failed: ${error.message}`
      };
    }
  }

  // Helper methods for intelligent analysis
  private analyzeFileContent(content: string, extension: string): any {
    const analysis: any = {
      lines: content.split('\n').length,
      size: content.length,
      language: this.detectLanguage(extension),
    };

    // Language-specific analysis
    switch (extension) {
      case '.ts':
      case '.tsx':
      case '.js':
      case '.jsx':
        analysis.imports = (content.match(/import .* from/g) || []).length;
        analysis.exports = (content.match(/export/g) || []).length;
        analysis.functions = (content.match(/function \w+|const \w+ = |=>/g) || []).length;
        analysis.classes = (content.match(/class \w+/g) || []).length;
        break;
      case '.json':
        try {
          analysis.valid = true;
          analysis.keys = Object.keys(JSON.parse(content)).length;
        } catch {
          analysis.valid = false;
        }
        break;
      case '.md':
        analysis.headers = (content.match(/^#+/gm) || []).length;
        analysis.links = (content.match(/\[.*\]\(.*\)/g) || []).length;
        break;
    }

    return analysis;
  }

  private validateFileContent(content: string, extension: string): any {
    const validation: any = { valid: true, errors: [] };

    switch (extension) {
      case '.json':
        try {
          JSON.parse(content);
        } catch (error: any) {
          validation.valid = false;
          validation.errors.push(`Invalid JSON: ${error.message}`);
        }
        break;
      case '.ts':
      case '.tsx':
        // Basic TypeScript validation could be added here
        break;
    }

    return validation;
  }

  private exploreDirectoryStructure(dirPath: string, maxDepth: number, includeHidden: boolean, filterBy: string): any {
    // Implement intelligent directory exploration
    const explore = (currentPath: string, depth: number): any => {
      if (depth > maxDepth) return null;

      try {
        const items = readdirSync(currentPath, { withFileTypes: true });
        const structure: any = { files: [], directories: [] };

        for (const item of items) {
          if (!includeHidden && item.name.startsWith('.')) continue;

          const itemPath = join(currentPath, item.name);
          const relativePath = relative(this.workingDirectory, itemPath);

          if (item.isDirectory()) {
            const subStructure = explore(itemPath, depth + 1);
            if (subStructure) {
              structure.directories.push({
                name: item.name,
                path: relativePath,
                ...subStructure
              });
            }
          } else if (item.isFile()) {
            const fileInfo = {
              name: item.name,
              path: relativePath,
              extension: extname(item.name),
              size: statSync(itemPath).size
            };

            // Apply filter
            if (this.matchesFilter(fileInfo, filterBy)) {
              structure.files.push(fileInfo);
            }
          }
        }

        return structure;
      } catch {
        return null;
      }
    };

    return explore(dirPath, 0);
  }

  private matchesFilter(fileInfo: any, filterBy: string): boolean {
    switch (filterBy) {
      case 'code':
        return ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.rs'].includes(fileInfo.extension);
      case 'config':
        return ['.json', '.yaml', '.yml', '.toml', '.ini', '.env'].includes(fileInfo.extension);
      case 'docs':
        return ['.md', '.txt', '.rst', '.adoc'].includes(fileInfo.extension);
      default:
        return true;
    }
  }

  private countFiles(structure: any): number {
    let count = structure.files?.length || 0;
    if (structure.directories) {
      for (const dir of structure.directories) {
        count += this.countFiles(dir);
      }
    }
    return count;
  }

  private generateDirectorySummary(structure: any): string {
    const fileCount = this.countFiles(structure);
    const dirCount = structure.directories?.length || 0;
    const extensions = new Set();

    const collectExtensions = (struct: any) => {
      struct.files?.forEach((file: any) => {
        if (file.extension) extensions.add(file.extension);
      });
      struct.directories?.forEach((dir: any) => collectExtensions(dir));
    };

    collectExtensions(structure);

    return `${fileCount} files, ${dirCount} directories. Languages: ${Array.from(extensions).join(', ')}`;
  }

  private generateDirectoryRecommendations(structure: any): string[] {
    const recommendations: string[] = [];

    // Analyze project structure and provide recommendations
    const hasPackageJson = structure.files?.some((f: any) => f.name === 'package.json');
    const hasTypeScript = structure.files?.some((f: any) => f.extension === '.ts');
    const hasTests = structure.files?.some((f: any) => f.name.includes('.test.') || f.name.includes('.spec.'));

    if (hasPackageJson && !hasTypeScript) {
      recommendations.push('Consider adding TypeScript for better type safety');
    }

    if (hasTypeScript && !hasTests) {
      recommendations.push('Add unit tests for better code quality');
    }

    return recommendations;
  }

  private isDangerousCommand(command: string): string | false {
    const dangerous = [
      'rm -rf /',
      'dd if=',
      'mkfs',
      'fdisk',
      'format',
      'del /f /s /q',
      'shutdown',
      'reboot'
    ];

    for (const dangerousCmd of dangerous) {
      if (command.includes(dangerousCmd)) {
        return `Dangerous command detected: ${dangerousCmd}`;
      }
    }

    return false;
  }

  private async performAdvancedProjectAnalysis(options: any): Promise<any> {
    const analysis: any = {
      timestamp: new Date(),
      directory: this.workingDirectory,
      options
    };

    // Basic project structure
    const packageJsonPath = join(this.workingDirectory, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      analysis.package = packageJson;
      analysis.name = packageJson.name;
      analysis.version = packageJson.version;
      analysis.framework = this.detectFramework(packageJson);
    }

    // File analysis
    const structure = this.exploreDirectoryStructure(this.workingDirectory, 3, false, 'all');
    analysis.structure = structure;
    analysis.fileCount = this.countFiles(structure);

    // Language detection
    analysis.languages = this.detectProjectLanguages(structure);

    // Dependencies analysis
    if (options.analyzeDependencies && analysis.package) {
      analysis.dependencies = {
        production: Object.keys(analysis.package.dependencies || {}),
        development: Object.keys(analysis.package.devDependencies || {}),
        total: Object.keys({
          ...analysis.package.dependencies,
          ...analysis.package.devDependencies
        }).length
      };
    }

    return analysis;
  }

  private detectLanguage(extension: string): string {
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.rs': 'rust',
      '.go': 'go',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin'
    };
    return langMap[extension] || 'unknown';
  }

  private detectFramework(packageJson: any): string {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps.next) return 'Next.js';
    if (deps.nuxt) return 'Nuxt.js';
    if (deps['@angular/core']) return 'Angular';
    if (deps.vue) return 'Vue.js';
    if (deps.react) return 'React';
    if (deps.express) return 'Express';
    if (deps.fastify) return 'Fastify';

    return 'JavaScript/Node.js';
  }

  private detectProjectLanguages(structure: any): string[] {
    const languages = new Set<string>();

    const collectLanguages = (struct: any) => {
      struct.files?.forEach((file: any) => {
        if (file.extension) {
          const lang = this.detectLanguage(file.extension);
          if (lang !== 'unknown') languages.add(lang);
        }
      });
      struct.directories?.forEach((dir: any) => collectLanguages(dir));
    };

    collectLanguages(structure);
    return Array.from(languages);
  }

  private async generateIntelligentCode(params: any): Promise<any> {
    // This would integrate with the AI model to generate context-aware code
    const { type, description, language, framework, projectContext } = params;

    // Use AI to generate appropriate code based on context
    const codeGenPrompt = `Generate ${type} code for: ${description}
Language: ${language}
Framework: ${framework || 'none'}
Project Context: ${JSON.stringify(projectContext?.summary || {})}

Requirements:
- Follow ${language} best practices
- Use ${framework} patterns if applicable
- Include proper types for TypeScript
- Add comments for complex logic
- Ensure code is production-ready`;

    try {
      const model = this.getModel();
      const result = await generateText({
        model,
        prompt: codeGenPrompt,
        maxTokens: 2000,
      });

      return {
        type,
        description,
        language,
        code: result.text,
        generated: new Date(),
        context: params
      };
    } catch (error: any) {
      return { error: `Code generation failed: ${error.message}` };
    }
  }

  // Model management
  private getModel(modelName?: string) {
    const model = modelName || this.currentModel || configManager.get('currentModel');
    const allModels = configManager.get('models');
    const configData = allModels[model];

    if (!configData) {
      throw new Error(`Model ${model} not found in configuration`);
    }

    const apiKey = configManager.getApiKey(model);
    if (!apiKey) {
      throw new Error(`No API key found for model ${model}`);
    }

    // Configure providers with API keys properly
    // Create provider instances with API keys, then get the specific model
    switch (configData.provider) {
      case 'openai':
        const openaiProvider = createOpenAI({
          apiKey: apiKey
        });
        return openaiProvider(configData.model);
      case 'anthropic':
        const anthropicProvider = createAnthropic({
          apiKey: apiKey
        });
        return anthropicProvider(configData.model);
      case 'google':
        const googleProvider = createGoogleGenerativeAI({
          apiKey: apiKey
        });
        return googleProvider(configData.model);
      default:
        throw new Error(`Unsupported provider: ${configData.provider}`);
    }
  }

  // Configuration methods
  setWorkingDirectory(directory: string): void {
    this.workingDirectory = resolve(directory);
    this.executionContext.clear(); // Reset context for new directory
  }

  getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  setModel(modelName: string): void {
    this.currentModel = modelName;
  }

  getCurrentModelInfo() {
    const allModels = configManager.get('models');
    const modelConfig = allModels[this.currentModel];
    return {
      name: this.currentModel,
      config: modelConfig || { provider: 'unknown', model: 'unknown' },
    };
  }

  validateApiKey(): boolean {
    try {
      const apiKey = configManager.getApiKey(this.currentModel);
      return !!apiKey;
    } catch {
      return false;
    }
  }

  // Get execution context for debugging/analysis
  getExecutionContext(): Map<string, any> {
    return new Map(this.executionContext);
  }

  // Clear execution context
  clearExecutionContext(): void {
    this.executionContext.clear();
  }
}

export const advancedAIProvider = new AdvancedAIProvider();
