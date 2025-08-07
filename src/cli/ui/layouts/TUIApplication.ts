/**
 * Main TUI Application Layout
 * Manages the overall terminal interface and component orchestration
 */

import blessed from 'blessed';
import { EventEmitter } from 'events';
import { Logger } from '../../core/logger';
import { ConfigManager } from '../../config/config-manager';
import { MainLayout } from './MainLayout';
import { StatusBar } from '../components/StatusBar';
import { CommandPalette } from '../components/CommandPalette';
import { NotificationManager } from '../components/NotificationManager';
import { ThemeManager } from '../utils/ThemeManager';

export interface TUIApplicationOptions {
  title?: string;
  debug?: boolean;
  fullscreen?: boolean;
}

export class TUIApplication extends EventEmitter {
  private screen: blessed.Widgets.Screen;
  private mainLayout!: MainLayout;
  private statusBar!: StatusBar;
  private commandPalette!: CommandPalette;
  private notificationManager!: NotificationManager;
  private themeManager: ThemeManager;
  private logger: Logger;
  private config: ConfigManager;
  private isRunning: boolean = false;

  constructor(
    config: ConfigManager,
    logger: Logger,
    options: TUIApplicationOptions = {}
  ) {
    super();
    this.config = config;
    this.logger = logger;
    this.themeManager = new ThemeManager(config);

    // Initialize blessed screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: options.title || 'Enterprise AI Agents CLI',
      fullUnicode: true,
      debug: options.debug || false,
      dockBorders: false,
      mouse: false,
      sendFocus: true,
      warnings: false,
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true,
        color: 'white'
      }
    });

    // Initialize components
    this.initializeComponents();
    this.setupEventHandlers();
  }

  /**
   * Initialize all TUI components
   */
  private initializeComponents(): void {
    // Main layout (takes up most of the screen)
    this.mainLayout = new MainLayout(this.screen, this.config, this.logger);

    // Status bar (bottom of screen)
    this.statusBar = new StatusBar(this.screen, this.themeManager);

    // Command palette (overlay)
    this.commandPalette = new CommandPalette(this.screen, this.themeManager);

    // Notification manager (overlay)
    this.notificationManager = new NotificationManager(this.screen, this.themeManager);
  }

  /**
   * Setup global event handlers
   */
  private setupEventHandlers(): void {
    // Global key bindings
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.handleExit();
    });

    this.screen.key(['C-p'], () => {
      this.commandPalette.toggle();
    });

    this.screen.key(['C-n'], () => {
      this.notificationManager.showNext();
    });

    this.screen.key(['C-r'], () => {
      this.refresh();
    });

    this.screen.key(['f1'], () => {
      this.showHelp();
    });

    // Handle window resize
    this.screen.on('resize', () => {
      this.handleResize();
    });

    // Component event forwarding
    this.mainLayout.on('command', (command: string, args: any[]) => {
      this.emit('command', command, args);
    });

    this.commandPalette.on('execute', (command: string) => {
      this.executeCommand(command);
    });

    // Error handling
    this.screen.on('error', (error: Error) => {
      this.logger.error('Screen error:', error);
      this.notificationManager.showError('Screen Error', error.message);
    });
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing TUI Application...');

      // Load theme
      await this.themeManager.loadTheme();

      // Initialize components
      await this.mainLayout.initialize();
      await this.statusBar.initialize();
      await this.commandPalette.initialize();
      await this.notificationManager.initialize();

      // Apply theme to all components
      this.applyTheme();

      this.logger.info('TUI Application initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize TUI Application:', error);
      throw error;
    }
  }

  /**
   * Run the application
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('TUI Application is already running');
      return;
    }

    try {
      this.isRunning = true;
      this.logger.info('Starting TUI Application...');

      // Show welcome message
      this.notificationManager.showInfo(
        'Welcome',
        'Enterprise AI Agents CLI - Press F1 for help, Ctrl+P for commands'
      );

      // Update status
      this.statusBar.setStatus('Ready', 'success');

      // Start the main loop
      this.screen.render();

      // Keep the TUI running and wait for user interaction
      return new Promise<void>((resolve) => {
        // Set up exit handlers
        const cleanup = async () => {
          await this.cleanup();
          resolve();
        };

        // Handle exit events
        this.once('exit', cleanup);
        
        // Emit started event
        this.emit('started');
        this.logger.info('TUI Application started successfully');
        
        // The TUI will now stay alive until cleanup() is called
      });

    } catch (error) {
      this.isRunning = false;
      this.logger.error('Failed to start TUI Application:', error);
      throw error;
    }
  }

  /**
   * Cleanup and stop the application
   */
  async cleanup(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.logger.info('Cleaning up TUI Application...');
      this.isRunning = false;

      // Cleanup components
      await this.mainLayout.cleanup();
      await this.statusBar.cleanup();
      await this.commandPalette.cleanup();
      await this.notificationManager.cleanup();

      // Destroy screen
      this.screen.destroy();

      // Emit exit event to resolve the Promise in start() method
      this.emit('exit');
      this.emit('stopped');
      this.logger.info('TUI Application cleaned up successfully');

    } catch (error) {
      this.logger.error('Error during TUI cleanup:', error);
      throw error;
    }
  }

  /**
   * Execute a command
   */
  private async executeCommand(command: string): Promise<void> {
    try {
      this.statusBar.setStatus(`Executing: ${command}`, 'info');
      this.emit('command', command);
    } catch (error: any) {
      this.logger.error('Command execution failed:', error);
      this.notificationManager.showError('Command Failed', error.message);
      this.statusBar.setStatus('Ready', 'success');
    }
  }

  /**
   * Handle application exit
   */
  private handleExit(): void {
    this.logger.info('Exit requested');
    this.cleanup().then(() => {
      process.exit(0);
    }).catch((error) => {
      this.logger.error('Error during exit cleanup:', error);
      process.exit(1);
    });
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    this.logger.debug('Window resized');
    this.mainLayout.handleResize();
    this.statusBar.handleResize();
    this.screen.render();
  }

  /**
   * Refresh the entire interface
   */
  private refresh(): void {
    this.logger.debug('Refreshing interface');
    this.mainLayout.refresh();
    this.statusBar.refresh();
    this.screen.render();
  }

  /**
   * Show help dialog
   */
  private showHelp(): void {
    const helpText = `
Enterprise AI Agents CLI - Help

Global Shortcuts:
  Ctrl+P    - Open command palette
  Ctrl+N    - Show next notification
  Ctrl+R    - Refresh interface
  F1        - Show this help
  Esc/Q     - Exit application

Navigation:
  Tab       - Switch between panels
  Arrow Keys - Navigate within panels
  Enter     - Select/Execute
  Space     - Toggle/Select

Commands:
  Use Ctrl+P to open the command palette and type commands
  
For more information, visit the documentation.
    `;

    this.notificationManager.showInfo('Help', helpText.trim());
  }

  /**
   * Apply current theme to all components
   */
  private applyTheme(): void {
    const theme = this.themeManager.getCurrentTheme();
    this.mainLayout.applyTheme(theme);
    this.statusBar.applyTheme(theme);
    this.commandPalette.applyTheme(theme);
    this.notificationManager.applyTheme(theme);
  }

  /**
   * Get the blessed screen instance
   */
  getScreen(): blessed.Widgets.Screen {
    return this.screen;
  }

  /**
   * Get the main layout instance
   */
  getMainLayout(): MainLayout {
    return this.mainLayout;
  }

  /**
   * Get the status bar instance
   */
  getStatusBar(): StatusBar {
    return this.statusBar;
  }

  /**
   * Get the notification manager instance
   */
  getNotificationManager(): NotificationManager {
    return this.notificationManager;
  }

  /**
   * Check if the application is running
   */
  isApplicationRunning(): boolean {
    return this.isRunning;
  }
}
