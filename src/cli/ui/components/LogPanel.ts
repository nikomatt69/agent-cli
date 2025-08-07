/**
 * Log Panel Component
 * Displays system logs, agent outputs, and debug information
 */

import blessed from 'blessed';
import { EventEmitter } from 'events';
import { TUIComponent, Theme, Position, LogEntry } from './types';
import { Logger } from '../../core/logger';
import { ConfigManager } from '../../config/config-manager';

export class LogPanel extends EventEmitter implements TUIComponent {
  private container!: blessed.Widgets.BoxElement;
  private logDisplay!: blessed.Widgets.BoxElement;
  private filterInput!: blessed.Widgets.TextboxElement;
  private controlBar!: blessed.Widgets.BoxElement;
  private config: ConfigManager;
  private logger: Logger;
  private logs: LogEntry[] = [];
  private filteredLogs: LogEntry[] = [];
  private currentFilter: string = '';
  private logLevels: Set<string> = new Set(['debug', 'info', 'warn', 'error']);
  private focused: boolean = false;
  private maxLogs: number = 1000;

  constructor(parent: blessed.Widgets.Node, config: ConfigManager, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;

    this.createComponents(parent);
    this.setupEventHandlers();
    this.setupLogCapture();
  }

  /**
   * Create log panel components
   */
  private createComponents(parent: blessed.Widgets.Node): void {
    // Main container
    this.container = blessed.box({
      parent,
      top: '70%',
      left: 0,
      width: '100%',
      height: '30%',
      border: 'line',
      style: {
        border: { fg: 'cyan' },
        bg: 'black',
        fg: 'white'
      },
      label: ' Logs ',
      tags: true
    });

    // Control bar (top)
    this.controlBar = blessed.box({
      parent: this.container,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      border: 'line',
      style: {
        border: { fg: 'blue' },
        bg: 'black',
        fg: 'white'
      }
    });

    // Filter input
    this.filterInput = blessed.textbox({
      parent: this.controlBar,
      top: 0,
      left: 1,
      width: '50%',
      height: 1,
      style: {
        bg: 'black',
        fg: 'white',
        focus: {
          bg: 'blue',
          fg: 'white'
        }
      },
      inputOnFocus: true
    });

    // Control buttons
    this.createControlButtons();

    // Log display
    this.logDisplay = blessed.box({
      parent: this.container,
      top: 3,
      left: 0,
      width: '100%',
      bottom: 0,
      style: {
        bg: 'black',
        fg: 'white'
      },
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      tags: true,
      scrollback: this.maxLogs
    });
  }

  /**
   * Create control buttons
   */
  private createControlButtons(): void {
    const clearButton = blessed.button({
      parent: this.controlBar,
      top: 0,
      left: '52%',
      width: 8,
      height: 1,
      content: ' Clear ',
      style: {
        bg: 'red',
        fg: 'white',
        focus: {
          bg: 'yellow',
          fg: 'black'
        }
      },
      mouse: true
    });

    const exportButton = blessed.button({
      parent: this.controlBar,
      top: 0,
      left: '61%',
      width: 10,
      height: 1,
      content: ' Export ',
      style: {
        bg: 'blue',
        fg: 'white',
        focus: {
          bg: 'yellow',
          fg: 'black'
        }
      },
      mouse: true
    });

    const levelButton = blessed.button({
      parent: this.controlBar,
      top: 0,
      right: 1,
      width: 12,
      height: 1,
      content: ' Levels ',
      style: {
        bg: 'green',
        fg: 'white',
        focus: {
          bg: 'yellow',
          fg: 'black'
        }
      },
      mouse: true
    });

    // Button event handlers
    clearButton.on('press', () => this.clearLogs());
    exportButton.on('press', () => this.exportLogs());
    levelButton.on('press', () => this.toggleLogLevels());
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Filter input events
    this.filterInput.on('submit', () => {
      this.currentFilter = this.filterInput.getValue();
      this.applyFilter();
    });

    this.filterInput.on('keypress', (ch: string, key: any) => {
      if (key.name === 'escape') {
        this.clearFilter();
      } else {
        // Apply filter as user types
        setTimeout(() => {
          this.currentFilter = this.filterInput.getValue();
          this.applyFilter();
        }, 100);
      }
    });

    // Log display events
    this.logDisplay.on('keypress', (ch: string, key: any) => {
      if (key.name === 'f' && key.ctrl) {
        this.filterInput.focus();
      } else if (key.name === 'c' && key.ctrl) {
        this.clearLogs();
      } else if (key.name === 'e' && key.ctrl) {
        this.exportLogs();
      }
    });

    // Container events
    this.container.key(['f'], () => {
      this.filterInput.focus();
    });

    this.container.key(['c'], () => {
      this.clearLogs();
    });

    this.container.key(['l'], () => {
      this.toggleLogLevels();
    });
  }

