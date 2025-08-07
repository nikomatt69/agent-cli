"use strict";
/**
 * Logger utility for the CLI system
 * Provides structured logging with different levels
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_LEVELS = exports.logger = exports.Logger = void 0;
const chalk_1 = __importDefault(require("chalk"));
class Logger {
    constructor(source) {
        this.source = source;
    }
    /**
     * Set global log level
     */
    static setLogLevel(level) {
        Logger.logLevel = level;
    }
    /**
     * Get global log level
     */
    static getLogLevel() {
        return Logger.logLevel;
    }
    /**
     * Get all logs
     */
    static getLogs() {
        return [...Logger.logs];
    }
    /**
     * Clear all logs
     */
    static clearLogs() {
        Logger.logs = [];
    }
    /**
     * Check if a log level should be output
     */
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(Logger.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }
    /**
     * Add log entry to storage
     */
    addLogEntry(level, message, data) {
        const entry = {
            timestamp: new Date(),
            level,
            source: this.source,
            message,
            data
        };
        Logger.logs.unshift(entry);
        // Limit number of stored logs
        if (Logger.logs.length > Logger.maxLogs) {
            Logger.logs = Logger.logs.slice(0, Logger.maxLogs);
        }
    }
    /**
     * Format log message for console output
     */
    formatMessage(level, message, data) {
        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const levelColor = this.getLevelColor(level);
        const sourceColor = chalk_1.default.cyan;
        const timestampColor = chalk_1.default.gray;
        let formattedMessage = `${timestampColor(timestamp)} ${levelColor(`[${level.toUpperCase()}]`)} ${sourceColor(`[${this.source}]`)} ${message}`;
        if (data !== undefined) {
            formattedMessage += `\n${chalk_1.default.gray(JSON.stringify(data, null, 2))}`;
        }
        return formattedMessage;
    }
    /**
     * Get color for log level
     */
    getLevelColor(level) {
        switch (level) {
            case 'debug':
                return chalk_1.default.blue;
            case 'info':
                return chalk_1.default.green;
            case 'warn':
                return chalk_1.default.yellow;
            case 'error':
                return chalk_1.default.red;
            default:
                return chalk_1.default.white;
        }
    }
    /**
     * Log debug message
     */
    debug(message, data) {
        this.addLogEntry('debug', message, data);
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message, data));
        }
    }
    /**
     * Log info message
     */
    info(message, data) {
        this.addLogEntry('info', message, data);
        if (this.shouldLog('info')) {
            console.log(this.formatMessage('info', message, data));
        }
    }
    /**
     * Log warning message
     */
    warn(message, data) {
        this.addLogEntry('warn', message, data);
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, data));
        }
    }
    /**
     * Log error message
     */
    error(message, data) {
        this.addLogEntry('error', message, data);
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, data));
        }
    }
    /**
     * Create a child logger with a sub-source
     */
    child(subSource) {
        return new Logger(`${this.source}:${subSource}`);
    }
    /**
     * Get the source of this logger
     */
    getSource() {
        return this.source;
    }
}
exports.Logger = Logger;
Logger.logLevel = 'info';
Logger.logs = [];
Logger.maxLogs = 1000;
// Create default logger instance
exports.logger = new Logger('CLI');
// Export log levels for external use
exports.LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
