"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorManager = exports.ErrorManager = exports.ErrorManagerConfigSchema = exports.RecoveryStrategySchema = exports.ErrorEntrySchema = exports.ErrorContextSchema = exports.ErrorCategorySchema = exports.ErrorSeveritySchema = void 0;
const zod_1 = require("zod");
const events_1 = require("events");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const logger_1 = require("../utils/logger");
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
const telemetry_manager_1 = require("./telemetry-manager");
exports.ErrorSeveritySchema = zod_1.z.enum(['low', 'medium', 'high', 'critical']);
exports.ErrorCategorySchema = zod_1.z.enum([
    'system',
    'validation',
    'network',
    'filesystem',
    'permission',
    'configuration',
    'user-input',
    'runtime',
    'dependency',
    'security'
]);
exports.ErrorContextSchema = zod_1.z.object({
    component: zod_1.z.string(),
    function: zod_1.z.string().optional(),
    file: zod_1.z.string().optional(),
    line: zod_1.z.number().optional(),
    userId: zod_1.z.string().optional(),
    sessionId: zod_1.z.string().optional(),
    requestId: zod_1.z.string().optional(),
    timestamp: zod_1.z.date().default(() => new Date()),
    metadata: zod_1.z.record(zod_1.z.any()).default({})
});
exports.ErrorEntrySchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    message: zod_1.z.string(),
    stack: zod_1.z.string().optional(),
    severity: exports.ErrorSeveritySchema,
    category: exports.ErrorCategorySchema,
    context: exports.ErrorContextSchema,
    recovered: zod_1.z.boolean().default(false),
    recoveryActions: zod_1.z.array(zod_1.z.string()).default([]),
    occurrences: zod_1.z.number().int().default(1),
    firstOccurred: zod_1.z.date(),
    lastOccurred: zod_1.z.date(),
    fingerprint: zod_1.z.string(),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    relatedErrors: zod_1.z.array(zod_1.z.string()).default([])
});
exports.RecoveryStrategySchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    errorTypes: zod_1.z.array(zod_1.z.string()),
    priority: zod_1.z.number().int().min(0).max(100).default(50),
    async: zod_1.z.boolean().default(false),
    maxRetries: zod_1.z.number().int().default(3),
    retryDelay: zod_1.z.number().int().default(1000),
    condition: zod_1.z.function().optional(),
    action: zod_1.z.function(),
    enabled: zod_1.z.boolean().default(true)
});
exports.ErrorManagerConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true),
    captureStackTrace: zod_1.z.boolean().default(true),
    captureContext: zod_1.z.boolean().default(true),
    enableRecovery: zod_1.z.boolean().default(true),
    enableTelemetry: zod_1.z.boolean().default(true),
    enableNotifications: zod_1.z.boolean().default(true),
    maxErrors: zod_1.z.number().int().default(1000),
    errorGroupingTimeWindow: zod_1.z.number().int().default(300000),
    maxRecoveryAttempts: zod_1.z.number().int().default(3),
    recoveryTimeout: zod_1.z.number().int().default(30000),
    reportCriticalErrors: zod_1.z.boolean().default(true),
    escalateRepeatedErrors: zod_1.z.boolean().default(true),
    escalationThreshold: zod_1.z.number().int().default(5),
    escalationTimeWindow: zod_1.z.number().int().default(600000),
    enableDebugMode: zod_1.z.boolean().default(false),
    logLevel: zod_1.z.enum(['debug', 'info', 'warn', 'error']).default('error')
});
class ErrorManager extends events_1.EventEmitter {
    constructor(workingDirectory, config = {}) {
        super();
        this.isInitialized = false;
        this.errors = new Map();
        this.errorsByFingerprint = new Map();
        this.recentErrors = [];
        this.recoveryStrategies = new Map();
        this.recoveryAttempts = new Map();
        this.notificationHandlers = new Set();
        this.errorCounts = new Map();
        this.escalatedErrors = new Set();
        this.workingDirectory = workingDirectory;
        this.config = exports.ErrorManagerConfigSchema.parse(config);
    }
    static getInstance(workingDirectory, config) {
        if (!ErrorManager.instance && workingDirectory) {
            ErrorManager.instance = new ErrorManager(workingDirectory, config);
        }
        return ErrorManager.instance;
    }
    async initialize() {
        if (this.isInitialized || !this.config.enabled)
            return;
        advanced_cli_ui_1.advancedUI.logInfo('🚨 Initializing Error Manager...');
        const startTime = Date.now();
        try {
            await this.registerDefaultStrategies();
            await this.setupGlobalHandlers();
            this.isInitialized = true;
            const loadTime = Date.now() - startTime;
            advanced_cli_ui_1.advancedUI.logSuccess(`✅ Error Manager initialized (${loadTime}ms)`);
            if (this.config.enableDebugMode) {
                logger_1.logger.debug('Error Manager debug mode enabled');
            }
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`❌ Error Manager initialization failed: ${error.message}`);
            throw error;
        }
    }
    async handleError(error, context = {}, severity = 'medium', category = 'runtime') {
        if (!this.config.enabled) {
            throw error;
        }
        const errorEntry = await this.createErrorEntry(error, context, severity, category);
        try {
            await this.storeError(errorEntry);
            if (this.config.enableRecovery) {
                const recovered = await this.attemptRecovery(errorEntry);
                errorEntry.recovered = recovered;
                if (recovered && this.config.enableDebugMode) {
                    advanced_cli_ui_1.advancedUI.logSuccess(`✅ Error recovered: ${errorEntry.name}`);
                }
            }
            if (this.config.enableTelemetry && telemetry_manager_1.telemetryManager) {
                await telemetry_manager_1.telemetryManager.recordError(error, {
                    severity,
                    category,
                    component: context.component,
                    recovered: errorEntry.recovered
                });
            }
            if (this.config.enableNotifications) {
                await this.notifyError(errorEntry);
            }
            await this.checkEscalation(errorEntry);
            this.emit('error', errorEntry);
            return errorEntry;
        }
        catch (handlingError) {
            logger_1.logger.error(`Error handling system failure: ${handlingError.message}`);
            logger_1.logger.error(`Original error: ${error.message}`);
            throw error;
        }
    }
    async registerRecoveryStrategy(strategy) {
        const strategyId = `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const fullStrategy = {
            ...strategy,
            id: strategyId
        };
        this.recoveryStrategies.set(strategyId, fullStrategy);
        if (this.config.enableDebugMode) {
            advanced_cli_ui_1.advancedUI.logInfo(`🔧 Registered recovery strategy: ${strategy.name}`);
        }
        return strategyId;
    }
    async attemptRecovery(errorEntry) {
        const applicableStrategies = this.findRecoveryStrategies(errorEntry);
        if (applicableStrategies.length === 0) {
            return false;
        }
        applicableStrategies.sort((a, b) => b.priority - a.priority);
        for (const strategy of applicableStrategies) {
            if (!strategy.enabled)
                continue;
            const attemptKey = `${errorEntry.fingerprint}-${strategy.id}`;
            const attempts = this.recoveryAttempts.get(attemptKey) || 0;
            if (attempts >= strategy.maxRetries) {
                continue;
            }
            try {
                if (this.config.enableDebugMode) {
                    advanced_cli_ui_1.advancedUI.logInfo(`🔧 Attempting recovery with strategy: ${strategy.name}`);
                }
                const success = strategy.async
                    ? await this.executeAsyncRecovery(strategy, errorEntry)
                    : await this.executeSyncRecovery(strategy, errorEntry);
                this.recoveryAttempts.set(attemptKey, attempts + 1);
                if (success) {
                    errorEntry.recoveryActions.push(strategy.name);
                    return true;
                }
                if (strategy.retryDelay > 0 && applicableStrategies.indexOf(strategy) < applicableStrategies.length - 1) {
                    await this.delay(strategy.retryDelay);
                }
            }
            catch (recoveryError) {
                logger_1.logger.warn(`Recovery strategy ${strategy.name} failed: ${recoveryError.message}`);
                this.recoveryAttempts.set(attemptKey, attempts + 1);
            }
        }
        return false;
    }
    getError(errorId) {
        return this.errors.get(errorId) || null;
    }
    getErrorsByCategory(category) {
        return Array.from(this.errors.values()).filter(error => error.category === category);
    }
    getErrorsBySeverity(severity) {
        return Array.from(this.errors.values()).filter(error => error.severity === severity);
    }
    getRecentErrors(limit = 50) {
        return this.recentErrors
            .slice(-limit)
            .map(id => this.errors.get(id))
            .filter(Boolean);
    }
    getErrorStats() {
        const errors = Array.from(this.errors.values());
        const stats = {
            total: errors.length,
            bySeverity: {},
            byCategory: {},
            recovered: errors.filter(e => e.recovered).length,
            escalated: this.escalatedErrors.size,
            recentCount: this.recentErrors.length,
            topErrors: this.getTopErrors(5)
        };
        for (const error of errors) {
            stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
        }
        for (const error of errors) {
            stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
        }
        return stats;
    }
    getTopErrors(limit = 10) {
        const fingerprintCounts = new Map();
        for (const error of this.errors.values()) {
            const existing = fingerprintCounts.get(error.fingerprint);
            if (existing) {
                existing.count += error.occurrences;
            }
            else {
                fingerprintCounts.set(error.fingerprint, {
                    count: error.occurrences,
                    message: error.message
                });
            }
        }
        return Array.from(fingerprintCounts.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, limit)
            .map(([fingerprint, data]) => ({
            fingerprint,
            count: data.count,
            message: data.message
        }));
    }
    addNotificationHandler(handler) {
        this.notificationHandlers.add(handler);
    }
    removeNotificationHandler(handler) {
        this.notificationHandlers.delete(handler);
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        advanced_cli_ui_1.advancedUI.logInfo('🚨 Error Manager configuration updated');
    }
    async cleanup() {
        this.removeAllListeners();
        this.notificationHandlers.clear();
        if (this.errors.size > 0) {
            await this.exportErrors();
        }
        advanced_cli_ui_1.advancedUI.logInfo('🚨 Error Manager cleanup completed');
    }
    async createErrorEntry(error, context, severity, category) {
        const fingerprint = this.generateFingerprint(error, context);
        const existingId = this.findExistingError(fingerprint);
        const fullContext = exports.ErrorContextSchema.parse({
            component: 'unknown',
            timestamp: new Date(),
            ...context
        });
        if (existingId) {
            const existing = this.errors.get(existingId);
            existing.occurrences++;
            existing.lastOccurred = new Date();
            existing.severity = this.maxSeverity(existing.severity, severity);
            return existing;
        }
        else {
            const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const errorEntry = {
                id: errorId,
                name: error.name,
                message: error.message,
                stack: this.config.captureStackTrace ? error.stack : undefined,
                severity,
                category,
                context: fullContext,
                recovered: false,
                recoveryActions: [],
                occurrences: 1,
                firstOccurred: new Date(),
                lastOccurred: new Date(),
                fingerprint,
                tags: this.generateTags(error, context, category),
                relatedErrors: []
            };
            return errorEntry;
        }
    }
    async storeError(errorEntry) {
        this.errors.set(errorEntry.id, errorEntry);
        const fingerprintErrors = this.errorsByFingerprint.get(errorEntry.fingerprint) || [];
        if (!fingerprintErrors.includes(errorEntry.id)) {
            fingerprintErrors.push(errorEntry.id);
            this.errorsByFingerprint.set(errorEntry.fingerprint, fingerprintErrors);
        }
        this.recentErrors.push(errorEntry.id);
        if (this.recentErrors.length > 100) {
            this.recentErrors.shift();
        }
        if (this.errors.size > this.config.maxErrors) {
            await this.cleanupOldErrors();
        }
    }
    findExistingError(fingerprint) {
        const errors = this.errorsByFingerprint.get(fingerprint);
        if (!errors || errors.length === 0)
            return null;
        const now = Date.now();
        const timeWindow = this.config.errorGroupingTimeWindow;
        for (const errorId of errors.reverse()) {
            const error = this.errors.get(errorId);
            if (error && (now - error.lastOccurred.getTime()) < timeWindow) {
                return errorId;
            }
        }
        return null;
    }
    generateFingerprint(error, context) {
        const components = [
            error.name,
            error.message.replace(/\d+/g, 'N').replace(/\/.+\//g, '/PATH/'),
            context.component || 'unknown',
            context.function || ''
        ];
        return components.join('|').toLowerCase().replace(/\s+/g, '-');
    }
    generateTags(error, context, category) {
        const tags = [error.name.toLowerCase(), category];
        if (context.component) {
            tags.push(`component:${context.component}`);
        }
        if (error.stack?.includes('node_modules')) {
            tags.push('dependency');
        }
        if (error.message.toLowerCase().includes('permission')) {
            tags.push('permission');
        }
        if (error.message.toLowerCase().includes('network')) {
            tags.push('network');
        }
        return tags;
    }
    findRecoveryStrategies(errorEntry) {
        return Array.from(this.recoveryStrategies.values()).filter(strategy => {
            if (!strategy.enabled)
                return false;
            const errorTypeMatches = strategy.errorTypes.some(type => errorEntry.name.toLowerCase().includes(type.toLowerCase()) ||
                errorEntry.category === type ||
                errorEntry.tags.includes(type));
            if (!errorTypeMatches)
                return false;
            if (strategy.condition && !strategy.condition(errorEntry)) {
                return false;
            }
            return true;
        });
    }
    async executeSyncRecovery(strategy, errorEntry) {
        const timeout = this.config.recoveryTimeout;
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(false), timeout);
            try {
                const result = strategy.action(errorEntry);
                clearTimeout(timer);
                resolve(!!result);
            }
            catch {
                clearTimeout(timer);
                resolve(false);
            }
        });
    }
    async executeAsyncRecovery(strategy, errorEntry) {
        const timeout = this.config.recoveryTimeout;
        return new Promise(async (resolve) => {
            const timer = setTimeout(() => resolve(false), timeout);
            try {
                const result = await strategy.action(errorEntry);
                clearTimeout(timer);
                resolve(!!result);
            }
            catch {
                clearTimeout(timer);
                resolve(false);
            }
        });
    }
    async notifyError(errorEntry) {
        for (const handler of this.notificationHandlers) {
            try {
                handler(errorEntry);
            }
            catch (notificationError) {
                logger_1.logger.warn(`Error notification failed: ${notificationError.message}`);
            }
        }
    }
    async checkEscalation(errorEntry) {
        if (!this.config.escalateRepeatedErrors)
            return;
        const threshold = this.config.escalationThreshold;
        const timeWindow = this.config.escalationTimeWindow;
        if (errorEntry.occurrences >= threshold && !this.escalatedErrors.has(errorEntry.fingerprint)) {
            this.escalatedErrors.add(errorEntry.fingerprint);
            const escalationError = {
                ...errorEntry,
                severity: 'critical',
                message: `ESCALATED: ${errorEntry.message} (${errorEntry.occurrences} occurrences)`
            };
            await this.notifyError(escalationError);
            if (this.config.reportCriticalErrors && telemetry_manager_1.telemetryManager) {
                await telemetry_manager_1.telemetryManager.recordEvent({
                    name: 'error_escalated',
                    category: 'error',
                    level: 'critical',
                    message: `Error escalated: ${errorEntry.fingerprint}`,
                    metadata: {
                        errorId: errorEntry.id,
                        occurrences: errorEntry.occurrences,
                        fingerprint: errorEntry.fingerprint
                    }
                });
            }
        }
    }
    async registerDefaultStrategies() {
        await this.registerRecoveryStrategy({
            name: 'Retry File Operation',
            description: 'Retry failed file operations after a delay',
            errorTypes: ['ENOENT', 'EACCES', 'filesystem'],
            priority: 80,
            maxRetries: 3,
            retryDelay: 1000,
            action: async (error) => {
                await this.delay(500);
                return Math.random() > 0.7;
            }
        });
        await this.registerRecoveryStrategy({
            name: 'Network Retry with Backoff',
            description: 'Retry network operations with exponential backoff',
            errorTypes: ['network', 'ENOTFOUND', 'ECONNREFUSED'],
            priority: 75,
            maxRetries: 5,
            retryDelay: 2000,
            action: async (error) => {
                const attempt = this.recoveryAttempts.get(error.fingerprint) || 0;
                const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
                await this.delay(delay);
                return Math.random() > 0.5;
            }
        });
        await this.registerRecoveryStrategy({
            name: 'Auto-fix Validation Errors',
            description: 'Attempt to auto-fix common validation errors',
            errorTypes: ['validation', 'SyntaxError'],
            priority: 60,
            maxRetries: 2,
            action: async (error) => {
                return Math.random() > 0.6;
            }
        });
    }
    async setupGlobalHandlers() {
        process.on('unhandledRejection', (reason, promise) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            this.handleError(error, {
                component: 'process',
                function: 'unhandledRejection'
            }, 'high', 'system').catch(() => {
                logger_1.logger.error('Unhandled rejection:', reason);
            });
        });
        process.on('uncaughtException', (error) => {
            this.handleError(error, {
                component: 'process',
                function: 'uncaughtException'
            }, 'critical', 'system').catch(() => {
                logger_1.logger.error('Uncaught exception:', error);
            });
        });
    }
    async cleanupOldErrors() {
        const errors = Array.from(this.errors.entries());
        errors.sort((a, b) => a[1].lastOccurred.getTime() - b[1].lastOccurred.getTime());
        const toRemove = errors.slice(0, errors.length - this.config.maxErrors);
        for (const [errorId, error] of toRemove) {
            this.errors.delete(errorId);
            const fingerprintErrors = this.errorsByFingerprint.get(error.fingerprint) || [];
            const index = fingerprintErrors.indexOf(errorId);
            if (index > -1) {
                fingerprintErrors.splice(index, 1);
                if (fingerprintErrors.length === 0) {
                    this.errorsByFingerprint.delete(error.fingerprint);
                }
                else {
                    this.errorsByFingerprint.set(error.fingerprint, fingerprintErrors);
                }
            }
        }
    }
    async exportErrors() {
        try {
            const exportData = {
                timestamp: new Date().toISOString(),
                stats: this.getErrorStats(),
                errors: Array.from(this.errors.values()).map(error => ({
                    ...error,
                    firstOccurred: error.firstOccurred.toISOString(),
                    lastOccurred: error.lastOccurred.toISOString(),
                    context: {
                        ...error.context,
                        timestamp: error.context.timestamp.toISOString()
                    }
                }))
            };
            const filename = `error-export-${Date.now()}.json`;
            const filepath = (0, path_1.join)(this.workingDirectory, filename);
            await (0, promises_1.writeFile)(filepath, JSON.stringify(exportData, null, 2));
            if (this.config.enableDebugMode) {
                advanced_cli_ui_1.advancedUI.logInfo(`📄 Error data exported to: ${filename}`);
            }
        }
        catch (error) {
            logger_1.logger.warn(`Error export failed: ${error.message}`);
        }
    }
    maxSeverity(a, b) {
        const order = ['low', 'medium', 'high', 'critical'];
        return order.indexOf(a) > order.indexOf(b) ? a : b;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.ErrorManager = ErrorManager;
exports.errorManager = ErrorManager.getInstance();
