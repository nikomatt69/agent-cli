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
exports.adaptiveCache = exports.AdaptiveCacheManager = void 0;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class AdaptiveCacheManager {
    constructor(cacheDir = './.nikcli') {
        this.cache = new Map();
        this.metrics = {
            hitRate: 0,
            avgResponseTime: 0,
            totalTokensSaved: 0,
            userSatisfaction: 0,
            cacheEfficiency: 0
        };
        // Parametri adattivi
        this.maxCacheSize = 500;
        this.minSimilarityThreshold = 0.6;
        this.maxSimilarityThreshold = 0.95;
        this.currentSimilarityThreshold = 0.8;
        this.adaptiveInterval = 100; // Adatta ogni 100 operazioni
        this.operationCount = 0;
        // Statistiche per adattamento
        this.recentHits = [];
        this.recentResponseTimes = [];
        this.userFeedback = [];
        this.cacheFile = path.join(cacheDir, 'adaptive-cache.json');
        this.loadCache();
        this.startAdaptiveLoop();
    }
    /**
     * Loop adattivo che bilancia automaticamente i parametri
     */
    startAdaptiveLoop() {
        setInterval(() => {
            this.adaptParameters();
        }, 30000); // Adatta ogni 30 secondi
    }
    /**
     * Adatta automaticamente i parametri della cache
     */
    adaptParameters() {
        if (this.operationCount < this.adaptiveInterval)
            return;
        const recentHitRate = this.recentHits.filter(hit => hit).length / this.recentHits.length;
        const avgResponseTime = this.recentResponseTimes.reduce((a, b) => a + b, 0) / this.recentResponseTimes.length;
        const avgUserSatisfaction = this.userFeedback.reduce((a, b) => a + b, 0) / this.userFeedback.length;
        // Adatta threshold di similarità
        if (recentHitRate < 0.3) {
            // Troppo pochi hit, abbassa la soglia
            this.currentSimilarityThreshold = Math.max(this.minSimilarityThreshold, this.currentSimilarityThreshold - 0.05);
        }
        else if (recentHitRate > 0.7 && avgUserSatisfaction > 0.8) {
            // Molti hit e alta soddisfazione, alza la soglia per precisione
            this.currentSimilarityThreshold = Math.min(this.maxSimilarityThreshold, this.currentSimilarityThreshold + 0.02);
        }
        // Adatta dimensione cache
        if (this.cache.size > this.maxCacheSize * 0.9) {
            this.evictLowPriorityEntries();
        }
        // Aggiorna metriche
        this.updateMetrics();
        // Reset contatori
        this.operationCount = 0;
        this.recentHits = [];
        this.recentResponseTimes = [];
        this.userFeedback = [];
        console.log(chalk_1.default.blue(`🔄 Cache adapted: threshold=${this.currentSimilarityThreshold.toFixed(2)}, size=${this.cache.size}`));
    }
    /**
     * Determina se una richiesta dovrebbe essere cachata
     */
    shouldCache(content, context = '') {
        const normalizedContent = this.normalizeContent(content);
        // Strategia semplice: cachare se contenuto non è troppo lungo e non è un'analisi
        const isAnalysis = normalizedContent.includes('analizza') ||
            normalizedContent.includes('analyze') ||
            normalizedContent.includes('scan') ||
            normalizedContent.includes('explore');
        const isShortCommand = content.length < 200;
        const isHelpCommand = normalizedContent.includes('help') || normalizedContent.includes('aiuto');
        const isStatusCommand = normalizedContent.includes('status') || normalizedContent.includes('stato');
        if (isAnalysis) {
            return { should: false, reason: 'Analysis request - skip cache' };
        }
        if (isShortCommand || isHelpCommand || isStatusCommand) {
            return { should: true, strategy: 'simple_commands', reason: 'Simple command - high cache priority' };
        }
        if (content.length < 500) {
            return { should: true, strategy: 'general', reason: 'Moderate length - cache if space available' };
        }
        return { should: false, reason: 'Content too long or complex' };
    }
    /**
     * Cerca una risposta nella cache con adattamento dinamico
     */
    async getCachedResponse(content, context = '') {
        const startTime = Date.now();
        const normalizedContent = this.normalizeContent(content);
        const normalizedContext = this.normalizeContent(context);
        let bestMatch = null;
        let bestSimilarity = 0;
        for (const [id, entry] of this.cache) {
            // Calcola similarità ponderata
            const contentSimilarity = this.calculateSimilarity(normalizedContent, this.normalizeContent(entry.content));
            const contextSimilarity = this.calculateSimilarity(normalizedContext, this.normalizeContent(entry.context));
            // Similarità ponderata con priorità
            const weightedSimilarity = (contentSimilarity * 0.7 + contextSimilarity * 0.3) * entry.priority;
            if (weightedSimilarity >= this.currentSimilarityThreshold && weightedSimilarity > bestSimilarity) {
                bestMatch = entry;
                bestSimilarity = weightedSimilarity;
            }
        }
        if (bestMatch) {
            // Aggiorna statistiche
            bestMatch.lastAccessed = new Date();
            bestMatch.accessCount++;
            const responseTime = Date.now() - startTime;
            this.recentHits.push(true);
            this.recentResponseTimes.push(responseTime);
            this.operationCount++;
            console.log(chalk_1.default.green(`🎯 Cache hit: ${(bestSimilarity * 100).toFixed(1)}% similarity, ${bestMatch.tokensSaved} tokens saved`));
            return bestMatch;
        }
        this.recentHits.push(false);
        this.operationCount++;
        return null;
    }
    /**
     * Salva una risposta nella cache con priorità adattiva
     */
    async setCachedResponse(content, response, context = '', metadata = {}) {
        // Calcola priorità basata su contenuto e contesto
        const priority = this.calculatePriority(content, context, response);
        const category = this.categorizeContent(content);
        // Verifica se vale la pena cachare
        if (priority < 3) {
            return; // Priorità troppo bassa
        }
        // Gestisci dimensione cache
        if (this.cache.size >= this.maxCacheSize) {
            this.evictLowPriorityEntries();
        }
        const entry = {
            id: this.generateId(),
            content,
            response,
            context,
            timestamp: new Date(),
            lastAccessed: new Date(),
            accessCount: 1,
            successRate: 1.0,
            responseTime: metadata.responseTime || 0,
            tokensSaved: metadata.tokensSaved || 0,
            category,
            priority,
            metadata: {
                ...metadata,
                adaptiveThreshold: this.currentSimilarityThreshold
            }
        };
        this.cache.set(entry.id, entry);
        await this.saveCache();
        console.log(chalk_1.default.blue(`💾 Cached (${category}, priority: ${priority}): ${content.substring(0, 50)}...`));
    }
    /**
     * Calcola priorità adattiva per una entry
     */
    calculatePriority(content, context, response) {
        let priority = 5; // Priorità base
        // Fattori che aumentano priorità
        if (content.length < 100)
            priority += 2; // Comandi brevi
        if (content.includes('help') || content.includes('aiuto'))
            priority += 3; // Help commands
        if (content.includes('status') || content.includes('stato'))
            priority += 2; // Status commands
        if (response.length > 500)
            priority += 1; // Risposte lunghe
        if (context.includes('frequent') || context.includes('common'))
            priority += 2; // Contesto frequente
        // Fattori che diminuiscono priorità
        if (content.length > 500)
            priority -= 1; // Contenuto molto lungo
        if (content.includes('analyze') || content.includes('analizza'))
            priority -= 1; // Analisi (cambiano spesso)
        if (content.includes('generate') || content.includes('genera'))
            priority -= 2; // Generazione (molto specifica)
        return Math.max(1, Math.min(10, priority));
    }
    /**
     * Categorizza il contenuto
     */
    categorizeContent(content) {
        const lower = content.toLowerCase();
        if (lower.includes('help') || lower.includes('aiuto'))
            return 'help';
        if (lower.includes('status') || lower.includes('stato'))
            return 'status';
        if (lower.includes('analyze') || lower.includes('analizza'))
            return 'analysis';
        if (lower.includes('generate') || lower.includes('genera'))
            return 'generation';
        if (lower.includes('run') || lower.includes('esegui'))
            return 'execution';
        if (lower.includes('find') || lower.includes('trova'))
            return 'search';
        return 'general';
    }
    /**
     * Rimuove entry a bassa priorità
     */
    evictLowPriorityEntries() {
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => {
            // Ordina per priorità, poi per ultimo accesso
            if (a[1].priority !== b[1].priority) {
                return a[1].priority - b[1].priority;
            }
            return a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime();
        });
        // Rimuovi il 20% con priorità più bassa
        const toRemove = Math.ceil(entries.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
            this.cache.delete(entries[i][0]);
        }
    }
    /**
     * Feedback utente per adattamento
     */
    recordUserFeedback(entryId, satisfaction) {
        const entry = this.cache.get(entryId);
        if (entry) {
            entry.successRate = (entry.successRate + satisfaction) / 2;
            this.userFeedback.push(satisfaction);
            // Adatta priorità basata su feedback
            if (satisfaction > 0.8) {
                entry.priority = Math.min(10, entry.priority + 1);
            }
            else if (satisfaction < 0.3) {
                entry.priority = Math.max(1, entry.priority - 1);
            }
        }
    }
    /**
     * Calcola similarità tra testi
     */
    calculateSimilarity(text1, text2) {
        const words1 = new Set(text1.split(/\s+/));
        const words2 = new Set(text2.split(/\s+/));
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        return intersection.size / union.size;
    }
    /**
     * Normalizza contenuto
     */
    normalizeContent(content) {
        return content
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Genera ID unico
     */
    generateId() {
        return `adaptive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Aggiorna metriche
     */
    updateMetrics() {
        const entries = Array.from(this.cache.values());
        this.metrics.hitRate = this.recentHits.filter(hit => hit).length / this.recentHits.length;
        this.metrics.avgResponseTime = this.recentResponseTimes.reduce((a, b) => a + b, 0) / this.recentResponseTimes.length;
        this.metrics.totalTokensSaved = entries.reduce((sum, e) => sum + e.tokensSaved, 0);
        this.metrics.userSatisfaction = this.userFeedback.reduce((a, b) => a + b, 0) / this.userFeedback.length;
        this.metrics.cacheEfficiency = this.metrics.hitRate * this.metrics.userSatisfaction;
    }
    /**
     * Ottieni statistiche
     */
    getStats() {
        this.updateMetrics();
        return {
            ...this.metrics,
            cacheSize: this.cache.size,
            currentThreshold: this.currentSimilarityThreshold,
            categories: this.getCategoryStats()
        };
    }
    /**
     * Statistiche per categoria
     */
    getCategoryStats() {
        const stats = {};
        const entries = Array.from(this.cache.values());
        const categories = [...new Set(entries.map(e => e.category))];
        for (const category of categories) {
            const categoryEntries = entries.filter(e => e.category === category);
            stats[category] = {
                count: categoryEntries.length,
                avgPriority: categoryEntries.reduce((sum, e) => sum + e.priority, 0) / categoryEntries.length,
                avgSuccessRate: categoryEntries.reduce((sum, e) => sum + e.successRate, 0) / categoryEntries.length
            };
        }
        return stats;
    }
    /**
     * Carica cache da file
     */
    async loadCache() {
        try {
            const data = await fs.readFile(this.cacheFile, 'utf-8');
            const parsed = JSON.parse(data);
            for (const [id, entry] of Object.entries(parsed)) {
                const typedEntry = entry;
                this.cache.set(id, {
                    ...typedEntry,
                    timestamp: new Date(typedEntry.timestamp),
                    lastAccessed: new Date(typedEntry.lastAccessed)
                });
            }
            console.log(chalk_1.default.green(`📂 Loaded ${this.cache.size} cache entries`));
        }
        catch (error) {
            // File non esiste o errore, inizia con cache vuota
        }
    }
    /**
     * Salva cache su file
     */
    async saveCache() {
        try {
            const data = JSON.stringify(Object.fromEntries(this.cache), null, 2);
            await fs.writeFile(this.cacheFile, data);
        }
        catch (error) {
            console.error('Failed to save cache:', error);
        }
    }
    /**
     * Mostra stato cache
     */
    showStatus() {
        const stats = this.getStats();
        console.log(chalk_1.default.blue('\n🧠 Adaptive Cache Status:'));
        console.log(`📊 Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
        console.log(`⚡ Avg Response Time: ${stats.avgResponseTime.toFixed(0)}ms`);
        console.log(`💾 Cache Size: ${stats.cacheSize}/${this.maxCacheSize}`);
        console.log(`🎯 Current Threshold: ${(stats.currentThreshold * 100).toFixed(1)}%`);
        console.log(`😊 User Satisfaction: ${(stats.userSatisfaction * 100).toFixed(1)}%`);
        console.log(`🚀 Efficiency: ${(stats.cacheEfficiency * 100).toFixed(1)}%`);
    }
}
exports.AdaptiveCacheManager = AdaptiveCacheManager;
// Singleton instance
exports.adaptiveCache = new AdaptiveCacheManager();
