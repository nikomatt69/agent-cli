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
exports.docLibrary = exports.DocumentationLibrary = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class DocumentationLibrary {
    constructor(docsDir = './.nikcli') {
        this.docs = new Map();
        this.searchIndex = new Map(); // term -> entry IDs
        this.categories = new Set();
        this.maxDocs = 1000;
        this.docsFile = path.join(docsDir, 'documentation-library.json');
        this.loadLibrary();
    }
    /**
     * Aggiunge documentazione da un URL
     */
    async addDocumentation(url, category = 'general', tags = []) {
        try {
            console.log(chalk_1.default.blue(`📖 Fetching documentation from: ${url}`));
            // Estrai contenuto dalla pagina web
            const content = await this.extractWebContent(url);
            if (!content || content.length < 100) {
                throw new Error('Content too short or empty');
            }
            // Genera titolo dal contenuto
            const title = this.extractTitle(content, url);
            // Analizza il contenuto
            const analysis = this.analyzeContent(content);
            const entry = {
                id: this.generateId(),
                url,
                title,
                content: content.substring(0, 50000), // Limita dimensione
                category,
                tags: [...tags, ...analysis.suggestedTags],
                timestamp: new Date(),
                lastAccessed: new Date(),
                accessCount: 1,
                relevance: 1.0,
                metadata: {
                    wordCount: analysis.wordCount,
                    language: analysis.language,
                    source: 'web',
                    extractedAt: new Date()
                }
            };
            // Gestisci dimensione libreria
            if (this.docs.size >= this.maxDocs) {
                this.evictOldEntries();
            }
            this.docs.set(entry.id, entry);
            this.categories.add(category);
            this.updateSearchIndex(entry);
            await this.saveLibrary();
            console.log(chalk_1.default.green(`✅ Added: ${title} (${analysis.wordCount} words, ${analysis.language})`));
            return entry;
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Failed to add documentation: ${error.message}`));
            throw error;
        }
    }
    /**
     * Cerca nella libreria di documentazione
     */
    async search(query, category, limit = 10) {
        const normalizedQuery = this.normalizeText(query);
        const queryTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 2);
        const results = [];
        for (const [id, entry] of this.docs) {
            // Filtra per categoria se specificata
            if (category && entry.category !== category)
                continue;
            // Calcola score di rilevanza
            const score = this.calculateRelevanceScore(entry, queryTerms);
            if (score > 0.1) { // Soglia minima
                const matchedTerms = this.findMatchedTerms(entry, queryTerms);
                const snippet = this.generateSnippet(entry.content, queryTerms);
                results.push({
                    entry,
                    score,
                    matchedTerms,
                    snippet
                });
            }
        }
        // Ordina per score e limita risultati
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    /**
     * Cerca nel web se non trova nulla nella libreria
     */
    async searchWithWebFallback(query, category) {
        // Prima cerca nella libreria
        const localResults = await this.search(query, category, 5);
        if (localResults.length > 0 && localResults[0].score > 0.5) {
            console.log(chalk_1.default.green(`📚 Found ${localResults.length} relevant docs in library`));
            return localResults;
        }
        // Se non trova nulla di rilevante, cerca nel web
        console.log(chalk_1.default.yellow(`🔍 No relevant docs found, searching web...`));
        try {
            const webResults = await this.searchWeb(query);
            // Aggiungi i risultati più rilevanti alla libreria
            for (const result of webResults.slice(0, 3)) {
                try {
                    await this.addDocumentation(result.url, category || 'web-search', [query]);
                }
                catch (error) {
                    // Ignora errori di aggiunta
                }
            }
            return webResults;
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Web search failed: ${error}`));
            return localResults; // Ritorna risultati locali anche se scarsi
        }
    }
    /**
     * Estrae contenuto da una pagina web
     */
    async extractWebContent(url) {
        try {
            // Usa curl per estrarre contenuto HTML
            const { stdout } = await execAsync(`curl -s -L "${url}" -H "User-Agent: Mozilla/5.0"`);
            // Estrai testo dal HTML
            const textContent = this.extractTextFromHTML(stdout);
            return textContent;
        }
        catch (error) {
            throw new Error(`Failed to extract content: ${error}`);
        }
    }
    /**
     * Estrae testo da HTML
     */
    extractTextFromHTML(html) {
        // Rimuovi tag HTML
        let text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
        return text;
    }
    /**
     * Estrae titolo dal contenuto
     */
    extractTitle(content, url) {
        // Cerca titolo nel contenuto
        const lines = content.split('\n').filter(line => line.trim().length > 0);
        for (const line of lines.slice(0, 10)) {
            if (line.length > 10 && line.length < 100) {
                return line.substring(0, 80) + (line.length > 80 ? '...' : '');
            }
        }
        // Fallback: usa URL
        try {
            const urlObj = new URL(url);
            return urlObj.hostname + urlObj.pathname;
        }
        catch {
            return url.substring(0, 50);
        }
    }
    /**
     * Analizza contenuto per estrarre metadati
     */
    analyzeContent(content) {
        const words = content.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        // Rileva lingua (semplice)
        const language = this.detectLanguage(content);
        // Suggerisci tag basati su parole chiave
        const suggestedTags = this.suggestTags(content);
        return {
            wordCount,
            language,
            suggestedTags
        };
    }
    /**
     * Rileva lingua del testo
     */
    detectLanguage(text) {
        const italianWords = ['di', 'da', 'del', 'della', 'dello', 'delle', 'degli', 'al', 'dal', 'nel', 'nella'];
        const englishWords = ['the', 'and', 'for', 'with', 'this', 'that', 'have', 'will', 'from', 'they'];
        const lowerText = text.toLowerCase();
        let italianCount = 0;
        let englishCount = 0;
        for (const word of italianWords) {
            italianCount += (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
        }
        for (const word of englishWords) {
            englishCount += (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
        }
        return italianCount > englishCount ? 'italian' : 'english';
    }
    /**
     * Suggerisce tag basati sul contenuto
     */
    suggestTags(content) {
        const tags = [];
        const lowerContent = content.toLowerCase();
        // Tag tecnici
        if (lowerContent.includes('javascript') || lowerContent.includes('js'))
            tags.push('javascript');
        if (lowerContent.includes('typescript') || lowerContent.includes('ts'))
            tags.push('typescript');
        if (lowerContent.includes('react'))
            tags.push('react');
        if (lowerContent.includes('node'))
            tags.push('nodejs');
        if (lowerContent.includes('api'))
            tags.push('api');
        if (lowerContent.includes('database') || lowerContent.includes('db'))
            tags.push('database');
        if (lowerContent.includes('deployment') || lowerContent.includes('deploy'))
            tags.push('deployment');
        if (lowerContent.includes('testing') || lowerContent.includes('test'))
            tags.push('testing');
        return tags.slice(0, 5); // Massimo 5 tag
    }
    /**
     * Calcola score di rilevanza
     */
    calculateRelevanceScore(entry, queryTerms) {
        const normalizedContent = this.normalizeText(entry.content);
        const normalizedTitle = this.normalizeText(entry.title);
        let score = 0;
        for (const term of queryTerms) {
            // Peso maggiore per match nel titolo
            if (normalizedTitle.includes(term)) {
                score += 0.4;
            }
            // Peso per match nel contenuto
            const contentMatches = (normalizedContent.match(new RegExp(term, 'g')) || []).length;
            score += Math.min(0.3, contentMatches * 0.05);
            // Peso per tag
            if (entry.tags.some(tag => tag.toLowerCase().includes(term))) {
                score += 0.2;
            }
        }
        // Normalizza per numero di termini
        score = score / queryTerms.length;
        // Applica fattori di boost
        score *= entry.relevance; // Rilevanza dell'entry
        score *= (1 + entry.accessCount * 0.1); // Popolarità
        return Math.min(1, score);
    }
    /**
     * Trova termini che hanno fatto match
     */
    findMatchedTerms(entry, queryTerms) {
        const normalizedContent = this.normalizeText(entry.content + ' ' + entry.title);
        return queryTerms.filter(term => normalizedContent.includes(term));
    }
    /**
     * Genera snippet con termini evidenziati
     */
    generateSnippet(content, queryTerms, maxLength = 200) {
        const normalizedContent = this.normalizeText(content);
        // Trova la posizione del primo match
        let bestPosition = 0;
        let bestScore = 0;
        for (const term of queryTerms) {
            const position = normalizedContent.indexOf(term);
            if (position >= 0) {
                const score = term.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestPosition = position;
                }
            }
        }
        // Estrai snippet
        const start = Math.max(0, bestPosition - 50);
        const end = Math.min(content.length, start + maxLength);
        let snippet = content.substring(start, end);
        // Evidenzia termini
        for (const term of queryTerms) {
            const regex = new RegExp(`(${term})`, 'gi');
            snippet = snippet.replace(regex, '**$1**');
        }
        return snippet;
    }
    /**
     * Cerca nel web (simulato)
     */
    async searchWeb(query) {
        // Simula ricerca web - in produzione si userebbe un'API
        console.log(chalk_1.default.yellow(`🌐 Simulating web search for: ${query}`));
        // Per ora ritorna risultati vuoti
        return [];
    }
    /**
     * Normalizza testo
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Aggiorna indice di ricerca
     */
    updateSearchIndex(entry) {
        const terms = this.normalizeText(entry.content + ' ' + entry.title)
            .split(/\s+/)
            .filter(term => term.length > 2);
        for (const term of terms) {
            if (!this.searchIndex.has(term)) {
                this.searchIndex.set(term, []);
            }
            this.searchIndex.get(term).push(entry.id);
        }
    }
    /**
     * Rimuove entry vecchie
     */
    evictOldEntries() {
        const entries = Array.from(this.docs.entries())
            .sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());
        // Rimuovi il 20% più vecchio
        const toRemove = Math.ceil(entries.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
            this.docs.delete(entries[i][0]);
        }
    }
    /**
     * Genera ID unico
     */
    generateId() {
        return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Carica libreria da file
     */
    async loadLibrary() {
        try {
            const data = await fs.readFile(this.docsFile, 'utf-8');
            const parsed = JSON.parse(data);
            for (const [id, entry] of Object.entries(parsed)) {
                const typedEntry = entry;
                this.docs.set(id, {
                    ...typedEntry,
                    timestamp: new Date(typedEntry.timestamp),
                    lastAccessed: new Date(typedEntry.lastAccessed),
                    metadata: {
                        ...typedEntry.metadata,
                        extractedAt: new Date(typedEntry.metadata.extractedAt)
                    }
                });
                this.categories.add(typedEntry.category);
            }
            console.log(chalk_1.default.green(`📚 Loaded ${this.docs.size} documentation entries`));
        }
        catch (error) {
            // File non esiste, inizia con libreria vuota
        }
    }
    /**
     * Salva libreria su file
     */
    async saveLibrary() {
        try {
            const data = JSON.stringify(Object.fromEntries(this.docs), null, 2);
            await fs.writeFile(this.docsFile, data);
        }
        catch (error) {
            console.error('Failed to save documentation library:', error);
        }
    }
    /**
     * Ottieni statistiche
     */
    getStats() {
        const entries = Array.from(this.docs.values());
        return {
            totalDocs: this.docs.size,
            categories: Array.from(this.categories),
            totalWords: entries.reduce((sum, e) => sum + e.metadata.wordCount, 0),
            avgAccessCount: entries.reduce((sum, e) => sum + e.accessCount, 0) / entries.length || 0,
            languages: [...new Set(entries.map(e => e.metadata.language))]
        };
    }
    /**
     * Mostra stato libreria
     */
    showStatus() {
        const stats = this.getStats();
        console.log(chalk_1.default.blue('\n📚 Documentation Library Status:'));
        console.log(`📖 Total Docs: ${stats.totalDocs}`);
        console.log(`📂 Categories: ${stats.categories.join(', ')}`);
        console.log(`📝 Total Words: ${stats.totalWords.toLocaleString()}`);
        console.log(`👁️ Avg Access Count: ${stats.avgAccessCount.toFixed(1)}`);
        console.log(`🌍 Languages: ${stats.languages.join(', ')}`);
    }
}
exports.DocumentationLibrary = DocumentationLibrary;
// Singleton instance
exports.docLibrary = new DocumentationLibrary();
