import type { z } from 'zod';
import { WorkspaceContext as WsContext } from '../core/workspace-context';
import { Context as VmContext } from 'vm';

export namespace EnterpriseToolSystem {
  // Core tool metadata interface
  export interface Metadata {
    executionTime?: number;
    resourceUsage?: {
      cpu: number;
      memory: number;
      disk: number;
    };
    safetyLevel?: 'SAFE' | 'CAUTION' | 'DANGER';
    contextAware?: boolean;
    [key: string]: any;
  }

  // Tool execution context with rich information
  export type Context<M extends Metadata = Metadata> = {
    sessionID: string;
    messageID: string;
    callID?: string;
    agentID?: string;
    abort: AbortSignal;
    workspaceContext: WorkspaceContext;
    projectInfo: ProjectInfo;
    metadata(input: { title?: string; metadata?: M }): void;
    updateProgress?(progress: number, message?: string): void;
    requestConfirmation?(message: string, level: 'info' | 'warning' | 'danger'): Promise<boolean>;
  };

  // Workspace context for intelligent operations
  export interface WorkspaceContext {
    rootPath: string;
    selectedPaths: string[];
    fileCount: number;
    framework?: string;
    languages: string[];
    dependencies: string[];
    gitInfo?: {
      branch: string;
      hasUnstagedChanges: boolean;
      hasUncommittedChanges: boolean;
    };
  }

  // Project information for context-aware operations
  export interface ProjectInfo {
    name?: string;
    framework?: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
    buildSystem?: 'webpack' | 'vite' | 'next' | 'custom';
    testFramework?: 'jest' | 'vitest' | 'mocha' | 'cypress';
    hasDocker?: boolean;
    hasCI?: boolean;
  }

  // Tool parameter schema with enhanced validation
  export interface Schema extends z.ZodTypeAny { }

  // Enhanced tool definition interface
  export interface Info<Parameters extends Schema = Schema, M extends Metadata = Metadata> {
    id: string;
    category: ToolCategory;
    version: string;
    tags: string[];
    requiredPermissions: Permission[];
    contextDependencies: ContextDependency[];
    init: () => Promise<{
      description: string;
      parameters: Parameters;
      systemPrompt: string;
      contextualPrompts: ContextualPrompt[];
      safetyChecks: SafetyCheck[];
      execute(
        args: z.infer<Parameters>,
        ctx: Context<M>,
      ): Promise<ToolResult<M>>;
    }>;
  }

  // Tool categories for organization
  export enum ToolCategory {
    FILESYSTEM = 'filesystem',
    DEVELOPMENT = 'development',
    SECURITY = 'security',
    ANALYSIS = 'analysis',
    AUTOMATION = 'automation',
    INTEGRATION = 'integration',
    TESTING = 'testing',
    DEPLOYMENT = 'deployment'
  }

  // Permission system for tool access control
  export enum Permission {
    READ_FILES = 'read_files',
    WRITE_FILES = 'write_files',
    EXECUTE_COMMANDS = 'execute_commands',
    NETWORK_ACCESS = 'network_access',
    SYSTEM_MODIFICATIONS = 'system_modifications',
    GIT_OPERATIONS = 'git_operations',
    PACKAGE_MANAGEMENT = 'package_management',
    DATABASE_ACCESS = 'database_access'
  }

  // Context dependencies that tools require
  export enum ContextDependency {
    GIT_REPOSITORY = 'git_repository',
    NODE_PROJECT = 'node_project',
    DOCKER_ENVIRONMENT = 'docker_environment',
    DATABASE_CONNECTION = 'database_connection',
    CI_ENVIRONMENT = 'ci_environment'
  }

  // Contextual prompts that adapt based on project context
  export interface ContextualPrompt {
    condition: (ctx: Context) => boolean;
    promptAddition: string;
  }

  // Safety checks for dangerous operations
  export interface SafetyCheck {
    check: (args: any, ctx: Context) => Promise<SafetyResult>;
    level: 'warning' | 'error' | 'confirmation';
  }

  export interface SafetyResult {
    safe: boolean;
    message?: string;
    suggestions?: string[];
    requiresConfirmation?: boolean;
  }

  // Enhanced tool result with rich metadata
  export interface ToolResult<M extends Metadata = Metadata> {
    title: string;
    output: string;
    metadata: M;
    success: boolean;
    duration: number;
    resourceUsage?: {
      cpu: number;
      memory: number;
      disk: number;
    };
    artifacts?: Artifact[];
    followUpSuggestions?: string[];
  }

