import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { CliUI } from '../ui/terminal-ui';

/**
 * PromptManager - Sistema per gestire e caricare system prompts specifici
 * Ogni tool, azione e comando ha il proprio system prompt dedicato
 */

export interface PromptContext {
  toolName?: string;
  agentId?: string;
  actionType?: string;
  commandName?: string;
  taskType?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  parameters?: Record<string, any>;
}

export interface LoadedPrompt {
  content: string;
  filePath: string;
  lastModified: Date;
  category: string;
}

export class PromptManager {
  private static instance: PromptManager;
  private promptsDirectory: string;
  private promptCache: Map<string, LoadedPrompt> = new Map();
  private cacheEnabled: boolean = true;

  constructor(projectRoot: string) {
    this.promptsDirectory = join(projectRoot, 'prompts');
  }

  static getInstance(projectRoot?: string): PromptManager {
    if (!PromptManager.instance && projectRoot) {
      PromptManager.instance = new PromptManager(projectRoot);
    }
    return PromptManager.instance;
  }

  /**
   * Carica il system prompt appropriato per il contesto dato
   */
  async loadPromptForContext(context: PromptContext): Promise<string> {
    const promptPath = this.resolvePromptPath(context);

    if (!promptPath) {
      CliUI.logWarning(`No specific prompt found for context: ${JSON.stringify(context)}`);
      return this.getDefaultPrompt(context);
    }

    try {
      const prompt = await this.loadPrompt(promptPath);
      CliUI.logDebug(`Loaded prompt: ${promptPath}`);
      return this.interpolatePrompt(prompt.content, context);
    } catch (error: any) {
      CliUI.logError(`Failed to load prompt ${promptPath}: ${error.message}`);
      return this.getDefaultPrompt(context);
    }
  }

