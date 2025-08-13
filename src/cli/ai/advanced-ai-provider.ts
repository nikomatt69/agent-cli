import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider';
import {
  generateText,
  streamText,
  tool,
  CoreMessage,
  CoreTool,
  ToolCallPart,
  ToolResultPart,
  generateObject,
  StreamData
} from 'ai';
import { z } from 'zod';
import { simpleConfigManager as configManager } from '../core/config-manager';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'fs';
import { join, relative, resolve, dirname, extname } from 'path';
import { exec, execSync } from 'child_process';
import chalk from 'chalk';
import { promisify } from 'util';
import { compactAnalysis, safeStringifyContext, truncateForPrompt } from '../utils/analysis-utils';
import { tokenCache } from '../core/token-cache';
import { completionCache } from '../core/completion-protocol-cache';
import { ContextEnhancer } from '../core/context-enhancer';
import { PerformanceOptimizer } from '../core/performance-optimizer';
import { WebSearchProvider } from '../core/web-search-provider';
import { IDEContextEnricher } from '../core/ide-context-enricher';
import { AdvancedTools } from '../core/advanced-tools';
import { ToolRouter } from '../core/tool-router';
import { PromptManager } from '../prompts/prompt-manager';
import { smartCache } from '../core/smart-cache-manager';
import { docLibrary } from '../core/documentation-library';
import { documentationTools } from '../core/documentation-tool';

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
  streamChatWithFullAutonomy(messages: CoreMessage[], abortSignal?: AbortSignal): AsyncGenerator<StreamEvent>;
  executeAutonomousTask(task: string, context?: any): AsyncGenerator<StreamEvent>;
}

export class AdvancedAIProvider implements AutonomousProvider {
  generateWithTools(planningMessages: CoreMessage[]) {
    throw new Error('Method not implemented.');
  }

  // Truncate long free-form strings to keep prompts safe
  private truncateForPrompt(s: string, maxChars: number = 2000): string {
    if (!s) return '';
    return s.length > maxChars ? s.slice(0, maxChars) + '…[truncated]' : s;
  }

