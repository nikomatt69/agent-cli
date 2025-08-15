// 🧠 Contextual Memory System
import { 
  TaskContext, MemoryItem, MemoryType, Task, TaskResult,
  Performance, Association
} from './types';

// Vector Store Interface for similarity search
export interface VectorStore {
  add(id: string, vector: number[], metadata: any): Promise<void>;
  search(query: number[], k: number): Promise<SearchResult[]>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: any;
  vector?: number[];
}

// Episodic Memory for storing specific experiences
export interface EpisodicStore {
  storeEpisode(episode: Episode): Promise<void>;
  findSimilar(query: string, k?: number): Promise<Episode[]>;
  getEpisode(id: string): Promise<Episode | null>;
  getRecentEpisodes(count: number): Promise<Episode[]>;
}

export interface Episode {
  id: string;
  timestamp: number;
  context: TaskContext;
  task: Task;
  result: TaskResult;
  performance: Performance;
  tags: string[];
  summary: string;
  embedding?: number[];
}

// Semantic Memory for storing conceptual knowledge
export interface SemanticGraph {
  addConcept(concept: Concept): Promise<void>;
  search(query: string): Promise<Concept[]>;
  getRelated(conceptId: string): Promise<Concept[]>;
  updateRelations(conceptId: string, relations: Relation[]): Promise<void>;
}

export interface Concept {
  id: string;
  name: string;
  type: ConceptType;
  properties: Record<string, any>;
  embedding?: number[];
  confidence: number;
  createdAt: number;
  lastUpdated: number;
}

export interface Relation {
  from: string;
  to: string;
  type: RelationType;
  strength: number;
  metadata?: Record<string, any>;
}

export enum ConceptType {
  PATTERN = 'pattern',
  TECHNIQUE = 'technique',
  PROBLEM = 'problem',
  SOLUTION = 'solution',
  DOMAIN = 'domain',
  TOOL = 'tool'
}

export enum RelationType {
  SIMILAR_TO = 'similar_to',
  PART_OF = 'part_of',
  CAUSES = 'causes',
  SOLVES = 'solves',
  REQUIRES = 'requires',
  CONFLICTS_WITH = 'conflicts_with'
}

export class ContextualMemory {
  private shortTermMemory: Map<string, MemoryItem> = new Map();
  private longTermMemory: VectorStore;
  private episodicMemory: EpisodicStore;
  private semanticMemory: SemanticGraph;
  private associationGraph: Map<string, Association[]> = new Map();
  private memoryCapacity: number = 1000;
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(
    vectorStore: VectorStore,
    episodicStore: EpisodicStore,
    semanticGraph: SemanticGraph
  ) {
    this.longTermMemory = vectorStore;
    this.episodicMemory = episodicStore;
    this.semanticMemory = semanticGraph;
  }

  async storeContext(context: TaskContext): Promise<void> {
    const contextId = this.generateContextId(context);
    
    // Store in short-term memory immediately
    const memoryItem: MemoryItem = {
      id: contextId,
      content: context,
      type: MemoryType.EPISODIC,
      timestamp: Date.now(),
      relevance: await this.calculateRelevance(context),
      associations: await this.findAssociations(context),
      accessCount: 1,
      lastAccess: Date.now()
    };
    
    this.shortTermMemory.set(contextId, memoryItem);
    
    // Generate embedding for long-term storage
    const embedding = await this.generateEmbedding(context);
    await this.longTermMemory.add(contextId, embedding, {
      type: 'context',
      timestamp: Date.now(),
      summary: this.generateSummary(context)
    });
    
    // Update associations and patterns
    await this.updateAssociations(context);
    await this.updatePatterns(context);
    
    // Manage memory capacity
    await this.pruneMemoryIfNeeded();
  }

