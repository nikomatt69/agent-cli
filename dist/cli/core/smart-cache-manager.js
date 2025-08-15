"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smartCache = exports.SmartCacheManager = void 0;
const chalk_1 = __importDefault(require("chalk"));
const crypto_1 = require("crypto");
const performance_optimizer_1 = require("./performance-optimizer");
class SmartCacheManager {
    constructor() {
        this.cache = new Map();
        this.strategies = new Map();
        this.accessPatterns = new Map();
        this.initializeDefaultStrategies();
    }
    initializeDefaultStrategies() {
        this.strategies.set('simple_commands', {
            name: 'Simple Commands',
            enabled: true,
            maxAge: 12 * 60 * 60 * 1000,
            maxSize: 50,
            similarityThreshold: 0.98,
            tags: ['command', 'simple', 'frequent'],
            conditions: [
                { type: 'content_length', value: 100, operator: 'less_than' },
                { type: 'request_type', value: ['help', 'status', 'list', 'info'], operator: 'contains' }
            ]
        });
        this.strategies.set('code_analysis', {
            name: 'Code Analysis',
            enabled: true,
            maxAge: 60 * 60 * 1000,
            maxSize: 30,
            similarityThreshold: 0.98,
            tags: ['analysis', 'code', 'review'],
            conditions: [
                { type: 'request_type', value: ['analyze', 'review', 'check'], operator: 'contains' },
                { type: 'content_length', value: 150, operator: 'greater_than' }
            ]
        });
        this.strategies.set('code_generation', {
            name: 'Code Generation',
            enabled: false,
            maxAge: 30 * 60 * 1000,
            maxSize: 10,
            similarityThreshold: 0.98,
            tags: ['generation', 'code', 'create'],
            conditions: [
                { type: 'request_type', value: ['create', 'generate', 'build'], operator: 'contains' }
            ]
        });
        this.strategies.set('frequent_questions', {
            name: 'Frequent Questions',
            enabled: true,
            maxAge: 3 * 24 * 60 * 60 * 1000,
            maxSize: 100,
            similarityThreshold: 0.98,
            tags: ['faq', 'help', 'common'],
            conditions: [
                { type: 'frequency', value: 2, operator: 'greater_than' }
            ]
        });
        this.strategies.set('tool_calls', {
            name: 'Tool Calls',
            enabled: true,
            maxAge: 15 * 60 * 1000,
            maxSize: 50,
            similarityThreshold: 0.98,
            tags: ['tool', 'execution', 'command'],
            conditions: [
                { type: 'request_type', value: ['run', 'execute', 'tool'], operator: 'contains' }
            ]
        });
    }
    shouldCache(content, context = '') {
        const normalizedContent = this.normalizeContent(content);
        for (const [strategyId, strategy] of this.strategies) {
            if (!strategy.enabled)
                continue;
            if (this.matchesStrategy(normalizedContent, context, strategy)) {
                return {
                    should: true,
                    strategy: strategyId,
                    reason: `Matches ${strategy.name} strategy`
                };
            }
        }
        return {
            should: false,
            reason: 'No matching cache strategy'
        };
    }
    matchesStrategy(content, context, strategy) {
        for (const condition of strategy.conditions) {
            if (!this.evaluateCondition(content, context, condition)) {
                return false;
            }
        }
        return true;
    }
    evaluateCondition(content, context, condition) {
        switch (condition.type) {
            case 'content_length':
                const length = content.length;
                return this.compare(length, condition.value, condition.operator);
            case 'request_type':
                const requestTypes = this.detectRequestType(content);
                return this.compare(requestTypes, condition.value, condition.operator);
            case 'user_pattern':
                return this.compare(content, condition.value, condition.operator);
            case 'frequency':
                const frequency = this.accessPatterns.get(content) || 0;
                return this.compare(frequency, condition.value, condition.operator);
            default:
                return false;
        }
    }
    detectRequestType(content) {
        const types = [];
        const lower = content.toLowerCase();
        if (lower.includes('help') || lower.includes('aiuto'))
            types.push('help');
        if (lower.includes('status') || lower.includes('stato'))
            types.push('status');
        if (lower.includes('list') || lower.includes('lista'))
            types.push('list');
        if (lower.includes('info') || lower.includes('informazioni'))
            types.push('info');
        if (lower.includes('analyze') || lower.includes('analizza'))
            types.push('analyze');
        if (lower.includes('review') || lower.includes('revisiona'))
            types.push('review');
        if (lower.includes('check') || lower.includes('controlla'))
            types.push('check');
        if (lower.includes('create') || lower.includes('crea'))
            types.push('create');
        if (lower.includes('generate') || lower.includes('genera'))
            types.push('generate');
        if (lower.includes('build') || lower.includes('costruisci'))
            types.push('build');
        if (lower.includes('run') || lower.includes('esegui'))
            types.push('run');
        if (lower.includes('execute') || lower.includes('esegui'))
            types.push('execute');
        if (lower.includes('tool') || lower.includes('strumento'))
            types.push('tool');
        return types;
    }
    compare(actual, expected, operator) {
        switch (operator) {
            case 'equals':
                return actual === expected;
            case 'contains':
                if (Array.isArray(expected)) {
                    return expected.some(exp => actual.includes(exp));
                }
                return actual.includes(expected);
            case 'greater_than':
                return actual > expected;
            case 'less_than':
                return actual < expected;
            case 'regex':
                return new RegExp(expected).test(actual);
            default:
                return false;
        }
    }
    normalizeContent(content) {
        return content
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }
    async getCachedResponse(content, context = '') {
        const cacheDecision = this.shouldCache(content, context);
        if (!cacheDecision.should) {
            return null;
        }
        const strategy = this.strategies.get(cacheDecision.strategy);
        if (!strategy)
            return null;
        const normalizedContent = this.normalizeContent(content);
        const normalizedContext = this.normalizeContent(context);
        for (const [id, entry] of this.cache) {
            const age = Date.now() - entry.timestamp.getTime();
            if (age > strategy.maxAge)
                continue;
            if (entry.strategy !== cacheDecision.strategy)
                continue;
            const contentSimilarity = this.calculateSimilarity(normalizedContent, this.normalizeContent(entry.content));
            const contextSimilarity = this.calculateSimilarity(normalizedContext, this.normalizeContent(entry.context));
            const overallSimilarity = (contentSimilarity * 0.7 + contextSimilarity * 0.3);
            if (overallSimilarity >= strategy.similarityThreshold) {
                entry.lastAccessed = new Date();
                entry.accessCount++;
                this.accessPatterns.set(content, (this.accessPatterns.get(content) || 0) + 1);
                entry.exactMatch = overallSimilarity >= 0.99;
                performance_optimizer_1.QuietCacheLogger.logCacheSave(entry.metadata.tokensSaved);
                return entry;
            }
        }
        return null;
    }
    async setCachedResponse(content, response, context = '', metadata = {}) {
        const cacheDecision = this.shouldCache(content, context);
        if (!cacheDecision.should) {
            return;
        }
        const strategy = this.strategies.get(cacheDecision.strategy);
        if (!strategy)
            return;
        if (this.cache.size >= strategy.maxSize) {
            this.evictOldEntries(strategy);
        }
        const entry = {
            id: this.generateId(),
            content,
            context,
            response,
            timestamp: new Date(),
            lastAccessed: new Date(),
            accessCount: 1,
            strategy: cacheDecision.strategy,
            tags: strategy.tags,
            metadata: {
                tokensSaved: metadata.tokensSaved || 0,
                responseTime: metadata.responseTime || 0,
                userSatisfaction: metadata.userSatisfaction
            }
        };
        this.cache.set(entry.id, entry);
        this.accessPatterns.set(content, (this.accessPatterns.get(content) || 0) + 1);
        performance_optimizer_1.QuietCacheLogger.logCacheSave(entry.metadata.tokensSaved);
    }
    evictOldEntries(strategy) {
        const entries = Array.from(this.cache.entries())
            .filter(([_, entry]) => entry.strategy === strategy.name)
            .sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());
        const toRemove = Math.ceil(entries.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
            this.cache.delete(entries[i][0]);
        }
    }
    calculateSimilarity(text1, text2) {
        const words1 = new Set(text1.split(/\s+/));
        const words2 = new Set(text2.split(/\s+/));
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        return intersection.size / union.size;
    }
    generateId() {
        return `cache_${Date.now()}_${(0, crypto_1.randomBytes)(6).toString('base64url')}`;
    }
    getCacheStats() {
        const stats = {};
        for (const [strategyId, strategy] of this.strategies) {
            const entries = Array.from(this.cache.values()).filter(e => e.strategy === strategyId);
            stats[strategyId] = {
                name: strategy.name,
                enabled: strategy.enabled,
                entries: entries.length,
                totalAccesses: entries.reduce((sum, e) => sum + e.accessCount, 0),
                avgTokensSaved: entries.reduce((sum, e) => sum + e.metadata.tokensSaved, 0) / entries.length || 0
            };
        }
        return stats;
    }
    cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [id, entry] of this.cache) {
            const strategy = this.strategies.get(entry.strategy);
            if (!strategy)
                continue;
            const age = now - entry.timestamp.getTime();
            if (age > strategy.maxAge) {
                this.cache.delete(id);
                removed++;
            }
        }
    }
    setStrategyEnabled(strategyId, enabled) {
        const strategy = this.strategies.get(strategyId);
        if (strategy) {
            strategy.enabled = enabled;
        }
    }
    showStatus() {
        console.log(chalk_1.default.blue('\n📊 Smart Cache Status:'));
        const stats = this.getCacheStats();
        for (const [strategyId, stat] of Object.entries(stats)) {
            const typedStat = stat;
            const status = typedStat.enabled ? chalk_1.default.green('✅') : chalk_1.default.red('❌');
            console.log(`${status} ${typedStat.name}: ${typedStat.entries} entries, ${typedStat.totalAccesses} accesses`);
        }
    }
}
exports.SmartCacheManager = SmartCacheManager;
exports.smartCache = new SmartCacheManager();
