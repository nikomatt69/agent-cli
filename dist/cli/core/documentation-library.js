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
const crypto_1 = require("crypto");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class DocumentationLibrary {
    constructor(docsDir = './.nikcli') {
        this.docs = new Map();
        this.searchIndex = new Map();
        this.categories = new Set();
        this.maxDocs = 1000;
        this.docsFile = path.join(docsDir, 'documentation-library.json');
        this.loadLibrary();
    }
    async addDocumentation(url, category = 'general', tags = []) {
        try {
            console.log(chalk_1.default.blue(`📖 Fetching documentation from: ${url}`));
            const content = await this.extractWebContent(url);
            if (!content || content.length < 100) {
                throw new Error('Content too short or empty');
            }
            const title = this.extractTitle(content, url);
            const analysis = this.analyzeContent(content);
            const entry = {
                id: this.generateId(),
                url,
                title,
                content: content.substring(0, 50000),
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
    async search(query, category, limit = 10) {
        const normalizedQuery = this.normalizeText(query);
        const queryTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 2);
        const results = [];
        for (const [id, entry] of this.docs) {
            if (category && entry.category !== category)
                continue;
            const score = this.calculateRelevanceScore(entry, queryTerms);
            if (score > 0.1) {
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
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    async searchWithWebFallback(query, category) {
        const localResults = await this.search(query, category, 5);
        if (localResults.length > 0 && localResults[0].score > 0.5) {
            console.log(chalk_1.default.green(`📚 Found ${localResults.length} relevant docs in library`));
            return localResults;
        }
        console.log(chalk_1.default.yellow(`🔍 No relevant docs found, searching web...`));
        try {
            const webResults = await this.searchWeb(query);
            for (const result of webResults.slice(0, 3)) {
                try {
                    await this.addDocumentation(result.url, category || 'web-search', [query]);
                }
                catch (error) {
                }
            }
            return webResults;
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Web search failed: ${error}`));
            return localResults;
        }
    }
    async extractWebContent(url) {
        try {
            const { stdout } = await execAsync(`curl -s -L "${url}" -H "User-Agent: Mozilla/5.0"`);
            const textContent = this.extractTextFromHTML(stdout);
            return textContent;
        }
        catch (error) {
            throw new Error(`Failed to extract content: ${error}`);
        }
    }
    extractTextFromHTML(html) {
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
    extractTitle(content, url) {
        const lines = content.split('\n').filter(line => line.trim().length > 0);
        for (const line of lines.slice(0, 10)) {
            if (line.length > 10 && line.length < 100) {
                return line.substring(0, 80) + (line.length > 80 ? '...' : '');
            }
        }
        try {
            const urlObj = new URL(url);
            return urlObj.hostname + urlObj.pathname;
        }
        catch {
            return url.substring(0, 50);
        }
    }
    analyzeContent(content) {
        const words = content.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        const language = this.detectLanguage(content);
        const suggestedTags = this.suggestTags(content);
        return {
            wordCount,
            language,
            suggestedTags
        };
    }
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
    suggestTags(content) {
        const tags = [];
        const lowerContent = content.toLowerCase();
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
        return tags.slice(0, 5);
    }
    calculateRelevanceScore(entry, queryTerms) {
        const normalizedContent = this.normalizeText(entry.content);
        const normalizedTitle = this.normalizeText(entry.title);
        let score = 0;
        for (const term of queryTerms) {
            if (normalizedTitle.includes(term)) {
                score += 0.4;
            }
            const contentMatches = (normalizedContent.match(new RegExp(term, 'g')) || []).length;
            score += Math.min(0.3, contentMatches * 0.05);
            if (entry.tags.some(tag => tag.toLowerCase().includes(term))) {
                score += 0.2;
            }
        }
        score = score / queryTerms.length;
        score *= entry.relevance;
        score *= (1 + entry.accessCount * 0.1);
        return Math.min(1, score);
    }
    findMatchedTerms(entry, queryTerms) {
        const normalizedContent = this.normalizeText(entry.content + ' ' + entry.title);
        return queryTerms.filter(term => normalizedContent.includes(term));
    }
    generateSnippet(content, queryTerms, maxLength = 200) {
        const normalizedContent = this.normalizeText(content);
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
        const start = Math.max(0, bestPosition - 50);
        const end = Math.min(content.length, start + maxLength);
        let snippet = content.substring(start, end);
        for (const term of queryTerms) {
            const regex = new RegExp(`(${term})`, 'gi');
            snippet = snippet.replace(regex, '**$1**');
        }
        return snippet;
    }
    async searchWeb(query) {
        console.log(chalk_1.default.yellow(`🌐 Simulating web search for: ${query}`));
        return [];
    }
    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
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
    evictOldEntries() {
        const entries = Array.from(this.docs.entries())
            .sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());
        const toRemove = Math.ceil(entries.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
            this.docs.delete(entries[i][0]);
        }
    }
    generateId() {
        return `doc_${Date.now()}_${(0, crypto_1.randomBytes)(6).toString('base64url')}`;
    }
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
        }
    }
    async saveLibrary() {
        try {
            const data = JSON.stringify(Object.fromEntries(this.docs), null, 2);
            await fs.writeFile(this.docsFile, data);
        }
        catch (error) {
            console.error('Failed to save documentation library:', error);
        }
    }
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
exports.docLibrary = new DocumentationLibrary();