  // Approximate token counting (1 token ≈ 4 characters for most languages)
  private estimateTokens(text: string): number {
    if (!text) return 0;
    // More accurate estimation: count words, punctuation, special chars
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const specialChars = (text.match(/[{}[\](),.;:!?'"]/g) || []).length;
    return Math.ceil((words.length + specialChars * 0.5) * 1.3); // Conservative estimate
  }

  // Estimate total tokens in messages array
  private estimateMessagesTokens(messages: CoreMessage[]): number {
    let totalTokens = 0;
    for (const message of messages) {
      const content = typeof message.content === 'string'
        ? message.content
        : Array.isArray(message.content)
          ? message.content.map(part => typeof part === 'string' ? part : JSON.stringify(part)).join('')
          : JSON.stringify(message.content);

      totalTokens += this.estimateTokens(content);
      totalTokens += 10; // Role, metadata overhead
    }
    return totalTokens;
  }

  // Intelligent message truncation to stay within token limits - AGGRESSIVE MODE
  private truncateMessages(messages: CoreMessage[], maxTokens: number = 120000): CoreMessage[] {
    const currentTokens = this.estimateMessagesTokens(messages);

    if (currentTokens <= maxTokens) {
      return messages;
    }

    // Messages too long - applying intelligent truncation

    // Strategy: Keep system messages, recent user/assistant, and important tool calls
    const truncatedMessages: CoreMessage[] = [];
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // Always keep system messages (but truncate AGGRESSIVELY)
    for (const sysMsg of systemMessages) {
      const content = typeof sysMsg.content === 'string' ? sysMsg.content : JSON.stringify(sysMsg.content);
      truncatedMessages.push({
        ...sysMsg,
        content: this.truncateForPrompt(content, 3000) // REDUCED: Max 3k chars for system messages
      });
    }

    // Keep the most recent messages (MORE AGGRESSIVE sliding window)
    const recentMessages = nonSystemMessages.slice(-10); // REDUCED: Keep last 10 non-system messages
    let accumulatedTokens = this.estimateMessagesTokens(truncatedMessages);

    // Add recent messages in reverse order until we hit the limit
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      const msgTokens = this.estimateTokens(
        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      );

      if (accumulatedTokens + msgTokens > maxTokens) {
        // Truncate this message if it's too long
        const availableTokens = maxTokens - accumulatedTokens;
        const availableChars = Math.max(500, availableTokens * 3); // Conservative char conversion

        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        const truncatedContent = this.truncateForPrompt(content, availableChars);

        // Handle different message types properly
        if (msg.role === 'tool') {
          truncatedMessages.push({
            ...msg,
            content: [{ type: 'text', text: truncatedContent }] as any
          });
        } else {
          truncatedMessages.push({
            ...msg,
            content: truncatedContent
          });
        }
        break;
      }

      truncatedMessages.push(msg);
      accumulatedTokens += msgTokens;
    }

    // If we still need more space, add truncation summary
    if (nonSystemMessages.length > 10) {
      const skippedCount = nonSystemMessages.length - 10;
      truncatedMessages.splice(systemMessages.length, 0, {
        role: 'system' as const,
        content: `[Conversation truncated: ${skippedCount} older messages removed to fit context limit. Total original: ${currentTokens} tokens, truncated to: ~${this.estimateMessagesTokens(truncatedMessages)} tokens]`
      });
    }

    const finalTokens = this.estimateMessagesTokens(truncatedMessages);
    return truncatedMessages;
  }
  private currentModel: string;
  private workingDirectory: string = process.cwd();
  private executionContext: Map<string, any> = new Map();
  private enhancedContext: Map<string, any> = new Map();
  private conversationMemory: CoreMessage[] = [];
  private analysisCache: Map<string, any> = new Map();
  private contextEnhancer: ContextEnhancer;
  private performanceOptimizer: PerformanceOptimizer;
  private webSearchProvider: WebSearchProvider;
  private ideContextEnricher: IDEContextEnricher;
  private advancedTools: AdvancedTools;
  private toolRouter: ToolRouter;
  private promptManager: PromptManager;
  private smartCache: typeof smartCache;
  private docLibrary: typeof docLibrary;

  constructor() {
    this.currentModel = configManager.get('currentModel') || 'claude-sonnet-4-20250514';
    this.contextEnhancer = new ContextEnhancer();
    this.performanceOptimizer = new PerformanceOptimizer();
    this.webSearchProvider = new WebSearchProvider();
    this.ideContextEnricher = new IDEContextEnricher();
    this.advancedTools = new AdvancedTools();
    this.toolRouter = new ToolRouter();
    this.promptManager = PromptManager.getInstance(process.cwd());
    this.smartCache = smartCache;
    this.docLibrary = docLibrary;
  }

  // Tool call tracking for intelligent continuation
  private toolCallHistory: Array<{
    toolName: string;
    args: any;
    result: any;
    timestamp: Date;
    success: boolean;
  }> = [];

  // Round tracking for 2-round limit
  private completedRounds: number = 0;
  private maxRounds: number = 2;

  // Advanced context enhancement system
  private async enhanceContext(messages: CoreMessage[]): Promise<CoreMessage[]> {
    const enhancedMessages = await this.contextEnhancer.enhance(messages, {
      workingDirectory: this.workingDirectory,
      executionContext: this.executionContext,
      conversationMemory: this.conversationMemory,
      analysisCache: this.analysisCache
    });

    // Update conversation memory
    this.conversationMemory = enhancedMessages.slice(-20); // Keep last 20 messages

    // Reset tool history and rounds for new conversation context
    const lastUserMessage = enhancedMessages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      this.toolCallHistory = []; // Fresh start for new queries
      this.completedRounds = 0; // Reset rounds counter
    }

    return enhancedMessages;
  }

  // Enhanced system prompt with advanced capabilities (using PromptManager)
  private async getEnhancedSystemPrompt(context: any = {}): Promise<string> {
    try {
      // Try to load base agent prompt first
      const basePrompt = await this.promptManager.loadPromptForContext({
        agentId: 'base-agent',
        parameters: {
          workingDirectory: this.workingDirectory,
          availableTools: this.toolRouter.getAllTools().map(tool => `${tool.tool}: ${tool.description}`).join(', '),
          ...context
        }
      });

      return basePrompt;
    } catch (error) {
      // Fallback to hardcoded prompt if file system prompts fail
      const toolDescriptions = this.toolRouter.getAllTools()
        .map(tool => `${tool.tool}: ${tool.description}`)
        .join(', ');

      return `You are an advanced AI development assistant with enhanced capabilities:

🧠 **Enhanced Intelligence**:
- Context-aware analysis and reasoning
- Multi-step problem solving
- Pattern recognition and optimization
- Adaptive learning from conversation history

🛠️ **Advanced Tools**:
- File system operations with metadata analysis
- Code generation with syntax validation
- Directory exploration with intelligent filtering
- Command execution with safety checks
- Package management with dependency analysis

📊 **Context Management**:
- Workspace awareness and file structure understanding
- Conversation memory and pattern recognition
- Execution context tracking
- Analysis result caching

🎯 **Optimization Features**:
- Token-aware response generation
- Chained file reading for large analyses
- Intelligent caching strategies
- Performance monitoring and optimization

💡 **Best Practices**:
- Always validate file operations
- Provide clear explanations for complex tasks
- Use appropriate tools for each task type
- Maintain conversation context and continuity

**Current Working Directory**: ${this.workingDirectory}
**Available Tools**: ${toolDescriptions}

Respond in a helpful, professional manner with clear explanations and actionable insights.`;
    }
  }

  // Load tool-specific prompts for enhanced execution
  private async getToolPrompt(toolName: string, parameters: any = {}): Promise<string> {
    try {
      return await this.promptManager.loadPromptForContext({
        toolName,
        parameters: {
          workingDirectory: this.workingDirectory,
          ...parameters
        }
      });
    } catch (error) {
      // Return fallback prompt if file prompt fails
      return `Execute ${toolName} with the provided parameters. Follow best practices and provide clear, helpful output.`;
    }
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
            // Load tool-specific prompt for context
            const toolPrompt = await this.getToolPrompt('read_file', { path, analyze });

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
              lastRead: new Date(),
              toolPrompt // Store prompt for potential reuse
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
            // Load tool-specific prompt for context
            const toolPrompt = await this.getToolPrompt('write_file', { path, content: content.substring(0, 100) + '...', backup, validate });

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
              backedUp,
              toolPrompt
            });

            // File operation completed

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
            // Load tool-specific prompt for context
            const toolPrompt = await this.getToolPrompt('explore_directory', { path, depth, includeHidden, filterBy });

            const fullPath = resolve(this.workingDirectory, path);
            const structure = this.exploreDirectoryStructure(fullPath, depth, includeHidden, filterBy);

