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
exports.tokenCache = exports.TokenCacheManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const chalk_1 = __importDefault(require("chalk"));
/**
 * Intelligent Token Cache System
 * Reduces AI API calls by caching similar prompts and responses
 */
class TokenCacheManager {
    constructor(cacheDir = './.nikcli') {
        this.cache = new Map();
        this.maxCacheSize = 1000;
        this.similarityThreshold = 0.85;
        this.maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        this.cacheFile = path.join(cacheDir, 'token-cache.json');
        this.loadCache();
    }
    /**
     * Generate a semantic hash for prompt similarity detection
     */
    generateSemanticKey(prompt, context = '') {
        // Normalize text for better matching
        const normalized = this.normalizeText(prompt + context);
        // Create semantic fingerprint
        const words = normalized.split(/\s+/).filter(w => w.length > 2);
        const sortedWords = words.sort().slice(0, 20); // Top 20 significant words
        return crypto_1.default
            .createHash('md5')
            .update(sortedWords.join('|'))
            .digest('hex')
            .substring(0, 16);
    }
    /**
     * Generate exact hash for precise matching
     */
    generateExactKey(prompt, context = '') {
        return crypto_1.default
            .createHash('sha256')
            .update(prompt + context)
            .digest('hex')
            .substring(0, 32);
    }
    /**
     * Normalize text for consistent comparison
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Calculate text similarity using Jaccard similarity
     */
    calculateSimilarity(text1, text2) {
        const words1 = new Set(this.normalizeText(text1).split(/\s+/));
        const words2 = new Set(this.normalizeText(text2).split(/\s+/));
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        return intersection.size / union.size;
    }
    /**
     * Find cached response for similar prompts
     */
    async getCachedResponse(prompt, context = '', tags = []) {
        // First try exact match
        const exactKey = this.generateExactKey(prompt, context);
        if (this.cache.has(exactKey)) {
            const entry = this.cache.get(exactKey);
            entry.hitCount++;
            entry.similarity = 1.0;
            console.log(chalk_1.default.green(`🎯 Cache HIT (exact): saved ~${entry.tokensSaved} tokens`));
            return entry;
        }
        // Then try semantic similarity
        const semanticKey = this.generateSemanticKey(prompt, context);
        // Find similar entries
        const similarEntries = Array.from(this.cache.values())
            .filter(entry => {
            // Check if entry is not expired
            const age = Date.now() - new Date(entry.timestamp).getTime();
            if (age > this.maxCacheAge)
                return false;
            // Check tag overlap if tags provided
            if (tags.length > 0 && entry.tags.length > 0) {
                const tagOverlap = tags.filter(t => entry.tags.includes(t)).length / Math.max(tags.length, entry.tags.length);
                if (tagOverlap < 0.3)
                    return false;
            }
            return true;
        })
            .map(entry => ({
            ...entry,
            similarity: this.calculateSimilarity(prompt, entry.userInput)
        }))
            .filter(entry => entry.similarity >= this.similarityThreshold)
            .sort((a, b) => b.similarity - a.similarity);
        if (similarEntries.length > 0) {
            const bestMatch = similarEntries[0];
            bestMatch.hitCount++;
            console.log(chalk_1.default.cyan(`🎯 Cache HIT (similar ${Math.round(bestMatch.similarity * 100)}%): saved ~${bestMatch.tokensSaved} tokens`));
            return bestMatch;
        }
        return null;
    }
    /**
     * Store response in cache
     */
    async setCachedResponse(prompt, response, context = '', tokensSaved = 0, tags = []) {
        const exactKey = this.generateExactKey(prompt, context);
        const entry = {
            key: exactKey,
            promptHash: this.generateSemanticKey(prompt, context),
            userInput: prompt,
            response,
            timestamp: new Date(),
            tokensSaved: Math.max(tokensSaved, this.estimateTokens(prompt + response)),
            hitCount: 0,
            tags,
            similarity: 1.0
        };
        this.cache.set(exactKey, entry);
        // Cleanup old entries if cache is too large
        await this.cleanupCache();
        // Save to disk periodically
        if (this.cache.size % 10 === 0) {
            await this.saveCache();
        }
        console.log(chalk_1.default.blue(`💾`));
    }
    /**
     * Estimate token count from text
     */
    estimateTokens(text) {
        return Math.round(text.length / 4);
    }
    /**
     * Clean up old and least used cache entries
     */
    async cleanupCache() {
        if (this.cache.size <= this.maxCacheSize)
            return;
        const entries = Array.from(this.cache.entries());
        // Sort by last used (hitCount) and age
        entries.sort(([, a], [, b]) => {
            const scoreA = a.hitCount * 0.7 + (Date.now() - new Date(a.timestamp).getTime()) * -0.3;
            const scoreB = b.hitCount * 0.7 + (Date.now() - new Date(b.timestamp).getTime()) * -0.3;
            return scoreB - scoreA;
        });
        // Remove oldest/least used entries
        const toRemove = entries.slice(this.maxCacheSize);
        toRemove.forEach(([key]) => this.cache.delete(key));
        if (toRemove.length > 0) {
            console.log(chalk_1.default.yellow(`🧹 Cleaned up ${toRemove.length} old cache entries`));
        }
    }
    /**
     * Load cache from disk
     */
    async loadCache() {
        try {
            // Ensure cache directory exists
            await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });
            const data = await fs.readFile(this.cacheFile, 'utf8');
            const parsed = JSON.parse(data);
            // Convert back to Map with Date objects
            parsed.forEach((entry) => {
                entry.timestamp = new Date(entry.timestamp);
                this.cache.set(entry.key, entry);
            });
            console.log(chalk_1.default.dim(`📚 Loaded ${this.cache.size} cached responses`));
        }
        catch (error) {
            // Cache file doesn't exist or is corrupted, start fresh
            console.log(chalk_1.default.dim('💾 Starting with empty cache'));
        }
    }
    /**
     * Save cache to disk
     */
    async saveCache() {
        try {
            const data = Array.from(this.cache.values());
            await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2));
            console.log(chalk_1.default.dim(`💾 Saved ${data.length} cache entries`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to save cache: ${error.message}`));
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const entries = Array.from(this.cache.values());
        const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
        const totalTokensSaved = entries.reduce((sum, entry) => sum + entry.tokensSaved * entry.hitCount, 0);
        return {
            totalEntries: entries.length,
            totalHits,
            totalTokensSaved,
            hitRatio: entries.length > 0 ? totalHits / (totalHits + entries.length) : 0,
            cacheSize: JSON.stringify(entries).length
        };
    }
    /**
     * Clear all cache entries
     */
    async clearCache() {
        const oldSize = this.cache.size;
        this.cache.clear();
        try {
            await fs.unlink(this.cacheFile);
        }
        catch (error) {
            // File might not exist
        }
        console.log(chalk_1.default.yellow(`🧹 Cleared ${oldSize} cache entries`));
    }
    /**
     * Remove expired entries
     */
    async cleanupExpired() {
        const beforeSize = this.cache.size;
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            const age = now - new Date(entry.timestamp).getTime();
            if (age > this.maxCacheAge) {
                this.cache.delete(key);
            }
        }
        const removed = beforeSize - this.cache.size;
        if (removed > 0) {
            console.log(chalk_1.default.yellow(`🧹 Removed ${removed} expired cache entries`));
            await this.saveCache();
        }
        return removed;
    }
    /**
     * Find similar cached entries for analysis
     */
    findSimilarEntries(prompt, limit = 5) {
        return Array.from(this.cache.values())
            .map(entry => ({
            ...entry,
            similarity: this.calculateSimilarity(prompt, entry.userInput)
        }))
            .filter(entry => entry.similarity > 0.5)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }
    /**
     * Update cache settings
     */
    updateSettings(maxSize, similarityThreshold, maxAge) {
        if (maxSize !== undefined)
            this.maxCacheSize = maxSize;
        if (similarityThreshold !== undefined)
            this.similarityThreshold = similarityThreshold;
        if (maxAge !== undefined)
            this.maxCacheAge = maxAge;
        console.log(chalk_1.default.blue('⚙️ Cache settings updated'));
    }
    /**
     * Export cache for analysis
     */
    async exportCache(filePath) {
        const data = {
            metadata: {
                exportDate: new Date(),
                totalEntries: this.cache.size,
                settings: {
                    maxCacheSize: this.maxCacheSize,
                    similarityThreshold: this.similarityThreshold,
                    maxCacheAge: this.maxCacheAge
                }
            },
            entries: Array.from(this.cache.values())
        };
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        console.log(chalk_1.default.green(`📤 Cache exported to ${filePath}`));
    }
}
exports.TokenCacheManager = TokenCacheManager;
// Export singleton instance
exports.tokenCache = new TokenCacheManager();