  /**
   * Setup log capture from the logger
   */
  private setupLogCapture(): void {
    // In a real implementation, this would hook into the actual logging system
    // For now, we'll simulate log entries
    this.simulateLogEntries();
  }

  /**
   * Simulate log entries for demonstration
   */
  private simulateLogEntries(): void {
    const sampleLogs: LogEntry[] = [
      {
        timestamp: new Date(),
        level: 'info',
        source: 'TUI',
        message: 'TUI Application started successfully'
      },
      {
        timestamp: new Date(Date.now() - 60000),
        level: 'debug',
        source: 'AgentPanel',
        message: 'Loading agent registry...'
      },
      {
        timestamp: new Date(Date.now() - 120000),
        level: 'warn',
        source: 'FileSystem',
        message: 'File not found: config.json, using defaults'
      },
      {
        timestamp: new Date(Date.now() - 180000),
        level: 'error',
        source: 'NetworkClient',
        message: 'Failed to connect to remote service',
        data: { error: 'ECONNREFUSED', host: 'api.example.com' }
      },
      {
        timestamp: new Date(Date.now() - 240000),
        level: 'info',
        source: 'CodeAnalyzer',
        message: 'Analysis completed: 45 files processed'
      }
    ];

    sampleLogs.forEach(log => this.addLogEntry(log));
  }

  /**
   * Add a log entry
   */
  addLogEntry(entry: LogEntry): void {
    this.logs.unshift(entry);

    // Limit number of stored logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.applyFilter();
    this.emit('log-added', entry);
  }

  /**
   * Apply current filter
   */
  private applyFilter(): void {
    let filtered = this.logs;

    // Filter by log level
    filtered = filtered.filter(log => this.logLevels.has(log.level));

    // Filter by search term
    if (this.currentFilter.trim()) {
      const filter = this.currentFilter.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(filter) ||
        log.source.toLowerCase().includes(filter) ||
        log.level.toLowerCase().includes(filter)
      );
    }