  // Artifacts created by tool execution
  export interface Artifact {
    type: 'file' | 'directory' | 'url' | 'data';
    path?: string;
    content?: string;
    description: string;
  }

  // Tool definition factory with enhanced capabilities
  export function define<Parameters extends Schema, Result extends Metadata>(
    id: string,
    definition: ToolDefinition<Parameters, Result>
  ): Info<Parameters, Result> {
    return {
      id,
      category: definition.category,
      version: definition.version || '1.0.0',
      tags: definition.tags || [],
      requiredPermissions: definition.requiredPermissions || [],
      contextDependencies: definition.contextDependencies || [],
      init: async () => {
        const baseConfig = typeof definition.init === 'function'
          ? await definition.init()
          : definition.init;

        return {
          ...baseConfig,
          contextualPrompts: baseConfig.contextualPrompts || [],
          safetyChecks: baseConfig.safetyChecks || [],
          systemPrompt: generateContextualSystemPrompt(baseConfig, definition),
          execute: async (args, ctx) => {
            const startTime = Date.now();

            // Run safety checks
            for (const safetyCheck of baseConfig.safetyChecks || []) {
              const result = await safetyCheck.check(args, ctx);
              if (!result.safe) {
                if (safetyCheck.level === 'error') {
                  throw new Error(`Safety check failed: ${result.message}`);
                } else if (safetyCheck.level === 'confirmation' && result.requiresConfirmation) {
                  const confirmed = await ctx.requestConfirmation?.(
                    result.message || 'This operation requires confirmation',
                    'warning'
                  );
                  if (!confirmed) {
                    throw new Error('Operation cancelled by user');
                  }
                }
              }
            }

            // Execute the tool
            const result = await baseConfig.execute(args, ctx);

            // Add execution metadata
            const duration = Date.now() - startTime;
            ctx.metadata({
              title: result.title,
              metadata: {
                ...result.metadata,
                executionTime: duration,
                success: result.success
              }
            });

            return result;
          }
        };
      }
    };
  }

  interface ToolDefinition<Parameters extends Schema, Result extends Metadata> {
    category: ToolCategory;
    version?: string;
    tags?: string[];
    requiredPermissions?: Permission[];
    contextDependencies?: ContextDependency[];
    init: (() => Promise<ToolConfig<Parameters, Result>>) | ToolConfig<Parameters, Result>;
  }

  interface ToolConfig<Parameters extends Schema, Result extends Metadata> {
    description: string;
    parameters: Parameters;
    systemPrompt: string;
    contextualPrompts?: ContextualPrompt[];
    safetyChecks?: SafetyCheck[];
    execute(args: z.infer<Parameters>, ctx: Context<Result>): Promise<ToolResult<Result>>;
  }

  // Generate contextual system prompt based on workspace context
  function generateContextualSystemPrompt(
    config: ToolConfig<any, any>,
    definition: ToolDefinition<any, any>
  ): string {
    let prompt = config.systemPrompt;

    // Add contextual adaptations based on tool category and context
    const contextualAdditions = [
      `\nCONTEXT ADAPTATION:`,
      `- Tool Category: ${definition.category}`,
      `- Required Permissions: ${definition.requiredPermissions?.join(', ') || 'None'}`,
      `- Context Dependencies: ${definition.contextDependencies?.join(', ') || 'None'}`
    ];

    if (config.contextualPrompts) {
      contextualAdditions.push(`\nCONDITIONAL INSTRUCTIONS:`);
      config.contextualPrompts.forEach((cp, index) => {
        contextualAdditions.push(`${index + 1}. IF ${cp.condition.toString()}: ${cp.promptAddition}`);
      });
    }

    return prompt + '\n' + contextualAdditions.join('\n');
  }
}

// Export the main types and functions
export const { define, ToolCategory, Permission, ContextDependency } = EnterpriseToolSystem;
export type Context = EnterpriseToolSystem.Context;
export type WorkspaceContext = EnterpriseToolSystem.WorkspaceContext;
export type ToolResult<M extends EnterpriseToolSystem.Metadata = EnterpriseToolSystem.Metadata> = EnterpriseToolSystem.ToolResult<M>;
export type Metadata = EnterpriseToolSystem.Metadata;

