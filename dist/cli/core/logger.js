"use strict";
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
    static setLogLevel(level) {
        Logger.logLevel = level;
    }
    static setConsoleOutput(enabled) {
        Logger.consoleOutputEnabled = enabled;
    }
    static getLogLevel() {
        return Logger.logLevel;
    }
    static getLogs() {
        return [...Logger.logs];
    }
    static clearLogs() {
        Logger.logs = [];
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(Logger.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }
    addLogEntry(level, message, data) {
        const entry = {
            timestamp: new Date(),
            level,
            source: this.source,
            message,
            data
        };
        Logger.logs.unshift(entry);
        if (Logger.logs.length > Logger.maxLogs) {
            Logger.logs = Logger.logs.slice(0, Logger.maxLogs);
        }
    }
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
    debug(message, data) {
        this.addLogEntry('debug', message, data);
        if (this.shouldLog('debug') && Logger.consoleOutputEnabled) {
            console.log(this.formatMessage('debug', message, data));
        }
    }
    info(message, data) {
        this.addLogEntry('info', message, data);
        if (this.shouldLog('info') && Logger.consoleOutputEnabled) {
            console.log(this.formatMessage('info', message, data));
        }
    }
    warn(message, data) {
        this.addLogEntry('warn', message, data);
        if (this.shouldLog('warn') && Logger.consoleOutputEnabled) {
            console.warn(this.formatMessage('warn', message, data));
        }
    }
    error(message, data) {
        this.addLogEntry('error', message, data);
        if (this.shouldLog('error') && Logger.consoleOutputEnabled) {
            console.error(this.formatMessage('error', message, data));
        }
    }
    child(subSource) {
        return new Logger(`${this.source}:${subSource}`);
    }
    getSource() {
        return this.source;
    }
}
exports.Logger = Logger;
Logger.logLevel = 'info';
Logger.logs = [];
Logger.maxLogs = 1000;
Logger.consoleOutputEnabled = true;
exports.logger = new Logger('CLI');
exports.LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