    this.filteredLogs = filtered;
    this.updateDisplay();
  }

  /**
   * Update the log display
   */
  private updateDisplay(): void {
    // Clear current display
    this.logDisplay.setContent('');

    // Add filtered logs
    this.filteredLogs.forEach(log => {
      const formattedLog = this.formatLogEntry(log);
      // Append to content instead of using log method
      const currentContent = this.logDisplay.getContent();
      this.logDisplay.setContent(currentContent + formattedLog + '\n');
    });
  }

  /**
   * Format a log entry for display
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const level = this.formatLogLevel(entry.level);
    const source = `{cyan-fg}[${entry.source}]{/cyan-fg}`;

    let message = entry.message;
    if (entry.data) {
      message += ` {gray-fg}${JSON.stringify(entry.data)}{/gray-fg}`;
    }

    return `{gray-fg}${timestamp}{/gray-fg} ${level} ${source} ${message}`;
  }

  /**
   * Format log level with colors
   */
  private formatLogLevel(level: string): string {
    switch (level) {
      case 'debug':
        return '{blue-fg}[DEBUG]{/blue-fg}';
      case 'info':
        return '{green-fg}[INFO]{/green-fg}';
      case 'warn':
        return '{yellow-fg}[WARN]{/yellow-fg}';
      case 'error':
        return '{red-fg}[ERROR]{/red-fg}';
      default:
        return `{white-fg}[${level.toUpperCase()}]{/white-fg}`;
    }
  }

  /**
   * Clear all logs
   */
  private clearLogs(): void {
    this.logs = [];
    this.filteredLogs = [];
    this.logDisplay.setContent('');
    this.emit('logs-cleared');
  }

  /**
   * Clear filter
   */
  private clearFilter(): void {
    this.currentFilter = '';
    this.filterInput.clearValue();
    this.applyFilter();
  }

  /**
   * Export logs
   */
  private exportLogs(): void {
    const exportData = this.filteredLogs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      source: log.source,
      message: log.message,
      data: log.data
    }));

    // In a real implementation, this would save to file
    this.logger.info(`Exporting ${exportData.length} log entries`);
    this.emit('logs-exported', exportData);
  }

  /**
   * Toggle log levels
   */
  private toggleLogLevels(): void {
    // Cycle through different level combinations
    const levelSets = [
      new Set(['debug', 'info', 'warn', 'error']), // All
      new Set(['info', 'warn', 'error']), // No debug
      new Set(['warn', 'error']), // Warnings and errors only
      new Set(['error']) // Errors only
    ];

    const currentIndex = levelSets.findIndex(set =>
      set.size === this.logLevels.size &&
      Array.from(set).every(level => this.logLevels.has(level))
    );

    const nextIndex = (currentIndex + 1) % levelSets.length;
    this.logLevels = levelSets[nextIndex];

    this.applyFilter();
    this.emit('log-levels-changed', Array.from(this.logLevels));
  }

  /**
   * Set position
   */
  setPosition(position: Partial<Position>): void {
    if (position.top !== undefined) this.container.top = position.top;
    if (position.left !== undefined) this.container.left = position.left;
    if (position.width !== undefined) this.container.width = position.width;
    if (position.height !== undefined) this.container.height = position.height;
  }

  /**
   * Initialize the log panel
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing LogPanel...');
    this.applyFilter();
    this.logger.info('LogPanel initialized successfully');
  }

  /**
   * Cleanup the log panel
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up LogPanel...');
    // Cleanup logic here
  }

  /**
   * Refresh the log panel
   */
  refresh(): void {
    this.applyFilter();
  }

  /**
   * Focus the log panel
   */
  focus(): void {
    this.focused = true;
    this.container.style.border = { fg: 'yellow' };
    this.logDisplay.focus();
  }

  /**
   * Blur the log panel
   */
  blur(): void {
    this.focused = false;
    this.container.style.border = { fg: 'cyan' };
  }

  /**
   * Handle window resize
   */
  handleResize(): void {
    // Log panel handles resize automatically through blessed
  }

  /**
   * Apply theme to the log panel
   */
  applyTheme(theme: Theme): void {
    this.container.style.border = { fg: theme.colors.border };
    this.container.style.bg = theme.colors.background;
    this.container.style.fg = theme.colors.foreground;

    this.logDisplay.style.bg = theme.colors.background;
    this.logDisplay.style.fg = theme.colors.foreground;

    this.filterInput.style.bg = theme.colors.background;
    this.filterInput.style.fg = theme.colors.foreground;
    this.filterInput.style.focus = {
      bg: theme.colors.primary,
      fg: theme.colors.foreground
    };

    if (this.focused) {
      this.container.style.border = { fg: theme.styles.focusBorder };
    }

    this.updateDisplay();
  }

  /**
   * Get current filter
   */
  getCurrentFilter(): string {
    return this.currentFilter;
  }

  /**
   * Set filter
   */
  setFilter(filter: string): void {
    this.currentFilter = filter;
    this.filterInput.setValue(filter);
    this.applyFilter();
  }

  /**
   * Get active log levels
   */
  getActiveLogLevels(): string[] {
    return Array.from(this.logLevels);
  }

  /**
   * Set active log levels
   */
  setActiveLogLevels(levels: string[]): void {
    this.logLevels = new Set(levels);
    this.applyFilter();
  }

  /**
   * Get all logs
   */
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get filtered logs
   */
  getFilteredLogs(): LogEntry[] {
    return [...this.filteredLogs];
  }

  /**
   * Add multiple log entries
   */
  addLogEntries(entries: LogEntry[]): void {
    entries.forEach(entry => this.addLogEntry(entry));
  }

  /**
   * Search logs
   */
  searchLogs(query: string): LogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.logs.filter(log =>
      log.message.toLowerCase().includes(lowerQuery) ||
      log.source.toLowerCase().includes(lowerQuery)
    );
  }
}
