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
exports.completionCache = exports.CompletionProtocolCache = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const chalk_1 = __importDefault(require("chalk"));
const performance_optimizer_1 = require("./performance-optimizer");
class CompletionProtocolCache {
    constructor(cacheDir = './.nikcli') {
        this.patterns = new Map();
        this.prefixIndex = new Map();
        this.contextIndex = new Map();
        this.maxPatterns = 1000;
        this.minConfidence = 0.6;
        this.prefixMinLength = 8;
        this.maxAge = 7 * 24 * 60 * 60 * 1000;
        this.cacheFile = path.join(cacheDir, 'completion-cache.json');
        this.loadCache();
    }
    async getCompletion(request) {
        const { prefix, context, maxTokens, model } = request;
        const normalizedPrefix = this.normalizePrefix(prefix);
        const prefixKey = this.generatePrefixKey(normalizedPrefix);
        if (!this.prefixIndex.has(prefixKey)) {
            return null;
        }
        const candidateIds = this.prefixIndex.get(prefixKey) || [];
        const candidates = [];
        for (const id of candidateIds) {
            const pattern = this.patterns.get(id);
            if (!pattern)
                continue;
            if (pattern.modelSignature !== model)
                continue;
            const age = Date.now() - new Date(pattern.lastUsed).getTime();
            if (age > this.maxAge)
                continue;
            const contextSimilarity = this.calculateContextSimilarity(context, pattern.contextHash);
            if (contextSimilarity < 0.95)
                continue;
            const prefixMatch = this.calculatePrefixMatch(prefix, pattern.prefix);
            if (prefixMatch < 0.98)
                continue;
            const overallConfidence = (contextSimilarity * 0.4 + prefixMatch * 0.6) * pattern.confidence;
            if (overallConfidence >= this.minConfidence) {
                candidates.push({
                    ...pattern,
                    confidence: overallConfidence
                });
            }
        }
        if (candidates.length === 0) {
            return null;
        }
        candidates.sort((a, b) => {
            const scoreA = a.confidence * 0.7 + (a.frequency / 100) * 0.3;
            const scoreB = b.confidence * 0.7 + (b.frequency / 100) * 0.3;
            return scoreB - scoreA;
        });
        const bestPattern = candidates[0];
        const completion = this.generateCompletionFromPattern(bestPattern, prefix, maxTokens);
        bestPattern.frequency++;
        bestPattern.lastUsed = new Date();
        this.patterns.set(bestPattern.id, bestPattern);
        const tokensSaved = this.estimateTokens(prefix + completion);
        performance_optimizer_1.QuietCacheLogger.logCacheSave(tokensSaved);
        const exactMatch = bestPattern.confidence >= 0.99;
        return {
            completion,
            fromCache: true,
            confidence: bestPattern.confidence,
            tokensSaved,
            patternId: bestPattern.id,
            exactMatch
        };
    }
    async storeCompletion(request, completion, actualTokens) {
        const { prefix, context, model } = request;
        if (completion.length < 20)
            return;
        const normalizedPrefix = this.normalizePrefix(prefix);
        const contextHash = this.generateContextHash(context);
        const suffix = this.extractSuffix(completion);
        const pattern = {
            id: this.generatePatternId(normalizedPrefix, completion),
            prefix: normalizedPrefix,
            suffix,
            contextHash,
            completionTokens: this.tokenizeCompletion(completion),
            confidence: 0.9,
            frequency: 1,
            lastUsed: new Date(),
            modelSignature: model,
            tags: this.extractTags(prefix, completion, context)
        };
        this.patterns.set(pattern.id, pattern);
        this.updateIndexes(pattern);
        await this.cleanupPatterns();
    }
    generateCompletionFromPattern(pattern, actualPrefix, maxTokens) {
        const tokens = pattern.completionTokens.slice(0, maxTokens);
        let completion = tokens.join('');
        const overlap = this.findPrefixOverlap(actualPrefix, completion);
        if (overlap > 0) {
            completion = completion.substring(overlap);
        }
        return completion;
    }
    normalizePrefix(prefix) {
        return prefix
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
            .substring(Math.max(0, prefix.length - 200));
    }
    extractSuffix(completion) {
        const lines = completion.split('\n');
        const firstLine = lines[0] || '';
        const suffix = firstLine.length > 50 ? firstLine.substring(0, 50) : completion.substring(0, 100);
        return suffix.trim();
    }
    tokenizeCompletion(completion) {
        return completion
            .split(/(\s+|[.!?;,])/g)
            .filter(token => token.trim().length > 0)
            .slice(0, 100);
    }
    generatePatternId(prefix, completion) {
        return crypto_1.default
            .createHash('md5')
            .update(prefix + completion.substring(0, 50))
            .digest('hex')
            .substring(0, 16);
    }
    generatePrefixKey(prefix) {
        if (prefix.length < this.prefixMinLength)
            return '';
        const words = prefix.split(/\s+/).slice(-5);
        return crypto_1.default
            .createHash('md5')
            .update(words.join(' '))
            .digest('hex')
            .substring(0, 12);
    }
    generateContextHash(context) {
        const normalized = context
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return crypto_1.default
            .createHash('sha256')
            .update(normalized.substring(0, 500))
            .digest('hex')
            .substring(0, 16);
    }
    calculateContextSimilarity(context1, contextHash2) {
        const hash1 = this.generateContextHash(context1);
        let matches = 0;
        for (let i = 0; i < Math.min(hash1.length, contextHash2.length); i++) {
            if (hash1[i] === contextHash2[i])
                matches++;
        }
        return matches / Math.max(hash1.length, contextHash2.length);
    }
    calculatePrefixMatch(prefix1, prefix2) {
        const norm1 = this.normalizePrefix(prefix1);
        const norm2 = this.normalizePrefix(prefix2);
        const distance = this.levenshteinDistance(norm1, norm2);
        const maxLength = Math.max(norm1.length, norm2.length);
        return 1 - (distance / maxLength);
    }
    findPrefixOverlap(prefix, completion) {
        const prefixEnd = prefix.slice(-20);
        const completionStart = completion.substring(0, 20);
        for (let i = Math.min(prefixEnd.length, completionStart.length); i > 0; i--) {
            if (prefixEnd.slice(-i) === completionStart.substring(0, i)) {
                return i;
            }
        }
        return 0;
    }
    extractTags(prefix, completion, context) {
        const tags = [];
        const combined = (prefix + ' ' + completion + ' ' + context).toLowerCase();
        if (combined.includes('function') || combined.includes('const ') || combined.includes('let ')) {
            tags.push('javascript');
        }
        if (combined.includes('def ') || combined.includes('import ') || combined.includes('class ')) {
            tags.push('python');
        }
        if (combined.includes('interface') || combined.includes('type ') || combined.includes('export ')) {
            tags.push('typescript');
        }
        if (combined.includes('todo') || combined.includes('plan') || combined.includes('task')) {
            tags.push('planning');
        }
        if (combined.includes('component') || combined.includes('react') || combined.includes('jsx')) {
            tags.push('react');
        }
        if (combined.includes('css') || combined.includes('style') || combined.includes('color')) {
            tags.push('styling');
        }
        return tags.slice(0, 5);
    }
    updateIndexes(pattern) {
        const prefixKey = this.generatePrefixKey(pattern.prefix);
        if (prefixKey) {
            if (!this.prefixIndex.has(prefixKey)) {
                this.prefixIndex.set(prefixKey, []);
            }
            this.prefixIndex.get(prefixKey).push(pattern.id);
        }
        if (!this.contextIndex.has(pattern.contextHash)) {
            this.contextIndex.set(pattern.contextHash, []);
        }
        this.contextIndex.get(pattern.contextHash).push(pattern.id);
    }
    async cleanupPatterns() {
        if (this.patterns.size <= this.maxPatterns)
            return;
        const patterns = Array.from(this.patterns.values());
        patterns.sort((a, b) => {
            const scoreA = a.frequency * 0.7 + (Date.now() - new Date(a.lastUsed).getTime()) * -0.3;
            const scoreB = b.frequency * 0.7 + (Date.now() - new Date(b.lastUsed).getTime()) * -0.3;
            return scoreB - scoreA;
        });
        const toRemove = patterns.slice(this.maxPatterns);
        for (const pattern of toRemove) {
            this.patterns.delete(pattern.id);
            const prefixKey = this.generatePrefixKey(pattern.prefix);
            if (this.prefixIndex.has(prefixKey)) {
                const ids = this.prefixIndex.get(prefixKey);
                const filtered = ids.filter(id => id !== pattern.id);
                if (filtered.length === 0) {
                    this.prefixIndex.delete(prefixKey);
                }
                else {
                    this.prefixIndex.set(prefixKey, filtered);
                }
            }
        }
    }
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        for (let i = 0; i <= str1.length; i++)
            matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++)
            matrix[j][0] = j;
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
            }
        }
        return matrix[str2.length][str1.length];
    }
    estimateTokens(text) {
        return Math.round(text.length / 4);
    }
    async loadCache() {
        try {
            await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });
            const data = await fs.readFile(this.cacheFile, 'utf8');
            const parsed = JSON.parse(data);
            if (parsed.patterns) {
                for (const pattern of parsed.patterns) {
                    pattern.lastUsed = new Date(pattern.lastUsed);
                    this.patterns.set(pattern.id, pattern);
                }
            }
            this.rebuildIndexes();
        }
        catch (error) {
        }
    }
    async saveCache() {
        try {
            const data = {
                version: '1.0',
                timestamp: new Date(),
                patterns: Array.from(this.patterns.values())
            };
            await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to save completion cache: ${error.message}`));
        }
    }
    rebuildIndexes() {
        this.prefixIndex.clear();
        this.contextIndex.clear();
        for (const pattern of this.patterns.values()) {
            this.updateIndexes(pattern);
        }
    }
    getStats() {
        const patterns = Array.from(this.patterns.values());
        const totalFrequency = patterns.reduce((sum, p) => sum + p.frequency, 0);
        const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
        return {
            totalPatterns: patterns.length,
            totalHits: totalFrequency,
            averageConfidence: avgConfidence || 0,
            cacheSize: JSON.stringify(patterns).length,
            indexSize: this.prefixIndex.size + this.contextIndex.size
        };
    }
    async clearCache() {
        this.patterns.clear();
        this.prefixIndex.clear();
        this.contextIndex.clear();
        try {
            await fs.unlink(this.cacheFile);
        }
        catch (error) {
        }
        console.log(chalk_1.default.yellow('🧹 Cleared all completion patterns'));
    }
    findSimilarPatterns(prefix, limit = 5) {
        const normalizedPrefix = this.normalizePrefix(prefix);
        return Array.from(this.patterns.values())
            .map(pattern => ({
            ...pattern,
            similarity: this.calculatePrefixMatch(normalizedPrefix, pattern.prefix)
        }))
            .filter(pattern => pattern.similarity > 0.5)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }
}
exports.CompletionProtocolCache = CompletionProtocolCache;
exports.completionCache = new CompletionProtocolCache();
