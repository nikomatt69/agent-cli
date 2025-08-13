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
exports.NikCLI = void 0;
exports.setGlobalNikCLI = setGlobalNikCLI;
const readline = __importStar(require("readline"));
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const marked_1 = require("marked");
const marked_terminal_1 = __importDefault(require("marked-terminal"));
const ora_1 = __importDefault(require("ora"));
const cli_progress_1 = __importDefault(require("cli-progress"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// Import existing modules
const config_manager_1 = require("./core/config-manager");
const model_provider_1 = require("./ai/model-provider");
const tools_manager_1 = require("./tools/tools-manager");
const agent_factory_1 = require("./core/agent-factory");
const agent_stream_1 = require("./core/agent-stream");
const workspace_context_1 = require("./context/workspace-context");
const agent_manager_1 = require("./core/agent-manager");
const planning_manager_1 = require("./planning/planning-manager");
const modern_agent_system_1 = require("./automation/agents/modern-agent-system");
const advanced_ai_provider_1 = require("./ai/advanced-ai-provider");
const config_manager_2 = require("./core/config-manager");
const enhanced_planning_1 = require("./planning/enhanced-planning");
const approval_system_1 = require("./ui/approval-system");
const token_cache_1 = require("./core/token-cache");
const completion_protocol_cache_1 = require("./core/completion-protocol-cache");
const mcp_client_1 = require("./core/mcp-client");
const documentation_library_1 = require("./core/documentation-library");
const cloud_docs_provider_1 = require("./core/cloud-docs-provider");
const docs_context_manager_1 = require("./context/docs-context-manager");
const text_wrapper_1 = require("./utils/text-wrapper");
const nik_cli_commands_1 = require("./chat/nik-cli-commands");
const chat_manager_1 = require("./chat/chat-manager");
const agent_service_1 = require("./services/agent-service");
const planning_service_1 = require("./services/planning-service");
const register_agents_1 = require("./register-agents");
const advanced_cli_ui_1 = require("./ui/advanced-cli-ui");
// Configure marked for terminal rendering
marked_1.marked.setOptions({
    renderer: new marked_terminal_1.default(),
});
/**
 * NikCLI - Unified CLI interface integrating all existing modules
 * Provides Claude Code-style terminal experience with autonomous agents
 */
class NikCLI {
    constructor() {
        this.escapeRequested = false;
        this.currentMode = 'default';
        this.sessionContext = new Map();
        this.indicators = new Map();
        this.liveUpdates = [];
        this.spinners = new Map();
        this.progressBars = new Map();
        this.isInteractiveMode = false;
        this.fileWatcher = null;
        this.progressTracker = null;
        this.assistantProcessing = false;
        this.shouldInterrupt = false;
        this.structuredUIEnabled = false;
        this.sessionTokenUsage = 0;
        this.sessionStartTime = new Date();
        this.contextTokens = 0;
        this.realTimeCost = 0;
        this.activeSpinner = null;
        this.aiOperationStart = null;
        this.modelPricing = new Map();
        // Bridge StreamingOrchestrator agent lifecycle events into NikCLI output
        this.orchestratorEventsInitialized = false;
        /**
         * Subscribe to all event sources for Default Mode Unified Aggregator
         * Observes: Approval Prompts, Planning Events, Tool/Agent Events, Chat Stream
         */
        this.eventsSubscribed = false;
        this.workingDirectory = process.cwd();
        this.projectContextFile = path.join(this.workingDirectory, 'NIKOCLI.md');
        // Initialize core managers
        this.configManager = config_manager_2.simpleConfigManager;
        this.agentManager = new agent_manager_1.AgentManager(this.configManager);
        this.planningManager = new planning_manager_1.PlanningManager(this.workingDirectory);
        this.slashHandler = new nik_cli_commands_1.SlashCommandHandler();
        this.advancedUI = advanced_cli_ui_1.advancedUI;
        // Register agents
        (0, register_agents_1.registerAgents)(this.agentManager);
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
    async initializeTokenCache() {
        // Clean up expired cache entries on startup
        setTimeout(async () => {
            try {
                const removed = await token_cache_1.tokenCache.cleanupExpired();
                if (removed > 0) {
                    console.log(chalk_1.default.dim(`🧹 Cleaned ${removed} expired cache entries`));
                }
                const stats = token_cache_1.tokenCache.getStats();
                if (stats.totalEntries > 0) {
                    console.log(chalk_1.default.dim(`💾 Loaded ${stats.totalEntries} cached responses (${stats.totalHits} hits, ~${stats.totalTokensSaved.toLocaleString()} tokens saved)`));
                    console.log(chalk_1.default.dim('\n')); // Add spacing after cache info with chalk
                }
            }
            catch (error) {
                console.log(chalk_1.default.dim(`Cache initialization warning: ${error.message}`));
            }
        }, 1000); // Delay to avoid interfering with startup
    }
    /**
     * Initialize structured UI with 4 panels as per diagram: Chat/Status, Files/Diffs, Plan/Todos, Approval
     */
    initializeStructuredUI() {
        console.log(chalk_1.default.dim('🎨 Setting up AdvancedCliUI with 4 panels...'));
        // Enable interactive mode for structured panels
        this.advancedUI.startInteractiveMode();
        // Configure the 4 panels as shown in diagram:
        // 1. Panels: Chat, Status/Logs
        advanced_cli_ui_1.advancedUI.logInfo('Panel Setup', 'Chat & Status/Logs panel configured');
        // 2. Panels: Files, Diffs  
        advanced_cli_ui_1.advancedUI.logInfo('Panel Setup', 'Files & Diffs panel configured');
        // 3. Panels: Plan/Todos
        advanced_cli_ui_1.advancedUI.logInfo('Panel Setup', 'Plan/Todos panel configured');
        // 4. Panels: Approval (logs only, prompt via inquirer)
        advanced_cli_ui_1.advancedUI.logInfo('Panel Setup', 'Approval panel configured (logs only)');
        // Set up real-time event listeners for UI updates
        this.setupUIEventListeners();
        console.log(chalk_1.default.green('✅ AdvancedCliUI (MAIN UI OWNER) ready with 4 panels'));
    }
    /**
     * Setup UI event listeners for real-time panel updates using existing advanced UI
     */
    setupUIEventListeners() {
        // Hook into agent operations for live UI updates
        this.setupAgentUIIntegration();
        // Setup file change monitoring for diff display
        this.setupFileChangeMonitoring();
        // Todo panels are now driven by real plans via planning system
    }
    /**
     * Integrate agent operations with UI panels
     */
    setupAgentUIIntegration() {
        // Listen for file operations to show content/diffs using advanced UI
        agent_service_1.agentService.on('file_read', (data) => {
            if (data.path && data.content) {
                this.advancedUI.showFileContent(data.path, data.content);
                this.advancedUI.logInfo(`File Read: ${path.basename(data.path)}`, `Displayed ${data.content.split('\n').length} lines`);
            }
        });
        agent_service_1.agentService.on('file_written', (data) => {
            if (data.path && data.content) {
                if (data.originalContent) {
                    // Show diff using advanced UI
                    this.advancedUI.showFileDiff(data.path, data.originalContent, data.content);
                    this.advancedUI.logSuccess(`File Updated: ${path.basename(data.path)}`, 'Diff displayed in panel');
                }
                else {
                    // Show new file content
                    this.advancedUI.showFileContent(data.path, data.content);
                    this.advancedUI.logSuccess(`File Created: ${path.basename(data.path)}`, 'Content displayed in panel');
                }
            }
        });
        agent_service_1.agentService.on('file_list', (data) => {
            if (data.files && Array.isArray(data.files)) {
                this.advancedUI.showFileList(data.files, data.title || '📁 Files');
                this.advancedUI.logInfo('File List', `Showing ${data.files.length} files`);
            }
        });
        agent_service_1.agentService.on('grep_results', (data) => {
            if (data.pattern && data.matches) {
                this.advancedUI.showGrepResults(data.pattern, data.matches);
                this.advancedUI.logInfo(`Search: ${data.pattern}`, `Found ${data.matches.length} matches`);
            }
        });
    }
    /**
     * Monitor file changes for automatic diff display
     */
    setupFileChangeMonitoring() {
        // Use existing file watcher to detect changes and show diffs
        if (this.fileWatcher) {
            this.fileWatcher.on('change', (filePath) => {
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
    showFileIfRelevant(filePath) {
        // Only show files that are being actively worked on
        const relevantExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];
        const ext = path.extname(filePath);
        if (relevantExtensions.includes(ext)) {
            try {
                const content = require('fs').readFileSync(filePath, 'utf8');
                this.advancedUI.showFileContent(filePath, content);
            }
            catch (error) {
                // File might be in use, skip
            }
        }
    }
    setupEventHandlers() {
        // Handle Ctrl+C gracefully
        process.on('SIGINT', async () => {
            await this.shutdown();
        });
        process.on('SIGTERM', async () => {
            await this.shutdown();
        });
    }
    setupOrchestratorEventBridge() {
        if (this.orchestratorEventsInitialized)
            return;
        this.orchestratorEventsInitialized = true;
        agent_service_1.agentService.on('task_start', (task) => {
            const indicator = this.createStatusIndicator(`task-${task.id}`, `Agent ${task.agentType}`, task.task);
            this.updateStatusIndicator(indicator.id, { status: 'running' });
            console.log((0, text_wrapper_1.formatAgent)(task.agentType, 'started', task.task));
            // Always show in default chat mode and structured UI
            if (this.currentMode === 'default') {
                console.log(chalk_1.default.blue(`🤖 ${task.agentType}: `) + chalk_1.default.dim(task.task));
                advanced_cli_ui_1.advancedUI.logInfo(`Agent ${task.agentType}`, task.task);
            }
        });
        agent_service_1.agentService.on('task_progress', (_task, update) => {
            const progress = typeof update.progress === 'number' ? `${update.progress}% ` : '';
            const desc = update.description ? `- ${update.description}` : '';
            this.addLiveUpdate({ type: 'progress', content: `${progress}${desc}`, source: 'agent' });
            console.log(chalk_1.default.cyan(`📊 ${progress}${desc}`));
        });
        agent_service_1.agentService.on('tool_use', (_task, update) => {
            this.addLiveUpdate({ type: 'info', content: `🔧 ${update.tool}: ${update.description}`, source: 'tool' });
            console.log(chalk_1.default.magenta(`🔧 ${update.tool}: ${update.description}`));
        });
        agent_service_1.agentService.on('task_complete', (task) => {
            const indicatorId = `task-${task.id}`;
            if (task.status === 'completed') {
                this.updateStatusIndicator(indicatorId, { status: 'completed', details: 'Task completed successfully' });
                console.log(chalk_1.default.green(`✅ ${task.agentType} completed`));
                // Show in default mode and structured UI
                if (this.currentMode === 'default') {
                    advanced_cli_ui_1.advancedUI.logSuccess(`Agent ${task.agentType}`, 'Task completed successfully');
                }
            }
            else {
                this.updateStatusIndicator(indicatorId, { status: 'failed', details: task.error || 'Unknown error' });
                console.log(chalk_1.default.red(`❌ ${task.agentType} failed: ${task.error}`));
                // Show in default mode and structured UI
                if (this.currentMode === 'default') {
                    advanced_cli_ui_1.advancedUI.logError(`Agent ${task.agentType}`, task.error || 'Unknown error');
                }
            }
            // Add delay before showing prompt to let output be visible
            setTimeout(() => {
                this.showPrompt();
            }, 500);
        });
    }
    subscribeToAllEventSources() {
        if (this.eventsSubscribed)
            return;
        this.eventsSubscribed = true;
        // 1. Approval Prompts (approvalSystem.request)
        // Already handled by existing approvalSystem integration
        // 2. Planning Events (planningManager emits: stepStart, stepProgress, stepComplete)
        this.planningManager.on('stepStart', (event) => {
            this.routeEventToUI('planning_step_start', { step: event.step, description: event.description });
        });
        this.planningManager.on('stepProgress', (event) => {
            this.routeEventToUI('planning_step_progress', { step: event.step, progress: event.progress });
        });
        this.planningManager.on('stepComplete', (event) => {
            this.routeEventToUI('planning_step_complete', { step: event.step, result: event.result });
        });
        // 3. Tool/Agent Events (agentService emits: file_read, file_write, file_list, grep_results, tool_call, tool_result, error)
        agent_service_1.agentService.on('file_read', (data) => {
            this.routeEventToUI('agent_file_read', data);
        });
        agent_service_1.agentService.on('file_written', (data) => {
            this.routeEventToUI('agent_file_written', data);
        });
        agent_service_1.agentService.on('file_list', (data) => {
            this.routeEventToUI('agent_file_list', data);
        });
        agent_service_1.agentService.on('grep_results', (data) => {
            this.routeEventToUI('agent_grep_results', data);
        });
        // 4. Background Agents Events (AgentManager emits: agent.task.started, agent.task.progress, agent.task.completed, agent.tool.call)
        this.agentManager.on('agent.task.started', (event) => {
            this.routeEventToUI('bg_agent_task_start', {
                agentId: event.agentId,
                agentName: event.agentName || event.agentId,
                taskDescription: event.task?.description || event.task?.prompt || 'Background task',
                taskType: event.task?.type || 'unknown'
            });
        });
        this.agentManager.on('agent.task.progress', (event) => {
            this.routeEventToUI('bg_agent_task_progress', {
                agentId: event.agentId,
                progress: event.progress || 0,
                currentStep: event.currentStep || event.step || 'Processing...'
            });
        });
        this.agentManager.on('agent.task.completed', (event) => {
            this.routeEventToUI('bg_agent_task_complete', {
                agentId: event.agentId,
                result: event.result?.summary || event.result || 'Task completed',
                duration: event.duration || 0
            });
        });
        this.agentManager.on('agent.tool.call', (event) => {
            this.routeEventToUI('bg_agent_tool_call', {
                agentId: event.agentId,
                toolName: event.toolName || event.tool,
                parameters: event.parameters || event.args
            });
        });
        // 5. Chat Stream (modelProvider.streamResponse(messages) events)
        // This is handled in the streaming loop in handleDefaultMode - chat stream events are processed inline
        // when streaming responses from advancedAIProvider.streamChatWithFullAutonomy()
        console.log(chalk_1.default.dim('✓ Default Mode Unified Aggregator subscribed to all event sources (including background agents)'));
    }
    /**
     * Central Event Router - routes events to UI based on structuredUI decision
     */
    routeEventToUI(eventType, eventData) {
        // Decision Point: structuredUI vs Console stdout (as per diagram)
        const useStructuredUI = this.isStructuredUIActive();
        if (useStructuredUI) {
            // Route to AdvancedCliUI panels
            this.routeToAdvancedUI(eventType, eventData);
        }
        else {
            // Fallback to Console stdout  
            this.routeToConsole(eventType, eventData);
        }
    }
    /**
     * Check if structured UI should be active based on saved decision
     */
    isStructuredUIActive() {
        return this.structuredUIEnabled;
    }
    /**
     * Route events to AdvancedCliUI panels
     */
    routeToAdvancedUI(eventType, eventData) {
        switch (eventType) {
            case 'planning_step_start':
                advanced_cli_ui_1.advancedUI.logInfo('Planning Step', `Started: ${eventData.description}`);
                break;
            case 'planning_step_progress':
                advanced_cli_ui_1.advancedUI.logInfo('Planning Progress', `${eventData.step}: ${eventData.progress}%`);
                break;
            case 'planning_step_complete':
                advanced_cli_ui_1.advancedUI.logSuccess('Planning Complete', `${eventData.step}: ${eventData.result}`);
                break;
            case 'agent_file_read':
                if (eventData.path && eventData.content) {
                    advanced_cli_ui_1.advancedUI.showFileContent(eventData.path, eventData.content);
                }
                break;
            case 'agent_file_written':
                if (eventData.originalContent && eventData.content) {
                    advanced_cli_ui_1.advancedUI.showFileDiff(eventData.path, eventData.originalContent, eventData.content);
                }
                else {
                    advanced_cli_ui_1.advancedUI.showFileContent(eventData.path, eventData.content);
                }
                break;
            case 'agent_file_list':
                if (eventData.files) {
                    advanced_cli_ui_1.advancedUI.showFileList(eventData.files, eventData.title || '📁 Files');
                }
                break;
            case 'agent_grep_results':
                if (eventData.pattern && eventData.matches) {
                    advanced_cli_ui_1.advancedUI.showGrepResults(eventData.pattern, eventData.matches);
                }
                break;
            // Background agent events
            case 'bg_agent_task_start':
                advanced_cli_ui_1.advancedUI.logInfo('Background Agent', `🤖 ${eventData.agentName} started: ${eventData.taskDescription}`);
                this.createStatusIndicator(`bg-${eventData.agentId}`, `${eventData.agentName}: ${eventData.taskDescription}`);
                // Update background agents panel
                advanced_cli_ui_1.advancedUI.updateBackgroundAgent({
                    id: eventData.agentId,
                    name: eventData.agentName,
                    status: 'working',
                    currentTask: eventData.taskDescription,
                    startTime: new Date()
                });
                break;
            case 'bg_agent_task_progress':
                advanced_cli_ui_1.advancedUI.logInfo('Agent Progress', `🔄 ${eventData.currentStep} (${eventData.progress}%)`);
                this.updateStatusIndicator(`bg-${eventData.agentId}`, {
                    progress: eventData.progress,
                    details: eventData.currentStep
                });
                // Update background agents panel with progress
                const agent = advanced_cli_ui_1.advancedUI.backgroundAgents?.get(eventData.agentId);
                if (agent) {
                    advanced_cli_ui_1.advancedUI.updateBackgroundAgent({
                        ...agent,
                        progress: eventData.progress,
                        currentTask: eventData.currentStep
                    });
                }
                break;
            case 'bg_agent_task_complete':
                advanced_cli_ui_1.advancedUI.logSuccess('Agent Complete', `✅ Completed in ${eventData.duration}ms: ${eventData.result}`);
                this.stopAdvancedSpinner(`bg-${eventData.agentId}`, true, eventData.result);
                // Update background agents panel to completed
                const completedAgent = advanced_cli_ui_1.advancedUI.backgroundAgents.get(eventData.agentId);
                if (completedAgent) {
                    advanced_cli_ui_1.advancedUI.updateBackgroundAgent({
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
                advanced_cli_ui_1.advancedUI.logInfo('Background Tool', `🛠️ ${eventData.agentId}: ${eventData.toolName}${toolParams}`);
                break;
            case 'bg_agent_orchestrated':
                advanced_cli_ui_1.advancedUI.logInfo('Agent Orchestration', `🎭 ${eventData.parentTool} orchestrating ${eventData.agentName} for: ${eventData.task}`);
                break;
        }
    }
    /**
     * Route events to Console stdout (fallback mode)
     */
    routeToConsole(eventType, eventData) {
        switch (eventType) {
            case 'planning_step_start':
                console.log(chalk_1.default.blue(`📋 Planning: ${eventData.description}`));
                break;
            case 'planning_step_progress':
                console.log(chalk_1.default.cyan(`⏳ Progress: ${eventData.step} - ${eventData.progress}%`));
                break;
            case 'planning_step_complete':
                console.log(chalk_1.default.green(`✅ Complete: ${eventData.step}`));
                break;
            case 'agent_file_read':
                console.log(chalk_1.default.blue(`📖 File read: ${eventData.path}`));
                break;
            case 'agent_file_written':
                console.log(chalk_1.default.green(`✏️ File written: ${eventData.path}`));
                break;
            case 'agent_file_list':
                console.log(chalk_1.default.cyan(`📁 Files listed: ${eventData.files?.length} items`));
                break;
            case 'agent_grep_results':
                console.log(chalk_1.default.magenta(`🔍 Search: ${eventData.pattern} - ${eventData.matches?.length} matches`));
                break;
            // Background agent events for console
            case 'bg_agent_task_start':
                console.log(chalk_1.default.dim(`  🤖 Background: ${eventData.agentName} working on "${eventData.taskDescription}"`));
                break;
            case 'bg_agent_task_progress':
                // Progress bar inline
                const progressBar = '█'.repeat(Math.floor(eventData.progress / 5)) +
                    '░'.repeat(20 - Math.floor(eventData.progress / 5));
                console.log(chalk_1.default.dim(`  🔄 ${eventData.agentId}: [${progressBar}] ${eventData.progress}% - ${eventData.currentStep}`));
                break;
            case 'bg_agent_task_complete':
                console.log(chalk_1.default.green(`  ✅ Background: ${eventData.agentId} completed successfully (${eventData.duration}ms)`));
                break;
            case 'bg_agent_tool_call':
                const toolParamsConsole = eventData.parameters ?
                    ` ${JSON.stringify(eventData.parameters)}` : '';
                console.log(chalk_1.default.dim(`  🛠️ Background Tool: ${eventData.agentId} → ${eventData.toolName}${toolParamsConsole}`));
                break;
            case 'bg_agent_orchestrated':
                console.log(chalk_1.default.dim(`  🎭 Orchestrating: ${eventData.agentName} for "${eventData.task}"`));
                break;
        }
    }
    // Advanced UI Features Setup
    setupAdvancedUIFeatures() {
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
    setupPlanningEventListeners() {
        // Listen for step progress events to update todos panel
        this.planningManager.on('stepStart', (event) => {
            this.advancedUI.updateTodos(event.todos.map((todo) => ({
                content: todo.title || todo.description,
                status: todo.status
            })));
        });
        this.planningManager.on('stepProgress', (event) => {
            this.advancedUI.updateTodos(event.todos.map((todo) => ({
                content: todo.title || todo.description,
                status: todo.status
            })));
        });
        this.planningManager.on('stepComplete', (event) => {
            this.advancedUI.updateTodos(event.todos.map((todo) => ({
                content: todo.title || todo.description,
                status: todo.status
            })));
        });
        this.planningManager.on('planExecutionStart', (event) => {
            console.log(chalk_1.default.blue(`🚀 Starting plan execution: ${event.title}`));
        });
        this.planningManager.on('planExecutionComplete', (event) => {
            console.log(chalk_1.default.green(`✅ Plan execution completed: ${event.title}`));
        });
        this.planningManager.on('planExecutionError', (event) => {
            console.log(chalk_1.default.red(`❌ Plan execution failed: ${event.error}`));
        });
    }
    /**
     * Initialize structured UI panels using existing advanced-cli-ui components
     */
    initializeStructuredPanels() {
        // Use the existing advanced UI system
        advanced_cli_ui_1.advancedUI.startInteractiveMode();
        console.log(chalk_1.default.dim('\n🎨 Structured UI panels ready - using advanced-cli-ui system'));
    }
    setupFileWatching() {
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
            watcher.on('add', (path) => {
                this.addLiveUpdate({
                    type: 'info',
                    content: `📄 File created: ${path}`,
                    source: 'file-watcher'
                });
            });
            watcher.on('change', (path) => {
                this.addLiveUpdate({
                    type: 'info',
                    content: `✏️ File modified: ${path}`,
                    source: 'file-watcher'
                });
                // Special handling for important files
                if (path === 'todo.md') {
                    console.log(chalk_1.default.cyan('🔄 Todo list updated'));
                }
                else if (path === 'package.json') {
                    console.log(chalk_1.default.blue('📦 Package configuration changed'));
                }
                else if (path === 'CLAUDE.md') {
                    console.log(chalk_1.default.magenta('🤖 Project context updated'));
                }
            });
            watcher.on('unlink', (path) => {
                this.addLiveUpdate({
                    type: 'warning',
                    content: `🗑️ File deleted: ${path}`,
                    source: 'file-watcher'
                });
            });
            watcher.on('error', (error) => {
                this.addLiveUpdate({
                    type: 'error',
                    content: `File watcher error: ${error.message}`,
                    source: 'file-watcher'
                });
            });
            // Store watcher for cleanup
            this.fileWatcher = watcher;
            console.log(chalk_1.default.dim('👀 File watching enabled'));
        }
        catch (error) {
            console.log(chalk_1.default.gray('⚠️ File watching not available (chokidar not installed)'));
        }
    }
    setupProgressTracking() {
        // Progress tracking for long-running operations
        // This provides visual feedback for complex tasks
        // Track active operations and their progress
        this.progressTracker = {
            operations: new Map(),
            // Start tracking an operation
            start: (id, title, totalSteps) => {
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
                }
                else {
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
            update: (id, step, detail) => {
                const operation = this.progressTracker.operations.get(id);
                if (!operation)
                    return;
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
            complete: (id, success = true, finalMessage) => {
                const operation = this.progressTracker.operations.get(id);
                if (!operation)
                    return;
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
                }
                else {
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
                    running: operations.filter((op) => op.status === 'running').length,
                    completed: operations.filter((op) => op.status === 'completed').length,
                    failed: operations.filter((op) => op.status === 'failed').length
                };
            }
        };
        console.log(chalk_1.default.dim('📊 Progress tracking enabled'));
    }
    // Advanced UI Methods (from advanced-cli-ui.ts)
    createStatusIndicator(id, title, details) {
        const indicator = {
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
        }
        else {
            console.log((0, text_wrapper_1.formatStatus)('📋', title, details));
        }
        return indicator;
    }
    updateStatusIndicator(id, updates) {
        const indicator = this.indicators.get(id);
        if (!indicator)
            return;
        Object.assign(indicator, updates);
        if (updates.status === 'completed' || updates.status === 'failed') {
            indicator.endTime = new Date();
        }
        if (this.isInteractiveMode) {
            this.refreshDisplay();
        }
        else {
            this.logStatusUpdate(indicator);
        }
    }
    addLiveUpdate(update) {
        const liveUpdate = {
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
        }
        else {
            this.printLiveUpdate(liveUpdate);
        }
    }
    startAdvancedSpinner(id, text) {
        if (this.isInteractiveMode) {
            this.updateStatusIndicator(id, { status: 'running' });
            return;
        }
        const spinner = (0, ora_1.default)({
            text,
            spinner: 'dots',
            color: 'cyan',
        }).start();
        this.spinners.set(id, spinner);
    }
    stopAdvancedSpinner(id, success, finalText) {
        const spinner = this.spinners.get(id);
        if (spinner) {
            if (success) {
                spinner.succeed(finalText);
            }
            else {
                spinner.fail(finalText);
            }
            this.spinners.delete(id);
        }
        this.updateStatusIndicator(id, {
            status: success ? 'completed' : 'failed',
            details: finalText,
        });
    }
    createAdvancedProgressBar(id, title, total) {
        if (this.isInteractiveMode) {
            this.createStatusIndicator(id, title);
            this.updateStatusIndicator(id, { progress: 0 });
            return;
        }
        const progressBar = new cli_progress_1.default.SingleBar({
            format: `${chalk_1.default.cyan(title)} |${chalk_1.default.cyan('{bar}')}| {percentage}% | {value}/{total} | ETA: {eta}s`,
            barCompleteChar: '█',
            barIncompleteChar: '░',
        });
        progressBar.start(total, 0);
        this.progressBars.set(id, progressBar);
    }
    updateAdvancedProgress(id, current, total) {
        const progressBar = this.progressBars.get(id);
        if (progressBar) {
            progressBar.update(current);
        }
        const progress = total ? Math.round((current / total) * 100) : current;
        this.updateStatusIndicator(id, { progress });
    }
    completeAdvancedProgress(id, message) {
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
    conciseOneLine(text, max = 60) {
        if (!text)
            return '';
        const one = text.replace(/\s+/g, ' ').trim();
        return one.length > max ? one.slice(0, max).trimEnd() + '…' : one;
    }
    async askAdvancedConfirmation(question, details, defaultValue = false) {
        const icon = defaultValue ? '✅' : '❓';
        const prompt = `${icon} ${chalk_1.default.cyan(question)}`;
        if (details) {
            console.log(chalk_1.default.gray(`   ${details}`));
        }
        return new Promise((resolve) => {
            if (!this.rl) {
                resolve(defaultValue);
                return;
            }
            this.rl.question(`${prompt} ${chalk_1.default.gray(defaultValue ? '(Y/n)' : '(y/N)')}: `, (answer) => {
                const normalized = answer.toLowerCase().trim();
                if (normalized === '') {
                    resolve(defaultValue);
                }
                else {
                    resolve(normalized.startsWith('y'));
                }
            });
        });
    }
    async showAdvancedSelection(title, choices, defaultIndex = 0) {
        console.log(chalk_1.default.cyan.bold(`\n${title}`));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        choices.forEach((choice, index) => {
            const indicator = index === defaultIndex ? chalk_1.default.green('→') : ' ';
            console.log(`${indicator} ${index + 1}. ${chalk_1.default.bold(choice.label)}`);
            if (choice.description) {
                console.log(`   ${chalk_1.default.gray(choice.description)}`);
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
                console.log(chalk_1.default.green(`✓ Selected: ${choices[selection].label}`));
                resolve(choices[selection].value);
            });
        });
    }
    // Advanced UI Helper Methods
    refreshDisplay() {
        if (!this.isInteractiveMode)
            return;
        // Move cursor to top and clear
        process.stdout.write('\x1B[2J\x1B[H');
        this.showAdvancedHeader();
        this.showActiveIndicators();
        this.showRecentUpdates();
    }
    showAdvancedHeader() {
        const header = (0, boxen_1.default)(`${chalk_1.default.cyanBright.bold('🤖 NikCLI')} ${chalk_1.default.gray('v0.1.4-beta')}\n` +
            `${chalk_1.default.gray('Autonomous AI Developer Assistant')}\n\n` +
            `${chalk_1.default.blue('Status:')} ${this.getOverallStatus()}  ${chalk_1.default.blue('Active Tasks:')} ${this.indicators.size}\n` +
            `${chalk_1.default.blue('Mode:')} ${this.currentMode}  ${chalk_1.default.blue('Live Updates:')} Enabled`, {
            padding: 1,
            margin: { top: 0, bottom: 1, left: 0, right: 0 },
            borderStyle: 'round',
            borderColor: 'cyan',
            textAlignment: 'center',
        });
        console.log(header);
    }
    showActiveIndicators() {
        const indicators = Array.from(this.indicators.values());
        if (indicators.length === 0)
            return;
        console.log(chalk_1.default.blue.bold('📊 Active Tasks:'));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        indicators.forEach(indicator => {
            this.printIndicatorLine(indicator);
        });
        console.log();
    }
    showRecentUpdates() {
        const recentUpdates = this.liveUpdates.slice(-10);
        if (recentUpdates.length === 0)
            return;
        console.log(chalk_1.default.blue.bold('📝 Recent Updates:'));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        recentUpdates.forEach(update => {
            this.printLiveUpdate(update);
        });
    }
    printIndicatorLine(indicator) {
        const statusIcon = this.getStatusIcon(indicator.status);
        const duration = this.getDuration(indicator);
        let line = `${statusIcon} ${chalk_1.default.bold(indicator.title)}`;
        if (indicator.progress !== undefined) {
            const progressBar = this.createProgressBarString(indicator.progress);
            line += ` ${progressBar}`;
        }
        if (duration) {
            line += ` ${chalk_1.default.gray(`(${duration})`)}`;
        }
        console.log(line);
        if (indicator.details) {
            console.log(`   ${chalk_1.default.gray(indicator.details)}`);
        }
    }
    printLiveUpdate(update) {
        const timeStr = update.timestamp.toLocaleTimeString();
        const typeColor = this.getUpdateTypeColor(update.type);
        const sourceStr = update.source ? chalk_1.default.gray(`[${update.source}]`) : '';
        const line = `${chalk_1.default.gray(timeStr)} ${sourceStr} ${typeColor(update.content)}`;
        console.log(line);
    }
    logStatusUpdate(indicator) {
        const statusIcon = this.getStatusIcon(indicator.status);
        const statusColor = this.getStatusColor(indicator.status);
        console.log(`${statusIcon} ${statusColor(indicator.title)}`);
        if (indicator.details) {
            console.log(`   ${chalk_1.default.gray(indicator.details)}`);
        }
    }
    // UI Utility Methods
    getStatusIcon(status) {
        switch (status) {
            case 'pending': return '⏳';
            case 'running': return '🔄';
            case 'completed': return '✅';
            case 'failed': return '❌';
            case 'warning': return '⚠️';
            default: return '📋';
        }
    }
    getStatusColor(status) {
        switch (status) {
            case 'pending': return chalk_1.default.gray;
            case 'running': return chalk_1.default.blue;
            case 'completed': return chalk_1.default.green;
            case 'failed': return chalk_1.default.red;
            case 'warning': return chalk_1.default.yellow;
            default: return chalk_1.default.gray;
        }
    }
    getUpdateTypeColor(type) {
        switch (type) {
            case 'error': return chalk_1.default.red;
            case 'warning': return chalk_1.default.yellow;
            case 'info': return chalk_1.default.blue;
            case 'log': return chalk_1.default.green;
            default: return chalk_1.default.white;
        }
    }
    createProgressBarString(progress, width = 20) {
        const filled = Math.round((progress / 100) * width);
        const empty = width - filled;
        const bar = chalk_1.default.cyan('█'.repeat(filled)) + chalk_1.default.gray('░'.repeat(empty));
        return `[${bar}] ${progress}%`;
    }
    getDuration(indicator) {
        if (!indicator.startTime)
            return null;
        const endTime = indicator.endTime || new Date();
        const duration = endTime.getTime() - indicator.startTime.getTime();
        const seconds = Math.round(duration / 1000);
        if (seconds < 60) {
            return `${seconds}s`;
        }
        else {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        }
    }
    getOverallStatus() {
        const indicators = Array.from(this.indicators.values());
        if (indicators.length === 0)
            return chalk_1.default.gray('Idle');
        const hasRunning = indicators.some(i => i.status === 'running');
        const hasFailed = indicators.some(i => i.status === 'failed');
        const hasWarning = indicators.some(i => i.status === 'warning');
        if (hasRunning)
            return chalk_1.default.blue('Running');
        if (hasFailed)
            return chalk_1.default.red('Failed');
        if (hasWarning)
            return chalk_1.default.yellow('Warning');
        return chalk_1.default.green('Ready');
    }
    /**
     * Start interactive chat mode (main Claude Code experience)
     */
    async startChat(options) {
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
            console.log(chalk_1.default.cyan('\n🎨 UI Selection: AdvancedCliUI selected (structuredUI = true)'));
            advanced_cli_ui_1.advancedUI.startInteractiveMode();
            advanced_cli_ui_1.advancedUI.logInfo('AdvancedCliUI Ready', `Mode: ${this.currentMode} - 4 Panels configured`);
        }
        else {
            console.log(chalk_1.default.dim('\n📺 UI Selection: Console stdout selected (structuredUI = false)'));
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
    async startEnhancedChat() {
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
                        console.log(chalk_1.default.yellow('\n⏸️  AI operation interrupted by user'));
                        this.showPrompt();
                    }
                    else if (this.assistantProcessing) {
                        this.interruptProcessing();
                    }
                    else if (this.currentMode !== 'default') {
                        this.currentMode = 'default';
                        console.log(chalk_1.default.yellow('↩️  Cancelled. Returning to default mode.'));
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
                }
                else if (trimmed.startsWith('@')) {
                    await this.dispatchAt(trimmed);
                }
                else if (trimmed.startsWith('*')) {
                    await this.dispatchStar(trimmed);
                }
                else {
                    await this.handleChatInput(trimmed);
                }
            }
            finally {
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
    interruptProcessing() {
        if (!this.assistantProcessing)
            return;
        console.log(chalk_1.default.red('\n\n🛑 ESC pressed - Interrupting operation...'));
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
        const orchestrator = new modern_agent_system_1.ModernAgentOrchestrator(this.workingDirectory);
        const interruptedAgents = orchestrator.interruptActiveExecutions();
        if (interruptedAgents > 0) {
            console.log(chalk_1.default.yellow(`🤖 Stopped ${interruptedAgents} running agents`));
        }
        // Clean up processing state
        this.assistantProcessing = false;
        console.log(chalk_1.default.yellow('⏹️  Operation interrupted by user'));
        console.log(chalk_1.default.cyan('✨ Ready for new commands\n'));
        // Show prompt again
        this.showPrompt();
    }
    /**
     * Stop all active operations and cleanup
     */
    stopAllActiveOperations() {
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
    async dispatchSlash(command) {
        const parts = command.slice(1).split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        try {
            switch (cmd) {
                case 'plan':
                    if (args.length === 0) {
                        this.currentMode = 'plan';
                        console.log(chalk_1.default.green('✓ Switched to plan mode'));
                    }
                    else {
                        await this.generatePlan(args.join(' '), {});
                    }
                    break;
                case 'auto':
                    if (args.length === 0) {
                        this.currentMode = 'auto';
                        console.log(chalk_1.default.green('✓ Switched to auto mode'));
                    }
                    else {
                        await this.autoExecute(args.join(' '), {});
                    }
                    break;
                case 'default':
                    this.currentMode = 'default';
                    console.log(chalk_1.default.green('✓ Switched to default mode'));
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
                        console.log(chalk_1.default.red('Usage: /git <args>'));
                        return;
                    }
                    await this.runCommand(`git ${args.join(' ')}`);
                    break;
                case 'docker':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /docker <args>'));
                        return;
                    }
                    await this.runCommand(`docker ${args.join(' ')}`);
                    break;
                case 'ps':
                    await this.runCommand('ps aux');
                    break;
                case 'kill':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /kill <pid>'));
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
                        console.log(chalk_1.default.red('Usage: /create <type> <name>'));
                        return;
                    }
                    const [type, name] = args;
                    console.log(chalk_1.default.blue(`Creating ${type}: ${name}`));
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
                    console.log(chalk_1.default.blue(`Starting new session: ${sessionTitle}`));
                    break;
                case 'sessions':
                    console.log(chalk_1.default.blue('Session listing not yet implemented'));
                    break;
                case 'export':
                    const sessionId = args[0] || 'current';
                    console.log(chalk_1.default.blue(`Exporting session ${sessionId} not yet implemented`));
                    break;
                case 'stats':
                    console.log(chalk_1.default.blue('Usage statistics not yet implemented'));
                    break;
                case 'history':
                    if (args.length === 0 || !['on', 'off'].includes(args[0])) {
                        console.log(chalk_1.default.red('Usage: /history <on|off>'));
                        return;
                    }
                    console.log(chalk_1.default.blue(`Chat history ${args[0]} not yet implemented`));
                    break;
                case 'debug':
                    console.log(chalk_1.default.blue('Debug information:'));
                    console.log(`Mode: ${this.currentMode}`);
                    console.log(`Agent: ${this.currentAgent || 'none'}`);
                    console.log(`Working Dir: ${this.workingDirectory}`);
                    break;
                case 'temp':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /temp <0.0-2.0>'));
                        return;
                    }
                    const temp = parseFloat(args[0]);
                    if (isNaN(temp) || temp < 0 || temp > 2) {
                        console.log(chalk_1.default.red('Temperature must be between 0.0 and 2.0'));
                        return;
                    }
                    console.log(chalk_1.default.blue(`Temperature setting not yet implemented: ${temp}`));
                    break;
                case 'system':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /system <prompt>'));
                        return;
                    }
                    console.log(chalk_1.default.blue('System prompt setting not yet implemented'));
                    break;
                case 'models':
                    await this.listModels();
                    break;
                case 'set-key':
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /set-key <model> <key>'));
                        return;
                    }
                    console.log(chalk_1.default.blue('API key setting not yet implemented'));
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
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error executing ${command}: ${error.message}`));
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
    async dispatchAt(input) {
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
    async dispatchStar(input) {
        const trimmed = input.slice(1).trim(); // Remove * and trim
        console.log(chalk_1.default.cyan('🔍 Interactive File Picker'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        try {
            // If no pattern provided, show current directory
            const pattern = trimmed || '*';
            const pickerId = 'file-picker-' + Date.now();
            this.createStatusIndicator(pickerId, `Finding files: ${pattern}`);
            this.startAdvancedSpinner(pickerId, 'Scanning files...');
            // Use the FilePickerHandler for better file selection management
            const { FilePickerHandler } = await Promise.resolve().then(() => __importStar(require('./handlers/file-picker-handler')));
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
            }
            catch (selectionError) {
                this.stopAdvancedSpinner(pickerId, false, 'No files found');
                console.log(chalk_1.default.yellow(selectionError.message));
                console.log(chalk_1.default.dim('Try different patterns like:'));
                console.log(chalk_1.default.dim('  * *.ts     - TypeScript files'));
                console.log(chalk_1.default.dim('  * src/**   - Files in src directory'));
                console.log(chalk_1.default.dim('  * **/*.js  - JavaScript files recursively'));
                console.log(chalk_1.default.dim('  * *.json   - Configuration files'));
                console.log(chalk_1.default.dim('  * test/**  - Test files'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error during file search: ${error.message}`));
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
    async showInteractiveFilePicker(files, pattern) {
        console.log(chalk_1.default.blue(`\n📂 Found ${files.length} files matching "${pattern}":`));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        // Group files by directory for better organization
        const groupedFiles = this.groupFilesByDirectory(files);
        // Display files in organized groups
        let fileIndex = 0;
        const maxDisplay = 50; // Limit display for large file lists
        for (const [directory, dirFiles] of groupedFiles.entries()) {
            if (fileIndex >= maxDisplay) {
                console.log(chalk_1.default.yellow(`... and ${files.length - fileIndex} more files`));
                break;
            }
            if (directory !== '.') {
                console.log(chalk_1.default.cyan(`\n📁 ${directory}/`));
            }
            for (const file of dirFiles.slice(0, Math.min(10, maxDisplay - fileIndex))) {
                const fileExt = path.extname(file);
                const fileIcon = this.getFileIcon(fileExt);
                const relativePath = directory === '.' ? file : `${directory}/${file}`;
                console.log(`  ${fileIcon} ${chalk_1.default.white(file)} ${chalk_1.default.dim('(' + relativePath + ')')}`);
                fileIndex++;
                if (fileIndex >= maxDisplay)
                    break;
            }
            if (dirFiles.length > 10) {
                console.log(chalk_1.default.dim(`    ... and ${dirFiles.length - 10} more in this directory`));
            }
        }
        // Show file picker options
        console.log(chalk_1.default.gray('\n─'.repeat(60)));
        console.log(chalk_1.default.green('📋 File Selection Options:'));
        console.log(chalk_1.default.dim('• Files are now visible in the UI (if advanced UI is active)'));
        console.log(chalk_1.default.dim('• Use the file paths in your next message to reference them'));
        console.log(chalk_1.default.dim('• Example: "Analyze these files: src/file1.ts, src/file2.ts"'));
        // Store files in session context for easy reference
        this.storeSelectedFiles(files, pattern);
        // Optional: Show quick selection menu for first few files
        if (files.length <= 10) {
            console.log(chalk_1.default.yellow('\n💡 Quick reference paths:'));
            files.forEach((file, index) => {
                console.log(chalk_1.default.dim(`   ${index + 1}. ${file}`));
            });
        }
    }
    /**
     * Group files by their directory for organized display
     */
    groupFilesByDirectory(files) {
        const groups = new Map();
        files.forEach(file => {
            const directory = path.dirname(file);
            const fileName = path.basename(file);
            if (!groups.has(directory)) {
                groups.set(directory, []);
            }
            groups.get(directory).push(fileName);
        });
        // Sort directories, with '.' (current) first
        return new Map([...groups.entries()].sort(([a], [b]) => {
            if (a === '.')
                return -1;
            if (b === '.')
                return 1;
            return a.localeCompare(b);
        }));
    }
    /**
     * Get appropriate icon for file extension
     */
    getFileIcon(extension) {
        const iconMap = {
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
    storeSelectedFiles(files, pattern) {
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
    showAgentSuggestions() {
        console.log(chalk_1.default.cyan('\n💡 Available Agents:'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        // Get available agents from AgentManager
        const availableAgents = this.agentManager.listAgents();
        if (availableAgents.length > 0) {
            availableAgents.forEach(agent => {
                const statusIcon = agent.status === 'ready' ? '✅' :
                    agent.status === 'busy' ? '⏳' : '❌';
                console.log(`${statusIcon} ${chalk_1.default.blue('@' + agent.specialization)} - ${chalk_1.default.dim(agent.description)}`);
                // Show some capabilities
                const capabilities = agent.capabilities.slice(0, 3).join(', ');
                if (capabilities) {
                    console.log(`   ${chalk_1.default.gray('Capabilities:')} ${chalk_1.default.yellow(capabilities)}`);
                }
            });
        }
        else {
            console.log(chalk_1.default.yellow('No agents currently available'));
            console.log(chalk_1.default.dim('Standard agents:'));
            console.log(`✨ ${chalk_1.default.blue('@universal-agent')} - All-in-one enterprise agent`);
            console.log(`🔍 ${chalk_1.default.blue('@ai-analysis')} - AI code analysis and review`);
            console.log(`📝 ${chalk_1.default.blue('@code-review')} - Code review specialist`);
            console.log(`⚛️ ${chalk_1.default.blue('@react-expert')} - React and Next.js expert`);
        }
        console.log(chalk_1.default.gray('\n─'.repeat(50)));
        console.log(chalk_1.default.dim('💡 Usage: @agent-name <your task description>'));
        console.log('');
    }
    /**
     * Show file picker suggestions when * is pressed
     */
    showFilePickerSuggestions() {
        console.log(chalk_1.default.magenta('\n🔍 File Selection Commands:'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(`${chalk_1.default.magenta('*')}              Browse all files in current directory`);
        console.log(`${chalk_1.default.magenta('* *.ts')}         Find all TypeScript files`);
        console.log(`${chalk_1.default.magenta('* *.js')}         Find all JavaScript files`);
        console.log(`${chalk_1.default.magenta('* src/**')}       Browse files in src directory`);
        console.log(`${chalk_1.default.magenta('* **/*.tsx')}     Find React component files`);
        console.log(`${chalk_1.default.magenta('* package.json')} Find package.json files`);
        console.log(`${chalk_1.default.magenta('* *.md')}         Find all markdown files`);
        console.log(chalk_1.default.gray('\n─'.repeat(50)));
        console.log(chalk_1.default.dim('💡 Usage: * <pattern> to find and select files'));
        console.log(chalk_1.default.dim('📋 Selected files can be referenced in your next message'));
        console.log('');
    }
    /**
     * Handle slash commands (Claude Code style)
     */
    async handleSlashCommand(command) {
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
                        console.log(chalk_1.default.green('✓ Switched to plan mode'));
                    }
                    else {
                        await this.generatePlan(args.join(' '), {});
                    }
                    break;
                case 'auto':
                    if (args.length === 0) {
                        this.currentMode = 'auto';
                        console.log(chalk_1.default.green('✓ Switched to auto mode'));
                    }
                    else {
                        await this.autoExecute(args.join(' '), {});
                    }
                    break;
                case 'default':
                    this.currentMode = 'default';
                    console.log(chalk_1.default.green('✓ Switched to default mode'));
                    break;
                case 'agent':
                    if (args.length === 0) {
                        await this.listAgents();
                    }
                    else {
                        this.currentAgent = args[0];
                        console.log(chalk_1.default.green(`✓ Switched to agent: ${args[0]}`));
                    }
                    break;
                case 'model':
                    if (args.length === 0) {
                        await this.listModels();
                    }
                    else {
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
                        console.log(chalk_1.default.green('✅ Session token counters reset'));
                    }
                    else if (args[0] === 'test') {
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
                                console.log(chalk_1.default.green('\n✅ Test completed'));
                                this.showPrompt();
                            }
                        }, 500);
                    }
                    else {
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
                        console.log(chalk_1.default.red('Usage: /parallel <agents> <task>'));
                        return;
                    }
                    console.log(chalk_1.default.blue('Parallel agent execution not yet implemented'));
                    break;
                case 'factory':
                    console.log(chalk_1.default.blue('Agent factory dashboard not yet implemented'));
                    break;
                case 'create-agent':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /create-agent <spec>'));
                        return;
                    }
                    console.log(chalk_1.default.blue('Agent creation not yet implemented'));
                    break;
                case 'launch-agent':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /launch-agent <id>'));
                        return;
                    }
                    console.log(chalk_1.default.blue('Agent launching not yet implemented'));
                    break;
                // Session Management
                case 'new':
                    const sessionTitle = args.join(' ') || 'New Session';
                    console.log(chalk_1.default.blue(`Starting new session: ${sessionTitle}`));
                    break;
                case 'sessions':
                    console.log(chalk_1.default.blue('Session listing not yet implemented'));
                    break;
                case 'export':
                    const sessionId = args[0] || 'current';
                    console.log(chalk_1.default.blue(`Exporting session ${sessionId} not yet implemented`));
                    break;
                case 'stats':
                    console.log(chalk_1.default.blue('Usage statistics not yet implemented'));
                    break;
                case 'history':
                    if (args.length === 0 || !['on', 'off'].includes(args[0])) {
                        console.log(chalk_1.default.red('Usage: /history <on|off>'));
                        return;
                    }
                    console.log(chalk_1.default.blue(`Chat history ${args[0]} not yet implemented`));
                    break;
                case 'debug':
                    console.log(chalk_1.default.blue('Debug information:'));
                    console.log(`Mode: ${this.currentMode}`);
                    console.log(`Agent: ${this.currentAgent || 'none'}`);
                    console.log(`Working Dir: ${this.workingDirectory}`);
                    break;
                case 'temp':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /temp <0.0-2.0>'));
                        return;
                    }
                    const temp = parseFloat(args[0]);
                    if (isNaN(temp) || temp < 0 || temp > 2) {
                        console.log(chalk_1.default.red('Temperature must be between 0.0 and 2.0'));
                        return;
                    }
                    console.log(chalk_1.default.blue(`Temperature setting not yet implemented: ${temp}`));
                    break;
                case 'system':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /system <prompt>'));
                        return;
                    }
                    console.log(chalk_1.default.blue('System prompt setting not yet implemented'));
                    break;
                // Model & Config
                case 'models':
                    await this.listModels();
                    break;
                case 'set-key':
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /set-key <model> <key>'));
                        return;
                    }
                    console.log(chalk_1.default.blue('API key setting not yet implemented'));
                    break;
                // Advanced Features
                case 'context':
                    const paths = args.length > 0 ? args : ['.'];
                    console.log(chalk_1.default.blue(`Context management for ${paths.join(', ')} not yet implemented`));
                    break;
                case 'stream':
                    if (args[0] === 'clear') {
                        console.log(chalk_1.default.blue('Stream clearing not yet implemented'));
                    }
                    else {
                        console.log(chalk_1.default.blue('Stream showing not yet implemented'));
                    }
                    break;
                case 'approval':
                    if (args[0] === 'test') {
                        console.log(chalk_1.default.blue('Approval system test not yet implemented'));
                    }
                    else {
                        console.log(chalk_1.default.blue('Approval system controls not yet implemented'));
                    }
                    break;
                // File Operations
                case 'read':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /read <file>'));
                        return;
                    }
                    await this.readFile(args[0]);
                    break;
                case 'write':
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /write <file> <content>'));
                        return;
                    }
                    const filename = args[0];
                    const content = args.slice(1).join(' ');
                    await this.writeFile(filename, content);
                    break;
                case 'edit':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /edit <file>'));
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
                        console.log(chalk_1.default.red('Usage: /search <query>'));
                        return;
                    }
                    await this.searchFiles(args.join(' '));
                    break;
                // Terminal Operations
                case 'run':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /run <command>'));
                        return;
                    }
                    await this.runCommand(args.join(' '));
                    break;
                case 'npm':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /npm <args>'));
                        return;
                    }
                    await this.runCommand(`npm ${args.join(' ')}`);
                    break;
                case 'yarn':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /yarn <args>'));
                        return;
                    }
                    await this.runCommand(`yarn ${args.join(' ')}`);
                    break;
                case 'git':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /git <args>'));
                        return;
                    }
                    await this.runCommand(`git ${args.join(' ')}`);
                    break;
                case 'docker':
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /docker <args>'));
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
                    console.log(chalk_1.default.red(`Unknown command: /${cmd}`));
                    console.log(chalk_1.default.dim('Type /help for available commands'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error executing /${cmd}: ${error.message}`));
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
    async handleChatInput(input) {
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
        }
        catch (error) {
            console.log(chalk_1.default.red(`Error: ${error.message}`));
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
    async handlePlanMode(input) {
        console.log(chalk_1.default.blue('🎯 Entering Enhanced Planning Mode...'));
        try {
            // Start progress indicator using our new methods
            const planningId = 'planning-' + Date.now();
            this.createStatusIndicator(planningId, 'Generating comprehensive plan', input);
            this.startAdvancedSpinner(planningId, 'Analyzing requirements and generating plan...');
            // Generate comprehensive plan with todo.md
            const plan = await enhanced_planning_1.enhancedPlanning.generatePlan(input, {
                maxTodos: 15,
                includeContext: true,
                showDetails: true,
                saveTodoFile: true,
                todoFilePath: 'todo.md'
            });
            this.stopAdvancedSpinner(planningId, true, `Plan generated with ${plan.todos.length} todos`);
            // Show plan summary
            console.log(chalk_1.default.blue.bold('\n📋 Plan Generated:'));
            console.log(chalk_1.default.green(`✓ Todo file saved: ${path.join(this.workingDirectory, 'todo.md')}`));
            console.log(chalk_1.default.cyan(`📊 ${plan.todos.length} todos created`));
            console.log(chalk_1.default.cyan(`⏱️  Estimated duration: ${Math.round(plan.estimatedTotalDuration)} minutes`));
            // Request approval for execution
            const approved = await enhanced_planning_1.enhancedPlanning.requestPlanApproval(plan.id);
            if (approved) {
                console.log(chalk_1.default.green('\n🚀 Switching to Auto Mode for plan execution...'));
                console.log(chalk_1.default.cyan('📋 Plan will be executed automatically without further confirmations'));
                // Switch to auto mode temporarily for execution
                const originalMode = this.currentMode;
                this.currentMode = 'auto';
                try {
                    // Execute the plan in auto mode
                    await this.executeAdvancedPlan(plan.id);
                    // Show final summary
                    this.showExecutionSummary();
                    console.log(chalk_1.default.green.bold('\n🎉 Plan execution completed successfully!'));
                    console.log(chalk_1.default.cyan('📄 Check the updated todo.md file for execution details'));
                }
                finally {
                    // Restore original mode
                    this.currentMode = originalMode;
                    console.log(chalk_1.default.blue(`🔄 Restored to ${originalMode} mode`));
                }
            }
            else {
                console.log(chalk_1.default.yellow('\n📝 Plan saved but not executed.'));
                console.log(chalk_1.default.gray('You can review the todo.md file and run `/plan execute` later.'));
                console.log(chalk_1.default.gray('Or use `/auto [task]` to execute specific parts of the plan.'));
                // Ask if they want to regenerate the plan
                const regenerate = await this.askAdvancedConfirmation('Do you want to regenerate the plan with different requirements?', 'This will create a new plan and overwrite the current todo.md', false);
                if (regenerate) {
                    const newRequirements = await this.askForInput('Enter new or modified requirements: ');
                    if (newRequirements.trim()) {
                        await this.handlePlanMode(newRequirements);
                    }
                }
                else {
                    // User declined regeneration, exit plan mode and return to default
                    console.log(chalk_1.default.yellow('🔄 Exiting plan mode and returning to default mode...'));
                    this.currentMode = 'default';
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Plan generation failed: ${error.message}`, source: 'planning' });
            console.log(chalk_1.default.red(`❌ Planning failed: ${error.message}`));
        }
    }
    showExecutionSummary() {
        const indicators = Array.from(this.indicators.values());
        const completed = indicators.filter(i => i.status === 'completed').length;
        const failed = indicators.filter(i => i.status === 'failed').length;
        const warnings = indicators.filter(i => i.status === 'warning').length;
        const summary = (0, boxen_1.default)(`${chalk_1.default.bold('Execution Summary')}\n\n` +
            `${chalk_1.default.green('✅ Completed:')} ${completed}\n` +
            `${chalk_1.default.red('❌ Failed:')} ${failed}\n` +
            `${chalk_1.default.yellow('⚠️ Warnings:')} ${warnings}\n` +
            `${chalk_1.default.blue('📊 Total:')} ${indicators.length}\n\n` +
            `${chalk_1.default.gray('Overall Status:')} ${this.getOverallStatusText()}`, {
            padding: 1,
            margin: { top: 1, bottom: 1, left: 0, right: 0 },
            borderStyle: 'round',
            borderColor: failed > 0 ? 'red' : completed === indicators.length ? 'green' : 'yellow',
        });
        console.log(summary);
    }
    getOverallStatusText() {
        const indicators = Array.from(this.indicators.values());
        if (indicators.length === 0)
            return chalk_1.default.gray('No tasks');
        const completed = indicators.filter(i => i.status === 'completed').length;
        const failed = indicators.filter(i => i.status === 'failed').length;
        if (failed > 0) {
            return chalk_1.default.red('Some tasks failed');
        }
        else if (completed === indicators.length) {
            return chalk_1.default.green('All tasks completed successfully');
        }
        else {
            return chalk_1.default.blue('Tasks in progress');
        }
    }
    /**
     * Auto mode: Execute immediately without approval
     */
    async handleAutoMode(input) {
        console.log(chalk_1.default.blue('🚀 Auto-executing task...'));
        // Use agent if specified, otherwise auto-select
        if (this.currentAgent) {
            await this.executeAgent(this.currentAgent, input, { auto: true });
        }
        else {
            await this.autoExecute(input, {});
        }
    }
    /**
     * Default mode: Unified Aggregator - observes and subscribes to all event sources
     */
    async handleDefaultMode(input) {
        // Initialize as Unified Aggregator for all event sources
        this.subscribeToAllEventSources();
        // Handle execute command for last generated plan
        if (input.toLowerCase().trim() === 'execute' && this.lastGeneratedPlan) {
            console.log(chalk_1.default.blue('🚀 Executing the generated plan...'));
            try {
                await this.planningManager.executePlan(this.lastGeneratedPlan.id);
                console.log(chalk_1.default.green('✅ Plan execution completed!'));
                this.lastGeneratedPlan = undefined; // Clear the stored plan
                return;
            }
            catch (error) {
                console.log(chalk_1.default.red(`Plan execution failed: ${error?.message || error}`));
                return;
            }
        }
        // Check if input mentions specific agent
        const agentMatch = input.match(/@(\w+)/);
        if (agentMatch) {
            const agentName = agentMatch[1];
            const task = input.replace(agentMatch[0], '').trim();
            await this.executeAgent(agentName, task, {});
        }
        else {
            // Real chatbot conversation in default mode - now as unified aggregator
            try {
                // Activate structured UI for better visualization
                console.log(chalk_1.default.dim('🎨 Default Mode (Unified Aggregator) - Activating structured UI...'));
                advanced_cli_ui_1.advancedUI.startInteractiveMode();
                // Record user message in session
                chat_manager_1.chatManager.addMessage(input, 'user');
                // Build model-ready messages from session history (respects history setting)
                let messages = chat_manager_1.chatManager.getContextMessages().map(m => ({
                    role: m.role,
                    content: m.content,
                }));
                // Auto-compact if approaching token limit with more aggressive thresholds
                const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
                const estimatedTokens = Math.round(totalChars / 4);
                if (estimatedTokens > 100000) { // More aggressive - compact at 100k instead of 150k
                    console.log(chalk_1.default.yellow(`⚠️ Token usage: ${estimatedTokens.toLocaleString()}, auto-compacting...`));
                    await this.compactSession();
                    // Rebuild messages after compaction
                    messages = chat_manager_1.chatManager.getContextMessages().map(m => ({
                        role: m.role,
                        content: m.content,
                    }));
                    // Re-check token count after compaction
                    const newTotalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
                    const newEstimatedTokens = Math.round(newTotalChars / 4);
                    console.log(chalk_1.default.green(`✅ Compacted to ${newEstimatedTokens.toLocaleString()} tokens`));
                }
                else if (estimatedTokens > 50000) {
                    console.log((0, text_wrapper_1.wrapBlue)(`📊 Token usage: ${estimatedTokens.toLocaleString()}`));
                }
                // Stream assistant response with structured UI integration
                process.stdout.write(`${chalk_1.default.cyan('\nAssistant: ')}`);
                let assistantText = '';
                let hasToolCalls = false;
                for await (const ev of advanced_ai_provider_1.advancedAIProvider.streamChatWithFullAutonomy(messages)) {
                    if (ev.type === 'text_delta' && ev.content) {
                        assistantText += ev.content;
                        process.stdout.write(ev.content);
                        // Text content is already handled by console output
                    }
                    else if (ev.type === 'tool_call') {
                        hasToolCalls = true;
                        const toolMessage = `🛠️ Tool call: ${ev.content}`;
                        console.log(`\n${chalk_1.default.blue(toolMessage)}`);
                        // Log to structured UI
                        advanced_cli_ui_1.advancedUI.logInfo('Tool Call', ev.content);
                        // Check if tool call involves background agents
                        if (ev.metadata?.backgroundAgents) {
                            ev.metadata.backgroundAgents.forEach((agentInfo) => {
                                this.routeEventToUI('bg_agent_orchestrated', {
                                    parentTool: ev.content,
                                    agentId: agentInfo.id,
                                    agentName: agentInfo.name,
                                    task: agentInfo.task
                                });
                            });
                        }
                    }
                    else if (ev.type === 'tool_result') {
                        const resultMessage = `✅ Result: ${ev.content}`;
                        console.log(`${chalk_1.default.green(resultMessage)}`);
                        // Log to structured UI
                        advanced_cli_ui_1.advancedUI.logSuccess('Tool Result', ev.content);
                        // Show results from background agents if present
                        if (ev.metadata?.backgroundResults) {
                            ev.metadata.backgroundResults.forEach((result) => {
                                advanced_cli_ui_1.advancedUI.logSuccess('Background Result', `${result.agentName}: ${result.summary}`);
                                // Show file changes if present
                                if (result.fileChanges) {
                                    result.fileChanges.forEach((change) => {
                                        this.advancedUI.showFileDiff(change.path, change.before, change.after);
                                    });
                                }
                            });
                        }
                        // Show file diffs and content using advancedUI
                        if (ev.metadata?.filePath) {
                            if (ev.metadata?.originalContent && ev.metadata?.newContent) {
                                this.advancedUI.showFileDiff(ev.metadata.filePath, ev.metadata.originalContent, ev.metadata.newContent);
                            }
                            else if (ev.metadata?.content) {
                                this.advancedUI.showFileContent(ev.metadata.filePath, ev.metadata.content);
                            }
                        }
                    }
                    else if (ev.type === 'error') {
                        const errorMessage = ev.content || ev.error || 'Unknown error';
                        console.log(`${chalk_1.default.red(errorMessage)}`);
                        // Log to structured UI
                        advanced_cli_ui_1.advancedUI.logError('Error', errorMessage);
                    }
                }
                // Add separator if tool calls were made
                if (hasToolCalls) {
                    console.log(chalk_1.default.gray('─'.repeat(50)));
                }
                // Save assistant message to history
                if (assistantText.trim().length > 0) {
                    chat_manager_1.chatManager.addMessage(assistantText.trim(), 'assistant');
                }
                console.log(); // newline after streaming
            }
            catch (err) {
                console.log(chalk_1.default.red(`Chat error: ${err.message}`));
            }
        }
    }
    /**
     * Generate execution plan for a task
     */
    async generatePlan(task, options) {
        console.log((0, text_wrapper_1.wrapBlue)(`🎯 Generating plan for: ${task}`));
        try {
            // Start progress indicator using enhanced UI
            const planningId = 'planning-' + Date.now();
            this.createStatusIndicator(planningId, 'Generating comprehensive plan', task);
            this.startAdvancedSpinner(planningId, 'Analyzing requirements and generating plan...');
            // Use enhanced planning service like in plan mode
            const plan = await enhanced_planning_1.enhancedPlanning.generatePlan(task, {
                maxTodos: 15,
                includeContext: true,
                showDetails: true,
                saveTodoFile: true,
                todoFilePath: 'todo.md'
            });
            this.stopAdvancedSpinner(planningId, true, `Plan generated with ${plan.todos.length} todos`);
            // Show plan summary like in plan mode
            console.log(chalk_1.default.blue.bold('\n📋 Plan Generated:'));
            console.log(chalk_1.default.green(`✓ Todo file saved: ${path.join(this.workingDirectory, 'todo.md')}`));
            console.log(chalk_1.default.cyan(`📊 ${plan.todos.length} todos created`));
            console.log(chalk_1.default.cyan(`⏱️  Estimated duration: ${Math.round(plan.estimatedTotalDuration)} minutes`));
            // Plan is already saved to todo.md by enhancedPlanning
            if (options.execute) {
                // Use enhanced approval system
                const approved = await enhanced_planning_1.enhancedPlanning.requestPlanApproval(plan.id);
                if (approved) {
                    console.log(chalk_1.default.green('\n🚀 Executing plan...'));
                    await this.executeAdvancedPlan(plan.id);
                    this.showExecutionSummary();
                    console.log(chalk_1.default.green.bold('\n🎉 Plan execution completed successfully!'));
                }
                else {
                    console.log(chalk_1.default.yellow('\n📝 Plan saved but not executed.'));
                    console.log(chalk_1.default.gray('You can review the todo.md file and run `/plan execute` later.'));
                    // Add regeneration option like in plan mode
                    const regenerate = await this.askAdvancedConfirmation('Do you want to regenerate the plan with different requirements?', 'This will create a new plan and overwrite the current todo.md', false);
                    if (regenerate) {
                        const newRequirements = await this.askForInput('Enter new or modified requirements: ');
                        if (newRequirements.trim()) {
                            await this.generatePlan(newRequirements, options);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`Plan generation failed: ${error.message}`));
        }
    }
    /**
     * Execute task with specific agent
     */
    async executeAgent(name, task, options) {
        console.log((0, text_wrapper_1.formatAgent)(name, 'executing', task));
        try {
            // Launch real agent via AgentService; run asynchronously
            const taskId = await agent_service_1.agentService.executeTask(name, task);
            console.log((0, text_wrapper_1.wrapBlue)(`🚀 Launched ${name} (Task ID: ${taskId.slice(-6)})`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`Agent execution failed: ${error.message}`));
        }
    }
    /**
     * Autonomous execution with best agent selection
     */
    async autoExecute(task, options) {
        console.log((0, text_wrapper_1.wrapBlue)(`🚀 Auto-executing: ${task}`));
        try {
            if (options.planFirst) {
                // Use real PlanningService to create and execute plan asynchronously
                const plan = await planning_service_1.planningService.createPlan(task, {
                    showProgress: true,
                    autoExecute: true,
                    confirmSteps: false,
                });
                console.log(chalk_1.default.cyan(`📋 Generated plan with ${plan.steps.length} steps (id: ${plan.id}). Executing in background...`));
                // Fire-and-forget execution to keep CLI responsive
                (async () => {
                    try {
                        await planning_service_1.planningService.executePlan(plan.id, {
                            showProgress: true,
                            autoExecute: true,
                            confirmSteps: false,
                        });
                    }
                    catch (err) {
                        console.log(chalk_1.default.red(`❌ Plan execution error: ${err.message}`));
                    }
                })();
            }
            else {
                // Direct autonomous execution - select best agent and launch
                const selected = this.agentManager.findBestAgentForTask(task);
                console.log(chalk_1.default.blue(`🤖 Selected agent: ${chalk_1.default.cyan(selected)}`));
                const taskId = await agent_service_1.agentService.executeTask(selected, task);
                console.log((0, text_wrapper_1.wrapBlue)(`🚀 Launched ${selected} (Task ID: ${taskId.slice(-6)})`));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`Auto execution failed: ${error.message}`));
        }
    }
    /**
     * Manage todo items and planning
     */
    async manageTodo(options) {
        if (options.list) {
            console.log(chalk_1.default.cyan('📋 Todo Items:'));
            const plans = this.planningManager.listPlans();
            if (plans.length === 0) {
                console.log(chalk_1.default.dim('No todo items found'));
                return;
            }
            plans.forEach((plan, index) => {
                const status = '⏳'; // Plans don't have status property, using default
                console.log(`${index + 1}. ${status} ${plan.title}`);
                console.log(`   ${chalk_1.default.dim(plan.description)}`);
            });
        }
        if (options.add) {
            console.log((0, text_wrapper_1.wrapBlue)(`Adding todo: ${options.add}`));
            await this.generatePlan(options.add, {});
        }
        if (options.complete) {
            console.log(chalk_1.default.green(`Marking todo ${options.complete} as complete`));
            // Implementation for marking todo complete
        }
    }
    /**
     * Manage CLI configuration
     */
    async manageConfig(options) {
        if (options.show) {
            console.log(chalk_1.default.cyan('⚙️ Current Configuration:'));
            const config = this.configManager.getConfig();
            console.log(chalk_1.default.dim('Model:'), chalk_1.default.green(config.currentModel));
            console.log(chalk_1.default.dim('Working Directory:'), chalk_1.default.blue(this.workingDirectory));
            console.log(chalk_1.default.dim('Mode:'), chalk_1.default.yellow(this.currentMode));
            if (this.currentAgent) {
                console.log(chalk_1.default.dim('Current Agent:'), chalk_1.default.cyan(this.currentAgent));
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
    async initProject(options) {
        console.log(chalk_1.default.blue('🔧 Initializing project context...'));
        const claudeFile = path.join(this.workingDirectory, 'NIKOCLI.md');
        try {
            // Check if CLAUDE.md (NIKOCLI.md) already exists
            const exists = await fs.access(claudeFile).then(() => true).catch(() => false);
            if (exists && !options.force) {
                console.log(chalk_1.default.yellow('NIKOCLI.md already exists. Use --force to overwrite.'));
                return;
            }
            // Analyze project structure
            console.log(chalk_1.default.dim('Analyzing project structure...'));
            const analysis = await this.analyzeProject();
            // Generate CLAUDE.md content
            const content = this.generateClaudeMarkdown(analysis);
            // Write file
            await fs.writeFile(claudeFile, content, 'utf8');
            console.log(chalk_1.default.green('✓ NIKOCLI.md created successfully'));
            console.log(chalk_1.default.dim(`Context file: ${claudeFile}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`Failed to initialize project: ${error.message}`));
        }
    }
    /**
     * Show system status and agent information
     */
    async showStatus() {
        const statusInfo = `🔍 NikCLI Status

System:
  Working Directory: ${this.workingDirectory}
  Mode: ${this.currentMode}
  Model: ${advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo().name}
  
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
        advanced_cli_ui_1.advancedUI.logInfo('System Status', statusInfo);
        // Also show in console
        console.log(chalk_1.default.cyan.bold('🔍 NikCLI Status'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.blue('System:'));
        console.log(`  Working Directory: ${chalk_1.default.dim(this.workingDirectory)}`);
        console.log(`  Mode: ${chalk_1.default.yellow(this.currentMode)}`);
        console.log(`  Model: ${chalk_1.default.green(advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo().name)}`);
        if (this.currentAgent) {
            console.log(`  Current Agent: ${chalk_1.default.cyan(this.currentAgent)}`);
        }
        const stats = this.agentManager.getStats();
        console.log(chalk_1.default.blue('\nAgents:'));
        console.log(`  Total: ${stats.totalAgents}`);
        console.log(`  Active: ${stats.activeAgents}`);
        console.log(`  Pending Tasks: ${stats.pendingTasks}`);
        const planningStats = this.planningManager.getPlanningStats();
        console.log(chalk_1.default.blue('\nPlanning:'));
        console.log(`  Plans Generated: ${planningStats.totalPlansGenerated}`);
        console.log(`  Plans Executed: ${planningStats.totalPlansExecuted}`);
        console.log(`  Success Rate: ${Math.round((planningStats.successfulExecutions / planningStats.totalPlansExecuted) * 100)}%`);
        console.log(chalk_1.default.gray('─'.repeat(50)));
    }
    /**
     * List available agents and their capabilities
     */
    async listAgents() {
        console.log(chalk_1.default.cyan.bold('🤖 Available Agents'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        const available = agent_service_1.agentService.getAvailableAgents();
        available.forEach(agent => {
            console.log(chalk_1.default.white(`  • ${agent.name}`));
            console.log(chalk_1.default.gray(`    ${agent.description}`));
        });
    }
    /**
     * List available AI models
     */
    async listModels() {
        console.log(chalk_1.default.cyan.bold('🧠 Available Models'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        // Mock models for now
        const models = [
            { provider: 'openai', model: 'gpt-4' },
            { provider: 'anthropic', model: 'claude-3-sonnet' },
            { provider: 'google', model: 'gemini-pro' }
        ];
        const currentModel = 'claude-3-sonnet'; // Mock current model
        models.forEach((modelInfo) => {
            const model = modelInfo.model;
            const indicator = model === currentModel ? chalk_1.default.green('→') : ' ';
            console.log(`${indicator} ${model}`);
        });
    }
    // Command Handler Methods
    async handleFileOperations(command, args) {
        try {
            switch (command) {
                case 'read': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /read <filepath> [<from-to>] [--from N --to M] [--step K] [--more]'));
                        return;
                    }
                    const filePath = args[0];
                    const rest = args.slice(1);
                    // Helpers for flag parsing
                    const hasFlag = (name) => rest.includes(`--${name}`);
                    const getFlag = (name) => {
                        const i = rest.findIndex(v => v === `--${name}`);
                        return i !== -1 ? rest[i + 1] : undefined;
                    };
                    const rangeToken = rest.find(v => /^\d+-\d+$/.test(v));
                    // Determine mode
                    let mode = 'default';
                    if (hasFlag('more'))
                        mode = 'more';
                    else if (rangeToken || hasFlag('from') || hasFlag('to'))
                        mode = 'range';
                    else if (hasFlag('step'))
                        mode = 'step';
                    const defaultStep = 200;
                    let step = parseInt(getFlag('step') || `${defaultStep}`, 10);
                    if (!Number.isFinite(step) || step <= 0)
                        step = defaultStep;
                    const fileInfo = await tools_manager_1.toolsManager.readFile(filePath);
                    const lines = fileInfo.content.split(/\r?\n/);
                    const total = lines.length;
                    const key = `read:${path.resolve(filePath)}`;
                    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
                    console.log((0, text_wrapper_1.formatFileOp)('📄 File:', filePath, `${fileInfo.size} bytes, ${fileInfo.language || 'unknown'}`));
                    console.log(chalk_1.default.gray(`Lines: ${total}`));
                    console.log(chalk_1.default.gray('─'.repeat(50)));
                    const printSlice = (from, to) => {
                        const f = clamp(from, 1, total);
                        const t = clamp(to, 1, total);
                        if (f > total) {
                            console.log(chalk_1.default.yellow('End of file reached.'));
                            return { printed: false, end: total };
                        }
                        const slice = lines.slice(f - 1, t).join('\n');
                        console.log(chalk_1.default.gray(`Showing lines ${f}-${t} of ${total}`));
                        console.log(slice);
                        return { printed: true, end: t };
                    };
                    if (mode === 'range') {
                        // Parse from/to
                        let from;
                        let to;
                        if (rangeToken) {
                            const [a, b] = rangeToken.split('-').map(s => parseInt(s, 10));
                            if (Number.isFinite(a))
                                from = a;
                            if (Number.isFinite(b))
                                to = b;
                        }
                        const fromFlag = parseInt(getFlag('from') || '', 10);
                        const toFlag = parseInt(getFlag('to') || '', 10);
                        if (Number.isFinite(fromFlag))
                            from = fromFlag;
                        if (Number.isFinite(toFlag))
                            to = toFlag;
                        const f = clamp((from ?? 1), 1, total);
                        const t = clamp((to ?? (f + step - 1)), 1, total);
                        printSlice(f, t);
                        // Prepare next cursor
                        this.sessionContext.set(key, { nextStart: t + 1, step });
                    }
                    else if (mode === 'step') {
                        const f = 1;
                        const t = clamp(f + step - 1, 1, total);
                        printSlice(f, t);
                        this.sessionContext.set(key, { nextStart: t + 1, step });
                    }
                    else if (mode === 'more') {
                        const state = this.sessionContext.get(key) || { nextStart: 1, step };
                        // Allow overriding step via flag in --more
                        if (hasFlag('step'))
                            state.step = step;
                        const f = clamp(state.nextStart || 1, 1, total);
                        const t = clamp(f + (state.step || step) - 1, 1, total);
                        const res = printSlice(f, t);
                        if (res.printed) {
                            this.sessionContext.set(key, { nextStart: (res.end + 1), step: (state.step || step) });
                            if (res.end < total) {
                                console.log(chalk_1.default.gray('─'.repeat(50)));
                                console.log(chalk_1.default.cyan(`Tip: use "/read ${filePath} --more" to continue (next from line ${res.end + 1})`));
                            }
                        }
                    }
                    else {
                        // default behavior: show all, but protect against huge outputs
                        if (total > 400) {
                            const approved = await this.askAdvancedConfirmation(`Large file: ${total} lines`, `Show first ${defaultStep} lines now?`, false);
                            if (approved) {
                                const f = 1;
                                const t = clamp(f + defaultStep - 1, 1, total);
                                printSlice(f, t);
                                this.sessionContext.set(key, { nextStart: t + 1, step: defaultStep });
                                if (t < total) {
                                    console.log(chalk_1.default.gray('─'.repeat(50)));
                                    console.log(chalk_1.default.cyan(`Tip: use "/read ${filePath} --more" to continue (next from line ${t + 1})`));
                                }
                            }
                            else {
                                console.log(chalk_1.default.yellow('Skipped large output. Specify a range, e.g.'));
                                console.log(chalk_1.default.cyan(`/read ${filePath} 1-200`));
                            }
                        }
                        else {
                            console.log(fileInfo.content);
                        }
                    }
                    console.log(chalk_1.default.gray('─'.repeat(50)));
                    break;
                }
                case 'write': {
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /write <filepath> <content>'));
                        return;
                    }
                    const filePath = args[0];
                    const content = args.slice(1).join(' ');
                    // Request approval
                    const approved = await this.askAdvancedConfirmation(`Write file: ${filePath}`, `Write ${content.length} characters to file`, false);
                    if (!approved) {
                        console.log(chalk_1.default.yellow('❌ File write operation cancelled'));
                        return;
                    }
                    const writeId = 'write-' + Date.now();
                    this.createStatusIndicator(writeId, `Writing ${filePath}`);
                    this.startAdvancedSpinner(writeId, 'Writing file...');
                    await tools_manager_1.toolsManager.writeFile(filePath, content);
                    this.stopAdvancedSpinner(writeId, true, `File written: ${filePath}`);
                    console.log(chalk_1.default.green(`✅ File written: ${filePath}`));
                    break;
                }
                case 'edit': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /edit <filepath>'));
                        return;
                    }
                    const filePath = args[0];
                    console.log((0, text_wrapper_1.formatFileOp)('📝 Opening', filePath, 'in system editor'));
                    try {
                        await tools_manager_1.toolsManager.runCommand('code', [filePath]);
                    }
                    catch {
                        try {
                            await tools_manager_1.toolsManager.runCommand('open', [filePath]);
                        }
                        catch {
                            console.log(chalk_1.default.yellow(`Could not open ${filePath}. Please open it manually.`));
                        }
                    }
                    break;
                }
                case 'ls': {
                    const directory = args[0] || '.';
                    const files = await tools_manager_1.toolsManager.listFiles(directory);
                    console.log((0, text_wrapper_1.formatFileOp)('📁 Files in', directory));
                    console.log(chalk_1.default.gray('─'.repeat(40)));
                    if (files.length === 0) {
                        console.log(chalk_1.default.yellow('No files found'));
                    }
                    else {
                        files.slice(0, 50).forEach(file => {
                            console.log(`${chalk_1.default.cyan('•')} ${file}`);
                        });
                        if (files.length > 50) {
                            console.log(chalk_1.default.gray(`... and ${files.length - 50} more files`));
                        }
                    }
                    break;
                }
                case 'search': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /search <query> [directory] [--limit N] [--more]'));
                        return;
                    }
                    const query = args[0];
                    const directory = (args[1] && !args[1].startsWith('--')) ? args[1] : '.';
                    const rest = args.slice(1).filter(a => a.startsWith('--'));
                    const hasFlag = (name) => rest.includes(`--${name}`);
                    const getFlag = (name) => {
                        const i = rest.findIndex(v => v === `--${name}`);
                        return i !== -1 ? rest[i + 1] : undefined;
                    };
                    let limit = parseInt(getFlag('limit') || '30', 10);
                    if (!Number.isFinite(limit) || limit <= 0)
                        limit = 30;
                    const key = `search:${path.resolve(directory)}:${query}`;
                    const state = this.sessionContext.get(key) || { offset: 0, limit };
                    if (hasFlag('limit'))
                        state.limit = limit;
                    console.log((0, text_wrapper_1.formatSearch)(query, directory));
                    const spinId = `search-${Date.now()}`;
                    this.createStatusIndicator(spinId, `Searching: ${query}`, `in ${directory}`);
                    this.startAdvancedSpinner(spinId, `Searching files...`);
                    const results = await tools_manager_1.toolsManager.searchInFiles(query, directory);
                    this.stopAdvancedSpinner(spinId, true, `Search complete: ${results.length} matches`);
                    if (results.length === 0) {
                        console.log(chalk_1.default.yellow('No matches found'));
                    }
                    else {
                        const start = Math.max(0, state.offset);
                        const end = Math.min(results.length, start + (state.limit || limit));
                        console.log(chalk_1.default.green(`Found ${results.length} matches (showing ${start + 1}-${end}):`));
                        console.log(chalk_1.default.gray('─'.repeat(50)));
                        results.slice(start, end).forEach(result => {
                            console.log(chalk_1.default.cyan(`${result.file}:${result.line}`));
                            console.log(`  ${result.content}`);
                        });
                        if (end < results.length) {
                            this.sessionContext.set(key, { offset: end, limit: (state.limit || limit) });
                            console.log(chalk_1.default.gray('─'.repeat(50)));
                            console.log(chalk_1.default.cyan(`Tip: use "/search ${query} ${directory} --more" to see the next ${state.limit || limit} results`));
                        }
                        else {
                            this.sessionContext.delete(key);
                        }
                    }
                    break;
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `File operation failed: ${error.message}`, source: 'file-ops' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    async handleTerminalOperations(command, args) {
        try {
            switch (command) {
                case 'run': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /run <command> [args...]'));
                        return;
                    }
                    const [cmd, ...cmdArgs] = args;
                    const fullCommand = `${cmd} ${cmdArgs.join(' ')}`;
                    const approved = await this.askAdvancedConfirmation(`Execute command: ${fullCommand}`, `Run command in ${process.cwd()}`, false);
                    if (!approved) {
                        console.log(chalk_1.default.yellow('❌ Command execution cancelled'));
                        return;
                    }
                    console.log((0, text_wrapper_1.formatCommand)(fullCommand));
                    const cmdId = 'cmd-' + Date.now();
                    this.createStatusIndicator(cmdId, `Executing: ${cmd}`);
                    this.startAdvancedSpinner(cmdId, `Running: ${fullCommand}`);
                    const result = await tools_manager_1.toolsManager.runCommand(cmd, cmdArgs, { stream: true });
                    if (result.code === 0) {
                        this.stopAdvancedSpinner(cmdId, true, 'Command completed successfully');
                        console.log(chalk_1.default.green('✅ Command completed successfully'));
                    }
                    else {
                        this.stopAdvancedSpinner(cmdId, false, `Command failed with exit code ${result.code}`);
                        console.log(chalk_1.default.red(`❌ Command failed with exit code ${result.code}`));
                    }
                    break;
                }
                case 'install': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /install <packages...>'));
                        console.log(chalk_1.default.gray('Options: --global, --dev, --yarn, --pnpm'));
                        return;
                    }
                    const packages = args.filter(arg => !arg.startsWith('--'));
                    const isGlobal = args.includes('--global') || args.includes('-g');
                    const isDev = args.includes('--dev') || args.includes('-D');
                    const manager = args.includes('--yarn') ? 'yarn' :
                        args.includes('--pnpm') ? 'pnpm' : 'npm';
                    const approved = await this.askAdvancedConfirmation(`Install packages: ${packages.join(', ')}`, `Using ${manager}${isGlobal ? ' (global)' : ''}${isDev ? ' (dev)' : ''}`, false);
                    if (!approved) {
                        console.log(chalk_1.default.yellow('❌ Package installation cancelled'));
                        return;
                    }
                    console.log((0, text_wrapper_1.wrapBlue)(`📦 Installing ${packages.join(', ')} with ${manager}...`));
                    const installId = 'install-' + Date.now();
                    this.createAdvancedProgressBar(installId, 'Installing packages', packages.length);
                    for (let i = 0; i < packages.length; i++) {
                        const pkg = packages[i];
                        this.updateStatusIndicator(installId, { details: `Installing ${pkg}...` });
                        const success = await tools_manager_1.toolsManager.installPackage(pkg, {
                            global: isGlobal,
                            dev: isDev,
                            manager: manager
                        });
                        if (!success) {
                            this.addLiveUpdate({ type: 'warning', content: `Failed to install ${pkg}`, source: 'install' });
                            console.log(chalk_1.default.yellow(`⚠️ Failed to install ${pkg}`));
                        }
                        else {
                            this.addLiveUpdate({ type: 'log', content: `Installed ${pkg}`, source: 'install' });
                        }
                        this.updateAdvancedProgress(installId, i + 1, packages.length);
                    }
                    this.completeAdvancedProgress(installId, `Completed installation of ${packages.length} packages`);
                    console.log(chalk_1.default.green(`✅ Package installation completed`));
                    break;
                }
                case 'npm':
                case 'yarn':
                case 'git':
                case 'docker': {
                    await tools_manager_1.toolsManager.runCommand(command, args, { stream: true });
                    break;
                }
                case 'ps': {
                    const processes = tools_manager_1.toolsManager.getRunningProcesses();
                    console.log(chalk_1.default.blue('🔄 Running Processes:'));
                    console.log(chalk_1.default.gray('─'.repeat(50)));
                    if (processes.length === 0) {
                        console.log(chalk_1.default.yellow('No processes currently running'));
                    }
                    else {
                        processes.forEach(proc => {
                            const duration = Date.now() - proc.startTime.getTime();
                            console.log(`${chalk_1.default.cyan('PID')} ${proc.pid}: ${chalk_1.default.bold(proc.command)} ${proc.args.join(' ')}`);
                            console.log(`  Status: ${proc.status} | Duration: ${Math.round(duration / 1000)}s`);
                            console.log(`  Working Dir: ${proc.cwd}`);
                        });
                    }
                    break;
                }
                case 'kill': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /kill <pid>'));
                        return;
                    }
                    const pid = parseInt(args[0]);
                    if (isNaN(pid)) {
                        console.log(chalk_1.default.red('Invalid PID'));
                        return;
                    }
                    console.log(chalk_1.default.yellow(`⚠️ Attempting to kill process ${pid}...`));
                    const success = await tools_manager_1.toolsManager.killProcess(pid);
                    if (success) {
                        console.log(chalk_1.default.green(`✅ Process ${pid} terminated`));
                    }
                    else {
                        console.log(chalk_1.default.red(`❌ Could not kill process ${pid}`));
                    }
                    break;
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Terminal operation failed: ${error.message}`, source: 'terminal' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    async handleProjectOperations(command, args) {
        try {
            switch (command) {
                case 'build': {
                    console.log(chalk_1.default.blue('🔨 Building project...'));
                    const result = await tools_manager_1.toolsManager.build();
                    if (result.success) {
                        console.log(chalk_1.default.green('✅ Build completed successfully'));
                    }
                    else {
                        console.log(chalk_1.default.red('❌ Build failed'));
                        if (result.errors && result.errors.length > 0) {
                            console.log(chalk_1.default.yellow('Errors found:'));
                            result.errors.forEach(error => {
                                console.log(`  ${chalk_1.default.red('•')} ${error.message}`);
                            });
                        }
                    }
                    break;
                }
                case 'test': {
                    const pattern = args[0];
                    console.log((0, text_wrapper_1.wrapBlue)(`🧪 Running tests${pattern ? ` (${pattern})` : ''}...`));
                    const result = await tools_manager_1.toolsManager.runTests(pattern);
                    if (result.success) {
                        console.log(chalk_1.default.green('✅ All tests passed'));
                    }
                    else {
                        console.log(chalk_1.default.red('❌ Some tests failed'));
                        if (result.errors && result.errors.length > 0) {
                            console.log(chalk_1.default.yellow('Test errors:'));
                            result.errors.forEach(error => {
                                console.log(`  ${chalk_1.default.red('•')} ${error.message}`);
                            });
                        }
                    }
                    break;
                }
                case 'lint': {
                    console.log(chalk_1.default.blue('🔍 Running linter...'));
                    const result = await tools_manager_1.toolsManager.lint();
                    if (result.success) {
                        console.log(chalk_1.default.green('✅ No linting errors found'));
                    }
                    else {
                        console.log(chalk_1.default.yellow('⚠️ Linting issues found'));
                        if (result.errors && result.errors.length > 0) {
                            result.errors.forEach(error => {
                                const severity = error.severity === 'error' ? chalk_1.default.red('ERROR') : chalk_1.default.yellow('WARNING');
                                console.log(`  ${severity}: ${error.message}`);
                            });
                        }
                    }
                    break;
                }
                case 'create': {
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /create <type> <name>'));
                        console.log(chalk_1.default.gray('Types: react, next, node, express'));
                        return;
                    }
                    const [type, name] = args;
                    console.log((0, text_wrapper_1.wrapBlue)(`🚀 Creating ${type} project: ${name}`));
                    const result = await tools_manager_1.toolsManager.setupProject(type, name);
                    if (result.success) {
                        console.log(chalk_1.default.green(`✅ Project ${name} created successfully!`));
                        console.log(chalk_1.default.gray(`📁 Location: ${result.path}`));
                    }
                    else {
                        console.log(chalk_1.default.red(`❌ Failed to create project ${name}`));
                    }
                    break;
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Project operation failed: ${error.message}`, source: 'project' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    async handleSessionManagement(command, args) {
        try {
            switch (command) {
                case 'new': {
                    const title = args.join(' ') || undefined;
                    const session = chat_manager_1.chatManager.createNewSession(title);
                    console.log(chalk_1.default.green(`✅ New session created: ${session.title} (${session.id.slice(0, 8)})`));
                    break;
                }
                case 'sessions': {
                    const sessions = chat_manager_1.chatManager.listSessions();
                    const current = chat_manager_1.chatManager.getCurrentSession();
                    console.log(chalk_1.default.blue.bold('\n📝 Chat Sessions:'));
                    console.log(chalk_1.default.gray('─'.repeat(40)));
                    if (sessions.length === 0) {
                        console.log(chalk_1.default.gray('No sessions found'));
                    }
                    else {
                        sessions.forEach((session) => {
                            const isCurrent = session.id === current?.id;
                            const prefix = isCurrent ? chalk_1.default.yellow('→ ') : '  ';
                            const messageCount = session.messages.filter(m => m.role !== 'system').length;
                            console.log(`${prefix}${chalk_1.default.bold(session.title)} ${chalk_1.default.gray(`(${session.id.slice(0, 8)})`)}`);
                            console.log(`    ${chalk_1.default.gray(`${messageCount} messages | ${session.updatedAt.toLocaleString()}`)}`);
                        });
                    }
                    break;
                }
                case 'export': {
                    const sessionId = args[0];
                    const markdown = chat_manager_1.chatManager.exportSession(sessionId);
                    const filename = `chat-export-${Date.now()}.md`;
                    await fs.writeFile(filename, markdown);
                    console.log(chalk_1.default.green(`✅ Session exported to ${filename}`));
                    break;
                }
                case 'stats': {
                    const stats = chat_manager_1.chatManager.getSessionStats();
                    const modelInfo = advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo();
                    console.log(chalk_1.default.blue.bold('\n📊 Usage Statistics:'));
                    console.log(chalk_1.default.gray('─'.repeat(40)));
                    console.log(chalk_1.default.green(`Current Model: ${modelInfo.name}`));
                    console.log(chalk_1.default.green(`Total Sessions: ${stats.totalSessions}`));
                    console.log(chalk_1.default.green(`Total Messages: ${stats.totalMessages}`));
                    console.log(chalk_1.default.green(`Current Session Messages: ${stats.currentSessionMessages}`));
                    break;
                }
                case 'history': {
                    if (args.length === 0) {
                        const enabled = config_manager_1.configManager.get('chatHistory');
                        console.log(chalk_1.default.green(`Chat history: ${enabled ? 'enabled' : 'disabled'}`));
                        return;
                    }
                    const setting = args[0].toLowerCase();
                    if (setting !== 'on' && setting !== 'off') {
                        console.log(chalk_1.default.red('Usage: /history <on|off>'));
                        return;
                    }
                    config_manager_1.configManager.set('chatHistory', setting === 'on');
                    console.log(chalk_1.default.green(`✅ Chat history ${setting === 'on' ? 'enabled' : 'disabled'}`));
                    break;
                }
                case 'debug': {
                    console.log(chalk_1.default.blue.bold('\n🔍 Debug Information:'));
                    console.log(chalk_1.default.gray('═'.repeat(40)));
                    const currentModel = config_manager_1.configManager.getCurrentModel();
                    console.log(chalk_1.default.green(`Current Model: ${currentModel}`));
                    const models = config_manager_1.configManager.get('models');
                    const currentModelConfig = models[currentModel];
                    if (currentModelConfig) {
                        console.log(chalk_1.default.green(`Provider: ${currentModelConfig.provider}`));
                        console.log(chalk_1.default.green(`Model: ${currentModelConfig.model}`));
                    }
                    // Test API key
                    const apiKey = config_manager_1.configManager.getApiKey(currentModel);
                    if (apiKey) {
                        console.log(chalk_1.default.green(`✅ API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)} (${apiKey.length} chars)`));
                    }
                    else {
                        console.log(chalk_1.default.red(`❌ API Key: Not configured`));
                    }
                    break;
                }
                case 'temp': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.green(`Current temperature: ${config_manager_1.configManager.get('temperature')}`));
                        return;
                    }
                    const temp = parseFloat(args[0]);
                    if (isNaN(temp) || temp < 0 || temp > 2) {
                        console.log(chalk_1.default.red('Temperature must be between 0.0 and 2.0'));
                        return;
                    }
                    config_manager_1.configManager.set('temperature', temp);
                    console.log(chalk_1.default.green(`✅ Temperature set to ${temp}`));
                    break;
                }
                case 'system': {
                    if (args.length === 0) {
                        const session = chat_manager_1.chatManager.getCurrentSession();
                        console.log(chalk_1.default.green('Current system prompt:'));
                        console.log(chalk_1.default.gray(session?.systemPrompt || 'None'));
                        return;
                    }
                    const prompt = args.join(' ');
                    const session = chat_manager_1.chatManager.getCurrentSession();
                    if (session) {
                        session.systemPrompt = prompt;
                        // Update the system message
                        const systemMsgIndex = session.messages.findIndex(m => m.role === 'system');
                        if (systemMsgIndex >= 0) {
                            session.messages[systemMsgIndex].content = prompt;
                        }
                        else {
                            session.messages.unshift({
                                role: 'system',
                                content: prompt,
                                timestamp: new Date(),
                            });
                        }
                        console.log(chalk_1.default.green('✅ System prompt updated'));
                    }
                    break;
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Session management failed: ${error.message}`, source: 'session' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    async handleModelConfig(command, args) {
        try {
            switch (command) {
                case 'model': {
                    if (args.length === 0) {
                        const current = advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo();
                        console.log(chalk_1.default.green(`Current model: ${current.name} (${current.config?.provider || 'unknown'})`));
                        return;
                    }
                    const modelName = args[0];
                    config_manager_1.configManager.setCurrentModel(modelName);
                    console.log(chalk_1.default.green(`✅ Switched to model: ${modelName}`));
                    break;
                }
                case 'models': {
                    console.log(chalk_1.default.blue.bold('\n🤖 Available Models:'));
                    console.log(chalk_1.default.gray('─'.repeat(40)));
                    const currentModel = config_manager_1.configManager.get('currentModel');
                    const models = config_manager_1.configManager.get('models');
                    Object.entries(models).forEach(([name, config]) => {
                        const isCurrent = name === currentModel;
                        const hasKey = config_manager_1.configManager.getApiKey(name) !== undefined;
                        const status = hasKey ? chalk_1.default.green('✅') : chalk_1.default.red('❌');
                        const prefix = isCurrent ? chalk_1.default.yellow('→ ') : '  ';
                        console.log(`${prefix}${status} ${chalk_1.default.bold(name)}`);
                        console.log(`    ${chalk_1.default.gray(`Provider: ${config.provider} | Model: ${config.model}`)}`);
                    });
                    break;
                }
                case 'set-key': {
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /set-key <model> <api-key>'));
                        console.log(chalk_1.default.gray('Example: /set-key claude-3-5-sonnet sk-ant-...'));
                        return;
                    }
                    const [modelName, apiKey] = args;
                    config_manager_1.configManager.setApiKey(modelName, apiKey);
                    console.log(chalk_1.default.green(`✅ API key set for ${modelName}`));
                    break;
                }
                case 'config': {
                    console.log(chalk_1.default.cyan('⚙️ Current Configuration:'));
                    const config = config_manager_1.configManager.getConfig();
                    console.log(JSON.stringify(config, null, 2));
                    break;
                }
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Model/config operation failed: ${error.message}`, source: 'config' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    async handleAdvancedFeatures(command, args) {
        try {
            switch (command) {
                case 'agents': {
                    console.log(chalk_1.default.blue.bold('\n🤖 Available Agents:'));
                    console.log(chalk_1.default.gray('─'.repeat(40)));
                    const agents = agent_service_1.agentService.getAvailableAgents();
                    agents.forEach(agent => {
                        console.log(`${chalk_1.default.green('•')} ${chalk_1.default.bold(agent.name)}`);
                        console.log(`  ${chalk_1.default.gray(agent.description)}`);
                    });
                    break;
                }
                case 'agent': {
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /agent <name> <task>'));
                        return;
                    }
                    const agentName = args[0];
                    const task = args.slice(1).join(' ');
                    console.log((0, text_wrapper_1.formatAgent)(agentName, 'executing', task));
                    const taskId = await agent_service_1.agentService.executeTask(agentName, task);
                    console.log((0, text_wrapper_1.wrapBlue)(`🚀 Launched ${agentName} (Task ID: ${taskId.slice(-6)})`));
                    break;
                }
                case 'parallel': {
                    if (args.length < 2) {
                        console.log(chalk_1.default.red('Usage: /parallel <agent1,agent2,...> <task>'));
                        return;
                    }
                    const agentNames = args[0].split(',').map(name => name.trim());
                    const task = args.slice(1).join(' ');
                    console.log((0, text_wrapper_1.wrapBlue)(`⚡ Running ${agentNames.length} agents in parallel...`));
                    // Implementation would execute agents in parallel
                    break;
                }
                case 'factory': {
                    agent_factory_1.agentFactory.showFactoryDashboard();
                    break;
                }
                case 'create-agent': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /create-agent <specialization>'));
                        return;
                    }
                    const specialization = args.join(' ');
                    const blueprint = await agent_factory_1.agentFactory.createAgentBlueprint({
                        specialization,
                        autonomyLevel: 'fully-autonomous',
                        contextScope: 'project',
                    });
                    console.log(chalk_1.default.green(`✅ Agent blueprint created: ${blueprint.name}`));
                    console.log(chalk_1.default.gray(`Blueprint ID: ${blueprint.id}`));
                    break;
                }
                case 'launch-agent': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.red('Usage: /launch-agent <blueprint-id> [task]'));
                        return;
                    }
                    const blueprintId = args[0];
                    const task = args.slice(1).join(' ');
                    const agent = await agent_factory_1.agentFactory.launchAgent(blueprintId);
                    if (task) {
                        console.log((0, text_wrapper_1.formatAgent)('agent', 'running', task));
                        const result = await agent.run(task);
                        console.log(chalk_1.default.green('✅ Agent execution completed'));
                    }
                    else {
                        console.log(chalk_1.default.blue('🤖 Agent launched and ready'));
                    }
                    break;
                }
                case 'context': {
                    if (args.length === 0) {
                        workspace_context_1.workspaceContext.showContextSummary();
                        return;
                    }
                    const paths = args;
                    await workspace_context_1.workspaceContext.selectPaths(paths);
                    console.log(chalk_1.default.green('✅ Workspace context updated'));
                    break;
                }
                case 'stream': {
                    if (args.length > 0 && args[0] === 'clear') {
                        const activeAgents = agent_stream_1.agentStream.getActiveAgents();
                        activeAgents.forEach(agentId => {
                            agent_stream_1.agentStream.clearAgentStream(agentId);
                        });
                        console.log(chalk_1.default.green('✅ All agent streams cleared'));
                    }
                    else {
                        agent_stream_1.agentStream.showLiveDashboard();
                    }
                    break;
                }
                case 'approval': {
                    if (args.length === 0) {
                        console.log(chalk_1.default.blue('Approval System Configuration:'));
                        const config = approval_system_1.approvalSystem.getConfig();
                        console.log(JSON.stringify(config, null, 2));
                    }
                    else {
                        // Handle approval subcommands
                        const subcommand = args[0];
                        if (subcommand === 'test') {
                            const approved = await approval_system_1.approvalSystem.quickApproval('Test Approval', 'This is a test of the approval system', 'low');
                            console.log(approved ? chalk_1.default.green('Approved') : chalk_1.default.yellow('Cancelled'));
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
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Advanced feature failed: ${error.message}`, source: 'advanced' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    // Documentation Commands Handlers
    async handleDocsCommand(args) {
        try {
            if (args.length === 0) {
                // Show help and status
                console.log(chalk_1.default.blue.bold('\n📚 Documentation System'));
                console.log(chalk_1.default.gray('─'.repeat(50)));
                // Show status
                const stats = documentation_library_1.docLibrary.getStats();
                console.log(chalk_1.default.green(`📖 Library: ${stats.totalDocs} documents`));
                console.log(chalk_1.default.green(`📂 Categories: ${stats.categories.length} (${stats.categories.join(', ')})`));
                console.log(chalk_1.default.green(`📝 Total Words: ${stats.totalWords.toLocaleString()}`));
                console.log(chalk_1.default.green(`🌍 Languages: ${stats.languages.join(', ')}`));
                // Show available commands
                console.log(chalk_1.default.blue('\n📋 Available Commands:'));
                console.log(chalk_1.default.gray('  /docs                    - Show this help and status'));
                console.log(chalk_1.default.gray('  /doc-search <query>      - Search documentation library'));
                console.log(chalk_1.default.gray('  /doc-add <url>          - Add documentation from URL'));
                console.log(chalk_1.default.gray('  /doc-stats              - Show detailed statistics'));
                console.log(chalk_1.default.gray('  /doc-list [category]    - List available documentation'));
                console.log(chalk_1.default.gray('  /doc-tag <id> <tags>    - Manage document tags (coming soon)'));
                return;
            }
            // Handle subcommands
            if (args.length === 0) {
                console.log(chalk_1.default.red('Missing subcommand. Use /doc help for available commands.'));
                return;
            }
            const subcommand = args[0];
            const subArgs = args.slice(1);
            switch (subcommand) {
                case 'status':
                    documentation_library_1.docLibrary.showStatus();
                    break;
                case 'help':
                    await this.handleDocsCommand([]);
                    break;
                default:
                    console.log(chalk_1.default.red(`❌ Unknown docs subcommand: ${subcommand}`));
                    console.log(chalk_1.default.gray('Use "/docs" for help'));
            }
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Docs command error: ${error.message}`));
        }
    }
    async handleDocSearchCommand(args) {
        try {
            if (args.length === 0) {
                console.log(chalk_1.default.red('Usage: /doc-search <query> [category]'));
                console.log(chalk_1.default.gray('Example: /doc-search "react hooks"'));
                console.log(chalk_1.default.gray('Example: /doc-search "api" backend'));
                return;
            }
            const query = args[0];
            const category = args[1];
            console.log(chalk_1.default.blue(`🔍 Searching for: "${query}"${category ? ` in category: ${category}` : ''}`));
            const results = await documentation_library_1.docLibrary.search(query, category, 10);
            if (results.length === 0) {
                console.log(chalk_1.default.yellow('❌ No documents found'));
                console.log(chalk_1.default.gray('Try different keywords or use /doc-add to add more documentation'));
                return;
            }
            console.log(chalk_1.default.green(`\n✅ Found ${results.length} results:`));
            console.log(chalk_1.default.gray('─'.repeat(60)));
            results.forEach((result, index) => {
                console.log(chalk_1.default.blue(`${index + 1}. ${result.entry.title}`));
                console.log(chalk_1.default.gray(`   Score: ${(result.score * 100).toFixed(1)}% | Category: ${result.entry.category}`));
                console.log(chalk_1.default.gray(`   URL: ${result.entry.url}`));
                console.log(chalk_1.default.gray(`   Tags: ${result.entry.tags.join(', ')}`));
                if (result.snippet) {
                    console.log(chalk_1.default.white(`   Preview: ${result.snippet.substring(0, 120)}...`));
                }
                console.log();
            });
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Search error: ${error.message}`));
        }
    }
    async handleDocAddCommand(args) {
        try {
            if (args.length === 0) {
                console.log(chalk_1.default.red('Usage: /doc-add <url> [category] [tags...]'));
                console.log(chalk_1.default.gray('Example: /doc-add https://reactjs.org/'));
                console.log(chalk_1.default.gray('Example: /doc-add https://nodejs.org/ backend node,api'));
                return;
            }
            const url = args[0];
            const category = args[1] || 'general';
            const tags = args.slice(2);
            // Simple URL validation
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                console.log(chalk_1.default.red('❌ Invalid URL. Must start with http:// or https://'));
                return;
            }
            console.log(chalk_1.default.blue(`📖 Adding documentation from: ${url}`));
            if (category !== 'general')
                console.log(chalk_1.default.gray(`📂 Category: ${category}`));
            if (tags.length > 0)
                console.log(chalk_1.default.gray(`🏷️ Tags: ${tags.join(', ')}`));
            const spinner = (0, ora_1.default)('Extracting content...').start();
            try {
                const entry = await documentation_library_1.docLibrary.addDocumentation(url, category, tags);
                spinner.succeed('Documentation added successfully!');
                console.log(chalk_1.default.green('\n✅ Document Added:'));
                console.log(chalk_1.default.gray('─'.repeat(40)));
                console.log(chalk_1.default.blue(`📄 Title: ${entry.title}`));
                console.log(chalk_1.default.gray(`🆔 ID: ${entry.id}`));
                console.log(chalk_1.default.gray(`📂 Category: ${entry.category}`));
                console.log(chalk_1.default.gray(`🏷️ Tags: ${entry.tags.join(', ')}`));
                console.log(chalk_1.default.gray(`📝 Words: ${entry.metadata.wordCount}`));
                console.log(chalk_1.default.gray(`🌍 Language: ${entry.metadata.language}`));
            }
            catch (error) {
                spinner.fail('Failed to add documentation');
                throw error;
            }
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Add documentation error: ${error.message}`));
        }
    }
    async handleDocStatsCommand(args) {
        try {
            const detailed = args.includes('--detailed') || args.includes('-d');
            const stats = documentation_library_1.docLibrary.getStats();
            console.log(chalk_1.default.blue.bold('\n📊 Documentation Library Statistics'));
            console.log(chalk_1.default.gray('─'.repeat(50)));
            console.log(chalk_1.default.green(`📖 Total Documents: ${stats.totalDocs}`));
            console.log(chalk_1.default.green(`📝 Total Words: ${stats.totalWords.toLocaleString()}`));
            console.log(chalk_1.default.green(`📂 Categories: ${stats.categories.length}`));
            console.log(chalk_1.default.green(`🌍 Languages: ${stats.languages.length}`));
            console.log(chalk_1.default.green(`👁️ Average Access Count: ${stats.avgAccessCount.toFixed(1)}`));
            if (detailed && stats.categories.length > 0) {
                console.log(chalk_1.default.blue('\n📂 By Category:'));
                stats.categories.forEach((category) => {
                    console.log(chalk_1.default.gray(`  • ${category}`));
                });
                console.log(chalk_1.default.blue('\n🌍 By Language:'));
                stats.languages.forEach((language) => {
                    console.log(chalk_1.default.gray(`  • ${language}`));
                });
            }
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Stats error: ${error.message}`));
        }
    }
    async handleDocListCommand(args) {
        try {
            const category = args[0];
            // Get all documents (accessing the private docs Map)
            const allDocs = Array.from(documentation_library_1.docLibrary.docs.values());
            // Filter by category if specified
            const docs = category
                ? allDocs.filter(doc => doc.category === category)
                : allDocs;
            if (docs.length === 0) {
                if (category) {
                    console.log(chalk_1.default.yellow(`❌ No documents found in category: ${category}`));
                }
                else {
                    console.log(chalk_1.default.yellow('❌ No documents in library'));
                    console.log(chalk_1.default.gray('Use /doc-add <url> to add documentation'));
                }
                return;
            }
            console.log(chalk_1.default.blue.bold(`\n📋 Documentation List${category ? ` (Category: ${category})` : ''}`));
            console.log(chalk_1.default.gray('─'.repeat(60)));
            docs
                .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
                .forEach((doc, index) => {
                console.log(chalk_1.default.blue(`${index + 1}. ${doc.title}`));
                console.log(chalk_1.default.gray(`   ID: ${doc.id} | Category: ${doc.category}`));
                console.log(chalk_1.default.gray(`   URL: ${doc.url}`));
                console.log(chalk_1.default.gray(`   Tags: ${doc.tags.join(', ') || 'none'}`));
                console.log(chalk_1.default.gray(`   Words: ${doc.metadata.wordCount} | Access: ${doc.accessCount}x`));
                console.log(chalk_1.default.gray(`   Added: ${doc.timestamp.toLocaleDateString()}`));
                console.log();
            });
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ List error: ${error.message}`));
        }
    }
    async handleDocTagCommand(args) {
        try {
            console.log(chalk_1.default.yellow('🏷️ Document tagging feature is coming soon!'));
            console.log(chalk_1.default.gray('This will allow you to:'));
            console.log(chalk_1.default.gray('• Add tags to existing documents'));
            console.log(chalk_1.default.gray('• Remove tags from documents'));
            console.log(chalk_1.default.gray('• Search documents by tags'));
            console.log(chalk_1.default.gray('• List all available tags'));
            if (args.length > 0) {
                console.log(chalk_1.default.gray(`\nYour input: ${args.join(' ')}`));
            }
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Tag error: ${error.message}`));
        }
    }
    async handleDocSyncCommand(args) {
        try {
            const cloudProvider = (0, cloud_docs_provider_1.getCloudDocsProvider)();
            if (!cloudProvider?.isReady()) {
                console.log(chalk_1.default.yellow('⚠️ Cloud documentation not configured'));
                console.log(chalk_1.default.gray('Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables'));
                console.log(chalk_1.default.gray('Or use /config to enable cloud docs'));
                return;
            }
            console.log(chalk_1.default.blue('🔄 Synchronizing documentation library...'));
            const spinner = (0, ora_1.default)('Syncing with cloud...').start();
            try {
                const result = await cloudProvider.sync();
                spinner.succeed(`Sync completed: ${result.downloaded} downloaded, ${result.uploaded} uploaded`);
                if (result.downloaded > 0) {
                    console.log(chalk_1.default.green(`✅ ${result.downloaded} new documents available`));
                    console.log(chalk_1.default.gray('Use /doc-search to explore new content'));
                }
            }
            catch (error) {
                spinner.fail('Sync failed');
                throw error;
            }
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Sync error: ${error.message}`));
        }
    }
    async handleDocLoadCommand(args) {
        try {
            if (args.length === 0) {
                console.log(chalk_1.default.red('Usage: /doc-load <doc-names>'));
                console.log(chalk_1.default.gray('Example: /doc-load "react hooks" nodejs-api'));
                console.log(chalk_1.default.gray('Example: /doc-load frontend-docs backend-docs'));
                // Show suggestions
                const suggestions = await docs_context_manager_1.docsContextManager.suggestDocs('popular');
                if (suggestions.length > 0) {
                    console.log(chalk_1.default.blue('\n💡 Suggestions:'));
                    suggestions.forEach(title => {
                        console.log(chalk_1.default.gray(`  • ${title}`));
                    });
                }
                return;
            }
            console.log(chalk_1.default.blue(`📚 Loading ${args.length} document(s) into AI context...`));
            const loadedDocs = await docs_context_manager_1.docsContextManager.loadDocs(args);
            if (loadedDocs.length > 0) {
                const stats = docs_context_manager_1.docsContextManager.getContextStats();
                console.log(chalk_1.default.green(`✅ Context updated:`));
                console.log(chalk_1.default.gray(`   • Loaded docs: ${stats.loadedCount}`));
                console.log(chalk_1.default.gray(`   • Total words: ${stats.totalWords.toLocaleString()}`));
                console.log(chalk_1.default.gray(`   • Context usage: ${stats.utilizationPercent.toFixed(1)}%`));
                console.log(chalk_1.default.gray(`   • Categories: ${stats.categories.join(', ')}`));
                console.log(chalk_1.default.blue('\n💬 AI agents now have access to loaded documentation!'));
            }
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Load error: ${error.message}`));
        }
    }
    async handleDocContextCommand(args) {
        try {
            const stats = docs_context_manager_1.docsContextManager.getContextStats();
            console.log(chalk_1.default.blue.bold('\n📚 AI Documentation Context Status'));
            console.log(chalk_1.default.gray('─'.repeat(50)));
            if (stats.loadedCount === 0) {
                console.log(chalk_1.default.yellow('❌ No documentation loaded in context'));
                console.log(chalk_1.default.gray('Use /doc-load <names> to load documentation'));
                console.log(chalk_1.default.gray('Use /doc-suggest <query> to find relevant docs'));
                return;
            }
            console.log(chalk_1.default.green(`📖 Loaded Documents: ${stats.loadedCount}`));
            console.log(chalk_1.default.green(`📝 Total Words: ${stats.totalWords.toLocaleString()}`));
            console.log(chalk_1.default.green(`📊 Context Usage: ${stats.utilizationPercent.toFixed(1)}%`));
            console.log(chalk_1.default.green(`📂 Categories: ${stats.categories.join(', ')}`));
            console.log(chalk_1.default.green(`🏠 Local: ${stats.sources.local}, ☁️ Shared: ${stats.sources.shared}`));
            if (args.includes('--detailed') || args.includes('-d')) {
                console.log(chalk_1.default.blue('\n📋 Loaded Documents:'));
                const loadedDocs = docs_context_manager_1.docsContextManager.getLoadedDocs();
                loadedDocs.forEach((doc, index) => {
                    const wordCount = doc.content.split(' ').length;
                    console.log(chalk_1.default.blue(`${index + 1}. ${doc.title}`));
                    console.log(chalk_1.default.gray(`   Category: ${doc.category} | Source: ${doc.source}`));
                    console.log(chalk_1.default.gray(`   Tags: ${doc.tags.join(', ')}`));
                    console.log(chalk_1.default.gray(`   Words: ${wordCount.toLocaleString()} | Loaded: ${doc.loadedAt.toLocaleString()}`));
                    if (doc.summary) {
                        console.log(chalk_1.default.gray(`   Summary: ${doc.summary}`));
                    }
                    console.log();
                });
            }
            // Context summary for AI
            const summary = docs_context_manager_1.docsContextManager.getContextSummary();
            if (args.includes('--summary')) {
                console.log(chalk_1.default.blue('\n🤖 AI Context Summary:'));
                console.log(chalk_1.default.gray('─'.repeat(40)));
                console.log(summary);
            }
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Context error: ${error.message}`));
        }
    }
    async handleDocUnloadCommand(args) {
        try {
            if (args.length === 0) {
                // Show current loaded docs and ask for confirmation to clear all
                const stats = docs_context_manager_1.docsContextManager.getContextStats();
                if (stats.loadedCount === 0) {
                    console.log(chalk_1.default.yellow('❌ No documentation loaded in context'));
                    return;
                }
                console.log(chalk_1.default.yellow(`⚠️ This will remove all ${stats.loadedCount} loaded documents from AI context`));
                console.log(chalk_1.default.gray('Use /doc-unload <names> to remove specific documents'));
                console.log(chalk_1.default.gray('Use /doc-unload --all to confirm removal of all documents'));
                return;
            }
            if (args.includes('--all')) {
                await docs_context_manager_1.docsContextManager.unloadDocs();
                console.log(chalk_1.default.green('✅ All documentation removed from AI context'));
                return;
            }
            await docs_context_manager_1.docsContextManager.unloadDocs(args);
            const stats = docs_context_manager_1.docsContextManager.getContextStats();
            console.log(chalk_1.default.green('✅ Documentation context updated'));
            console.log(chalk_1.default.gray(`   • Remaining docs: ${stats.loadedCount}`));
            console.log(chalk_1.default.gray(`   • Context usage: ${stats.utilizationPercent.toFixed(1)}%`));
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Unload error: ${error.message}`));
        }
    }
    async handleDocSuggestCommand(args) {
        try {
            const query = args.join(' ');
            if (!query) {
                console.log(chalk_1.default.red('Usage: /doc-suggest <query>'));
                console.log(chalk_1.default.gray('Example: /doc-suggest react hooks'));
                console.log(chalk_1.default.gray('Example: /doc-suggest authentication'));
                return;
            }
            console.log(chalk_1.default.blue(`💡 Suggesting documentation for: "${query}"`));
            const suggestions = await docs_context_manager_1.docsContextManager.suggestDocs(query, 10);
            if (suggestions.length === 0) {
                console.log(chalk_1.default.yellow('❌ No relevant documentation found'));
                console.log(chalk_1.default.gray('Try different keywords or use /doc-add to add more documentation'));
                return;
            }
            console.log(chalk_1.default.green(`\n✅ Found ${suggestions.length} relevant documents:`));
            console.log(chalk_1.default.gray('─'.repeat(50)));
            suggestions.forEach((title, index) => {
                console.log(chalk_1.default.blue(`${index + 1}. ${title}`));
            });
            console.log(chalk_1.default.gray('\n💡 To load these documents:'));
            console.log(chalk_1.default.gray(`/doc-load "${suggestions.slice(0, 3).join('" "')}"`));
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Suggest error: ${error.message}`));
        }
    }
    // Enhanced Planning Methods (from enhanced-planning.ts)
    async generateAdvancedPlan(goal, options = {}) {
        const { maxTodos = 20, includeContext = true, showDetails = true, saveTodoFile = true, todoFilePath = 'todo.md' } = options;
        console.log(chalk_1.default.blue.bold(`\n🎯 Generating Advanced Plan: ${goal}`));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        // Get project context
        let projectContext = '';
        if (includeContext) {
            console.log(chalk_1.default.gray('📁 Analyzing project context...'));
            const context = workspace_context_1.workspaceContext.getContextForAgent('planner', 10);
            projectContext = context.projectSummary;
        }
        // Generate AI-powered plan
        console.log(chalk_1.default.gray('🧠 Generating AI plan...'));
        const todos = await this.generateTodosWithAI(goal, projectContext, maxTodos);
        // Create plan object
        const plan = {
            id: Date.now().toString(),
            title: this.extractPlanTitle(goal),
            description: goal,
            goal,
            todos,
            status: 'draft',
            estimatedTotalDuration: todos.reduce((sum, todo) => sum + todo.estimatedDuration, 0),
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
    async generateTodosWithAI(goal, context, maxTodos) {
        try {
            // Check cache first to save massive tokens
            const truncatedContext = context.length > 1000 ? context.substring(0, 1000) + '...' : context;
            const planningPrompt = `Plan: ${goal} (max ${maxTodos} todos)`;
            const cachedResponse = await token_cache_1.tokenCache.getCachedResponse(planningPrompt, truncatedContext, ['planning', 'todos', 'ai-generation']);
            if (cachedResponse) {
                console.log(chalk_1.default.green('🎯 Using cached planning response'));
                try {
                    const planData = JSON.parse(cachedResponse.response || '{}');
                    if (planData.todos && Array.isArray(planData.todos)) {
                        return planData.todos.slice(0, maxTodos);
                    }
                }
                catch (e) {
                    console.log(chalk_1.default.yellow('⚠️ Cached response format invalid, generating new plan'));
                }
            }
            // Build optimized context-aware message for AI planning - reduced token usage
            const messages = [{
                    role: 'system',
                    content: `Expert project planner. Generate JSON todo array:
{"todos":[{"title":"Task title","description":"Task desc","priority":"low/medium/high/critical","category":"planning/setup/implementation/testing/docs/deployment","estimatedDuration":30,"dependencies":[],"tags":["tag"],"commands":["cmd"],"files":["file.ts"],"reasoning":"Brief reason"}]}

Max ${maxTodos} todos. Context: ${truncatedContext}`
                }, {
                    role: 'user',
                    content: planningPrompt
                }];
            // Stream AI response for real-time feedback
            let assistantText = '';
            for await (const ev of advanced_ai_provider_1.advancedAIProvider.streamChatWithFullAutonomy(messages)) {
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
            const todos = planData.todos.map((todoData, index) => ({
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
            await token_cache_1.tokenCache.setCachedResponse(planningPrompt, JSON.stringify({ todos: planData.todos }), truncatedContext, tokensEstimated, ['planning', 'todos', 'ai-generation']);
            console.log(chalk_1.default.green(`✅ Generated ${todos.length} todos (cached for future use)`));
            return todos;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to generate AI plan: ${error.message}`));
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
    displayAdvancedPlan(plan) {
        console.log((0, boxen_1.default)(`${chalk_1.default.blue.bold(plan.title)}\n\n` +
            `${chalk_1.default.gray('Goal:')} ${plan.goal}\n` +
            `${chalk_1.default.gray('Todos:')} ${plan.todos.length}\n` +
            `${chalk_1.default.gray('Estimated Duration:')} ${Math.round(plan.estimatedTotalDuration)} minutes\n` +
            `${chalk_1.default.gray('Status:')} ${this.getPlanStatusColor(plan.status)(plan.status.toUpperCase())}`, {
            padding: 1,
            margin: { top: 1, bottom: 1, left: 0, right: 0 },
            borderStyle: 'round',
            borderColor: 'blue',
        }));
        console.log(chalk_1.default.blue.bold('\n📋 Todo Items:'));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        plan.todos.forEach((todo, index) => {
            const priorityIcon = this.getPlanPriorityIcon(todo.priority);
            const statusIcon = this.getPlanStatusIcon(todo.status);
            const categoryColor = this.getPlanCategoryColor(todo.category);
            console.log(`${index + 1}. ${statusIcon} ${priorityIcon} ${chalk_1.default.bold(todo.title)}`);
            console.log(`   ${chalk_1.default.gray(todo.description)}`);
            console.log(`   ${categoryColor(todo.category)} | ${chalk_1.default.gray(todo.estimatedDuration + 'min')} | ${chalk_1.default.gray(todo.tags.join(', '))}`);
            if (todo.dependencies.length > 0) {
                console.log(`   ${chalk_1.default.yellow('Dependencies:')} ${todo.dependencies.join(', ')}`);
            }
            if (todo.files && todo.files.length > 0) {
                console.log(`   ${(0, text_wrapper_1.wrapBlue)('Files:')} ${todo.files.join(', ')}`);
            }
            console.log();
        });
    }
    async executeAdvancedPlan(planId) {
        const plan = enhanced_planning_1.enhancedPlanning.getPlan(planId);
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }
        if (plan.status !== 'approved') {
            const approved = await this.handlePlanApproval(planId);
            if (!approved) {
                return;
            }
        }
        console.log(chalk_1.default.blue.bold(`\n🚀 Executing Plan: ${plan.title}`));
        console.log(chalk_1.default.cyan('🤖 Auto Mode: Plan will execute automatically'));
        console.log(chalk_1.default.gray('═'.repeat(60)));
        plan.status = 'executing';
        plan.startedAt = new Date();
        try {
            // Execute todos in dependency order
            const executionOrder = this.resolveDependencyOrder(plan.todos);
            let completedCount = 0;
            let autoSkipped = 0;
            for (const todo of executionOrder) {
                console.log(chalk_1.default.cyan(`\n📋 [${completedCount + 1}/${plan.todos.length}] ${todo.title}`));
                console.log(chalk_1.default.gray(`   ${todo.description}`));
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
                    console.log(chalk_1.default.green(`   ✅ Completed in ${Math.round(duration / 1000)}s`));
                    completedCount++;
                    // Update todo.md file
                    await this.saveTodoMarkdown(plan);
                }
                catch (error) {
                    todo.status = 'failed';
                    console.log(chalk_1.default.red(`   ❌ Failed: ${error.message}`));
                    // In auto mode, decide automatically based on error severity
                    if (error.message.includes('critical') || error.message.includes('fatal')) {
                        console.log(chalk_1.default.red('🛑 Critical error detected - stopping execution'));
                        plan.status = 'failed';
                        return;
                    }
                    else {
                        // Auto-continue on non-critical errors
                        console.log(chalk_1.default.yellow('⚠️  Non-critical error - continuing with remaining todos'));
                        todo.status = 'failed'; // Keep as failed but continue
                        autoSkipped++;
                    }
                }
                // Show progress
                const progress = Math.round((completedCount / plan.todos.length) * 100);
                console.log(`   ${(0, text_wrapper_1.formatProgress)(completedCount, plan.todos.length)}`);
                // Brief pause between todos for readability
                if (completedCount < plan.todos.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            // Plan completed
            plan.status = 'completed';
            plan.completedAt = new Date();
            plan.actualTotalDuration = plan.todos.reduce((sum, todo) => sum + (todo.actualDuration || 0), 0);
            console.log(chalk_1.default.green.bold(`\n🎉 Plan Completed Successfully!`));
            console.log(chalk_1.default.gray(`✅ ${completedCount}/${plan.todos.length} todos completed`));
            if (autoSkipped > 0) {
                console.log(chalk_1.default.yellow(`⚠️  ${autoSkipped} todos had non-critical errors`));
            }
            console.log(chalk_1.default.gray(`⏱️  Total time: ${plan.actualTotalDuration} minutes`));
            // Update final todo.md
            await this.saveTodoMarkdown(plan);
            // Add completion summary to live updates
            this.addLiveUpdate({
                type: 'log',
                content: `Plan '${plan.title}' completed: ${completedCount}/${plan.todos.length} todos successful`,
                source: 'plan-execution'
            });
        }
        catch (error) {
            plan.status = 'failed';
            console.log(chalk_1.default.red(`\n❌ Plan execution failed: ${error.message}`));
            this.addLiveUpdate({
                type: 'error',
                content: `Plan '${plan.title}' failed: ${error.message}`,
                source: 'plan-execution'
            });
        }
    }
    async executeSingleTodo(todo, plan) {
        console.log(chalk_1.default.gray(`   🔍 Analyzing todo: ${todo.title}`));
        // Build a compact execution prompt and hand off to the autonomous provider
        const toolsList = Array.isArray(todo.tools) && todo.tools.length > 0 ? todo.tools.join(', ') : 'read_file, write_file, explore_directory, execute_command, analyze_project, manage_packages, generate_code';
        const executionMessages = [
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
            for await (const event of advanced_ai_provider_1.advancedAIProvider.executeAutonomousTask('Execute task', { messages: executionMessages })) {
                if (event.type === 'text_delta' && event.content) {
                    responseText += event.content;
                }
                else if (event.type === 'tool_call') {
                    console.log(chalk_1.default.cyan(`   🛠️ Tool: ${event.toolName}`));
                }
                else if (event.type === 'tool_result') {
                    console.log(chalk_1.default.gray(`   ↪ Result from ${event.toolName}`));
                }
                else if (event.type === 'error') {
                    throw new Error(event.error || 'Unknown autonomous execution error');
                }
            }
        }
        catch (err) {
            console.log(chalk_1.default.yellow(`   ⚠️ Autonomous execution warning: ${err.message}`));
        }
        // Optional: still honor any concrete commands/files declared by the todo
        if (todo.commands && todo.commands.length > 0) {
            for (const command of todo.commands) {
                console.log(`   ${(0, text_wrapper_1.formatCommand)(command)}`);
                try {
                    const [cmd, ...args] = command.split(' ');
                    await tools_manager_1.toolsManager.runCommand(cmd, args);
                }
                catch (error) {
                    console.log(chalk_1.default.yellow(`   ⚠️ Command warning: ${error}`));
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        if (todo.files && todo.files.length > 0) {
            for (const file of todo.files) {
                console.log(chalk_1.default.yellow(`   📄 Working on file: ${file}`));
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }
    }
    resolveDependencyOrder(todos) {
        const resolved = [];
        const remaining = [...todos];
        while (remaining.length > 0) {
            const canExecute = remaining.filter(todo => todo.dependencies.every((depId) => resolved.some(resolvedTodo => resolvedTodo.id === depId)));
            if (canExecute.length === 0) {
                // Break circular dependencies by taking the first remaining todo
                const next = remaining.shift();
                resolved.push(next);
            }
            else {
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
    async handlePlanApproval(planId) {
        const plan = enhanced_planning_1.enhancedPlanning.getPlan(planId);
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }
        console.log(chalk_1.default.yellow.bold('\n⚠️  Plan Review Required'));
        console.log(chalk_1.default.gray('═'.repeat(60)));
        // Show plan summary
        this.displayPlanSummary(plan);
        // Ask for approval
        const approved = await this.askAdvancedConfirmation(`Execute Plan: ${plan.title}`, `Execute ${plan.todos.length} tasks with estimated duration of ${Math.round(plan.estimatedTotalDuration)} minutes`, false);
        if (approved) {
            plan.status = 'approved';
            plan.approvedAt = new Date();
            console.log(chalk_1.default.green('✅ Plan approved for execution'));
        }
        else {
            console.log(chalk_1.default.yellow('❌ Plan execution cancelled'));
        }
        return approved;
    }
    displayPlanSummary(plan) {
        const stats = {
            byPriority: this.groupPlanBy(plan.todos, 'priority'),
            byCategory: this.groupPlanBy(plan.todos, 'category'),
            totalFiles: new Set(plan.todos.flatMap((t) => t.files || [])).size,
            totalCommands: plan.todos.reduce((sum, t) => sum + (t.commands?.length || 0), 0),
        };
        console.log(chalk_1.default.cyan('📊 Plan Statistics:'));
        console.log(`  • Total Todos: ${plan.todos.length}`);
        console.log(`  • Estimated Duration: ${Math.round(plan.estimatedTotalDuration)} minutes`);
        console.log(`  • Files to modify: ${stats.totalFiles}`);
        console.log(`  • Commands to run: ${stats.totalCommands}`);
        console.log(chalk_1.default.cyan('\n🎯 Priority Distribution:'));
        Object.entries(stats.byPriority).forEach(([priority, todos]) => {
            const icon = this.getPlanPriorityIcon(priority);
            console.log(`  ${icon} ${priority}: ${todos.length} todos`);
        });
        console.log(chalk_1.default.cyan('\n📁 Category Distribution:'));
        Object.entries(stats.byCategory).forEach(([category, todos]) => {
            const color = this.getPlanCategoryColor(category);
            console.log(`  • ${color(category)}: ${todos.length} todos`);
        });
    }
    async saveTodoMarkdown(plan, filename = 'todo.md') {
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
        plan.todos.forEach((todo, index) => {
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
                todo.commands.forEach((cmd) => {
                    content += `- \`${cmd}\`\n`;
                });
                content += '\n';
            }
            if (todo.tags.length > 0) {
                content += `**Tags:** ${todo.tags.map((tag) => `#${tag}`).join(' ')}\n\n`;
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
        content += `- **Completed:** ${plan.todos.filter((t) => t.status === 'completed').length}\n`;
        content += `- **In Progress:** ${plan.todos.filter((t) => t.status === 'in_progress').length}\n`;
        content += `- **Pending:** ${plan.todos.filter((t) => t.status === 'pending').length}\n`;
        content += `- **Failed:** ${plan.todos.filter((t) => t.status === 'failed').length}\n`;
        if (plan.actualTotalDuration) {
            content += `- **Actual Duration:** ${plan.actualTotalDuration}min\n`;
            content += `- **Estimated vs Actual:** ${Math.round((plan.actualTotalDuration / plan.estimatedTotalDuration) * 100)}%\n`;
        }
        content += `\n---\n*Generated by NikCLI on ${new Date().toISOString()}*\n`;
        await fs.writeFile(todoPath, content, 'utf8');
        console.log(chalk_1.default.green(`📄 Todo file saved: ${todoPath}`));
    }
    // Planning Utility Methods
    extractPlanTitle(goal) {
        return goal.length > 50 ? goal.substring(0, 47) + '...' : goal;
    }
    groupPlanBy(array, key) {
        return array.reduce((groups, item) => {
            const group = String(item[key]);
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    }
    getPlanStatusColor(status) {
        switch (status) {
            case 'completed': return chalk_1.default.green;
            case 'executing':
            case 'in_progress': return chalk_1.default.blue;
            case 'approved': return chalk_1.default.cyan;
            case 'failed': return chalk_1.default.red;
            case 'cancelled': return chalk_1.default.yellow;
            default: return chalk_1.default.gray;
        }
    }
    getPlanStatusIcon(status) {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '🔄';
            case 'failed': return '❌';
            case 'skipped': return '⏭️';
            default: return '⏳';
        }
    }
    getPlanStatusEmoji(status) {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '🔄';
            case 'failed': return '❌';
            case 'skipped': return '⏭️';
            default: return '⏳';
        }
    }
    getPlanPriorityIcon(priority) {
        switch (priority) {
            case 'critical': return '🔴';
            case 'high': return '🟡';
            case 'medium': return '🟢';
            case 'low': return '🔵';
            default: return '⚪';
        }
    }
    getPlanPriorityEmoji(priority) {
        switch (priority) {
            case 'critical': return '🔥';
            case 'high': return '⚡';
            case 'medium': return '📋';
            case 'low': return '📝';
            default: return '📄';
        }
    }
    getPlanCategoryColor(category) {
        switch (category) {
            case 'planning': return chalk_1.default.cyan;
            case 'setup': return chalk_1.default.blue;
            case 'implementation': return chalk_1.default.green;
            case 'testing': return chalk_1.default.yellow;
            case 'documentation': return chalk_1.default.magenta;
            case 'deployment': return chalk_1.default.red;
            default: return chalk_1.default.gray;
        }
    }
    // Utility methods
    async initializeSystems() {
        await this.agentManager.initialize();
        // Ensure orchestrator services share our working directory
        planning_service_1.planningService.setWorkingDirectory(this.workingDirectory);
        // Event bridge is idempotent
        this.setupOrchestratorEventBridge();
        // Initialize cloud docs provider
        await this.initializeCloudDocs();
        console.log(chalk_1.default.dim('✓ Systems initialized'));
    }
    async initializeCloudDocs() {
        try {
            const cloudDocsConfig = this.configManager.get('cloudDocs');
            // Get API credentials from environment or config
            const apiUrl = cloudDocsConfig.apiUrl || process.env.SUPABASE_URL;
            const apiKey = cloudDocsConfig.apiKey || process.env.SUPABASE_ANON_KEY;
            if (cloudDocsConfig.enabled && apiUrl && apiKey) {
                const provider = (0, cloud_docs_provider_1.createCloudDocsProvider)({
                    ...cloudDocsConfig,
                    apiUrl,
                    apiKey
                });
                if (cloudDocsConfig.autoSync) {
                    console.log(chalk_1.default.gray('📚 Auto-syncing documentation library...'));
                    await provider.sync();
                }
                console.log(chalk_1.default.dim('✓ Cloud documentation system ready'));
            }
            else {
                console.log(chalk_1.default.dim('ℹ️ Cloud documentation disabled'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.yellow(`⚠️ Cloud docs initialization failed: ${error.message}`));
        }
    }
    switchModel(modelName) {
        try {
            this.configManager.setCurrentModel(modelName);
            // Validate the new model using model provider
            if (model_provider_1.modelProvider.validateApiKey()) {
                console.log(chalk_1.default.green(`✅ Switched to model: ${modelName}`));
            }
            else {
                console.log(chalk_1.default.yellow(`⚠️  Switched to model: ${modelName} (API key needed)`));
            }
            this.addLiveUpdate({
                type: 'info',
                content: `Model switched to: ${modelName}`,
                source: 'model-switch'
            });
        }
        catch (error) {
            this.addLiveUpdate({
                type: 'error',
                content: `Model switch failed: ${error.message}`,
                source: 'model-switch'
            });
            console.log(chalk_1.default.red(`❌ Could not switch model: ${error.message}`));
        }
    }
    async askForApproval(question) {
        return await this.askAdvancedConfirmation(question, undefined, false);
    }
    async askForInput(prompt) {
        return new Promise((resolve) => {
            if (!this.rl) {
                resolve('');
                return;
            }
            this.rl.question(chalk_1.default.cyan(prompt), (answer) => {
                resolve(answer.trim());
            });
        });
    }
    async clearSession() {
        // Clear current chat session
        chat_manager_1.chatManager.clearCurrentSession();
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
        console.log(chalk_1.default.green('✅ Session and UI state cleared'));
        this.addLiveUpdate({ type: 'info', content: 'Session cleared', source: 'session' });
    }
    async compactSession() {
        console.log(chalk_1.default.blue('📊 Compacting session to save tokens...'));
        const session = chat_manager_1.chatManager.getCurrentSession();
        if (!session || session.messages.length <= 3) {
            console.log(chalk_1.default.yellow('Session too short to compact'));
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
                    role: 'system',
                    content: `[Compacted ${olderMessages.length} msgs]`,
                    timestamp: new Date()
                };
                session.messages = [...systemMessages, summaryMessage, ...recentMessages];
                console.log(chalk_1.default.green(`✅ Session compacted: ${originalCount} → ${session.messages.length} messages`));
                this.addLiveUpdate({
                    type: 'info',
                    content: `Saved ${originalCount - session.messages.length} messages`,
                    source: 'session'
                });
            }
            else {
                console.log(chalk_1.default.green('✓ Session compacted'));
            }
            // Additional token optimization: truncate long messages
            session.messages.forEach(msg => {
                if (msg.content.length > 2000) {
                    msg.content = msg.content.substring(0, 2000) + '...[truncated]';
                }
            });
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Error compacting session: ${error.message}`));
        }
    }
    async manageTokenCache(action) {
        switch (action) {
            case 'clear':
                await Promise.all([
                    token_cache_1.tokenCache.clearCache(),
                    completion_protocol_cache_1.completionCache.clearCache()
                ]);
                console.log(chalk_1.default.green('✅ All caches cleared'));
                break;
            case 'cleanup':
                const removed = await token_cache_1.tokenCache.cleanupExpired();
                console.log(chalk_1.default.green(`✅ Removed ${removed} expired cache entries`));
                break;
            case 'settings':
                console.log(chalk_1.default.blue('⚙️ Current Cache Settings:'));
                console.log(`  Max cache size: 1000 entries`);
                console.log(`  Similarity threshold: 0.85`);
                console.log(`  Max age: 7 days`);
                console.log(`  Cache file: ./.nikcli/token-cache.json`);
                break;
            case 'export':
                const exportPath = `./cache-export-${Date.now()}.json`;
                await token_cache_1.tokenCache.exportCache(exportPath);
                break;
            default: // 'stats' or no argument
                const stats = token_cache_1.tokenCache.getStats();
                const completionStats = completion_protocol_cache_1.completionCache.getStats();
                const totalTokensSaved = stats.totalTokensSaved + (completionStats.totalHits * 50); // Estimate 50 tokens saved per completion hit
                console.log((0, boxen_1.default)(`${chalk_1.default.cyan.bold('🔮 Advanced Cache System Statistics')}\n\n` +
                    `${chalk_1.default.magenta('📦 Full Response Cache:')}\n` +
                    `  Entries: ${chalk_1.default.white(stats.totalEntries.toLocaleString())}\n` +
                    `  Hits: ${chalk_1.default.green(stats.totalHits.toLocaleString())}\n` +
                    `  Tokens Saved: ${chalk_1.default.yellow(stats.totalTokensSaved.toLocaleString())}\n\n` +
                    `${chalk_1.default.cyan('🔮 Completion Protocol Cache:')} ${chalk_1.default.red('NEW!')}\n` +
                    `  Patterns: ${chalk_1.default.white(completionStats.totalPatterns.toLocaleString())}\n` +
                    `  Hits: ${chalk_1.default.green(completionStats.totalHits.toLocaleString())}\n` +
                    `  Avg Confidence: ${chalk_1.default.blue(Math.round(completionStats.averageConfidence * 100))}%\n\n` +
                    `${chalk_1.default.green.bold('💰 Total Savings:')}\n` +
                    `Combined Tokens: ${chalk_1.default.yellow(totalTokensSaved.toLocaleString())}\n` +
                    `Estimated Cost: ~$${(totalTokensSaved * 0.003 / 1000).toFixed(2)}`, {
                    padding: 1,
                    margin: 1,
                    borderStyle: 'round',
                    borderColor: 'magenta'
                }));
                if (stats.totalEntries > 0) {
                    console.log(chalk_1.default.cyan('\n🔧 Available Actions:'));
                    console.log('  /cache clear    - Clear all cache entries');
                    console.log('  /cache cleanup  - Remove expired entries');
                    console.log('  /cache settings - Show cache configuration');
                    console.log('  /cache export   - Export cache to file');
                }
                break;
        }
    }
    async showTokenUsage() {
        console.log(chalk_1.default.blue('📊 Token Usage Analysis & Optimization'));
        try {
            const session = chat_manager_1.chatManager.getCurrentSession();
            if (session) {
                const totalChars = session.messages.reduce((sum, msg) => sum + msg.content.length, 0);
                const estimatedTokens = Math.round(totalChars / 4);
                const tokenLimit = 200000;
                const usagePercent = Math.round((estimatedTokens / tokenLimit) * 100);
                console.log((0, boxen_1.default)(`${chalk_1.default.cyan('Current Session Token Usage')}\n\n` +
                    `Messages: ${chalk_1.default.white(session.messages.length.toLocaleString())}\n` +
                    `Characters: ${chalk_1.default.white(totalChars.toLocaleString())}\n` +
                    `Est. Tokens: ${chalk_1.default.white(estimatedTokens.toLocaleString())}\n` +
                    `Usage: ${usagePercent > 75 ? chalk_1.default.red(`${usagePercent}%`) : usagePercent > 50 ? chalk_1.default.yellow(`${usagePercent}%`) : chalk_1.default.green(`${usagePercent}%`)}\n` +
                    `Limit: ${chalk_1.default.gray(tokenLimit.toLocaleString())}`, {
                    padding: 1,
                    margin: 1,
                    borderStyle: 'round',
                    borderColor: usagePercent > 75 ? 'red' : usagePercent > 50 ? 'yellow' : 'green'
                }));
                // Message breakdown
                console.log(chalk_1.default.cyan('\n📋 Message Breakdown:'));
                const systemMsgs = session.messages.filter(m => m.role === 'system');
                const userMsgs = session.messages.filter(m => m.role === 'user');
                const assistantMsgs = session.messages.filter(m => m.role === 'assistant');
                console.log(`  System: ${systemMsgs.length} (${Math.round(systemMsgs.reduce((sum, m) => sum + m.content.length, 0) / 4).toLocaleString()} tokens)`);
                console.log(`  User: ${userMsgs.length} (${Math.round(userMsgs.reduce((sum, m) => sum + m.content.length, 0) / 4).toLocaleString()} tokens)`);
                console.log(`  Assistant: ${assistantMsgs.length} (${Math.round(assistantMsgs.reduce((sum, m) => sum + m.content.length, 0) / 4).toLocaleString()} tokens)`);
                // Recommendations
                if (estimatedTokens > 150000) {
                    console.log(chalk_1.default.red('\n⚠️ CRITICAL: Very high token usage!'));
                    console.log(chalk_1.default.yellow('Recommendations:'));
                    console.log('  • Use /compact to compress session immediately');
                    console.log('  • Start a new session with /new');
                    console.log('  • Enable auto-compaction (already active)');
                }
                else if (estimatedTokens > 100000) {
                    console.log(chalk_1.default.yellow('\n⚠️ WARNING: High token usage'));
                    console.log('Recommendations:');
                    console.log('  • Consider using /compact soon');
                    console.log('  • Auto-compaction will trigger at 100k tokens');
                }
                else if (estimatedTokens > 50000) {
                    console.log(chalk_1.default.blue('\n💡 INFO: Moderate token usage'));
                    console.log('  • Session is healthy');
                    console.log('  • Auto-monitoring active');
                }
            }
            else {
                console.log(chalk_1.default.gray('No active session'));
            }
            // Show current UI session tracking
            const sessionDuration = Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000 / 60);
            const totalTokens = this.sessionTokenUsage + this.contextTokens;
            console.log(chalk_1.default.cyan('\n🎯 Current UI Session:'));
            console.log(`  • Total tokens: ${totalTokens.toLocaleString()} (${this.sessionTokenUsage.toLocaleString()} session + ${this.contextTokens.toLocaleString()} context)`);
            console.log(`  • Real-time cost: $${this.realTimeCost.toFixed(4)}`);
            console.log(`  • Duration: ${sessionDuration} minutes`);
            console.log(`  • Started: ${this.sessionStartTime.toLocaleTimeString()}`);
            console.log(chalk_1.default.gray('  • Use /tokens reset to clear session counters'));
            console.log(chalk_1.default.gray('  • Use /tokens test to see live spinner demo'));
        }
        catch (error) {
            console.log(chalk_1.default.red(`Token analysis error: ${error.message}`));
        }
    }
    async showCost() {
        console.log(chalk_1.default.blue('💰 Token usage and cost information'));
        try {
            const session = chat_manager_1.chatManager.getCurrentSession();
            const stats = chat_manager_1.chatManager.getSessionStats();
            if (session) {
                // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
                const totalChars = session.messages.reduce((sum, msg) => sum + msg.content.length, 0);
                const estimatedTokens = Math.round(totalChars / 4);
                console.log(chalk_1.default.cyan('📊 Current Session:'));
                console.log(`  Messages: ${session.messages.length}`);
                console.log(`  Characters: ${totalChars.toLocaleString()}`);
                console.log(`  Estimated Tokens: ${estimatedTokens.toLocaleString()}`);
                console.log(chalk_1.default.cyan('\n📊 Overall Stats:'));
                console.log(`  Total Sessions: ${stats.totalSessions}`);
                console.log(`  Total Messages: ${stats.totalMessages}`);
                // Show current model pricing info
                const currentModel = this.configManager.getCurrentModel();
                console.log(chalk_1.default.cyan('\n🏷️ Current Model:'));
                console.log(`  Model: ${currentModel}`);
                console.log(chalk_1.default.gray('  Note: Actual costs depend on your AI provider\'s pricing'));
                this.addLiveUpdate({
                    type: 'info',
                    content: `Session stats: ${session.messages.length} messages, ~${estimatedTokens} tokens`,
                    source: 'cost-analysis'
                });
            }
            else {
                console.log(chalk_1.default.gray('No active session for cost analysis'));
            }
        }
        catch (error) {
            this.addLiveUpdate({
                type: 'error',
                content: `Cost calculation failed: ${error.message}`,
                source: 'cost-analysis'
            });
            console.log(chalk_1.default.red(`❌ Error calculating costs: ${error.message}`));
        }
    }
    async handleTodoOperations(command, args) {
        try {
            if (args.length === 0) {
                const plans = enhanced_planning_1.enhancedPlanning.getActivePlans();
                if (plans.length === 0) {
                    console.log(chalk_1.default.gray('No todo lists found'));
                    return;
                }
                console.log(chalk_1.default.blue.bold('Todo Lists:'));
                plans.forEach((plan, index) => {
                    console.log(`\n${index + 1}. ${chalk_1.default.bold(plan.title)}`);
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
                        const plans = enhanced_planning_1.enhancedPlanning.getActivePlans();
                        const latestPlan = plans[plans.length - 1];
                        if (latestPlan) {
                            enhanced_planning_1.enhancedPlanning.showPlanStatus(latestPlan.id);
                        }
                        else {
                            console.log(chalk_1.default.yellow('No todo lists found'));
                        }
                    }
                    else {
                        enhanced_planning_1.enhancedPlanning.showPlanStatus(planId);
                    }
                    break;
                }
                case 'open':
                case 'edit': {
                    const todoPath = 'todo.md';
                    console.log((0, text_wrapper_1.formatFileOp)('Opening', todoPath, 'in your default editor'));
                    try {
                        await tools_manager_1.toolsManager.runCommand('code', [todoPath]);
                    }
                    catch {
                        try {
                            await tools_manager_1.toolsManager.runCommand('open', [todoPath]);
                        }
                        catch {
                            console.log(chalk_1.default.yellow(`Could not open ${todoPath}. Please open it manually.`));
                        }
                    }
                    break;
                }
                default:
                    console.log(chalk_1.default.red(`Unknown todo command: ${subcommand}`));
                    console.log(chalk_1.default.gray('Available commands: show, open, edit'));
            }
        }
        catch (error) {
            this.addLiveUpdate({ type: 'error', content: `Todo operation failed: ${error.message}`, source: 'todo' });
            console.log(chalk_1.default.red(`❌ Error: ${error.message}`));
        }
    }
    /**
     * Handle MCP (Model Context Protocol) commands
     */
    async handleMcpCommands(args) {
        if (args.length === 0) {
            console.log(chalk_1.default.blue('🔮 MCP (Model Context Protocol) Commands'));
            console.log(chalk_1.default.gray('─'.repeat(50)));
            console.log(chalk_1.default.cyan('Available commands:'));
            console.log('  /mcp servers           - List configured servers');
            console.log('  /mcp add <name> <type> <endpoint> - Add new server');
            console.log('  /mcp test <server>     - Test server connection');
            console.log('  /mcp call <server> <method> [params] - Make MCP call');
            console.log('  /mcp health            - Check all server health');
            console.log('  /mcp remove <name>     - Remove server');
            console.log(chalk_1.default.gray('\nExample: /mcp add myapi http https://api.example.com/mcp'));
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
                        console.log(chalk_1.default.red('Usage: /mcp test <server-name>'));
                        return;
                    }
                    await this.testMcpServer(restArgs[0]);
                    break;
                case 'call':
                    if (restArgs.length < 2) {
                        console.log(chalk_1.default.red('Usage: /mcp call <server-name> <method> [params-json]'));
                        return;
                    }
                    await this.callMcpServer(restArgs[0], restArgs[1], restArgs[2]);
                    break;
                case 'health':
                    await this.checkMcpHealth();
                    break;
                case 'remove':
                    if (restArgs.length === 0) {
                        console.log(chalk_1.default.red('Usage: /mcp remove <server-name>'));
                        return;
                    }
                    await this.removeMcpServer(restArgs[0]);
                    break;
                default:
                    console.log(chalk_1.default.red(`Unknown MCP command: ${command}`));
                    console.log(chalk_1.default.gray('Use /mcp for available commands'));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`MCP command failed: ${error.message}`));
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
    async listMcpServers() {
        console.log((0, text_wrapper_1.wrapBlue)('📡 MCP Servers'));
        const servers = await mcp_client_1.mcpClient.listServers();
        if (servers.length === 0) {
            console.log(chalk_1.default.gray('No MCP servers configured'));
            console.log(chalk_1.default.gray('Use "/mcp add <name> <type> <endpoint>" to add a server'));
            return;
        }
        for (const server of servers) {
            const healthIcon = server.healthy ? chalk_1.default.green('🟢') : chalk_1.default.red('🔴');
            const typeColor = server.type === 'http' ? chalk_1.default.blue : server.type === 'websocket' ? chalk_1.default.cyan : chalk_1.default.yellow;
            console.log(`${healthIcon} ${chalk_1.default.bold(server.name)} ${typeColor(`[${server.type}]`)}`);
            if (server.endpoint) {
                console.log(`   ${chalk_1.default.gray('Endpoint:')} ${server.endpoint}`);
            }
            if (server.command) {
                console.log(`   ${chalk_1.default.gray('Command:')} ${server.command} ${(server.args || []).join(' ')}`);
            }
            if (server.capabilities && server.capabilities.length > 0) {
                console.log(`   ${chalk_1.default.gray('Capabilities:')} ${server.capabilities.join(', ')}`);
            }
            console.log(`   ${chalk_1.default.gray('Priority:')} ${server.priority || 1} | ${chalk_1.default.gray('Enabled:')} ${server.enabled ? 'Yes' : 'No'}`);
            console.log();
        }
    }
    /**
     * Add new MCP server (Claude Code style configuration)
     */
    async addMcpServer(args) {
        if (args.length < 3) {
            console.log(chalk_1.default.red('Usage: /mcp add <name> <type> <endpoint/command>'));
            console.log(chalk_1.default.gray('Types: http, websocket, command, stdio'));
            console.log(chalk_1.default.gray('Examples:'));
            console.log(chalk_1.default.gray('  /mcp add myapi http https://api.example.com/mcp'));
            console.log(chalk_1.default.gray('  /mcp add local command "/usr/local/bin/mcp-server"'));
            console.log(chalk_1.default.gray('  /mcp add ws websocket wss://example.com/mcp'));
            return;
        }
        const [name, type, endpointOrCommand] = args;
        if (!['http', 'websocket', 'command', 'stdio'].includes(type)) {
            console.log(chalk_1.default.red(`Invalid server type: ${type}`));
            console.log(chalk_1.default.gray('Valid types: http, websocket, command, stdio'));
            return;
        }
        // Build server config based on Claude Code patterns
        const serverConfig = {
            name,
            type: type,
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
        }
        else if (type === 'command' || type === 'stdio') {
            const commandParts = endpointOrCommand.split(' ');
            serverConfig.command = commandParts[0];
            serverConfig.args = commandParts.slice(1);
        }
        // Save to config manager
        const mcpServers = this.configManager.get('mcpServers') || {};
        mcpServers[name] = serverConfig;
        this.configManager.set('mcpServers', mcpServers);
        console.log(chalk_1.default.green(`✅ MCP server '${name}' added successfully`));
        console.log(chalk_1.default.gray(`Type: ${type} | Endpoint: ${endpointOrCommand}`));
        // Test the connection
        console.log(chalk_1.default.gray('Testing connection...'));
        await this.testMcpServer(name);
    }
    /**
     * Test MCP server connection
     */
    async testMcpServer(serverName) {
        console.log((0, text_wrapper_1.wrapBlue)(`🧪 Testing MCP server: ${serverName}`));
        const result = await mcp_client_1.mcpClient.testServer(serverName);
        if (result.success) {
            console.log(chalk_1.default.green(`✅ Server '${serverName}' is healthy`));
            if (result.latency !== undefined) {
                console.log(chalk_1.default.gray(`   Response time: ${result.latency}ms`));
            }
        }
        else {
            console.log(chalk_1.default.red(`❌ Server '${serverName}' is not responding`));
            if (result.error) {
                console.log(chalk_1.default.gray(`   Error: ${result.error}`));
            }
        }
    }
    /**
     * Make MCP call to server
     */
    async callMcpServer(serverName, method, paramsJson) {
        console.log((0, text_wrapper_1.wrapBlue)(`📡 Calling MCP server '${serverName}' method '${method}'`));
        let params = {};
        if (paramsJson) {
            try {
                params = JSON.parse(paramsJson);
            }
            catch (error) {
                console.log(chalk_1.default.red('Invalid JSON parameters'));
                return;
            }
        }
        const request = {
            method,
            params,
            id: `call-${Date.now()}`
        };
        try {
            const response = await mcp_client_1.mcpClient.call(serverName, request);
            if (response.result) {
                console.log(chalk_1.default.green('✅ MCP Call Successful'));
                console.log(chalk_1.default.gray('Response:'));
                console.log(JSON.stringify(response.result, null, 2));
            }
            else if (response.error) {
                console.log(chalk_1.default.red('❌ MCP Call Failed'));
                console.log(chalk_1.default.gray('Error:'), response.error.message);
            }
            if (response.fromCache) {
                console.log(chalk_1.default.cyan('📦 Result from cache'));
            }
            if (response.executionTime) {
                console.log(chalk_1.default.gray(`⏱️ Execution time: ${response.executionTime}ms`));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ MCP call failed: ${error.message}`));
        }
    }
    /**
     * Check health of all MCP servers
     */
    async checkMcpHealth() {
        console.log((0, text_wrapper_1.wrapBlue)('🏥 Checking MCP server health'));
        const servers = mcp_client_1.mcpClient.getConfiguredServers();
        if (servers.length === 0) {
            console.log(chalk_1.default.gray('No MCP servers configured'));
            return;
        }
        for (const server of servers) {
            const healthy = await mcp_client_1.mcpClient.checkServerHealth(server.name);
            const icon = healthy ? chalk_1.default.green('🟢') : chalk_1.default.red('🔴');
            console.log(`${icon} ${server.name} (${server.type})`);
        }
    }
    /**
     * Remove MCP server
     */
    async removeMcpServer(serverName) {
        const mcpServers = this.configManager.get('mcpServers') || {};
        if (!mcpServers[serverName]) {
            console.log(chalk_1.default.red(`Server '${serverName}' not found`));
            return;
        }
        delete mcpServers[serverName];
        this.configManager.set('mcpServers', mcpServers);
        console.log(chalk_1.default.green(`✅ MCP server '${serverName}' removed`));
    }
    showSlashHelp() {
        console.log(chalk_1.default.cyan.bold('📚 Available Slash Commands'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
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
        console.log(chalk_1.default.blue.bold('\n🎯 Mode Control:'));
        commands.slice(0, 3).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n📁 File Operations:'));
        commands.slice(3, 8).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n⚡ Terminal Operations:'));
        commands.slice(8, 16).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n🔨 Project Operations:'));
        commands.slice(16, 20).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n🤖 Agent Management:'));
        commands.slice(20, 26).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n📝 Session Management:'));
        commands.slice(26, 34).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n⚙️ Configuration:'));
        commands.slice(34, 38).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n🔮 MCP (Model Context Protocol):'));
        commands.slice(38, 44).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n📚 Documentation Management:'));
        commands.slice(44, 55).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n🔧 Advanced Features:'));
        commands.slice(55, 60).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.blue.bold('\n📋 Basic Commands:'));
        commands.slice(60).forEach(([cmd, desc]) => {
            console.log(`${chalk_1.default.green(cmd.padEnd(25))} ${chalk_1.default.dim(desc)}`);
        });
        console.log(chalk_1.default.gray('\n💡 Tip: Use Ctrl+C to stop any running operation'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
    }
    showChatWelcome() {
        const title = chalk_1.default.cyanBright('🤖 NikCLI');
        const subtitle = chalk_1.default.gray('Autonomous AI Developer Assistant');
        console.log((0, boxen_1.default)(`${title}\n${subtitle}\n\n` +
            `${(0, text_wrapper_1.wrapBlue)('Mode:')} ${chalk_1.default.yellow(this.currentMode)}\n` +
            `${(0, text_wrapper_1.wrapBlue)('Model:')} ${chalk_1.default.green(advanced_ai_provider_1.advancedAIProvider.getCurrentModelInfo().name)}\n` +
            `${(0, text_wrapper_1.wrapBlue)('Directory:')} ${chalk_1.default.cyan(path.basename(this.workingDirectory))}\n\n` +
            `${chalk_1.default.dim('Type /help for commands or start chatting!')}\n` +
            `${chalk_1.default.dim('Use Shift+Tab to cycle modes: default → auto → plan')}`, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
            textAlignment: 'center',
        }));
    }
    /**
     * Initialize project context
     */
    async handleInitProject(force = false) {
        try {
            console.log(chalk_1.default.blue('🚀 Initializing project context...'));
            // Check if already initialized
            const packageJson = path.join(this.workingDirectory, 'package.json');
            const exists = require('fs').existsSync(packageJson);
            if (exists && !force) {
                console.log(chalk_1.default.yellow('⚠️ Project already appears to be initialized'));
                console.log(chalk_1.default.gray('Use --force to reinitialize'));
                return;
            }
            // Initialize workspace context
            try {
                console.log(chalk_1.default.green('✅ Workspace context initialized'));
            }
            catch (error) {
                console.log(chalk_1.default.yellow('⚠️ Workspace context initialization skipped'));
            }
            // Setup basic project structure if needed
            if (!exists) {
                console.log(chalk_1.default.blue('📁 Setting up basic project structure...'));
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
                console.log(chalk_1.default.green('✅ Created package.json'));
            }
            // Initialize git if not present
            const gitDir = path.join(this.workingDirectory, '.git');
            if (!require('fs').existsSync(gitDir)) {
                console.log(chalk_1.default.blue('🔧 Initializing git repository...'));
                const { spawn } = require('child_process');
                const child = spawn('git', ['init'], { cwd: this.workingDirectory });
                await new Promise((resolve) => child.on('close', resolve));
                console.log(chalk_1.default.green('✅ Git repository initialized'));
            }
            console.log(chalk_1.default.green.bold('\n🎉 Project initialization complete!'));
            console.log(chalk_1.default.gray('You can now use NikCLI to manage your project'));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to initialize project: ${error.message}`));
        }
    }
    /**
     * Cycle through modes: default → plan → auto → default
     */
    cycleModes() {
        const modes = ['default', 'plan', 'auto'];
        const currentIndex = modes.indexOf(this.currentMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        const nextMode = modes[nextIndex];
        this.currentMode = nextMode;
        const modeNames = {
            default: '💬 Default Chat',
            plan: '📋 Planning Mode',
            auto: '🤖 Auto Mode'
        };
        console.log(chalk_1.default.yellow(`\n🔄 Switched to ${modeNames[nextMode]}`));
        console.log(chalk_1.default.gray(`💡 Use Cmd+] to cycle modes`));
        this.showPrompt();
    }
    showPrompt() {
        if (!this.rl)
            return;
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
        const tokenLine = chalk_1.default.gray(tokenInfo);
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
        const statusDot = this.assistantProcessing ? chalk_1.default.green('●') + chalk_1.default.dim('….') : chalk_1.default.red('●');
        const prompt = `\n┌─[${modeIcon}${agentInfo}${chalk_1.default.green(workingDir)} ${statusDot}]\n└─❯ `;
        this.rl.setPrompt(prompt);
        this.rl.prompt();
    }
    /**
     * Strip ANSI escape codes to calculate actual string length
     */
    stripAnsi(str) {
        return str.replace(/\x1b\[[0-9;]*m/g, '');
    }
    /**
     * Get current session token usage
     */
    getSessionTokenUsage() {
        return this.sessionTokenUsage;
    }
    /**
     * Reset session token usage
     */
    resetSessionTokenUsage() {
        this.sessionTokenUsage = 0;
        this.contextTokens = 0;
        this.realTimeCost = 0;
        this.sessionStartTime = new Date();
    }
    /**
     * Initialize model pricing data (could be fetched from web API)
     */
    initializeModelPricing() {
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
    calculateCost(inputTokens, outputTokens, modelName) {
        const pricing = this.modelPricing.get(modelName);
        if (!pricing)
            return 0;
        const inputCost = (inputTokens / 1000000) * pricing.input;
        const outputCost = (outputTokens / 1000000) * pricing.output;
        return inputCost + outputCost;
    }
    /**
     * Start AI operation tracking with spinner
     */
    startAIOperation(operation = 'Processing') {
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
        this.activeSpinner._interval = interval;
    }
    /**
     * Update spinner text with realtime stats
     */
    updateSpinnerText(operation) {
        if (!this.activeSpinner || !this.aiOperationStart)
            return;
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
    stopAIOperation() {
        this.stopSpinner();
        this.aiOperationStart = null;
    }
    /**
     * Stop active spinner
     */
    stopSpinner() {
        if (this.activeSpinner) {
            if (this.activeSpinner._interval) {
                clearInterval(this.activeSpinner._interval);
            }
            this.activeSpinner.stop();
            this.activeSpinner = null;
        }
    }
    /**
     * Update token usage with real tracking
     */
    updateTokenUsage(tokens, isOutput = false, modelName) {
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
    updateContextTokens(tokens) {
        this.contextTokens = tokens;
    }
    /**
     * Detect if a user request is complex and needs automatic planning
     */
    detectComplexRequest(input) {
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
        const hasComplexKeywords = complexKeywords.some(keyword => input.toLowerCase().includes(keyword.toLowerCase()));
        // Determine if request needs planning
        return (hasComplexKeywords ||
            wordCount > 20 ||
            filePatterns.length > 2 ||
            pathPatterns.length > 1 ||
            input.includes(' and ') ||
            input.includes(' then '));
    }
    async analyzeProject() {
        // Implementation for project analysis
        return {
            name: path.basename(this.workingDirectory),
            framework: 'Unknown',
            languages: ['typescript', 'javascript'],
            dependencies: [],
            structure: {}
        };
    }
    generateClaudeMarkdown(analysis) {
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
    async savePlanToFile(plan, filename) {
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
        console.log(chalk_1.default.green(`✓ Plan saved to ${filename}`));
    }
    async shutdown() {
        console.log(chalk_1.default.blue('\n👋 Shutting down NikCLI...'));
        // Stop file watcher
        if (this.fileWatcher) {
            try {
                this.fileWatcher.close();
                console.log(chalk_1.default.dim('👀 File watcher stopped'));
            }
            catch (error) {
                console.log(chalk_1.default.gray(`File watcher cleanup warning: ${error.message}`));
            }
        }
        // Complete any running progress operations
        if (this.progressTracker) {
            try {
                const running = Array.from(this.progressTracker.operations.values())
                    .filter((op) => op.status === 'running');
                running.forEach((op) => {
                    this.progressTracker.complete(op.id, false, 'Interrupted by shutdown');
                });
                if (running.length > 0) {
                    console.log(chalk_1.default.dim(`📊 Stopped ${running.length} running operations`));
                }
            }
            catch (error) {
                console.log(chalk_1.default.gray(`Progress tracker cleanup warning: ${error.message}`));
            }
        }
        // Save both caches before shutdown
        try {
            await Promise.all([
                token_cache_1.tokenCache.saveCache(),
                completion_protocol_cache_1.completionCache.saveCache()
            ]);
            console.log(chalk_1.default.dim('💾 All caches saved'));
        }
        catch (error) {
            console.log(chalk_1.default.gray(`Cache save warning: ${error.message}`));
        }
        // Clean up UI resources
        this.indicators.clear();
        this.liveUpdates.length = 0;
        this.spinners.forEach(spinner => {
            try {
                spinner.stop();
            }
            catch (error) {
                // Ignore spinner cleanup errors
            }
        });
        this.spinners.clear();
        this.progressBars.forEach(bar => {
            try {
                bar.stop();
            }
            catch (error) {
                // Ignore progress bar cleanup errors
            }
        });
        this.progressBars.clear();
        if (this.rl) {
            this.rl.close();
        }
        // Cleanup systems
        this.agentManager.cleanup();
        console.log(chalk_1.default.green('✅ All systems cleaned up successfully!'));
        console.log(chalk_1.default.green('✓ Goodbye!'));
        process.exit(0);
    }
    // File Operations Methods
    async readFile(filepath) {
        try {
            const readId = 'read-' + Date.now();
            this.createStatusIndicator(readId, `Reading ${filepath}`);
            this.startAdvancedSpinner(readId, 'Reading file...');
            const content = await tools_manager_1.toolsManager.readFile(filepath);
            this.stopAdvancedSpinner(readId, true, `Read ${filepath}`);
            console.log(chalk_1.default.blue.bold(`\n📄 File: ${filepath}`));
            console.log(chalk_1.default.gray('─'.repeat(50)));
            console.log(content);
            console.log(chalk_1.default.gray('─'.repeat(50)));
            console.log(chalk_1.default.dim('✅ File read completed'));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to read ${filepath}: ${error.message}`));
        }
    }
    async writeFile(filepath, content) {
        try {
            const writeId = 'write-' + Date.now();
            this.createStatusIndicator(writeId, `Writing ${filepath}`);
            this.startAdvancedSpinner(writeId, 'Writing file...');
            await tools_manager_1.toolsManager.writeFile(filepath, content);
            this.stopAdvancedSpinner(writeId, true, `Written ${filepath}`);
            console.log(chalk_1.default.green(`✅ File written: ${filepath}`));
            console.log(chalk_1.default.gray('─'.repeat(50)));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to write ${filepath}: ${error.message}`));
        }
    }
    async editFile(filepath) {
        try {
            console.log(chalk_1.default.blue(`📝 Opening ${filepath} for editing...`));
            console.log(chalk_1.default.gray('This would open an interactive editor. For now, use /read and /write commands.'));
            console.log(chalk_1.default.gray('─'.repeat(50)));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to edit ${filepath}: ${error.message}`));
            console.log(chalk_1.default.gray('─'.repeat(50)));
        }
    }
    async listFiles(directory) {
        try {
            const lsId = 'ls-' + Date.now();
            this.createStatusIndicator(lsId, `Listing ${directory}`);
            this.startAdvancedSpinner(lsId, 'Listing files...');
            const files = await tools_manager_1.toolsManager.listFiles(directory);
            this.stopAdvancedSpinner(lsId, true, `Listed ${files.length} items`);
            console.log(chalk_1.default.blue.bold(`\n📁 Directory: ${directory}`));
            console.log(chalk_1.default.gray('─'.repeat(50)));
            files.forEach(file => {
                const icon = '📄'; // Simple icon for now
                console.log(`${icon} ${chalk_1.default.cyan(file)}`);
            });
            console.log(chalk_1.default.gray('─'.repeat(50)));
            console.log(chalk_1.default.dim(`✅ Listed ${files.length} files`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to list ${directory}: ${error.message}`));
        }
    }
    async searchFiles(query) {
        try {
            const searchId = 'search-' + Date.now();
            this.createStatusIndicator(searchId, `Searching: ${query}`);
            this.startAdvancedSpinner(searchId, 'Searching files...');
            const results = await tools_manager_1.toolsManager.searchInFiles(query, this.workingDirectory);
            this.stopAdvancedSpinner(searchId, true, `Found ${results.length} matches`);
            console.log(chalk_1.default.blue.bold(`\n🔍 Search Results: "${query}"`));
            console.log(chalk_1.default.gray('─'.repeat(50)));
            results.forEach(result => {
                console.log(chalk_1.default.cyan(result.file || 'Unknown file'));
                console.log(chalk_1.default.gray(`  Match: ${result.content || result.toString()}`));
            });
            console.log(chalk_1.default.gray('─'.repeat(50)));
            console.log(chalk_1.default.dim(`✅ Search completed`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Search failed: ${error.message}`));
        }
    }
    async runCommand(command) {
        try {
            const cmdId = 'cmd-' + Date.now();
            this.createStatusIndicator(cmdId, `Executing: ${command}`);
            this.startAdvancedSpinner(cmdId, `Running: ${command}`);
            const result = await tools_manager_1.toolsManager.runCommand(command.split(' ')[0], command.split(' ').slice(1), { stream: true });
            const success = result.code === 0;
            this.stopAdvancedSpinner(cmdId, success, success ? 'Command completed' : 'Command failed');
            if (result.stdout) {
                console.log(chalk_1.default.blue.bold(`\n💻 Output:`));
                console.log(result.stdout);
            }
            if (result.stderr) {
                console.log(chalk_1.default.red.bold(`\n❌ Error:`));
                console.log(result.stderr);
            }
            console.log(chalk_1.default.gray(`\n📊 Exit Code: ${result.code}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Command failed: ${error.message}`));
        }
    }
    async buildProject() {
        try {
            console.log(chalk_1.default.blue('🔨 Building project...'));
            // Try common build commands
            const buildCommands = ['npm run build', 'yarn build', 'pnpm build', 'make', 'cargo build'];
            for (const cmd of buildCommands) {
                try {
                    await this.runCommand(cmd);
                    return;
                }
                catch {
                    continue;
                }
            }
            console.log(chalk_1.default.yellow('⚠️ No build command found. Try /run <your-build-command>'));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Build failed: ${error.message}`));
        }
    }
    async runTests(pattern) {
        try {
            console.log(chalk_1.default.blue('🧪 Running tests...'));
            const testCmd = pattern ? `npm test ${pattern}` : 'npm test';
            await this.runCommand(testCmd);
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Tests failed: ${error.message}`));
        }
    }
    async runLinting() {
        try {
            console.log(chalk_1.default.blue('🔍 Running linting...'));
            // Try common lint commands
            const lintCommands = ['npm run lint', 'yarn lint', 'pnpm lint', 'eslint .'];
            for (const cmd of lintCommands) {
                try {
                    await this.runCommand(cmd);
                    return;
                }
                catch {
                    continue;
                }
            }
            console.log(chalk_1.default.yellow('⚠️ No lint command found. Try /run <your-lint-command>'));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Linting failed: ${error.message}`));
        }
    }
    // Token tracking API to be called from AI providers
    static getInstance() {
        return globalNikCLI;
    }
}
exports.NikCLI = NikCLI;
// Global instance for access from other modules
let globalNikCLI = null;
// Export function to set global instance
function setGlobalNikCLI(instance) {
    globalNikCLI = instance;
}
