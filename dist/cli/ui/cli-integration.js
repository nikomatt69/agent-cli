"use strict";
/**
 * CLI Integration for TUI
 * Connects the TUI with the existing CLI agent system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLITUIIntegration = void 0;
const index_1 = require("./index");
const logger_1 = require("../core/logger");
const config_manager_1 = require("../config/config-manager");
class CLITUIIntegration {
    constructor() {
        this.logger = new logger_1.Logger('CLI-TUI');
        this.config = new config_manager_1.ConfigManager();
        this.tui = new index_1.TUI();
        this.setupIntegration();
    }
    /**
     * Setup integration between CLI and TUI
     */
    setupIntegration() {
        const app = this.tui.getApp();
        // Handle TUI commands
        app.on('command', (command, args) => {
            this.handleTUICommand(command, args);
        });
        // Handle agent actions
        app.getMainLayout().getAgentPanel().on('agent-started', (agent, task) => {
            this.logger.info(`Agent ${agent.name} started with task ${task.id}`);
        });
        app.getMainLayout().getAgentPanel().on('agent-stopped', (agent) => {
            this.logger.info(`Agent ${agent.name} stopped`);
        });
        // Handle file operations
        app.getMainLayout().getSidebarPanel().on('file-select', (fileData) => {
            this.logger.info(`File selected: ${fileData.path}`);
            // Load file content into content panel
            app.getMainLayout().getContentPanel().openFile(fileData.path);
        });
        // Handle agent selection
        app.getMainLayout().getSidebarPanel().on('agent-select', (agentData) => {
            this.logger.info(`Agent selected: ${agentData.item}`);
        });
    }
    /**
     * Handle commands from the TUI
     */
    async handleTUICommand(command, args) {
        try {
            this.logger.info(`Executing TUI command: ${command}`, args);
            switch (command) {
                case 'agent:list':
                    await this.listAgents();
                    break;
                case 'agent:run':
                    await this.runAgent(args?.[0]);
                    break;
                case 'project:analyze':
                    await this.analyzeProject();
                    break;
                case 'file:open':
                    await this.openFile(args?.[0]);
                    break;
                case 'file:create':
                    await this.createFile(args?.[0]);
                    break;
                case 'config:edit':
                    await this.editConfig();
                    break;
                case 'theme:switch':
                    await this.switchTheme();
                    break;
                case 'layout:default':
                    this.setLayout('default');
                    break;
                case 'layout:agent-focused':
                    this.setLayout('agent-focused');
                    break;
                case 'layout:code-focused':
                    this.setLayout('code-focused');
                    break;
                case 'help:shortcuts':
                    this.showHelp();
                    break;
                case 'help:about':
                    this.showAbout();
                    break;
                default:
                    this.logger.warn(`Unknown command: ${command}`);
                    this.showNotification('error', 'Unknown Command', `Command '${command}' not recognized`);
            }
        }
        catch (error) {
            this.logger.error(`Command execution failed: ${command}`, error);
            this.showNotification('error', 'Command Failed', `Failed to execute '${command}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * List available agents
     */
    async listAgents() {
        // Mock implementation - in real app, this would query the agent registry
        const agents = [
            { name: 'Code Analyzer', status: 'idle', description: 'Analyzes code structure' },
            { name: 'Test Runner', status: 'idle', description: 'Runs tests' },
            { name: 'Documentation Generator', status: 'running', description: 'Generates docs' }
        ];
        this.showNotification('info', 'Available Agents', `Found ${agents.length} agents`);
        // Update agent panel
        const agentPanel = this.tui.getApp().getMainLayout().getAgentPanel();
        await agentPanel.loadAgents();
    }
    /**
     * Run an agent
     */
    async runAgent(agentId) {
        if (!agentId) {
            this.showNotification('warning', 'No Agent Selected', 'Please select an agent to run');
            return;
        }
        this.logger.info(`Running agent: ${agentId}`);
        this.showNotification('info', 'Agent Started', `Running agent: ${agentId}`);
        // Mock agent execution
        setTimeout(() => {
            this.showNotification('success', 'Agent Completed', `Agent ${agentId} completed successfully`);
        }, 3000);
    }
    /**
     * Analyze current project
     */
    async analyzeProject() {
        this.logger.info('Starting project analysis...');
        this.showNotification('info', 'Project Analysis', 'Analyzing project structure...');
        // Mock analysis
        setTimeout(() => {
            this.showNotification('success', 'Analysis Complete', 'Project analysis completed successfully');
        }, 2000);
    }
    /**
     * Open a file
     */
    async openFile(filePath) {
        if (!filePath) {
            // In a real implementation, this would show a file picker
            filePath = '/example/file.ts';
        }
        const contentPanel = this.tui.getApp().getMainLayout().getContentPanel();
        await contentPanel.openFile(filePath);
        this.showNotification('info', 'File Opened', `Opened: ${filePath}`);
    }
    /**
     * Create a new file
     */
    async createFile(fileName) {
        const contentPanel = this.tui.getApp().getMainLayout().getContentPanel();
        const newFileName = fileName || `untitled-${Date.now()}.txt`;
        await contentPanel.openFile(newFileName, '');
        this.showNotification('info', 'File Created', `Created: ${newFileName}`);
    }
    /**
     * Edit configuration
     */
    async editConfig() {
        this.showNotification('info', 'Configuration', 'Opening configuration editor...');
        // In a real implementation, this would open config in the content panel
    }
    /**
     * Switch theme
     */
    async switchTheme() {
        const themeManager = this.tui.getApp().getMainLayout().getAgentPanel();
        // Cycle to next theme
        this.showNotification('info', 'Theme Changed', 'Switched to next theme');
    }
    /**
     * Set layout mode
     */
    setLayout(mode) {
        const mainLayout = this.tui.getApp().getMainLayout();
        mainLayout.setLayoutMode(mode);
        this.showNotification('info', 'Layout Changed', `Switched to ${mode} layout`);
    }
    /**
     * Show help
     */
    showHelp() {
        const helpText = `
Enterprise AI Agents CLI - Keyboard Shortcuts

Global:
  Ctrl+P    - Command Palette
  Ctrl+N    - Next Notification
  Ctrl+R    - Refresh
  F1        - Help
  Esc/Q     - Exit

Navigation:
  Tab       - Switch Panels
  Ctrl+1-4  - Layout Modes

File Operations:
  Ctrl+O    - Open File
  Ctrl+N    - New File
  Ctrl+S    - Save File
  Ctrl+W    - Close File

Agent Operations:
  Enter     - Run Selected Agent
  Space     - Stop Agent
  C         - Configure Agent
  R         - Refresh Agents
    `;
        this.showNotification('info', 'Help - Keyboard Shortcuts', helpText.trim());
    }
    /**
     * Show about information
     */
    showAbout() {
        const aboutText = `
Enterprise AI Agents CLI
Version: 1.0.0

A powerful CLI tool with parallel AI agents using TypeScript.
Features modern TUI interface with agent management,
code editing, and project analysis capabilities.

Built with:
- TypeScript
- Blessed (Terminal UI)
- Node.js
- AI SDK
    `;
        this.showNotification('info', 'About', aboutText.trim());
    }
    /**
     * Show notification in TUI
     */
    showNotification(type, title, message) {
        const notificationManager = this.tui.getApp().getNotificationManager();
        switch (type) {
            case 'success':
                notificationManager.showSuccess(title, message);
                break;
            case 'warning':
                notificationManager.showWarning(title, message);
                break;
            case 'error':
                notificationManager.showError(title, message);
                break;
            case 'info':
            default:
                notificationManager.showInfo(title, message);
                break;
        }
    }
    /**
     * Start the TUI
     */
    async start() {
        try {
            this.logger.info('Starting CLI-TUI Integration...');
            await this.tui.start();
        }
        catch (error) {
            this.logger.error('Failed to start TUI:', error);
            throw error;
        }
    }
    /**
     * Stop the TUI
     */
    async stop() {
        try {
            this.logger.info('Stopping CLI-TUI Integration...');
            await this.tui.stop();
        }
        catch (error) {
            this.logger.error('Failed to stop TUI:', error);
            throw error;
        }
    }
    /**
     * Get TUI instance
     */
    getTUI() {
        return this.tui;
    }
}
exports.CLITUIIntegration = CLITUIIntegration;
// Export for use in CLI
exports.default = CLITUIIntegration;
