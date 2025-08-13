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
/**
 * Model Completion Protocol Cache
 * Caches completion patterns instead of full responses for maximum efficiency
 */
class CompletionProtocolCache {
    constructor(cacheDir = './.nikcli') {
        this.patterns = new Map();
        this.prefixIndex = new Map(); // prefix -> pattern IDs
        this.contextIndex = new Map(); // context -> pattern IDs
        this.maxPatterns = 1000; // Ridotto da 5000
        this.minConfidence = 0.6; // Più permissivo
        this.prefixMinLength = 8; // Ridotto
        this.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 giorni (ridotto)
        this.cacheFile = path.join(cacheDir, 'completion-cache.json');
        this.loadCache();
    }
    /**
     * Generate completion from cache using protocol matching
     */
    async getCompletion(request) {
        const { prefix, context, maxTokens, model } = request;
        // Fast prefix lookup
        const normalizedPrefix = this.normalizePrefix(prefix);
        const prefixKey = this.generatePrefixKey(normalizedPrefix);
        if (!this.prefixIndex.has(prefixKey)) {
            return null;
        }
        // Find matching patterns
        const candidateIds = this.prefixIndex.get(prefixKey) || [];
        const candidates = [];
        for (const id of candidateIds) {
            const pattern = this.patterns.get(id);
            if (!pattern)
                continue;
            // Check model compatibility
            if (pattern.modelSignature !== model)
                continue;
            // Check age
            const age = Date.now() - new Date(pattern.lastUsed).getTime();
            if (age > this.maxAge)
                continue;
            // Calculate context similarity (molto più restrittivo)
            const contextSimilarity = this.calculateContextSimilarity(context, pattern.contextHash);
            if (contextSimilarity < 0.95)
                continue; // Molto più restrittivo
            // Calculate prefix match quality (molto più restrittivo)
            const prefixMatch = this.calculatePrefixMatch(prefix, pattern.prefix);
            if (prefixMatch < 0.98)
                continue; // Molto più restrittivo
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
        // Sort by confidence and frequency
        candidates.sort((a, b) => {
            const scoreA = a.confidence * 0.7 + (a.frequency / 100) * 0.3;
            const scoreB = b.confidence * 0.7 + (b.frequency / 100) * 0.3;
            return scoreB - scoreA;
        });
        const bestPattern = candidates[0];
        // Generate completion from pattern
        const completion = this.generateCompletionFromPattern(bestPattern, prefix, maxTokens);
        // Update usage stats
        bestPattern.frequency++;
        bestPattern.lastUsed = new Date();
        this.patterns.set(bestPattern.id, bestPattern);
        const tokensSaved = this.estimateTokens(prefix + completion);
        console.log(chalk_1.default.green(`🔮 Protocol Cache HIT (${Math.round(bestPattern.confidence * 100)}%): saved ~${tokensSaved} tokens`));
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
    /**
     * Store completion pattern for future use
     */
    async storeCompletion(request, completion, actualTokens) {
        const { prefix, context, model } = request;
        // Don't store very short completions
        if (completion.length < 20)
            return;
        const normalizedPrefix = this.normalizePrefix(prefix);
        const contextHash = this.generateContextHash(context);
        // Extract meaningful suffix for pattern matching
        const suffix = this.extractSuffix(completion);
        const pattern = {
            id: this.generatePatternId(normalizedPrefix, completion),
            prefix: normalizedPrefix,
            suffix,
            contextHash,
            completionTokens: this.tokenizeCompletion(completion),
            confidence: 0.9, // High initial confidence for new patterns
            frequency: 1,
            lastUsed: new Date(),
            modelSignature: model,
            tags: this.extractTags(prefix, completion, context)
        };
        // Store pattern
        this.patterns.set(pattern.id, pattern);
        // Update indexes
        this.updateIndexes(pattern);
        // Cleanup if needed
        await this.cleanupPatterns();
    }
    /**
     * Generate completion from stored pattern
     */
    generateCompletionFromPattern(pattern, actualPrefix, maxTokens) {
        const tokens = pattern.completionTokens.slice(0, maxTokens);
        // Apply context-aware adjustments
        let completion = tokens.join('');
        // Smart prefix merging - avoid duplication
        const overlap = this.findPrefixOverlap(actualPrefix, completion);
        if (overlap > 0) {
            completion = completion.substring(overlap);
        }
        return completion;
    }
    /**
     * Normalize prefix for consistent matching
     */
    normalizePrefix(prefix) {
        return prefix
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
            .substring(Math.max(0, prefix.length - 200)); // Keep last 200 chars
    }
    /**
     * Extract meaningful suffix patterns
     */
    extractSuffix(completion) {
        // Take first significant chunk
        const lines = completion.split('\n');
        const firstLine = lines[0] || '';
        const suffix = firstLine.length > 50 ? firstLine.substring(0, 50) : completion.substring(0, 100);
        return suffix.trim();
    }
    /**
     * Tokenize completion for pattern storage
     */
    tokenizeCompletion(completion) {
        // Simple word-boundary tokenization
        // In production, use proper tokenizer for the specific model
        return completion
            .split(/(\s+|[.!?;,])/g)
            .filter(token => token.trim().length > 0)
            .slice(0, 100); // Limit token storage
    }
    /**
     * Generate unique pattern ID
     */
    generatePatternId(prefix, completion) {
        return crypto_1.default
            .createHash('md5')
            .update(prefix + completion.substring(0, 50))
            .digest('hex')
            .substring(0, 16);
    }
    /**
     * Generate prefix key for fast lookup
     */
    generatePrefixKey(prefix) {
        if (prefix.length < this.prefixMinLength)
            return '';
        // Use last meaningful chunk
        const words = prefix.split(/\s+/).slice(-5); // Last 5 words
        return crypto_1.default
            .createHash('md5')
            .update(words.join(' '))
            .digest('hex')
            .substring(0, 12);
    }
    /**
     * Generate context hash for similarity matching
     */
    generateContextHash(context) {
        // Normalize and hash key context elements
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
    /**
     * Calculate context similarity
     */
    calculateContextSimilarity(context1, contextHash2) {
        const hash1 = this.generateContextHash(context1);
        // Simple hash distance comparison
        let matches = 0;
        for (let i = 0; i < Math.min(hash1.length, contextHash2.length); i++) {
            if (hash1[i] === contextHash2[i])
                matches++;
        }
        return matches / Math.max(hash1.length, contextHash2.length);
    }
    /**
     * Calculate prefix match quality
     */
    calculatePrefixMatch(prefix1, prefix2) {
        const norm1 = this.normalizePrefix(prefix1);
        const norm2 = this.normalizePrefix(prefix2);
        // Levenshtein distance similarity
        const distance = this.levenshteinDistance(norm1, norm2);
        const maxLength = Math.max(norm1.length, norm2.length);
        return 1 - (distance / maxLength);
    }
    /**
     * Find overlap between prefix and completion
     */
    findPrefixOverlap(prefix, completion) {
        const prefixEnd = prefix.slice(-20); // Last 20 chars
        const completionStart = completion.substring(0, 20);
        for (let i = Math.min(prefixEnd.length, completionStart.length); i > 0; i--) {
            if (prefixEnd.slice(-i) === completionStart.substring(0, i)) {
                return i;
            }
        }
        return 0;
    }
    /**
     * Extract tags from completion context
     */
    extractTags(prefix, completion, context) {
        const tags = [];
        const combined = (prefix + ' ' + completion + ' ' + context).toLowerCase();
        // Programming language detection
        if (combined.includes('function') || combined.includes('const ') || combined.includes('let ')) {
            tags.push('javascript');
        }
        if (combined.includes('def ') || combined.includes('import ') || combined.includes('class ')) {
            tags.push('python');
        }
        if (combined.includes('interface') || combined.includes('type ') || combined.includes('export ')) {
            tags.push('typescript');
        }
        // Content type detection
        if (combined.includes('todo') || combined.includes('plan') || combined.includes('task')) {
            tags.push('planning');
        }
        if (combined.includes('component') || combined.includes('react') || combined.includes('jsx')) {
            tags.push('react');
        }
        if (combined.includes('css') || combined.includes('style') || combined.includes('color')) {
            tags.push('styling');
        }
        return tags.slice(0, 5); // Limit tags
    }
    /**
     * Update search indexes
     */
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
    /**
     * Clean up old patterns
     */
    async cleanupPatterns() {
        if (this.patterns.size <= this.maxPatterns)
            return;
        const patterns = Array.from(this.patterns.values());
        // Sort by usage score (frequency + recency)
        patterns.sort((a, b) => {
            const scoreA = a.frequency * 0.7 + (Date.now() - new Date(a.lastUsed).getTime()) * -0.3;
            const scoreB = b.frequency * 0.7 + (Date.now() - new Date(b.lastUsed).getTime()) * -0.3;
            return scoreB - scoreA;
        });
        // Remove least useful patterns
        const toRemove = patterns.slice(this.maxPatterns);
        for (const pattern of toRemove) {
            this.patterns.delete(pattern.id);
            // Clean up indexes
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
        if (toRemove.length > 0) {
            console.log(chalk_1.default.yellow(`🧹 Cleaned ${toRemove.length} completion patterns`));
        }
    }
    /**
     * Levenshtein distance calculation
     */
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
    /**
     * Estimate token count
     */
    estimateTokens(text) {
        return Math.round(text.length / 4);
    }
    /**
     * Load cache from disk
     */
    async loadCache() {
        try {
            await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });
            const data = await fs.readFile(this.cacheFile, 'utf8');
            const parsed = JSON.parse(data);
            // Restore patterns
            if (parsed.patterns) {
                for (const pattern of parsed.patterns) {
                    pattern.lastUsed = new Date(pattern.lastUsed);
                    this.patterns.set(pattern.id, pattern);
                }
            }
            // Rebuild indexes
            this.rebuildIndexes();
            console.log(chalk_1.default.dim(`🔮 Loaded ${this.patterns.size} completion patterns`));
        }
        catch (error) {
            console.log(chalk_1.default.dim('🔮 Starting with empty completion cache'));
        }
    }
    /**
     * Save cache to disk
     */
    async saveCache() {
        try {
            const data = {
                version: '1.0',
                timestamp: new Date(),
                patterns: Array.from(this.patterns.values())
            };
            await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2));
            console.log(chalk_1.default.dim(`🔮 Saved ${this.patterns.size} completion patterns`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to save completion cache: ${error.message}`));
        }
    }
    /**
     * Rebuild search indexes
     */
    rebuildIndexes() {
        this.prefixIndex.clear();
        this.contextIndex.clear();
        for (const pattern of this.patterns.values()) {
            this.updateIndexes(pattern);
        }
    }
    /**
     * Get cache statistics
     */
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
    /**
     * Clear all patterns
     */
    async clearCache() {
        this.patterns.clear();
        this.prefixIndex.clear();
        this.contextIndex.clear();
        try {
            await fs.unlink(this.cacheFile);
        }
        catch (error) {
            // File might not exist
        }
        console.log(chalk_1.default.yellow('🧹 Cleared all completion patterns'));
    }
    /**
     * Find similar patterns for analysis
     */
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
// Export singleton instance
exports.completionCache = new CompletionProtocolCache();