  /**
   * Risolve il percorso del prompt basato sul contesto
   */
  private resolvePromptPath(context: PromptContext): string | null {
    const candidates: string[] = [];

    // Tool-specific prompts
    if (context.toolName) {
      candidates.push(`tools/atomic-tools/${context.toolName}.txt`);
      candidates.push(`tools/analysis-tools/${context.toolName}.txt`);
    }

    // Agent-specific prompts
    if (context.agentId) {
      candidates.push(`system/${context.agentId}.txt`);
    }

    // Action-specific prompts
    if (context.actionType) {
      candidates.push(`tools/agent-actions/${context.actionType}.txt`);
    }

    // Command-specific prompts
    if (context.commandName) {
      candidates.push(`tools/cli-commands/${context.commandName}.txt`);
    }

    // Task-specific prompts
    if (context.taskType) {
      candidates.push(`tools/workflow-steps/${context.taskType}.txt`);
    }

    // Safety prompts based on risk level
    if (context.riskLevel === 'high') {
      candidates.push(`tools/safety-prompts/approval-required.txt`);
    }

    // Find first existing prompt file
    for (const candidate of candidates) {
      const fullPath = join(this.promptsDirectory, candidate);
      if (existsSync(fullPath)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Carica un prompt dal filesystem con caching
   */
  private async loadPrompt(relativePath: string): Promise<LoadedPrompt> {
    const fullPath = join(this.promptsDirectory, relativePath);

    // Check cache first
    if (this.cacheEnabled && this.promptCache.has(relativePath)) {
      const cached = this.promptCache.get(relativePath)!;

      // Verify file hasn't changed
      try {
        const stats = require('fs').statSync(fullPath);
        if (stats.mtime <= cached.lastModified) {
          return cached;
        }
      } catch (error) {
        // File might have been deleted, remove from cache
        this.promptCache.delete(relativePath);
      }
    }

    // Load from filesystem
    const content = readFileSync(fullPath, 'utf-8');
    const stats = require('fs').statSync(fullPath);

    const prompt: LoadedPrompt = {
      content,
      filePath: fullPath,
      lastModified: stats.mtime,
      category: this.getCategoryFromPath(relativePath)
    };

    // Cache the prompt
    if (this.cacheEnabled) {
      this.promptCache.set(relativePath, prompt);
    }

    return prompt;
  }

  /**
   * Interpola variabili nel prompt usando il contesto
   */
  private interpolatePrompt(content: string, context: PromptContext): string {
    let interpolated = content;

    // Replace context variables
    if (context.toolName) {
      interpolated = interpolated.replace(/\{toolName\}/g, context.toolName);
    }

    if (context.agentId) {
      interpolated = interpolated.replace(/\{agentId\}/g, context.agentId);
    }

    if (context.parameters) {
      for (const [key, value] of Object.entries(context.parameters)) {
        const placeholder = new RegExp(`\\{${key}\\}`, 'g');
        interpolated = interpolated.replace(placeholder, String(value));
      }
    }

    // Add timestamp
    interpolated = interpolated.replace(/\{timestamp\}/g, new Date().toISOString());

    return interpolated;
  }

  /**
   * Ottiene un prompt di default se non trovato specifico
   */
  private getDefaultPrompt(context: PromptContext): string {
    if (context.toolName) {
      return `You are executing the ${context.toolName} tool. Follow best practices for safe and efficient execution.`;
    }

    if (context.agentId) {
      return `You are the ${context.agentId}. Execute tasks according to your specialization and capabilities.`;
    }

    if (context.actionType) {
      return `You are performing a ${context.actionType} action. Ensure proper execution and error handling.`;
    }

    return 'You are an AI assistant. Execute the requested operation safely and efficiently.';
  }

  /**
   * Ottiene la categoria dal percorso del prompt
   */
  private getCategoryFromPath(path: string): string {
    const parts = path.split('/');
    if (parts.length >= 2) {
      return parts[1]; // e.g., 'atomic-tools', 'agent-actions', etc.
    }
    return 'general';
  }

  /**
   * Pre-carica tutti i prompts per performance migliori
   */
  async preloadPrompts(): Promise<void> {
    CliUI.logInfo('🔄 Pre-loading system prompts...');

    const promptDirs = [
      'tools/atomic-tools',
      'tools/analysis-tools',
      'tools/agent-actions',
      'tools/cli-commands',
      'tools/workflow-steps',
      'tools/safety-prompts',
      'system'
    ];

    let loadedCount = 0;

    for (const dir of promptDirs) {
      try {
        const dirPath = join(this.promptsDirectory, dir);
        if (existsSync(dirPath)) {
          const files = require('fs').readdirSync(dirPath);

          for (const file of files) {
            if (file.endsWith('.txt')) {
              const relativePath = join(dir, file);
              await this.loadPrompt(relativePath);
              loadedCount++;
            }
          }
        }
      } catch (error: any) {
        CliUI.logWarning(`Failed to preload prompts from ${dir}: ${error.message}`);
      }
    }

    CliUI.logSuccess(`✅ Pre-loaded ${loadedCount} system prompts`);
  }

  /**
   * Lista tutti i prompts disponibili
   */
  listAvailablePrompts(): { category: string; prompts: string[] }[] {
    const categories: Record<string, string[]> = {};

    for (const [path, prompt] of Array.from(this.promptCache)) {
      const category = prompt.category;
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(path);
    }

    return Object.entries(categories).map(([category, prompts]) => ({
      category,
      prompts: prompts.sort()
    }));
  }

  /**
   * Invalida la cache dei prompts
   */
  clearCache(): void {
    this.promptCache.clear();
    CliUI.logInfo('🗑️ Prompt cache cleared');
  }

  /**
   * Ottiene statistiche sulla cache
   */
  getCacheStats(): { size: number; categories: Record<string, number> } {
    const categories: Record<string, number> = {};

    for (const prompt of Array.from(this.promptCache.values())) {
      const category = prompt.category;
      categories[category] = (categories[category] || 0) + 1;
    }

    return {
      size: this.promptCache.size,
      categories
    };
  }
}
