/**
 * Main Layout Component
 * Manages the primary content area with panels and navigation
 */

import blessed from 'blessed';
import { EventEmitter } from 'events';
import { Logger } from '../../core/logger';
import { ConfigManager } from '../../config/config-manager';
import { TUIComponent, Theme } from '../components/types';
import { SidebarPanel } from '../components/SidebarPanel';
import { ContentPanel } from '../components/ContentPanel';
import { AgentPanel } from '../components/AgentPanel';
import { LogPanel } from '../components/LogPanel';
import { ThemeManager } from '../utils/ThemeManager';

export type LayoutMode = 'default' | 'agent-focused' | 'code-focused' | 'logs-focused';
export type FocusablePanel = 'sidebar' | 'content' | 'agent' | 'log';

export class MainLayout extends EventEmitter implements TUIComponent {

  private screen: blessed.Widgets.Screen;
  private container!: blessed.Widgets.BoxElement;
  private sidebarPanel!: SidebarPanel;
  private contentPanel!: ContentPanel;
  private agentPanel!: AgentPanel;
  private logPanel!: LogPanel;
  private config: ConfigManager;
  private logger: Logger;
  private currentMode: LayoutMode = 'default';
  private focusedPanel: FocusablePanel = 'sidebar';

  constructor(screen: blessed.Widgets.Screen, config: ConfigManager, logger: Logger) {
    super();
    this.screen = screen;
    this.config = config;
    this.logger = logger;

    this.createLayout();
    this.setupEventHandlers();
  }
  focus(): void {
    throw new Error('Method not implemented.');
  }
  blur(): void {
    throw new Error('Method not implemented.');
  }

  /**
   * Create the main layout structure
   */
  private createLayout(): void {
    // Main container
    this.container = blessed.box({
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
  private createPanels(): void {
    // Sidebar panel (left side)
    this.sidebarPanel = new SidebarPanel(this.container, this.config, this.logger);

    // Content panel (center)
    this.contentPanel = new ContentPanel(this.container, this.config, this.logger);

    // Agent panel (right side)
    this.agentPanel = new AgentPanel(this.container, this.config, this.logger);

    // Log panel (bottom)
    this.logPanel = new LogPanel(this.container, this.config, this.logger);
  }

  /**
   * Arrange panels according to current layout mode
   */
  private arrangeLayout(): void {
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
  private arrangeDefaultLayout(): void {
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
  private arrangeAgentFocusedLayout(): void {
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
  private arrangeCodeFocusedLayout(): void {
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
  private arrangeLogsFocusedLayout(): void {
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
  private setupEventHandlers(): void {
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
    this.sidebarPanel.on('select', (item: any) => {
      this.emit('sidebar-select', item);
    });

    this.contentPanel.on('edit', (content: string) => {
      this.emit('content-edit', content);
    });

    this.agentPanel.on('agent-action', (action: string, data: any) => {
      this.emit('agent-action', action, data);
    });

    this.logPanel.on('log-filter', (filter: string) => {
      this.emit('log-filter', filter);
    });
  }

  /**
   * Initialize all panels
   */
  async initialize(): Promise<void> {
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
  async cleanup(): Promise<void> {
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
  private switchToNextPanel(): void {
    const panels = ['sidebar', 'content', 'agent', 'log'];
    const currentIndex = panels.indexOf(this.focusedPanel);
    const nextIndex = (currentIndex + 1) % panels.length;
    this.setFocus(panels[nextIndex] as FocusablePanel);
  }

  /**
   * Switch to the previous panel
   */
  private switchToPreviousPanel(): void {
    const panels = ['sidebar', 'content', 'agent', 'log'];
    const currentIndex = panels.indexOf(this.focusedPanel);
    const prevIndex = (currentIndex - 1 + panels.length) % panels.length;
    this.setFocus(panels[prevIndex] as FocusablePanel);
  }

  /**
   * Set focus to a specific panel
   */
  setFocus(panel: FocusablePanel): void {
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
  private removeFocusFromAll(): void {
    this.sidebarPanel.blur();
    this.contentPanel.blur();
    this.agentPanel.blur();
    this.logPanel.blur();
  }

  /**
   * Set layout mode
   */
  setLayoutMode(mode: LayoutMode): void {
    if (this.currentMode === mode) return;

    this.logger.info(`Switching layout mode from ${this.currentMode} to ${mode}`);
    this.currentMode = mode;
    this.arrangeLayout();
    this.screen.render();
    this.emit('layout-changed', mode);
  }

  /**
   * Get current layout mode
   */
  getLayoutMode(): LayoutMode {
    return this.currentMode;
  }

  /**
   * Handle window resize
   */
  handleResize(): void {
    this.arrangeLayout();
    this.sidebarPanel.handleResize();
    this.contentPanel.handleResize();
    this.agentPanel.handleResize();
    this.logPanel.handleResize();
  }

  /**
   * Refresh all panels
   */
  refresh(): void {
    this.sidebarPanel.refresh();
    this.contentPanel.refresh();
    this.agentPanel.refresh();
    this.logPanel.refresh();
  }

  /**
   * Apply theme to all panels
   */
  applyTheme(theme: Theme): void {
    this.container.style.border = { fg: theme.colors.border };
    this.sidebarPanel.applyTheme(theme);
    this.contentPanel.applyTheme(theme);
    this.agentPanel.applyTheme(theme);
    this.logPanel.applyTheme(theme);
  }

  /**
   * Get panel instances
   */
  getSidebarPanel(): SidebarPanel {
    return this.sidebarPanel;
  }

  getContentPanel(): ContentPanel {
    return this.contentPanel;
  }

  getAgentPanel(): AgentPanel {
    return this.agentPanel;
  }

  getLogPanel(): LogPanel {
    return this.logPanel;
  }

  /**
   * Get currently focused panel
   */
  getFocusedPanel(): string {
    return this.focusedPanel;
  }
}
