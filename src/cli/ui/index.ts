/**
 * TUI (Terminal User Interface) Entry Point
 * Main interface for the Enterprise AI Agents CLI
 */

import { TUIApplication } from './layouts/TUIApplication';
import { Logger } from '../core/logger';
import { ConfigManager } from '../config/config-manager';

export class TUI {
  private app: TUIApplication;
  private logger: Logger;
  private config: ConfigManager;

  constructor() {
    this.logger = new Logger('TUI');
    this.config = new ConfigManager();
    this.app = new TUIApplication(this.config, this.logger);
  }

  /**
   * Start the TUI application
   */
  async start(): Promise<void> {
    try {
      this.logger.info('Starting TUI Application...');
      await this.app.initialize();
      await this.app.run();
    } catch (error) {
      this.logger.error('Failed to start TUI:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the TUI application gracefully
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping TUI Application...');
      await this.app.cleanup();
    } catch (error) {
      this.logger.error('Error during TUI cleanup:', error);
    }
  }

  /**
   * Get the current application instance
   */
  getApp(): TUIApplication {
    return this.app;
  }
}

// Export main TUI class and components
export * from './components';
export * from './hooks';
export * from './utils';

// Default export for easy importing
export default TUI;
