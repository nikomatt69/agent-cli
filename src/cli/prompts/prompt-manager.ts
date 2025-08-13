import { readFileSync, existsSync } from 'fs';
import { join, resolve, relative } from 'path';
import { CliUI } from '../utils/cli-ui';

/**
 * PromptManager - System to manage and load specific system prompts
 * Each tool, action and command has its own dedicated system prompt
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
  cacheTime: Date;
  accessCount: number;
  lastAccessed: Date;
}

export class PromptManager {
  private static instance: PromptManager;
  private promptsDirectory: string;
  private promptCache: Map<string, LoadedPrompt> = new Map();
  private cacheEnabled: boolean = true;
  private maxCacheSize: number = 100; // Maximum number of cached prompts
  private cacheTTL: number = 30 * 60 * 1000; // 30 minutes in milliseconds

  constructor(projectRoot: string) {
    this.promptsDirectory = resolve(join(projectRoot, 'src', 'prompts'));
    // Validate that prompts directory exists and is safe
    this.validatePromptsDirectory();
  }

  /**
   * Validate that the prompts directory exists and is secure
   */
  private validatePromptsDirectory(): void {
    if (!existsSync(this.promptsDirectory)) {
      CliUI.logWarning(`Prompts directory not found: ${this.promptsDirectory}`);
      CliUI.logWarning('Creating prompts directory structure...');
      this.createDefaultPromptStructure();
    }
  }

  /**
   * Create default prompt directory structure if missing
   */
  private createDefaultPromptStructure(): void {
    const fs = require('fs');
    const dirs = [
      'system',
      'tools/atomic-tools',
      'tools/analysis-tools', 
      'tools/agent-actions',
      'tools/cli-commands',
      'tools/workflow-steps',
      'tools/safety-prompts'
    ];

    try {
      for (const dir of dirs) {
        const fullPath = join(this.promptsDirectory, dir);
        fs.mkdirSync(fullPath, { recursive: true });
      }
      CliUI.logSuccess('✅ Created default prompt directory structure');
    } catch (error: any) {
      CliUI.logError(`Failed to create prompt directories: ${error.message}`);
    }
  }

  /**
   * Validate that a path is safe and within the prompts directory
   */
  private isPathSafe(relativePath: string): boolean {
    try {
      const fullPath = resolve(join(this.promptsDirectory, relativePath));
      const normalizedPromptsDir = resolve(this.promptsDirectory);
      
      // Check that the resolved path is within the prompts directory
      const relativeToPrompts = relative(normalizedPromptsDir, fullPath);
      
      // If the relative path starts with .. it's trying to escape the prompts directory
      return !relativeToPrompts.startsWith('..');
    } catch (error) {
      return false;
    }
  }

  static getInstance(projectRoot?: string): PromptManager {
    if (!PromptManager.instance && projectRoot) {
      PromptManager.instance = new PromptManager(projectRoot);
    }
    return PromptManager.instance;
  }

  /**
   * Load the appropriate system prompt for the given context
   */
  async loadPromptForContext(context: PromptContext): Promise<string> {
    const promptPath = this.resolvePromptPath(context);

    if (!promptPath) {
      CliUI.logWarning(`⚠ No specific prompt found for context: ${JSON.stringify(context)}`);
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
   * Resolve the prompt path based on context with intelligent fallback
   */
  private resolvePromptPath(context: PromptContext): string | null {
    const candidates: string[] = [];

    // Tool-specific prompts (highest priority)
    if (context.toolName) {
      candidates.push(`tools/atomic-tools/${context.toolName}.txt`);
      candidates.push(`tools/analysis-tools/${context.toolName}.txt`);
      // Fallback to generic tool prompt
      candidates.push(`tools/atomic-tools/generic-tool.txt`);
    }

    // Agent-specific prompts
    if (context.agentId) {
      candidates.push(`system/${context.agentId}.txt`);
      // Fallback to base agent
      candidates.push(`system/base-agent.txt`);
    }

    // Action-specific prompts
    if (context.actionType) {
      candidates.push(`tools/agent-actions/${context.actionType}.txt`);
      candidates.push(`tools/agent-actions/generic-action.txt`);
    }

    // Command-specific prompts
    if (context.commandName) {
      candidates.push(`tools/cli-commands/${context.commandName}.txt`);
      candidates.push(`tools/cli-commands/generic-command.txt`);
    }

    // Task-specific prompts
    if (context.taskType) {
      candidates.push(`tools/workflow-steps/${context.taskType}.txt`);
      candidates.push(`tools/workflow-steps/generic-workflow.txt`);
    }

    // Safety prompts based on risk level
    if (context.riskLevel === 'high') {
      candidates.push(`tools/safety-prompts/approval-required.txt`);
    } else if (context.riskLevel === 'medium') {
      candidates.push(`tools/safety-prompts/caution-required.txt`);
    }

    // Universal fallbacks (lowest priority)
    candidates.push(`system/base-agent.txt`);
    candidates.push(`tools/generic-fallback.txt`);

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
   * Load a prompt from filesystem with caching and security validation
   */
  private async loadPrompt(relativePath: string): Promise<LoadedPrompt> {
    // Validate path security first
    if (!this.isPathSafe(relativePath)) {
      throw new Error(`Unsafe path detected: ${relativePath}`);
    }

    const fullPath = join(this.promptsDirectory, relativePath);

    // Check cache first
    if (this.cacheEnabled && this.promptCache.has(relativePath)) {
      const cached = this.promptCache.get(relativePath)!;
      const now = new Date();

      // Check if cache entry is still valid (TTL check)
      const cacheAge = now.getTime() - cached.cacheTime.getTime();
      if (cacheAge > this.cacheTTL) {
        this.promptCache.delete(relativePath);
      } else {
        // Verify file hasn't changed
        try {
          const stats = require('fs').statSync(fullPath);
          if (stats.mtime <= cached.lastModified) {
            // Update access stats
            cached.accessCount++;
            cached.lastAccessed = now;
            return cached;
          }
        } catch (error) {
          // File might have been deleted, remove from cache
          this.promptCache.delete(relativePath);
        }
      }
    }

    // Verify file exists before reading
    if (!existsSync(fullPath)) {
      throw new Error(`Prompt file not found: ${relativePath}`);
    }

    // Load from filesystem
    const content = readFileSync(fullPath, 'utf-8');
    
    // Validate content is not empty
    if (!content.trim()) {
      throw new Error(`Prompt file is empty: ${relativePath}`);
    }

    const stats = require('fs').statSync(fullPath);
    const now = new Date();

    const prompt: LoadedPrompt = {
      content: content.trim(),
      filePath: fullPath,
      lastModified: stats.mtime,
      category: this.getCategoryFromPath(relativePath),
      cacheTime: now,
      accessCount: 1,
      lastAccessed: now
    };

    // Cache the prompt with size management
    if (this.cacheEnabled) {
      // Clean cache if it's getting too large
      if (this.promptCache.size >= this.maxCacheSize) {
        this.evictLeastRecentlyUsed();
      }
      
      this.promptCache.set(relativePath, prompt);
    }

    return prompt;
  }

  /**
   * Interpolate variables in prompt using context
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
   * Get a comprehensive default prompt if no specific one is found
   */
  private getDefaultPrompt(context: PromptContext): string {
    let prompt = '';

    // Base identity
    if (context.toolName) {
      prompt = `SYSTEM PROMPT - ${context.toolName.toUpperCase()} TOOL

You are the ${context.toolName} tool, specialized in secure and efficient execution.

CORE CAPABILITIES:
- Execute ${context.toolName} operations safely
- Validate inputs and parameters
- Handle errors gracefully
- Provide structured output
- Follow security best practices

SECURITY CONTROLS:
- Validate all input parameters
- Check permissions before execution
- Monitor resource usage
- Log all operations for audit
- Handle timeouts appropriately

BEST PRACTICES:
- Always validate inputs before processing
- Provide clear error messages
- Follow the principle of least privilege
- Maintain operation logs
- Ensure consistent output format

PARAMETERS: ${context.parameters ? JSON.stringify(context.parameters, null, 2) : 'None provided'}

Execute the operation according to these guidelines.`;

    } else if (context.agentId) {
      prompt = `SYSTEM PROMPT - ${context.agentId.toUpperCase()} AGENT

You are the ${context.agentId} agent, part of a multi-agent development system.

AGENT IDENTITY:
- Specialized AI agent for software development
- Autonomous operation with human oversight
- Collaborative with other agents
- Security-conscious and safety-first

CORE RESPONSIBILITIES:
- Execute assigned tasks efficiently
- Coordinate with other agents when needed
- Maintain transparency in all actions
- Follow security protocols
- Provide structured results

OPERATIONAL MODE:
- Analyze tasks before execution
- Create step-by-step execution plans
- Monitor progress and handle errors
- Report results with clear explanations
- Suggest improvements when applicable

Execute tasks according to your specialization and these operational guidelines.`;

    } else if (context.actionType) {
      prompt = `SYSTEM PROMPT - ${context.actionType.toUpperCase()} ACTION

You are performing a ${context.actionType} action as part of an automated workflow.

ACTION GUIDELINES:
- Ensure proper execution and error handling
- Validate all preconditions
- Monitor execution progress
- Handle failures gracefully
- Provide detailed execution reports

SAFETY MEASURES:
- Check all parameters before execution
- Respect system limits and constraints
- Log all actions for audit trail
- Escalate critical decisions when needed
- Maintain system integrity

Follow these guidelines to ensure safe and effective action execution.`;

    } else {
      prompt = `SYSTEM PROMPT - AI ASSISTANT

You are an AI assistant specialized in software development tasks.

CORE PRINCIPLES:
- Safety first - always validate operations
- Efficiency - optimize for performance and accuracy
- Transparency - provide clear explanations
- Security - follow best practices and protocols
- Collaboration - work effectively with users and systems

OPERATIONAL GUIDELINES:
- Analyze requests thoroughly before execution
- Provide structured and actionable responses
- Handle errors gracefully with helpful messages
- Maintain context and conversation continuity
- Follow industry best practices

Execute the requested operation safely, efficiently, and with clear communication.`;
    }

    // Add risk level warnings if applicable
    if (context.riskLevel === 'high') {
      prompt += '\n\n⚠️ HIGH RISK OPERATION: This operation requires special attention and may need approval before execution.';
    } else if (context.riskLevel === 'medium') {
      prompt += '\n\n⚠️ MEDIUM RISK OPERATION: Exercise caution and validate all parameters carefully.';
    }

    return prompt;
  }

  /**
   * Get category from prompt path
   */
  private getCategoryFromPath(path: string): string {
    const parts = path.split('/');
    if (parts.length >= 2) {
      return parts[1]; // e.g., 'atomic-tools', 'agent-actions', etc.
    }
    return 'general';
  }

  /**
   * Pre-load all prompts for better performance
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
   * List all available prompts
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
   * Invalidate prompt cache
   */
  clearCache(): void {
    this.promptCache.clear();
    CliUI.logInfo('🗑️ Prompt cache cleared');
  }

  /**
   * Evict least recently used cache entries when cache is full
   */
  private evictLeastRecentlyUsed(): void {
    if (this.promptCache.size === 0) return;

    // Sort by last accessed time (oldest first)
    const entries = Array.from(this.promptCache.entries()).sort((a, b) => {
      return a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime();
    });

    // Remove oldest 25% of entries
    const toRemove = Math.max(1, Math.floor(this.promptCache.size * 0.25));
    
    for (let i = 0; i < toRemove; i++) {
      this.promptCache.delete(entries[i][0]);
    }

    CliUI.logDebug(`🗑️ Evicted ${toRemove} cache entries (LRU)`);
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache(): void {
    const now = new Date();
    let removedCount = 0;

    for (const [path, prompt] of this.promptCache.entries()) {
      const cacheAge = now.getTime() - prompt.cacheTime.getTime();
      if (cacheAge > this.cacheTTL) {
        this.promptCache.delete(path);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      CliUI.logDebug(`🗑️ Cleaned ${removedCount} expired cache entries`);
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats(): { 
    size: number; 
    maxSize: number;
    categories: Record<string, number>;
    totalAccessCount: number;
    averageAge: number;
    hitRate: number;
  } {
    const categories: Record<string, number> = {};
    let totalAccessCount = 0;
    let totalAge = 0;
    const now = new Date();

    for (const prompt of Array.from(this.promptCache.values())) {
      const category = prompt.category;
      categories[category] = (categories[category] || 0) + 1;
      totalAccessCount += prompt.accessCount;
      totalAge += now.getTime() - prompt.cacheTime.getTime();
    }

    const averageAge = this.promptCache.size > 0 ? totalAge / this.promptCache.size : 0;
    const hitRate = totalAccessCount > this.promptCache.size ? 
      (totalAccessCount - this.promptCache.size) / totalAccessCount : 0;

    return {
      size: this.promptCache.size,
      maxSize: this.maxCacheSize,
      categories,
      totalAccessCount,
      averageAge: averageAge / 1000, // Convert to seconds
      hitRate: Math.round(hitRate * 100) / 100 // Round to 2 decimal places
    };
  }

  /**
   * Configure cache settings
   */
  configureCaching(options: {
    enabled?: boolean;
    maxSize?: number;
    ttlMinutes?: number;
  }): void {
    if (options.enabled !== undefined) {
      this.cacheEnabled = options.enabled;
    }
    if (options.maxSize !== undefined) {
      this.maxCacheSize = options.maxSize;
    }
    if (options.ttlMinutes !== undefined) {
      this.cacheTTL = options.ttlMinutes * 60 * 1000;
    }

    CliUI.logInfo(`📋 Cache configured: enabled=${this.cacheEnabled}, maxSize=${this.maxCacheSize}, ttl=${this.cacheTTL/1000/60}min`);
  }
}
