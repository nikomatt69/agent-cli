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
exports.validatedAIProvider = exports.ValidatedAIProvider = void 0;
const advanced_ai_provider_1 = require("../ai/advanced-ai-provider");
const validator_manager_1 = require("./validator-manager");
const simple_agent_queue_1 = require("./simple-agent-queue");
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
const reasoning_system_prompt_1 = require("../prompts/reasoning-system-prompt");
const chalk_1 = __importDefault(require("chalk"));
const path_1 = require("path");
const fs_1 = require("fs");
class ValidatedAIProvider {
    constructor(workingDirectory = process.cwd()) {
        this.workingDirectory = workingDirectory;
    }
    async writeFileValidated(options) {
        const { path, content, agentId = 'unknown', reasoning, skipValidation = false, skipFormatting = false } = options;
        return simple_agent_queue_1.agentQueue.executeWithLock({
            type: 'write',
            filePath: path,
            agentId
        }, async () => {
            const startTime = Date.now();
            try {
                const fullPath = (0, path_1.resolve)(this.workingDirectory, path);
                const dir = (0, path_1.dirname)(fullPath);
                advanced_cli_ui_1.advancedUI.logInfo(`📝 Writing validated file: ${path} (${agentId})`);
                if (!(0, fs_1.existsSync)(dir)) {
                    (0, fs_1.mkdirSync)(dir, { recursive: true });
                }
                let processedContent = content;
                let validationResult = null;
                if (!skipValidation) {
                    const validationContext = {
                        filePath: fullPath,
                        content,
                        operation: (0, fs_1.existsSync)(fullPath) ? 'update' : 'create',
                        agentId,
                        projectType: this.detectProjectType()
                    };
                    if (skipFormatting) {
                        validator_manager_1.validatorManager.updateConfig({ autoFormat: false });
                    }
                    try {
                        validationResult = await validator_manager_1.validatorManager.validateContent(validationContext);
                        if (!validationResult.isValid) {
                            if (validationResult.fixedContent) {
                                processedContent = validationResult.fixedContent;
                                console.log(chalk_1.default.green(`🔧 Auto-fix applicato per ${path}`));
                            }
                            else {
                                return {
                                    success: false,
                                    path,
                                    validated: false,
                                    errors: validationResult.errors,
                                    warnings: validationResult.warnings,
                                    reasoning: reasoning || 'Validation failed',
                                    executionTime: Date.now() - startTime
                                };
                            }
                        }
                        else {
                            if (validationResult.fixedContent) {
                                processedContent = validationResult.fixedContent;
                            }
                        }
                    }
                    catch (validationError) {
                        advanced_cli_ui_1.advancedUI.logWarning(`⚠️ Validation error, proceeding without: ${validationError.message}`);
                    }
                    finally {
                        if (skipFormatting) {
                            validator_manager_1.validatorManager.updateConfig({ autoFormat: true });
                        }
                    }
                }
                (0, fs_1.writeFileSync)(fullPath, processedContent, 'utf-8');
                const stats = require('fs').statSync(fullPath);
                const result = {
                    success: true,
                    path,
                    size: stats.size,
                    formatted: validationResult?.formatted || false,
                    formatter: validationResult?.formatter,
                    validated: !skipValidation,
                    errors: validationResult?.errors,
                    warnings: validationResult?.warnings,
                    reasoning: reasoning || `File ${(0, fs_1.existsSync)(fullPath) ? 'updated' : 'created'} with validation`,
                    executionTime: Date.now() - startTime
                };
                if (validationResult?.formatted) {
                    advanced_cli_ui_1.advancedUI.logSuccess(`✅ File formatted with ${validationResult.formatter} and written: ${path}`);
                }
                else {
                    advanced_cli_ui_1.advancedUI.logSuccess(`✅ File validated and written: ${path}`);
                }
                return result;
            }
            catch (error) {
                advanced_cli_ui_1.advancedUI.logError(`❌ Failed to write validated file ${path}: ${error.message}`);
                return {
                    success: false,
                    path,
                    validated: false,
                    errors: [error.message],
                    reasoning: reasoning || 'File write failed',
                    executionTime: Date.now() - startTime
                };
            }
        });
    }
    async generateReasoningResponse(userRequest, agentId = 'universal-agent', capabilities = ['full-stack-development', 'code-analysis', 'file-operations']) {
        const reasoningContext = {
            projectType: this.detectProjectType(),
            currentWorkingDirectory: this.workingDirectory,
            availableTools: [
                'writeFileValidated', 'readFile', 'formatCode', 'validateCode',
                'executeCommand', 'analyzeProject', 'installPackages'
            ],
            userRequest,
            agentId,
            capabilities
        };
        const systemPrompt = agentId === 'universal-agent'
            ? (0, reasoning_system_prompt_1.createUniversalAgentPrompt)(reasoningContext)
            : (0, reasoning_system_prompt_1.createReasoningSystemPrompt)(reasoningContext);
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userRequest }
        ];
        try {
            const response = await advanced_ai_provider_1.advancedAIProvider.generateWithTools(messages);
            if (process.env.VALIDATE_REASONING) {
                const { validateReasoningResponse } = await Promise.resolve().then(() => __importStar(require('../prompts/reasoning-system-prompt')));
                const validation = validateReasoningResponse(typeof response === 'string' ? response : '');
                if (!validation.isValid) {
                    advanced_cli_ui_1.advancedUI.logWarning(`⚠️ Agent reasoning validation failed: ${validation.suggestions.join(', ')}`);
                }
            }
            return typeof response === 'string' ? response : '';
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`❌ Failed to generate reasoning response: ${error.message}`);
            throw error;
        }
    }
    async generateStreamResponse(messages, options = {}) {
        const { modernAIProvider } = await Promise.resolve().then(() => __importStar(require('../ai/modern-ai-provider')));
        return modernAIProvider.streamChatWithTools(messages);
    }
    async generateResponse(request) {
        const { modernAIProvider } = await Promise.resolve().then(() => __importStar(require('../ai/modern-ai-provider')));
        return modernAIProvider.generateWithTools(request.messages);
    }
    async readFile(filePath) {
        const fullPath = (0, path_1.resolve)(this.workingDirectory, filePath);
        return (0, fs_1.readFileSync)(fullPath, 'utf-8');
    }
    detectProjectType() {
        try {
            const packageJsonPath = (0, path_1.join)(this.workingDirectory, 'package.json');
            if ((0, fs_1.existsSync)(packageJsonPath)) {
                const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf-8'));
                if (packageJson.dependencies?.['next'] || packageJson.devDependencies?.['next']) {
                    return 'next.js';
                }
                if (packageJson.dependencies?.['react'] || packageJson.devDependencies?.['react']) {
                    return 'react';
                }
                if (packageJson.dependencies?.['typescript'] || packageJson.devDependencies?.['typescript']) {
                    return 'typescript';
                }
                return 'node';
            }
            return 'generic';
        }
        catch {
            return 'generic';
        }
    }
    setWorkingDirectory(directory) {
        this.workingDirectory = (0, path_1.resolve)(directory);
        advanced_ai_provider_1.advancedAIProvider.setWorkingDirectory(directory);
    }
    getWorkingDirectory() {
        return this.workingDirectory;
    }
    getValidationMetrics() {
        return validator_manager_1.validatorManager.getConfig();
    }
    async writeMultipleFilesValidated(files) {
        const results = [];
        for (const fileOptions of files) {
            const result = await this.writeFileValidated(fileOptions);
            results.push(result);
            if (!result.success && fileOptions.path.includes('.ts')) {
                advanced_cli_ui_1.advancedUI.logWarning(`⚠️ Stopping batch write due to TypeScript file failure`);
                break;
            }
        }
        return results;
    }
}
exports.ValidatedAIProvider = ValidatedAIProvider;
exports.validatedAIProvider = new ValidatedAIProvider();