  async storeTaskExperience(task: Task, result: TaskResult, performance: Performance): Promise<void> {
    const episode: Episode = {
      id: this.generateEpisodeId(task, result),
      timestamp: Date.now(),
      context: task.context,
      task,
      result,
      performance,
      tags: this.generateTags(task, result),
      summary: this.generateEpisodeSummary(task, result, performance),
      embedding: await this.generateEmbedding({
        task: task.description,
        type: task.type,
        result: result.toString(),
        performance: performance.overall
      })
    };
    
    await this.episodicMemory.storeEpisode(episode);
    
    // Extract and store semantic concepts
    await this.extractSemanticConcepts(task, result, performance);
    
    // Update performance patterns
    await this.updatePerformancePatterns(task, performance);
  }

  async retrieveRelevantContext(query: string, options?: {
    maxResults?: number;
    minRelevance?: number;
    includeRecent?: boolean;
    contextTypes?: string[];
  }): Promise<any[]> {
    const { 
      maxResults = 10, 
      minRelevance = 0.3, 
      includeRecent = true,
      contextTypes = ['all']
    } = options || {};
    
    const results: any[] = [];
    
    // 1. Search semantic memory for conceptual matches
    const semanticMatches = await this.searchSemanticMemory(query);
    results.push(...semanticMatches.map(concept => ({
      id: concept.id,
      content: concept,
      relevance: concept.confidence,
      type: 'semantic',
      source: 'semantic_memory',
      timestamp: concept.lastUpdated
    })));
    
    // 2. Search episodic memory for similar experiences
    const episodicMatches = await this.searchEpisodicMemory(query);
    results.push(...episodicMatches.map(episode => ({
      id: episode.id,
      content: episode,
      relevance: this.calculateEpisodicRelevance(episode, query),
      type: 'episodic',
      source: 'episodic_memory',
      timestamp: episode.timestamp
    })));
    
    // 3. Search vector store for similar contexts
    const queryEmbedding = await this.generateEmbedding(query);
    const vectorMatches = await this.longTermMemory.search(queryEmbedding, maxResults);
    results.push(...vectorMatches.map(match => ({
      id: match.id,
      content: match.metadata,
      relevance: match.score,
      type: 'contextual',
      source: 'vector_store',
      timestamp: match.metadata.timestamp
    })));
    
    // 4. Include recent context if requested
    if (includeRecent) {
      const recentContext = this.getRecentContext(5);
      results.push(...recentContext.map(item => ({
        id: item.id,
        content: item.content,
        relevance: item.relevance * 0.8, // Slight penalty for being only recent
        type: 'recent',
        source: 'short_term_memory',
        timestamp: item.timestamp
      })));
    }
    
    // 5. Rank by relevance and apply filters
    const filteredResults = results
      .filter(r => r.relevance >= minRelevance)
      .filter(r => contextTypes.includes('all') || contextTypes.includes(r.type))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);
    
    // 6. Enhance with associations
    for (const result of filteredResults) {
      result.associations = await this.getAssociations(result.id);
    }
    
