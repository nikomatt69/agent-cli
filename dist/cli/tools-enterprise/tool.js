"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextDependency = exports.Permission = exports.ToolCategory = exports.define = exports.EnterpriseToolSystem = void 0;
var EnterpriseToolSystem;
(function (EnterpriseToolSystem) {
    // Tool categories for organization
    let ToolCategory;
    (function (ToolCategory) {
        ToolCategory["FILESYSTEM"] = "filesystem";
        ToolCategory["DEVELOPMENT"] = "development";
        ToolCategory["SECURITY"] = "security";
        ToolCategory["ANALYSIS"] = "analysis";
        ToolCategory["AUTOMATION"] = "automation";
        ToolCategory["INTEGRATION"] = "integration";
        ToolCategory["TESTING"] = "testing";
        ToolCategory["DEPLOYMENT"] = "deployment";
    })(ToolCategory = EnterpriseToolSystem.ToolCategory || (EnterpriseToolSystem.ToolCategory = {}));
    // Permission system for tool access control
    let Permission;
    (function (Permission) {
        Permission["READ_FILES"] = "read_files";
        Permission["WRITE_FILES"] = "write_files";
        Permission["EXECUTE_COMMANDS"] = "execute_commands";
        Permission["NETWORK_ACCESS"] = "network_access";
        Permission["SYSTEM_MODIFICATIONS"] = "system_modifications";
        Permission["GIT_OPERATIONS"] = "git_operations";
        Permission["PACKAGE_MANAGEMENT"] = "package_management";
        Permission["DATABASE_ACCESS"] = "database_access";
    })(Permission = EnterpriseToolSystem.Permission || (EnterpriseToolSystem.Permission = {}));
    // Context dependencies that tools require
    let ContextDependency;
    (function (ContextDependency) {
        ContextDependency["GIT_REPOSITORY"] = "git_repository";
        ContextDependency["NODE_PROJECT"] = "node_project";
        ContextDependency["DOCKER_ENVIRONMENT"] = "docker_environment";
        ContextDependency["DATABASE_CONNECTION"] = "database_connection";
        ContextDependency["CI_ENVIRONMENT"] = "ci_environment";
    })(ContextDependency = EnterpriseToolSystem.ContextDependency || (EnterpriseToolSystem.ContextDependency = {}));
    // Tool definition factory with enhanced capabilities
    function define(id, definition) {
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
                                }
                                else if (safetyCheck.level === 'confirmation' && result.requiresConfirmation) {
                                    const confirmed = await ctx.requestConfirmation?.(result.message || 'This operation requires confirmation', 'warning');
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
    EnterpriseToolSystem.define = define;
    // Generate contextual system prompt based on workspace context
    function generateContextualSystemPrompt(config, definition) {
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
})(EnterpriseToolSystem || (exports.EnterpriseToolSystem = EnterpriseToolSystem = {}));
// Export the main types and functions
exports.define = EnterpriseToolSystem.define, exports.ToolCategory = EnterpriseToolSystem.ToolCategory, exports.Permission = EnterpriseToolSystem.Permission, exports.ContextDependency = EnterpriseToolSystem.ContextDependency;
