"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextManager = exports.ContextManager = void 0;
const chalk_1 = __importDefault(require("chalk"));
class ContextManager {
    constructor() {
        this.MAX_TOKENS = 180000;
        this.MIN_MESSAGES = 4;
        this.MAX_METRICS_SIZE = 1000;
        this.messageMetrics = new Map();
    }
    checkMetricsSize() {
        const currentSize = this.messageMetrics.size;
        if (currentSize <= this.MAX_METRICS_SIZE) {
            return;
        }
        const numEntriesToRemove = currentSize - this.MAX_METRICS_SIZE;
        let removedCount = 0;
        const keysIterator = this.messageMetrics.keys();
        while (removedCount < numEntriesToRemove) {
            const nextKey = keysIterator.next();
            if (nextKey.done) {
                break;
            }
            this.messageMetrics.delete(nextKey.value);
            removedCount += 1;
        }
        if (removedCount > 0) {
            console.log(chalk_1.default.yellow(`⚠️ Trimmed ${removedCount} oldest message metrics to cap at ${this.MAX_METRICS_SIZE}`));
        }
    }
    estimateTokens(content) {
        return Math.ceil(content.length / 4);
    }
    hashMessage(message) {
        const content = typeof message.content === 'string'
            ? message.content
            : JSON.stringify(message.content);
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `msg-${message.role}-${hash}`;
    }
    calculateImportance(message, index, total) {
        let importance = 0;
        const recency = (total - index) / total;
        importance += recency * 0.4;
        if (message.role === 'system')
            importance += 0.3;
        if (message.role === 'user')
            importance += 0.2;
        if (message.role === 'assistant')
            importance += 0.1;
        const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        const importantKeywords = ['error', 'bug', 'fix', 'implement', 'create', 'modify', 'delete', 'update'];
        const keywordCount = importantKeywords.filter(kw => content.toLowerCase().includes(kw)).length;
        importance += keywordCount * 0.05;
        if (content.length > 5000)
            importance -= 0.1;
        return Math.max(0, Math.min(1, importance));
    }
    optimizeContext(messages) {
        this.checkMetricsSize();
        if (messages.length === 0) {
            return {
                optimizedMessages: messages,
                metrics: { totalMessages: 0, estimatedTokens: 0, tokenLimit: this.MAX_TOKENS, compressionRatio: 0 }
            };
        }
        let totalTokens = 0;
        messages.forEach((message, index) => {
            const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
            const tokens = this.estimateTokens(content);
            const importance = this.calculateImportance(message, index, messages.length);
            totalTokens += tokens;
            const contentHash = this.hashMessage(message);
            this.messageMetrics.set(contentHash, {
                estimatedTokens: tokens,
                importance,
                timestamp: new Date(),
                type: message.role
            });
        });
        if (totalTokens <= this.MAX_TOKENS) {
            return {
                optimizedMessages: messages,
                metrics: {
                    totalMessages: messages.length,
                    estimatedTokens: totalTokens,
                    tokenLimit: this.MAX_TOKENS,
                    compressionRatio: 0
                }
            };
        }
        console.log(chalk_1.default.yellow(`⚠️ Context optimization needed: ${totalTokens} tokens > ${this.MAX_TOKENS} limit`));
        const optimized = this.compressContext(messages);
        const optimizedTokens = this.calculateTotalTokens(optimized);
        console.log(chalk_1.default.green(`✅ Context optimized: ${messages.length} → ${optimized.length} messages, ${totalTokens} → ${optimizedTokens} tokens`));
        return {
            optimizedMessages: optimized,
            metrics: {
                totalMessages: optimized.length,
                estimatedTokens: optimizedTokens,
                tokenLimit: this.MAX_TOKENS,
                compressionRatio: (totalTokens - optimizedTokens) / totalTokens
            }
        };
    }
    compressContext(messages) {
        const optimized = [];
        let currentTokens = 0;
        const systemMessages = messages.filter(m => m.role === 'system');
        systemMessages.forEach(msg => {
            optimized.push(msg);
            currentTokens += this.getMessageTokens(msg);
        });
        const nonSystemMessages = messages.filter(m => m.role !== 'system');
        const recentMessages = nonSystemMessages.slice(-this.MIN_MESSAGES);
        recentMessages.forEach(msg => {
            optimized.push(msg);
            currentTokens += this.getMessageTokens(msg);
        });
        const olderMessages = nonSystemMessages.slice(0, -this.MIN_MESSAGES);
        const sortedByImportance = olderMessages
            .map((msg, index) => ({
            message: msg,
            importance: this.calculateImportance(msg, index, olderMessages.length),
            tokens: this.getMessageTokens(msg)
        }))
            .sort((a, b) => b.importance - a.importance);
        for (const item of sortedByImportance) {
            if (currentTokens + item.tokens <= this.MAX_TOKENS) {
                optimized.splice(-this.MIN_MESSAGES, 0, item.message);
                currentTokens += item.tokens;
            }
        }
        if (currentTokens > this.MAX_TOKENS) {
            return this.createSummaryContext(optimized);
        }
        return optimized;
    }
    createSummaryContext(messages) {
        const systemMessages = messages.filter(m => m.role === 'system');
        const nonSystemMessages = messages.filter(m => m.role !== 'system');
        const keepStart = 2;
        const keepEnd = 3;
        if (nonSystemMessages.length <= keepStart + keepEnd) {
            return messages;
        }
        const startMessages = nonSystemMessages.slice(0, keepStart);
        const endMessages = nonSystemMessages.slice(-keepEnd);
        const middleMessages = nonSystemMessages.slice(keepStart, -keepEnd);
        const summaryContent = this.createMiddleSummary(middleMessages);
        const summaryMessage = {
            role: 'system',
            content: `[CONTEXT SUMMARY] Previous conversation (${middleMessages.length} messages): ${summaryContent}`
        };
        return [
            ...systemMessages,
            ...startMessages,
            summaryMessage,
            ...endMessages
        ];
    }
    createMiddleSummary(messages) {
        const topics = new Set();
        const actions = new Set();
        messages.forEach(msg => {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            if (content.includes('file') || content.includes('create') || content.includes('modify')) {
                actions.add('file operations');
            }
            if (content.includes('bug') || content.includes('error') || content.includes('fix')) {
                actions.add('bug fixing');
            }
            if (content.includes('implement') || content.includes('add') || content.includes('feature')) {
                actions.add('feature development');
            }
            if (content.includes('test') || content.includes('spec')) {
                actions.add('testing');
            }
        });
        const summary = [
            actions.size > 0 ? `Actions: ${Array.from(actions).join(', ')}` : '',
            `${messages.length} messages processed`
        ].filter(Boolean).join('. ');
        return summary;
    }
    calculateTotalTokens(messages) {
        return messages.reduce((total, msg) => total + this.getMessageTokens(msg), 0);
    }
    getMessageTokens(message) {
        const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        return this.estimateTokens(content);
    }
    getContextMetrics(messages) {
        const totalTokens = this.calculateTotalTokens(messages);
        return {
            totalMessages: messages.length,
            estimatedTokens: totalTokens,
            tokenLimit: this.MAX_TOKENS,
            compressionRatio: 0
        };
    }
    async analyzeWorkspace() {
        return {
            totalFiles: 0,
            totalDirs: 0,
            languages: {},
            importantFiles: [],
        };
    }
}
exports.ContextManager = ContextManager;
exports.contextManager = new ContextManager();
