import { promises as fs } from 'fs';
import path from 'path';
import { CoreMessage } from 'ai';
import chalk from 'chalk';

/** Summary of workspace analysis. */
export interface ContextSummary {
  totalFiles: number;
  totalDirs: number;
  languages: Record<string, number>;
  importantFiles: string[];
}

interface MessageMetrics {
  estimatedTokens: number;
  importance: number;
  timestamp: Date;
  type: 'user' | 'assistant' | 'system' | 'tool';
}

interface ContextMetrics {
  totalMessages: number;
  estimatedTokens: number;
  tokenLimit: number;
  compressionRatio: number;
}

/** Intelligent Context Manager with token optimization */
export class ContextManager {
  private readonly MAX_TOKENS = 180000; // Leave buffer for response
  private readonly MIN_MESSAGES = 4; // Always keep recent messages
  private readonly MAX_METRICS_SIZE = 1000; // Maximum cached metrics

  private messageMetrics: Map<string, MessageMetrics> = new Map();

  private checkMetricsSize(): void {
    const currentSize = this.messageMetrics.size;
    if (currentSize <= this.MAX_METRICS_SIZE) {
      return;
    }

    const numEntriesToRemove = currentSize - this.MAX_METRICS_SIZE;
    let removedCount = 0;
    const keysIterator = this.messageMetrics.keys();

    while (removedCount < numEntriesToRemove) {
      const nextKey = keysIterator.next();
      if (nextKey.done) {
        break;
      }
      this.messageMetrics.delete(nextKey.value);
      removedCount += 1;
    }

    if (removedCount > 0) {
      console.log(chalk.yellow(`⚠️ Trimmed ${removedCount} oldest message metrics to cap at ${this.MAX_METRICS_SIZE}`));
    }
  }
  /** 
   * Estimate tokens in a message (rough approximation) 
   * 1 token ≈ 4 characters for English text
   */
  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }
  private hashMessage(message: CoreMessage): string {
    const content = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);
    // Simple hash function - consider using crypto.createHash for production
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `msg-${message.role}-${hash}`;
  }
  /**
   * Calculate importance score for a message
   */
  private calculateImportance(message: CoreMessage, index: number, total: number): number {
    let importance = 0;

    // Recent messages are more important
    const recency = (total - index) / total;
    importance += recency * 0.4;

    // Message type importance
    if (message.role === 'system') importance += 0.3;
    if (message.role === 'user') importance += 0.2;
    if (message.role === 'assistant') importance += 0.1;

    // Content-based importance
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

    // Important keywords boost importance
    const importantKeywords = ['error', 'bug', 'fix', 'implement', 'create', 'modify', 'delete', 'update'];
    const keywordCount = importantKeywords.filter(kw => content.toLowerCase().includes(kw)).length;
    importance += keywordCount * 0.05;

    // Length penalty for very long messages
    if (content.length > 5000) importance -= 0.1;

    return Math.max(0, Math.min(1, importance));
  }

  /**
   * Optimize message context to fit within token limits
   */
  optimizeContext(messages: CoreMessage[]): { optimizedMessages: CoreMessage[], metrics: ContextMetrics } {
    this.checkMetricsSize();
    if (messages.length === 0) {
      return {
        optimizedMessages: messages,
        metrics: { totalMessages: 0, estimatedTokens: 0, tokenLimit: this.MAX_TOKENS, compressionRatio: 0 }
      };
    }

    // Calculate metrics for all messages
    let totalTokens = 0;
    messages.forEach((message, index) => {
      const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
      const tokens = this.estimateTokens(content);
      const importance = this.calculateImportance(message, index, messages.length);

      totalTokens += tokens;
      // Use content hash for stable key generation
      const contentHash = this.hashMessage(message);
      this.messageMetrics.set(contentHash, {
        estimatedTokens: tokens,
        importance,
        timestamp: new Date(),
        type: message.role as any
      });
    });

    // If within limits, return as-is
    if (totalTokens <= this.MAX_TOKENS) {
      return {
        optimizedMessages: messages,
        metrics: {
          totalMessages: messages.length,
          estimatedTokens: totalTokens,
          tokenLimit: this.MAX_TOKENS,
          compressionRatio: 0
        }
      };
    }

    console.log(chalk.yellow(`⚠️ Context optimization needed: ${totalTokens} tokens > ${this.MAX_TOKENS} limit`));

    // Optimization strategy
    const optimized = this.compressContext(messages);
    const optimizedTokens = this.calculateTotalTokens(optimized);

    console.log(chalk.green(`✅ Context optimized: ${messages.length} → ${optimized.length} messages, ${totalTokens} → ${optimizedTokens} tokens`));

    return {
      optimizedMessages: optimized,
      metrics: {
        totalMessages: optimized.length,
        estimatedTokens: optimizedTokens,
        tokenLimit: this.MAX_TOKENS,
        compressionRatio: (totalTokens - optimizedTokens) / totalTokens
      }
    };
  }

  /**
   * Compress context using intelligent strategies
   */
  private compressContext(messages: CoreMessage[]): CoreMessage[] {
    const optimized: CoreMessage[] = [];
    let currentTokens = 0;

    // Always keep system messages
    const systemMessages = messages.filter(m => m.role === 'system');
    systemMessages.forEach(msg => {
      optimized.push(msg);
      currentTokens += this.getMessageTokens(msg);
    });

    // Keep the most recent messages
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    const recentMessages = nonSystemMessages.slice(-this.MIN_MESSAGES);

    recentMessages.forEach(msg => {
      optimized.push(msg);
      currentTokens += this.getMessageTokens(msg);
    });

    // Add older messages based on importance until we hit the limit
    const olderMessages = nonSystemMessages.slice(0, -this.MIN_MESSAGES);
    const sortedByImportance = olderMessages
      .map((msg, index) => ({
        message: msg,
        importance: this.calculateImportance(msg, index, olderMessages.length),
        tokens: this.getMessageTokens(msg)
      }))
      .sort((a, b) => b.importance - a.importance);

    for (const item of sortedByImportance) {
      if (currentTokens + item.tokens <= this.MAX_TOKENS) {
        optimized.splice(-this.MIN_MESSAGES, 0, item.message); // Insert before recent messages
        currentTokens += item.tokens;
      }
    }

    // If still over limit, summarize middle conversations
    if (currentTokens > this.MAX_TOKENS) {
      return this.createSummaryContext(optimized);
    }

    return optimized;
  }

  /**
   * Create a summarized context when compression isn't enough
   */
  private createSummaryContext(messages: CoreMessage[]): CoreMessage[] {
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // Keep first few and last few messages, summarize the middle
    const keepStart = 2;
    const keepEnd = 3;

    if (nonSystemMessages.length <= keepStart + keepEnd) {
      return messages;
    }

    const startMessages = nonSystemMessages.slice(0, keepStart);
    const endMessages = nonSystemMessages.slice(-keepEnd);
    const middleMessages = nonSystemMessages.slice(keepStart, -keepEnd);

    // Create summary of middle messages
    const summaryContent = this.createMiddleSummary(middleMessages);
    const summaryMessage: CoreMessage = {
      role: 'system',
      content: `[CONTEXT SUMMARY] Previous conversation (${middleMessages.length} messages): ${summaryContent}`
    };

    return [
      ...systemMessages,
      ...startMessages,
      summaryMessage,
      ...endMessages
    ];
  }

  /**
   * Create a concise summary of middle messages
   */
  private createMiddleSummary(messages: CoreMessage[]): string {
    const topics = new Set<string>();
    const actions = new Set<string>();

    messages.forEach(msg => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

      // Extract key topics and actions
      if (content.includes('file') || content.includes('create') || content.includes('modify')) {
        actions.add('file operations');
      }
      if (content.includes('bug') || content.includes('error') || content.includes('fix')) {
        actions.add('bug fixing');
      }
      if (content.includes('implement') || content.includes('add') || content.includes('feature')) {
        actions.add('feature development');
      }
      if (content.includes('test') || content.includes('spec')) {
        actions.add('testing');
      }
    });

    const summary = [
      actions.size > 0 ? `Actions: ${Array.from(actions).join(', ')}` : '',
      `${messages.length} messages processed`
    ].filter(Boolean).join('. ');

    return summary;
  }

  /**
   * Calculate total tokens for message array
   */
  private calculateTotalTokens(messages: CoreMessage[]): number {
    return messages.reduce((total, msg) => total + this.getMessageTokens(msg), 0);
  }

  /**
   * Get token count for a single message
   */
  private getMessageTokens(message: CoreMessage): number {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    return this.estimateTokens(content);
  }

  /**
   * Get context metrics
   */
  getContextMetrics(messages: CoreMessage[]): ContextMetrics {
    const totalTokens = this.calculateTotalTokens(messages);
    return {
      totalMessages: messages.length,
      estimatedTokens: totalTokens,
      tokenLimit: this.MAX_TOKENS,
      compressionRatio: 0 // No compression in this method, it only returns metrics
    };
  }

  /** Analyze workspace at cwd and return summary. */
  async analyzeWorkspace(): Promise<ContextSummary> {
    // Placeholder: implement real scanning
    return {
      totalFiles: 0,
      totalDirs: 0,
      languages: {},
      importantFiles: [],
    };
  }
}

// Export singleton instance
export const contextManager = new ContextManager();
