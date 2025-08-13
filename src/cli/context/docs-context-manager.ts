import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { DocumentationEntry, docLibrary } from '../core/documentation-library';
import { SharedDocEntry, getCloudDocsProvider } from '../core/cloud-docs-provider';

export interface LoadedDoc {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source: 'local' | 'shared';
  loadedAt: Date;
  summary?: string;
}

export interface DocsContext {
  loadedDocs: LoadedDoc[];
  totalWords: number;
  lastUpdate: Date;
  maxContextSize: number;
  compressionEnabled: boolean;
}

export class DocsContextManager {
  private loadedDocs: Map<string, LoadedDoc> = new Map();
  private contextFile: string;
  private maxContextSize: number = 50000; // Max words in context
  private compressionEnabled: boolean = true;

  constructor(cacheDir: string = './.nikcli') {
    this.contextFile = path.join(cacheDir, 'loaded-docs-context.json');
    // Non chiamare async nel costruttore - caricamento lazy
  }

  /**
   * Inizializza il contesto se non già fatto
   */
  private ensureContextLoaded(): void {
    if (this.loadedDocs.size === 0) {
      this.loadContextSync();
    }
  }

  /**
   * Carica il contesto in modo sincrono per evitare problemi nel costruttore
   */
  private loadContextSync(): void {
    try {
      if (!fsSync.existsSync(this.contextFile)) return;
      
      const data = fsSync.readFileSync(this.contextFile, 'utf-8');
      const context: DocsContext = JSON.parse(data);
      
      context.loadedDocs.forEach(doc => {
        this.loadedDocs.set(doc.id, {
          ...doc,
          loadedAt: new Date(doc.loadedAt)
        });
      });
      
      console.log(chalk.gray(`📚 Restored ${this.loadedDocs.size} documents to context`));
    } catch (error) {
      console.error(chalk.yellow(`⚠️ Could not load docs context: ${error}`));
    }
  }

