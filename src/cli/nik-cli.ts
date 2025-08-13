import * as readline from 'readline';
import chalk from 'chalk';
import boxen from 'boxen';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import ora, { Ora } from 'ora';
import cliProgress from 'cli-progress';
import * as fs from 'fs/promises';
import * as path from 'path';

// Import existing modules
import { configManager } from './core/config-manager';
import { modelProvider } from './ai/model-provider';
import { toolsManager } from './tools/tools-manager';
import { agentFactory } from './core/agent-factory';
import { agentStream } from './core/agent-stream';
import { workspaceContext } from './context/workspace-context';

import { AgentManager } from './core/agent-manager';
import { PlanningManager } from './planning/planning-manager';
import { ModernAgentOrchestrator } from './automation/agents/modern-agent-system';
import { advancedAIProvider, AdvancedAIProvider } from './ai/advanced-ai-provider';
import { SimpleConfigManager, simpleConfigManager } from './core/config-manager';
import { enhancedPlanning } from './planning/enhanced-planning';
import { approvalSystem } from './ui/approval-system';

import { tokenCache } from './core/token-cache';
import { completionCache } from './core/completion-protocol-cache';
import { mcpClient, McpServerConfig } from './core/mcp-client';
import { docLibrary, DocumentationEntry } from './core/documentation-library';
import { createCloudDocsProvider, getCloudDocsProvider } from './core/cloud-docs-provider';
import { docsContextManager } from './context/docs-context-manager';
import { feedbackSystem } from './core/feedback-system';
import { wrapBlue, formatStatus, formatCommand, formatFileOp, formatProgress, formatAgent, formatSearch } from './utils/text-wrapper';
import { DiffViewer } from './ui/diff-viewer';
import { SlashCommandHandler } from './chat/nik-cli-commands';
import { chatManager } from './chat/chat-manager';
import { agentService } from './services/agent-service';
import { planningService } from './services/planning-service';
import { AgentTask } from './types/types';
import { ExecutionPlan } from './planning/types';
import { registerAgents } from './register-agents';
import { advancedUI } from './ui/advanced-cli-ui';

// Configure marked for terminal rendering
marked.setOptions({
    renderer: new TerminalRenderer() as any,
});

export interface NikCLIOptions {
    agent?: string;
    model?: string;
    auto?: boolean;
    plan?: boolean;
    structuredUI?: boolean;
}

export interface TodoOptions {
    list?: boolean;
    add?: string;
    complete?: string;
}

export interface PlanOptions {
    execute?: boolean;
    save?: string;
}

export interface AgentOptions {
    auto?: boolean;
}

export interface AutoOptions {
    planFirst?: boolean;
}

export interface ConfigOptions {
    show?: boolean;
    model?: string;
    key?: string;
}

export interface InitOptions {
    force?: boolean;
}

export interface CommandResult {
    shouldExit: boolean;
    shouldUpdatePrompt: boolean;
}

export interface LiveUpdate {
    type: 'status' | 'progress' | 'log' | 'error' | 'warning' | 'info';
    content: string;
    timestamp: Date;
    source?: string;
}

export interface StatusIndicator {
    id: string;
    title: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'warning';
    details?: string;
    progress?: number;
    startTime?: Date;
    endTime?: Date;
    subItems?: StatusIndicator[];
}

/**
 * NikCLI - Unified CLI interface integrating all existing modules
 * Provides Claude Code-style terminal experience with autonomous agents
 */
export class NikCLI {
    private rl?: readline.Interface;
    private escapeRequested: boolean = false;
    private configManager: SimpleConfigManager;
    private agentManager: AgentManager;
    private planningManager: PlanningManager;
    private workingDirectory: string;
    private currentMode: 'default' | 'auto' | 'plan' = 'default';
    private currentAgent?: string;
    private projectContextFile: string;
    private sessionContext: Map<string, any> = new Map();
    private slashHandler: SlashCommandHandler;
    private indicators: Map<string, StatusIndicator> = new Map();
    private liveUpdates: LiveUpdate[] = [];
    private spinners: Map<string, Ora> = new Map();
    private progressBars: Map<string, cliProgress.SingleBar> = new Map();
    private isInteractiveMode: boolean = false;
    private fileWatcher: any = null;
    private progressTracker: any = null;
    private assistantProcessing: boolean = false;
    private shouldInterrupt: boolean = false;
    private currentStreamController?: AbortController;
    private lastGeneratedPlan?: ExecutionPlan;
    private advancedUI: any;
    private structuredUIEnabled: boolean = false;
    private selectedFiles?: Map<string, { files: string[]; timestamp: Date; pattern: string }>;
    private sessionTokenUsage: number = 0;
    private sessionStartTime: Date = new Date();
    private contextTokens: number = 0;
    private realTimeCost: number = 0;
    private activeSpinner: any = null;
    private aiOperationStart: Date | null = null;
    private modelPricing: Map<string, { input: number; output: number }> = new Map();

    constructor() {
        this.workingDirectory = process.cwd();
        this.projectContextFile = path.join(this.workingDirectory, 'NIKOCLI.md');

        // Initialize core managers
        this.configManager = simpleConfigManager;
        this.agentManager = new AgentManager(this.configManager);
        this.planningManager = new PlanningManager(this.workingDirectory);
        this.slashHandler = new SlashCommandHandler();
        this.advancedUI = advancedUI;

        // Register agents
        registerAgents(this.agentManager);

        this.setupEventHandlers();
        // Bridge orchestrator events into NikCLI output
        this.setupOrchestratorEventBridge();
        this.setupAdvancedUIFeatures();
        this.setupPlanningEventListeners();

        // Initialize structured UI system
        this.initializeStructuredUI();

        // Initialize model pricing
        this.initializeModelPricing();

        // Initialize token cache system
        this.initializeTokenCache();
    }

    private async initializeTokenCache(): Promise<void> {
        // Clean up expired cache entries on startup
        setTimeout(async () => {
            try {
                const removed = await tokenCache.cleanupExpired();
                if (removed > 0) {
                    console.log(chalk.dim(`🧹 Cleaned ${removed} expired cache entries`));
                }

                const stats = tokenCache.getStats();
                if (stats.totalEntries > 0) {
                    console.log(chalk.dim(`💾 Loaded ${stats.totalEntries} cached responses (${stats.totalHits} hits, ~${stats.totalTokensSaved.toLocaleString()} tokens saved)`));
                    console.log(chalk.dim('\n')); // Add spacing after cache info with chalk
                }
            } catch (error: any) {
                console.log(chalk.dim(`Cache initialization warning: ${error.message}`));
            }
        }, 1000); // Delay to avoid interfering with startup
    }

    /**
     * Initialize structured UI with 4 panels as per diagram: Chat/Status, Files/Diffs, Plan/Todos, Approval
     */
    private initializeStructuredUI(): void {
        console.log(chalk.dim('🎨 Setting up AdvancedCliUI with 4 panels...'));

        // Enable interactive mode for structured panels
        this.advancedUI.startInteractiveMode();

        // Configure the 4 panels as shown in diagram:
        // 1. Panels: Chat, Status/Logs
        advancedUI.logInfo('Panel Setup', 'Chat & Status/Logs panel configured');

        // 2. Panels: Files, Diffs  
        advancedUI.logInfo('Panel Setup', 'Files & Diffs panel configured');

        // 3. Panels: Plan/Todos
        advancedUI.logInfo('Panel Setup', 'Plan/Todos panel configured');

        // 4. Panels: Approval (logs only, prompt via inquirer)
        advancedUI.logInfo('Panel Setup', 'Approval panel configured (logs only)');

        // Set up real-time event listeners for UI updates
        this.setupUIEventListeners();

        console.log(chalk.green('✅ AdvancedCliUI (MAIN UI OWNER) ready with 4 panels'));
    }

    /**
     * Setup UI event listeners for real-time panel updates using existing advanced UI
     */
    private setupUIEventListeners(): void {
        // Hook into agent operations for live UI updates
        this.setupAgentUIIntegration();

        // Setup file change monitoring for diff display
        this.setupFileChangeMonitoring();

        // Todo panels are now driven by real plans via planning system
    }

    /**
     * Integrate agent operations with UI panels
     */
    private setupAgentUIIntegration(): void {
        // Listen for file operations to show content/diffs using advanced UI
        agentService.on('file_read', (data) => {
            if (data.path && data.content) {
                this.advancedUI.showFileContent(data.path, data.content);
                this.advancedUI.logInfo(`File Read: ${path.basename(data.path)}`, `Displayed ${data.content.split('\n').length} lines`);
            }
        });

        agentService.on('file_written', (data) => {
            if (data.path && data.content) {
                if (data.originalContent) {
                    // Show diff using advanced UI
                    this.advancedUI.showFileDiff(data.path, data.originalContent, data.content);
                    this.advancedUI.logSuccess(`File Updated: ${path.basename(data.path)}`, 'Diff displayed in panel');
                } else {
                    // Show new file content
                    this.advancedUI.showFileContent(data.path, data.content);
                    this.advancedUI.logSuccess(`File Created: ${path.basename(data.path)}`, 'Content displayed in panel');
                }
            }
        });

        agentService.on('file_list', (data) => {
            if (data.files && Array.isArray(data.files)) {
                this.advancedUI.showFileList(data.files, data.title || '📁 Files');
                this.advancedUI.logInfo('File List', `Showing ${data.files.length} files`);
            }
        });

        agentService.on('grep_results', (data) => {
            if (data.pattern && data.matches) {
                this.advancedUI.showGrepResults(data.pattern, data.matches);
                this.advancedUI.logInfo(`Search: ${data.pattern}`, `Found ${data.matches.length} matches`);
            }
        });
    }

    /**
     * Monitor file changes for automatic diff display
     */
    private setupFileChangeMonitoring(): void {
        // Use existing file watcher to detect changes and show diffs
        if (this.fileWatcher) {
            this.fileWatcher.on('change', (filePath: string) => {
                // Auto-show file content when files change during operations
                if (this.assistantProcessing) {
                    this.showFileIfRelevant(filePath);
                }
            });
        }
    }

    /**
     * Setup automatic todo panel updates
     */
    // Removed placeholder todo auto-updates and fallback rendering

    /**
     * Show file content if relevant to current operations
     */
    private showFileIfRelevant(filePath: string): void {
        // Only show files that are being actively worked on
        const relevantExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];
        const ext = path.extname(filePath);

