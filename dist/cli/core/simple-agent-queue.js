"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentQueue = exports.SimpleAgentQueue = void 0;
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
class SimpleAgentQueue {
    constructor() {
        this.fileOperations = new Map();
        this.operationHistory = [];
        this.MAX_HISTORY = 50;
    }
    static getInstance() {
        if (!SimpleAgentQueue.instance) {
            SimpleAgentQueue.instance = new SimpleAgentQueue();
        }
        return SimpleAgentQueue.instance;
    }
    async executeWithLock(operation, fn) {
        const operationId = `${operation.agentId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        if (operation.type === 'write' && operation.filePath) {
            await this.waitForFileLock(operation.filePath);
        }
        const queuedOp = {
            id: operationId,
            type: operation.type,
            filePath: operation.filePath,
            agentId: operation.agentId,
            promise: fn(),
            startTime: Date.now()
        };
        if (operation.filePath && operation.type === 'write') {
            this.fileOperations.set(operation.filePath, queuedOp);
            advanced_cli_ui_1.advancedUI.logInfo(`🔒 File locked for writing: ${operation.filePath} by ${operation.agentId}`);
        }
        try {
            const result = await queuedOp.promise;
            if (operation.filePath && operation.type === 'write') {
                this.fileOperations.delete(operation.filePath);
                advanced_cli_ui_1.advancedUI.logInfo(`🔓 File unlocked: ${operation.filePath}`);
            }
            this.addToHistory(queuedOp);
            return result;
        }
        catch (error) {
            if (operation.filePath && operation.type === 'write') {
                this.fileOperations.delete(operation.filePath);
            }
            throw error;
        }
    }
    async waitForFileLock(filePath) {
        const existingOp = this.fileOperations.get(filePath);
        if (existingOp) {
            advanced_cli_ui_1.advancedUI.logInfo(`⏳ Waiting for file lock: ${filePath} (locked by ${existingOp.agentId})`);
            try {
                await Promise.race([
                    existingOp.promise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Lock timeout')), 15000))
                ]);
            }
            catch (error) {
                advanced_cli_ui_1.advancedUI.logWarning(`⚠️ Lock wait failed: ${error.message}`);
                this.fileOperations.delete(filePath);
            }
        }
    }
    addToHistory(operation) {
        this.operationHistory.push({
            ...operation,
            promise: Promise.resolve()
        });
        if (this.operationHistory.length > this.MAX_HISTORY) {
            this.operationHistory.shift();
        }
    }
    getStatus() {
        return {
            activeFileLocks: this.fileOperations.size,
            lockedFiles: Array.from(this.fileOperations.keys()),
            recentOperations: this.operationHistory.slice(-10).map(op => ({
                id: op.id,
                type: op.type,
                filePath: op.filePath,
                agentId: op.agentId,
                duration: Date.now() - op.startTime
            }))
        };
    }
    cleanupStaleLocks() {
        const now = Date.now();
        const staleThreshold = 60000;
        for (const [filePath, operation] of this.fileOperations) {
            if (now - operation.startTime > staleThreshold) {
                advanced_cli_ui_1.advancedUI.logWarning(`🧹 Removing stale lock: ${filePath}`);
                this.fileOperations.delete(filePath);
            }
        }
    }
    forceUnlock(filePath) {
        return this.fileOperations.delete(filePath);
    }
}
exports.SimpleAgentQueue = SimpleAgentQueue;
exports.agentQueue = SimpleAgentQueue.getInstance();
