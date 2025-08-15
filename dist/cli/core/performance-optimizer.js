"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceOptimizer = exports.TokenOptimizer = exports.QuietCacheLogger = void 0;
const perf_hooks_1 = require("perf_hooks");
class QuietCacheLogger {
    static logCacheSave(tokensSaved) {
        if (tokensSaved && tokensSaved > 0) {
            this.totalSavings += tokensSaved;
            process.stdout.write(this.CACHE_ICON);
        }
    }
    static getTotalSavings() {
        return this.totalSavings;
    }
    static resetSavings() {
        this.totalSavings = 0;
    }
}
exports.QuietCacheLogger = QuietCacheLogger;
QuietCacheLogger.CACHE_ICON = '💾';
QuietCacheLogger.totalSavings = 0;
class TokenOptimizer {
    constructor(config = {
        level: 'balanced',
        enablePredictive: true,
        enableMicroCache: true,
        maxCompressionRatio: 0.6
    }) {
        this.compressionDictionary = new Map();
        this.usagePatterns = new Map();
        this.config = config;
        this.initializeCompressionDictionary();
    }
    initializeCompressionDictionary() {
        this.compressionDictionary.set('function', 'fn');
        this.compressionDictionary.set('implement', 'impl');
        this.compressionDictionary.set('configuration', 'config');
        this.compressionDictionary.set('component', 'comp');
        this.compressionDictionary.set('interface', 'intfc');
        this.compressionDictionary.set('performance', 'perf');
        this.compressionDictionary.set('optimization', 'opt');
        this.compressionDictionary.set('application', 'app');
        this.compressionDictionary.set('development', 'dev');
        this.compressionDictionary.set('management', 'mgmt');
    }
    async optimizePrompt(input) {
        const originalTokens = this.estimateTokens(input);
        let optimized = input;
        switch (this.config.level) {
            case 'conservative':
                optimized = this.conservativeOptimization(input);
                break;
            case 'balanced':
                optimized = this.balancedOptimization(input);
                break;
            case 'aggressive':
                optimized = this.aggressiveOptimization(input);
                break;
        }
        const optimizedTokens = this.estimateTokens(optimized);
        const tokensSaved = originalTokens - optimizedTokens;
        const compressionRatio = optimizedTokens / originalTokens;
        if (tokensSaved > 5) {
            QuietCacheLogger.logCacheSave(tokensSaved);
        }
        return {
            content: optimized,
            originalTokens,
            optimizedTokens,
            tokensSaved,
            compressionRatio
        };
    }
    conservativeOptimization(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/\b(um|uh|well)\b/gi, '')
            .trim();
    }
    balancedOptimization(text) {
        let optimized = this.conservativeOptimization(text);
        this.compressionDictionary.forEach((short, full) => {
            const regex = new RegExp(`\\b${full}\\b`, 'gi');
            optimized = optimized.replace(regex, short);
        });
        optimized = optimized
            .replace(/\b(please note that|it should be noted)\b/gi, '')
            .replace(/\b(in my opinion|I think|I believe)\b/gi, '')
            .replace(/\bfor example\b/gi, 'e.g.')
            .replace(/\bthat is\b/gi, 'i.e.');
        return optimized.replace(/\s+/g, ' ').trim();
    }
    aggressiveOptimization(text) {
        let optimized = this.balancedOptimization(text);
        optimized = optimized
            .replace(/\b(very|really|quite|extremely)\s+/gi, '')
            .replace(/\b(basically|essentially|fundamentally)\b/gi, '')
            .replace(/\b(you should|you must|you need to)\b/gi, '')
            .replace(/\bin order to\b/gi, 'to')
            .replace(/\band so on\b/gi, 'etc.');
        return optimized.replace(/\s+/g, ' ').trim();
    }
    estimateTokens(text) {
        if (!text)
            return 0;
        const words = text.split(/\s+/).filter(word => word.length > 0);
        const specialChars = (text.match(/[{}[\](),.;:!?'"]/g) || []).length;
        return Math.ceil((words.length + specialChars * 0.5) * 1.3);
    }
}
exports.TokenOptimizer = TokenOptimizer;
class PerformanceOptimizer {
    constructor(optimizationConfig) {
        this.metrics = new Map();
        this.startTime = 0;
        this.tokenOptimizer = new TokenOptimizer(optimizationConfig);
    }
    startMonitoring() {
        this.startTime = perf_hooks_1.performance.now();
    }
    endMonitoring(sessionId, metrics) {
        const processingTime = perf_hooks_1.performance.now() - this.startTime;
        const fullMetrics = {
            tokenCount: metrics.tokenCount || 0,
            processingTime,
            cacheHitRate: metrics.cacheHitRate || 0,
            toolCallCount: metrics.toolCallCount || 0,
            responseQuality: metrics.responseQuality || 0
        };
        this.metrics.set(sessionId, fullMetrics);
        return fullMetrics;
    }
    async optimizeMessages(messages) {
        const optimized = [...messages];
        const systemMessages = optimized.filter(msg => msg.role === 'system');
        if (systemMessages.length > 1) {
            const mergedSystemContent = systemMessages.map(msg => msg.content).join('\n\n');
            optimized.splice(0, systemMessages.length, {
                role: 'system',
                content: mergedSystemContent
            });
        }
        for (let i = 0; i < optimized.length; i++) {
            if (typeof optimized[i].content === 'string') {
                const result = await this.tokenOptimizer.optimizePrompt(optimized[i].content);
                optimized[i].content = result.content;
            }
        }
        return optimized;
    }
    getTokenOptimizer() {
        return this.tokenOptimizer;
    }
    async optimizeText(text) {
        return this.tokenOptimizer.optimizePrompt(text);
    }
    getRecommendations(sessionId) {
        const metrics = this.metrics.get(sessionId);
        if (!metrics)
            return [];
        const recommendations = [];
        if (metrics.processingTime > 10000) {
            recommendations.push('Consider using caching for repeated queries');
        }
        if (metrics.tokenCount > 50000) {
            recommendations.push('Reduce context size to improve response time');
        }
        if (metrics.toolCallCount > 10) {
            recommendations.push('Batch tool calls to reduce overhead');
        }
        if (metrics.cacheHitRate < 0.3) {
            recommendations.push('Enable more aggressive caching strategies');
        }
        return recommendations;
    }
    analyzeResponseQuality(response) {
        let quality = 0;
        if (response.includes('```') || response.includes('**'))
            quality += 20;
        if (response.includes('1.') || response.includes('•') || response.includes('-'))
            quality += 20;
        if (response.includes('const ') || response.includes('function ') || response.includes('import '))
            quality += 20;
        if (response.includes('because') || response.includes('therefore') || response.includes('however'))
            quality += 20;
        if (response.length > 100 && response.length < 2000)
            quality += 20;
        return Math.min(100, quality);
    }
    getPerformanceSummary() {
        const sessions = Array.from(this.metrics.values());
        if (sessions.length === 0)
            return 'No performance data available';
        const avgProcessingTime = sessions.reduce((sum, m) => sum + m.processingTime, 0) / sessions.length;
        const avgTokenCount = sessions.reduce((sum, m) => sum + m.tokenCount, 0) / sessions.length;
        const avgCacheHitRate = sessions.reduce((sum, m) => sum + m.cacheHitRate, 0) / sessions.length;
        return `Performance Summary:
- Average processing time: ${avgProcessingTime.toFixed(2)}ms
- Average token count: ${avgTokenCount.toFixed(0)}
- Average cache hit rate: ${(avgCacheHitRate * 100).toFixed(1)}%
- Total sessions analyzed: ${sessions.length}`;
    }
}
exports.PerformanceOptimizer = PerformanceOptimizer;