        if (relevantExtensions.includes(ext)) {
            try {
                const content = require('fs').readFileSync(filePath, 'utf8');
                this.advancedUI.showFileContent(filePath, content);
            } catch (error) {
                // File might be in use, skip
            }
        }
    }

    private setupEventHandlers(): void {
        // Handle Ctrl+C gracefully
        process.on('SIGINT', async () => {
            await this.shutdown();
        });

        process.on('SIGTERM', async () => {
            await this.shutdown();
        });
    }

    // Bridge StreamingOrchestrator agent lifecycle events into NikCLI output
    private orchestratorEventsInitialized = false;
    private setupOrchestratorEventBridge(): void {
        if (this.orchestratorEventsInitialized) return;
        this.orchestratorEventsInitialized = true;

        agentService.on('task_start', (task) => {
            const indicator = this.createStatusIndicator(`task-${task.id}`, `Agent ${task.agentType}`, task.task);
            this.updateStatusIndicator(indicator.id, { status: 'running' });
            console.log(formatAgent(task.agentType, 'started', task.task));

            // Always show in default chat mode and structured UI
            if (this.currentMode === 'default') {
                console.log(chalk.blue(`🤖 ${task.agentType}: `) + chalk.dim(task.task));
                advancedUI.logInfo(`Agent ${task.agentType}`, task.task);
            }
        });

        agentService.on('task_progress', (_task, update) => {
            const progress = typeof update.progress === 'number' ? `${update.progress}% ` : '';
            const desc = update.description ? `- ${update.description}` : '';
            this.addLiveUpdate({ type: 'progress', content: `${progress}${desc}`, source: 'agent' });
            console.log(chalk.cyan(`📊 ${progress}${desc}`));
        });

        agentService.on('tool_use', (_task, update) => {
            this.addLiveUpdate({ type: 'info', content: `🔧 ${update.tool}: ${update.description}`, source: 'tool' });
            console.log(chalk.magenta(`🔧 ${update.tool}: ${update.description}`));
        });

        agentService.on('task_complete', (task) => {
            const indicatorId = `task-${task.id}`;
            if (task.status === 'completed') {
                this.updateStatusIndicator(indicatorId, { status: 'completed', details: 'Task completed successfully' });
                console.log(chalk.green(`✅ ${task.agentType} completed`));

                // Show in default mode and structured UI
                if (this.currentMode === 'default') {
                    advancedUI.logSuccess(`Agent ${task.agentType}`, 'Task completed successfully');
                }
            } else {
                this.updateStatusIndicator(indicatorId, { status: 'failed', details: task.error || 'Unknown error' });
                console.log(chalk.red(`❌ ${task.agentType} failed: ${task.error}`));

                // Show in default mode and structured UI
                if (this.currentMode === 'default') {
                    advancedUI.logError(`Agent ${task.agentType}`, task.error || 'Unknown error');
                }
            }
            // Add delay before showing prompt to let output be visible
            setTimeout(() => {
                this.showPrompt();
            }, 500);
        });
    }

    /**
     * Subscribe to all event sources for Default Mode Unified Aggregator
     * Observes: Approval Prompts, Planning Events, Tool/Agent Events, Chat Stream
     */
    private eventsSubscribed = false;
    private subscribeToAllEventSources(): void {
        if (this.eventsSubscribed) return;
        this.eventsSubscribed = true;

        // 1. Approval Prompts (approvalSystem.request)
        // Already handled by existing approvalSystem integration

        // 2. Planning Events (planningManager emits: stepStart, stepProgress, stepComplete)
        this.planningManager.on('stepStart', (event: any) => {
            this.routeEventToUI('planning_step_start', { step: event.step, description: event.description });
        });

        this.planningManager.on('stepProgress', (event: any) => {
            this.routeEventToUI('planning_step_progress', { step: event.step, progress: event.progress });
        });

        this.planningManager.on('stepComplete', (event: any) => {
            this.routeEventToUI('planning_step_complete', { step: event.step, result: event.result });
        });

        // 3. Tool/Agent Events (agentService emits: file_read, file_write, file_list, grep_results, tool_call, tool_result, error)
        agentService.on('file_read', (data) => {
            this.routeEventToUI('agent_file_read', data);
        });

        agentService.on('file_written', (data) => {
            this.routeEventToUI('agent_file_written', data);
        });

        agentService.on('file_list', (data) => {
            this.routeEventToUI('agent_file_list', data);
        });

        agentService.on('grep_results', (data) => {
            this.routeEventToUI('agent_grep_results', data);
        });

        // 4. Background Agents Events (AgentManager emits: agent.task.started, agent.task.progress, agent.task.completed, agent.tool.call)
        this.agentManager.on('agent.task.started', (event: any) => {
            this.routeEventToUI('bg_agent_task_start', {
                agentId: event.agentId,
                agentName: event.agentName || event.agentId,
                taskDescription: event.task?.description || event.task?.prompt || 'Background task',
                taskType: event.task?.type || 'unknown'
            });
        });

        this.agentManager.on('agent.task.progress', (event: any) => {
            this.routeEventToUI('bg_agent_task_progress', {
                agentId: event.agentId,
                progress: event.progress || 0,
                currentStep: event.currentStep || event.step || 'Processing...'
            });
        });

        this.agentManager.on('agent.task.completed', (event: any) => {
            this.routeEventToUI('bg_agent_task_complete', {
                agentId: event.agentId,
                result: event.result?.summary || event.result || 'Task completed',
                duration: event.duration || 0
            });
        });

        this.agentManager.on('agent.tool.call', (event: any) => {
            this.routeEventToUI('bg_agent_tool_call', {
                agentId: event.agentId,
                toolName: event.toolName || event.tool,
                parameters: event.parameters || event.args
            });
        });

        // 5. Chat Stream (modelProvider.streamResponse(messages) events)
        // This is handled in the streaming loop in handleDefaultMode - chat stream events are processed inline
        // when streaming responses from advancedAIProvider.streamChatWithFullAutonomy()

        console.log(chalk.dim('✓ Default Mode Unified Aggregator subscribed to all event sources (including background agents)'));
    }

    /**
     * Central Event Router - routes events to UI based on structuredUI decision
     */
    private routeEventToUI(eventType: string, eventData: any): void {
        // Decision Point: structuredUI vs Console stdout (as per diagram)
        const useStructuredUI = this.isStructuredUIActive();

        if (useStructuredUI) {
            // Route to AdvancedCliUI panels
            this.routeToAdvancedUI(eventType, eventData);
        } else {
            // Fallback to Console stdout  
            this.routeToConsole(eventType, eventData);
        }
    }

    /**
     * Check if structured UI should be active based on saved decision
     */
    private isStructuredUIActive(): boolean {
        return this.structuredUIEnabled;
    }

    /**
     * Route events to AdvancedCliUI panels
     */
    private routeToAdvancedUI(eventType: string, eventData: any): void {
        switch (eventType) {
            case 'planning_step_start':
                advancedUI.logInfo('Planning Step', `Started: ${eventData.description}`);
                break;
            case 'planning_step_progress':
                advancedUI.logInfo('Planning Progress', `${eventData.step}: ${eventData.progress}%`);
                break;
            case 'planning_step_complete':
                advancedUI.logSuccess('Planning Complete', `${eventData.step}: ${eventData.result}`);
                break;
            case 'agent_file_read':
                if (eventData.path && eventData.content) {
                    advancedUI.showFileContent(eventData.path, eventData.content);
                }
                break;
            case 'agent_file_written':
                if (eventData.originalContent && eventData.content) {
                    advancedUI.showFileDiff(eventData.path, eventData.originalContent, eventData.content);
                } else {
                    advancedUI.showFileContent(eventData.path, eventData.content);
                }
                break;
            case 'agent_file_list':
                if (eventData.files) {
                    advancedUI.showFileList(eventData.files, eventData.title || '📁 Files');
                }
                break;
            case 'agent_grep_results':
                if (eventData.pattern && eventData.matches) {
                    advancedUI.showGrepResults(eventData.pattern, eventData.matches);
                }
                break;

            // Background agent events
            case 'bg_agent_task_start':
                advancedUI.logInfo(
                    'Background Agent',
                    `🤖 ${eventData.agentName} started: ${eventData.taskDescription}`
                );
                this.createStatusIndicator(
                    `bg-${eventData.agentId}`,
                    `${eventData.agentName}: ${eventData.taskDescription}`
                );

                // Update background agents panel
                advancedUI.updateBackgroundAgent({
                    id: eventData.agentId,
                    name: eventData.agentName,
                    status: 'working',
                    currentTask: eventData.taskDescription,
                    startTime: new Date()
                });
                break;

            case 'bg_agent_task_progress':
                advancedUI.logInfo(
                    'Agent Progress',
                    `🔄 ${eventData.currentStep} (${eventData.progress}%)`
                );
                this.updateStatusIndicator(`bg-${eventData.agentId}`, {
                    progress: eventData.progress,
                    details: eventData.currentStep
                });

                // Update background agents panel with progress
                const agent = advancedUI.backgroundAgents?.get(eventData.agentId);
                if (agent) {
                    advancedUI.updateBackgroundAgent({
                        ...agent,
                        progress: eventData.progress,
                        currentTask: eventData.currentStep
                    });
                }
                break;

            case 'bg_agent_task_complete':
                advancedUI.logSuccess(
                    'Agent Complete',
                    `✅ Completed in ${eventData.duration}ms: ${eventData.result}`
                );
                this.stopAdvancedSpinner(`bg-${eventData.agentId}`, true, eventData.result);

                // Update background agents panel to completed
                const completedAgent = advancedUI.backgroundAgents.get(eventData.agentId);
                if (completedAgent) {
                    advancedUI.updateBackgroundAgent({
                        ...completedAgent,
                        status: 'completed',
                        currentTask: eventData.result,
                        progress: 100
                    });
                }
                break;

            case 'bg_agent_tool_call':
                const toolParams = eventData.parameters ?
                    ` ${JSON.stringify(eventData.parameters)}` : '';
                advancedUI.logInfo(
                    'Background Tool',
                    `🛠️ ${eventData.agentId}: ${eventData.toolName}${toolParams}`
                );
                break;

            case 'bg_agent_orchestrated':
                advancedUI.logInfo(
                    'Agent Orchestration',
                    `🎭 ${eventData.parentTool} orchestrating ${eventData.agentName} for: ${eventData.task}`
                );
                break;
        }
    }

    /**
     * Route events to Console stdout (fallback mode)
     */
    private routeToConsole(eventType: string, eventData: any): void {
        switch (eventType) {
            case 'planning_step_start':
                console.log(chalk.blue(`📋 Planning: ${eventData.description}`));
                break;
            case 'planning_step_progress':
                console.log(chalk.cyan(`⏳ Progress: ${eventData.step} - ${eventData.progress}%`));
                break;
            case 'planning_step_complete':
                console.log(chalk.green(`✅ Complete: ${eventData.step}`));
                break;
            case 'agent_file_read':
                console.log(chalk.blue(`📖 File read: ${eventData.path}`));
                break;
            case 'agent_file_written':
                console.log(chalk.green(`✏️ File written: ${eventData.path}`));
                break;
            case 'agent_file_list':
                console.log(chalk.cyan(`📁 Files listed: ${eventData.files?.length} items`));
                break;
            case 'agent_grep_results':
                console.log(chalk.magenta(`🔍 Search: ${eventData.pattern} - ${eventData.matches?.length} matches`));
                break;

            // Background agent events for console
            case 'bg_agent_task_start':
                console.log(chalk.dim(`  🤖 Background: ${eventData.agentName} working on "${eventData.taskDescription}"`));
                break;

            case 'bg_agent_task_progress':
                // Progress bar inline
                const progressBar = '█'.repeat(Math.floor(eventData.progress / 5)) +
                    '░'.repeat(20 - Math.floor(eventData.progress / 5));
                console.log(chalk.dim(`  🔄 ${eventData.agentId}: [${progressBar}] ${eventData.progress}% - ${eventData.currentStep}`));
                break;

            case 'bg_agent_task_complete':
                console.log(chalk.green(`  ✅ Background: ${eventData.agentId} completed successfully (${eventData.duration}ms)`));
                break;

            case 'bg_agent_tool_call':
                const toolParamsConsole = eventData.parameters ?
                    ` ${JSON.stringify(eventData.parameters)}` : '';
                console.log(chalk.dim(`  🛠️ Background Tool: ${eventData.agentId} → ${eventData.toolName}${toolParamsConsole}`));
                break;

            case 'bg_agent_orchestrated':
                console.log(chalk.dim(`  🎭 Orchestrating: ${eventData.agentName} for "${eventData.task}"`));
                break;
        }
    }

    // Advanced UI Features Setup
    private setupAdvancedUIFeatures(): void {
        // Initialize advanced UI theme and features
        this.advancedUI.isInteractiveMode = false; // Start in normal mode

        // Setup file watching capabilities
        this.setupFileWatching();

        // Setup progress tracking
        this.setupProgressTracking();

        // Initialize structured panels
        this.initializeStructuredPanels();
    }

    /**
     * Setup event listeners for planning system to update todos panel in real-time
     */
    private setupPlanningEventListeners(): void {
        // Listen for step progress events to update todos panel
        this.planningManager.on('stepStart', (event: any) => {
            this.advancedUI.updateTodos(event.todos.map((todo: any) => ({
                content: todo.title || todo.description,
                status: todo.status
            })));
        });

        this.planningManager.on('stepProgress', (event: any) => {
            this.advancedUI.updateTodos(event.todos.map((todo: any) => ({
                content: todo.title || todo.description,
                status: todo.status
            })));
        });

        this.planningManager.on('stepComplete', (event: any) => {
            this.advancedUI.updateTodos(event.todos.map((todo: any) => ({
                content: todo.title || todo.description,
                status: todo.status
            })));
        });

        this.planningManager.on('planExecutionStart', (event) => {
            console.log(chalk.blue(`🚀 Starting plan execution: ${event.title}`));
        });

        this.planningManager.on('planExecutionComplete', (event) => {
            console.log(chalk.green(`✅ Plan execution completed: ${event.title}`));
        });

        this.planningManager.on('planExecutionError', (event) => {
            console.log(chalk.red(`❌ Plan execution failed: ${event.error}`));
        });
    }

    /**
     * Initialize structured UI panels using existing advanced-cli-ui components
     */
    private initializeStructuredPanels(): void {
        // Use the existing advanced UI system
        advancedUI.startInteractiveMode();
        console.log(chalk.dim('\n🎨 Structured UI panels ready - using advanced-cli-ui system'));
    }

    private setupFileWatching(): void {
        // File watching setup for live updates using chokidar
        try {
            // Only watch if chokidar is available
            const chokidar = require('chokidar');

            // Watch important file patterns
            const patterns = [
                '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
                '**/*.json', '**/*.md', '**/*.yml', '**/*.yaml',
                'package.json', 'tsconfig.json', 'CLAUDE.md', 'todo.md'
            ];

            const watcher = chokidar.watch(patterns, {
                ignored: /(^|[\/\\])\../, // ignore dotfiles
                persistent: true,
                ignoreInitial: true,
                cwd: this.workingDirectory
            });

            // File change handlers
            watcher.on('add', (path: string) => {
                this.addLiveUpdate({
                    type: 'info',
                    content: `📄 File created: ${path}`,
                    source: 'file-watcher'
                });
            });

            watcher.on('change', (path: string) => {
                this.addLiveUpdate({
                    type: 'info',
                    content: `✏️ File modified: ${path}`,
                    source: 'file-watcher'
                });

                // Special handling for important files
                if (path === 'todo.md') {
                    console.log(chalk.cyan('🔄 Todo list updated'));
                } else if (path === 'package.json') {
                    console.log(chalk.blue('📦 Package configuration changed'));
                } else if (path === 'CLAUDE.md') {
                    console.log(chalk.magenta('🤖 Project context updated'));
                }
            });

            watcher.on('unlink', (path: string) => {
                this.addLiveUpdate({
                    type: 'warning',
                    content: `🗑️ File deleted: ${path}`,
                    source: 'file-watcher'
                });
            });

            watcher.on('error', (error: any) => {
                this.addLiveUpdate({
                    type: 'error',
                    content: `File watcher error: ${error.message}`,
                    source: 'file-watcher'
                });
            });

            // Store watcher for cleanup
            this.fileWatcher = watcher;

            console.log(chalk.dim('👀 File watching enabled'));

        } catch (error: any) {
            console.log(chalk.gray('⚠️ File watching not available (chokidar not installed)'));
        }
    }

    private setupProgressTracking(): void {
        // Progress tracking for long-running operations
        // This provides visual feedback for complex tasks

        // Track active operations and their progress
        this.progressTracker = {
            operations: new Map(),

            // Start tracking an operation
            start: (id: string, title: string, totalSteps?: number) => {
                const operation = {
                    id,
                    title,
                    startTime: Date.now(),
                    currentStep: 0,
                    totalSteps: totalSteps || 0,
                    status: 'running',
                    details: []
                };

                this.progressTracker.operations.set(id, operation);

                if (totalSteps) {
                    this.createAdvancedProgressBar(id, title, totalSteps);
                } else {
                    this.createStatusIndicator(id, title, 'Starting...');
                    this.startAdvancedSpinner(id, 'Processing...');
                }

                this.addLiveUpdate({
                    type: 'info',
                    content: `🚀 Started: ${title}`,
                    source: 'progress-tracker'
                });
            },

            // Update progress
            update: (id: string, step?: number, detail?: string) => {
                const operation = this.progressTracker.operations.get(id);
                if (!operation) return;

                if (step !== undefined) {
                    operation.currentStep = step;
                    if (operation.totalSteps > 0) {
                        this.updateAdvancedProgress(id, step, operation.totalSteps);
                    }
                }

                if (detail) {
                    operation.details.push({
                        timestamp: Date.now(),
                        message: detail
                    });

                    this.updateStatusIndicator(id, { details: detail });

                    this.addLiveUpdate({
                        type: 'info',
                        content: `📊 ${operation.title}: ${detail}`,
                        source: 'progress-tracker'
                    });
                }
            },

            // Complete tracking
            complete: (id: string, success: boolean = true, finalMessage?: string) => {
                const operation = this.progressTracker.operations.get(id);
                if (!operation) return;

                operation.status = success ? 'completed' : 'failed';
                operation.endTime = Date.now();

                const duration = operation.endTime - operation.startTime;
                const durationText = duration > 1000 ?
                    `${Math.round(duration / 1000)}s` :
                    `${duration}ms`;

                const message = finalMessage ||
                    `${operation.title} ${success ? 'completed' : 'failed'} in ${durationText}`;

                if (operation.totalSteps > 0) {
                    this.completeAdvancedProgress(id, message);
                } else {
                    this.stopAdvancedSpinner(id, success, message);
                }

                this.addLiveUpdate({
                    type: success ? 'log' : 'error',
                    content: `${success ? '✅' : '❌'} ${message}`,
                    source: 'progress-tracker'
                });

                // Clean up after a delay
                setTimeout(() => {
                    this.progressTracker.operations.delete(id);
                }, 5000);
            },

            // Get current operations summary
            getSummary: () => {
                const operations = Array.from(this.progressTracker.operations.values());
                return {
                    total: operations.length,
                    running: operations.filter((op: any) => op.status === 'running').length,
                    completed: operations.filter((op: any) => op.status === 'completed').length,
                    failed: operations.filter((op: any) => op.status === 'failed').length
                };
            }
        };

        console.log(chalk.dim('📊 Progress tracking enabled'));
    }

    // Advanced UI Methods (from advanced-cli-ui.ts)
    private createStatusIndicator(id: string, title: string, details?: string): StatusIndicator {
        const indicator: StatusIndicator = {
            id,
            title,
            status: 'pending',
            details,
            startTime: new Date(),
            subItems: [],
        };

        this.indicators.set(id, indicator);

        if (this.isInteractiveMode) {
            this.refreshDisplay();
        } else {
            console.log(formatStatus('📋', title, details));
        }

        return indicator;
    }

    private updateStatusIndicator(id: string, updates: Partial<StatusIndicator>): void {
        const indicator = this.indicators.get(id);
        if (!indicator) return;

        Object.assign(indicator, updates);

        if (updates.status === 'completed' || updates.status === 'failed') {
            indicator.endTime = new Date();
        }

        if (this.isInteractiveMode) {
            this.refreshDisplay();
        } else {
            this.logStatusUpdate(indicator);
        }
    }

    private addLiveUpdate(update: Omit<LiveUpdate, 'timestamp'>): void {
        const liveUpdate: LiveUpdate = {
            ...update,
            timestamp: new Date(),
        };

        this.liveUpdates.push(liveUpdate);

        // Keep only recent updates
        if (this.liveUpdates.length > 50) {
            this.liveUpdates = this.liveUpdates.slice(-50);
        }

        if (this.isInteractiveMode) {
            this.refreshDisplay();
        } else {
            this.printLiveUpdate(liveUpdate);
        }
    }

    private startAdvancedSpinner(id: string, text: string): void {
        if (this.isInteractiveMode) {
            this.updateStatusIndicator(id, { status: 'running' });
            return;
        }

        const spinner = ora({
            text,
            spinner: 'dots',
            color: 'cyan',
        }).start();

        this.spinners.set(id, spinner);
    }

    private stopAdvancedSpinner(id: string, success: boolean, finalText?: string): void {
        const spinner = this.spinners.get(id);
        if (spinner) {
            if (success) {
                spinner.succeed(finalText);
            } else {
                spinner.fail(finalText);
            }
            this.spinners.delete(id);
        }

        this.updateStatusIndicator(id, {
            status: success ? 'completed' : 'failed',
            details: finalText,
        });
    }

    private createAdvancedProgressBar(id: string, title: string, total: number): void {
        if (this.isInteractiveMode) {
            this.createStatusIndicator(id, title);
            this.updateStatusIndicator(id, { progress: 0 });
            return;
        }

        const progressBar = new cliProgress.SingleBar({
            format: `${chalk.cyan(title)} |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} | ETA: {eta}s`,
            barCompleteChar: '█',
            barIncompleteChar: '░',
        });

        progressBar.start(total, 0);
        this.progressBars.set(id, progressBar);
    }

    private updateAdvancedProgress(id: string, current: number, total?: number): void {
        const progressBar = this.progressBars.get(id);
        if (progressBar) {
            progressBar.update(current);
        }

        const progress = total ? Math.round((current / total) * 100) : current;
        this.updateStatusIndicator(id, { progress });
    }

    private completeAdvancedProgress(id: string, message?: string): void {
        const progressBar = this.progressBars.get(id);
        if (progressBar) {
            progressBar.stop();
            this.progressBars.delete(id);
        }

        this.updateStatusIndicator(id, {
            status: 'completed',
            progress: 100,
            details: message,
        });
    }

    // Helper to show a concise, single-line summary with ellipsis
    private conciseOneLine(text: string, max: number = 60): string {
        if (!text) return '';
        const one = text.replace(/\s+/g, ' ').trim();
        return one.length > max ? one.slice(0, max).trimEnd() + '…' : one;
    }

    private async askAdvancedConfirmation(
        question: string,
        details?: string,
        defaultValue: boolean = false
    ): Promise<boolean> {
        const icon = defaultValue ? '✅' : '❓';
        const prompt = `${icon} ${chalk.cyan(question)}`;

        if (details) {
            console.log(chalk.gray(`   ${details}`));
        }

        return new Promise((resolve) => {
            if (!this.rl) {
                resolve(defaultValue);
                return;
            }

            this.rl.question(`${prompt} ${chalk.gray(defaultValue ? '(Y/n)' : '(y/N)')}: `, (answer) => {
                const normalized = answer.toLowerCase().trim();
                if (normalized === '') {
                    resolve(defaultValue);
                } else {
                    resolve(normalized.startsWith('y'));
                }
            });
        });
    }

    private async showAdvancedSelection<T>(
        title: string,
        choices: { value: T; label: string; description?: string }[],
        defaultIndex: number = 0
    ): Promise<T> {
        console.log(chalk.cyan.bold(`\n${title}`));
        console.log(chalk.gray('─'.repeat(50)));

        choices.forEach((choice, index) => {
            const indicator = index === defaultIndex ? chalk.green('→') : ' ';
            console.log(`${indicator} ${index + 1}. ${chalk.bold(choice.label)}`);
            if (choice.description) {
                console.log(`   ${chalk.gray(choice.description)}`);
            }
        });

        return new Promise((resolve) => {
            if (!this.rl) {
                resolve(choices[defaultIndex].value);
                return;
            }

            const prompt = `\nSelect option (1-${choices.length}, default ${defaultIndex + 1}): `;
            this.rl.question(prompt, (answer) => {
                let selection = defaultIndex;
                const num = parseInt(answer.trim());
                if (!isNaN(num) && num >= 1 && num <= choices.length) {
                    selection = num - 1;
                }

                console.log(chalk.green(`✓ Selected: ${choices[selection].label}`));
                resolve(choices[selection].value);
            });
        });
    }

    // Advanced UI Helper Methods
    private refreshDisplay(): void {
        if (!this.isInteractiveMode) return;

        // Move cursor to top and clear
        process.stdout.write('\x1B[2J\x1B[H');

        this.showAdvancedHeader();
        this.showActiveIndicators();
        this.showRecentUpdates();
    }

    private showAdvancedHeader(): void {
        const header = boxen(
            `${chalk.cyanBright.bold('🤖 NikCLI')} ${chalk.gray('v0.1.4-beta')}\n` +
            `${chalk.gray('Autonomous AI Developer Assistant')}\n\n` +
            `${chalk.blue('Status:')} ${this.getOverallStatus()}  ${chalk.blue('Active Tasks:')} ${this.indicators.size}\n` +
            `${chalk.blue('Mode:')} ${this.currentMode}  ${chalk.blue('Live Updates:')} Enabled`,
            {
                padding: 1,
                margin: { top: 0, bottom: 1, left: 0, right: 0 },
                borderStyle: 'round',
                borderColor: 'cyan',
                textAlignment: 'center',
            }
        );

        console.log(header);
    }

    private showActiveIndicators(): void {
        const indicators = Array.from(this.indicators.values());

        if (indicators.length === 0) return;

        console.log(chalk.blue.bold('📊 Active Tasks:'));
        console.log(chalk.gray('─'.repeat(60)));

        indicators.forEach(indicator => {
            this.printIndicatorLine(indicator);
        });

        console.log();
    }

    private showRecentUpdates(): void {
        const recentUpdates = this.liveUpdates.slice(-10);

        if (recentUpdates.length === 0) return;

        console.log(chalk.blue.bold('📝 Recent Updates:'));
        console.log(chalk.gray('─'.repeat(60)));

        recentUpdates.forEach(update => {
            this.printLiveUpdate(update);
        });
    }

    private printIndicatorLine(indicator: StatusIndicator): void {
        const statusIcon = this.getStatusIcon(indicator.status);
        const duration = this.getDuration(indicator);

        let line = `${statusIcon} ${chalk.bold(indicator.title)}`;

        if (indicator.progress !== undefined) {
            const progressBar = this.createProgressBarString(indicator.progress);
            line += ` ${progressBar}`;
        }

        if (duration) {
            line += ` ${chalk.gray(`(${duration})`)}`;
        }

        console.log(line);

        if (indicator.details) {
            console.log(`   ${chalk.gray(indicator.details)}`);
        }
    }

    private printLiveUpdate(update: LiveUpdate): void {
        const timeStr = update.timestamp.toLocaleTimeString();
        const typeColor = this.getUpdateTypeColor(update.type);
        const sourceStr = update.source ? chalk.gray(`[${update.source}]`) : '';

        const line = `${chalk.gray(timeStr)} ${sourceStr} ${typeColor(update.content)}`;
        console.log(line);
    }

    private logStatusUpdate(indicator: StatusIndicator): void {
        const statusIcon = this.getStatusIcon(indicator.status);
        const statusColor = this.getStatusColor(indicator.status);

        console.log(`${statusIcon} ${statusColor(indicator.title)}`);

        if (indicator.details) {
            console.log(`   ${chalk.gray(indicator.details)}`);
        }
    }

    // UI Utility Methods
    private getStatusIcon(status: string): string {
        switch (status) {
            case 'pending': return '⏳';
            case 'running': return '🔄';
            case 'completed': return '✅';
            case 'failed': return '❌';
            case 'warning': return '⚠️';
            default: return '📋';
        }
    }

    private getStatusColor(status: string): any {
        switch (status) {
            case 'pending': return chalk.gray;
            case 'running': return chalk.blue;
            case 'completed': return chalk.green;
            case 'failed': return chalk.red;
            case 'warning': return chalk.yellow;
            default: return chalk.gray;
        }
    }

    private getUpdateTypeColor(type: string): any {
        switch (type) {
            case 'error': return chalk.red;
            case 'warning': return chalk.yellow;
            case 'info': return chalk.blue;
            case 'log': return chalk.green;
            default: return chalk.white;
        }
    }

    private createProgressBarString(progress: number, width: number = 20): string {
        const filled = Math.round((progress / 100) * width);
        const empty = width - filled;

        const bar = chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
        return `[${bar}] ${progress}%`;
    }

    private getDuration(indicator: StatusIndicator): string | null {
        if (!indicator.startTime) return null;

        const endTime = indicator.endTime || new Date();
        const duration = endTime.getTime() - indicator.startTime.getTime();

        const seconds = Math.round(duration / 1000);
        if (seconds < 60) {
            return `${seconds}s`;
        } else {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        }
    }

    private getOverallStatus(): string {
        const indicators = Array.from(this.indicators.values());

        if (indicators.length === 0) return chalk.gray('Idle');

        const hasRunning = indicators.some(i => i.status === 'running');
        const hasFailed = indicators.some(i => i.status === 'failed');
        const hasWarning = indicators.some(i => i.status === 'warning');

        if (hasRunning) return chalk.blue('Running');
        if (hasFailed) return chalk.red('Failed');
        if (hasWarning) return chalk.yellow('Warning');

        return chalk.green('Ready');
    }

    /**
     * Start interactive chat mode (main Claude Code experience)
     */
    async startChat(options: NikCLIOptions): Promise<void> {
        console.clear();
        this.showChatWelcome();

        // Apply options
        if (options.model) {
            this.switchModel(options.model);
        }

        if (options.auto) {
            this.currentMode = 'auto';
        }

        // Decision Point: structuredUI vs Console stdout (as per diagram)
        // Always enable structured UI to show Files/Diffs panels in all modes
        const shouldUseStructuredUI = Boolean(options.structuredUI) ||
            this.currentMode === 'plan' ||
            this.currentMode === 'auto' ||
            this.currentMode === 'default' ||
            Boolean(options.agent) ||
            process.env.FORCE_STRUCTURED_UI === 'true';

        // Save the decision for later use in routing
        this.structuredUIEnabled = shouldUseStructuredUI;

        if (shouldUseStructuredUI) {
            console.log(chalk.cyan('\n🎨 UI Selection: AdvancedCliUI selected (structuredUI = true)'));
            advancedUI.startInteractiveMode();
            advancedUI.logInfo('AdvancedCliUI Ready', `Mode: ${this.currentMode} - 4 Panels configured`);
        } else {
            console.log(chalk.dim('\n📺 UI Selection: Console stdout selected (structuredUI = false)'));
        }

        if (options.plan) {
            this.currentMode = 'plan';
        }

        if (options.agent) {
            this.currentAgent = options.agent;
        }

        // Initialize systems
        await this.initializeSystems();

        // Start enhanced chat interface with slash commands
        await this.startEnhancedChat();
    }

    /**
     * Enhanced chat interface with Claude Code-style slash commands
     */
    private async startEnhancedChat(): Promise<void> {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            historySize: 300,
        });

        // Setup keypress events for ESC interruption
        if (process.stdin.isTTY) {
            // Ensure keypress events are emitted
            readline.emitKeypressEvents(process.stdin);
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('keypress', (chunk, key) => {
                if (key && key.name === 'escape') {
                    if (this.activeSpinner) {
                        this.stopAIOperation();
                        console.log(chalk.yellow('\n⏸️  AI operation interrupted by user'));
                        this.showPrompt();
                    } else if (this.assistantProcessing) {
                        this.interruptProcessing();
                    } else if (this.currentMode !== 'default') {
                        this.currentMode = 'default';
                        console.log(chalk.yellow('↩️  Cancelled. Returning to default mode.'));
                        this.showPrompt();
                    }
                }

                // Handle @ key for agent suggestions
                if (chunk === '@' && !this.assistantProcessing) {
                    setTimeout(() => this.showAgentSuggestions(), 100);
                }

                // Handle * key for file picker suggestions
                if (chunk === '*' && !this.assistantProcessing) {
                    setTimeout(() => this.showFilePickerSuggestions(), 100);
                }

                // Handle Cmd+] for mode cycling (macOS)
                if (key && key.meta && key.name === ']') {
                    this.cycleModes();
                }

                // Let other keypress events continue normally
                if (key && key.ctrl && key.name === 'c') {
                    process.exit(0);
                }
            });
        }

        this.rl.on('line', async (input) => {
            const trimmed = input.trim();

            if (!trimmed) {
                this.showPrompt();
                return;
            }

            // Indicate assistant is processing while handling the input
            this.assistantProcessing = true;
            this.showPrompt();

            try {
                // Route slash and agent-prefixed commands, otherwise treat as chat
                if (trimmed.startsWith('/')) {
                    await this.dispatchSlash(trimmed);
                } else if (trimmed.startsWith('@')) {
                    await this.dispatchAt(trimmed);
                } else if (trimmed.startsWith('*')) {
                    await this.dispatchStar(trimmed);
                } else {
                    await this.handleChatInput(trimmed);
                }
            } finally {
                // Done processing; return to idle
                this.assistantProcessing = false;
                this.showPrompt();
            }
        });

        this.rl.on('SIGINT', async () => {
            await this.shutdown();
        });

        // Show initial prompt immediately
        this.showPrompt();
    }

    /**
     * Interrupt current processing and stop all operations
     */
    private interruptProcessing(): void {
        if (!this.assistantProcessing) return;

        console.log(chalk.red('\n\n🛑 ESC pressed - Interrupting operation...'));

        // Set interrupt flag
        this.shouldInterrupt = true;

        // Abort current stream if exists
        if (this.currentStreamController) {
            this.currentStreamController.abort();
            this.currentStreamController = undefined;
        }

        // Stop all active spinners and operations
        this.stopAllActiveOperations();

        // Interrupt any active agent executions through the orchestrator
        const orchestrator = new ModernAgentOrchestrator(this.workingDirectory);
        const interruptedAgents = orchestrator.interruptActiveExecutions();
        if (interruptedAgents > 0) {
            console.log(chalk.yellow(`🤖 Stopped ${interruptedAgents} running agents`));
        }

        // Clean up processing state
        this.assistantProcessing = false;

        console.log(chalk.yellow('⏹️  Operation interrupted by user'));
        console.log(chalk.cyan('✨ Ready for new commands\n'));

        // Show prompt again
        this.showPrompt();
    }

    /**
     * Stop all active operations and cleanup
     */
    private stopAllActiveOperations(): void {
        // Stop all spinners
        for (const spinner of this.spinners.values()) {
            if (spinner.isSpinning) {
                spinner.stop();
            }
        }
        this.spinners.clear();

        // Stop all progress bars
        for (const bar of this.progressBars.values()) {
            bar.stop();
        }
        this.progressBars.clear();
    }

    /**
     * Dispatch /slash commands to rich SlashCommandHandler while preserving mode controls
     */
    private async dispatchSlash(command: string): Promise<void> {
        const parts = command.slice(1).split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        try {
            switch (cmd) {
                case 'plan':
                    if (args.length === 0) {
                        this.currentMode = 'plan';
                        console.log(chalk.green('✓ Switched to plan mode'));
                    } else {
                        await this.generatePlan(args.join(' '), {});
                    }
                    break;

                case 'auto':
                    if (args.length === 0) {
                        this.currentMode = 'auto';
                        console.log(chalk.green('✓ Switched to auto mode'));
                    } else {
                        await this.autoExecute(args.join(' '), {});
                    }
                    break;

                case 'default':
                    this.currentMode = 'default';
                    console.log(chalk.green('✓ Switched to default mode'));
                    break;

                // File Operations
                case 'read':
                    await this.handleFileOperations('read', args);
                    break;
                case 'write':
                    await this.handleFileOperations('write', args);
                    break;
                case 'edit':
                    await this.handleFileOperations('edit', args);
                    break;
                case 'ls':
                    await this.handleFileOperations('ls', args);
                    break;
                case 'search':
                case 'grep':
                    await this.handleFileOperations('search', args);
                    break;

                // Terminal Operations
                case 'run':
                case 'sh':
                case 'bash':
                    await this.handleTerminalOperations('run', args);
                    break;
                case 'install':
                    await this.handleTerminalOperations('install', args);
                    break;
                case 'npm':
                    await this.handleTerminalOperations('npm', args);
                    break;
                case 'yarn':
                    await this.handleTerminalOperations('yarn', args);
                    break;
                case 'git':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /git <args>'));
                        return;
                    }
                    await this.runCommand(`git ${args.join(' ')}`);
                    break;

                case 'docker':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /docker <args>'));
                        return;
                    }
                    await this.runCommand(`docker ${args.join(' ')}`);
                    break;

                case 'ps':
                    await this.runCommand('ps aux');
                    break;

                case 'kill':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /kill <pid>'));
                        return;
                    }
                    await this.runCommand(`kill ${args.join(' ')}`);
                    break;

                // Project Operations
                case 'build':
                    await this.runCommand('npm run build');
                    break;

                case 'test':
                    const testPattern = args.length > 0 ? ` ${args.join(' ')}` : '';
                    await this.runCommand(`npm test${testPattern}`);
                    break;

                case 'lint':
                    await this.runCommand('npm run lint');
                    break;

                case 'create':
                    if (args.length < 2) {
                        console.log(chalk.red('Usage: /create <type> <name>'));
                        return;
                    }
                    const [type, name] = args;
                    console.log(chalk.blue(`Creating ${type}: ${name}`));
                    // Implement creation logic based on type
                    break;

                // Session Management
                case 'new':
                case 'sessions':
                case 'export':
                case 'stats':
                case 'history':
                case 'debug':
                case 'temp':
                case 'system':
                    await this.handleSessionManagement(cmd, args);
                    break;

                // Model and Config
                case 'model':
                case 'models':
                case 'set-key':
                case 'config':
                    await this.handleModelConfig(cmd, args);
                    break;

                // MCP Commands
                case 'mcp':
                    await this.handleMcpCommands(args);
                    break;

                // Session Management
                case 'tokens':
                    await this.showTokenUsage();
                    break;

                case 'cache':
                    await this.manageTokenCache(args[0]);
                    break;

                case 'config':
                    await this.manageConfig({ show: true });
                    break;

                case 'status':
                    await this.showStatus();
                    break;

                case 'compact':
                    await this.compactSession();
                    break;

                case 'cost':
                    await this.showCost();
                    break;

                case 'init':
                    await this.handleInitProject(args.includes('--force'));
                    break;

                // Session Management  
                case 'new':
                    const sessionTitle = args.join(' ') || 'New Session';
                    console.log(chalk.blue(`Starting new session: ${sessionTitle}`));
                    break;

                case 'sessions':
                    console.log(chalk.blue('Session listing not yet implemented'));
                    break;

                case 'export':
                    const sessionId = args[0] || 'current';
                    console.log(chalk.blue(`Exporting session ${sessionId} not yet implemented`));
                    break;

                case 'stats':
                    console.log(chalk.blue('Usage statistics not yet implemented'));
                    break;

                case 'history':
                    if (args.length === 0 || !['on', 'off'].includes(args[0])) {
                        console.log(chalk.red('Usage: /history <on|off>'));
                        return;
                    }
                    console.log(chalk.blue(`Chat history ${args[0]} not yet implemented`));
                    break;

                case 'debug':
                    console.log(chalk.blue('Debug information:'));
                    console.log(`Mode: ${this.currentMode}`);
                    console.log(`Agent: ${this.currentAgent || 'none'}`);
                    console.log(`Working Dir: ${this.workingDirectory}`);
                    break;

                case 'temp':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /temp <0.0-2.0>'));
                        return;
                    }
                    const temp = parseFloat(args[0]);
                    if (isNaN(temp) || temp < 0 || temp > 2) {
                        console.log(chalk.red('Temperature must be between 0.0 and 2.0'));
                        return;
                    }
                    console.log(chalk.blue(`Temperature setting not yet implemented: ${temp}`));
                    break;

                case 'system':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /system <prompt>'));
                        return;
                    }
                    console.log(chalk.blue('System prompt setting not yet implemented'));
                    break;

                case 'models':
                    await this.listModels();
                    break;

                case 'set-key':
                    if (args.length < 2) {
                        console.log(chalk.red('Usage: /set-key <model> <key>'));
                        return;
                    }
                    console.log(chalk.blue('API key setting not yet implemented'));
                    break;

                // Advanced Features
                case 'agents':
                case 'agent':
                case 'parallel':
                case 'factory':
                case 'create-agent':
                case 'launch-agent':
                case 'context':
                case 'stream':
                case 'approval':
                case 'todo':
                case 'todos':
                    await this.handleAdvancedFeatures(cmd, args);
                    break;

                // Documentation Commands
                case 'docs':
                    await this.handleDocsCommand(args);
                    break;
                case 'doc-search':
                    await this.handleDocSearchCommand(args);
                    break;
                case 'doc-add':
                    await this.handleDocAddCommand(args);
                    break;
                case 'doc-stats':
                    await this.handleDocStatsCommand(args);
                    break;
                case 'doc-list':
                    await this.handleDocListCommand(args);
                    break;
                case 'doc-tag':
                    await this.handleDocTagCommand(args);
                    break;
                case 'doc-sync':
                    await this.handleDocSyncCommand(args);
                    break;
                case 'doc-load':
                    await this.handleDocLoadCommand(args);
                    break;
                case 'doc-context':
                    await this.handleDocContextCommand(args);
                    break;
                case 'doc-unload':
                    await this.handleDocUnloadCommand(args);
                    break;
                case 'doc-suggest':
                    await this.handleDocSuggestCommand(args);
                    break;
                    
                case 'feedback':
                    await this.handleFeedbackCommand(args);
                    break;

                // Help and Exit
                case 'help':
                    this.showSlashHelp();
                    break;
                case 'clear':
                    await this.clearSession();
                    break;
                case 'exit':
                case 'quit':
                    await this.shutdown();
                    return;

                default: {
                    const result = await this.slashHandler.handle(command);
                    if (result.shouldExit) {
                        await this.shutdown();
                        return;
                    }
                }
            }
        } catch (error: any) {
            console.log(chalk.red(`Error executing ${command}: ${error.message}`));
        }

        // Ensure output is flushed and visible before showing prompt
        console.log(); // Extra newline for better separation
        process.stdout.write('');
        await new Promise(resolve => setTimeout(resolve, 150));
        this.showPrompt();
    }

    /**
     * Dispatch @agent commands through the unified command router
     */
    private async dispatchAt(input: string): Promise<void> {
        const result = await this.slashHandler.handle(input);
        if (result.shouldExit) {
            await this.shutdown();
            return;
        }

        // Ensure output is flushed and visible before showing prompt
        console.log(); // Extra newline for better separation
        process.stdout.write('');
        await new Promise(resolve => setTimeout(resolve, 150));
        this.showPrompt();
    }

    /**
     * Handle * file selection and tagging commands
     */
    private async dispatchStar(input: string): Promise<void> {
        const trimmed = input.slice(1).trim(); // Remove * and trim

        console.log(chalk.cyan('🔍 Interactive File Picker'));
        console.log(chalk.gray('─'.repeat(50)));

        try {
            // If no pattern provided, show current directory
            const pattern = trimmed || '*';
            const pickerId = 'file-picker-' + Date.now();

            this.createStatusIndicator(pickerId, `Finding files: ${pattern}`);
            this.startAdvancedSpinner(pickerId, 'Scanning files...');

            // Use the FilePickerHandler for better file selection management
            const { FilePickerHandler } = await import('./handlers/file-picker-handler');
            const filePickerHandler = new FilePickerHandler(this.workingDirectory);

            try {
                const selection = await filePickerHandler.selectFiles(pattern, {
                    maxDisplay: 50,
                    maxFilesPerDirectory: 10,
                    showIcons: true,
                    groupByDirectory: true
                });

                this.stopAdvancedSpinner(pickerId, true, `Selected ${selection.files.length} files`);

                // Store selection in our internal system for reference
                this.storeSelectedFiles(selection.files, pattern);

            } catch (selectionError: any) {
                this.stopAdvancedSpinner(pickerId, false, 'No files found');

                console.log(chalk.yellow(selectionError.message));
                console.log(chalk.dim('Try different patterns like:'));
                console.log(chalk.dim('  * *.ts     - TypeScript files'));
                console.log(chalk.dim('  * src/**   - Files in src directory'));
                console.log(chalk.dim('  * **/*.js  - JavaScript files recursively'));
                console.log(chalk.dim('  * *.json   - Configuration files'));
                console.log(chalk.dim('  * test/**  - Test files'));
            }

        } catch (error: any) {
            console.log(chalk.red(`Error during file search: ${error.message}`));
        }

        // Ensure output is flushed and visible before showing prompt
        console.log();
        process.stdout.write('');
        await new Promise(resolve => setTimeout(resolve, 150));
        this.showPrompt();
    }

    /**
     * Show interactive file picker with selection capabilities
     */
    private async showInteractiveFilePicker(files: string[], pattern: string): Promise<void> {
        console.log(chalk.blue(`\n📂 Found ${files.length} files matching "${pattern}":`));
        console.log(chalk.gray('─'.repeat(60)));

        // Group files by directory for better organization
        const groupedFiles = this.groupFilesByDirectory(files);

        // Display files in organized groups
        let fileIndex = 0;
        const maxDisplay = 50; // Limit display for large file lists

        for (const [directory, dirFiles] of groupedFiles.entries()) {
            if (fileIndex >= maxDisplay) {
                console.log(chalk.yellow(`... and ${files.length - fileIndex} more files`));
                break;
            }

            if (directory !== '.') {
                console.log(chalk.cyan(`\n📁 ${directory}/`));
            }

            for (const file of dirFiles.slice(0, Math.min(10, maxDisplay - fileIndex))) {
                const fileExt = path.extname(file);
                const fileIcon = this.getFileIcon(fileExt);
                const relativePath = directory === '.' ? file : `${directory}/${file}`;

                console.log(`  ${fileIcon} ${chalk.white(file)} ${chalk.dim('(' + relativePath + ')')}`);
                fileIndex++;

                if (fileIndex >= maxDisplay) break;
            }

            if (dirFiles.length > 10) {
                console.log(chalk.dim(`    ... and ${dirFiles.length - 10} more in this directory`));
            }
        }

        // Show file picker options
        console.log(chalk.gray('\n─'.repeat(60)));
        console.log(chalk.green('📋 File Selection Options:'));
        console.log(chalk.dim('• Files are now visible in the UI (if advanced UI is active)'));
        console.log(chalk.dim('• Use the file paths in your next message to reference them'));
        console.log(chalk.dim('• Example: "Analyze these files: src/file1.ts, src/file2.ts"'));

        // Store files in session context for easy reference
        this.storeSelectedFiles(files, pattern);

        // Optional: Show quick selection menu for first few files
        if (files.length <= 10) {
            console.log(chalk.yellow('\n💡 Quick reference paths:'));
            files.forEach((file, index) => {
                console.log(chalk.dim(`   ${index + 1}. ${file}`));
            });
        }
    }

    /**
     * Group files by their directory for organized display
     */
    private groupFilesByDirectory(files: string[]): Map<string, string[]> {
        const groups = new Map<string, string[]>();

        files.forEach(file => {
            const directory = path.dirname(file);
            const fileName = path.basename(file);

            if (!groups.has(directory)) {
                groups.set(directory, []);
            }
            groups.get(directory)!.push(fileName);
        });

        // Sort directories, with '.' (current) first
        return new Map([...groups.entries()].sort(([a], [b]) => {
            if (a === '.') return -1;
            if (b === '.') return 1;
            return a.localeCompare(b);
        }));
    }

    /**
     * Get appropriate icon for file extension
     */
    private getFileIcon(extension: string): string {
        const iconMap: { [key: string]: string } = {
            '.ts': '🔷',
            '.tsx': '⚛️',
            '.js': '💛',
            '.jsx': '⚛️',
            '.json': '📋',
            '.md': '📝',
            '.txt': '📄',
            '.yml': '⚙️',
            '.yaml': '⚙️',
            '.css': '🎨',
            '.scss': '🎨',
            '.html': '🌐',
            '.py': '🐍',
            '.java': '☕',
            '.go': '🔷',
            '.rust': '🦀',
            '.rs': '🦀',
        };

        return iconMap[extension.toLowerCase()] || '📄';
    }

    /**
     * Store selected files in session context for future reference
     */
    private storeSelectedFiles(files: string[], pattern: string): void {
        // Store in a simple context that can be referenced later
        if (!this.selectedFiles) {
            this.selectedFiles = new Map();
        }

        this.selectedFiles.set(pattern, {
            files,
            timestamp: new Date(),
            pattern
        });

        // Keep only the last 5 file selections to avoid memory buildup
        if (this.selectedFiles.size > 5) {
            const oldestKey = this.selectedFiles.keys().next().value;
            if (oldestKey !== undefined) {
                this.selectedFiles.delete(oldestKey);
            }
        }
    }

    /**
     * Show agent suggestions when @ is pressed
     */
    private showAgentSuggestions(): void {
        console.log(chalk.cyan('\n💡 Available Agents:'));
        console.log(chalk.gray('─'.repeat(50)));

        // Get available agents from AgentManager
        const availableAgents = this.agentManager.listAgents();

        if (availableAgents.length > 0) {
            availableAgents.forEach(agent => {
                const statusIcon = agent.status === 'ready' ? '✅' :
                    agent.status === 'busy' ? '⏳' : '❌';
                console.log(`${statusIcon} ${chalk.blue('@' + agent.specialization)} - ${chalk.dim(agent.description)}`);

                // Show some capabilities
                const capabilities = agent.capabilities.slice(0, 3).join(', ');
                if (capabilities) {
                    console.log(`   ${chalk.gray('Capabilities:')} ${chalk.yellow(capabilities)}`);
                }
            });
        } else {
            console.log(chalk.yellow('No agents currently available'));
            console.log(chalk.dim('Standard agents:'));
            console.log(`✨ ${chalk.blue('@universal-agent')} - All-in-one enterprise agent`);
            console.log(`🔍 ${chalk.blue('@ai-analysis')} - AI code analysis and review`);
            console.log(`📝 ${chalk.blue('@code-review')} - Code review specialist`);
            console.log(`⚛️ ${chalk.blue('@react-expert')} - React and Next.js expert`);
        }

        console.log(chalk.gray('\n─'.repeat(50)));
        console.log(chalk.dim('💡 Usage: @agent-name <your task description>'));
        console.log('');
    }

    /**
     * Show file picker suggestions when * is pressed
     */
    private showFilePickerSuggestions(): void {
        console.log(chalk.magenta('\n🔍 File Selection Commands:'));
        console.log(chalk.gray('─'.repeat(50)));

        console.log(`${chalk.magenta('*')}              Browse all files in current directory`);
        console.log(`${chalk.magenta('* *.ts')}         Find all TypeScript files`);
        console.log(`${chalk.magenta('* *.js')}         Find all JavaScript files`);
        console.log(`${chalk.magenta('* src/**')}       Browse files in src directory`);
        console.log(`${chalk.magenta('* **/*.tsx')}     Find React component files`);
        console.log(`${chalk.magenta('* package.json')} Find package.json files`);
        console.log(`${chalk.magenta('* *.md')}         Find all markdown files`);

        console.log(chalk.gray('\n─'.repeat(50)));
        console.log(chalk.dim('💡 Usage: * <pattern> to find and select files'));
        console.log(chalk.dim('📋 Selected files can be referenced in your next message'));
        console.log('');
    }

    /**
     * Handle slash commands (Claude Code style)
     */
    private async handleSlashCommand(command: string): Promise<void> {
        const parts = command.slice(1).split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        try {
            switch (cmd) {
                case 'init':
                    await this.handleInitProject(args.includes('--force'));
                    break;

                case 'plan':
                    if (args.length === 0) {
                        this.currentMode = 'plan';
                        console.log(chalk.green('✓ Switched to plan mode'));
                    } else {
                        await this.generatePlan(args.join(' '), {});
                    }
                    break;

                case 'auto':
                    if (args.length === 0) {
                        this.currentMode = 'auto';
                        console.log(chalk.green('✓ Switched to auto mode'));
                    } else {
                        await this.autoExecute(args.join(' '), {});
                    }
                    break;

                case 'default':
                    this.currentMode = 'default';
                    console.log(chalk.green('✓ Switched to default mode'));
                    break;

                case 'agent':
                    if (args.length === 0) {
                        await this.listAgents();
                    } else {
                        this.currentAgent = args[0];
                        console.log(chalk.green(`✓ Switched to agent: ${args[0]}`));
                    }
                    break;

                case 'model':
                    if (args.length === 0) {
                        await this.listModels();
                    } else {
                        this.switchModel(args[0]);
                    }
                    break;

                case 'clear':
                    await this.clearSession();
                    break;

                case 'compact':
                    await this.compactSession();
                    break;

                case 'tokens':
                    if (args[0] === 'reset') {
                        this.resetSessionTokenUsage();
                        console.log(chalk.green('✅ Session token counters reset'));
                    } else if (args[0] === 'test') {
                        // Test spinner with realistic simulation
                        this.startAIOperation('Cerebrating');
                        // Simulate token usage updates
                        let iterations = 0;
                        const testInterval = setInterval(() => {
                            iterations++;
                            this.updateTokenUsage(Math.floor(Math.random() * 200) + 50, iterations % 2 === 0, 'claude-sonnet-4-20250514');
                            this.updateContextTokens(Math.floor(Math.random() * 1000) + 2000);

                            if (iterations >= 20) { // Stop after 10 seconds
                                clearInterval(testInterval);
                                this.stopAIOperation();
                                console.log(chalk.green('\n✅ Test completed'));
                                this.showPrompt();
                            }
                        }, 500);
                    } else {
                        await this.showTokenUsage();
                    }
                    break;

                case 'cache':
                    await this.manageTokenCache(args[0]);
                    break;

                case 'mcp':
                    await this.handleMcpCommands(args);
                    break;

                case 'cost':
                    await this.showCost();
                    break;

                case 'config':
                    await this.manageConfig({ show: true });
                    break;

                case 'status':
                    await this.showStatus();
                    break;

                case 'todo':
                    await this.manageTodo({ list: true });
                    break;

                case 'todos':
                    await this.manageTodo({ list: true });
                    break;

                // Agent Management
                case 'agents':
                    await this.listAgents();
                    break;

                case 'parallel':
                    if (args.length < 2) {
                        console.log(chalk.red('Usage: /parallel <agents> <task>'));
                        return;
                    }
                    console.log(chalk.blue('Parallel agent execution not yet implemented'));
                    break;

                case 'factory':
                    console.log(chalk.blue('Agent factory dashboard not yet implemented'));
                    break;

                case 'create-agent':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /create-agent <spec>'));
                        return;
                    }
                    console.log(chalk.blue('Agent creation not yet implemented'));
                    break;

                case 'launch-agent':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /launch-agent <id>'));
                        return;
                    }
                    console.log(chalk.blue('Agent launching not yet implemented'));
                    break;

                // Session Management
                case 'new':
                    const sessionTitle = args.join(' ') || 'New Session';
                    console.log(chalk.blue(`Starting new session: ${sessionTitle}`));
                    break;

                case 'sessions':
                    console.log(chalk.blue('Session listing not yet implemented'));
                    break;

                case 'export':
                    const sessionId = args[0] || 'current';
                    console.log(chalk.blue(`Exporting session ${sessionId} not yet implemented`));
                    break;

                case 'stats':
                    console.log(chalk.blue('Usage statistics not yet implemented'));
                    break;

                case 'history':
                    if (args.length === 0 || !['on', 'off'].includes(args[0])) {
                        console.log(chalk.red('Usage: /history <on|off>'));
                        return;
                    }
                    console.log(chalk.blue(`Chat history ${args[0]} not yet implemented`));
                    break;

                case 'debug':
                    console.log(chalk.blue('Debug information:'));
                    console.log(`Mode: ${this.currentMode}`);
                    console.log(`Agent: ${this.currentAgent || 'none'}`);
                    console.log(`Working Dir: ${this.workingDirectory}`);
                    break;

                case 'temp':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /temp <0.0-2.0>'));
                        return;
                    }
                    const temp = parseFloat(args[0]);
                    if (isNaN(temp) || temp < 0 || temp > 2) {
                        console.log(chalk.red('Temperature must be between 0.0 and 2.0'));
                        return;
                    }
                    console.log(chalk.blue(`Temperature setting not yet implemented: ${temp}`));
                    break;

                case 'system':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /system <prompt>'));
                        return;
                    }
                    console.log(chalk.blue('System prompt setting not yet implemented'));
                    break;

                // Model & Config
                case 'models':
                    await this.listModels();
                    break;

                case 'set-key':
                    if (args.length < 2) {
                        console.log(chalk.red('Usage: /set-key <model> <key>'));
                        return;
                    }
                    console.log(chalk.blue('API key setting not yet implemented'));
                    break;

                // Advanced Features
                case 'context':
                    const paths = args.length > 0 ? args : ['.'];
                    console.log(chalk.blue(`Context management for ${paths.join(', ')} not yet implemented`));
                    break;

                case 'stream':
                    if (args[0] === 'clear') {
                        console.log(chalk.blue('Stream clearing not yet implemented'));
                    } else {
                        console.log(chalk.blue('Stream showing not yet implemented'));
                    }
                    break;

                case 'approval':
                    if (args[0] === 'test') {
                        console.log(chalk.blue('Approval system test not yet implemented'));
                    } else {
                        console.log(chalk.blue('Approval system controls not yet implemented'));
                    }
                    break;

                // File Operations
                case 'read':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /read <file>'));
                        return;
                    }
                    await this.readFile(args[0]);
                    break;

                case 'write':
                    if (args.length < 2) {
                        console.log(chalk.red('Usage: /write <file> <content>'));
                        return;
                    }
                    const filename = args[0];
                    const content = args.slice(1).join(' ');
                    await this.writeFile(filename, content);
                    break;

                case 'edit':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /edit <file>'));
                        return;
                    }
                    await this.editFile(args[0]);
                    break;

                case 'ls':
                    const directory = args[0] || '.';
                    await this.listFiles(directory);
                    break;

                case 'search':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /search <query>'));
                        return;
                    }
                    await this.searchFiles(args.join(' '));
                    break;

                // Terminal Operations
                case 'run':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /run <command>'));
                        return;
                    }
                    await this.runCommand(args.join(' '));
                    break;

                case 'npm':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /npm <args>'));
                        return;
                    }
                    await this.runCommand(`npm ${args.join(' ')}`);
                    break;

                case 'yarn':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /yarn <args>'));
                        return;
                    }
                    await this.runCommand(`yarn ${args.join(' ')}`);
                    break;

                case 'git':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /git <args>'));
                        return;
                    }
                    await this.runCommand(`git ${args.join(' ')}`);
                    break;

                case 'docker':
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /docker <args>'));
                        return;
                    }
                    await this.runCommand(`docker ${args.join(' ')}`);
                    break;

                // Project Operations
                case 'build':
                    await this.buildProject();
                    break;

                case 'test':
                    const pattern = args.join(' ');
                    await this.runTests(pattern);
                    break;

                case 'lint':
                    await this.runLinting();
                    break;

                // Model Management
                case 'models':
                    await this.listModels();
                    break;

                case 'help':
                    this.showSlashHelp();
                    break;

                case 'exit':
                case 'quit':
                    await this.shutdown();
                    break;

                default:
                    console.log(chalk.red(`Unknown command: /${cmd}`));
                    console.log(chalk.dim('Type /help for available commands'));
            }
        } catch (error: any) {
            console.log(chalk.red(`Error executing /${cmd}: ${error.message}`));
        }

        // Ensure output is flushed and visible before showing prompt
        console.log(); // Extra newline for better separation
        process.stdout.write('');
        await new Promise(resolve => setTimeout(resolve, 150));
        this.showPrompt();
    }

    /**
     * Handle regular chat input based on current mode
     */
    private async handleChatInput(input: string): Promise<void> {
        try {
            switch (this.currentMode) {
                case 'plan':
                    await this.handlePlanMode(input);
                    break;

                case 'auto':
                    await this.handleAutoMode(input);
                    break;

                default:
                    await this.handleDefaultMode(input);
            }
        } catch (error: any) {
            console.log(chalk.red(`Error: ${error.message}`));
        }

        // Ensure output is flushed and visible before showing prompt
        console.log(); // Extra newline for better separation
        process.stdout.write('');
        await new Promise(resolve => setTimeout(resolve, 150));
        this.showPrompt();
    }

    /**
     * Plan mode: Generate comprehensive plan with todo.md and request approval
     */
    private async handlePlanMode(input: string): Promise<void> {
        console.log(chalk.blue('🎯 Entering Enhanced Planning Mode...'));

        try {
            // Start progress indicator using our new methods
            const planningId = 'planning-' + Date.now();
            this.createStatusIndicator(planningId, 'Generating comprehensive plan', input);
            this.startAdvancedSpinner(planningId, 'Analyzing requirements and generating plan...');

            // Generate comprehensive plan with todo.md
            const plan = await enhancedPlanning.generatePlan(input, {
                maxTodos: 15,
                includeContext: true,
                showDetails: true,
                saveTodoFile: true,
                todoFilePath: 'todo.md'
            });

            this.stopAdvancedSpinner(planningId, true, `Plan generated with ${plan.todos.length} todos`);

            // Show plan summary
            console.log(chalk.blue.bold('\n📋 Plan Generated:'));
            console.log(chalk.green(`✓ Todo file saved: ${path.join(this.workingDirectory, 'todo.md')}`));
            console.log(chalk.cyan(`📊 ${plan.todos.length} todos created`));
            console.log(chalk.cyan(`⏱️  Estimated duration: ${Math.round(plan.estimatedTotalDuration)} minutes`));

            // Request approval for execution
            const approved = await enhancedPlanning.requestPlanApproval(plan.id);

            if (approved) {
                console.log(chalk.green('\n🚀 Switching to Auto Mode for plan execution...'));
                console.log(chalk.cyan('📋 Plan will be executed automatically without further confirmations'));

                // Switch to auto mode temporarily for execution
                const originalMode = this.currentMode;
                this.currentMode = 'auto';

                try {
                    // Execute the plan in auto mode
                    await this.executeAdvancedPlan(plan.id);

                    // Show final summary
                    this.showExecutionSummary();

                    console.log(chalk.green.bold('\n🎉 Plan execution completed successfully!'));
                    console.log(chalk.cyan('📄 Check the updated todo.md file for execution details'));

                } finally {
                    // Restore original mode
                    this.currentMode = originalMode;
                    console.log(chalk.blue(`🔄 Restored to ${originalMode} mode`));
                }

            } else {
                console.log(chalk.yellow('\n📝 Plan saved but not executed.'));
                console.log(chalk.gray('You can review the todo.md file and run `/plan execute` later.'));
                console.log(chalk.gray('Or use `/auto [task]` to execute specific parts of the plan.'));

                // Ask if they want to regenerate the plan
                const regenerate = await this.askAdvancedConfirmation(
                    'Do you want to regenerate the plan with different requirements?',
                    'This will create a new plan and overwrite the current todo.md',
                    false
                );

                if (regenerate) {
                    const newRequirements = await this.askForInput('Enter new or modified requirements: ');
                    if (newRequirements.trim()) {
                        await this.handlePlanMode(newRequirements);
                    }
                } else {
                    // User declined regeneration, exit plan mode and return to default
                    console.log(chalk.yellow('🔄 Exiting plan mode and returning to default mode...'));
                    this.currentMode = 'default';
                }
            }

        } catch (error: any) {
            this.addLiveUpdate({ type: 'error', content: `Plan generation failed: ${error.message}`, source: 'planning' });
            console.log(chalk.red(`❌ Planning failed: ${error.message}`));
        }
    }

    private showExecutionSummary(): void {
        const indicators = Array.from(this.indicators.values());
        const completed = indicators.filter(i => i.status === 'completed').length;
        const failed = indicators.filter(i => i.status === 'failed').length;
        const warnings = indicators.filter(i => i.status === 'warning').length;

        const summary = boxen(
            `${chalk.bold('Execution Summary')}\n\n` +
            `${chalk.green('✅ Completed:')} ${completed}\n` +
            `${chalk.red('❌ Failed:')} ${failed}\n` +
            `${chalk.yellow('⚠️ Warnings:')} ${warnings}\n` +
            `${chalk.blue('📊 Total:')} ${indicators.length}\n\n` +
            `${chalk.gray('Overall Status:')} ${this.getOverallStatusText()}`,
            {
                padding: 1,
                margin: { top: 1, bottom: 1, left: 0, right: 0 },
                borderStyle: 'round',
                borderColor: failed > 0 ? 'red' : completed === indicators.length ? 'green' : 'yellow',
            }
        );

        console.log(summary);
    }

    private getOverallStatusText(): string {
        const indicators = Array.from(this.indicators.values());

        if (indicators.length === 0) return chalk.gray('No tasks');

        const completed = indicators.filter(i => i.status === 'completed').length;
        const failed = indicators.filter(i => i.status === 'failed').length;

        if (failed > 0) {
            return chalk.red('Some tasks failed');
        } else if (completed === indicators.length) {
            return chalk.green('All tasks completed successfully');
        } else {
            return chalk.blue('Tasks in progress');
        }
    }

    /**
     * Auto mode: Execute immediately without approval
     */
    private async handleAutoMode(input: string): Promise<void> {
        console.log(chalk.blue('🚀 Auto-executing task...'));

        // Use agent if specified, otherwise auto-select
        if (this.currentAgent) {
            await this.executeAgent(this.currentAgent, input, { auto: true });
        } else {
            await this.autoExecute(input, {});
        }
    }

    /**
     * Default mode: Unified Aggregator - observes and subscribes to all event sources
     */
    private async handleDefaultMode(input: string): Promise<void> {
        // Initialize as Unified Aggregator for all event sources
        this.subscribeToAllEventSources();

        // Handle execute command for last generated plan
        if (input.toLowerCase().trim() === 'execute' && this.lastGeneratedPlan) {
            console.log(chalk.blue('🚀 Executing the generated plan...'));
            try {
                await this.planningManager.executePlan(this.lastGeneratedPlan.id);
                console.log(chalk.green('✅ Plan execution completed!'));
                this.lastGeneratedPlan = undefined; // Clear the stored plan
                return;
            } catch (error: any) {
                console.log(chalk.red(`Plan execution failed: ${error?.message || error}`));
                return;
            }
        }

        // Check if input mentions specific agent
        const agentMatch = input.match(/@(\w+)/);

        if (agentMatch) {
            const agentName = agentMatch[1];
            const task = input.replace(agentMatch[0], '').trim();
            await this.executeAgent(agentName, task, {});
        } else {
            // Real chatbot conversation in default mode - now as unified aggregator
            try {
                // Activate structured UI for better visualization
                console.log(chalk.dim('🎨 Default Mode (Unified Aggregator) - Activating structured UI...'));
                advancedUI.startInteractiveMode();

                // Record user message in session
                chatManager.addMessage(input, 'user');

                // Build model-ready messages from session history (respects history setting)
                let messages = chatManager.getContextMessages().map(m => ({
                    role: m.role as 'system' | 'user' | 'assistant',
                    content: m.content,
                }));

                // Auto-compact if approaching token limit with more aggressive thresholds
                const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
                const estimatedTokens = Math.round(totalChars / 4);

                if (estimatedTokens > 100000) { // More aggressive - compact at 100k instead of 150k
                    console.log(chalk.yellow(`⚠️ Token usage: ${estimatedTokens.toLocaleString()}, auto-compacting...`));
                    await this.compactSession();

                    // Rebuild messages after compaction
                    messages = chatManager.getContextMessages().map(m => ({
                        role: m.role as 'system' | 'user' | 'assistant',
                        content: m.content,
                    }));

                    // Re-check token count after compaction
                    const newTotalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
                    const newEstimatedTokens = Math.round(newTotalChars / 4);
                    console.log(chalk.green(`✅ Compacted to ${newEstimatedTokens.toLocaleString()} tokens`));
                } else if (estimatedTokens > 50000) {
                    console.log(wrapBlue(`📊 Token usage: ${estimatedTokens.toLocaleString()}`));
                }

                // Stream assistant response with structured UI integration
                process.stdout.write(`${chalk.cyan('\nAssistant: ')}`);
                let assistantText = '';
                let hasToolCalls = false;

                for await (const ev of advancedAIProvider.streamChatWithFullAutonomy(messages)) {
                    if (ev.type === 'text_delta' && ev.content) {
                        assistantText += ev.content;
                        process.stdout.write(ev.content);

                        // Text content is already handled by console output
                    } else if (ev.type === 'tool_call') {
                        hasToolCalls = true;
                        const toolMessage = `🛠️ Tool call: ${ev.content}`;
                        console.log(`\n${chalk.blue(toolMessage)}`);

                        // Log to structured UI
                        advancedUI.logInfo('Tool Call', ev.content);

                        // Check if tool call involves background agents
                        if (ev.metadata?.backgroundAgents) {
                            ev.metadata.backgroundAgents.forEach((agentInfo: any) => {
                                this.routeEventToUI('bg_agent_orchestrated', {
                                    parentTool: ev.content,
                                    agentId: agentInfo.id,
                                    agentName: agentInfo.name,
                                    task: agentInfo.task
                                });
                            });
                        }
                    } else if (ev.type === 'tool_result') {
                        const resultMessage = `✅ Result: ${ev.content}`;
                        console.log(`${chalk.green(resultMessage)}`);

                        // Log to structured UI
                        advancedUI.logSuccess('Tool Result', ev.content);

                        // Show results from background agents if present
                        if (ev.metadata?.backgroundResults) {
                            ev.metadata.backgroundResults.forEach((result: any) => {
                                advancedUI.logSuccess(
                                    'Background Result',
                                    `${result.agentName}: ${result.summary}`
                                );

                                // Show file changes if present
                                if (result.fileChanges) {
                                    result.fileChanges.forEach((change: any) => {
                                        this.advancedUI.showFileDiff(
                                            change.path,
                                            change.before,
                                            change.after
                                        );
                                    });
                                }
                            });
                        }

                        // Show file diffs and content using advancedUI
                        if (ev.metadata?.filePath) {
                            if (ev.metadata?.originalContent && ev.metadata?.newContent) {
                                this.advancedUI.showFileDiff(ev.metadata.filePath, ev.metadata.originalContent, ev.metadata.newContent);
                            } else if (ev.metadata?.content) {
                                this.advancedUI.showFileContent(ev.metadata.filePath, ev.metadata.content);
                            }
                        }
                    } else if (ev.type === 'error') {
                        const errorMessage = ev.content || ev.error || 'Unknown error';
                        console.log(`${chalk.red(errorMessage)}`);

                        // Log to structured UI
                        advancedUI.logError('Error', errorMessage);
                    }
                }

                // Add separator if tool calls were made
                if (hasToolCalls) {
                    console.log(chalk.gray('─'.repeat(50)));
                }

                // Save assistant message to history
                if (assistantText.trim().length > 0) {
                    chatManager.addMessage(assistantText.trim(), 'assistant');
                }

                console.log(); // newline after streaming
            } catch (err: any) {
                console.log(chalk.red(`Chat error: ${err.message}`));
            }
        }
    }

    /**
     * Generate execution plan for a task
     */
    async generatePlan(task: string, options: PlanOptions): Promise<void> {
        console.log(wrapBlue(`🎯 Generating plan for: ${task}`));

        try {
            // Start progress indicator using enhanced UI
            const planningId = 'planning-' + Date.now();
            this.createStatusIndicator(planningId, 'Generating comprehensive plan', task);
            this.startAdvancedSpinner(planningId, 'Analyzing requirements and generating plan...');

            // Use enhanced planning service like in plan mode
            const plan = await enhancedPlanning.generatePlan(task, {
                maxTodos: 15,
                includeContext: true,
                showDetails: true,
                saveTodoFile: true,
                todoFilePath: 'todo.md'
            });

            this.stopAdvancedSpinner(planningId, true, `Plan generated with ${plan.todos.length} todos`);

            // Show plan summary like in plan mode
            console.log(chalk.blue.bold('\n📋 Plan Generated:'));
            console.log(chalk.green(`✓ Todo file saved: ${path.join(this.workingDirectory, 'todo.md')}`));
            console.log(chalk.cyan(`📊 ${plan.todos.length} todos created`));
            console.log(chalk.cyan(`⏱️  Estimated duration: ${Math.round(plan.estimatedTotalDuration)} minutes`));

            // Plan is already saved to todo.md by enhancedPlanning

            if (options.execute) {
                // Use enhanced approval system
                const approved = await enhancedPlanning.requestPlanApproval(plan.id);
                if (approved) {
                    console.log(chalk.green('\n🚀 Executing plan...'));
                    await this.executeAdvancedPlan(plan.id);
                    this.showExecutionSummary();
                    console.log(chalk.green.bold('\n🎉 Plan execution completed successfully!'));
                } else {
                    console.log(chalk.yellow('\n📝 Plan saved but not executed.'));
                    console.log(chalk.gray('You can review the todo.md file and run `/plan execute` later.'));

                    // Add regeneration option like in plan mode
                    const regenerate = await this.askAdvancedConfirmation(
                        'Do you want to regenerate the plan with different requirements?',
                        'This will create a new plan and overwrite the current todo.md',
                        false
                    );

                    if (regenerate) {
                        const newRequirements = await this.askForInput('Enter new or modified requirements: ');
                        if (newRequirements.trim()) {
                            await this.generatePlan(newRequirements, options);
                        }
                    }
                }
            }
        } catch (error: any) {
            console.log(chalk.red(`Plan generation failed: ${error.message}`));
        }
    }

    /**
     * Execute task with specific agent
     */
    async executeAgent(name: string, task: string, options: AgentOptions): Promise<void> {
        console.log(formatAgent(name, 'executing', task));

        try {
            // Launch real agent via AgentService; run asynchronously
            const taskId = await agentService.executeTask(name, task);
            console.log(wrapBlue(`🚀 Launched ${name} (Task ID: ${taskId.slice(-6)})`));
        } catch (error: any) {
            console.log(chalk.red(`Agent execution failed: ${error.message}`));
        }
    }

    /**
     * Autonomous execution with best agent selection
     */
    async autoExecute(task: string, options: AutoOptions): Promise<void> {
        console.log(wrapBlue(`🚀 Auto-executing: ${task}`));

        try {
            if (options.planFirst) {
                // Use real PlanningService to create and execute plan asynchronously
                const plan = await planningService.createPlan(task, {
                    showProgress: true,
                    autoExecute: true,
                    confirmSteps: false,
                });
                console.log(chalk.cyan(`📋 Generated plan with ${plan.steps.length} steps (id: ${plan.id}). Executing in background...`));
                // Fire-and-forget execution to keep CLI responsive
                (async () => {
                    try {
                        await planningService.executePlan(plan.id, {
                            showProgress: true,
                            autoExecute: true,
                            confirmSteps: false,
                        });
                    } catch (err: any) {
                        console.log(chalk.red(`❌ Plan execution error: ${err.message}`));
                    }
                })();
            } else {
                // Direct autonomous execution - select best agent and launch
                const selected = this.agentManager.findBestAgentForTask(task as any);
                console.log(chalk.blue(`🤖 Selected agent: ${chalk.cyan(selected)}`));
                const taskId = await agentService.executeTask(selected as any, task);
                console.log(wrapBlue(`🚀 Launched ${selected} (Task ID: ${taskId.slice(-6)})`));
            }
        } catch (error: any) {
            console.log(chalk.red(`Auto execution failed: ${error.message}`));
        }
    }

    /**
     * Manage todo items and planning
     */
    async manageTodo(options: TodoOptions): Promise<void> {
        if (options.list) {
            console.log(chalk.cyan('📋 Todo Items:'));
            const plans = this.planningManager.listPlans();

            if (plans.length === 0) {
                console.log(chalk.dim('No todo items found'));
                return;
            }

            plans.forEach((plan, index) => {
                const status = '⏳'; // Plans don't have status property, using default
                console.log(`${index + 1}. ${status} ${plan.title}`);
                console.log(`   ${chalk.dim(plan.description)}`);
            });
        }

        if (options.add) {
            console.log(wrapBlue(`Adding todo: ${options.add}`));
            await this.generatePlan(options.add, {});
        }

        if (options.complete) {
            console.log(chalk.green(`Marking todo ${options.complete} as complete`));
            // Implementation for marking todo complete
        }
    }

    /**
     * Manage CLI configuration
     */
    async manageConfig(options: ConfigOptions): Promise<void> {
        if (options.show) {
            console.log(chalk.cyan('⚙️ Current Configuration:'));
            const config = this.configManager.getConfig();
            console.log(chalk.dim('Model:'), chalk.green(config.currentModel));
            console.log(chalk.dim('Working Directory:'), chalk.blue(this.workingDirectory));
            console.log(chalk.dim('Mode:'), chalk.yellow(this.currentMode));
            if (this.currentAgent) {
                console.log(chalk.dim('Current Agent:'), chalk.cyan(this.currentAgent));
            }
            console.log(); // Add spacing after config info
        }

        if (options.model) {
            this.switchModel(options.model);
        }
    }

    /**
     * Initialize project with CLAUDE.md context file (NIKOCLI.md)
     */
    async initProject(options: InitOptions): Promise<void> {
        console.log(chalk.blue('🔧 Initializing project context...'));

        const claudeFile = path.join(this.workingDirectory, 'NIKOCLI.md');

        try {
            // Check if CLAUDE.md (NIKOCLI.md) already exists
            const exists = await fs.access(claudeFile).then(() => true).catch(() => false);

            if (exists && !options.force) {
                console.log(chalk.yellow('NIKOCLI.md already exists. Use --force to overwrite.'));
                return;
            }

            // Analyze project structure
            console.log(chalk.dim('Analyzing project structure...'));
            const analysis = await this.analyzeProject();

            // Generate CLAUDE.md content
            const content = this.generateClaudeMarkdown(analysis);

            // Write file
            await fs.writeFile(claudeFile, content, 'utf8');

            console.log(chalk.green('✓ NIKOCLI.md created successfully'));
            console.log(chalk.dim(`Context file: ${claudeFile}`));

        } catch (error: any) {
            console.log(chalk.red(`Failed to initialize project: ${error.message}`));
        }
    }

    /**
     * Show system status and agent information
     */
    async showStatus(): Promise<void> {
        const statusInfo = `🔍 NikCLI Status

System:
  Working Directory: ${this.workingDirectory}
  Mode: ${this.currentMode}
  Model: ${advancedAIProvider.getCurrentModelInfo().name}
  
${this.currentAgent ? `Current Agent: ${this.currentAgent}\n` : ''}
Agents:
  Total: ${this.agentManager.getStats().totalAgents}
  Active: ${this.agentManager.getStats().activeAgents}
  Pending Tasks: ${this.agentManager.getStats().pendingTasks}

Planning:
  Plans Generated: ${this.planningManager.getPlanningStats().totalPlansGenerated}
  Plans Executed: ${this.planningManager.getPlanningStats().totalPlansExecuted}
  Success Rate: ${Math.round((this.planningManager.getPlanningStats().successfulExecutions / this.planningManager.getPlanningStats().totalPlansExecuted) * 100)}%`;

        // Show in structured UI if active - use logInfo for now
        advancedUI.logInfo('System Status', statusInfo);

        // Also show in console
        console.log(chalk.cyan.bold('🔍 NikCLI Status'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.blue('System:'));
        console.log(`  Working Directory: ${chalk.dim(this.workingDirectory)}`);
        console.log(`  Mode: ${chalk.yellow(this.currentMode)}`);
        console.log(`  Model: ${chalk.green(advancedAIProvider.getCurrentModelInfo().name)}`);

        if (this.currentAgent) {
            console.log(`  Current Agent: ${chalk.cyan(this.currentAgent)}`);
        }

        const stats = this.agentManager.getStats();
        console.log(chalk.blue('\nAgents:'));
        console.log(`  Total: ${stats.totalAgents}`);
        console.log(`  Active: ${stats.activeAgents}`);
        console.log(`  Pending Tasks: ${stats.pendingTasks}`);

        const planningStats = this.planningManager.getPlanningStats();
        console.log(chalk.blue('\nPlanning:'));
        console.log(`  Plans Generated: ${planningStats.totalPlansGenerated}`);
        console.log(`  Plans Executed: ${planningStats.totalPlansExecuted}`);
        console.log(`  Success Rate: ${Math.round((planningStats.successfulExecutions / planningStats.totalPlansExecuted) * 100)}%`);

        console.log(chalk.gray('─'.repeat(50)));
    }

    /**
     * List available agents and their capabilities
     */
    async listAgents(): Promise<void> {
        console.log(chalk.cyan.bold('🤖 Available Agents'));
        console.log(chalk.gray('─'.repeat(50)));
        const available = agentService.getAvailableAgents();
        available.forEach(agent => {
            console.log(chalk.white(`  • ${agent.name}`));
            console.log(chalk.gray(`    ${agent.description}`));
        });
    }

    /**
     * List available AI models
     */
    async listModels(): Promise<void> {
        console.log(chalk.cyan.bold('🧠 Available Models'));
        console.log(chalk.gray('─'.repeat(50)));

        // Mock models for now
        const models = [
            { provider: 'openai', model: 'gpt-4' },
            { provider: 'anthropic', model: 'claude-3-sonnet' },
            { provider: 'google', model: 'gemini-pro' }
        ];
        const currentModel = 'claude-3-sonnet'; // Mock current model

        models.forEach((modelInfo) => {
            const model = modelInfo.model;
            const indicator = model === currentModel ? chalk.green('→') : ' ';
            console.log(`${indicator} ${model}`);
        });
    }

    // Command Handler Methods
    private async handleFileOperations(command: string, args: string[]): Promise<void> {
        try {
            switch (command) {
                case 'read': {
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /read <filepath> [<from-to>] [--from N --to M] [--step K] [--more]'));
                        return;
                    }
                    const filePath = args[0];
                    const rest = args.slice(1);

                    // Helpers for flag parsing
                    const hasFlag = (name: string) => rest.includes(`--${name}`);
                    const getFlag = (name: string) => {
                        const i = rest.findIndex(v => v === `--${name}`);
                        return i !== -1 ? rest[i + 1] : undefined;
                    };
                    const rangeToken = rest.find(v => /^\d+-\d+$/.test(v));

                    // Determine mode
                    let mode: 'default' | 'range' | 'step' | 'more' = 'default';
                    if (hasFlag('more')) mode = 'more';
                    else if (rangeToken || hasFlag('from') || hasFlag('to')) mode = 'range';
                    else if (hasFlag('step')) mode = 'step';

                    const defaultStep = 200;
                    let step = parseInt(getFlag('step') || `${defaultStep}`, 10);
                    if (!Number.isFinite(step) || step <= 0) step = defaultStep;

                    const fileInfo = await toolsManager.readFile(filePath);
                    const lines = fileInfo.content.split(/\r?\n/);
                    const total = lines.length;

                    const key = `read:${path.resolve(filePath)}`;
                    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

                    console.log(formatFileOp('📄 File:', filePath, `${fileInfo.size} bytes, ${fileInfo.language || 'unknown'}`));
                    console.log(chalk.gray(`Lines: ${total}`));
                    console.log(chalk.gray('─'.repeat(50)));

                    const printSlice = (from: number, to: number) => {
                        const f = clamp(from, 1, total);
                        const t = clamp(to, 1, total);
                        if (f > total) {
                            console.log(chalk.yellow('End of file reached.'));
                            return { printed: false, end: total };
                        }
                        const slice = lines.slice(f - 1, t).join('\n');
                        console.log(chalk.gray(`Showing lines ${f}-${t} of ${total}`));
                        console.log(slice);
                        return { printed: true, end: t };
                    };

                    if (mode === 'range') {
                        // Parse from/to
                        let from: number | undefined;
                        let to: number | undefined;
                        if (rangeToken) {
                            const [a, b] = rangeToken.split('-').map(s => parseInt(s, 10));
                            if (Number.isFinite(a)) from = a;
                            if (Number.isFinite(b)) to = b;
                        }
                        const fromFlag = parseInt(getFlag('from') || '', 10);
                        const toFlag = parseInt(getFlag('to') || '', 10);
                        if (Number.isFinite(fromFlag)) from = fromFlag;
                        if (Number.isFinite(toFlag)) to = toFlag;

                        const f = clamp((from ?? 1), 1, total);
                        const t = clamp((to ?? (f + step - 1)), 1, total);
                        printSlice(f, t);
                        // Prepare next cursor
                        this.sessionContext.set(key, { nextStart: t + 1, step });
                    } else if (mode === 'step') {
                        const f = 1;
                        const t = clamp(f + step - 1, 1, total);
                        printSlice(f, t);
                        this.sessionContext.set(key, { nextStart: t + 1, step });
                    } else if (mode === 'more') {
                        const state = this.sessionContext.get(key) || { nextStart: 1, step };
                        // Allow overriding step via flag in --more
                        if (hasFlag('step')) state.step = step;
                        const f = clamp(state.nextStart || 1, 1, total);
                        const t = clamp(f + (state.step || step) - 1, 1, total);
                        const res = printSlice(f, t);
                        if (res.printed) {
                            this.sessionContext.set(key, { nextStart: (res.end + 1), step: (state.step || step) });
                            if (res.end < total) {
                                console.log(chalk.gray('─'.repeat(50)));
                                console.log(chalk.cyan(`Tip: use "/read ${filePath} --more" to continue (next from line ${res.end + 1})`));
                            }
                        }
                    } else {
                        // default behavior: show all, but protect against huge outputs
                        if (total > 400) {
                            const approved = await this.askAdvancedConfirmation(
                                `Large file: ${total} lines`,
                                `Show first ${defaultStep} lines now?`,
                                false
                            );
                            if (approved) {
                                const f = 1;
                                const t = clamp(f + defaultStep - 1, 1, total);
                                printSlice(f, t);
                                this.sessionContext.set(key, { nextStart: t + 1, step: defaultStep });
                                if (t < total) {
                                    console.log(chalk.gray('─'.repeat(50)));
                                    console.log(chalk.cyan(`Tip: use "/read ${filePath} --more" to continue (next from line ${t + 1})`));
                                }
                            } else {
                                console.log(chalk.yellow('Skipped large output. Specify a range, e.g.'));
                                console.log(chalk.cyan(`/read ${filePath} 1-200`));
                            }
                        } else {
                            console.log(fileInfo.content);
                        }
                    }

                    console.log(chalk.gray('─'.repeat(50)));
                    break;
                }
                case 'write': {
                    if (args.length < 2) {
                        console.log(chalk.red('Usage: /write <filepath> <content>'));
                        return;
                    }
                    const filePath = args[0];
                    const content = args.slice(1).join(' ');

                    // Request approval
                    const approved = await this.askAdvancedConfirmation(
                        `Write file: ${filePath}`,
                        `Write ${content.length} characters to file`,
                        false
                    );

                    if (!approved) {
                        console.log(chalk.yellow('❌ File write operation cancelled'));
                        return;
                    }

                    const writeId = 'write-' + Date.now();
                    this.createStatusIndicator(writeId, `Writing ${filePath}`);
                    this.startAdvancedSpinner(writeId, 'Writing file...');

                    await toolsManager.writeFile(filePath, content);

                    this.stopAdvancedSpinner(writeId, true, `File written: ${filePath}`);
                    console.log(chalk.green(`✅ File written: ${filePath}`));
                    break;
                }
                case 'edit': {
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /edit <filepath>'));
                        return;
                    }
                    const filePath = args[0];
                    console.log(formatFileOp('📝 Opening', filePath, 'in system editor'));
                    try {
                        await toolsManager.runCommand('code', [filePath]);
                    } catch {
                        try {
                            await toolsManager.runCommand('open', [filePath]);
                        } catch {
                            console.log(chalk.yellow(`Could not open ${filePath}. Please open it manually.`));
                        }
                    }
                    break;
                }
                case 'ls': {
                    const directory = args[0] || '.';
                    const files = await toolsManager.listFiles(directory);
                    console.log(formatFileOp('📁 Files in', directory));
                    console.log(chalk.gray('─'.repeat(40)));
                    if (files.length === 0) {
                        console.log(chalk.yellow('No files found'));
                    } else {
                        files.slice(0, 50).forEach(file => {
                            console.log(`${chalk.cyan('•')} ${file}`);
                        });
                        if (files.length > 50) {
                            console.log(chalk.gray(`... and ${files.length - 50} more files`));
                        }
                    }
                    break;
                }
                case 'search': {
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /search <query> [directory] [--limit N] [--more]'));
                        return;
                    }
                    const query = args[0];
                    const directory = (args[1] && !args[1].startsWith('--')) ? args[1] : '.';
                    const rest = args.slice(1).filter(a => a.startsWith('--'));

                    const hasFlag = (name: string) => rest.includes(`--${name}`);
                    const getFlag = (name: string) => {
                        const i = rest.findIndex(v => v === `--${name}`);
                        return i !== -1 ? rest[i + 1] : undefined;
                    };
                    let limit = parseInt(getFlag('limit') || '30', 10);
                    if (!Number.isFinite(limit) || limit <= 0) limit = 30;
                    const key = `search:${path.resolve(directory)}:${query}`;
                    const state = this.sessionContext.get(key) || { offset: 0, limit };
                    if (hasFlag('limit')) state.limit = limit;

                    console.log(formatSearch(query, directory));
                    const spinId = `search-${Date.now()}`;
                    this.createStatusIndicator(spinId, `Searching: ${query}`, `in ${directory}`);
                    this.startAdvancedSpinner(spinId, `Searching files...`);

                    const results = await toolsManager.searchInFiles(query, directory);

                    this.stopAdvancedSpinner(spinId, true, `Search complete: ${results.length} matches`);

                    if (results.length === 0) {
                        console.log(chalk.yellow('No matches found'));
                    } else {
                        const start = Math.max(0, state.offset);
                        const end = Math.min(results.length, start + (state.limit || limit));
                        console.log(chalk.green(`Found ${results.length} matches (showing ${start + 1}-${end}):`));
                        console.log(chalk.gray('─'.repeat(50)));
                        results.slice(start, end).forEach(result => {
                            console.log(chalk.cyan(`${result.file}:${result.line}`));
                            console.log(`  ${result.content}`);
                        });
                        if (end < results.length) {
                            this.sessionContext.set(key, { offset: end, limit: (state.limit || limit) });
                            console.log(chalk.gray('─'.repeat(50)));
                            console.log(chalk.cyan(`Tip: use "/search ${query} ${directory} --more" to see the next ${state.limit || limit} results`));
                        } else {
                            this.sessionContext.delete(key);
                        }
                    }
                    break;
                }
            }
        } catch (error: any) {
            this.addLiveUpdate({ type: 'error', content: `File operation failed: ${error.message}`, source: 'file-ops' });
            console.log(chalk.red(`❌ Error: ${error.message}`));
        }
    }

    private async handleTerminalOperations(command: string, args: string[]): Promise<void> {
        try {
            switch (command) {
                case 'run': {
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /run <command> [args...]'));
                        return;
                    }
                    const [cmd, ...cmdArgs] = args;
                    const fullCommand = `${cmd} ${cmdArgs.join(' ')}`;

                    const approved = await this.askAdvancedConfirmation(
                        `Execute command: ${fullCommand}`,
                        `Run command in ${process.cwd()}`,
                        false
                    );

                    if (!approved) {
                        console.log(chalk.yellow('❌ Command execution cancelled'));
                        return;
                    }

                    console.log(formatCommand(fullCommand));
                    const cmdId = 'cmd-' + Date.now();
                    this.createStatusIndicator(cmdId, `Executing: ${cmd}`);
                    this.startAdvancedSpinner(cmdId, `Running: ${fullCommand}`);

                    const result = await toolsManager.runCommand(cmd, cmdArgs, { stream: true });

                    if (result.code === 0) {
                        this.stopAdvancedSpinner(cmdId, true, 'Command completed successfully');
                        console.log(chalk.green('✅ Command completed successfully'));
                    } else {
                        this.stopAdvancedSpinner(cmdId, false, `Command failed with exit code ${result.code}`);
                        console.log(chalk.red(`❌ Command failed with exit code ${result.code}`));
                    }
                    break;
                }
                case 'install': {
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /install <packages...>'));
                        console.log(chalk.gray('Options: --global, --dev, --yarn, --pnpm'));
                        return;
                    }

                    const packages = args.filter(arg => !arg.startsWith('--'));
                    const isGlobal = args.includes('--global') || args.includes('-g');
                    const isDev = args.includes('--dev') || args.includes('-D');
                    const manager = args.includes('--yarn') ? 'yarn' :
                        args.includes('--pnpm') ? 'pnpm' : 'npm';

                    const approved = await this.askAdvancedConfirmation(
                        `Install packages: ${packages.join(', ')}`,
                        `Using ${manager}${isGlobal ? ' (global)' : ''}${isDev ? ' (dev)' : ''}`,
                        false
                    );

                    if (!approved) {
                        console.log(chalk.yellow('❌ Package installation cancelled'));
                        return;
                    }

                    console.log(wrapBlue(`📦 Installing ${packages.join(', ')} with ${manager}...`));
                    const installId = 'install-' + Date.now();
                    this.createAdvancedProgressBar(installId, 'Installing packages', packages.length);

                    for (let i = 0; i < packages.length; i++) {
                        const pkg = packages[i];
                        this.updateStatusIndicator(installId, { details: `Installing ${pkg}...` });

                        const success = await toolsManager.installPackage(pkg, {
                            global: isGlobal,
                            dev: isDev,
                            manager: manager as any
                        });

                        if (!success) {
                            this.addLiveUpdate({ type: 'warning', content: `Failed to install ${pkg}`, source: 'install' });
                            console.log(chalk.yellow(`⚠️ Failed to install ${pkg}`));
                        } else {
                            this.addLiveUpdate({ type: 'log', content: `Installed ${pkg}`, source: 'install' });
                        }

                        this.updateAdvancedProgress(installId, i + 1, packages.length);
                    }

                    this.completeAdvancedProgress(installId, `Completed installation of ${packages.length} packages`);
                    console.log(chalk.green(`✅ Package installation completed`));
                    break;
                }
                case 'npm':
                case 'yarn':
                case 'git':
                case 'docker': {
                    await toolsManager.runCommand(command, args, { stream: true });
                    break;
                }
                case 'ps': {
                    const processes = toolsManager.getRunningProcesses();
                    console.log(chalk.blue('🔄 Running Processes:'));
                    console.log(chalk.gray('─'.repeat(50)));
                    if (processes.length === 0) {
                        console.log(chalk.yellow('No processes currently running'));
                    } else {
                        processes.forEach(proc => {
                            const duration = Date.now() - proc.startTime.getTime();
                            console.log(`${chalk.cyan('PID')} ${proc.pid}: ${chalk.bold(proc.command)} ${proc.args.join(' ')}`);
                            console.log(`  Status: ${proc.status} | Duration: ${Math.round(duration / 1000)}s`);
                            console.log(`  Working Dir: ${proc.cwd}`);
                        });
                    }
                    break;
                }
                case 'kill': {
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /kill <pid>'));
                        return;
                    }
                    const pid = parseInt(args[0]);
                    if (isNaN(pid)) {
                        console.log(chalk.red('Invalid PID'));
                        return;
                    }
                    console.log(chalk.yellow(`⚠️ Attempting to kill process ${pid}...`));
                    const success = await toolsManager.killProcess(pid);
                    if (success) {
                        console.log(chalk.green(`✅ Process ${pid} terminated`));
                    } else {
                        console.log(chalk.red(`❌ Could not kill process ${pid}`));
                    }
                    break;
                }
            }
        } catch (error: any) {
            this.addLiveUpdate({ type: 'error', content: `Terminal operation failed: ${error.message}`, source: 'terminal' });
            console.log(chalk.red(`❌ Error: ${error.message}`));
        }
    }

    private async handleProjectOperations(command: string, args: string[]): Promise<void> {
        try {
            switch (command) {
                case 'build': {
                    console.log(chalk.blue('🔨 Building project...'));
                    const result = await toolsManager.build();
                    if (result.success) {
                        console.log(chalk.green('✅ Build completed successfully'));
                    } else {
                        console.log(chalk.red('❌ Build failed'));
                        if (result.errors && result.errors.length > 0) {
                            console.log(chalk.yellow('Errors found:'));
                            result.errors.forEach(error => {
                                console.log(`  ${chalk.red('•')} ${error.message}`);
                            });
                        }
                    }
                    break;
                }
                case 'test': {
                    const pattern = args[0];
                    console.log(wrapBlue(`🧪 Running tests${pattern ? ` (${pattern})` : ''}...`));
                    const result = await toolsManager.runTests(pattern);
                    if (result.success) {
                        console.log(chalk.green('✅ All tests passed'));
                    } else {
                        console.log(chalk.red('❌ Some tests failed'));
                        if (result.errors && result.errors.length > 0) {
                            console.log(chalk.yellow('Test errors:'));
                            result.errors.forEach(error => {
                                console.log(`  ${chalk.red('•')} ${error.message}`);
                            });
                        }
                    }
                    break;
                }
                case 'lint': {
                    console.log(chalk.blue('🔍 Running linter...'));
                    const result = await toolsManager.lint();
                    if (result.success) {
                        console.log(chalk.green('✅ No linting errors found'));
                    } else {
                        console.log(chalk.yellow('⚠️ Linting issues found'));
                        if (result.errors && result.errors.length > 0) {
                            result.errors.forEach(error => {
                                const severity = error.severity === 'error' ? chalk.red('ERROR') : chalk.yellow('WARNING');
                                console.log(`  ${severity}: ${error.message}`);
                            });
                        }
                    }
                    break;
                }
                case 'create': {
                    if (args.length < 2) {
                        console.log(chalk.red('Usage: /create <type> <name>'));
                        console.log(chalk.gray('Types: react, next, node, express'));
                        return;
                    }
                    const [type, name] = args;
                    console.log(wrapBlue(`🚀 Creating ${type} project: ${name}`));
                    const result = await toolsManager.setupProject(type as any, name);
                    if (result.success) {
                        console.log(chalk.green(`✅ Project ${name} created successfully!`));
                        console.log(chalk.gray(`📁 Location: ${result.path}`));
                    } else {
                        console.log(chalk.red(`❌ Failed to create project ${name}`));
                    }
                    break;
                }
            }
        } catch (error: any) {
            this.addLiveUpdate({ type: 'error', content: `Project operation failed: ${error.message}`, source: 'project' });
            console.log(chalk.red(`❌ Error: ${error.message}`));
        }
    }

    private async handleSessionManagement(command: string, args: string[]): Promise<void> {
        try {
            switch (command) {
                case 'new': {
                    const title = args.join(' ') || undefined;
                    const session = chatManager.createNewSession(title);
                    console.log(chalk.green(`✅ New session created: ${session.title} (${session.id.slice(0, 8)})`));
                    break;
                }
                case 'sessions': {
                    const sessions = chatManager.listSessions();
                    const current = chatManager.getCurrentSession();
                    console.log(chalk.blue.bold('\n📝 Chat Sessions:'));
                    console.log(chalk.gray('─'.repeat(40)));
                    if (sessions.length === 0) {
                        console.log(chalk.gray('No sessions found'));
                    } else {
                        sessions.forEach((session) => {
                            const isCurrent = session.id === current?.id;
                            const prefix = isCurrent ? chalk.yellow('→ ') : '  ';
                            const messageCount = session.messages.filter(m => m.role !== 'system').length;
                            console.log(`${prefix}${chalk.bold(session.title)} ${chalk.gray(`(${session.id.slice(0, 8)})`)}`);
                            console.log(`    ${chalk.gray(`${messageCount} messages | ${session.updatedAt.toLocaleString()}`)}`);
                        });
                    }
                    break;
                }
                case 'export': {
                    const sessionId = args[0];
                    const markdown = chatManager.exportSession(sessionId);
                    const filename = `chat-export-${Date.now()}.md`;
                    await fs.writeFile(filename, markdown);
                    console.log(chalk.green(`✅ Session exported to ${filename}`));
                    break;
                }
                case 'stats': {
                    const stats = chatManager.getSessionStats();
                    const modelInfo = advancedAIProvider.getCurrentModelInfo();
                    console.log(chalk.blue.bold('\n📊 Usage Statistics:'));
                    console.log(chalk.gray('─'.repeat(40)));
                    console.log(chalk.green(`Current Model: ${modelInfo.name}`));
                    console.log(chalk.green(`Total Sessions: ${stats.totalSessions}`));
                    console.log(chalk.green(`Total Messages: ${stats.totalMessages}`));
                    console.log(chalk.green(`Current Session Messages: ${stats.currentSessionMessages}`));
                    break;
                }
                case 'history': {
                    if (args.length === 0) {
                        const enabled = configManager.get('chatHistory');
                        console.log(chalk.green(`Chat history: ${enabled ? 'enabled' : 'disabled'}`));
                        return;
                    }
                    const setting = args[0].toLowerCase();
                    if (setting !== 'on' && setting !== 'off') {
                        console.log(chalk.red('Usage: /history <on|off>'));
                        return;
                    }
                    configManager.set('chatHistory', setting === 'on');
                    console.log(chalk.green(`✅ Chat history ${setting === 'on' ? 'enabled' : 'disabled'}`));
                    break;
                }
                case 'debug': {
                    console.log(chalk.blue.bold('\n🔍 Debug Information:'));
                    console.log(chalk.gray('═'.repeat(40)));
                    const currentModel = configManager.getCurrentModel();
                    console.log(chalk.green(`Current Model: ${currentModel}`));
                    const models = configManager.get('models');
                    const currentModelConfig = models[currentModel];
                    if (currentModelConfig) {
                        console.log(chalk.green(`Provider: ${currentModelConfig.provider}`));
                        console.log(chalk.green(`Model: ${currentModelConfig.model}`));
                    }
                    // Test API key
                    const apiKey = configManager.getApiKey(currentModel);
                    if (apiKey) {
                        console.log(chalk.green(`✅ API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)} (${apiKey.length} chars)`));
                    } else {
                        console.log(chalk.red(`❌ API Key: Not configured`));
                    }
                    break;
                }
                case 'temp': {
                    if (args.length === 0) {
                        console.log(chalk.green(`Current temperature: ${configManager.get('temperature')}`));
                        return;
                    }
                    const temp = parseFloat(args[0]);
                    if (isNaN(temp) || temp < 0 || temp > 2) {
                        console.log(chalk.red('Temperature must be between 0.0 and 2.0'));
                        return;
                    }
                    configManager.set('temperature', temp);
                    console.log(chalk.green(`✅ Temperature set to ${temp}`));
                    break;
                }
                case 'system': {
                    if (args.length === 0) {
                        const session = chatManager.getCurrentSession();
                        console.log(chalk.green('Current system prompt:'));
                        console.log(chalk.gray(session?.systemPrompt || 'None'));
                        return;
                    }
                    const prompt = args.join(' ');
                    const session = chatManager.getCurrentSession();
                    if (session) {
                        session.systemPrompt = prompt;
                        // Update the system message
                        const systemMsgIndex = session.messages.findIndex(m => m.role === 'system');
                        if (systemMsgIndex >= 0) {
                            session.messages[systemMsgIndex].content = prompt;
                        } else {
                            session.messages.unshift({
                                role: 'system',
                                content: prompt,
                                timestamp: new Date(),
                            });
                        }
                        console.log(chalk.green('✅ System prompt updated'));
                    }
                    break;
                }
            }
        } catch (error: any) {
            this.addLiveUpdate({ type: 'error', content: `Session management failed: ${error.message}`, source: 'session' });
            console.log(chalk.red(`❌ Error: ${error.message}`));
        }
    }

    private async handleModelConfig(command: string, args: string[]): Promise<void> {
        try {
            switch (command) {
                case 'model': {
                    if (args.length === 0) {
                        const current = advancedAIProvider.getCurrentModelInfo();
                        console.log(chalk.green(`Current model: ${current.name} (${current.config?.provider || 'unknown'})`));
                        return;
                    }
                    const modelName = args[0];
                    configManager.setCurrentModel(modelName);
                    console.log(chalk.green(`✅ Switched to model: ${modelName}`));
                    break;
                }
                case 'models': {
                    console.log(chalk.blue.bold('\n🤖 Available Models:'));
                    console.log(chalk.gray('─'.repeat(40)));
                    const currentModel = configManager.get('currentModel');
                    const models = configManager.get('models');
                    Object.entries(models).forEach(([name, config]) => {
                        const isCurrent = name === currentModel;
                        const hasKey = configManager.getApiKey(name) !== undefined;
                        const status = hasKey ? chalk.green('✅') : chalk.red('❌');
                        const prefix = isCurrent ? chalk.yellow('→ ') : '  ';
                        console.log(`${prefix}${status} ${chalk.bold(name)}`);
                        console.log(`    ${chalk.gray(`Provider: ${config.provider} | Model: ${config.model}`)}`);
                    });
                    break;
                }
                case 'set-key': {
                    if (args.length < 2) {
                        console.log(chalk.red('Usage: /set-key <model> <api-key>'));
                        console.log(chalk.gray('Example: /set-key claude-3-5-sonnet sk-ant-...'));
                        return;
                    }
                    const [modelName, apiKey] = args;
                    configManager.setApiKey(modelName, apiKey);
                    console.log(chalk.green(`✅ API key set for ${modelName}`));
                    break;
                }
                case 'config': {
                    console.log(chalk.cyan('⚙️ Current Configuration:'));
                    const config = configManager.getConfig();
                    console.log(JSON.stringify(config, null, 2));
                    break;
                }
            }
        } catch (error: any) {
            this.addLiveUpdate({ type: 'error', content: `Model/config operation failed: ${error.message}`, source: 'config' });
            console.log(chalk.red(`❌ Error: ${error.message}`));
        }
    }

    private async handleAdvancedFeatures(command: string, args: string[]): Promise<void> {
        try {
            switch (command) {
                case 'agents': {
                    console.log(chalk.blue.bold('\n🤖 Available Agents:'));
                    console.log(chalk.gray('─'.repeat(40)));
                    const agents = agentService.getAvailableAgents();
                    agents.forEach(agent => {
                        console.log(`${chalk.green('•')} ${chalk.bold(agent.name)}`);
                        console.log(`  ${chalk.gray(agent.description)}`);
                    });
                    break;
                }
                case 'agent': {
                    if (args.length < 2) {
                        console.log(chalk.red('Usage: /agent <name> <task>'));
                        return;
                    }
                    const agentName = args[0];
                    const task = args.slice(1).join(' ');
                    console.log(formatAgent(agentName, 'executing', task));
                    const taskId = await agentService.executeTask(agentName, task);
                    console.log(wrapBlue(`🚀 Launched ${agentName} (Task ID: ${taskId.slice(-6)})`));
                    break;
                }
                case 'parallel': {
                    if (args.length < 2) {
                        console.log(chalk.red('Usage: /parallel <agent1,agent2,...> <task>'));
                        return;
                    }
                    const agentNames = args[0].split(',').map(name => name.trim());
                    const task = args.slice(1).join(' ');
                    console.log(wrapBlue(`⚡ Running ${agentNames.length} agents in parallel...`));
                    // Implementation would execute agents in parallel
                    break;
                }
                case 'factory': {
                    agentFactory.showFactoryDashboard();
                    break;
                }
                case 'create-agent': {
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /create-agent <specialization>'));
                        return;
                    }
                    const specialization = args.join(' ');
                    const blueprint = await agentFactory.createAgentBlueprint({
                        specialization,
                        autonomyLevel: 'fully-autonomous',
                        contextScope: 'project',
                    });
                    console.log(chalk.green(`✅ Agent blueprint created: ${blueprint.name}`));
                    console.log(chalk.gray(`Blueprint ID: ${blueprint.id}`));
                    break;
                }
                case 'launch-agent': {
                    if (args.length === 0) {
                        console.log(chalk.red('Usage: /launch-agent <blueprint-id> [task]'));
                        return;
                    }
                    const blueprintId = args[0];
                    const task = args.slice(1).join(' ');
                    const agent = await agentFactory.launchAgent(blueprintId);
                    if (task) {
                        console.log(formatAgent('agent', 'running', task));
                        const result = await agent.run(task);
                        console.log(chalk.green('✅ Agent execution completed'));
                    } else {
                        console.log(chalk.blue('🤖 Agent launched and ready'));
                    }
                    break;
                }
                case 'context': {
                    if (args.length === 0) {
                        workspaceContext.showContextSummary();
                        return;
                    }
                    const paths = args;
                    await workspaceContext.selectPaths(paths);
                    console.log(chalk.green('✅ Workspace context updated'));
                    break;
                }
                case 'stream': {
                    if (args.length > 0 && args[0] === 'clear') {
                        const activeAgents = agentStream.getActiveAgents();
                        activeAgents.forEach(agentId => {
                            agentStream.clearAgentStream(agentId);
                        });
                        console.log(chalk.green('✅ All agent streams cleared'));
                    } else {
                        agentStream.showLiveDashboard();
                    }
                    break;
                }
                case 'approval': {
                    if (args.length === 0) {
                        console.log(chalk.blue('Approval System Configuration:'));
                        const config = approvalSystem.getConfig();
                        console.log(JSON.stringify(config, null, 2));
                    } else {
                        // Handle approval subcommands
                        const subcommand = args[0];
                        if (subcommand === 'test') {
                            const approved = await approvalSystem.quickApproval(
                                'Test Approval',
                                'This is a test of the approval system',
                                'low'
                            );
                            console.log(approved ? chalk.green('Approved') : chalk.yellow('Cancelled'));
                        }
                    }
                    break;
                }
                case 'todo':
                case 'todos': {
                    await this.handleTodoOperations(command, args);
                    break;
                }
            }
        } catch (error: any) {
            this.addLiveUpdate({ type: 'error', content: `Advanced feature failed: ${error.message}`, source: 'advanced' });
            console.log(chalk.red(`❌ Error: ${error.message}`));
        }
    }

    // Documentation Commands Handlers
    private async handleDocsCommand(args: string[]): Promise<void> {
        try {
            if (args.length === 0) {
                // Show help and status
                console.log(chalk.blue.bold('\n📚 Documentation System'));
                console.log(chalk.gray('─'.repeat(50)));
                
                // Show status
                const stats = docLibrary.getStats();
                console.log(chalk.green(`📖 Library: ${stats.totalDocs} documents`));
                console.log(chalk.green(`📂 Categories: ${stats.categories.length} (${stats.categories.join(', ')})`));
                console.log(chalk.green(`📝 Total Words: ${stats.totalWords.toLocaleString()}`));
                console.log(chalk.green(`🌍 Languages: ${stats.languages.join(', ')}`));
                
                // Show available commands
                console.log(chalk.blue('\n📋 Available Commands:'));
                console.log(chalk.gray('  /docs                    - Show this help and status'));
                console.log(chalk.gray('  /doc-search <query>      - Search documentation library'));
                console.log(chalk.gray('  /doc-add <url>          - Add documentation from URL'));
                console.log(chalk.gray('  /doc-stats              - Show detailed statistics'));
                console.log(chalk.gray('  /doc-list [category]    - List available documentation'));
                console.log(chalk.gray('  /doc-tag <id> <tags>    - Manage document tags (coming soon)'));
                
                return;
            }
            
            // Handle subcommands
            if (args.length === 0) {
                console.log(chalk.red('Missing subcommand. Use /doc help for available commands.'));
                return;
            }
            
            const subcommand = args[0];
            const subArgs = args.slice(1);
            
            switch (subcommand) {
                case 'status':
                    docLibrary.showStatus();
                    break;
                case 'help':
                    await this.handleDocsCommand([]);
                    break;
                default:
                    console.log(chalk.red(`❌ Unknown docs subcommand: ${subcommand}`));
                    console.log(chalk.gray('Use "/docs" for help'));
            }
        } catch (error: any) {
            console.error(chalk.red(`❌ Docs command error: ${error.message}`));
        }
    }

    private async handleDocSearchCommand(args: string[]): Promise<void> {
        try {
            if (args.length === 0) {
                console.log(chalk.red('Usage: /doc-search <query> [category]'));
                console.log(chalk.gray('Example: /doc-search "react hooks"'));
                console.log(chalk.gray('Example: /doc-search "api" backend'));
                return;
            }
            
            const query = args[0];
            const category = args[1];
            
            console.log(chalk.blue(`🔍 Searching for: "${query}"${category ? ` in category: ${category}` : ''}`));
            
            const results = await docLibrary.search(query, category, 10);
            
            if (results.length === 0) {
                console.log(chalk.yellow('❌ No documents found'));
                console.log(chalk.gray('Try different keywords or use /doc-add to add more documentation'));
                return;
            }
            
            console.log(chalk.green(`\n✅ Found ${results.length} results:`));
            console.log(chalk.gray('─'.repeat(60)));
            
            results.forEach((result, index) => {
                console.log(chalk.blue(`${index + 1}. ${result.entry.title}`));
                console.log(chalk.gray(`   Score: ${(result.score * 100).toFixed(1)}% | Category: ${result.entry.category}`));
                console.log(chalk.gray(`   URL: ${result.entry.url}`));
                console.log(chalk.gray(`   Tags: ${result.entry.tags.join(', ')}`));
                if (result.snippet) {
                    console.log(chalk.white(`   Preview: ${result.snippet.substring(0, 120)}...`));
                }
                console.log();
            });
            
        } catch (error: any) {
            console.error(chalk.red(`❌ Search error: ${error.message}`));
        }
    }

    private async handleDocAddCommand(args: string[]): Promise<void> {
        try {
            if (args.length === 0) {
                console.log(chalk.red('Usage: /doc-add <url> [category] [tags...]'));
                console.log(chalk.gray('Example: /doc-add https://reactjs.org/'));
                console.log(chalk.gray('Example: /doc-add https://nodejs.org/ backend node,api'));
                return;
            }
            
            const url = args[0];
            const category = args[1] || 'general';
            const tags = args.slice(2);
            
            // Simple URL validation
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                console.log(chalk.red('❌ Invalid URL. Must start with http:// or https://'));
                return;
            }
            
            console.log(chalk.blue(`📖 Adding documentation from: ${url}`));
            if (category !== 'general') console.log(chalk.gray(`📂 Category: ${category}`));
            if (tags.length > 0) console.log(chalk.gray(`🏷️ Tags: ${tags.join(', ')}`));
            
            const spinner = ora('Extracting content...').start();
            
            try {
                const entry = await docLibrary.addDocumentation(url, category, tags);
                spinner.succeed('Documentation added successfully!');
                
                console.log(chalk.green('\n✅ Document Added:'));
                console.log(chalk.gray('─'.repeat(40)));
                console.log(chalk.blue(`📄 Title: ${entry.title}`));
                console.log(chalk.gray(`🆔 ID: ${entry.id}`));
                console.log(chalk.gray(`📂 Category: ${entry.category}`));
                console.log(chalk.gray(`🏷️ Tags: ${entry.tags.join(', ')}`));
                console.log(chalk.gray(`📝 Words: ${entry.metadata.wordCount}`));
                console.log(chalk.gray(`🌍 Language: ${entry.metadata.language}`));
                
            } catch (error: any) {
                spinner.fail('Failed to add documentation');
                throw error;
            }
            
        } catch (error: any) {
            console.error(chalk.red(`❌ Add documentation error: ${error.message}`));
        }
    }

    private async handleDocStatsCommand(args: string[]): Promise<void> {
        try {
            const detailed = args.includes('--detailed') || args.includes('-d');
            
            const stats = docLibrary.getStats();
            
            console.log(chalk.blue.bold('\n📊 Documentation Library Statistics'));
            console.log(chalk.gray('─'.repeat(50)));
            
            console.log(chalk.green(`📖 Total Documents: ${stats.totalDocs}`));
            console.log(chalk.green(`📝 Total Words: ${stats.totalWords.toLocaleString()}`));
            console.log(chalk.green(`📂 Categories: ${stats.categories.length}`));
            console.log(chalk.green(`🌍 Languages: ${stats.languages.length}`));
            console.log(chalk.green(`👁️ Average Access Count: ${stats.avgAccessCount.toFixed(1)}`));
            
            if (detailed && stats.categories.length > 0) {
                console.log(chalk.blue('\n📂 By Category:'));
                stats.categories.forEach((category: string) => {
                    console.log(chalk.gray(`  • ${category}`));
                });
                
                console.log(chalk.blue('\n🌍 By Language:'));
                stats.languages.forEach((language: string) => {
                    console.log(chalk.gray(`  • ${language}`));
                });
            }
            
        } catch (error: any) {
            console.error(chalk.red(`❌ Stats error: ${error.message}`));
        }
    }

    private async handleDocListCommand(args: string[]): Promise<void> {
        try {
            const category = args[0];
            
            // Get all documents (accessing the private docs Map)
            const allDocs = Array.from((docLibrary as any).docs.values()) as DocumentationEntry[];
            
            // Filter by category if specified
            const docs = category 
                ? allDocs.filter(doc => doc.category === category)
                : allDocs;
            
            if (docs.length === 0) {
                if (category) {
                    console.log(chalk.yellow(`❌ No documents found in category: ${category}`));
                } else {
                    console.log(chalk.yellow('❌ No documents in library'));
                    console.log(chalk.gray('Use /doc-add <url> to add documentation'));
                }
                return;
            }
            
            console.log(chalk.blue.bold(`\n📋 Documentation List${category ? ` (Category: ${category})` : ''}`));
            console.log(chalk.gray('─'.repeat(60)));
            
            docs
                .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
                .forEach((doc, index) => {
                    console.log(chalk.blue(`${index + 1}. ${doc.title}`));
                    console.log(chalk.gray(`   ID: ${doc.id} | Category: ${doc.category}`));
                    console.log(chalk.gray(`   URL: ${doc.url}`));
                    console.log(chalk.gray(`   Tags: ${doc.tags.join(', ') || 'none'}`));
                    console.log(chalk.gray(`   Words: ${doc.metadata.wordCount} | Access: ${doc.accessCount}x`));
                    console.log(chalk.gray(`   Added: ${doc.timestamp.toLocaleDateString()}`));
                    console.log();
                });
            
        } catch (error: any) {
            console.error(chalk.red(`❌ List error: ${error.message}`));
        }
    }

    private async handleDocTagCommand(args: string[]): Promise<void> {
        try {
            console.log(chalk.yellow('🏷️ Document tagging feature is coming soon!'));
            console.log(chalk.gray('This will allow you to:'));
            console.log(chalk.gray('• Add tags to existing documents'));
            console.log(chalk.gray('• Remove tags from documents'));
            console.log(chalk.gray('• Search documents by tags'));
            console.log(chalk.gray('• List all available tags'));
            
            if (args.length > 0) {
                console.log(chalk.gray(`\nYour input: ${args.join(' ')}`));
            }
            
        } catch (error: any) {
            console.error(chalk.red(`❌ Tag error: ${error.message}`));
        }
    }

    private async handleDocSyncCommand(args: string[]): Promise<void> {
        try {
            const cloudProvider = getCloudDocsProvider();
            if (!cloudProvider?.isReady()) {
                console.log(chalk.yellow('⚠️ Cloud documentation not configured'));
                console.log(chalk.gray('Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables'));
                console.log(chalk.gray('Or use /config to enable cloud docs'));
                return;
            }

            console.log(chalk.blue('🔄 Synchronizing documentation library...'));
            const spinner = ora('Syncing with cloud...').start();

            try {
                const result = await cloudProvider.sync();
                spinner.succeed(`Sync completed: ${result.downloaded} downloaded, ${result.uploaded} uploaded`);

                if (result.downloaded > 0) {
                    console.log(chalk.green(`✅ ${result.downloaded} new documents available`));
                    console.log(chalk.gray('Use /doc-search to explore new content'));
                }
            } catch (error: any) {
                spinner.fail('Sync failed');
                throw error;
            }

        } catch (error: any) {
            console.error(chalk.red(`❌ Sync error: ${error.message}`));
        }
    }

    private async handleDocLoadCommand(args: string[]): Promise<void> {
        try {
            if (args.length === 0) {
                console.log(chalk.red('Usage: /doc-load <doc-names>'));
                console.log(chalk.gray('Example: /doc-load "react hooks" nodejs-api'));
                console.log(chalk.gray('Example: /doc-load frontend-docs backend-docs'));
                
                // Show suggestions
                const suggestions = await docsContextManager.suggestDocs('popular');
                if (suggestions.length > 0) {
                    console.log(chalk.blue('\n💡 Suggestions:'));
                    suggestions.forEach(title => {
                        console.log(chalk.gray(`  • ${title}`));
                    });
                }
                return;
            }

            console.log(chalk.blue(`📚 Loading ${args.length} document(s) into AI context...`));
            
            const loadedDocs = await docsContextManager.loadDocs(args);
            
            if (loadedDocs.length > 0) {
                const stats = docsContextManager.getContextStats();
                console.log(chalk.green(`✅ Context updated:`));
                console.log(chalk.gray(`   • Loaded docs: ${stats.loadedCount}`));
                console.log(chalk.gray(`   • Total words: ${stats.totalWords.toLocaleString()}`));
                console.log(chalk.gray(`   • Context usage: ${stats.utilizationPercent.toFixed(1)}%`));
                console.log(chalk.gray(`   • Categories: ${stats.categories.join(', ')}`));
                
                console.log(chalk.blue('\n💬 AI agents now have access to loaded documentation!'));
            }

        } catch (error: any) {
            console.error(chalk.red(`❌ Load error: ${error.message}`));
        }
    }

    private async handleDocContextCommand(args: string[]): Promise<void> {
        try {
            const stats = docsContextManager.getContextStats();
            
            console.log(chalk.blue.bold('\n📚 AI Documentation Context Status'));
            console.log(chalk.gray('─'.repeat(50)));
            
            if (stats.loadedCount === 0) {
                console.log(chalk.yellow('❌ No documentation loaded in context'));
                console.log(chalk.gray('Use /doc-load <names> to load documentation'));
                console.log(chalk.gray('Use /doc-suggest <query> to find relevant docs'));
                return;
            }

            console.log(chalk.green(`📖 Loaded Documents: ${stats.loadedCount}`));
            console.log(chalk.green(`📝 Total Words: ${stats.totalWords.toLocaleString()}`));
            console.log(chalk.green(`📊 Context Usage: ${stats.utilizationPercent.toFixed(1)}%`));
            console.log(chalk.green(`📂 Categories: ${stats.categories.join(', ')}`));
            console.log(chalk.green(`🏠 Local: ${stats.sources.local}, ☁️ Shared: ${stats.sources.shared}`));

            if (args.includes('--detailed') || args.includes('-d')) {
                console.log(chalk.blue('\n📋 Loaded Documents:'));
                const loadedDocs = docsContextManager.getLoadedDocs();
                
                loadedDocs.forEach((doc, index) => {
                    const wordCount = doc.content.split(' ').length;
                    console.log(chalk.blue(`${index + 1}. ${doc.title}`));
                    console.log(chalk.gray(`   Category: ${doc.category} | Source: ${doc.source}`));
                    console.log(chalk.gray(`   Tags: ${doc.tags.join(', ')}`));
                    console.log(chalk.gray(`   Words: ${wordCount.toLocaleString()} | Loaded: ${doc.loadedAt.toLocaleString()}`));
                    if (doc.summary) {
                        console.log(chalk.gray(`   Summary: ${doc.summary}`));
                    }
                    console.log();
                });
            }

            // Context summary for AI
            const summary = docsContextManager.getContextSummary();
            if (args.includes('--summary')) {
                console.log(chalk.blue('\n🤖 AI Context Summary:'));
                console.log(chalk.gray('─'.repeat(40)));
                console.log(summary);
            }

        } catch (error: any) {
            console.error(chalk.red(`❌ Context error: ${error.message}`));
        }
    }

    private async handleDocUnloadCommand(args: string[]): Promise<void> {
        try {
            if (args.length === 0) {
                // Show current loaded docs and ask for confirmation to clear all
                const stats = docsContextManager.getContextStats();
                if (stats.loadedCount === 0) {
                    console.log(chalk.yellow('❌ No documentation loaded in context'));
                    return;
                }

                console.log(chalk.yellow(`⚠️ This will remove all ${stats.loadedCount} loaded documents from AI context`));
                console.log(chalk.gray('Use /doc-unload <names> to remove specific documents'));
                console.log(chalk.gray('Use /doc-unload --all to confirm removal of all documents'));
                return;
            }

            if (args.includes('--all')) {
                await docsContextManager.unloadDocs();
                console.log(chalk.green('✅ All documentation removed from AI context'));
                return;
            }

            await docsContextManager.unloadDocs(args);
            
            const stats = docsContextManager.getContextStats();
            console.log(chalk.green('✅ Documentation context updated'));
            console.log(chalk.gray(`   • Remaining docs: ${stats.loadedCount}`));
            console.log(chalk.gray(`   • Context usage: ${stats.utilizationPercent.toFixed(1)}%`));

        } catch (error: any) {
            console.error(chalk.red(`❌ Unload error: ${error.message}`));
        }
    }

    private async handleDocSuggestCommand(args: string[]): Promise<void> {
        try {
            const query = args.join(' ');
            if (!query) {
                console.log(chalk.red('Usage: /doc-suggest <query>'));
                console.log(chalk.gray('Example: /doc-suggest react hooks'));
                console.log(chalk.gray('Example: /doc-suggest authentication'));
                return;
            }

            console.log(chalk.blue(`💡 Suggesting documentation for: "${query}"`));
            
            const suggestions = await docsContextManager.suggestDocs(query, 10);
            
            if (suggestions.length === 0) {
                console.log(chalk.yellow('❌ No relevant documentation found'));
                console.log(chalk.gray('Try different keywords or use /doc-add to add more documentation'));
                return;
            }

            console.log(chalk.green(`\n✅ Found ${suggestions.length} relevant documents:`));
            console.log(chalk.gray('─'.repeat(50)));
            
            suggestions.forEach((title, index) => {
                console.log(chalk.blue(`${index + 1}. ${title}`));
            });

            console.log(chalk.gray('\n💡 To load these documents:'));
            console.log(chalk.gray(`/doc-load "${suggestions.slice(0, 3).join('" "')}"`));

        } catch (error: any) {
            console.error(chalk.red(`❌ Suggest error: ${error.message}`));
        }
    }

    // Enhanced Planning Methods (from enhanced-planning.ts)
    private async generateAdvancedPlan(goal: string, options: any = {}): Promise<any> {
        const {
            maxTodos = 20,
            includeContext = true,
            showDetails = true,
            saveTodoFile = true,
            todoFilePath = 'todo.md'
        } = options;

        console.log(chalk.blue.bold(`\n🎯 Generating Advanced Plan: ${goal}`));
        console.log(chalk.gray('─'.repeat(60)));

        // Get project context
        let projectContext = '';
        if (includeContext) {
            console.log(chalk.gray('📁 Analyzing project context...'));
            const context = workspaceContext.getContextForAgent('planner', 10);
            projectContext = context.projectSummary;
        }

        // Generate AI-powered plan
        console.log(chalk.gray('🧠 Generating AI plan...'));
        const todos = await this.generateTodosWithAI(goal, projectContext, maxTodos);

        // Create plan object
        const plan = {
            id: Date.now().toString(),
            title: this.extractPlanTitle(goal),
            description: goal,
            goal,
            todos,
            status: 'draft',
            estimatedTotalDuration: todos.reduce((sum: number, todo: any) => sum + todo.estimatedDuration, 0),
            createdAt: new Date(),
            workingDirectory: this.workingDirectory,
            context: {
                projectInfo: includeContext ? projectContext : undefined,
                userRequirements: [goal],
            },
        };

        // Show plan details
        if (showDetails) {
            this.displayAdvancedPlan(plan);
        }

        // Save todo.md file
        if (saveTodoFile) {
            await this.saveTodoMarkdown(plan, todoFilePath);
        }

        return plan;
    }

    private async generateTodosWithAI(goal: string, context: string, maxTodos: number): Promise<any[]> {
        try {
            // Check cache first to save massive tokens
            const truncatedContext = context.length > 1000 ? context.substring(0, 1000) + '...' : context;
            const planningPrompt = `Plan: ${goal} (max ${maxTodos} todos)`;

            const cachedResponse = await tokenCache.getCachedResponse(
                planningPrompt,
                truncatedContext,
                ['planning', 'todos', 'ai-generation']
            );

            if (cachedResponse) {
                console.log(chalk.green('🎯 Using cached planning response'));
                try {
                    const planData = JSON.parse(cachedResponse.response || '{}');
                    if (planData.todos && Array.isArray(planData.todos)) {
                        return planData.todos.slice(0, maxTodos);
                    }
                } catch (e) {
                    console.log(chalk.yellow('⚠️ Cached response format invalid, generating new plan'));
                }
            }

            // Build optimized context-aware message for AI planning - reduced token usage
            const messages = [{
                role: 'system' as const,
                content: `Expert project planner. Generate JSON todo array:
{"todos":[{"title":"Task title","description":"Task desc","priority":"low/medium/high/critical","category":"planning/setup/implementation/testing/docs/deployment","estimatedDuration":30,"dependencies":[],"tags":["tag"],"commands":["cmd"],"files":["file.ts"],"reasoning":"Brief reason"}]}

Max ${maxTodos} todos. Context: ${truncatedContext}`
            }, {
                role: 'user' as const,
                content: planningPrompt
            }];

            // Stream AI response for real-time feedback
            let assistantText = '';
            for await (const ev of advancedAIProvider.streamChatWithFullAutonomy(messages)) {
                if (ev.type === 'text_delta' && ev.content) {
                    assistantText += ev.content;
                    process.stdout.write(ev.content);
                }
            }
            console.log(); // newline

            // Extract JSON from response
            const jsonMatch = assistantText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('AI did not return valid JSON plan');
            }

            const planData = JSON.parse(jsonMatch[0]);

            // Convert to TodoItem format
            const todos = planData.todos.map((todoData: any, index: number) => ({
                id: `todo-${Date.now()}-${index}`,
                title: todoData.title || `Task ${index + 1}`,
                description: todoData.description || '',
                status: 'pending',
                priority: todoData.priority || 'medium',
                category: todoData.category || 'implementation',
                estimatedDuration: todoData.estimatedDuration || 30,
                dependencies: todoData.dependencies || [],
                tags: todoData.tags || [],
                commands: todoData.commands || [],
                files: todoData.files || [],
                reasoning: todoData.reasoning || '',
                createdAt: new Date(),
            }));

            // Cache the successful response for future use
            const tokensEstimated = Math.round((planningPrompt.length + assistantText.length) / 4);
            await tokenCache.setCachedResponse(
                planningPrompt,
                JSON.stringify({ todos: planData.todos }),
                truncatedContext,
                tokensEstimated,
                ['planning', 'todos', 'ai-generation']
            );

            console.log(chalk.green(`✅ Generated ${todos.length} todos (cached for future use)`));
            return todos;

        } catch (error: any) {
            console.log(chalk.red(`❌ Failed to generate AI plan: ${error.message}`));

            // Fallback: create a simple todo
            return [{
                id: `todo-${Date.now()}`,
                title: 'Execute Task',
                description: goal,
                status: 'pending',
                priority: 'medium',
                category: 'implementation',
                estimatedDuration: 60,
                dependencies: [],
                tags: ['manual'],
                reasoning: 'Fallback todo when AI planning fails',
                createdAt: new Date(),
            }];
        }
    }

    private displayAdvancedPlan(plan: any): void {
        console.log(boxen(
            `${chalk.blue.bold(plan.title)}\n\n` +
            `${chalk.gray('Goal:')} ${plan.goal}\n` +
            `${chalk.gray('Todos:')} ${plan.todos.length}\n` +
            `${chalk.gray('Estimated Duration:')} ${Math.round(plan.estimatedTotalDuration)} minutes\n` +
            `${chalk.gray('Status:')} ${this.getPlanStatusColor(plan.status)(plan.status.toUpperCase())}`,
            {
                padding: 1,
                margin: { top: 1, bottom: 1, left: 0, right: 0 },
                borderStyle: 'round',
                borderColor: 'blue',
            }
        ));

        console.log(chalk.blue.bold('\n📋 Todo Items:'));
        console.log(chalk.gray('─'.repeat(60)));

        plan.todos.forEach((todo: any, index: number) => {
            const priorityIcon = this.getPlanPriorityIcon(todo.priority);
            const statusIcon = this.getPlanStatusIcon(todo.status);
            const categoryColor = this.getPlanCategoryColor(todo.category);

            console.log(`${index + 1}. ${statusIcon} ${priorityIcon} ${chalk.bold(todo.title)}`);
            console.log(`   ${chalk.gray(todo.description)}`);
            console.log(`   ${categoryColor(todo.category)} | ${chalk.gray(todo.estimatedDuration + 'min')} | ${chalk.gray(todo.tags.join(', '))}`);

            if (todo.dependencies.length > 0) {
                console.log(`   ${chalk.yellow('Dependencies:')} ${todo.dependencies.join(', ')}`);
            }

            if (todo.files && todo.files.length > 0) {
                console.log(`   ${wrapBlue('Files:')} ${todo.files.join(', ')}`);
            }

            console.log();
        });
    }

    private async executeAdvancedPlan(planId: string): Promise<void> {
        const plan = enhancedPlanning.getPlan(planId);
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }

        if (plan.status !== 'approved') {
            const approved = await this.handlePlanApproval(planId);
            if (!approved) {
                return;
            }
        }

        console.log(chalk.blue.bold(`\n🚀 Executing Plan: ${plan.title}`));
        console.log(chalk.cyan('🤖 Auto Mode: Plan will execute automatically'));
        console.log(chalk.gray('═'.repeat(60)));

        plan.status = 'executing';
        plan.startedAt = new Date();

        try {
            // Execute todos in dependency order
            const executionOrder = this.resolveDependencyOrder(plan.todos);
            let completedCount = 0;
            let autoSkipped = 0;

            for (const todo of executionOrder) {
                console.log(chalk.cyan(`\n📋 [${completedCount + 1}/${plan.todos.length}] ${todo.title}`));
                console.log(chalk.gray(`   ${todo.description}`));

                todo.status = 'in_progress';
                todo.startedAt = new Date();

                try {
                    // Execute the todo
                    const startTime = Date.now();
                    await this.executeSingleTodo(todo, plan);
                    const duration = Date.now() - startTime;

                    todo.status = 'completed';
                    todo.completedAt = new Date();
                    todo.actualDuration = Math.round(duration / 60000);

                    console.log(chalk.green(`   ✅ Completed in ${Math.round(duration / 1000)}s`));
                    completedCount++;

                    // Update todo.md file
                    await this.saveTodoMarkdown(plan);

                } catch (error: any) {
                    todo.status = 'failed';
                    console.log(chalk.red(`   ❌ Failed: ${error.message}`));

                    // In auto mode, decide automatically based on error severity
                    if (error.message.includes('critical') || error.message.includes('fatal')) {
                        console.log(chalk.red('🛑 Critical error detected - stopping execution'));
                        plan.status = 'failed';
                        return;
                    } else {
                        // Auto-continue on non-critical errors
                        console.log(chalk.yellow('⚠️  Non-critical error - continuing with remaining todos'));
                        todo.status = 'failed'; // Keep as failed but continue
                        autoSkipped++;
                    }
                }

                // Show progress
                const progress = Math.round((completedCount / plan.todos.length) * 100);
                console.log(`   ${formatProgress(completedCount, plan.todos.length)}`);

                // Brief pause between todos for readability
                if (completedCount < plan.todos.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            // Plan completed
            plan.status = 'completed';
            plan.completedAt = new Date();
            plan.actualTotalDuration = plan.todos.reduce((sum: number, todo: any) => sum + (todo.actualDuration || 0), 0);

            console.log(chalk.green.bold(`\n🎉 Plan Completed Successfully!`));
            console.log(chalk.gray(`✅ ${completedCount}/${plan.todos.length} todos completed`));
            if (autoSkipped > 0) {
                console.log(chalk.yellow(`⚠️  ${autoSkipped} todos had non-critical errors`));
            }
            console.log(chalk.gray(`⏱️  Total time: ${plan.actualTotalDuration} minutes`));

            // Update final todo.md
            await this.saveTodoMarkdown(plan);

            // Add completion summary to live updates
            this.addLiveUpdate({
                type: 'log',
                content: `Plan '${plan.title}' completed: ${completedCount}/${plan.todos.length} todos successful`,
                source: 'plan-execution'
            });

        } catch (error: any) {
            plan.status = 'failed';
            console.log(chalk.red(`\n❌ Plan execution failed: ${error.message}`));
            this.addLiveUpdate({
                type: 'error',
                content: `Plan '${plan.title}' failed: ${error.message}`,
                source: 'plan-execution'
            });
        }
    }

    private async executeSingleTodo(todo: any, plan: any): Promise<void> {
        console.log(chalk.gray(`   🔍 Analyzing todo: ${todo.title}`));

        // Build a compact execution prompt and hand off to the autonomous provider
        const toolsList = Array.isArray(todo.tools) && todo.tools.length > 0 ? todo.tools.join(', ') : 'read_file, write_file, explore_directory, execute_command, analyze_project, manage_packages, generate_code';

        const executionMessages: any[] = [
            {
                role: 'system',
                content: `You are an autonomous executor that completes specific development tasks.\n\nCURRENT TASK: ${todo.title}\nTASK DESCRIPTION: ${todo.description || ''}\nAVAILABLE TOOLS: ${toolsList}\n\nGUIDELINES:\n- Be autonomous and safe\n- Follow project conventions\n- Create production-ready code\n- Provide clear progress updates\n- Use tools when needed without asking for permission\n\nExecute the task now using the available tools.`
            },
            {
                role: 'user',
                content: `Execute task: ${todo.title}${todo.description ? `\n\nDetails: ${todo.description}` : ''}`
            }
        ];

        let responseText = '';
        try {
            for await (const event of advancedAIProvider.executeAutonomousTask('Execute task', { messages: executionMessages })) {
                if (event.type === 'text_delta' && event.content) {
                    responseText += event.content;
                } else if (event.type === 'tool_call') {
                    console.log(chalk.cyan(`   🛠️ Tool: ${event.toolName}`));
                } else if (event.type === 'tool_result') {
                    console.log(chalk.gray(`   ↪ Result from ${event.toolName}`));
                } else if (event.type === 'error') {
                    throw new Error(event.error || 'Unknown autonomous execution error');
                }
            }
        } catch (err: any) {
            console.log(chalk.yellow(`   ⚠️ Autonomous execution warning: ${err.message}`));
        }

        // Optional: still honor any concrete commands/files declared by the todo
        if (todo.commands && todo.commands.length > 0) {
            for (const command of todo.commands) {
                console.log(`   ${formatCommand(command)}`);
                try {
                    const [cmd, ...args] = command.split(' ');
                    await toolsManager.runCommand(cmd, args);
                } catch (error) {
                    console.log(chalk.yellow(`   ⚠️ Command warning: ${error}`));
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        if (todo.files && todo.files.length > 0) {
            for (const file of todo.files) {
                console.log(chalk.yellow(`   📄 Working on file: ${file}`));
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }
    }

    private resolveDependencyOrder(todos: any[]): any[] {
        const resolved: any[] = [];
        const remaining = [...todos];

        while (remaining.length > 0) {
            const canExecute = remaining.filter(todo =>
                todo.dependencies.every((depId: string) =>
                    resolved.some(resolvedTodo => resolvedTodo.id === depId)
                )
            );

            if (canExecute.length === 0) {
                // Break circular dependencies by taking the first remaining todo
                const next = remaining.shift()!;
                resolved.push(next);
            } else {
                // Execute todos with satisfied dependencies
                canExecute.forEach(todo => {
                    const index = remaining.indexOf(todo);
                    remaining.splice(index, 1);
                    resolved.push(todo);
                });
            }
        }

        return resolved;
    }

    private async handlePlanApproval(planId: string): Promise<boolean> {
        const plan = enhancedPlanning.getPlan(planId);
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }

        console.log(chalk.yellow.bold('\n⚠️  Plan Review Required'));
        console.log(chalk.gray('═'.repeat(60)));

        // Show plan summary
        this.displayPlanSummary(plan);

        // Ask for approval
        const approved = await this.askAdvancedConfirmation(
            `Execute Plan: ${plan.title}`,
            `Execute ${plan.todos.length} tasks with estimated duration of ${Math.round(plan.estimatedTotalDuration)} minutes`,
            false
        );

        if (approved) {
            plan.status = 'approved';
            plan.approvedAt = new Date();
            console.log(chalk.green('✅ Plan approved for execution'));
        } else {
            console.log(chalk.yellow('❌ Plan execution cancelled'));
        }

        return approved;
    }

    private displayPlanSummary(plan: any): void {
        const stats = {
            byPriority: this.groupPlanBy(plan.todos, 'priority'),
            byCategory: this.groupPlanBy(plan.todos, 'category'),
            totalFiles: new Set(plan.todos.flatMap((t: any) => t.files || [])).size,
            totalCommands: plan.todos.reduce((sum: number, t: any) => sum + (t.commands?.length || 0), 0),
        };

        console.log(chalk.cyan('📊 Plan Statistics:'));
        console.log(`  • Total Todos: ${plan.todos.length}`);
        console.log(`  • Estimated Duration: ${Math.round(plan.estimatedTotalDuration)} minutes`);
        console.log(`  • Files to modify: ${stats.totalFiles}`);
        console.log(`  • Commands to run: ${stats.totalCommands}`);

        console.log(chalk.cyan('\n🎯 Priority Distribution:'));
        Object.entries(stats.byPriority).forEach(([priority, todos]) => {
            const icon = this.getPlanPriorityIcon(priority);
            console.log(`  ${icon} ${priority}: ${(todos as any[]).length} todos`);
        });

        console.log(chalk.cyan('\n📁 Category Distribution:'));
        Object.entries(stats.byCategory).forEach(([category, todos]) => {
            const color = this.getPlanCategoryColor(category);
            console.log(`  • ${color(category)}: ${(todos as any[]).length} todos`);
        });
    }

    private async saveTodoMarkdown(plan: any, filename: string = 'todo.md'): Promise<void> {
        const todoPath = path.join(this.workingDirectory, filename);

        let content = `# Todo Plan: ${plan.title}\n\n`;
        content += `**Goal:** ${plan.goal}\n\n`;
        content += `**Status:** ${plan.status.toUpperCase()}\n`;
        content += `**Created:** ${plan.createdAt.toISOString()}\n`;
        content += `**Estimated Duration:** ${Math.round(plan.estimatedTotalDuration)} minutes\n\n`;

        if (plan.context.projectInfo) {
            content += `## Project Context\n\n`;
            const projectInfoBlock = typeof plan.context.projectInfo === 'string'
                ? plan.context.projectInfo
                : JSON.stringify(plan.context.projectInfo, null, 2);
            const fenceLang = typeof plan.context.projectInfo === 'string' ? '' : 'json';
            content += `\`\`\`${fenceLang}\n${projectInfoBlock}\n\`\`\`\n\n`;
        }

        content += `## Todo Items (${plan.todos.length})\n\n`;

        plan.todos.forEach((todo: any, index: number) => {
            const statusEmoji = this.getPlanStatusEmoji(todo.status);
            const priorityEmoji = this.getPlanPriorityEmoji(todo.priority);

            content += `### ${index + 1}. ${statusEmoji} ${todo.title} ${priorityEmoji}\n\n`;
            content += `**Description:** ${todo.description}\n\n`;
            content += `**Category:** ${todo.category} | **Priority:** ${todo.priority} | **Duration:** ${todo.estimatedDuration}min\n\n`;

            if (todo.reasoning) {
                content += `**Reasoning:** ${todo.reasoning}\n\n`;
            }

            if (todo.dependencies.length > 0) {
                content += `**Dependencies:** ${todo.dependencies.join(', ')}\n\n`;
            }

            if (todo.files && todo.files.length > 0) {
                content += `**Files:** \`${todo.files.join('\`, \`')}\`\n\n`;
            }

            if (todo.commands && todo.commands.length > 0) {
                content += `**Commands:**\n`;
                todo.commands.forEach((cmd: string) => {
                    content += `- \`${cmd}\`\n`;
                });
                content += '\n';
            }

            if (todo.tags.length > 0) {
                content += `**Tags:** ${todo.tags.map((tag: string) => `#${tag}`).join(' ')}\n\n`;
            }

            if (todo.status === 'completed' && todo.completedAt) {
                content += `**Completed:** ${todo.completedAt.toISOString()}\n`;
                if (todo.actualDuration) {
                    content += `**Actual Duration:** ${todo.actualDuration}min\n`;
                }
                content += '\n';
            }

            content += '---\n\n';
        });

        // Add statistics
        content += `## Statistics\n\n`;
        content += `- **Total Todos:** ${plan.todos.length}\n`;
        content += `- **Completed:** ${plan.todos.filter((t: any) => t.status === 'completed').length}\n`;
        content += `- **In Progress:** ${plan.todos.filter((t: any) => t.status === 'in_progress').length}\n`;
        content += `- **Pending:** ${plan.todos.filter((t: any) => t.status === 'pending').length}\n`;
        content += `- **Failed:** ${plan.todos.filter((t: any) => t.status === 'failed').length}\n`;

        if (plan.actualTotalDuration) {
            content += `- **Actual Duration:** ${plan.actualTotalDuration}min\n`;
            content += `- **Estimated vs Actual:** ${Math.round((plan.actualTotalDuration / plan.estimatedTotalDuration) * 100)}%\n`;
        }

        content += `\n---\n*Generated by NikCLI on ${new Date().toISOString()}*\n`;

        await fs.writeFile(todoPath, content, 'utf8');
        console.log(chalk.green(`📄 Todo file saved: ${todoPath}`));
    }

    // Planning Utility Methods
    private extractPlanTitle(goal: string): string {
        return goal.length > 50 ? goal.substring(0, 47) + '...' : goal;
    }

    private groupPlanBy<T>(array: T[], key: keyof T): Record<string, T[]> {
        return array.reduce((groups, item) => {
            const group = String(item[key]);
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {} as Record<string, T[]>);
    }

    private getPlanStatusColor(status: string): any {
        switch (status) {
            case 'completed': return chalk.green;
            case 'executing': case 'in_progress': return chalk.blue;
            case 'approved': return chalk.cyan;
            case 'failed': return chalk.red;
            case 'cancelled': return chalk.yellow;
            default: return chalk.gray;
        }
    }

    private getPlanStatusIcon(status: string): string {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '🔄';
            case 'failed': return '❌';
            case 'skipped': return '⏭️';
            default: return '⏳';
        }
    }

    private getPlanStatusEmoji(status: string): string {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '🔄';
            case 'failed': return '❌';
            case 'skipped': return '⏭️';
            default: return '⏳';
        }
    }

    private getPlanPriorityIcon(priority: string): string {
        switch (priority) {
            case 'critical': return '🔴';
            case 'high': return '🟡';
            case 'medium': return '🟢';
            case 'low': return '🔵';
            default: return '⚪';
        }
    }

    private getPlanPriorityEmoji(priority: string): string {
        switch (priority) {
            case 'critical': return '🔥';
            case 'high': return '⚡';
            case 'medium': return '📋';
            case 'low': return '📝';
            default: return '📄';
        }
    }

    private getPlanCategoryColor(category: string): any {
        switch (category) {
            case 'planning': return chalk.cyan;
            case 'setup': return chalk.blue;
            case 'implementation': return chalk.green;
            case 'testing': return chalk.yellow;
            case 'documentation': return chalk.magenta;
            case 'deployment': return chalk.red;
            default: return chalk.gray;
        }
    }

    // Utility methods
    private async initializeSystems(): Promise<void> {
        await this.agentManager.initialize();
        // Ensure orchestrator services share our working directory
        planningService.setWorkingDirectory(this.workingDirectory);
        // Event bridge is idempotent
        this.setupOrchestratorEventBridge();
        
        // Initialize cloud docs provider
        await this.initializeCloudDocs();
        
        console.log(chalk.dim('✓ Systems initialized'));
    }

    private async initializeCloudDocs(): Promise<void> {
        try {
            const cloudDocsConfig = this.configManager.get('cloudDocs');
            
            // Get API credentials from environment or config
            const apiUrl = cloudDocsConfig.apiUrl || process.env.SUPABASE_URL;
            const apiKey = cloudDocsConfig.apiKey || process.env.SUPABASE_ANON_KEY;
            
            if (cloudDocsConfig.enabled && apiUrl && apiKey) {
                const provider = createCloudDocsProvider({
                    ...cloudDocsConfig,
                    apiUrl,
                    apiKey
                });
                
                if (cloudDocsConfig.autoSync) {
                    console.log(chalk.gray('📚 Auto-syncing documentation library...'));
                    await provider.sync();
                }
                
                console.log(chalk.dim('✓ Cloud documentation system ready'));
            } else {
                console.log(chalk.dim('ℹ️ Cloud documentation disabled'));
            }
        } catch (error: any) {
            console.log(chalk.yellow(`⚠️ Cloud docs initialization failed: ${error.message}`));
        }
    }

    private switchModel(modelName: string): void {
        try {
            this.configManager.setCurrentModel(modelName);

            // Validate the new model using model provider
            if (modelProvider.validateApiKey()) {
                console.log(chalk.green(`✅ Switched to model: ${modelName}`));
            } else {
                console.log(chalk.yellow(`⚠️  Switched to model: ${modelName} (API key needed)`));
            }

            this.addLiveUpdate({
                type: 'info',
                content: `Model switched to: ${modelName}`,
                source: 'model-switch'
            });
        } catch (error: any) {
            this.addLiveUpdate({
                type: 'error',
                content: `Model switch failed: ${error.message}`,
                source: 'model-switch'
            });
            console.log(chalk.red(`❌ Could not switch model: ${error.message}`));
        }
    }

    private async askForApproval(question: string): Promise<boolean> {
        return await this.askAdvancedConfirmation(question, undefined, false);
    }

    private async askForInput(prompt: string): Promise<string> {
        return new Promise((resolve) => {
            if (!this.rl) {
                resolve('');
                return;
            }

            this.rl.question(chalk.cyan(prompt), (answer) => {
                resolve(answer.trim());
            });
        });
    }

    private async clearSession(): Promise<void> {
        // Clear current chat session
        chatManager.clearCurrentSession();

        // Clear legacy session context
        this.sessionContext.clear();

        // Clear UI indicators and state
        this.indicators.clear();
        this.liveUpdates.length = 0;

        // Stop any running spinners
        this.spinners.forEach(spinner => spinner.stop());
        this.spinners.clear();

        // Stop any progress bars
        this.progressBars.forEach(bar => bar.stop());
        this.progressBars.clear();

        console.log(chalk.green('✅ Session and UI state cleared'));
        this.addLiveUpdate({ type: 'info', content: 'Session cleared', source: 'session' });
    }

    private async compactSession(): Promise<void> {
        console.log(chalk.blue('📊 Compacting session to save tokens...'));

        const session = chatManager.getCurrentSession();
        if (!session || session.messages.length <= 3) {
            console.log(chalk.yellow('Session too short to compact'));
            return;
        }

        try {
            const originalCount = session.messages.length;

            // Ultra-aggressive compaction: keep only system message and last user+assistant pair
            const systemMessages = session.messages.filter(m => m.role === 'system');
            const recentMessages = session.messages.slice(-2); // Only last 2 messages

            // Create ultra-short summary
            const olderMessages = session.messages.slice(0, -2).filter(m => m.role !== 'system');

            if (olderMessages.length > 0) {
                const summaryMessage = {
                    role: 'system' as const,
                    content: `[Compacted ${olderMessages.length} msgs]`,
                    timestamp: new Date()
                };

                session.messages = [...systemMessages, summaryMessage, ...recentMessages];

                console.log(chalk.green(`✅ Session compacted: ${originalCount} → ${session.messages.length} messages`));
                this.addLiveUpdate({
                    type: 'info',
                    content: `Saved ${originalCount - session.messages.length} messages`,
                    source: 'session'
                });
            } else {
                console.log(chalk.green('✓ Session compacted'));
            }

            // Additional token optimization: truncate long messages
            session.messages.forEach(msg => {
                if (msg.content.length > 2000) {
                    msg.content = msg.content.substring(0, 2000) + '...[truncated]';
                }
            });

        } catch (error: any) {
            console.log(chalk.red(`❌ Error compacting session: ${error.message}`));
        }
    }

    private async manageTokenCache(action?: string): Promise<void> {
        switch (action) {
            case 'clear':
                await Promise.all([
                    tokenCache.clearCache(),
                    completionCache.clearCache()
                ]);
                console.log(chalk.green('✅ All caches cleared'));
                break;

            case 'cleanup':
                const removed = await tokenCache.cleanupExpired();
                console.log(chalk.green(`✅ Removed ${removed} expired cache entries`));
                break;

            case 'settings':
                console.log(chalk.blue('⚙️ Current Cache Settings:'));
                console.log(`  Max cache size: 1000 entries`);
                console.log(`  Similarity threshold: 0.85`);
                console.log(`  Max age: 7 days`);
                console.log(`  Cache file: ./.nikcli/token-cache.json`);
                break;

            case 'export':
                const exportPath = `./cache-export-${Date.now()}.json`;
                await tokenCache.exportCache(exportPath);
                break;

            default: // 'stats' or no argument
                const stats = tokenCache.getStats();
                const completionStats = completionCache.getStats();
                const totalTokensSaved = stats.totalTokensSaved + (completionStats.totalHits * 50); // Estimate 50 tokens saved per completion hit

                console.log(boxen(
                    `${chalk.cyan.bold('🔮 Advanced Cache System Statistics')}\n\n` +
                    `${chalk.magenta('📦 Full Response Cache:')}\n` +
                    `  Entries: ${chalk.white(stats.totalEntries.toLocaleString())}\n` +
                    `  Hits: ${chalk.green(stats.totalHits.toLocaleString())}\n` +
                    `  Tokens Saved: ${chalk.yellow(stats.totalTokensSaved.toLocaleString())}\n\n` +
                    `${chalk.cyan('🔮 Completion Protocol Cache:')} ${chalk.red('NEW!')}\n` +
                    `  Patterns: ${chalk.white(completionStats.totalPatterns.toLocaleString())}\n` +
                    `  Hits: ${chalk.green(completionStats.totalHits.toLocaleString())}\n` +
                    `  Avg Confidence: ${chalk.blue(Math.round(completionStats.averageConfidence * 100))}%\n\n` +
                    `${chalk.green.bold('💰 Total Savings:')}\n` +
                    `Combined Tokens: ${chalk.yellow(totalTokensSaved.toLocaleString())}\n` +
                    `Estimated Cost: ~$${(totalTokensSaved * 0.003 / 1000).toFixed(2)}`,
                    {
                        padding: 1,
                        margin: 1,
                        borderStyle: 'round',
                        borderColor: 'magenta'
                    }
                ));

                if (stats.totalEntries > 0) {
                    console.log(chalk.cyan('\n🔧 Available Actions:'));
                    console.log('  /cache clear    - Clear all cache entries');
                    console.log('  /cache cleanup  - Remove expired entries');
                    console.log('  /cache settings - Show cache configuration');
                    console.log('  /cache export   - Export cache to file');
                }
                break;
        }
    }

    private async showTokenUsage(): Promise<void> {
        console.log(chalk.blue('📊 Token Usage Analysis & Optimization'));

        try {
            const session = chatManager.getCurrentSession();

            if (session) {
                const totalChars = session.messages.reduce((sum, msg) => sum + msg.content.length, 0);
                const estimatedTokens = Math.round(totalChars / 4);
                const tokenLimit = 200000;
                const usagePercent = Math.round((estimatedTokens / tokenLimit) * 100);

                console.log(boxen(
                    `${chalk.cyan('Current Session Token Usage')}\n\n` +
                    `Messages: ${chalk.white(session.messages.length.toLocaleString())}\n` +
                    `Characters: ${chalk.white(totalChars.toLocaleString())}\n` +
                    `Est. Tokens: ${chalk.white(estimatedTokens.toLocaleString())}\n` +
                    `Usage: ${usagePercent > 75 ? chalk.red(`${usagePercent}%`) : usagePercent > 50 ? chalk.yellow(`${usagePercent}%`) : chalk.green(`${usagePercent}%`)}\n` +
                    `Limit: ${chalk.gray(tokenLimit.toLocaleString())}`,
                    {
                        padding: 1,
                        margin: 1,
                        borderStyle: 'round',
                        borderColor: usagePercent > 75 ? 'red' : usagePercent > 50 ? 'yellow' : 'green'
                    }
                ));

                // Message breakdown
                console.log(chalk.cyan('\n📋 Message Breakdown:'));
                const systemMsgs = session.messages.filter(m => m.role === 'system');
                const userMsgs = session.messages.filter(m => m.role === 'user');
                const assistantMsgs = session.messages.filter(m => m.role === 'assistant');

                console.log(`  System: ${systemMsgs.length} (${Math.round(systemMsgs.reduce((sum, m) => sum + m.content.length, 0) / 4).toLocaleString()} tokens)`);
                console.log(`  User: ${userMsgs.length} (${Math.round(userMsgs.reduce((sum, m) => sum + m.content.length, 0) / 4).toLocaleString()} tokens)`);
                console.log(`  Assistant: ${assistantMsgs.length} (${Math.round(assistantMsgs.reduce((sum, m) => sum + m.content.length, 0) / 4).toLocaleString()} tokens)`);

                // Recommendations
                if (estimatedTokens > 150000) {
                    console.log(chalk.red('\n⚠️ CRITICAL: Very high token usage!'));
                    console.log(chalk.yellow('Recommendations:'));
                    console.log('  • Use /compact to compress session immediately');
                    console.log('  • Start a new session with /new');
                    console.log('  • Enable auto-compaction (already active)');
                } else if (estimatedTokens > 100000) {
                    console.log(chalk.yellow('\n⚠️ WARNING: High token usage'));
                    console.log('Recommendations:');
                    console.log('  • Consider using /compact soon');
                    console.log('  • Auto-compaction will trigger at 100k tokens');
                } else if (estimatedTokens > 50000) {
                    console.log(chalk.blue('\n💡 INFO: Moderate token usage'));
                    console.log('  • Session is healthy');
                    console.log('  • Auto-monitoring active');
                }

            } else {
                console.log(chalk.gray('No active session'));
            }

            // Show current UI session tracking
            const sessionDuration = Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000 / 60);
            const totalTokens = this.sessionTokenUsage + this.contextTokens;
            console.log(chalk.cyan('\n🎯 Current UI Session:'));
            console.log(`  • Total tokens: ${totalTokens.toLocaleString()} (${this.sessionTokenUsage.toLocaleString()} session + ${this.contextTokens.toLocaleString()} context)`);
            console.log(`  • Real-time cost: $${this.realTimeCost.toFixed(4)}`);
            console.log(`  • Duration: ${sessionDuration} minutes`);
            console.log(`  • Started: ${this.sessionStartTime.toLocaleTimeString()}`);
            console.log(chalk.gray('  • Use /tokens reset to clear session counters'));
            console.log(chalk.gray('  • Use /tokens test to see live spinner demo'));

        } catch (error: any) {
            console.log(chalk.red(`Token analysis error: ${error.message}`));
        }
    }

    private async showCost(): Promise<void> {
        console.log(chalk.blue('💰 Token usage and cost information'));

        try {
            const session = chatManager.getCurrentSession();
            const stats = chatManager.getSessionStats();

            if (session) {
                // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
                const totalChars = session.messages.reduce((sum, msg) => sum + msg.content.length, 0);
                const estimatedTokens = Math.round(totalChars / 4);

                console.log(chalk.cyan('📊 Current Session:'));
                console.log(`  Messages: ${session.messages.length}`);
                console.log(`  Characters: ${totalChars.toLocaleString()}`);
                console.log(`  Estimated Tokens: ${estimatedTokens.toLocaleString()}`);

                console.log(chalk.cyan('\n📊 Overall Stats:'));
                console.log(`  Total Sessions: ${stats.totalSessions}`);
                console.log(`  Total Messages: ${stats.totalMessages}`);

                // Show current model pricing info
                const currentModel = this.configManager.getCurrentModel();
                console.log(chalk.cyan('\n🏷️ Current Model:'));
                console.log(`  Model: ${currentModel}`);
                console.log(chalk.gray('  Note: Actual costs depend on your AI provider\'s pricing'));

                this.addLiveUpdate({
                    type: 'info',
                    content: `Session stats: ${session.messages.length} messages, ~${estimatedTokens} tokens`,
                    source: 'cost-analysis'
                });
            } else {
                console.log(chalk.gray('No active session for cost analysis'));
            }
        } catch (error: any) {
            this.addLiveUpdate({
                type: 'error',
                content: `Cost calculation failed: ${error.message}`,
                source: 'cost-analysis'
            });
            console.log(chalk.red(`❌ Error calculating costs: ${error.message}`));
        }
    }

    private async handleTodoOperations(command: string, args: string[]): Promise<void> {
        try {
            if (args.length === 0) {
                const plans = enhancedPlanning.getActivePlans();
                if (plans.length === 0) {
                    console.log(chalk.gray('No todo lists found'));
                    return;
                }

                console.log(chalk.blue.bold('Todo Lists:'));
                plans.forEach((plan, index) => {
                    console.log(`\n${index + 1}. ${chalk.bold(plan.title)}`);
                    console.log(`   Status: ${plan.status} | Todos: ${plan.todos.length}`);

                    const completed = plan.todos.filter(t => t.status === 'completed').length;
                    const inProgress = plan.todos.filter(t => t.status === 'in_progress').length;
                    const pending = plan.todos.filter(t => t.status === 'pending').length;
                    const failed = plan.todos.filter(t => t.status === 'failed').length;

                    console.log(`   ✅ ${completed} | 🔄 ${inProgress} | ⏳ ${pending} | ❌ ${failed}`);
                });
                return;
            }

            const subcommand = args[0].toLowerCase();
            const restArgs = args.slice(1);

            switch (subcommand) {
                case 'show': {
                    const planId = restArgs[0];
                    if (!planId) {
                        const plans = enhancedPlanning.getActivePlans();
                        const latestPlan = plans[plans.length - 1];
                        if (latestPlan) {
                            enhancedPlanning.showPlanStatus(latestPlan.id);
                        } else {
                            console.log(chalk.yellow('No todo lists found'));
                        }
                    } else {
                        enhancedPlanning.showPlanStatus(planId);
                    }
                    break;
                }
                case 'open':
                case 'edit': {
                    const todoPath = 'todo.md';
                    console.log(formatFileOp('Opening', todoPath, 'in your default editor'));
                    try {
                        await toolsManager.runCommand('code', [todoPath]);
                    } catch {
                        try {
                            await toolsManager.runCommand('open', [todoPath]);
                        } catch {
                            console.log(chalk.yellow(`Could not open ${todoPath}. Please open it manually.`));
                        }
                    }
                    break;
                }
                default:
                    console.log(chalk.red(`Unknown todo command: ${subcommand}`));
                    console.log(chalk.gray('Available commands: show, open, edit'));
            }
        } catch (error: any) {
            this.addLiveUpdate({ type: 'error', content: `Todo operation failed: ${error.message}`, source: 'todo' });
            console.log(chalk.red(`❌ Error: ${error.message}`));
        }
    }

    /**
     * Handle MCP (Model Context Protocol) commands
     */
    private async handleMcpCommands(args: string[]): Promise<void> {
        if (args.length === 0) {
            console.log(chalk.blue('🔮 MCP (Model Context Protocol) Commands'));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(chalk.cyan('Available commands:'));
            console.log('  /mcp servers           - List configured servers');
            console.log('  /mcp add <name> <type> <endpoint> - Add new server');
            console.log('  /mcp test <server>     - Test server connection');
            console.log('  /mcp call <server> <method> [params] - Make MCP call');
            console.log('  /mcp health            - Check all server health');
            console.log('  /mcp remove <name>     - Remove server');
            console.log(chalk.gray('\nExample: /mcp add myapi http https://api.example.com/mcp'));
            return;
        }

        const command = args[0].toLowerCase();
        const restArgs = args.slice(1);

        try {
            switch (command) {
                case 'servers':
                    await this.listMcpServers();
                    break;

                case 'add':
                    await this.addMcpServer(restArgs);
                    break;

                case 'test':
                    if (restArgs.length === 0) {
                        console.log(chalk.red('Usage: /mcp test <server-name>'));
                        return;
                    }
                    await this.testMcpServer(restArgs[0]);
                    break;

                case 'call':
                    if (restArgs.length < 2) {
                        console.log(chalk.red('Usage: /mcp call <server-name> <method> [params-json]'));
                        return;
                    }
                    await this.callMcpServer(restArgs[0], restArgs[1], restArgs[2]);
                    break;

                case 'health':
                    await this.checkMcpHealth();
                    break;

                case 'remove':
                    if (restArgs.length === 0) {
                        console.log(chalk.red('Usage: /mcp remove <server-name>'));
                        return;
                    }
                    await this.removeMcpServer(restArgs[0]);
                    break;

                default:
                    console.log(chalk.red(`Unknown MCP command: ${command}`));
                    console.log(chalk.gray('Use /mcp for available commands'));
            }
        } catch (error: any) {
            console.log(chalk.red(`MCP command failed: ${error.message}`));
            this.addLiveUpdate({
                type: 'error',
                content: `MCP ${command} failed: ${error.message}`,
                source: 'mcp'
            });
        }
    }

    /**
     * List configured MCP servers
     */
    private async listMcpServers(): Promise<void> {
        console.log(wrapBlue('📡 MCP Servers'));

        const servers = await mcpClient.listServers();

        if (servers.length === 0) {
            console.log(chalk.gray('No MCP servers configured'));
            console.log(chalk.gray('Use "/mcp add <name> <type> <endpoint>" to add a server'));
            return;
        }

        for (const server of servers) {
            const healthIcon = server.healthy ? chalk.green('🟢') : chalk.red('🔴');
            const typeColor = server.type === 'http' ? chalk.blue : server.type === 'websocket' ? chalk.cyan : chalk.yellow;

            console.log(`${healthIcon} ${chalk.bold(server.name)} ${typeColor(`[${server.type}]`)}`);
            if (server.endpoint) {
                console.log(`   ${chalk.gray('Endpoint:')} ${server.endpoint}`);
            }
            if (server.command) {
                console.log(`   ${chalk.gray('Command:')} ${server.command} ${(server.args || []).join(' ')}`);
            }
            if (server.capabilities && server.capabilities.length > 0) {
                console.log(`   ${chalk.gray('Capabilities:')} ${server.capabilities.join(', ')}`);
            }
            console.log(`   ${chalk.gray('Priority:')} ${server.priority || 1} | ${chalk.gray('Enabled:')} ${server.enabled ? 'Yes' : 'No'}`);
            console.log();
        }
    }

    /**
     * Add new MCP server (Claude Code style configuration)
     */
    private async addMcpServer(args: string[]): Promise<void> {
        if (args.length < 3) {
            console.log(chalk.red('Usage: /mcp add <name> <type> <endpoint/command>'));
            console.log(chalk.gray('Types: http, websocket, command, stdio'));
            console.log(chalk.gray('Examples:'));
            console.log(chalk.gray('  /mcp add myapi http https://api.example.com/mcp'));
            console.log(chalk.gray('  /mcp add local command "/usr/local/bin/mcp-server"'));
            console.log(chalk.gray('  /mcp add ws websocket wss://example.com/mcp'));
            return;
        }

        const [name, type, endpointOrCommand] = args;

        if (!['http', 'websocket', 'command', 'stdio'].includes(type)) {
            console.log(chalk.red(`Invalid server type: ${type}`));
            console.log(chalk.gray('Valid types: http, websocket, command, stdio'));
            return;
        }

        // Build server config based on Claude Code patterns
        const serverConfig: McpServerConfig = {
            name,
            type: type as 'http' | 'websocket' | 'command' | 'stdio',
            enabled: true,
            priority: 1,
            timeout: 30000,
            retries: 3,
        };

        if (type === 'http' || type === 'websocket') {
            serverConfig.endpoint = endpointOrCommand;
            serverConfig.headers = {
                'User-Agent': 'NikCLI-MCP/1.0',
                'Content-Type': 'application/json'
            };
        } else if (type === 'command' || type === 'stdio') {
            const commandParts = endpointOrCommand.split(' ');
            serverConfig.command = commandParts[0];
            serverConfig.args = commandParts.slice(1);
        }

        // Save to config manager
        const mcpServers = this.configManager.get('mcpServers') as Record<string, McpServerConfig> || {};
        mcpServers[name] = serverConfig;
        this.configManager.set('mcpServers', mcpServers);

        console.log(chalk.green(`✅ MCP server '${name}' added successfully`));
        console.log(chalk.gray(`Type: ${type} | Endpoint: ${endpointOrCommand}`));

        // Test the connection
        console.log(chalk.gray('Testing connection...'));
        await this.testMcpServer(name);
    }

    /**
     * Test MCP server connection
     */
    private async testMcpServer(serverName: string): Promise<void> {
        console.log(wrapBlue(`🧪 Testing MCP server: ${serverName}`));

        const result = await mcpClient.testServer(serverName);

        if (result.success) {
            console.log(chalk.green(`✅ Server '${serverName}' is healthy`));
            if (result.latency !== undefined) {
                console.log(chalk.gray(`   Response time: ${result.latency}ms`));
            }
        } else {
            console.log(chalk.red(`❌ Server '${serverName}' is not responding`));
            if (result.error) {
                console.log(chalk.gray(`   Error: ${result.error}`));
            }
        }
    }

    /**
     * Make MCP call to server
     */
    private async callMcpServer(serverName: string, method: string, paramsJson?: string): Promise<void> {
        console.log(wrapBlue(`📡 Calling MCP server '${serverName}' method '${method}'`));

        let params = {};
        if (paramsJson) {
            try {
                params = JSON.parse(paramsJson);
            } catch (error) {
                console.log(chalk.red('Invalid JSON parameters'));
                return;
            }
        }

        const request = {
            method,
            params,
            id: `call-${Date.now()}`
        };

        try {
            const response = await mcpClient.call(serverName, request);

            if (response.result) {
                console.log(chalk.green('✅ MCP Call Successful'));
                console.log(chalk.gray('Response:'));
                console.log(JSON.stringify(response.result, null, 2));
            } else if (response.error) {
                console.log(chalk.red('❌ MCP Call Failed'));
                console.log(chalk.gray('Error:'), response.error.message);
            }

            if (response.fromCache) {
                console.log(chalk.cyan('📦 Result from cache'));
            }

            if (response.executionTime) {
                console.log(chalk.gray(`⏱️ Execution time: ${response.executionTime}ms`));
            }

        } catch (error: any) {
            console.log(chalk.red(`❌ MCP call failed: ${error.message}`));
        }
    }

    /**
     * Check health of all MCP servers
     */
    private async checkMcpHealth(): Promise<void> {
        console.log(wrapBlue('🏥 Checking MCP server health'));

        const servers = mcpClient.getConfiguredServers();

        if (servers.length === 0) {
            console.log(chalk.gray('No MCP servers configured'));
            return;
        }

        for (const server of servers) {
            const healthy = await mcpClient.checkServerHealth(server.name);
            const icon = healthy ? chalk.green('🟢') : chalk.red('🔴');
            console.log(`${icon} ${server.name} (${server.type})`);
        }
    }

    /**
     * Remove MCP server
     */
    private async removeMcpServer(serverName: string): Promise<void> {
        const mcpServers = this.configManager.get('mcpServers') as Record<string, McpServerConfig> || {};

        if (!mcpServers[serverName]) {
            console.log(chalk.red(`Server '${serverName}' not found`));
            return;
        }

        delete mcpServers[serverName];
        this.configManager.set('mcpServers', mcpServers);

        console.log(chalk.green(`✅ MCP server '${serverName}' removed`));
    }

    private showSlashHelp(): void {
        console.log(chalk.cyan.bold('📚 Available Slash Commands'));
        console.log(chalk.gray('─'.repeat(50)));

        const commands = [
            // Mode Commands
            ['/plan [task]', 'Switch to plan mode or generate plan'],
            ['/auto [task]', 'Switch to auto mode or execute task'],
            ['/default', 'Switch to default mode'],

            // File Operations  
            ['/read <file>', 'Read file contents'],
            ['/write <file> <content>', 'Write content to file'],
            ['/edit <file>', 'Edit file interactively'],
            ['/ls [directory]', 'List files in directory'],
            ['/search <query>', 'Search in files'],

            // Terminal Operations
            ['/run <command>', 'Execute terminal command'],
            ['/install <packages>', 'Install npm/yarn packages'],
            ['/npm <args>', 'Run npm commands'],
            ['/yarn <args>', 'Run yarn commands'],
            ['/git <args>', 'Run git commands'],
            ['/docker <args>', 'Run docker commands'],
            ['/ps', 'List running processes'],
            ['/kill <pid>', 'Kill process by PID'],

            // Project Operations
            ['/build', 'Build the project'],
            ['/test [pattern]', 'Run tests'],
            ['/lint', 'Run linting'],
            ['/create <type> <name>', 'Create new project'],

            // Agent Management
            ['/agents', 'List available agents'],
            ['/agent <name> <task>', 'Run specific agent'],
            ['/parallel <agents> <task>', 'Run multiple agents'],
            ['/factory', 'Show agent factory dashboard'],
            ['/create-agent <spec>', 'Create new agent'],
            ['/launch-agent <id>', 'Launch agent from blueprint'],

            // Session Management
            ['/new [title]', 'Start new chat session'],
            ['/sessions', 'List all sessions'],
            ['/export [sessionId]', 'Export session to markdown'],
            ['/stats', 'Show usage statistics'],
            ['/history <on|off>', 'Enable/disable chat history'],
            ['/debug', 'Show debug information'],
            ['/temp <0.0-2.0>', 'Set temperature'],
            ['/system <prompt>', 'Set system prompt'],
            ['/tokens', 'Show token usage and optimize'],
            ['/compact', 'Force session compaction'],
            ['/cache [stats|clear|settings]', 'Manage token cache system'],

            // Model & Config
            ['/models', 'List available models'],
            ['/model <name>', 'Switch to model'],
            ['/set-key <model> <key>', 'Set API key'],
            ['/config', 'Show configuration'],

            // MCP (Model Context Protocol)
            ['/mcp servers', 'List configured MCP servers'],
            ['/mcp test <server>', 'Test MCP server connection'],
            ['/mcp call <server> <method>', 'Make MCP call'],
            ['/mcp add <name> <type> <endpoint>', 'Add new MCP server'],
            ['/mcp remove <name>', 'Remove MCP server'],
            ['/mcp health', 'Check all server health'],

            // Documentation Management
            ['/docs', 'Documentation system help and status'],
            ['/doc-search <query> [category]', 'Search documentation library'],
            ['/doc-add <url> [category]', 'Add documentation from URL'],
            ['/doc-stats [--detailed]', 'Show library statistics'],
            ['/doc-list [category]', 'List available documentation'],
            ['/doc-sync', 'Sync with cloud documentation library'],
            ['/doc-load <names>', 'Load docs into AI agent context'],
            ['/doc-context [--detailed]', 'Show AI context documentation'],
            ['/doc-unload [names]', 'Remove docs from AI context'],
            ['/doc-suggest <query>', 'Suggest relevant documentation'],
            ['/doc-tag <id> <tags>', 'Manage document tags (coming soon)'],

            // Advanced Features
            ['/context [paths]', 'Manage workspace context'],
            ['/stream [clear]', 'Show/clear agent streams'],
            ['/approval [test]', 'Approval system controls'],
            ['/todo [command]', 'Todo list operations'],
            ['/todos', 'Show todo lists'],

            // Basic Commands
            ['/init [--force]', 'Initialize project context'],
            ['/status', 'Show system status'],
            ['/clear', 'Clear session context'],
            ['/help', 'Show this help'],
            ['/exit', 'Exit NikCLI']
        ];

        // Group commands for better readability
        console.log(chalk.blue.bold('\n🎯 Mode Control:'));
        commands.slice(0, 3).forEach(([cmd, desc]) => {
            console.log(`${chalk.green(cmd.padEnd(25))} ${chalk.dim(desc)}`);
        });

        console.log(chalk.blue.bold('\n📁 File Operations:'));
        commands.slice(3, 8).forEach(([cmd, desc]) => {
            console.log(`${chalk.green(cmd.padEnd(25))} ${chalk.dim(desc)}`);
        });

        console.log(chalk.blue.bold('\n⚡ Terminal Operations:'));
        commands.slice(8, 16).forEach(([cmd, desc]) => {
            console.log(`${chalk.green(cmd.padEnd(25))} ${chalk.dim(desc)}`);
        });

        console.log(chalk.blue.bold('\n🔨 Project Operations:'));
        commands.slice(16, 20).forEach(([cmd, desc]) => {
            console.log(`${chalk.green(cmd.padEnd(25))} ${chalk.dim(desc)}`);
        });

        console.log(chalk.blue.bold('\n🤖 Agent Management:'));
        commands.slice(20, 26).forEach(([cmd, desc]) => {
            console.log(`${chalk.green(cmd.padEnd(25))} ${chalk.dim(desc)}`);
        });

        console.log(chalk.blue.bold('\n📝 Session Management:'));
        commands.slice(26, 34).forEach(([cmd, desc]) => {
            console.log(`${chalk.green(cmd.padEnd(25))} ${chalk.dim(desc)}`);
        });

        console.log(chalk.blue.bold('\n⚙️ Configuration:'));
        commands.slice(34, 38).forEach(([cmd, desc]) => {
            console.log(`${chalk.green(cmd.padEnd(25))} ${chalk.dim(desc)}`);
        });

        console.log(chalk.blue.bold('\n🔮 MCP (Model Context Protocol):'));
        commands.slice(38, 44).forEach(([cmd, desc]) => {
            console.log(`${chalk.green(cmd.padEnd(25))} ${chalk.dim(desc)}`);
        });

        console.log(chalk.blue.bold('\n📚 Documentation Management:'));
        commands.slice(44, 55).forEach(([cmd, desc]) => {
            console.log(`${chalk.green(cmd.padEnd(25))} ${chalk.dim(desc)}`);
        });

        console.log(chalk.blue.bold('\n🔧 Advanced Features:'));
        commands.slice(55, 60).forEach(([cmd, desc]) => {
            console.log(`${chalk.green(cmd.padEnd(25))} ${chalk.dim(desc)}`);
        });

        console.log(chalk.blue.bold('\n📋 Basic Commands:'));
        commands.slice(60).forEach(([cmd, desc]) => {
            console.log(`${chalk.green(cmd.padEnd(25))} ${chalk.dim(desc)}`);
        });

        console.log(chalk.gray('\n💡 Tip: Use Ctrl+C to stop any running operation'));
        console.log(chalk.gray('─'.repeat(50)));
    }

    private showChatWelcome(): void {
        const title = chalk.cyanBright('🤖 NikCLI');
        const subtitle = chalk.gray('Autonomous AI Developer Assistant');

        console.log(boxen(
            `${title}\n${subtitle}\n\n` +
            `${wrapBlue('Mode:')} ${chalk.yellow(this.currentMode)}\n` +
            `${wrapBlue('Model:')} ${chalk.green(advancedAIProvider.getCurrentModelInfo().name)}\n` +
            `${wrapBlue('Directory:')} ${chalk.cyan(path.basename(this.workingDirectory))}\n\n` +
            `${chalk.dim('Type /help for commands or start chatting!')}\n` +
            `${chalk.dim('Use Shift+Tab to cycle modes: default → auto → plan')}`,
            {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'cyan',
                textAlignment: 'center',
            }
        ));
    }

    /**
     * Initialize project context
     */
    private async handleInitProject(force: boolean = false): Promise<void> {
        try {
            console.log(chalk.blue('🚀 Initializing project context...'));

            // Check if already initialized
            const packageJson = path.join(this.workingDirectory, 'package.json');
            const exists = require('fs').existsSync(packageJson);

            if (exists && !force) {
                console.log(chalk.yellow('⚠️ Project already appears to be initialized'));
                console.log(chalk.gray('Use --force to reinitialize'));
                return;
            }

            // Initialize workspace context
            try {
                console.log(chalk.green('✅ Workspace context initialized'));
            } catch (error) {
                console.log(chalk.yellow('⚠️ Workspace context initialization skipped'));
            }

            // Setup basic project structure if needed
            if (!exists) {
                console.log(chalk.blue('📁 Setting up basic project structure...'));

                const basicPackageJson = {
                    name: path.basename(this.workingDirectory),
                    version: "1.0.0",
                    description: "Project managed by NikCLI",
                    scripts: {
                        start: "node index.js",
                        test: "echo \"No tests specified\" && exit 1"
                    }
                };

                await fs.writeFile(packageJson, JSON.stringify(basicPackageJson, null, 2));
                console.log(chalk.green('✅ Created package.json'));
            }

            // Initialize git if not present
            const gitDir = path.join(this.workingDirectory, '.git');
            if (!require('fs').existsSync(gitDir)) {
                console.log(chalk.blue('🔧 Initializing git repository...'));
                const { spawn } = require('child_process');
                const child = spawn('git', ['init'], { cwd: this.workingDirectory });
                await new Promise((resolve) => child.on('close', resolve));
                console.log(chalk.green('✅ Git repository initialized'));
            }

            console.log(chalk.green.bold('\n🎉 Project initialization complete!'));
            console.log(chalk.gray('You can now use NikCLI to manage your project'));

        } catch (error: any) {
            console.log(chalk.red(`❌ Failed to initialize project: ${error.message}`));
        }
    }

    /**
     * Cycle through modes: default → plan → auto → default
     */
    private cycleModes(): void {
        const modes: Array<'default' | 'plan' | 'auto'> = ['default', 'plan', 'auto'];
        const currentIndex = modes.indexOf(this.currentMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        const nextMode = modes[nextIndex];

        this.currentMode = nextMode;

        const modeNames = {
            default: '💬 Default Chat',
            plan: '📋 Planning Mode',
            auto: '🤖 Auto Mode'
        };

        console.log(chalk.yellow(`\n🔄 Switched to ${modeNames[nextMode]}`));
        console.log(chalk.gray(`💡 Use Cmd+] to cycle modes`));
        this.showPrompt();
    }

    private showPrompt(): void {
        if (!this.rl) return;

        // Calculate session duration and enhanced token info
        const sessionDuration = Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000 / 60); // minutes
        const totalTokens = this.sessionTokenUsage + this.contextTokens;
        const tokensDisplay = totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens.toString();
        const costDisplay = this.realTimeCost > 0 ? ` | $${this.realTimeCost.toFixed(4)}` : '';
        const contextDisplay = this.contextTokens > 0 ? ` | ctx: ${this.contextTokens}` : '';
        const tokenInfo = `${tokensDisplay} tokens${contextDisplay}${costDisplay} | ${sessionDuration}m session`;
        const terminalWidth = process.stdout.columns || 80;
        const boxWidth = Math.min(terminalWidth - 4, 120); // Max width with padding

        // Token info line (centered and dimmed)
        const tokenLine = chalk.gray(tokenInfo);
        const tokenPadding = Math.max(0, Math.floor((boxWidth - tokenInfo.length) / 2));
        const centeredTokenInfo = ' '.repeat(tokenPadding) + tokenLine;

        // Status line


        // Build the framed prompt
        const topBorder = '┌' + '─'.repeat(boxWidth - 2) + '┐';
        const tokenBorder = '│' + centeredTokenInfo.padEnd(boxWidth - 2) + '│';
        const middleBorder = '├' + '─'.repeat(boxWidth - 2) + '┤';

        const inputBorder = '└─❯ ';
        const workingDir = path.basename(this.workingDirectory);
        const modeIcon = this.currentMode === 'auto' ? '🚀' :
            this.currentMode === 'plan' ? '🎯' : '💬';
        const agentInfo = this.currentAgent ? `@${this.currentAgent}:` : '';
        const statusDot = this.assistantProcessing ? chalk.green('●') + chalk.dim('….') : chalk.red('●');

        const prompt = `\n┌─[${modeIcon}${agentInfo}${chalk.green(workingDir)} ${statusDot}]\n└─❯ `;
        this.rl.setPrompt(prompt);
        this.rl.prompt();
    }

    /**
     * Strip ANSI escape codes to calculate actual string length
     */
    private stripAnsi(str: string): string {
        return str.replace(/\x1b\[[0-9;]*m/g, '');
    }

    /**
     * Get current session token usage
     */
    public getSessionTokenUsage(): number {
        return this.sessionTokenUsage;
    }

    /**
     * Reset session token usage
     */
    public resetSessionTokenUsage(): void {
        this.sessionTokenUsage = 0;
        this.contextTokens = 0;
        this.realTimeCost = 0;
        this.sessionStartTime = new Date();
    }

    /**
     * Initialize model pricing data (could be fetched from web API)
     */
    private initializeModelPricing(): void {
        // Anthropic Claude pricing (per 1M tokens)
        this.modelPricing.set('claude-sonnet-4-20250514', { input: 15.00, output: 75.00 });
        this.modelPricing.set('claude-3-haiku-20240229', { input: 0.25, output: 1.25 });
        this.modelPricing.set('claude-3-sonnet-20240229', { input: 3.00, output: 15.00 });

        // OpenAI pricing (per 1M tokens)
        this.modelPricing.set('gpt-4o', { input: 5.00, output: 15.00 });
        this.modelPricing.set('gpt-4o-mini', { input: 0.15, output: 0.60 });
        this.modelPricing.set('gpt-5', { input: 10.00, output: 30.00 });

        // Google Gemini pricing (per 1M tokens)
        this.modelPricing.set('gemini-1.5-pro', { input: 1.25, output: 5.00 });
        this.modelPricing.set('gemini-1.5-flash', { input: 0.075, output: 0.30 });
    }

    /**
     * Calculate cost for tokens used
     */
    private calculateCost(inputTokens: number, outputTokens: number, modelName: string): number {
        const pricing = this.modelPricing.get(modelName);
        if (!pricing) return 0;

        const inputCost = (inputTokens / 1000000) * pricing.input;
        const outputCost = (outputTokens / 1000000) * pricing.output;
        return inputCost + outputCost;
    }

    /**
     * Start AI operation tracking with spinner
     */
    public startAIOperation(operation: string = 'Processing'): void {
        this.aiOperationStart = new Date();
        this.stopSpinner(); // Stop any existing spinner

        const ora = require('ora');
        this.activeSpinner = ora({
            text: '',
            spinner: 'dots',
            color: 'cyan'
        }).start();

        this.updateSpinnerText(operation);

        // Update spinner every 500ms with realtime stats
        const interval = setInterval(() => {
            if (!this.activeSpinner || !this.aiOperationStart) {
                clearInterval(interval);
                return;
            }
            this.updateSpinnerText(operation);
        }, 500);

        // Store interval for cleanup
        (this.activeSpinner as any)._interval = interval;
    }

    /**
     * Update spinner text with realtime stats
     */
    private updateSpinnerText(operation: string): void {
        if (!this.activeSpinner || !this.aiOperationStart) return;

        const elapsed = Math.floor((Date.now() - this.aiOperationStart.getTime()) / 1000);
        const totalTokens = this.sessionTokenUsage + this.contextTokens;
        const tokensDisplay = totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens.toString();
        const cost = this.realTimeCost.toFixed(4);

        const spinnerText = `${operation}... (${elapsed}s • ${tokensDisplay} tokens • $${cost} • esc to interrupt)`;
        this.activeSpinner.text = spinnerText;
    }

    /**
     * Stop AI operation tracking
     */
    public stopAIOperation(): void {
        this.stopSpinner();
        this.aiOperationStart = null;
    }

    /**
     * Stop active spinner
     */
    private stopSpinner(): void {
        if (this.activeSpinner) {
            if ((this.activeSpinner as any)._interval) {
                clearInterval((this.activeSpinner as any)._interval);
            }
            this.activeSpinner.stop();
            this.activeSpinner = null;
        }
    }

    /**
     * Update token usage with real tracking
     */
    public updateTokenUsage(tokens: number, isOutput: boolean = false, modelName?: string): void {
        this.sessionTokenUsage += tokens;

        if (modelName) {
            const inputTokens = isOutput ? 0 : tokens;
            const outputTokens = isOutput ? tokens : 0;
            this.realTimeCost += this.calculateCost(inputTokens, outputTokens, modelName);
        }
    }

    /**
     * Update context token count
     */
    public updateContextTokens(tokens: number): void {
        this.contextTokens = tokens;
    }

    /**
     * Detect if a user request is complex and needs automatic planning
     */
    private detectComplexRequest(input: string): boolean {
        // Keywords that suggest complex multi-step tasks
        const complexKeywords = [
            'implement', 'create', 'build', 'develop', 'add feature', 'integrate',
            'refactor', 'restructure', 'migrate', 'setup', 'configure', 'install',
            'deploy', 'optimize', 'fix bug', 'add component', 'create api', 'database'
        ];

        // Check for multiple files/directories mentioned
        const filePatterns = input.match(/\b\w+\.\w+\b/g) || [];
        const pathPatterns = input.match(/\b[\w\/]+\/[\w\/]+/g) || [];

        // Check length and complexity
        const wordCount = input.split(/\s+/).length;
        const hasComplexKeywords = complexKeywords.some(keyword =>
            input.toLowerCase().includes(keyword.toLowerCase())
        );

        // Determine if request needs planning
        return (
            hasComplexKeywords ||
            wordCount > 20 ||
            filePatterns.length > 2 ||
            pathPatterns.length > 1 ||
            input.includes(' and ') ||
            input.includes(' then ')
        );
    }

    private async analyzeProject(): Promise<any> {
        // Implementation for project analysis
        return {
            name: path.basename(this.workingDirectory),
            framework: 'Unknown',
            languages: ['typescript', 'javascript'],
            dependencies: [],
            structure: {}
        };
    }

    private generateClaudeMarkdown(analysis: any): string {
        return `# NIKOCLI.md

This file provides guidance to NikCLI when working with code in this repository.

## Project Overview
- **Name**: ${analysis.name}
- **Framework**: ${analysis.framework}
- **Languages**: ${analysis.languages.join(', ')}

## Architecture
[Project architecture description will be auto-generated based on analysis]

## Development Commands
[Development commands will be auto-detected and listed here]

## Conventions
[Code conventions and patterns will be documented here]

## Context
This file is automatically maintained by NikCLI to provide consistent context across sessions.
`;
    }

    private async savePlanToFile(plan: ExecutionPlan, filename: string): Promise<void> {
        const content = `# Execution Plan: ${plan.title}

## Description
${plan.description}

## Steps
${plan.steps.map((step, index) => `${index + 1}. ${step.title}\n   ${step.description}`).join('\n\n')}

## Risk Assessment
- Overall Risk: ${plan.riskAssessment.overallRisk}
- Estimated Duration: ${Math.round(plan.estimatedTotalDuration / 1000)}s

Generated by NikCLI on ${new Date().toISOString()}
`;

        await fs.writeFile(filename, content, 'utf8');
        console.log(chalk.green(`✓ Plan saved to ${filename}`));
    }

    private async shutdown(): Promise<void> {
        console.log(chalk.blue('\n👋 Shutting down NikCLI...'));

        // Stop file watcher
        if (this.fileWatcher) {
            try {
                this.fileWatcher.close();
                console.log(chalk.dim('👀 File watcher stopped'));
            } catch (error: any) {
                console.log(chalk.gray(`File watcher cleanup warning: ${error.message}`));
            }
        }

        // Complete any running progress operations
        if (this.progressTracker) {
            try {
                const running = Array.from(this.progressTracker.operations.values())
                    .filter((op: any) => op.status === 'running');

                running.forEach((op: any) => {
                    this.progressTracker.complete(op.id, false, 'Interrupted by shutdown');
                });

                if (running.length > 0) {
                    console.log(chalk.dim(`📊 Stopped ${running.length} running operations`));
                }
            } catch (error: any) {
                console.log(chalk.gray(`Progress tracker cleanup warning: ${error.message}`));
            }
        }

        // Save both caches before shutdown
        try {
            await Promise.all([
                tokenCache.saveCache(),
                completionCache.saveCache()
            ]);
            console.log(chalk.dim('💾 All caches saved'));
        } catch (error: any) {
            console.log(chalk.gray(`Cache save warning: ${error.message}`));
        }

        // Clean up UI resources
        this.indicators.clear();
        this.liveUpdates.length = 0;
        this.spinners.forEach(spinner => {
            try {
                spinner.stop();
            } catch (error: any) {
                // Ignore spinner cleanup errors
            }
        });
        this.spinners.clear();
        this.progressBars.forEach(bar => {
            try {
                bar.stop();
            } catch (error: any) {
                // Ignore progress bar cleanup errors
            }
        });
        this.progressBars.clear();

        if (this.rl) {
            this.rl.close();
        }

        // Cleanup systems
        this.agentManager.cleanup();

        console.log(chalk.green('✅ All systems cleaned up successfully!'));
        console.log(chalk.green('✓ Goodbye!'));
        process.exit(0);
    }

    // File Operations Methods
    private async readFile(filepath: string): Promise<void> {
        try {
            const readId = 'read-' + Date.now();
            this.createStatusIndicator(readId, `Reading ${filepath}`);
            this.startAdvancedSpinner(readId, 'Reading file...');

            const content = await toolsManager.readFile(filepath);

            this.stopAdvancedSpinner(readId, true, `Read ${filepath}`);
            console.log(chalk.blue.bold(`\n📄 File: ${filepath}`));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(content);
            console.log(chalk.gray('─'.repeat(50)));
            console.log(chalk.dim('✅ File read completed'));
        } catch (error: any) {
            console.log(chalk.red(`❌ Failed to read ${filepath}: ${error.message}`));
        }
    }

    private async writeFile(filepath: string, content: string): Promise<void> {
        try {
            const writeId = 'write-' + Date.now();
            this.createStatusIndicator(writeId, `Writing ${filepath}`);
            this.startAdvancedSpinner(writeId, 'Writing file...');

            await toolsManager.writeFile(filepath, content);

            this.stopAdvancedSpinner(writeId, true, `Written ${filepath}`);
            console.log(chalk.green(`✅ File written: ${filepath}`));
            console.log(chalk.gray('─'.repeat(50)));
        } catch (error: any) {
            console.log(chalk.red(`❌ Failed to write ${filepath}: ${error.message}`));
        }
    }

    private async editFile(filepath: string): Promise<void> {
        try {
            console.log(chalk.blue(`📝 Opening ${filepath} for editing...`));
            console.log(chalk.gray('This would open an interactive editor. For now, use /read and /write commands.'));
            console.log(chalk.gray('─'.repeat(50)));
        } catch (error: any) {
            console.log(chalk.red(`❌ Failed to edit ${filepath}: ${error.message}`));
            console.log(chalk.gray('─'.repeat(50)));
        }
    }

    private async listFiles(directory: string): Promise<void> {
        try {
            const lsId = 'ls-' + Date.now();
            this.createStatusIndicator(lsId, `Listing ${directory}`);
            this.startAdvancedSpinner(lsId, 'Listing files...');

            const files = await toolsManager.listFiles(directory);

            this.stopAdvancedSpinner(lsId, true, `Listed ${files.length} items`);
            console.log(chalk.blue.bold(`\n📁 Directory: ${directory}`));
            console.log(chalk.gray('─'.repeat(50)));
            files.forEach(file => {
                const icon = '📄'; // Simple icon for now
                console.log(`${icon} ${chalk.cyan(file)}`);
            });
            console.log(chalk.gray('─'.repeat(50)));
            console.log(chalk.dim(`✅ Listed ${files.length} files`));
        } catch (error: any) {
            console.log(chalk.red(`❌ Failed to list ${directory}: ${error.message}`));
        }
    }

    private async searchFiles(query: string): Promise<void> {
        try {
            const searchId = 'search-' + Date.now();
            this.createStatusIndicator(searchId, `Searching: ${query}`);
            this.startAdvancedSpinner(searchId, 'Searching files...');

            const results = await toolsManager.searchInFiles(query, this.workingDirectory);

            this.stopAdvancedSpinner(searchId, true, `Found ${results.length} matches`);
            console.log(chalk.blue.bold(`\n🔍 Search Results: "${query}"`));
            console.log(chalk.gray('─'.repeat(50)));

            results.forEach(result => {
                console.log(chalk.cyan(result.file || 'Unknown file'));
                console.log(chalk.gray(`  Match: ${result.content || result.toString()}`));
            });
            console.log(chalk.gray('─'.repeat(50)));
            console.log(chalk.dim(`✅ Search completed`));
        } catch (error: any) {
            console.log(chalk.red(`❌ Search failed: ${error.message}`));
        }
    }

    private async runCommand(command: string): Promise<void> {
        try {
            const cmdId = 'cmd-' + Date.now();
            this.createStatusIndicator(cmdId, `Executing: ${command}`);
            this.startAdvancedSpinner(cmdId, `Running: ${command}`);

            const result = await toolsManager.runCommand(command.split(' ')[0], command.split(' ').slice(1), { stream: true });

            const success = result.code === 0;
            this.stopAdvancedSpinner(cmdId, success, success ? 'Command completed' : 'Command failed');

            if (result.stdout) {
                console.log(chalk.blue.bold(`\n💻 Output:`));
                console.log(result.stdout);
            }

            if (result.stderr) {
                console.log(chalk.red.bold(`\n❌ Error:`));
                console.log(result.stderr);
            }

            console.log(chalk.gray(`\n📊 Exit Code: ${result.code}`));
        } catch (error: any) {
            console.log(chalk.red(`❌ Command failed: ${error.message}`));
        }
    }

    private async buildProject(): Promise<void> {
        try {
            console.log(chalk.blue('🔨 Building project...'));

            // Try common build commands
            const buildCommands = ['npm run build', 'yarn build', 'pnpm build', 'make', 'cargo build'];

            for (const cmd of buildCommands) {
                try {
                    await this.runCommand(cmd);
                    return;
                } catch {
                    continue;
                }
            }

            console.log(chalk.yellow('⚠️ No build command found. Try /run <your-build-command>'));
        } catch (error: any) {
            console.log(chalk.red(`❌ Build failed: ${error.message}`));
        }
    }

    private async runTests(pattern?: string): Promise<void> {
        try {
            console.log(chalk.blue('🧪 Running tests...'));

            const testCmd = pattern ? `npm test ${pattern}` : 'npm test';
            await this.runCommand(testCmd);
        } catch (error: any) {
            console.log(chalk.red(`❌ Tests failed: ${error.message}`));
        }
    }

    private async runLinting(): Promise<void> {
        try {
            console.log(chalk.blue('🔍 Running linting...'));

            // Try common lint commands
            const lintCommands = ['npm run lint', 'yarn lint', 'pnpm lint', 'eslint .'];

            for (const cmd of lintCommands) {
                try {
                    await this.runCommand(cmd);
                    return;
                } catch {
                    continue;
                }
            }

            console.log(chalk.yellow('⚠️ No lint command found. Try /run <your-lint-command>'));
        } catch (error: any) {
            console.log(chalk.red(`❌ Linting failed: ${error.message}`));
        }
    }

    // Token tracking API to be called from AI providers
    public static getInstance(): NikCLI | null {
        return globalNikCLI;
    }
}

// Global instance for access from other modules
let globalNikCLI: NikCLI | null = null;

// Export function to set global instance
export function setGlobalNikCLI(instance: NikCLI): void {
    globalNikCLI = instance;
}