    return filteredResults;
  }

  async consolidateMemory(): Promise<void> {
    // Move important short-term memories to long-term
    const importantMemories = Array.from(this.shortTermMemory.values())
      .filter(item => item.relevance > 0.7 || item.accessCount > 3);
    
    for (const memory of importantMemories) {
      if (!memory.embedding) {
        memory.embedding = await this.generateEmbedding(memory.content);
      }
      
      await this.longTermMemory.add(
        memory.id, 
        memory.embedding, 
        {
          content: memory.content,
          type: memory.type,
          relevance: memory.relevance,
          accessCount: memory.accessCount,
          timestamp: memory.timestamp
        }
      );
    }
    
    // Strengthen frequently accessed associations
    await this.strengthenAssociations();
    
    // Update semantic concepts based on patterns
    await this.updateSemanticConcepts();
    
    // Prune low-relevance memories
    await this.pruneMemory();
  }

  async forgetIrrelevantMemories(): Promise<void> {
    const currentTime = Date.now();
    const retentionPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    // Remove old, low-relevance short-term memories
    for (const [id, memory] of this.shortTermMemory.entries()) {
      const age = currentTime - memory.timestamp;
      const shouldForget = age > retentionPeriod && 
                          memory.relevance < 0.3 && 
                          memory.accessCount < 2;
      
      if (shouldForget) {
        this.shortTermMemory.delete(id);
      }
    }
    
    // Clean up associations to forgotten memories
    await this.cleanupAssociations();
  }

  async generateInsights(): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Pattern-based insights
    const patterns = await this.identifyPatterns();
    for (const pattern of patterns) {
      insights.push({
        type: 'pattern',
        description: `Identified recurring pattern: ${pattern.description}`,
        confidence: pattern.confidence,
        evidence: pattern.evidence,
        actionable: pattern.actionable
      });
    }
    
    // Performance insights
    const performanceInsights = await this.analyzePerformancePatterns();
    insights.push(...performanceInsights);
    
    // Knowledge gaps
    const knowledgeGaps = await this.identifyKnowledgeGaps();
    for (const gap of knowledgeGaps) {
      insights.push({
        type: 'knowledge_gap',
        description: `Knowledge gap identified: ${gap.domain}`,
        confidence: gap.confidence,
        evidence: gap.evidence,
        actionable: true
      });
    }
    
    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  // Private helper methods
  private generateContextId(context: TaskContext): string {
    return `ctx_${context.id}_${Date.now()}`;
  }

  private generateEpisodeId(task: Task, result: TaskResult): string {
    return `ep_${task.id}_${Date.now()}`;
  }

  private async calculateRelevance(context: TaskContext): Promise<number> {
    // Base relevance factors
    let relevance = 0.5;
    
    // Increase relevance for complex tasks
    if (context.codebase?.complexity && context.codebase.complexity > 0.7) {
      relevance += 0.2;
    }
    
    // Increase relevance for recent contexts
    const age = Date.now() - (context as any).timestamp || 0;
    const ageHours = age / (1000 * 60 * 60);
    if (ageHours < 24) {
      relevance += 0.1;
    }
    
    // Increase relevance based on associations
    const associations = await this.findAssociations(context);
    relevance += associations.length * 0.05;
    
    return Math.min(1.0, relevance);
  }

  private async findAssociations(context: TaskContext): Promise<Association[]> {
    const associations: Association[] = [];
    
    // Find associations based on file similarity
    if (context.files) {
      for (const file of context.files) {
        const similarFiles = await this.findSimilarFiles(file);
        associations.push(...similarFiles.map(sf => ({
          id: `file_${sf.path}`,
          type: 'file_similarity',
          strength: sf.similarity,
          metadata: { path: sf.path }
        })));
      }
    }
    
    // Find associations based on codebase patterns
    if (context.codebase) {
      const patternAssociations = await this.findPatternAssociations(context.codebase);
      associations.push(...patternAssociations);
    }
    
    return associations;
  }

  private async generateEmbedding(content: any): Promise<number[]> {
    const contentString = typeof content === 'string' ? content : JSON.stringify(content);
    
    // Check cache first
    if (this.embeddingCache.has(contentString)) {
      return this.embeddingCache.get(contentString)!;
    }
    
    // Simple embedding generation (in real implementation, use proper embedding model)
    const embedding = this.simpleEmbedding(contentString);
    
    // Cache the result
    this.embeddingCache.set(contentString, embedding);
    
    return embedding;
  }

  private simpleEmbedding(text: string): number[] {
    // Simplified embedding - in real implementation, use proper models like BERT, etc.
    const words = text.toLowerCase().split(/\s+/);
    const vocab = ['code', 'function', 'class', 'variable', 'error', 'debug', 'test', 'implement'];
    
    const embedding = new Array(128).fill(0);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const hash = this.hashString(word) % 128;
      embedding[hash] += 1;
      
      // Add semantic weight for known vocab
      if (vocab.includes(word)) {
        const vocabIndex = vocab.indexOf(word);
        embedding[vocabIndex] += 2;
      }
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private generateSummary(context: TaskContext): string {
    const elements = [
      context.codebase?.language || 'unknown',
      context.codebase?.framework || 'framework',
      `${context.files?.length || 0} files`,
      `complexity: ${context.codebase?.complexity || 'unknown'}`
    ];
    
    return elements.join(', ');
  }

  private generateTags(task: Task, result: TaskResult): string[] {
    const tags = [task.type.toString()];
    
    if (task.complexity) tags.push(task.complexity.toString());
    if (task.context.codebase?.language) tags.push(task.context.codebase.language);
    if (task.context.codebase?.framework) tags.push(task.context.codebase.framework);
    
    return tags;
  }

  private generateEpisodeSummary(task: Task, result: TaskResult, performance: Performance): string {
    return `${task.type} task with ${performance.accuracy.toFixed(2)} accuracy, ${performance.efficiency.toFixed(2)} efficiency`;
  }

  private async updateAssociations(context: TaskContext): Promise<void> {
    const contextId = this.generateContextId(context);
    const associations = await this.findAssociations(context);
    this.associationGraph.set(contextId, associations);
  }

  private async updatePatterns(context: TaskContext): Promise<void> {
    // Identify and store recurring patterns
    const patterns = await this.identifyNewPatterns(context);
    
    for (const pattern of patterns) {
      await this.semanticMemory.addConcept({
        id: `pattern_${Date.now()}_${Math.random()}`,
        name: pattern.name,
        type: ConceptType.PATTERN,
        properties: pattern.properties,
        confidence: pattern.confidence,
        createdAt: Date.now(),
        lastUpdated: Date.now()
      });
    }
  }

  private async pruneMemoryIfNeeded(): Promise<void> {
    if (this.shortTermMemory.size > this.memoryCapacity) {
      // Remove least relevant and oldest memories
      const memories = Array.from(this.shortTermMemory.entries())
        .sort((a, b) => {
          const scoreA = a[1].relevance + (a[1].accessCount * 0.1);
          const scoreB = b[1].relevance + (b[1].accessCount * 0.1);
          return scoreA - scoreB;
        });
      
      const toRemove = memories.slice(0, Math.floor(this.memoryCapacity * 0.2));
      for (const [id] of toRemove) {
        this.shortTermMemory.delete(id);
      }
    }
  }

  private getRecentContext(count: number): MemoryItem[] {
    return Array.from(this.shortTermMemory.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }

  private async searchSemanticMemory(query: string): Promise<Concept[]> {
    return await this.semanticMemory.search(query);
  }

  private async searchEpisodicMemory(query: string): Promise<Episode[]> {
    return await this.episodicMemory.findSimilar(query);
  }

  private calculateEpisodicRelevance(episode: Episode, query: string): number {
    // Calculate relevance based on multiple factors
    let relevance = 0;
    
    // Task similarity
    if (episode.task.description.toLowerCase().includes(query.toLowerCase())) {
      relevance += 0.4;
    }
    
    // Performance factor
    relevance += episode.performance.overall * 0.3;
    
    // Recency factor
    const age = Date.now() - episode.timestamp;
    const ageHours = age / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 1 - (ageHours / (24 * 7))); // Decay over a week
    relevance += recencyScore * 0.3;
    
    return Math.min(1, relevance);
  }

  private async getAssociations(itemId: string): Promise<Association[]> {
    return this.associationGraph.get(itemId) || [];
  }

  // Placeholder implementations for complex methods
  private async extractSemanticConcepts(task: Task, result: TaskResult, performance: Performance): Promise<void> {
    // Extract concepts from task and result
    // This would be more sophisticated in a real implementation
  }

  private async updatePerformancePatterns(task: Task, performance: Performance): Promise<void> {
    // Update patterns based on performance data
  }

  private async strengthenAssociations(): Promise<void> {
    // Strengthen frequently accessed associations
  }

  private async updateSemanticConcepts(): Promise<void> {
    // Update semantic concepts based on new patterns
  }

  private async pruneMemory(): Promise<void> {
    // Remove low-relevance memories from long-term storage
  }

  private async cleanupAssociations(): Promise<void> {
    // Remove associations to deleted memories
  }

  private async identifyPatterns(): Promise<Pattern[]> {
    // Identify patterns in memory
    return [];
  }

  private async analyzePerformancePatterns(): Promise<Insight[]> {
    // Analyze performance patterns
    return [];
  }

  private async identifyKnowledgeGaps(): Promise<KnowledgeGap[]> {
    // Identify areas where knowledge is lacking
    return [];
  }

  private async findSimilarFiles(file: any): Promise<{ path: string; similarity: number }[]> {
    // Find files similar to the given file
    return [];
  }

  private async findPatternAssociations(codebase: any): Promise<Association[]> {
    // Find associations based on codebase patterns
    return [];
  }

  private async identifyNewPatterns(context: TaskContext): Promise<Pattern[]> {
    // Identify new patterns from context
    return [];
  }
}