  /**
   * Carica documenti specifici nel contesto AI
   */
  async loadDocs(docIdentifiers: string[]): Promise<LoadedDoc[]> {
    this.ensureContextLoaded();
    console.log(chalk.blue(`📚 Loading ${docIdentifiers.length} documents into AI context...`));
    
    const loadedDocs: LoadedDoc[] = [];
    const notFound: string[] = [];

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
      } catch (error) {
        console.error(chalk.red(`❌ Error loading '${identifier}': ${error}`));
        notFound.push(identifier);
      }
    }

    if (loadedDocs.length > 0) {
      // Ottimizza il contesto se necessario
      await this.optimizeContext();
      await this.saveContext();
      
      console.log(chalk.green(`✅ Loaded ${loadedDocs.length} documents into context`));
      loadedDocs.forEach(doc => {
        console.log(chalk.gray(`   • ${doc.title} (${doc.source}, ${doc.content.split(' ').length} words)`));
      });
    }

    if (notFound.length > 0) {
      console.log(chalk.yellow(`⚠️ Not found: ${notFound.join(', ')}`));
      console.log(chalk.gray('Use /doc-search to find available documents'));
    }

    return loadedDocs;
  }

  /**
   * Rimuove documenti dal contesto
   */
  async unloadDocs(docIdentifiers?: string[]): Promise<void> {
    if (!docIdentifiers || docIdentifiers.length === 0) {
      // Rimuovi tutti i documenti
      const count = this.loadedDocs.size;
      this.loadedDocs.clear();
      await this.saveContext();
      console.log(chalk.green(`✅ Removed all ${count} documents from context`));
      return;
    }

    let removedCount = 0;
    for (const identifier of docIdentifiers) {
      // Cerca per ID, titolo o tag
      const docToRemove = Array.from(this.loadedDocs.values()).find(doc =>
        doc.id === identifier ||
        doc.title.toLowerCase().includes(identifier.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(identifier.toLowerCase()))
      );

      if (docToRemove) {
        this.loadedDocs.delete(docToRemove.id);
        removedCount++;
        console.log(chalk.gray(`   • Removed: ${docToRemove.title}`));
      }
    }

    if (removedCount > 0) {
      await this.saveContext();
      console.log(chalk.green(`✅ Removed ${removedCount} documents from context`));
    } else {
      console.log(chalk.yellow('⚠️ No matching documents found to remove'));
    }
  }

  /**
   * Ottieni tutti i documenti caricati
   */
  getLoadedDocs(): LoadedDoc[] {
    this.ensureContextLoaded();
    return Array.from(this.loadedDocs.values()).sort((a, b) => 
      b.loadedAt.getTime() - a.loadedAt.getTime()
    );
  }

  /**
   * Ottieni riassunto del contesto per l'AI
   */
  getContextSummary(): string {
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
  getFullContext(): string {
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
  async suggestDocs(query: string, limit: number = 5): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Cerca nei docs locali
    const localResults = await docLibrary.search(query.toLowerCase(), undefined, limit);
    localResults.forEach(result => {
      suggestions.push(result.entry.title);
    });

    // Cerca nei docs condivisi se disponibile
    const cloudProvider = getCloudDocsProvider();
    if (cloudProvider?.isReady()) {
      try {
        const sharedResults = await cloudProvider.searchShared(query, undefined, limit);
        sharedResults.forEach(doc => {
          if (!suggestions.includes(doc.title)) {
            suggestions.push(doc.title);
          }
        });
      } catch (error) {
        // Ignora errori di ricerca cloud
      }
    }

    return suggestions.slice(0, limit);
  }

  /**
   * Ottieni statistiche del contesto
   */
  getContextStats(): {
    loadedCount: number;
    totalWords: number;
    categories: string[];
    sources: { local: number; shared: number };
    utilizationPercent: number;
  } {
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
  private async findLocalDoc(identifier: string): Promise<DocumentationEntry | null> {
    try {
      // Accedi alla mappa privata dei docs
      const allDocs = Array.from((docLibrary as any).docs.values()) as DocumentationEntry[];
      
      return allDocs.find(doc =>
        doc.id === identifier ||
        doc.title.toLowerCase().includes(identifier.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(identifier.toLowerCase())) ||
        doc.category.toLowerCase() === identifier.toLowerCase()
      ) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Trova documento condiviso per identificatore
   */
  private async findSharedDoc(identifier: string): Promise<SharedDocEntry | null> {
    const cloudProvider = getCloudDocsProvider();
    if (!cloudProvider?.isReady()) {
      return null;
    }

    try {
      const results = await cloudProvider.searchShared(identifier, undefined, 1);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Converte DocumentationEntry in LoadedDoc
   */
  private convertToLoadedDoc(doc: DocumentationEntry, source: 'local' | 'shared'): LoadedDoc {
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
  private convertSharedToLoadedDoc(doc: SharedDocEntry, source: 'local' | 'shared'): LoadedDoc {
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
  private generateSummary(content: string): string {
    // Estrai prime 2-3 frasi significative
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 2).join('. ').substring(0, 200) + '...';
  }

  /**
   * Ottimizza il contesto se supera i limiti
   */
  private async optimizeContext(): Promise<void> {
    const stats = this.getContextStats();
    
    if (stats.utilizationPercent > 90) {
      console.log(chalk.yellow('⚠️ Context approaching size limit. Optimizing...'));
      
      // Rimuovi i documenti più vecchi o meno utilizzati
      const docs = this.getLoadedDocs();
      const toRemove = Math.ceil(docs.length * 0.2); // Rimuovi 20%
      
      for (let i = docs.length - toRemove; i < docs.length; i++) {
        this.loadedDocs.delete(docs[i].id);
      }
      
      console.log(chalk.green(`✅ Removed ${toRemove} older documents to optimize context`));
    }

    // Comprimi contenuto se abilitato
    if (this.compressionEnabled && stats.utilizationPercent > 70) {
      this.compressLoadedDocs();
    }
  }

  /**
   * Comprimi i documenti caricati
   */
  private compressLoadedDocs(): void {
    for (const [id, doc] of this.loadedDocs) {
      if (doc.content.length > 5000) {
        // Mantieni solo le parti più importanti del contenuto
        const paragraphs = doc.content.split('\n\n');
        const important = paragraphs.filter(p => 
          p.includes('```') || // Code blocks
          p.length < 500 ||    // Short paragraphs
          p.includes('##') ||  // Headers
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
  private async loadContext(): Promise<void> {
    try {
      const data = await fs.readFile(this.contextFile, 'utf-8');
      const context: DocsContext = JSON.parse(data);
      
      context.loadedDocs.forEach(doc => {
        this.loadedDocs.set(doc.id, {
          ...doc,
          loadedAt: new Date(doc.loadedAt)
        });
      });
      
      console.log(chalk.gray(`📚 Loaded ${this.loadedDocs.size} documents from previous session`));
    } catch (error) {
      // File non esiste, inizia con contesto vuoto
    }
  }

  /**
   * Salva contesto su file
   */
  private async saveContext(): Promise<void> {
    try {
      const context: DocsContext = {
        loadedDocs: this.getLoadedDocs(),
        totalWords: this.getContextStats().totalWords,
        lastUpdate: new Date(),
        maxContextSize: this.maxContextSize,
        compressionEnabled: this.compressionEnabled
      };
      
      await fs.writeFile(this.contextFile, JSON.stringify(context, null, 2));
    } catch (error) {
      console.error('Failed to save docs context:', error);
    }
  }
}

// Singleton instance
export const docsContextManager = new DocsContextManager();