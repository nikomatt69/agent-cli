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
exports.docsContextManager = exports.DocsContextManager = void 0;
const fs = __importStar(require("fs/promises"));
const fsSync = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const documentation_library_1 = require("../core/documentation-library");
const cloud_docs_provider_1 = require("../core/cloud-docs-provider");
class DocsContextManager {
    constructor(cacheDir = './.nikcli') {
        this.loadedDocs = new Map();
        this.maxContextSize = 50000; // Max words in context
        this.compressionEnabled = true;
        this.contextFile = path.join(cacheDir, 'loaded-docs-context.json');
        // Non chiamare async nel costruttore - caricamento lazy
    }
    /**
     * Inizializza il contesto se non già fatto
     */
    ensureContextLoaded() {
        if (this.loadedDocs.size === 0) {
            this.loadContextSync();
        }
    }
    /**
     * Carica il contesto in modo sincrono per evitare problemi nel costruttore
     */
    loadContextSync() {
        try {
            if (!fsSync.existsSync(this.contextFile))
                return;
            const data = fsSync.readFileSync(this.contextFile, 'utf-8');
            const context = JSON.parse(data);
            context.loadedDocs.forEach(doc => {
                this.loadedDocs.set(doc.id, {
                    ...doc,
                    loadedAt: new Date(doc.loadedAt)
                });
            });
            console.log(chalk_1.default.gray(`📚 Restored ${this.loadedDocs.size} documents to context`));
        }
        catch (error) {
            console.error(chalk_1.default.yellow(`⚠️ Could not load docs context: ${error}`));
        }
    }
    /**
     * Carica documenti specifici nel contesto AI
     */
    async loadDocs(docIdentifiers) {
        this.ensureContextLoaded();
        console.log(chalk_1.default.blue(`📚 Loading ${docIdentifiers.length} documents into AI context...`));
        const loadedDocs = [];
        const notFound = [];
        for (const identifier of docIdentifiers) {
            try {
                // Prima cerca nei docs locali
                const localDoc = await this.findLocalDoc(identifier);
                if (localDoc) {
                    const loadedDoc = this.convertToLoadedDoc(localDoc, 'local');
                    this.loadedDocs.set(loadedDoc.id, loadedDoc);
                    loadedDocs.push(loadedDoc);
                    continue;
                }
                // Poi cerca nei docs condivisi
                const sharedDoc = await this.findSharedDoc(identifier);
                if (sharedDoc) {
                    const loadedDoc = this.convertSharedToLoadedDoc(sharedDoc, 'shared');
                    this.loadedDocs.set(loadedDoc.id, loadedDoc);
                    loadedDocs.push(loadedDoc);
                    continue;
                }
                notFound.push(identifier);
            }
            catch (error) {
                console.error(chalk_1.default.red(`❌ Error loading '${identifier}': ${error}`));
                notFound.push(identifier);
            }
        }
        if (loadedDocs.length > 0) {
            // Ottimizza il contesto se necessario
            await this.optimizeContext();
            await this.saveContext();
            console.log(chalk_1.default.green(`✅ Loaded ${loadedDocs.length} documents into context`));
            loadedDocs.forEach(doc => {
                console.log(chalk_1.default.gray(`   • ${doc.title} (${doc.source}, ${doc.content.split(' ').length} words)`));
            });
        }
        if (notFound.length > 0) {
            console.log(chalk_1.default.yellow(`⚠️ Not found: ${notFound.join(', ')}`));
            console.log(chalk_1.default.gray('Use /doc-search to find available documents'));
        }
        return loadedDocs;
    }
    /**
     * Rimuove documenti dal contesto
     */
    async unloadDocs(docIdentifiers) {
        if (!docIdentifiers || docIdentifiers.length === 0) {
            // Rimuovi tutti i documenti
            const count = this.loadedDocs.size;
            this.loadedDocs.clear();
            await this.saveContext();
            console.log(chalk_1.default.green(`✅ Removed all ${count} documents from context`));
            return;
        }
        let removedCount = 0;
        for (const identifier of docIdentifiers) {
            // Cerca per ID, titolo o tag
            const docToRemove = Array.from(this.loadedDocs.values()).find(doc => doc.id === identifier ||
                doc.title.toLowerCase().includes(identifier.toLowerCase()) ||
                doc.tags.some(tag => tag.toLowerCase().includes(identifier.toLowerCase())));
            if (docToRemove) {
                this.loadedDocs.delete(docToRemove.id);
                removedCount++;
                console.log(chalk_1.default.gray(`   • Removed: ${docToRemove.title}`));
            }
        }
        if (removedCount > 0) {
            await this.saveContext();
            console.log(chalk_1.default.green(`✅ Removed ${removedCount} documents from context`));
        }
        else {
            console.log(chalk_1.default.yellow('⚠️ No matching documents found to remove'));
        }
    }
    /**
     * Ottieni tutti i documenti caricati
     */
    getLoadedDocs() {
        this.ensureContextLoaded();
        return Array.from(this.loadedDocs.values()).sort((a, b) => b.loadedAt.getTime() - a.loadedAt.getTime());
    }
    /**
     * Ottieni riassunto del contesto per l'AI
     */
    getContextSummary() {
        this.ensureContextLoaded();
        if (this.loadedDocs.size === 0) {
            return "No documentation loaded in context.";
        }
        const docs = this.getLoadedDocs();
        const totalWords = docs.reduce((sum, doc) => sum + doc.content.split(' ').length, 0);
        let summary = `Available documentation context (${docs.length} documents, ~${totalWords.toLocaleString()} words):\n\n`;
        docs.forEach((doc, index) => {
            const wordCount = doc.content.split(' ').length;
            summary += `${index + 1}. **${doc.title}** (${doc.category})\n`;
            summary += `   Source: ${doc.source} | Words: ${wordCount.toLocaleString()} | Tags: ${doc.tags.join(', ')}\n`;
            if (doc.summary) {
                summary += `   Summary: ${doc.summary}\n`;
            }
            summary += '\n';
        });
        summary += "Use this documentation to provide accurate, context-aware responses about these topics.";
        return summary;
    }
    /**
     * Ottieni contenuto completo per l'AI
     */
    getFullContext() {
        if (this.loadedDocs.size === 0) {
            return "";
        }
        const docs = this.getLoadedDocs();
        let context = "# DOCUMENTATION CONTEXT\n\n";
        docs.forEach((doc, index) => {
            context += `## Document ${index + 1}: ${doc.title}\n`;
            context += `**Category:** ${doc.category}\n`;
            context += `**Tags:** ${doc.tags.join(', ')}\n`;
            context += `**Source:** ${doc.source}\n\n`;
            context += "**Content:**\n";
            context += doc.content + '\n\n';
            context += "---\n\n";
        });
        return context;
    }
    /**
     * Suggerisce documenti basati su una query
     */
    async suggestDocs(query, limit = 5) {
        const suggestions = [];
        // Cerca nei docs locali
        const localResults = await documentation_library_1.docLibrary.search(query.toLowerCase(), undefined, limit);
        localResults.forEach(result => {
            suggestions.push(result.entry.title);
        });
        // Cerca nei docs condivisi se disponibile
        const cloudProvider = (0, cloud_docs_provider_1.getCloudDocsProvider)();
        if (cloudProvider?.isReady()) {
            try {
                const sharedResults = await cloudProvider.searchShared(query, undefined, limit);
                sharedResults.forEach(doc => {
                    if (!suggestions.includes(doc.title)) {
                        suggestions.push(doc.title);
                    }
                });
            }
            catch (error) {
                // Ignora errori di ricerca cloud
            }
        }
        return suggestions.slice(0, limit);
    }
    /**
     * Ottieni statistiche del contesto
     */
    getContextStats() {
        this.ensureContextLoaded();
        const docs = this.getLoadedDocs();
        const totalWords = docs.reduce((sum, doc) => sum + doc.content.split(' ').length, 0);
        const categories = [...new Set(docs.map(doc => doc.category))];
        const sources = {
            local: docs.filter(doc => doc.source === 'local').length,
            shared: docs.filter(doc => doc.source === 'shared').length
        };
        return {
            loadedCount: docs.length,
            totalWords,
            categories,
            sources,
            utilizationPercent: Math.min(100, (totalWords / this.maxContextSize) * 100)
        };
    }
    /**
     * Trova documento locale per identificatore
     */
    async findLocalDoc(identifier) {
        try {
            // Accedi alla mappa privata dei docs
            const allDocs = Array.from(documentation_library_1.docLibrary.docs.values());
            return allDocs.find(doc => doc.id === identifier ||
                doc.title.toLowerCase().includes(identifier.toLowerCase()) ||
                doc.tags.some(tag => tag.toLowerCase().includes(identifier.toLowerCase())) ||
                doc.category.toLowerCase() === identifier.toLowerCase()) || null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Trova documento condiviso per identificatore
     */
    async findSharedDoc(identifier) {
        const cloudProvider = (0, cloud_docs_provider_1.getCloudDocsProvider)();
        if (!cloudProvider?.isReady()) {
            return null;
        }
        try {
            const results = await cloudProvider.searchShared(identifier, undefined, 1);
            return results.length > 0 ? results[0] : null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Converte DocumentationEntry in LoadedDoc
     */
    convertToLoadedDoc(doc, source) {
        return {
            id: doc.id,
            title: doc.title,
            content: doc.content,
            category: doc.category,
            tags: doc.tags,
            source,
            loadedAt: new Date(),
            summary: this.generateSummary(doc.content)
        };
    }
    /**
     * Converte SharedDocEntry in LoadedDoc
     */
    convertSharedToLoadedDoc(doc, source) {
        return {
            id: doc.id,
            title: doc.title,
            content: doc.content,
            category: doc.category,
            tags: doc.tags,
            source,
            loadedAt: new Date(),
            summary: this.generateSummary(doc.content)
        };
    }
    /**
     * Genera riassunto del contenuto
     */
    generateSummary(content) {
        // Estrai prime 2-3 frasi significative
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
        return sentences.slice(0, 2).join('. ').substring(0, 200) + '...';
    }
    /**
     * Ottimizza il contesto se supera i limiti
     */
    async optimizeContext() {
        const stats = this.getContextStats();
        if (stats.utilizationPercent > 90) {
            console.log(chalk_1.default.yellow('⚠️ Context approaching size limit. Optimizing...'));
            // Rimuovi i documenti più vecchi o meno utilizzati
            const docs = this.getLoadedDocs();
            const toRemove = Math.ceil(docs.length * 0.2); // Rimuovi 20%
            for (let i = docs.length - toRemove; i < docs.length; i++) {
                this.loadedDocs.delete(docs[i].id);
            }
            console.log(chalk_1.default.green(`✅ Removed ${toRemove} older documents to optimize context`));
        }
        // Comprimi contenuto se abilitato
        if (this.compressionEnabled && stats.utilizationPercent > 70) {
            this.compressLoadedDocs();
        }
    }
    /**
     * Comprimi i documenti caricati
     */
    compressLoadedDocs() {
        for (const [id, doc] of this.loadedDocs) {
            if (doc.content.length > 5000) {
                // Mantieni solo le parti più importanti del contenuto
                const paragraphs = doc.content.split('\n\n');
                const important = paragraphs.filter(p => p.includes('```') || // Code blocks
                    p.length < 500 || // Short paragraphs
                    p.includes('##') || // Headers
                    /\b(important|note|warning|example)\b/i.test(p) // Keywords
                );
                if (important.length < paragraphs.length) {
                    doc.content = important.join('\n\n') + '\n\n[Content compressed to fit context limits]';
                }
            }
        }
    }
    /**
     * Carica contesto da file
     */
    async loadContext() {
        try {
            const data = await fs.readFile(this.contextFile, 'utf-8');
            const context = JSON.parse(data);
            context.loadedDocs.forEach(doc => {
                this.loadedDocs.set(doc.id, {
                    ...doc,
                    loadedAt: new Date(doc.loadedAt)
                });
            });
            console.log(chalk_1.default.gray(`📚 Loaded ${this.loadedDocs.size} documents from previous session`));
        }
        catch (error) {
            // File non esiste, inizia con contesto vuoto
        }
    }
    /**
     * Salva contesto su file
     */
    async saveContext() {
        try {
            const context = {
                loadedDocs: this.getLoadedDocs(),
                totalWords: this.getContextStats().totalWords,
                lastUpdate: new Date(),
                maxContextSize: this.maxContextSize,
                compressionEnabled: this.compressionEnabled
            };
            await fs.writeFile(this.contextFile, JSON.stringify(context, null, 2));
        }
        catch (error) {
            console.error('Failed to save docs context:', error);
        }
    }
}
exports.DocsContextManager = DocsContextManager;
// Singleton instance
exports.docsContextManager = new DocsContextManager();
