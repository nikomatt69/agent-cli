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
exports.audit = exports.logSession = exports.logTask = exports.logAgent = exports.logger = exports.Logger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const chalk_1 = __importDefault(require("chalk"));
/**
 * Enterprise Logger with structured logging, audit trails, and monitoring
 */
class Logger {
    constructor() {
        this.logBuffer = [];
        this.auditBuffer = [];
        this.levelOrder = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };
        this.config = {
            level: 'info',
            enableConsole: true,
            enableFile: true,
            enableAudit: false,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 10,
            format: 'json'
        };
        this.logDir = path.join(os.homedir(), '.nikcli', 'logs');
        this.auditDir = path.join(os.homedir(), '.nikcli', 'audit');
        this.ensureDirectories();
        this.setupPeriodicFlush();
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    /**
     * Configure the logger
     */
    async configure(config) {
        this.config = { ...this.config, ...config };
        if (config.logDir) {
            this.logDir = config.logDir;
            this.auditDir = path.join(config.logDir, 'audit');
        }
        this.ensureDirectories();
        await this.info('Logger configured', { config: this.config });
    }
    /**
     * Log an error message
     */
    async error(message, context, error) {
        await this.log('error', message, context, error);
    }
    /**
     * Log a warning message
     */
    async warn(message, context) {
        await this.log('warn', message, context);
    }
    /**
     * Log an info message
     */
    async info(message, context) {
        await this.log('info', message, context);
    }
    /**
     * Log a debug message
     */
    async debug(message, context) {
        await this.log('debug', message, context);
    }
    /**
     * Log a trace message
     */
    async trace(message, context) {
        await this.log('trace', message, context);
    }
    /**
     * Log an audit event (always logged regardless of level)
     */
    async audit(action, context) {
        const entry = {
            timestamp: new Date(),
            level: 'info',
            message: `AUDIT: ${action}`,
            context: {
                ...context,
                auditEvent: true,
                action
            }
        };
        this.auditBuffer.push(entry);
        if (this.config.enableConsole) {
            console.log(chalk_1.default.magenta('🔍 AUDIT:'), chalk_1.default.yellow(action), context);
        }
        // Force flush audit events immediately for security
        await this.flushAuditBuffer();
    }
    /**
     * Log with agent context
     */
    async logAgent(level, agentId, message, context) {
        await this.log(level, message, { ...context, agentId });
    }
    /**
     * Log with task context
     */
    async logTask(level, taskId, agentId, message, context) {
        await this.log(level, message, { ...context, taskId, agentId });
    }
    /**
     * Log with session context
     */
    async logSession(level, sessionId, message, context) {
        await this.log(level, message, { ...context, sessionId });
    }
    /**
     * Core logging method
     */
    async log(level, message, context, error) {
        // Check if this level should be logged
        if (this.levelOrder[level] > this.levelOrder[this.config.level]) {
            return;
        }
        const entry = {
            timestamp: new Date(),
            level,
            message,
            context,
            error
        };
        // Add to buffer
        this.logBuffer.push(entry);
        // Console output
        if (this.config.enableConsole) {
            this.logToConsole(entry);
        }
        // If buffer is getting full, flush immediately
        if (this.logBuffer.length > 100) {
            await this.flushLogBuffer();
        }
    }
    /**
     * Output log entry to console with colors
     */
    logToConsole(entry) {
        const timestamp = entry.timestamp.toISOString();
        const level = entry.level.toUpperCase().padEnd(5);
        let colorFunc;
        let icon;
        switch (entry.level) {
            case 'error':
                colorFunc = chalk_1.default.red;
                icon = '❌';
                break;
            case 'warn':
                colorFunc = chalk_1.default.yellow;
                icon = '⚠️';
                break;
            case 'info':
                colorFunc = chalk_1.default.cyan;
                icon = 'ℹ️';
                break;
            case 'debug':
                colorFunc = chalk_1.default.gray;
                icon = '🐛';
                break;
            case 'trace':
                colorFunc = chalk_1.default.dim;
                icon = '🔍';
                break;
        }
        console.log(`${chalk_1.default.gray(timestamp)} ${icon} ${colorFunc(level)} ${entry.message}`);
        if (entry.context && Object.keys(entry.context).length > 0) {
            console.log(chalk_1.default.gray('  Context:'), entry.context);
        }
        if (entry.error) {
            console.log(chalk_1.default.red('  Error:'), entry.error.message);
            if (entry.level === 'debug' || entry.level === 'trace') {
                console.log(chalk_1.default.gray(entry.error.stack));
            }
        }
    }
    /**
     * Ensure log directories exist
     */
    ensureDirectories() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        if (!fs.existsSync(this.auditDir)) {
            fs.mkdirSync(this.auditDir, { recursive: true });
        }
    }
    /**
     * Setup periodic buffer flushing
     */
    setupPeriodicFlush() {
        this.flushTimer = setInterval(async () => {
            await this.flushLogBuffer();
            await this.flushAuditBuffer();
        }, 5000); // Flush every 5 seconds
    }
    /**
     * Flush log buffer to file
     */
    async flushLogBuffer() {
        if (this.logBuffer.length === 0 || !this.config.enableFile) {
            return;
        }
        try {
            const logFile = await this.getCurrentLogFile();
            const logData = this.logBuffer.map(entry => this.formatLogEntry(entry)).join('\n') + '\n';
            fs.appendFileSync(logFile, logData);
            this.logBuffer = [];
            // Rotate log files if needed
            await this.rotateLogFiles();
        }
        catch (error) {
            console.error('Failed to flush log buffer:', error.message);
        }
    }
    /**
     * Flush audit buffer to file
     */
    async flushAuditBuffer() {
        if (this.auditBuffer.length === 0 || !this.config.enableAudit) {
            return;
        }
        try {
            const auditFile = await this.getCurrentAuditFile();
            const auditData = this.auditBuffer.map(entry => this.formatLogEntry(entry)).join('\n') + '\n';
            fs.appendFileSync(auditFile, auditData);
            this.auditBuffer = [];
        }
        catch (error) {
            console.error('Failed to flush audit buffer:', error.message);
        }
    }
    /**
     * Get current log file path
     */
    async getCurrentLogFile() {
        if (!this.currentLogFile) {
            const date = new Date().toISOString().split('T')[0];
            this.currentLogFile = path.join(this.logDir, `cli-${date}.log`);
        }
        return this.currentLogFile;
    }
    /**
     * Get current audit file path
     */
    async getCurrentAuditFile() {
        if (!this.currentAuditFile) {
            const date = new Date().toISOString().split('T')[0];
            this.currentAuditFile = path.join(this.auditDir, `audit-${date}.log`);
        }
        return this.currentAuditFile;
    }
    /**
     * Format log entry for file output
     */
    formatLogEntry(entry) {
        if (this.config.format === 'json') {
            return JSON.stringify({
                timestamp: entry.timestamp.toISOString(),
                level: entry.level,
                message: entry.message,
                context: entry.context,
                sessionId: entry.sessionId,
                agentId: entry.agentId,
                taskId: entry.taskId,
                userId: entry.userId,
                error: entry.error ? {
                    message: entry.error.message,
                    stack: entry.error.stack,
                    name: entry.error.name
                } : undefined
            });
        }
        else {
            const timestamp = entry.timestamp.toISOString();
            const level = entry.level.toUpperCase().padEnd(5);
            let line = `${timestamp} ${level} ${entry.message}`;
            if (entry.context) {
                line += ` | Context: ${JSON.stringify(entry.context)}`;
            }
            if (entry.error) {
                line += ` | Error: ${entry.error.message}`;
            }
            return line;
        }
    }
    /**
     * Rotate log files to prevent them from getting too large
     */
    async rotateLogFiles() {
        try {
            const logFile = await this.getCurrentLogFile();
            const stats = fs.statSync(logFile);
            if (stats.size > this.config.maxFileSize) {
                // Rotate current log file
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const rotatedFile = logFile.replace('.log', `-${timestamp}.log`);
                fs.renameSync(logFile, rotatedFile);
                // Reset current log file
                this.currentLogFile = undefined;
                // Clean up old log files
                await this.cleanupOldLogFiles();
            }
        }
        catch (error) {
            console.error('Failed to rotate log files:', error.message);
        }
    }
    /**
     * Clean up old log files beyond retention limit
     */
    async cleanupOldLogFiles() {
        try {
            const files = fs.readdirSync(this.logDir)
                .filter(file => file.startsWith('cli-') && file.endsWith('.log'))
                .map(file => ({
                name: file,
                path: path.join(this.logDir, file),
                mtime: fs.statSync(path.join(this.logDir, file)).mtime
            }))
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
            // Keep only the most recent files
            if (files.length > this.config.maxFiles) {
                const filesToDelete = files.slice(this.config.maxFiles);
                filesToDelete.forEach(file => {
                    fs.unlinkSync(file.path);
                });
            }
        }
        catch (error) {
            console.error('Failed to cleanup old log files:', error.message);
        }
    }
    /**
     * Get logger statistics
     */
    getStats() {
        return {
            bufferedLogs: this.logBuffer.length,
            bufferedAudits: this.auditBuffer.length,
            currentLogFile: this.currentLogFile,
            currentAuditFile: this.currentAuditFile,
            config: { ...this.config }
        };
    }
    /**
     * Force flush all buffers
     */
    async flush() {
        await this.flushLogBuffer();
        await this.flushAuditBuffer();
    }
    /**
     * Cleanup and shutdown logger
     */
    async shutdown() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        await this.flush();
    }
}
exports.Logger = Logger;
/**
 * Convenience functions for common logging patterns
 */
exports.logger = Logger.getInstance();
const logAgent = (level, agentId, message, context) => exports.logger.logAgent(level, agentId, message, context);
exports.logAgent = logAgent;
const logTask = (level, taskId, agentId, message, context) => exports.logger.logTask(level, taskId, agentId, message, context);
exports.logTask = logTask;
const logSession = (level, sessionId, message, context) => exports.logger.logSession(level, sessionId, message, context);
exports.logSession = logSession;
const audit = (action, context) => exports.logger.audit(action, context);
exports.audit = audit;