// Supporting interfaces
interface RelevantContext {
  id: string;
  content: any;
  relevance: number;
  type: string;
  source: string;
  timestamp: number;
  associations?: Association[];
}

interface Insight {
  type: string;
  description: string;
  confidence: number;
  evidence: any[];
  actionable: boolean;
}

interface Pattern {
  name: string;
  description: string;
  properties: Record<string, any>;
  confidence: number;
  evidence: any[];
  actionable: boolean;
}

interface KnowledgeGap {
  domain: string;
  confidence: number;
  evidence: any[];
}

// Simple implementations for vector store and episodic memory
export class SimpleVectorStore implements VectorStore {
  private vectors: Map<string, { vector: number[]; metadata: any }> = new Map();

  async add(id: string, vector: number[], metadata: any): Promise<void> {
    this.vectors.set(id, { vector, metadata });
  }

  async search(query: number[], k: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    for (const [id, { vector, metadata }] of this.vectors.entries()) {
      const score = this.cosineSimilarity(query, vector);
      results.push({ id, score, metadata, vector });
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async remove(id: string): Promise<void> {
    this.vectors.delete(id);
  }

  async clear(): Promise<void> {
    this.vectors.clear();
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
  }
}

export class SimpleEpisodicStore implements EpisodicStore {
  private episodes: Map<string, Episode> = new Map();

  async storeEpisode(episode: Episode): Promise<void> {
    this.episodes.set(episode.id, episode);
  }

  async findSimilar(query: string, k: number = 5): Promise<Episode[]> {
    const episodes = Array.from(this.episodes.values());
    
    return episodes
      .map(episode => ({
        episode,
        relevance: this.calculateSimilarity(query, episode)
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, k)
      .map(item => item.episode);
  }

  async getEpisode(id: string): Promise<Episode | null> {
    return this.episodes.get(id) || null;
  }

  async getRecentEpisodes(count: number): Promise<Episode[]> {
    return Array.from(this.episodes.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }

  private calculateSimilarity(query: string, episode: Episode): number {
    const text = `${episode.task.description} ${episode.summary}`.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Simple text similarity
    const words = queryLower.split(/\s+/);
    const matches = words.filter(word => text.includes(word)).length;
    
    return matches / words.length;
  }
}

export class SimpleSemanticGraph implements SemanticGraph {
  private concepts: Map<string, Concept> = new Map();
  private relations: Map<string, Relation[]> = new Map();

  async addConcept(concept: Concept): Promise<void> {
    this.concepts.set(concept.id, concept);
  }

  async search(query: string): Promise<Concept[]> {
    const queryLower = query.toLowerCase();
    const results: Concept[] = [];
    
    for (const concept of this.concepts.values()) {
      if (concept.name.toLowerCase().includes(queryLower) ||
          JSON.stringify(concept.properties).toLowerCase().includes(queryLower)) {
        results.push(concept);
      }
    }
    
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  async getRelated(conceptId: string): Promise<Concept[]> {
    const relations = this.relations.get(conceptId) || [];
    const relatedConcepts: Concept[] = [];
    
    for (const relation of relations) {
      const concept = this.concepts.get(relation.to);
      if (concept) {
        relatedConcepts.push(concept);
      }
    }
    
    return relatedConcepts;
  }

  async updateRelations(conceptId: string, relations: Relation[]): Promise<void> {
    this.relations.set(conceptId, relations);
  }
}