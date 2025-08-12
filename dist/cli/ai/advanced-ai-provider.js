"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.advancedAIProvider = exports.AdvancedAIProvider = void 0;
const anthropic_1 = require("@ai-sdk/anthropic");
const openai_1 = require("@ai-sdk/openai");
const google_1 = require("@ai-sdk/google");
const ollama_ai_provider_1 = require("ollama-ai-provider");
const ai_1 = require("ai");
const zod_1 = require("zod");
const config_manager_1 = require("../core/config-manager");
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
const util_1 = require("util");
const analysis_utils_1 = require("../utils/analysis-utils");
const token_cache_1 = require("../core/token-cache");
const completion_protocol_cache_1 = require("../core/completion-protocol-cache");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class AdvancedAIProvider {
    generateWithTools(planningMessages) {
        throw new Error('Method not implemented.');
    }
    // Truncate long free-form strings to keep prompts safe
    truncateForPrompt(s, maxChars = 2000) {
        if (!s)
            return '';
        return s.length > maxChars ? s.slice(0, maxChars) + '…[truncated]' : s;
    }
    // Approximate token counting (1 token ≈ 4 characters for most languages)
    estimateTokens(text) {
        if (!text)
            return 0;
        // More accurate estimation: count words, punctuation, special chars
        const words = text.split(/\s+/).filter(word => word.length > 0);
        const specialChars = (text.match(/[{}[\](),.;:!?'"]/g) || []).length;
        return Math.ceil((words.length + specialChars * 0.5) * 1.3); // Conservative estimate
    }
    // Estimate total tokens in messages array
    estimateMessagesTokens(messages) {
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
    truncateMessages(messages, maxTokens = 120000) {
        const currentTokens = this.estimateMessagesTokens(messages);
        if (currentTokens <= maxTokens) {
            console.log(`✅ Messages fit within limit: ${currentTokens}/${maxTokens} tokens`);
            return messages;
        }
        console.warn(`⚠️ Messages too long: ${currentTokens}/${maxTokens} tokens - applying intelligent truncation`);
        // Strategy: Keep system messages, recent user/assistant, and important tool calls
        const truncatedMessages = [];
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
            const msgTokens = this.estimateTokens(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
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
                        content: [{ type: 'text', text: truncatedContent }]
                    });
                }
                else {
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
                role: 'system',
                content: `[Conversation truncated: ${skippedCount} older messages removed to fit context limit. Total original: ${currentTokens} tokens, truncated to: ~${this.estimateMessagesTokens(truncatedMessages)} tokens]`
            });
        }
        const finalTokens = this.estimateMessagesTokens(truncatedMessages);
        console.log(`✂️ Truncation complete: ${finalTokens}/${maxTokens} tokens (${truncatedMessages.length}/${messages.length} messages)`);
        return truncatedMessages;
    }
    constructor() {
        this.workingDirectory = process.cwd();
        this.executionContext = new Map();
        this.currentModel = config_manager_1.simpleConfigManager.get('currentModel') || 'claude-sonnet-4-20250514';
    }
    // Advanced file operations with context awareness
    getAdvancedTools() {
        return {
            // Enhanced file reading with analysis
            read_file: (0, ai_1.tool)({
                description: 'Read and analyze file contents with metadata',
                parameters: zod_1.z.object({
                    path: zod_1.z.string().describe('File path to read'),
                    analyze: zod_1.z.boolean().default(true).describe('Whether to analyze file structure'),
                }),
                execute: async ({ path, analyze }) => {
                    try {
                        const fullPath = (0, path_1.resolve)(this.workingDirectory, path);
                        if (!(0, fs_1.existsSync)(fullPath)) {
                            return { error: `File not found: ${path}` };
                        }
                        const content = (0, fs_1.readFileSync)(fullPath, 'utf-8');
                        const stats = (0, fs_1.statSync)(fullPath);
                        const extension = (0, path_1.extname)(fullPath);
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
                            path: (0, path_1.relative)(this.workingDirectory, fullPath),
                            extension,
                            analysis,
                            lines: content.split('\n').length
                        };
                    }
                    catch (error) {
                        return { error: `Failed to read file: ${error.message}` };
                    }
                },
            }),
            // Smart file writing with backups
            write_file: (0, ai_1.tool)({
                description: 'Write content to file with automatic backup and validation',
                parameters: zod_1.z.object({
                    path: zod_1.z.string().describe('File path to write'),
                    content: zod_1.z.string().describe('Content to write'),
                    backup: zod_1.z.boolean().default(true).describe('Create backup if file exists'),
                    validate: zod_1.z.boolean().default(true).describe('Validate syntax if applicable'),
                }),
                execute: async ({ path, content, backup, validate }) => {
                    try {
                        const fullPath = (0, path_1.resolve)(this.workingDirectory, path);
                        const dir = (0, path_1.dirname)(fullPath);
                        // Ensure directory exists
                        if (!(0, fs_1.existsSync)(dir)) {
                            (0, fs_1.mkdirSync)(dir, { recursive: true });
                        }
                        // Create backup if file exists
                        let backedUp = false;
                        if (backup && (0, fs_1.existsSync)(fullPath)) {
                            const backupPath = `${fullPath}.backup.${Date.now()}`;
                            (0, fs_1.writeFileSync)(backupPath, (0, fs_1.readFileSync)(fullPath, 'utf-8'));
                            backedUp = true;
                        }
                        // Validate syntax if applicable
                        let validation = null;
                        if (validate) {
                            validation = this.validateFileContent(content, (0, path_1.extname)(fullPath));
                        }
                        // Write file
                        (0, fs_1.writeFileSync)(fullPath, content, 'utf-8');
                        const stats = (0, fs_1.statSync)(fullPath);
                        // Update context
                        this.executionContext.set(`file:${path}`, {
                            content,
                            stats,
                            lastWritten: new Date(),
                            backedUp
                        });
                        console.log(chalk_1.default.green(`✅ ${backedUp ? 'Updated' : 'Created'}: ${path}`));
                        return {
                            path: (0, path_1.relative)(this.workingDirectory, fullPath),
                            size: stats.size,
                            created: !backedUp,
                            updated: backedUp,
                            backedUp,
                            validation
                        };
                    }
                    catch (error) {
                        return { error: `Failed to write file: ${error.message}` };
                    }
                },
            }),
            // Intelligent directory operations
            explore_directory: (0, ai_1.tool)({
                description: 'Explore directory structure with intelligent filtering',
                parameters: zod_1.z.object({
                    path: zod_1.z.string().default('.').describe('Directory to explore'),
                    depth: zod_1.z.number().default(2).describe('Maximum depth to explore'),
                    includeHidden: zod_1.z.boolean().default(false).describe('Include hidden files'),
                    filterBy: zod_1.z.enum(['all', 'code', 'config', 'docs']).default('all').describe('Filter files by type'),
                }),
                execute: async ({ path, depth, includeHidden, filterBy }) => {
                    try {
                        const fullPath = (0, path_1.resolve)(this.workingDirectory, path);
                        const structure = this.exploreDirectoryStructure(fullPath, depth, includeHidden, filterBy);
                        // Update context with directory understanding
                        this.executionContext.set(`dir:${path}`, {
                            structure,
                            explored: new Date(),
                            fileCount: this.countFiles(structure)
                        });
                        return {
                            path: (0, path_1.relative)(this.workingDirectory, fullPath),
                            structure,
                            summary: this.generateDirectorySummary(structure),
                            fileCount: this.countFiles(structure),
                            recommendations: this.generateDirectoryRecommendations(structure)
                        };
                    }
                    catch (error) {
                        return { error: `Failed to explore directory: ${error.message}` };
                    }
                },
            }),
            // Autonomous command execution with intelligence
            execute_command: (0, ai_1.tool)({
                description: 'Execute commands autonomously with context awareness',
                parameters: zod_1.z.object({
                    command: zod_1.z.string().describe('Command to execute'),
                    args: zod_1.z.array(zod_1.z.string()).default([]).describe('Command arguments'),
                    autonomous: zod_1.z.boolean().default(true).describe('Execute without confirmation'),
                    timeout: zod_1.z.number().default(30000).describe('Timeout in milliseconds'),
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
                        console.log(chalk_1.default.blue(`🚀 Executing: ${fullCommand}`));
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
                        console.log(chalk_1.default.green(`✅ Completed in ${duration}ms`));
                        return {
                            command: fullCommand,
                            stdout: stdout.trim(),
                            stderr: stderr.trim(),
                            success: true,
                            duration
                        };
                    }
                    catch (error) {
                        console.log(chalk_1.default.red(`❌ Command failed: ${error.message}`));
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
            analyze_project: (0, ai_1.tool)({
                description: 'Comprehensive autonomous project analysis',
                parameters: zod_1.z.object({
                    includeMetrics: zod_1.z.boolean().default(true).describe('Include code metrics'),
                    analyzeDependencies: zod_1.z.boolean().default(true).describe('Analyze dependencies'),
                    securityScan: zod_1.z.boolean().default(true).describe('Basic security analysis'),
                }),
                execute: async ({ includeMetrics, analyzeDependencies, securityScan }) => {
                    try {
                        console.log(chalk_1.default.blue('🔍 Starting comprehensive project analysis...'));
                        const analysis = await this.performAdvancedProjectAnalysis({
                            includeMetrics,
                            analyzeDependencies,
                            securityScan
                        });
                        // Store complete analysis in context (may be large)
                        this.executionContext.set('project:analysis', analysis);
                        // Return a compact, chunk-safe summary to avoid prompt overflow
                        const compact = (0, analysis_utils_1.compactAnalysis)(analysis, {
                            maxDirs: 40,
                            maxFiles: 150,
                            maxChars: 8000,
                        });
                        return compact;
                    }
                    catch (error) {
                        return { error: `Project analysis failed: ${error.message}` };
                    }
                },
            }),
            // Autonomous package management
            manage_packages: (0, ai_1.tool)({
                description: 'Autonomously manage project dependencies',
                parameters: zod_1.z.object({
                    action: zod_1.z.enum(['install', 'add', 'remove', 'update', 'audit']).describe('Package action'),
                    packages: zod_1.z.array(zod_1.z.string()).default([]).describe('Package names'),
                    dev: zod_1.z.boolean().default(false).describe('Development dependency'),
                    global: zod_1.z.boolean().default(false).describe('Global installation'),
                }),
                execute: async ({ action, packages, dev, global }) => {
                    try {
                        let command = 'yarn';
                        let args = [];
                        switch (action) {
                            case 'install':
                                args = ['install'];
                                break;
                            case 'add':
                                args = ['add', ...packages];
                                if (dev)
                                    args.push('--dev');
                                if (global)
                                    args.push('--global');
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
                        console.log(chalk_1.default.blue(`📦 ${action} packages: ${packages.join(', ') || 'all'}`));
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
                    }
                    catch (error) {
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
            generate_code: (0, ai_1.tool)({
                description: 'Generate code with context awareness and best practices',
                parameters: zod_1.z.object({
                    type: zod_1.z.enum(['component', 'function', 'class', 'test', 'config', 'docs']).describe('Code type'),
                    description: zod_1.z.string().describe('What to generate'),
                    language: zod_1.z.string().default('typescript').describe('Programming language'),
                    framework: zod_1.z.string().optional().describe('Framework context (react, node, etc)'),
                    outputPath: zod_1.z.string().optional().describe('Where to save the generated code'),
                }),
                execute: async ({ type, description, language, framework, outputPath }) => {
                    try {
                        console.log(chalk_1.default.blue(`🎨 Generating ${type}: ${description}`));
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
                            (0, fs_1.writeFileSync)((0, path_1.resolve)(this.workingDirectory, outputPath), codeGenResult.code);
                            console.log(chalk_1.default.green(`✅ Generated: ${outputPath}`));
                        }
                        return codeGenResult;
                    }
                    catch (error) {
                        return { error: `Code generation failed: ${error.message}` };
                    }
                },
            }),
        };
    }
    // Claude Code style streaming with full autonomy
    async *streamChatWithFullAutonomy(messages, abortSignal) {
        if (abortSignal && !(abortSignal instanceof AbortSignal)) {
            throw new TypeError('Invalid AbortSignal provided');
        }
        // Apply AGGRESSIVE truncation to prevent prompt length errors
        const truncatedMessages = this.truncateMessages(messages, 100000); // REDUCED: 100k tokens safety margin
        const model = this.getModel();
        const tools = this.getAdvancedTools();
        try {
            // ADVANCED: Check completion protocol cache first (ultra-efficient)
            const lastUserMessage = truncatedMessages.filter(m => m.role === 'user').pop();
            const systemContext = truncatedMessages.filter(m => m.role === 'system').map(m => m.content).join('\n');
            if (lastUserMessage) {
                // Try completion protocol cache first (most efficient)
                const userContent = typeof lastUserMessage.content === 'string'
                    ? lastUserMessage.content
                    : Array.isArray(lastUserMessage.content)
                        ? lastUserMessage.content.map(part => typeof part === 'string' ? part : part.experimental_providerMetadata?.content || '').join('')
                        : String(lastUserMessage.content);
                const params = this.getProviderParams();
                const completionRequest = {
                    prefix: userContent,
                    context: systemContext.substring(0, 200), // REDUCED context length
                    maxTokens: Math.min(500, params.maxTokens), // REDUCED: Cap at 500 for completion cache
                    temperature: params.temperature,
                    model: this.currentModel
                };
                const protocolCompletion = await completion_protocol_cache_1.completionCache.getCompletion(completionRequest);
                if (protocolCompletion) {
                    yield { type: 'start', content: '🔮 Using completion pattern (ultra-efficient)...' };
                    yield { type: 'text_delta', content: protocolCompletion.completion };
                    yield { type: 'complete', content: `Protocol cache hit - ${protocolCompletion.tokensSaved} tokens saved!` };
                    return;
                }
                // Fallback to full response cache
                const cachedResponse = await token_cache_1.tokenCache.getCachedResponse(userContent, systemContext.substring(0, 200), // REDUCED context length  
                ['chat', 'autonomous']);
                if (cachedResponse) {
                    yield { type: 'start', content: '🎯 Using cached response...' };
                    yield { type: 'text_delta', content: cachedResponse.response };
                    yield { type: 'complete', content: 'Cache hit - tokens saved!' };
                    return;
                }
            }
            yield { type: 'start', content: 'Initializing autonomous AI assistant...' };
            const originalTokens = this.estimateMessagesTokens(messages);
            const truncatedTokens = this.estimateMessagesTokens(truncatedMessages);
            console.log(`📊 Message tokens: original=${originalTokens}, truncated=${truncatedTokens}, messages=${messages.length}→${truncatedMessages.length}`);
            const params = this.getProviderParams();
            console.log(`🔧 Provider params for ${this.getCurrentModelInfo().config.provider}: maxTokens=${params.maxTokens}, temp=${params.temperature}`);
            const provider = this.getCurrentModelInfo().config.provider;
            const safeMessages = this.sanitizeMessagesForProvider(provider, truncatedMessages);
            const streamOpts = {
                model,
                messages: safeMessages,
                tools,
                maxToolRoundtrips: 10,
                temperature: params.temperature,
                abortSignal,
                onStepFinish: (_evt) => { },
            };
            if (provider !== 'openai') {
                streamOpts.maxTokens = params.maxTokens;
            }
            const result = (0, ai_1.streamText)(streamOpts);
            let currentToolCalls = [];
            let accumulatedText = '';
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
                            // DUAL CACHE: Store both completion pattern AND full response
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
                                // Store in completion protocol cache (primary - most efficient) and full response cache once
                                const cacheParams = this.getProviderParams();
                                const completionRequest = {
                                    prefix: userContentStr,
                                    context: systemContext.substring(0, 200), // REDUCED context length
                                    maxTokens: Math.min(500, cacheParams.maxTokens), // REDUCED: Cap at 500 for completion cache
                                    temperature: cacheParams.temperature,
                                    model: this.currentModel
                                };
                                try {
                                    await completion_protocol_cache_1.completionCache.storeCompletion(completionRequest, accumulatedText.trim(), tokensUsed);
                                    // Store in full response cache (fallback)
                                    await token_cache_1.tokenCache.setCachedResponse(userContentStr, accumulatedText.trim(), systemContext.substring(0, 500), tokensUsed, ['chat', 'autonomous']);
                                }
                                catch (cacheError) {
                                    console.warn('Failed to cache response:', cacheError.message);
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
                                error: (delta?.error),
                                content: `Error: ${delta.error}`
                            };
                            break;
                    }
                }
                catch (deltaError) {
                    console.warn(`Stream delta error (${this.getCurrentModelInfo().config.provider}):`, deltaError.message);
                    yield {
                        type: 'error',
                        error: deltaError.message,
                        content: `Stream error: ${deltaError.message}`
                    };
                }
            }
            // Check if response was complete
            if (accumulatedText.length === 0) {
                console.warn(`No text received from ${this.getCurrentModelInfo().config.provider} model`);
                yield {
                    type: 'error',
                    error: 'Empty response',
                    content: 'No text was generated - possible parameter mismatch'
                };
            }
        }
        catch (error) {
            console.error(`Provider error (${this.getCurrentModelInfo().config.provider}):`, error);
            yield {
                type: 'error',
                error: error.message,
                content: `System error: ${error.message} (Provider: ${this.getCurrentModelInfo().config.provider})`
            };
        }
    }
    // Execute autonomous task with intelligent planning
    async *executeAutonomousTask(task, context) {
        yield { type: 'start', content: `🎯 Starting task: ${task}` };
        // First, analyze the task and create a plan
        yield { type: 'thinking', content: 'Analyzing task and creating execution plan...' };
        try {
            // If prebuilt messages are provided, use them directly to avoid duplicating large prompts
            if (context && Array.isArray(context.messages)) {
                const providedMessages = context.messages;
                // Note: streamChatWithFullAutonomy will handle truncation internally
                for await (const event of this.streamChatWithFullAutonomy(providedMessages)) {
                    yield event;
                }
                return;
            }
            const planningMessages = [
                {
                    role: 'system',
                    content: `AI dev assistant. CWD: ${this.workingDirectory}
Tools: read_file, write_file, explore_directory, execute_command, analyze_project, manage_packages, generate_code
Task: ${this.truncateForPrompt(task, 300)} 

${context ? this.truncateForPrompt((0, analysis_utils_1.safeStringifyContext)(context), 150) : ''}

Execute task autonomously with tools. Be direct.`
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
        }
        catch (error) {
            yield {
                type: 'error',
                error: error.message,
                content: `Autonomous execution failed: ${error.message}`
            };
        }
    }
    // Safely stringify and truncate large contexts to prevent prompt overflow - AGGRESSIVE
    safeStringifyContext(ctx, maxChars = 1000) {
        if (!ctx)
            return '{}';
        try {
            const str = JSON.stringify(ctx, (key, value) => {
                // Truncate long strings AGGRESSIVELY
                if (typeof value === 'string') {
                    return value.length > 100 ? value.slice(0, 100) + '…[truncated]' : value; // REDUCED from 512
                }
                // Limit large arrays
                if (Array.isArray(value)) {
                    const limited = value.slice(0, 20);
                    if (value.length > 20)
                        limited.push('…[+' + (value.length - 20) + ' more]');
                    return limited;
                }
                return value;
            });
            return str.length > maxChars ? str.slice(0, maxChars) + '…[truncated]' : str;
        }
        catch {
            return '[unstringifiable context]';
        }
    }
    // Helper methods for intelligent analysis
    analyzeFileContent(content, extension) {
        const analysis = {
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
                }
                catch {
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
    validateFileContent(content, extension) {
        const validation = { valid: true, errors: [] };
        switch (extension) {
            case '.json':
                try {
                    JSON.parse(content);
                }
                catch (error) {
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
    exploreDirectoryStructure(dirPath, maxDepth, includeHidden, filterBy) {
        // Implement intelligent directory exploration
        const explore = (currentPath, depth) => {
            if (depth > maxDepth)
                return null;
            try {
                const items = (0, fs_1.readdirSync)(currentPath, { withFileTypes: true });
                const structure = { files: [], directories: [] };
                for (const item of items) {
                    if (!includeHidden && item.name.startsWith('.'))
                        continue;
                    const itemPath = (0, path_1.join)(currentPath, item.name);
                    const relativePath = (0, path_1.relative)(this.workingDirectory, itemPath);
                    if (item.isDirectory()) {
                        const subStructure = explore(itemPath, depth + 1);
                        if (subStructure) {
                            structure.directories.push({
                                name: item.name,
                                path: relativePath,
                                ...subStructure
                            });
                        }
                    }
                    else if (item.isFile()) {
                        const fileInfo = {
                            name: item.name,
                            path: relativePath,
                            extension: (0, path_1.extname)(item.name),
                            size: (0, fs_1.statSync)(itemPath).size
                        };
                        // Apply filter
                        if (this.matchesFilter(fileInfo, filterBy)) {
                            structure.files.push(fileInfo);
                        }
                    }
                }
                return structure;
            }
            catch {
                return null;
            }
        };
        return explore(dirPath, 0);
    }
    matchesFilter(fileInfo, filterBy) {
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
    countFiles(structure) {
        let count = structure.files?.length || 0;
        if (structure.directories) {
            for (const dir of structure.directories) {
                count += this.countFiles(dir);
            }
        }
        return count;
    }
    generateDirectorySummary(structure) {
        const fileCount = this.countFiles(structure);
        const dirCount = structure.directories?.length || 0;
        const extensions = new Set();
        const collectExtensions = (struct) => {
            struct.files?.forEach((file) => {
                if (file.extension)
                    extensions.add(file.extension);
            });
            struct.directories?.forEach((dir) => collectExtensions(dir));
        };
        collectExtensions(structure);
        return `${fileCount} files, ${dirCount} directories. Languages: ${Array.from(extensions).join(', ')}`;
    }
    generateDirectoryRecommendations(structure) {
        const recommendations = [];
        // Analyze project structure and provide recommendations
        const hasPackageJson = structure.files?.some((f) => f.name === 'package.json');
        const hasTypeScript = structure.files?.some((f) => f.extension === '.ts');
        const hasTests = structure.files?.some((f) => f.name.includes('.test.') || f.name.includes('.spec.'));
        if (hasPackageJson && !hasTypeScript) {
            recommendations.push('Consider adding TypeScript for better type safety');
        }
        if (hasTypeScript && !hasTests) {
            recommendations.push('Add unit tests for better code quality');
        }
        return recommendations;
    }
    isDangerousCommand(command) {
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
    async performAdvancedProjectAnalysis(options) {
        const analysis = {
            timestamp: new Date(),
            directory: this.workingDirectory,
            options
        };
        // Basic project structure
        const packageJsonPath = (0, path_1.join)(this.workingDirectory, 'package.json');
        if ((0, fs_1.existsSync)(packageJsonPath)) {
            const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf-8'));
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
    detectLanguage(extension) {
        const langMap = {
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
    detectFramework(packageJson) {
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
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
        if (deps.svelte)
            return 'Svelte';
        if (deps.astro)
            return 'Astro';
        if (deps.remix)
            return 'Remix';
        return 'JavaScript/Node.js';
    }
    detectProjectLanguages(structure) {
        const languages = new Set();
        const collectLanguages = (struct) => {
            struct.files?.forEach((file) => {
                if (file.extension) {
                    const lang = this.detectLanguage(file.extension);
                    if (lang !== 'unknown')
                        languages.add(lang);
                }
            });
            struct.directories?.forEach((dir) => collectLanguages(dir));
        };
        collectLanguages(structure);
        return Array.from(languages);
    }
    async generateIntelligentCode(params) {
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
            const params = this.getProviderParams();
            const provider = this.getCurrentModelInfo().config.provider;
            const genOpts = {
                model,
                prompt: this.truncateForPrompt(codeGenPrompt, provider === 'openai' ? 120000 : 80000),
            };
            if (this.getCurrentModelInfo().config.provider !== 'openai') {
                genOpts.maxTokens = Math.min(params.maxTokens, 2000);
            }
            const result = await (0, ai_1.generateText)(genOpts);
            return {
                type,
                description,
                language,
                code: result.text,
                generated: new Date(),
                context: params
            };
        }
        catch (error) {
            return { error: `Code generation failed: ${error.message}` };
        }
    }
    // Model management
    getModel(modelName) {
        const model = modelName || this.currentModel || config_manager_1.simpleConfigManager.get('currentModel');
        const allModels = config_manager_1.simpleConfigManager.get('models');
        const configData = allModels[model];
        if (!configData) {
            throw new Error(`Model ${model} not found in configuration`);
        }
        // Configure providers with API keys properly
        // Create provider instances with API keys, then get the specific model
        switch (configData.provider) {
            case 'openai': {
                const apiKey = config_manager_1.simpleConfigManager.getApiKey(model);
                if (!apiKey)
                    throw new Error(`No API key found for model ${model} (OpenAI)`);
                const openaiProvider = (0, openai_1.createOpenAI)({ apiKey, compatibility: 'strict' });
                return openaiProvider(configData.model);
            }
            case 'anthropic': {
                const apiKey = config_manager_1.simpleConfigManager.getApiKey(model);
                if (!apiKey)
                    throw new Error(`No API key found for model ${model} (Anthropic)`);
                const anthropicProvider = (0, anthropic_1.createAnthropic)({ apiKey });
                return anthropicProvider(configData.model);
            }
            case 'google': {
                const apiKey = config_manager_1.simpleConfigManager.getApiKey(model);
                if (!apiKey)
                    throw new Error(`No API key found for model ${model} (Google)`);
                const googleProvider = (0, google_1.createGoogleGenerativeAI)({ apiKey });
                return googleProvider(configData.model);
            }
            case 'ollama': {
                // Ollama runs locally and does not require API keys
                const ollamaProvider = (0, ollama_ai_provider_1.createOllama)({});
                return ollamaProvider(configData.model);
            }
            default:
                throw new Error(`Unsupported provider: ${configData.provider}`);
        }
    }
    // Get provider-specific parameters
    getProviderParams(modelName) {
        const model = modelName || this.currentModel || config_manager_1.simpleConfigManager.get('currentModel');
        const allModels = config_manager_1.simpleConfigManager.get('models');
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
                }
                else if (configData.model.includes('gpt-4')) {
                    return { maxTokens: 4096, temperature: 1 }; // REDUCED from 4096
                }
                return { maxTokens: 3000, temperature: 1 };
            case 'anthropic':
                // Claude models - REDUCED for lighter requests
                if (configData.model.includes('claude-4') ||
                    configData.model.includes('claude-4-sonnet') ||
                    configData.model.includes('claude-sonnet-4')) {
                    return { maxTokens: 4000, temperature: 0.7 }; // REDUCED from 8192
                }
                return { maxTokens: 4000, temperature: 0.7 };
            case 'google':
                // Gemini models - REDUCED for lighter requests
                return { maxTokens: 1500, temperature: 0.7 }; // REDUCED from 8192
            case 'ollama':
                // Local models, more conservative
                return { maxTokens: 1000, temperature: 0.7 }; // REDUCED from 2048
            default:
                return { maxTokens: 8000, temperature: 0.7 }; // REDUCED from 4000
        }
    }
    // Build provider-specific options to satisfy differing token parameter names
    getProviderOptions(maxTokens) {
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
        }
        catch {
            return {};
        }
    }
    // Build a provider-safe message array by enforcing hard character caps
    sanitizeMessagesForProvider(provider, messages) {
        const maxTotalChars = provider === 'openai' ? 800000 : 400000; // conservative caps
        const maxPerMessage = provider === 'openai' ? 60000 : 40000;
        const safeMessages = [];
        let total = 0;
        const clamp = (text, limit) => {
            if (text.length <= limit)
                return text;
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
            if (total > maxTotalChars)
                break;
            // For tool messages, wrap clamped string as tool-friendly text content
            if (m.role === 'tool') {
                safeMessages.push({ ...m, content: [{ type: 'text', text: clamped }] });
            }
            else {
                const role = m.role;
                safeMessages.push({ role, content: clamped });
            }
        }
        // Then add the most recent non-system messages until we hit the cap
        const rest = messages.filter(m => m.role !== 'system');
        for (let i = Math.max(0, rest.length - 40); i < rest.length; i++) { // last 40 msgs
            const m = rest[i];
            const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
            const clamped = clamp(content, maxPerMessage);
            if (total + clamped.length > maxTotalChars)
                break;
            total += clamped.length;
            if (m.role === 'tool') {
                safeMessages.push({ ...m, content: [{ type: 'text', text: clamped }] });
            }
            else {
                const role = m.role;
                safeMessages.push({ role, content: clamped });
            }
        }
        return safeMessages;
    }
    // Configuration methods
    setWorkingDirectory(directory) {
        this.workingDirectory = (0, path_1.resolve)(directory);
        this.executionContext.clear(); // Reset context for new directory
    }
    getWorkingDirectory() {
        return this.workingDirectory;
    }
    setModel(modelName) {
        this.currentModel = modelName;
    }
    getCurrentModelInfo() {
        const allModels = config_manager_1.simpleConfigManager.get('models');
        const modelConfig = allModels[this.currentModel];
        return {
            name: this.currentModel,
            config: modelConfig || { provider: 'unknown', model: 'unknown' },
        };
    }
    validateApiKey() {
        try {
            const apiKey = config_manager_1.simpleConfigManager.getApiKey(this.currentModel);
            return !!apiKey;
        }
        catch {
            return false;
        }
    }
    // Get execution context for debugging/analysis
    getExecutionContext() {
        return new Map(this.executionContext);
    }
    // Clear execution context
    clearExecutionContext() {
        this.executionContext.clear();
    }
}
exports.AdvancedAIProvider = AdvancedAIProvider;
exports.advancedAIProvider = new AdvancedAIProvider();
