"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enterpriseIntegration = exports.EnterpriseIntegration = void 0;
const tool_registry_1 = require("./tool-registry");
const prompt_registry_1 = require("./prompt-registry");
const feature_flags_1 = require("./feature-flags");
const validator_manager_1 = require("./validator-manager");
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
const logger_1 = require("../utils/logger");
class EnterpriseIntegration {
    constructor(workingDirectory) {
        this.isInitialized = false;
        this.workingDirectory = workingDirectory;
    }
    static getInstance(workingDirectory) {
        if (!EnterpriseIntegration.instance && workingDirectory) {
            EnterpriseIntegration.instance = new EnterpriseIntegration(workingDirectory);
        }
        return EnterpriseIntegration.instance;
    }
    async initialize() {
        if (this.isInitialized)
            return;
        advanced_cli_ui_1.advancedUI.logInfo('🏢 Initializing Enterprise Integration...');
        const startTime = Date.now();
        try {
            await feature_flags_1.featureFlagManager.initialize();
            await tool_registry_1.toolRegistry.initialize();
            await prompt_registry_1.promptRegistry.initialize();
            this.setupIntegrations();
            this.isInitialized = true;
            const initTime = Date.now() - startTime;
            advanced_cli_ui_1.advancedUI.logSuccess(`✅ Enterprise Integration initialized (${initTime}ms)`);
            this.logSystemStats();
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`❌ Enterprise Integration failed: ${error.message}`);
            throw error;
        }
    }
    setupIntegrations() {
        const originalExecuteTool = tool_registry_1.toolRegistry.executeTool.bind(tool_registry_1.toolRegistry);
        tool_registry_1.toolRegistry.executeTool = async (toolId, ...args) => {
            try {
                return await originalExecuteTool(toolId, ...args);
            }
            catch (error) {
                logger_1.logger.error(`Tool execution failed: ${toolId}`, {
                    error: error.message,
                    toolId,
                    argsCount: args.length
                });
                throw error;
            }
        };
        if (feature_flags_1.featureFlagManager.isEnabled('advanced-validation')) {
            advanced_cli_ui_1.advancedUI.logInfo('🔍 Advanced validation enabled via feature flag');
        }
        if (feature_flags_1.featureFlagManager.isEnabled('tool-registry')) {
            advanced_cli_ui_1.advancedUI.logInfo('🔧 Tool registry enabled via feature flag');
        }
        const originalGetPrompt = prompt_registry_1.promptRegistry.getPrompt.bind(prompt_registry_1.promptRegistry);
        prompt_registry_1.promptRegistry.getPrompt = async (promptId, context = {}) => {
            try {
                return await originalGetPrompt(promptId, context);
            }
            catch (error) {
                logger_1.logger.error(`Prompt registry error: ${promptId}`, {
                    error: error.message,
                    promptId
                });
                throw error;
            }
        };
    }
    getSystemStatus() {
        return {
            featureFlags: {
                enabled: feature_flags_1.featureFlagManager.isEnabled('tool-registry'),
                stats: feature_flags_1.featureFlagManager.getFlagStats()
            },
            toolRegistry: {
                stats: tool_registry_1.toolRegistry.getRegistryStats(),
                totalTools: tool_registry_1.toolRegistry.getAvailableTools().size
            },
            promptRegistry: {
                stats: prompt_registry_1.promptRegistry.getRegistryStats(),
                totalPrompts: prompt_registry_1.promptRegistry.getAvailablePrompts().size
            },
            validator: {
                config: validator_manager_1.validatorManager.getConfig()
            }
        };
    }
    logSystemStats() {
        const status = this.getSystemStatus();
        advanced_cli_ui_1.advancedUI.logInfo('🏢 Enterprise Systems Status:');
        console.log(`   🚩 Feature Flags: ${status.featureFlags.stats.total} total, ${status.featureFlags.stats.enabled} enabled`);
        console.log(`   🔧 Tool Registry: ${status.toolRegistry.totalTools} tools loaded`);
        console.log(`   🧠 Prompt Registry: ${status.promptRegistry.totalPrompts} prompts available`);
        console.log(`   ✅ All systems operational`);
    }
    async cleanup() {
        await feature_flags_1.featureFlagManager.cleanup();
        advanced_cli_ui_1.advancedUI.logInfo('🏢 Enterprise Integration cleanup completed');
    }
}
exports.EnterpriseIntegration = EnterpriseIntegration;
exports.enterpriseIntegration = EnterpriseIntegration.getInstance();
