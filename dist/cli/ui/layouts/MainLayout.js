"use strict";
/**
 * Main Layout Component
 * Manages the primary content area with panels and navigation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainLayout = void 0;
const blessed_1 = __importDefault(require("blessed"));
const events_1 = require("events");
const SidebarPanel_1 = require("../components/SidebarPanel");
const ContentPanel_1 = require("../components/ContentPanel");
const AgentPanel_1 = require("../components/AgentPanel");
const LogPanel_1 = require("../components/LogPanel");
class MainLayout extends events_1.EventEmitter {
    constructor(screen, config, logger) {
        super();
        this.currentMode = 'default';
        this.focusedPanel = 'sidebar';
        this.screen = screen;
        this.config = config;
        this.logger = logger;
        this.createLayout();
        this.setupEventHandlers();
    }
    focus() {
        throw new Error('Method not implemented.');
    }
    blur() {
        throw new Error('Method not implemented.');
    }
    /**
     * Create the main layout structure
     */
    createLayout() {
        // Main container
        this.container = blessed_1.default.box({
            parent: this.screen,
            top: 0,
            left: 0,
            width: '100%',
            height: '100%-1', // Leave space for status bar
            border: 'line',
            style: {
                border: {
                    fg: 'cyan'
                }
            }
        });
        // Initialize panels
        this.createPanels();
        this.arrangeLayout();
    }
    /**
     * Create all panels
     */
    createPanels() {
        // Sidebar panel (left side)
        this.sidebarPanel = new SidebarPanel_1.SidebarPanel(this.container, this.config, this.logger);
        // Content panel (center)
        this.contentPanel = new ContentPanel_1.ContentPanel(this.container, this.config, this.logger);
        // Agent panel (right side)
        this.agentPanel = new AgentPanel_1.AgentPanel(this.container, this.config, this.logger);
        // Log panel (bottom)
        this.logPanel = new LogPanel_1.LogPanel(this.container, this.config, this.logger);
    }
    /**
     * Arrange panels according to current layout mode
     */
    arrangeLayout() {
        switch (this.currentMode) {
            case 'default':
                this.arrangeDefaultLayout();
                break;
            case 'agent-focused':
                this.arrangeAgentFocusedLayout();
                break;
            case 'code-focused':
                this.arrangeCodeFocusedLayout();
                break;
            case 'logs-focused':
                this.arrangeLogsFocusedLayout();
                break;
        }
    }
    /**
     * Default layout: sidebar | content | agent
     *                 -------- logs --------
     */
    arrangeDefaultLayout() {
        // Sidebar (25% width, 70% height)
        this.sidebarPanel.setPosition({
            top: 0,
            left: 0,
            width: '25%',
            height: '70%'
        });
        // Content panel (50% width, 70% height)
        this.contentPanel.setPosition({
            top: 0,
            left: '25%',
            width: '50%',
            height: '70%'
        });
        // Agent panel (25% width, 70% height)
        this.agentPanel.setPosition({
            top: 0,
            left: '75%',
            width: '25%',
            height: '70%'
        });
        // Log panel (100% width, 30% height)
        this.logPanel.setPosition({
            top: '70%',
            left: 0,
            width: '100%',
            height: '30%'
        });
    }
    /**
     * Agent-focused layout: sidebar | content | AGENT
     *                      -------- logs --------
     */
    arrangeAgentFocusedLayout() {
        this.sidebarPanel.setPosition({
            top: 0,
            left: 0,
            width: '20%',
            height: '70%'
        });
        this.contentPanel.setPosition({
            top: 0,
            left: '20%',
            width: '40%',
            height: '70%'
        });
        this.agentPanel.setPosition({
            top: 0,
            left: '60%',
            width: '40%',
            height: '70%'
        });
        this.logPanel.setPosition({
            top: '70%',
            left: 0,
            width: '100%',
            height: '30%'
        });
    }
    /**
     * Code-focused layout: sidebar | CONTENT | agent
     *                     -------- logs --------
     */
    arrangeCodeFocusedLayout() {
        this.sidebarPanel.setPosition({
            top: 0,
            left: 0,
            width: '20%',
            height: '70%'
        });
        this.contentPanel.setPosition({
            top: 0,
            left: '20%',
            width: '60%',
            height: '70%'
        });
        this.agentPanel.setPosition({
            top: 0,
            left: '80%',
            width: '20%',
            height: '70%'
        });
        this.logPanel.setPosition({
            top: '70%',
            left: 0,
            width: '100%',
            height: '30%'
        });
    }
    /**
     * Logs-focused layout: sidebar | content | agent
     *                     -------- LOGS --------
     */
    arrangeLogsFocusedLayout() {
        this.sidebarPanel.setPosition({
            top: 0,
            left: 0,
            width: '25%',
            height: '50%'
        });
        this.contentPanel.setPosition({
            top: 0,
            left: '25%',
            width: '50%',
            height: '50%'
        });
        this.agentPanel.setPosition({
            top: 0,
            left: '75%',
            width: '25%',
            height: '50%'
        });
        this.logPanel.setPosition({
            top: '50%',
            left: 0,
            width: '100%',
            height: '50%'
        });
    }
    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Panel navigation
        this.screen.key(['tab'], () => {
            this.switchToNextPanel();
        });
        this.screen.key(['S-tab'], () => {
            this.switchToPreviousPanel();
        });
        // Layout mode switching
        this.screen.key(['C-1'], () => {
            this.setLayoutMode('default');
        });
        this.screen.key(['C-2'], () => {
            this.setLayoutMode('agent-focused');
        });
        this.screen.key(['C-3'], () => {
            this.setLayoutMode('code-focused');
        });
        this.screen.key(['C-4'], () => {
            this.setLayoutMode('logs-focused');
        });
        // Panel event forwarding
        this.sidebarPanel.on('select', (item) => {
            this.emit('sidebar-select', item);
        });
        this.contentPanel.on('edit', (content) => {
            this.emit('content-edit', content);
        });
        this.agentPanel.on('agent-action', (action, data) => {
            this.emit('agent-action', action, data);
        });
        this.logPanel.on('log-filter', (filter) => {
            this.emit('log-filter', filter);
        });
    }
    /**
     * Initialize all panels
     */
    async initialize() {
        this.logger.info('Initializing MainLayout...');
        await Promise.all([
            this.sidebarPanel.initialize(),
            this.contentPanel.initialize(),
            this.agentPanel.initialize(),
            this.logPanel.initialize()
        ]);
        // Set initial focus
        this.setFocus('sidebar');
        this.logger.info('MainLayout initialized successfully');
    }
    /**
     * Cleanup all panels
     */
    async cleanup() {
        this.logger.info('Cleaning up MainLayout...');
        await Promise.all([
            this.sidebarPanel.cleanup(),
            this.contentPanel.cleanup(),
            this.agentPanel.cleanup(),
            this.logPanel.cleanup()
        ]);
        this.logger.info('MainLayout cleaned up successfully');
    }
    /**
     * Switch to the next panel
     */
    switchToNextPanel() {
        const panels = ['sidebar', 'content', 'agent', 'log'];
        const currentIndex = panels.indexOf(this.focusedPanel);
        const nextIndex = (currentIndex + 1) % panels.length;
        this.setFocus(panels[nextIndex]);
    }
    /**
     * Switch to the previous panel
     */
    switchToPreviousPanel() {
        const panels = ['sidebar', 'content', 'agent', 'log'];
        const currentIndex = panels.indexOf(this.focusedPanel);
        const prevIndex = (currentIndex - 1 + panels.length) % panels.length;
        this.setFocus(panels[prevIndex]);
    }
    /**
     * Set focus to a specific panel
     */
    setFocus(panel) {
        // Remove focus from current panel
        this.removeFocusFromAll();
        // Set focus to new panel
        this.focusedPanel = panel;
        switch (panel) {
            case 'sidebar':
                this.sidebarPanel.focus();
                break;
            case 'content':
                this.contentPanel.focus();
                break;
            case 'agent':
                this.agentPanel.focus();
                break;
            case 'log':
                this.logPanel.focus();
                break;
        }
        this.emit('focus-changed', panel);
        this.screen.render();
    }
    /**
     * Remove focus from all panels
     */
    removeFocusFromAll() {
        this.sidebarPanel.blur();
        this.contentPanel.blur();
        this.agentPanel.blur();
        this.logPanel.blur();
    }
    /**
     * Set layout mode
     */
    setLayoutMode(mode) {
        if (this.currentMode === mode)
            return;
        this.logger.info(`Switching layout mode from ${this.currentMode} to ${mode}`);
        this.currentMode = mode;
        this.arrangeLayout();
        this.screen.render();
        this.emit('layout-changed', mode);
    }
    /**
     * Get current layout mode
     */
    getLayoutMode() {
        return this.currentMode;
    }
    /**
     * Handle window resize
     */
    handleResize() {
        this.arrangeLayout();
        this.sidebarPanel.handleResize();
        this.contentPanel.handleResize();
        this.agentPanel.handleResize();
        this.logPanel.handleResize();
    }
    /**
     * Refresh all panels
     */
    refresh() {
        this.sidebarPanel.refresh();
        this.contentPanel.refresh();
        this.agentPanel.refresh();
        this.logPanel.refresh();
    }
    /**
     * Apply theme to all panels
     */
    applyTheme(theme) {
        this.container.style.border = { fg: theme.colors.border };
        this.sidebarPanel.applyTheme(theme);
        this.contentPanel.applyTheme(theme);
        this.agentPanel.applyTheme(theme);
        this.logPanel.applyTheme(theme);
    }
    /**
     * Get panel instances
     */
    getSidebarPanel() {
        return this.sidebarPanel;
    }
    getContentPanel() {
        return this.contentPanel;
    }
    getAgentPanel() {
        return this.agentPanel;
    }
    getLogPanel() {
        return this.logPanel;
    }
    /**
     * Get currently focused panel
     */
    getFocusedPanel() {
        return this.focusedPanel;
    }
}
exports.MainLayout = MainLayout;
