"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextManager = exports.ContextManager = void 0;
const chalk_1 = __importDefault(require("chalk"));
/** Intelligent Context Manager with token optimization */
class ContextManager {
    constructor() {
        this.MAX_TOKENS = 180000; // Leave buffer for response
        this.MIN_MESSAGES = 4; // Always keep recent messages
        this.COMPRESSION_THRESHOLD = 150000; // Start compression
        this.messageMetrics = new Map();
    }
    /**
     * Estimate tokens in a message (rough approximation)
     * 1 token ≈ 4 characters for English text
     */
    estimateTokens(content) {
        return Math.ceil(content.length / 4);
    }
    /**
     * Calculate importance score for a message
     */
    calculateImportance(message, index, total) {
        let importance = 0;
        // Recent messages are more important
        const recency = (total - index) / total;
        importance += recency * 0.4;
        // Message type importance
        if (message.role === 'system')
            importance += 0.3;
        if (message.role === 'user')
            importance += 0.2;
        if (message.role === 'assistant')
            importance += 0.1;
        // Content-based importance
        const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        // Important keywords boost importance
        const importantKeywords = ['error', 'bug', 'fix', 'implement', 'create', 'modify', 'delete', 'update'];
        const keywordCount = importantKeywords.filter(kw => content.toLowerCase().includes(kw)).length;
        importance += keywordCount * 0.05;
        // Length penalty for very long messages
        if (content.length > 5000)
            importance -= 0.1;
        return Math.max(0, Math.min(1, importance));
    }
    /**
     * Optimize message context to fit within token limits
     */
    optimizeContext(messages) {
        if (messages.length === 0) {
            return {
                optimizedMessages: messages,
                metrics: { totalMessages: 0, estimatedTokens: 0, tokenLimit: this.MAX_TOKENS, compressionRatio: 0 }
            };
        }
        // Calculate metrics for all messages
        let totalTokens = 0;
        messages.forEach((message, index) => {
            const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
            const tokens = this.estimateTokens(content);
            const importance = this.calculateImportance(message, index, messages.length);
            totalTokens += tokens;
            this.messageMetrics.set(`${index}-${Date.now()}`, {
                estimatedTokens: tokens,
                importance,
                timestamp: new Date(),
                type: message.role
            });
        });
        // If within limits, return as-is
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
        // Optimization strategy
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
    /**
     * Compress context using intelligent strategies
     */
    compressContext(messages) {
        const optimized = [];
        let currentTokens = 0;
        // Always keep system messages
        const systemMessages = messages.filter(m => m.role === 'system');
        systemMessages.forEach(msg => {
            optimized.push(msg);
            currentTokens += this.getMessageTokens(msg);
        });
        // Keep the most recent messages
        const nonSystemMessages = messages.filter(m => m.role !== 'system');
        const recentMessages = nonSystemMessages.slice(-this.MIN_MESSAGES);
        recentMessages.forEach(msg => {
            optimized.push(msg);
            currentTokens += this.getMessageTokens(msg);
        });
        // Add older messages based on importance until we hit the limit
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
                optimized.splice(-this.MIN_MESSAGES, 0, item.message); // Insert before recent messages
                currentTokens += item.tokens;
            }
        }
        // If still over limit, summarize middle conversations
        if (currentTokens > this.MAX_TOKENS) {
            return this.createSummaryContext(optimized);
        }
        return optimized;
    }
    /**
     * Create a summarized context when compression isn't enough
     */
    createSummaryContext(messages) {
        const systemMessages = messages.filter(m => m.role === 'system');
        const nonSystemMessages = messages.filter(m => m.role !== 'system');
        // Keep first few and last few messages, summarize the middle
        const keepStart = 2;
        const keepEnd = 3;
        if (nonSystemMessages.length <= keepStart + keepEnd) {
            return messages;
        }
        const startMessages = nonSystemMessages.slice(0, keepStart);
        const endMessages = nonSystemMessages.slice(-keepEnd);
        const middleMessages = nonSystemMessages.slice(keepStart, -keepEnd);
        // Create summary of middle messages
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
    /**
     * Create a concise summary of middle messages
     */
    createMiddleSummary(messages) {
        const topics = new Set();
        const actions = new Set();
        messages.forEach(msg => {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            // Extract key topics and actions
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
    /**
     * Calculate total tokens for message array
     */
    calculateTotalTokens(messages) {
        return messages.reduce((total, msg) => total + this.getMessageTokens(msg), 0);
    }
    /**
     * Get token count for a single message
     */
    getMessageTokens(message) {
        const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        return this.estimateTokens(content);
    }
    /**
     * Get context metrics
     */
    getContextMetrics(messages) {
        const totalTokens = this.calculateTotalTokens(messages);
        return {
            totalMessages: messages.length,
            estimatedTokens: totalTokens,
            tokenLimit: this.MAX_TOKENS,
            compressionRatio: totalTokens > this.MAX_TOKENS ? (totalTokens - this.MAX_TOKENS) / totalTokens : 0
        };
    }
    /** Analyze workspace at cwd and return summary. */
    async analyzeWorkspace() {
        // Placeholder: implement real scanning
        return {
            totalFiles: 0,
            totalDirs: 0,
            languages: {},
            importantFiles: [],
        };
    }
}
exports.ContextManager = ContextManager;
// Export singleton instance
exports.contextManager = new ContextManager();