            // Update context with directory understanding
            this.executionContext.set(`dir:${path}`, {
              structure,
              explored: new Date(),
              fileCount: this.countFiles(structure),
              toolPrompt
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
        description: 'Execute commands autonomously with context awareness and safety checks',
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

            // Verifica che il comando non esca dalla directory del progetto
            const projectRoot = this.workingDirectory;
            const commandCwd = this.workingDirectory;

            // Controlla se il comando tenta di cambiare directory
            if (fullCommand.includes('cd ') && !fullCommand.includes(`cd ${projectRoot}`)) {
              return {
                error: 'Command blocked: cannot change directory outside project',
                command: fullCommand,
                reason: 'Security: directory change blocked'
              };
            }

            console.log(chalk.blue(`🚀 Executing: ${fullCommand}`));

            const startTime = Date.now();
            const { stdout, stderr } = await execAsync(fullCommand, {
              cwd: commandCwd,
              timeout,
              maxBuffer: 1024 * 1024 * 10, // 10MB
            });

            const duration = Date.now() - startTime;

            // Pausa molto leggera tra comandi per evitare sovraccarichi
            await this.sleep(50);

            // Store execution context
            this.executionContext.set(`cmd:${command}`, {
              command: fullCommand,
              stdout,
              stderr,
              duration,
              executed: new Date(),
              cwd: commandCwd
            });

            // Command completed

            return {
              command: fullCommand,
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              success: true,
              duration,
              cwd: commandCwd
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

            // Store complete analysis in context (may be large)
            this.executionContext.set('project:analysis', analysis);

            // Return a compact, chunk-safe summary to avoid prompt overflow
            const compact = compactAnalysis(analysis, {
              maxDirs: 40,
              maxFiles: 150,
              maxChars: 8000,
            });

            return compact;
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
          type: z.enum(['component', 'function', 'class', 'test', 'config', 'docs']).describe('Code type'),
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
              // Code generated
            }

            return codeGenResult;
          } catch (error: any) {
            return { error: `Code generation failed: ${error.message}` };
          }
        },
      }),

      // Web search capabilities
      web_search: this.webSearchProvider.getWebSearchTool(),

      // IDE context enrichment
      ide_context: this.ideContextEnricher.getIDEContextTool(),

      // Advanced AI-powered tools
      semantic_search: this.advancedTools.getSemanticSearchTool(),
      code_analysis: this.advancedTools.getCodeAnalysisTool(),
      dependency_analysis: this.advancedTools.getDependencyAnalysisTool(),
      git_workflow: this.advancedTools.getGitWorkflowTool(),

      // Documentation tools
      doc_search: documentationTools.search,
      doc_add: documentationTools.add,
      doc_stats: documentationTools.stats,
    };
  }

  // Claude Code style streaming with full autonomy
  async *streamChatWithFullAutonomy(messages: CoreMessage[], abortSignal?: AbortSignal): AsyncGenerator<StreamEvent> {
    if (abortSignal && !(abortSignal instanceof AbortSignal)) {
      throw new TypeError('Invalid AbortSignal provided');
    }

    // Start performance monitoring
    const sessionId = `session_${Date.now()}`;
    const startTime = Date.now();
    this.performanceOptimizer.startMonitoring();

    // Enhance context with advanced intelligence
    const enhancedMessages = await this.enhanceContext(messages);

    // Optimize messages for performance
    const optimizedMessages = this.performanceOptimizer.optimizeMessages(enhancedMessages);

    // Apply AGGRESSIVE truncation to prevent prompt length errors
    const truncatedMessages = this.truncateMessages(optimizedMessages, 100000); // REDUCED: 100k tokens safety margin

    const model = this.getModel() as any;
    const tools = this.getAdvancedTools();

    try {
      // ADVANCED: Check completion protocol cache first (ultra-efficient)
      const lastUserMessage = truncatedMessages.filter(m => m.role === 'user').pop();
      const systemContext = truncatedMessages.filter(m => m.role === 'system').map(m => m.content).join('\n');

      if (lastUserMessage) {
        // Check if this is an analysis request (skip cache for fresh analysis)
        const userContent = typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : Array.isArray(lastUserMessage.content)
            ? lastUserMessage.content.map(part => typeof part === 'string' ? part : part.experimental_providerMetadata?.content || '').join('')
            : String(lastUserMessage.content);

        // Use ToolRouter for intelligent tool analysis
        const toolRecommendations = this.toolRouter.analyzeMessage(lastUserMessage);
        this.toolRouter.logRecommendations(userContent, toolRecommendations);

        const isAnalysisRequest = userContent.toLowerCase().includes('analizza') ||
          userContent.toLowerCase().includes('analysis') ||
          userContent.toLowerCase().includes('analisi') ||
          userContent.toLowerCase().includes('scan') ||
          userContent.toLowerCase().includes('esplora') ||
          userContent.toLowerCase().includes('explore') ||
          userContent.toLowerCase().includes('trova') ||
          userContent.toLowerCase().includes('find') ||
          userContent.toLowerCase().includes('cerca') ||
          userContent.toLowerCase().includes('search');

        // Cache solo per domande ESATTAMENTE identiche
        if (!isAnalysisRequest) {
          // Genera chiave esatta per confronto
          const exactKey = `${userContent.trim()}|${systemContext.substring(0, 500).trim()}`;

          // 1. Prova completion cache (esatto match)
          const params = this.getProviderParams();
          const completionRequest = {
            prefix: userContent.trim(),
            context: systemContext.substring(0, 500).trim(),
            maxTokens: Math.min(200, params.maxTokens),
            temperature: params.temperature,
            model: this.currentModel
          };

          const protocolCompletion = await completionCache.getCompletion(completionRequest);
          if (protocolCompletion && protocolCompletion.exactMatch) {
            yield { type: 'start', content: '🔮 [CACHE] Risposta esatta trovata in completion cache...' };

            const formattedCompletion = this.formatCachedResponse(protocolCompletion.completion);
            for (const chunk of this.chunkText(formattedCompletion, 80)) {
              yield { type: 'text_delta', content: chunk };
            }

            yield { type: 'complete', content: `✅ [CACHE] Completion cache hit - ${protocolCompletion.tokensSaved} tokens risparmiati!` };
            return;
          }

          // 2. Prova smart cache (esatto match)
          const smartCached = await this.smartCache.getCachedResponse(userContent.trim(), systemContext.substring(0, 500).trim());
          if (smartCached && smartCached.exactMatch) {
            yield { type: 'start', content: '🎯 [CACHE] Risposta esatta trovata in smart cache...' };

            const formattedResponse = this.formatCachedResponse(smartCached.response);
            for (const chunk of this.chunkText(formattedResponse, 80)) {
              yield { type: 'text_delta', content: chunk };
            }

            yield { type: 'complete', content: `✅ [CACHE] Smart cache hit - ${smartCached.metadata.tokensSaved} tokens risparmiati!` };
            return;
          }

          // 3. Prova token cache (esatto match)
          const tokenCached = await tokenCache.getCachedResponse(
            userContent.trim(),
            systemContext.substring(0, 500).trim(),
            ['chat', 'autonomous']
          );

          if (tokenCached && tokenCached.exactMatch) {
            yield { type: 'start', content: '💾 [CACHE] Risposta esatta trovata in token cache...' };

            const formattedResponse = this.formatCachedResponse(tokenCached.response);
            for (const chunk of this.chunkText(formattedResponse, 80)) {
              yield { type: 'text_delta', content: chunk };
            }

            yield { type: 'complete', content: '✅ [CACHE] Token cache hit - tokens risparmiati!' };
            return;
          }
        } else {
          yield { type: 'start', content: '🔍 [AI REALE] Avvio analisi fresca (bypassing cache)...' };
        }
      }

      yield { type: 'start', content: 'Initializing autonomous AI assistant...' };

      const originalTokens = this.estimateMessagesTokens(messages);
      const truncatedTokens = this.estimateMessagesTokens(truncatedMessages);

      // Check if we're approaching token limits and need to create a summary
      const tokenLimit = 150000; // Conservative limit
      const isAnalysisRequest = lastUserMessage && typeof lastUserMessage.content === 'string' &&
        (lastUserMessage.content.toLowerCase().includes('analizza') ||
          lastUserMessage.content.toLowerCase().includes('analysis') ||
          lastUserMessage.content.toLowerCase().includes('analisi') ||
          lastUserMessage.content.toLowerCase().includes('scan') ||
          lastUserMessage.content.toLowerCase().includes('esplora') ||
          lastUserMessage.content.toLowerCase().includes('explore'));

      if (isAnalysisRequest && originalTokens > tokenLimit * 0.8) {
        yield { type: 'thinking', content: '📊 Large analysis detected - enabling chained file reading to avoid token limits...' };

        // Enabling chained file reading mode for large analysis

        // Add special instruction for chained file reading
        const chainedInstruction = `IMPORTANT: For this analysis, use chained file reading approach:
1. First, scan and list files/directories to understand structure
2. Then read files in small batches (max 3-5 files per call)
3. Process each batch before moving to the next
4. Build analysis incrementally to avoid token limits
5. Use find_files_tool first, then read_file_tool in small groups`;

        // Add the instruction to the system context
        const enhancedSystemContext = systemContext + '\n\n' + chainedInstruction;

        // Update messages with enhanced context
        const enhancedMessages = messages.map(msg =>
          msg.role === 'system'
            ? { ...msg, content: enhancedSystemContext }
            : msg
        );

        // Use enhanced messages for the rest of the processing
        messages = enhancedMessages;
      }

      const params = this.getProviderParams();

      // Add enhanced system prompt to messages (async)
      const enhancedSystemPrompt = await this.getEnhancedSystemPrompt();
      const messagesWithEnhancedPrompt = truncatedMessages.map(msg =>
        msg.role === 'system' ? { ...msg, content: enhancedSystemPrompt } : msg
      );

      const provider = this.getCurrentModelInfo().config.provider;
      const safeMessages = this.sanitizeMessagesForProvider(provider, messagesWithEnhancedPrompt);
      const streamOpts: any = {
        model,
        messages: safeMessages,
        tools,
        maxToolRoundtrips: isAnalysisRequest ? 25 : 50, // Increased for deeper analysis and toolchains
        temperature: params.temperature,
        abortSignal,
        onStepFinish: (_evt: any) => { },
      };
      if (provider !== 'openai') {
        streamOpts.maxTokens = params.maxTokens;
      }
      const result = streamText(streamOpts);

      let currentToolCalls: ToolCallPart[] = [];
      let accumulatedText = '';
      let toolCallCount = 0;
      const maxToolCallsForAnalysis = 30; // Increased limit for comprehensive analysis

      const approxCharLimit = provider === 'openai' ? params.maxTokens * 4 : Number.POSITIVE_INFINITY;
      let truncatedByCap = false;
      for await (const delta of (await result).fullStream) {
        try {
          // Check for abort signal interruption
          if (abortSignal?.aborted) {
            yield {
              type: 'error',
              error: 'Interrupted by user',
              content: 'Stream processing interrupted'
            };
            break;
          }

          switch (delta.type) {
            case 'text-delta':
              if (delta.textDelta) {
                accumulatedText += delta.textDelta;
                yield {
                  type: 'text_delta',
                  content: delta.textDelta,
                  metadata: {
                    accumulatedLength: accumulatedText.length,
                    provider: this.getCurrentModelInfo().config.provider
                  }
                };
                if (provider === 'openai' && accumulatedText.length >= approxCharLimit) {
                  truncatedByCap = true;
                  break;
                }
              }
              break;

            case 'tool-call':
              toolCallCount++;
              currentToolCalls.push(delta);

              // Track this tool call in history (always track for intelligent analysis)
              this.toolCallHistory.push({
                toolName: delta.toolName,
                args: delta.args,
                result: null, // Will be updated when result comes
                timestamp: new Date(),
                success: false // Will be updated
              });

              // Check if we're hitting tool call limits for analysis - use intelligent continuation
              if (isAnalysisRequest && toolCallCount > maxToolCallsForAnalysis) {
                // Increment completed rounds
                this.completedRounds++;

                const originalQuery = typeof lastUserMessage?.content === 'string'
                  ? lastUserMessage.content
                  : String(lastUserMessage?.content || '');

                // Check if we've completed 2 rounds - if so, provide final summary and stop
                if (this.completedRounds >= this.maxRounds) {
                  const finalSummary = this.generateFinalSummary(originalQuery, this.toolCallHistory);

                  yield {
                    type: 'thinking',
                    content: `🏁 Completed ${this.completedRounds} rounds of analysis. Providing final summary.`
                  };
                  yield {
                    type: 'text_delta',
                    content: `\n\n${finalSummary}\n\n`
                  };
                  yield {
                    type: 'complete',
                    content: `Analysis completed after ${this.completedRounds} rounds. Please review the summary above.`,
                    metadata: { finalStop: true, rounds: this.completedRounds }
                  };
                  return; // Hard stop after 2 rounds
                }

                // If this is the first round, continue with intelligent question
                const gapAnalysis = this.analyzeMissingInformation(originalQuery, this.toolCallHistory);
                const clarifyingQuestion = this.generateClarifyingQuestion(gapAnalysis, originalQuery, this.toolCallHistory);

                yield {
                  type: 'thinking',
                  content: this.truncateForPrompt(`🔄 Round ${this.completedRounds} complete. ${gapAnalysis}`, 100)
                };
                yield {
                  type: 'text_delta',
                  content: `\n\n**Round ${this.completedRounds} Analysis:**\n${gapAnalysis}\n\n**Question to continue:**\n${clarifyingQuestion}\n\n`
                };
                // Don't break - let the conversation continue naturally
                break;
              }

              yield {
                type: 'tool_call',
                toolName: delta.toolName,
                toolArgs: delta.args,
                content: `Executing ${delta.toolName}... (${toolCallCount}/${maxToolCallsForAnalysis})`,
                metadata: { toolCallId: delta.toolCallId }
              };
              break;

            case 'tool-call-delta':
              const toolCall = currentToolCalls.find(tc => tc.toolCallId === delta.toolCallId);

              // Update tool history with result
              const historyEntry = this.toolCallHistory.find(h => h.toolName === toolCall?.toolName);
              if (historyEntry) {
                historyEntry.result = delta.argsTextDelta;
                historyEntry.success = !!delta.argsTextDelta;
              }

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
              // Salva nella cache adattiva
              if (lastUserMessage && accumulatedText.trim()) {
                const userContentLength = typeof lastUserMessage.content === 'string'
                  ? lastUserMessage.content.length
                  : String(lastUserMessage.content).length;
                const tokensUsed = delta.usage?.totalTokens || Math.round((userContentLength + accumulatedText.length) / 4);

                // Extract user content as string for storage
                const userContentStr = typeof lastUserMessage.content === 'string'
                  ? lastUserMessage.content
                  : Array.isArray(lastUserMessage.content)
                    ? lastUserMessage.content.map(part => typeof part === 'string' ? part : part.experimental_providerMetadata?.content || '').join('')
                    : String(lastUserMessage.content);

                // Salva in tutti i sistemi di cache (multi-livello)
                try {
                  // 1. Completion cache (più veloce)
                  const cacheParams = this.getProviderParams();
                  const completionRequest = {
                    prefix: userContentStr,
                    context: systemContext.substring(0, 2000),
                    maxTokens: Math.min(300, cacheParams.maxTokens),
                    temperature: cacheParams.temperature,
                    model: this.currentModel
                  };
                  await completionCache.storeCompletion(completionRequest, accumulatedText.trim(), tokensUsed);

                  // 2. Smart cache (intelligente)
                  await this.smartCache.setCachedResponse(
                    userContentStr,
                    accumulatedText.trim(),
                    systemContext.substring(0, 1000),
                    {
                      tokensSaved: tokensUsed,
                      responseTime: Date.now() - startTime,
                      userSatisfaction: 1.0
                    }
                  );

                  // 3. Token cache (fallback)
                  await tokenCache.setCachedResponse(
                    userContentStr,
                    accumulatedText.trim(),
                    systemContext.substring(0, 2000),
                    tokensUsed,
                    ['chat', 'autonomous']
                  );
                } catch (cacheError: any) {
                  // Continue without caching - don't fail the stream
                }

                yield {
                  type: 'complete',
                  content: truncatedByCap ? 'Output truncated by local cap' : 'Task completed',
                  metadata: {
                    finishReason: delta.finishReason,
                    usage: delta.usage,
                    totalText: accumulatedText.length,
                    capped: truncatedByCap
                  }
                };
              }
              break;

            case 'error':
              yield {
                type: 'error',
                error: (delta?.error) as any,
                content: `Error: ${delta.error}`
              };
              break;
          }
        } catch (deltaError: any) {
          // Stream delta error occurred
          yield {
            type: 'error',
            error: deltaError.message,
            content: `Stream error: ${deltaError.message}`
          };
        }
      }

      // Check if response was complete
      if (accumulatedText.length === 0) {
        // No text received from model
        yield {
          type: 'error',
          error: 'Empty response',
          content: 'No text was generated - possible parameter mismatch'
        };
      }

      // End performance monitoring and log metrics
      const metrics = this.performanceOptimizer.endMonitoring(sessionId, {
        tokenCount: this.estimateMessagesTokens(truncatedMessages),
        toolCallCount,
        responseQuality: this.performanceOptimizer.analyzeResponseQuality(accumulatedText)
      });

      // Show only essential info: tokens used and context remaining  
      if (truncatedTokens > 0) {
        console.log(chalk.dim(`💬 ${truncatedTokens} tokens | ${Math.max(0, 200000 - truncatedTokens)} remaining`));
      }

    } catch (error: any) {
      console.error(`Provider error (${this.getCurrentModelInfo().config.provider}):`, error);
      yield {
        type: 'error',
        error: error.message,
        content: `System error: ${error.message} (Provider: ${this.getCurrentModelInfo().config.provider})`
      };
    }
  }

  // Execute autonomous task with intelligent planning and parallel agent support
  async *executeAutonomousTask(task: string, context?: any): AsyncGenerator<StreamEvent> {
    yield { type: 'start', content: `🎯 Starting task: ${task}` };

    // First, analyze the task and create a plan
    yield { type: 'thinking', content: 'Analyzing task and creating execution plan...' };

    try {
      // If prebuilt messages are provided, use them directly to avoid duplicating large prompts
      if (context && Array.isArray(context.messages)) {
        const providedMessages: CoreMessage[] = context.messages;
        // Note: streamChatWithFullAutonomy will handle truncation internally
        for await (const event of this.streamChatWithFullAutonomy(providedMessages)) {
          yield event;
        }
        return;
      }

      // Analizza se il task richiede agenti paralleli
      const requiresParallelAgents = this.analyzeParallelRequirements(task);

      if (requiresParallelAgents) {
        yield { type: 'thinking', content: '🔄 Task requires parallel agent execution...' };

        // Esegui con agenti paralleli
        for await (const event of this.executeParallelTask(task, context)) {
          yield event;
        }
        return;
      }

      const planningMessages: CoreMessage[] = [
        {
          role: 'system',
          content: `AI dev assistant. CWD: ${this.workingDirectory}
Tools: read_file, write_file, explore_directory, execute_command, analyze_project, manage_packages, generate_code, doc_search, doc_add
Task: ${this.truncateForPrompt(task, 300)} 

${context ? this.truncateForPrompt(safeStringifyContext(context), 150) : ''}

Execute task autonomously with tools. Be direct. Stay within project directory.`
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

  // Analizza se un task richiede agenti paralleli
  private analyzeParallelRequirements(task: string): boolean {
    const parallelKeywords = [
      'parallel', 'simultaneous', 'concurrent', 'multiple', 'several',
      'parallelo', 'simultaneo', 'concorrente', 'multiplo', 'diversi',
      'build and test', 'compile and deploy', 'analyze and generate'
    ];

    const lowerTask = task.toLowerCase();
    return parallelKeywords.some(keyword => lowerTask.includes(keyword));
  }

  // Esegue task con agenti paralleli
  private async *executeParallelTask(task: string, context?: any): AsyncGenerator<StreamEvent> {
    yield { type: 'thinking', content: '🔄 Planning parallel execution...' };

    try {
      // Dividi il task in sottotask paralleli
      const subtasks = this.splitIntoSubtasks(task);

      yield { type: 'thinking', content: `📋 Split into ${subtasks.length} parallel subtasks` };

      // Esegui sottotask in parallelo con isolamento
      const results = await Promise.allSettled(
        subtasks.map(async (subtask, index) => {
          // Pausa molto leggera tra l'avvio degli agenti per evitare sovraccarichi
          await this.sleep(index * 50);

          return this.executeSubtask(subtask, index, context);
        })
      );

      // Aggrega risultati
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      yield {
        type: 'complete',
        content: `✅ Parallel execution complete: ${successful} successful, ${failed} failed`,
        metadata: { parallel: true, subtasks: subtasks.length }
      };

    } catch (error: any) {
      yield {
        type: 'error',
        error: error.message,
        content: `Parallel execution failed: ${error.message}`
      };
    }
  }

  // Divide un task in sottotask paralleli
  private splitIntoSubtasks(task: string): string[] {
    // Logica semplice per dividere task complessi
    const subtasks: string[] = [];

    if (task.toLowerCase().includes('build and test')) {
      subtasks.push('Build the project');
      subtasks.push('Run tests');
    } else if (task.toLowerCase().includes('analyze and generate')) {
      subtasks.push('Analyze code structure');
      subtasks.push('Generate documentation');
    } else {
      // Fallback: dividi per frasi
      const sentences = task.split(/[.!?]+/).filter(s => s.trim().length > 10);
      subtasks.push(...sentences.slice(0, 3)); // Massimo 3 sottotask
    }

    return subtasks.length > 0 ? subtasks : [task];
  }

  // Esegue un singolo sottotask con isolamento
  private async executeSubtask(subtask: string, index: number, context?: any): Promise<any> {
    const subtaskContext = {
      ...context,
      subtaskIndex: index,
      isParallel: true,
      workingDirectory: this.workingDirectory // Mantieni directory del progetto
    };

    const messages: CoreMessage[] = [
      {
        role: 'system',
        content: `AI agent ${index + 1}. CWD: ${this.workingDirectory}
Execute this subtask independently. Do not interfere with other agents.
Subtask: ${subtask}
Stay within project directory.`
      },
      {
        role: 'user',
        content: subtask
      }
    ];

    // Esegui il sottotask
    const result = await this.streamChatWithFullAutonomy(messages);
    return result;
  }

  // Safely stringify and truncate large contexts to prevent prompt overflow - AGGRESSIVE
  private safeStringifyContext(ctx: any, maxChars: number = 1000): string { // REDUCED from 4000
    if (!ctx) return '{}';
    try {
      const str = JSON.stringify(ctx, (key, value) => {
        // Truncate long strings AGGRESSIVELY
        if (typeof value === 'string') {
          return value.length > 100 ? value.slice(0, 100) + '…[truncated]' : value; // REDUCED from 512
        }
        // Limit large arrays
        if (Array.isArray(value)) {
          const limited = value.slice(0, 20);
          if (value.length > 20) limited.push('…[+' + (value.length - 20) + ' more]');
          return limited;
        }
        return value;
      });
      return str.length > maxChars ? str.slice(0, maxChars) + '…[truncated]' : str;
    } catch {
      return '[unstringifiable context]';
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
      '.cs': 'csharp',
      '.c': 'c',
      '.toml': 'toml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.ini': 'ini',
      '.env': 'env',
      '.sh': 'shell',
      '.bash': 'shell',
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
    if (deps.svelte) return 'Svelte';
    if (deps.astro) return 'Astro';



    if (deps.remix) return 'Remix';
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
      const model = this.getModel() as any;
      const params = this.getProviderParams();
      const provider = this.getCurrentModelInfo().config.provider;
      const genOpts: any = {
        model,
        prompt: this.truncateForPrompt(codeGenPrompt, provider === 'openai' ? 120000 : 80000),
      };
      if (this.getCurrentModelInfo().config.provider !== 'openai') {
        genOpts.maxTokens = Math.min(params.maxTokens, 2000);
      }
      const result = await generateText(genOpts);

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
  private getModel(modelName?: string): any {
    const model = modelName || this.currentModel || configManager.get('currentModel');
    const allModels = configManager.get('models');
    const configData = allModels[model];

    if (!configData) {
      throw new Error(`Model ${model} not found in configuration`);
    }

    // Configure providers with API keys properly
    // Create provider instances with API keys, then get the specific model
    switch (configData.provider) {
      case 'openai': {
        const apiKey = configManager.getApiKey(model);
        if (!apiKey) throw new Error(`No API key found for model ${model} (OpenAI)`);
        const openaiProvider = createOpenAI({ apiKey, compatibility: 'strict' });
        return openaiProvider(configData.model);
      }
      case 'anthropic': {
        const apiKey = configManager.getApiKey(model);
        if (!apiKey) throw new Error(`No API key found for model ${model} (Anthropic)`);
        const anthropicProvider = createAnthropic({ apiKey });
        return anthropicProvider(configData.model);
      }
      case 'google': {
        const apiKey = configManager.getApiKey(model);
        if (!apiKey) throw new Error(`No API key found for model ${model} (Google)`);
        const googleProvider = createGoogleGenerativeAI({ apiKey });
        return googleProvider(configData.model);
      }
      case 'ollama': {
        // Ollama runs locally and does not require API keys
        const ollamaProvider = createOllama({});
        return ollamaProvider(configData.model);
      }
      default:
        throw new Error(`Unsupported provider: ${configData.provider}`);
    }
  }

  // Get provider-specific parameters
  private getProviderParams(modelName?: string): { maxTokens: number; temperature: number } {
    const model = modelName || this.currentModel || configManager.get('currentModel');
    const allModels = configManager.get('models');
    const configData = allModels[model];

    if (!configData) {
      return { maxTokens: 8000, temperature: 0.7 }; // REDUCED default
    }

    // Provider-specific token limits and settings
    switch (configData.provider) {
      case 'openai':
        // OpenAI models - REDUCED for lighter requests
        if (configData.model.includes('gpt-5')) {
          return { maxTokens: 8192, temperature: 1 }; // REDUCED from 8192
        } else if (configData.model.includes('gpt-4')) {
          return { maxTokens: 4096, temperature: 1 }; // REDUCED from 4096
        }
        return { maxTokens: 3000, temperature: 1 };

      case 'anthropic':
        // Claude models - AUMENTATO per risposte più complete
        if (configData.model.includes('claude-4') ||
          configData.model.includes('claude-4-sonnet') ||
          configData.model.includes('claude-sonnet-4')) {
          return { maxTokens: 12000, temperature: 0.7 }; // AUMENTATO da 4000
        }
        return { maxTokens: 10000, temperature: 0.7 }; // AUMENTATO da 4000

      case 'google':
        // Gemini models - AUMENTATO per risposte più complete
        return { maxTokens: 8000, temperature: 0.7 }; // AUMENTATO da 1500

      case 'ollama':
        // Local models - AUMENTATO per risposte più complete
        return { maxTokens: 4000, temperature: 0.7 }; // AUMENTATO da 1000

      default:
        return { maxTokens: 12000, temperature: 0.7 }; // AUMENTATO da 8000
    }
  }

  // Build provider-specific options to satisfy differing token parameter names
  private getProviderOptions(maxTokens: number): any {
    try {
      const provider = this.getCurrentModelInfo().config.provider;
      switch (provider) {
        case 'openai':
          return { openai: { max_completion_tokens: maxTokens } };
        case 'google':
          // Google Generative AI expects max_output_tokens
          return { google: { max_output_tokens: maxTokens } };
        // Anthropic and others work with normalized maxTokens via AI SDK
        default:
          return {};
      }
    } catch {
      return {};
    }
  }

  // Build a provider-safe message array by enforcing hard character caps
  private sanitizeMessagesForProvider(provider: string, messages: CoreMessage[]): CoreMessage[] {
    const maxTotalChars = provider === 'openai' ? 800_000 : 400_000; // conservative caps
    const maxPerMessage = provider === 'openai' ? 60_000 : 40_000;

    const safeMessages: CoreMessage[] = [];
    let total = 0;

    const clamp = (text: string, limit: number): string => {
      if (text.length <= limit) return text;
      const head = text.slice(0, Math.floor(limit * 0.8));
      const tail = text.slice(-Math.floor(limit * 0.2));
      return `${head}\n…[omitted ${text.length - limit} chars]\n${tail}`;
    };

    // Keep system messages first (clamped)
    const systems = messages.filter(m => m.role === 'system');
    for (const m of systems) {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      const clamped = clamp(content, 8000);
      total += clamped.length;
      if (total > maxTotalChars) break;
      // For tool messages, wrap clamped string as tool-friendly text content
      if ((m as any).role === 'tool') {
        safeMessages.push({ ...(m as any), content: [{ type: 'text', text: clamped }] as any });
      } else {
        const role = (m as any).role;
        safeMessages.push({ role, content: clamped } as any);
      }
    }

    // Then add the most recent non-system messages until we hit the cap
    const rest = messages.filter(m => m.role !== 'system');
    for (let i = Math.max(0, rest.length - 40); i < rest.length; i++) { // last 40 msgs
      const m = rest[i];
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      const clamped = clamp(content, maxPerMessage);
      if (total + clamped.length > maxTotalChars) break;
      total += clamped.length;
      if ((m as any).role === 'tool') {
        safeMessages.push({ ...(m as any), content: [{ type: 'text', text: clamped }] as any });
      } else {
        const role = (m as any).role;
        safeMessages.push({ role, content: clamped } as any);
      }
    }

    return safeMessages;
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

  // Utility method for sleep
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test method to verify prompt loading works
  async testPromptLoading(): Promise<{ baseAgent: string, readFile: string }> {
    try {
      const baseAgent = await this.getEnhancedSystemPrompt();
      const readFile = await this.getToolPrompt('read_file', { path: 'test.txt' });

      return {
        baseAgent: baseAgent.substring(0, 4000) + '...',
        readFile: readFile.substring(0, 4000) + '...'
      };
    } catch (error: any) {
      return {
        baseAgent: `Error loading base agent: ${error.message}`,
        readFile: `Error loading read_file: ${error.message}`
      };
    }
  }

  // Format cached response to preserve proper text formatting
  private formatCachedResponse(cachedText: string): string {
    if (!cachedText || typeof cachedText !== 'string') {
      return cachedText;
    }

    // Restore proper formatting
    let formatted = cachedText
      // Fix missing spaces after punctuation
      .replace(/([.!?,:;])([A-Z])/g, '$1 $2')
      // Fix missing spaces after commas and periods
      .replace(/([,])([a-zA-Z])/g, '$1 $2')
      // Fix missing spaces around common words
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Fix code block formatting
      .replace(/```([a-z]*)\n/g, '```$1\n')
      // Fix list items
      .replace(/^(\d+\.)([A-Z])/gm, '$1 $2')
      .replace(/^([-*])([A-Z])/gm, '$1 $2')
      // Fix markdown headers
      .replace(/^(#{1,6})([A-Z])/gm, '$1 $2')
      // Fix step numbers
      .replace(/Step(\d+):/g, 'Step $1:')
      // Add space after certain patterns
      .replace(/(\w)###/g, '$1\n\n###')
      .replace(/(\w)##/g, '$1\n\n##')
      .replace(/(\w)#([A-Z])/g, '$1\n\n# $2');

    return formatted;
  }

  // Chunk text into smaller pieces for streaming
  private chunkText(text: string, chunkSize: number = 80): string[] {
    if (!text || text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    const words = text.split(/(\s+)/); // Split on whitespace but keep separators

    for (const word of words) {
      if ((currentChunk + word).length <= chunkSize) {
        currentChunk += word;
      } else {
        if (currentChunk.trim()) {
          chunks.push(currentChunk);
        }
        currentChunk = word;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  // Analyze gaps when tool roundtrips are exhausted (token-optimized)
  private analyzeMissingInformation(originalQuery: string, toolHistory: Array<{ toolName: string, args: any, result: any, success: boolean }>): string {
    const tools = [...new Set(toolHistory.map(t => t.toolName))];
    const failed = toolHistory.filter(t => !t.success).length;
    const queryLower = originalQuery.toLowerCase();

    let analysis = `Used ${tools.length} tools: ${tools.slice(0, 3).join(', ')}${tools.length > 3 ? '...' : ''}. `;

    if (failed > 0) analysis += `${failed} failed. `;

    // Suggest missing tools based on query
    const missing = [];
    if ((queryLower.includes('search') || queryLower.includes('find') || queryLower.includes('cerca') || queryLower.includes('trova')) && !tools.includes('semantic_search')) {
      missing.push('semantic search');
    }
    if ((queryLower.includes('analyze') || queryLower.includes('analizza')) && !tools.includes('code_analysis')) {
      missing.push('code analysis');
    }

    if (missing.length > 0) {
      analysis += `Missing: ${missing.join(', ')}.`;
    }

    return this.truncateForPrompt(analysis, 200);
  }

  // Generate specific clarifying questions (token-optimized)
  private generateClarifyingQuestion(gapAnalysis: string, originalQuery: string, toolHistory: Array<{ toolName: string, args: any, result: any, success: boolean }>): string {
    const queryLower = originalQuery.toLowerCase();
    const tools = toolHistory.map(t => t.toolName);

    let question = '';

    if ((queryLower.includes('function') || queryLower.includes('funzione')) && !tools.includes('semantic_search')) {
      question = '🔎 Should I search for similar functions with different names?';
    } else if (queryLower.includes('component') || queryLower.includes('componente')) {
      question = '⚛️ Is the component in specific subdirectories (components/, ui/)?';
    } else if (queryLower.includes('config')) {
      question = '⚙️ Is the config in different files (.env, .yaml, .toml)?';
    } else if (queryLower.includes('error') || queryLower.includes('errore')) {
      question = '🐛 Do you have specific error logs or messages?';
    } else {
      question = '🎯 More context on where to search?';
    }

    return this.truncateForPrompt(`${question}\n💡 Tell me how to continue.`, 150);
  }

  // Generate final summary after 2 rounds of roundtrips
  private generateFinalSummary(originalQuery: string, toolHistory: Array<{ toolName: string, args: any, result: any, success: boolean }>): string {
    const tools = [...new Set(toolHistory.map(t => t.toolName))];
    const successful = toolHistory.filter(t => t.success).length;
    const failed = toolHistory.filter(t => !t.success).length;
    const totalOperations = toolHistory.length;

    let summary = `**Final Analysis Summary:**\n\n`;

    // What was done
    summary += `📊 **Operations Completed:** ${totalOperations} total operations across ${this.completedRounds} rounds\n`;
    summary += `✅ **Successful:** ${successful} operations\n`;
    summary += `❌ **Failed:** ${failed} operations\n`;
    summary += `🛠️ **Tools Used:** ${tools.join(', ')}\n\n`;

    // Key findings
    summary += `🔍 **Key Findings:**\n`;
    if (successful > 0) {
      summary += `- Successfully executed ${successful} operations\n`;
    }
    if (failed > 0) {
      summary += `- ${failed} operations encountered issues\n`;
    }

    // Analysis of query fulfillment
    const queryLower = originalQuery.toLowerCase();
    summary += `\n📝 **Query Analysis:**\n`;
    summary += `- Original request: "${this.truncateForPrompt(originalQuery, 80)}"\n`;

    // Recommend next steps based on analysis
    summary += `\n🎯 **Recommended Next Steps:**\n`;

    // Strategy based on what was tried
    if (failed > successful && failed > 3) {
      summary += `- Review and refine search criteria (many operations failed)\n`;
      summary += `- Try different search patterns or keywords\n`;
    }

    if (queryLower.includes('search') || queryLower.includes('find')) {
      if (!tools.includes('web_search')) {
        summary += `- Try web search for external documentation\n`;
      }
      if (!tools.includes('semantic_search')) {
        summary += `- Use semantic search for similar patterns\n`;
      }
      summary += `- Manually specify directories or file patterns\n`;
      summary += `- Consider searching in hidden/config directories\n`;
    }

    if (queryLower.includes('analyze') || queryLower.includes('analisi')) {
      if (!tools.includes('dependency_analysis')) {
        summary += `- Run dependency analysis for comprehensive view\n`;
      }
      if (!tools.includes('code_analysis')) {
        summary += `- Perform detailed code quality analysis\n`;
      }
      summary += `- Focus on specific modules or components\n`;
    }

    // General strategies
    summary += `- Provide more specific context or constraints\n`;
    summary += `- Break down the request into smaller, targeted tasks\n`;
    summary += `- Try alternative approaches or tools not yet used\n`;

    // Final guidance
    summary += `\n💡 **How to Continue:** Please provide more specific guidance, narrow the scope, or try a different approach based on the recommendations above. Consider breaking your request into smaller, more focused tasks.`;

    return this.truncateForPrompt(summary, 800);
  }
}

export const advancedAIProvider = new AdvancedAIProvider();
