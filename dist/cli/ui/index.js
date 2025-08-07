"use strict";
/**
 * TUI (Terminal User Interface) Entry Point
 * Main interface for the Enterprise AI Agents CLI
 */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TUI = void 0;
const TUIApplication_1 = require("./layouts/TUIApplication");
const logger_1 = require("../core/logger");
const config_manager_1 = require("../config/config-manager");
class TUI {
    constructor() {
        this.logger = new logger_1.Logger('TUI');
        this.config = new config_manager_1.ConfigManager();
        this.app = new TUIApplication_1.TUIApplication(this.config, this.logger);
    }
    /**
     * Start the TUI application
     */
    async start() {
        try {
            this.logger.info('Starting TUI Application...');
            await this.app.initialize();
            await this.app.run();
        }
        catch (error) {
            this.logger.error('Failed to start TUI:', error);
            process.exit(1);
        }
    }
    /**
     * Stop the TUI application gracefully
     */
    async stop() {
        try {
            this.logger.info('Stopping TUI Application...');
            await this.app.cleanup();
        }
        catch (error) {
            this.logger.error('Error during TUI cleanup:', error);
        }
    }
    /**
     * Get the current application instance
     */
    getApp() {
        return this.app;
    }
}
exports.TUI = TUI;
// Export main TUI class and components
__exportStar(require("./components"), exports);
__exportStar(require("./hooks"), exports);
__exportStar(require("./utils"), exports);
// Default export for easy importing
exports.default = TUI;
