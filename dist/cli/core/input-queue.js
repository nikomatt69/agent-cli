"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inputQueue = exports.InputQueue = void 0;
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
const chalk_1 = __importDefault(require("chalk"));
class InputQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.processingPromise = null;
        this.maxQueueSize = 50;
        this.processingTimeout = 300000;
        this.bypassEnabled = false;
    }
    static getInstance() {
        if (!InputQueue.instance) {
            InputQueue.instance = new InputQueue();
        }
        return InputQueue.instance;
    }
    enqueue(input, priority = 'normal', source = 'user') {
        const queuedInput = {
            id: `input-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            input,
            timestamp: new Date(),
            priority,
            source
        };
        if (this.queue.length >= this.maxQueueSize) {
            this.removeOldestLowPriority();
        }
        if (priority === 'high') {
            this.queue.unshift(queuedInput);
        }
        else if (priority === 'low') {
            this.queue.push(queuedInput);
        }
        else {
            const highPriorityCount = this.queue.filter(q => q.priority === 'high').length;
            this.queue.splice(highPriorityCount, 0, queuedInput);
        }
        advanced_cli_ui_1.advancedUI.logInfo(`📥 Input queued: ${input.substring(0, 30)}${input.length > 30 ? '...' : ''} (${this.queue.length} in queue)`);
        return queuedInput.id;
    }
    async processNext(processor) {
        if (this.queue.length === 0) {
            return null;
        }
        if (this.isProcessing) {
            return null;
        }
        this.isProcessing = true;
        const nextInput = this.queue.shift();
        try {
            advanced_cli_ui_1.advancedUI.logInfo(`🔄 Processing queued input: ${nextInput.input.substring(0, 30)}${nextInput.input.length > 30 ? '...' : ''}`);
            this.processingPromise = Promise.race([
                processor(nextInput.input),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Processing timeout')), this.processingTimeout))
            ]);
            await this.processingPromise;
            advanced_cli_ui_1.advancedUI.logSuccess(`✅ Queued input processed: ${nextInput.input.substring(0, 30)}${nextInput.input.length > 30 ? '...' : ''}`);
            return nextInput;
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`❌ Failed to process queued input: ${error.message}`);
            if (error.message.includes('timeout') || error.message.includes('network')) {
                this.queue.unshift(nextInput);
                advanced_cli_ui_1.advancedUI.logWarning(`🔄 Re-queued input due to temporary error`);
            }
            return nextInput;
        }
        finally {
            this.isProcessing = false;
            this.processingPromise = null;
        }
    }
    async processAll(processor) {
        let processedCount = 0;
        while (this.queue.length > 0) {
            const result = await this.processNext(processor);
            if (result) {
                processedCount++;
            }
            else {
                break;
            }
        }
        return processedCount;
    }
    removeById(id) {
        const index = this.queue.findIndex(q => q.id === id);
        if (index !== -1) {
            this.queue.splice(index, 1);
            advanced_cli_ui_1.advancedUI.logInfo(`🗑️ Removed input from queue: ${id}`);
            return true;
        }
        return false;
    }
    removeByContent(content) {
        const initialLength = this.queue.length;
        this.queue = this.queue.filter(q => q.input !== content);
        const removed = initialLength - this.queue.length;
        if (removed > 0) {
            advanced_cli_ui_1.advancedUI.logInfo(`🗑️ Removed ${removed} inputs from queue matching: ${content.substring(0, 30)}...`);
        }
        return removed;
    }
    clear() {
        const count = this.queue.length;
        this.queue = [];
        advanced_cli_ui_1.advancedUI.logInfo(`🗑️ Cleared ${count} inputs from queue`);
        return count;
    }
    getStatus() {
        return {
            isProcessing: this.isProcessing,
            queueLength: this.queue.length,
            pendingInputs: [...this.queue],
            lastProcessed: this.isProcessing ? undefined : new Date()
        };
    }
    getByPriority(priority) {
        return this.queue.filter(q => q.priority === priority);
    }
    getBySource(source) {
        return this.queue.filter(q => q.source === source);
    }
    removeOldestLowPriority() {
        const lowPriorityIndex = this.queue.findIndex(q => q.priority === 'low');
        if (lowPriorityIndex !== -1) {
            const removed = this.queue.splice(lowPriorityIndex, 1)[0];
            advanced_cli_ui_1.advancedUI.logWarning(`🗑️ Removed oldest low-priority input: ${removed.input.substring(0, 30)}...`);
        }
    }
    setMaxQueueSize(size) {
        this.maxQueueSize = Math.max(1, size);
        while (this.queue.length > this.maxQueueSize) {
            this.removeOldestLowPriority();
        }
    }
    setProcessingTimeout(timeout) {
        this.processingTimeout = timeout;
    }
    interrupt() {
        if (this.isProcessing && this.processingPromise) {
            advanced_cli_ui_1.advancedUI.logWarning(`⚠️ Interrupting current queue processing`);
            this.isProcessing = false;
            return true;
        }
        return false;
    }
    showStats() {
        const status = this.getStatus();
        const highPriority = this.getByPriority('high').length;
        const normalPriority = this.getByPriority('normal').length;
        const lowPriority = this.getByPriority('low').length;
        console.log(chalk_1.default.cyan('\n📊 Input Queue Statistics:'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        console.log(`Status: ${status.isProcessing ? chalk_1.default.yellow('Processing') : chalk_1.default.green('Idle')}`);
        console.log(`Queue Length: ${chalk_1.default.blue(status.queueLength)}`);
        console.log(`High Priority: ${chalk_1.default.red(highPriority)}`);
        console.log(`Normal Priority: ${chalk_1.default.yellow(normalPriority)}`);
        console.log(`Low Priority: ${chalk_1.default.green(lowPriority)}`);
        if (status.pendingInputs.length > 0) {
            console.log(chalk_1.default.cyan('\n📋 Pending Inputs:'));
            status.pendingInputs.slice(0, 5).forEach((input, index) => {
                const timeAgo = this.getTimeAgo(input.timestamp);
                console.log(`${index + 1}. ${chalk_1.default.gray(timeAgo)} ${input.input.substring(0, 40)}${input.input.length > 40 ? '...' : ''}`);
            });
            if (status.pendingInputs.length > 5) {
                console.log(chalk_1.default.gray(`   ... and ${status.pendingInputs.length - 5} more`));
            }
        }
        console.log(chalk_1.default.gray('─'.repeat(40)));
    }
    enableBypass() {
        this.bypassEnabled = true;
        advanced_cli_ui_1.advancedUI.logInfo(`🔓 Input queue bypass enabled for approvals`);
    }
    disableBypass() {
        this.bypassEnabled = false;
        advanced_cli_ui_1.advancedUI.logInfo(`🔒 Input queue bypass disabled`);
    }
    isBypassEnabled() {
        return this.bypassEnabled;
    }
    shouldQueue(input) {
        if (this.bypassEnabled) {
            return false;
        }
        const trimmed = input.trim().toLowerCase();
        const approvalInputs = ['y', 'n', 'yes', 'no', 'si', 'no', '1', '2', '0'];
        if (approvalInputs.includes(trimmed)) {
            return false;
        }
        return true;
    }
    getTimeAgo(timestamp) {
        const now = new Date();
        const diff = now.getTime() - timestamp.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ago`;
        }
        else if (minutes > 0) {
            return `${minutes}m ago`;
        }
        else {
            return `${seconds}s ago`;
        }
    }
}
exports.InputQueue = InputQueue;
exports.inputQueue = InputQueue.getInstance();
