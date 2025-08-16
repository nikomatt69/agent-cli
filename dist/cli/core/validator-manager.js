"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatorManager = exports.ValidatorManager = void 0;
const write_file_tool_1 = require("../tools/write-file-tool");
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
const formatter_manager_1 = require("./formatter-manager");
const chalk_1 = __importDefault(require("chalk"));
const zod_1 = require("zod");
const events_1 = require("events");
const ValidationCognitionSchema = zod_1.z.object({
    intent: zod_1.z.enum(['create', 'modify', 'fix', 'enhance', 'refactor', 'analyze']),
    complexity: zod_1.z.enum(['simple', 'moderate', 'complex', 'expert']),
    riskLevel: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    language: zod_1.z.string(),
    framework: zod_1.z.string().optional(),
    projectType: zod_1.z.string().optional(),
    agentContext: zod_1.z.string().optional(),
    orchestrationLevel: zod_1.z.number().min(0).max(10),
    contextAwareness: zod_1.z.number().min(0).max(1)
});
const IntelligentValidationResultSchema = zod_1.z.object({
    isValid: zod_1.z.boolean(),
    errors: zod_1.z.array(zod_1.z.string()),
    warnings: zod_1.z.array(zod_1.z.string()),
    suggestions: zod_1.z.array(zod_1.z.string()),
    optimizations: zod_1.z.array(zod_1.z.string()),
    cognitiveScore: zod_1.z.number().min(0).max(1),
    orchestrationCompatibility: zod_1.z.number().min(0).max(1),
    adaptiveRecommendations: zod_1.z.array(zod_1.z.string()),
    fixedContent: zod_1.z.string().optional(),
    formatted: zod_1.z.boolean().optional(),
    formatter: zod_1.z.string().optional()
});
class ValidatorManager extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.customValidators = new Map();
        this.formatterManager = null;
        this.validationCache = new Map();
        this.cognitivePatterns = new Map();
        this.adaptiveThresholds = new Map();
        this.orchestrationMetrics = new Map();
        this.config = {
            enableLSP: true,
            autoFix: true,
            autoFormat: true,
            strictMode: false,
            skipWarnings: false,
            cognitiveValidation: true,
            orchestrationAware: true,
            intelligentCaching: true,
            adaptiveThresholds: true,
            ...config
        };
        this.initializeIntelligentSystems();
    }
    static getInstance(config) {
        if (!ValidatorManager.instance) {
            ValidatorManager.instance = new ValidatorManager(config);
        }
        return ValidatorManager.instance;
    }
    initializeIntelligentSystems() {
        this.setupCognitivePatterns();
        this.initializeAdaptiveThresholds();
        this.setupOrchestrationMetrics();
        this.enableIntelligentCaching();
    }
    setupCognitivePatterns() {
        const patterns = [
            ['react-component', {
                    intent: 'create',
                    complexity: 'moderate',
                    riskLevel: 'medium',
                    language: 'typescript',
                    framework: 'react',
                    orchestrationLevel: 6,
                    contextAwareness: 0.8
                }],
            ['api-endpoint', {
                    intent: 'create',
                    complexity: 'complex',
                    riskLevel: 'high',
                    language: 'typescript',
                    framework: 'express',
                    orchestrationLevel: 8,
                    contextAwareness: 0.9
                }],
            ['utility-function', {
                    intent: 'create',
                    complexity: 'simple',
                    riskLevel: 'low',
                    language: 'typescript',
                    orchestrationLevel: 4,
                    contextAwareness: 0.6
                }]
        ];
        patterns.forEach(([key, pattern]) => {
            this.cognitivePatterns.set(key, pattern);
        });
    }
    initializeAdaptiveThresholds() {
        const defaultThresholds = {
            errorTolerance: 0.1,
            warningTolerance: 0.3,
            complexityThreshold: 0.7,
            orchestrationCompatibility: 0.8,
            cognitiveScoreMinimum: 0.6
        };
        Object.entries(defaultThresholds).forEach(([key, value]) => {
            this.adaptiveThresholds.set(key, value);
        });
    }
    setupOrchestrationMetrics() {
        const metrics = {
            agentCoordination: 0.8,
            taskAlignment: 0.7,
            contextCoherence: 0.9,
            systemIntegration: 0.85
        };
        Object.entries(metrics).forEach(([key, value]) => {
            this.orchestrationMetrics.set(key, value);
        });
    }
    enableIntelligentCaching() {
        if (this.config.intelligentCaching) {
            setInterval(() => {
                this.cleanupIntelligentCache();
            }, 5 * 60 * 1000);
        }
    }
    registerValidator(pattern, validator) {
        if (!this.customValidators.has(pattern)) {
            this.customValidators.set(pattern, []);
        }
        this.customValidators.get(pattern).push(validator);
    }
    initializeFormatter(workingDirectory) {
        if (!this.formatterManager) {
            this.formatterManager = (0, formatter_manager_1.createFormatterManager)(workingDirectory, {
                enabled: this.config.autoFormat,
                formatOnSave: true,
                respectEditorConfig: true
            });
        }
    }
    async validateContent(context) {
        if (this.config.cognitiveValidation) {
            return this.validateWithCognition(context);
        }
        return this.validateTraditionally(context);
    }
    async validateWithCognition(context) {
        const { filePath, content, operation, agentId } = context;
        const cognitiveSignature = this.generateCognitiveSignature(context);
        if (this.config.intelligentCaching) {
            const cached = this.validationCache.get(cognitiveSignature);
            if (cached && this.isCacheValid(cached, context)) {
                advanced_cli_ui_1.advancedUI.logInfo(`🧠 Using cached validation for ${filePath.split('/').pop()}`);
                this.emit('validation:cached', { filePath, cached });
                return cached;
            }
        }
        const cognition = await this.analyzeCognition(context);
        advanced_cli_ui_1.advancedUI.logInfo(`🧠 Cognitive analysis: ${cognition.intent} (${cognition.complexity}, risk: ${cognition.riskLevel})`);
        const validators = this.selectIntelligentValidators(context, cognition);
        const result = await this.executeIntelligentValidation(context, cognition, validators);
        if (this.config.adaptiveThresholds) {
            this.updateAdaptiveThresholds(context, result);
        }
        if (this.config.intelligentCaching) {
            this.validationCache.set(cognitiveSignature, result);
        }
        this.emit('validation:completed', { context, cognition, result });
        return result;
    }
    async validateTraditionally(context) {
        const { filePath, content, operation, agentId } = context;
        advanced_cli_ui_1.advancedUI.logInfo(`🎨 Processing ${operation}: ${filePath.split('/').pop()}`);
        const errors = [];
        const warnings = [];
        let processedContent = content;
        let formatResult = null;
        try {
            const workingDirectory = filePath.substring(0, filePath.lastIndexOf('/')) || process.cwd();
            this.initializeFormatter(workingDirectory);
            if (this.config.autoFormat && this.formatterManager) {
                advanced_cli_ui_1.advancedUI.logInfo(`🎨 Auto-formatting ${filePath.split('/').pop()}...`);
                formatResult = await this.formatterManager.formatContent(content, filePath);
                if (formatResult.success && formatResult.formatted) {
                    processedContent = formatResult.content;
                    advanced_cli_ui_1.advancedUI.logSuccess(`✅ Formatted with ${formatResult.formatter}`);
                }
                else if (formatResult.warnings) {
                    warnings.push(...formatResult.warnings);
                }
                if (formatResult.error && !formatResult.success) {
                    warnings.push(`Formatting failed: ${formatResult.error}`);
                }
            }
            const validators = this.selectValidators(context);
            for (const validator of validators) {
                try {
                    const result = await validator(processedContent, filePath);
                    if (result.errors) {
                        errors.push(...result.errors);
                    }
                    if (result.warnings && !this.config.skipWarnings) {
                        warnings.push(...result.warnings);
                    }
                }
                catch (validatorError) {
                    warnings.push(`Validator error: ${validatorError.message}`);
                }
            }
            this.logProcessingResults(filePath, formatResult, errors, warnings, agentId);
            let finalContent = processedContent;
            if (errors.length > 0 && this.config.autoFix) {
                finalContent = await this.attemptAutoFix(processedContent, filePath, errors);
                if (finalContent !== processedContent) {
                    return this.validateContent({ ...context, content: finalContent });
                }
            }
            const isValid = errors.length === 0 || (!this.config.strictMode && errors.every(e => !this.isCriticalError(e)));
            return {
                isValid,
                errors,
                warnings,
                fixedContent: finalContent !== content ? finalContent : undefined,
                formatted: formatResult?.formatted || false,
                formatter: formatResult?.formatter
            };
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`Processing failed for ${filePath}: ${error.message}`);
            return {
                isValid: false,
                errors: [`Processing system error: ${error.message}`],
                warnings: [],
                fixedContent: undefined,
                formatted: false
            };
        }
    }
    generateCognitiveSignature(context) {
        const { filePath, content, operation, agentId, projectType } = context;
        const contentHash = this.simpleHash(content);
        const contextHash = this.simpleHash(`${filePath}:${operation}:${agentId}:${projectType}`);
        return `${contentHash}:${contextHash}`;
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    isCacheValid(cached, context) {
        const cacheAge = Date.now() - (cached.timestamp || 0);
        const isRecent = cacheAge < 10 * 60 * 1000;
        const isHighQuality = cached.cognitiveScore >= (this.adaptiveThresholds.get('cognitiveScoreMinimum') || 0.6);
        return isRecent && isHighQuality;
    }
    async analyzeCognition(context) {
        const { filePath, content, operation, agentId, projectType } = context;
        const language = this.detectLanguage(filePath);
        const framework = this.detectFramework(content, filePath);
        const complexity = this.assessComplexity(content);
        const riskLevel = this.assessRiskLevel(content, operation);
        const intent = this.inferIntent(operation, content);
        const orchestrationLevel = this.calculateOrchestrationLevel(context);
        const contextAwareness = this.calculateContextAwareness(context);
        const cognition = {
            intent,
            complexity,
            riskLevel,
            language,
            framework,
            projectType,
            agentContext: agentId,
            orchestrationLevel,
            contextAwareness
        };
        return ValidationCognitionSchema.parse(cognition);
    }
    detectLanguage(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const langMap = {
            'ts': 'typescript',
            'tsx': 'typescript',
            'js': 'javascript',
            'jsx': 'javascript',
            'json': 'json',
            'md': 'markdown',
            'css': 'css',
            'scss': 'scss',
            'html': 'html',
            'py': 'python',
            'rs': 'rust',
            'go': 'go'
        };
        return langMap[ext || ''] || 'unknown';
    }
    detectFramework(content, filePath) {
        if (content.includes('import React') || content.includes('from "react"'))
            return 'react';
        if (content.includes('import { NextPage }') || content.includes('next/'))
            return 'nextjs';
        if (content.includes('import express') || content.includes('app.listen'))
            return 'express';
        if (content.includes('import { FastifyInstance }'))
            return 'fastify';
        if (filePath.includes('__tests__') || content.includes('describe('))
            return 'jest';
        return undefined;
    }
    assessComplexity(content) {
        const lines = content.split('\n').length;
        const cyclomaticComplexity = this.calculateCyclomaticComplexity(content);
        const imports = (content.match(/import/g) || []).length;
        if (lines < 50 && cyclomaticComplexity < 5 && imports < 5)
            return 'simple';
        if (lines < 150 && cyclomaticComplexity < 10 && imports < 15)
            return 'moderate';
        if (lines < 300 && cyclomaticComplexity < 20 && imports < 30)
            return 'complex';
        return 'expert';
    }
    calculateCyclomaticComplexity(content) {
        const decisionPoints = [
            /\bif\b/g, /\belse\b/g, /\bwhile\b/g, /\bfor\b/g,
            /\bswitch\b/g, /\bcase\b/g, /\bcatch\b/g, /\b&&\b/g, /\b\|\|\b/g
        ];
        return decisionPoints.reduce((complexity, pattern) => {
            const matches = content.match(pattern) || [];
            return complexity + matches.length;
        }, 1);
    }
    assessRiskLevel(content, operation) {
        let riskScore = 0;
        if (operation === 'create')
            riskScore += 1;
        if (operation === 'update')
            riskScore += 2;
        if (operation === 'append')
            riskScore += 1;
        if (content.includes('eval(') || content.includes('new Function('))
            riskScore += 5;
        if (content.includes('process.exit') || content.includes('process.kill'))
            riskScore += 4;
        if (content.includes('fs.unlink') || content.includes('rm -rf'))
            riskScore += 4;
        if (content.includes('exec(') || content.includes('spawn('))
            riskScore += 3;
        if (content.includes('innerHTML') || content.includes('dangerouslySetInnerHTML'))
            riskScore += 2;
        if (riskScore >= 8)
            return 'critical';
        if (riskScore >= 5)
            return 'high';
        if (riskScore >= 2)
            return 'medium';
        return 'low';
    }
    inferIntent(operation, content) {
        if (operation === 'create')
            return 'create';
        if (content.includes('TODO:') || content.includes('FIXME:'))
            return 'fix';
        if (content.includes('// Enhanced') || content.includes('// Improved'))
            return 'enhance';
        if (content.includes('// Refactored') || content.includes('// Restructured'))
            return 'refactor';
        if (operation === 'update')
            return 'modify';
        return 'analyze';
    }
    calculateOrchestrationLevel(context) {
        let level = 5;
        if (context.agentId)
            level += 2;
        if (context.projectType)
            level += 1;
        if (context.operation === 'create')
            level += 1;
        if (context.filePath.includes('/core/') || context.filePath.includes('/services/'))
            level += 1;
        return Math.min(10, Math.max(0, level));
    }
    calculateContextAwareness(context) {
        let awareness = 0.5;
        if (context.agentId)
            awareness += 0.2;
        if (context.projectType)
            awareness += 0.1;
        if (context.filePath.includes('src/'))
            awareness += 0.1;
        if (context.operation === 'update')
            awareness += 0.1;
        return Math.min(1, Math.max(0, awareness));
    }
    selectIntelligentValidators(context, cognition) {
        const validators = this.selectValidators(context);
        if (cognition.riskLevel === 'high' || cognition.riskLevel === 'critical') {
            validators.push(this.createSecurityValidator());
        }
        if (cognition.complexity === 'complex' || cognition.complexity === 'expert') {
            validators.push(this.createComplexityValidator());
        }
        if (cognition.orchestrationLevel >= 8) {
            validators.push(this.createOrchestrationValidator());
        }
        return validators;
    }
    async executeIntelligentValidation(context, cognition, validators) {
        const { filePath, content } = context;
        const errors = [];
        const warnings = [];
        const suggestions = [];
        const optimizations = [];
        const adaptiveRecommendations = [];
        let processedContent = content;
        let formatResult = null;
        try {
            if (this.config.autoFormat) {
                const workingDirectory = filePath.substring(0, filePath.lastIndexOf('/')) || process.cwd();
                this.initializeFormatter(workingDirectory);
                if (this.formatterManager) {
                    formatResult = await this.formatterManager.formatContent(content, filePath);
                    if (formatResult.success && formatResult.formatted) {
                        processedContent = formatResult.content;
                    }
                }
            }
            for (const validator of validators) {
                try {
                    const result = await validator(processedContent, filePath);
                    if (result.errors)
                        errors.push(...result.errors);
                    if (result.warnings && !this.config.skipWarnings)
                        warnings.push(...result.warnings);
                }
                catch (validatorError) {
                    warnings.push(`Validator error: ${validatorError.message}`);
                }
            }
            suggestions.push(...this.generateIntelligentSuggestions(context, cognition));
            optimizations.push(...this.generateOptimizations(context, cognition));
            adaptiveRecommendations.push(...this.generateAdaptiveRecommendations(context, cognition));
            const cognitiveScore = this.calculateCognitiveScore(errors, warnings, cognition);
            const orchestrationCompatibility = this.calculateOrchestrationCompatibility(context, cognition);
            let finalContent = processedContent;
            if (errors.length > 0 && this.config.autoFix) {
                finalContent = await this.attemptIntelligentAutoFix(processedContent, filePath, errors, cognition);
            }
            const isValid = this.assessValidityWithCognition(errors, warnings, cognition);
            const result = {
                isValid,
                errors,
                warnings,
                suggestions,
                optimizations,
                cognitiveScore,
                orchestrationCompatibility,
                adaptiveRecommendations,
                fixedContent: finalContent !== content ? finalContent : undefined,
                formatted: formatResult?.formatted || false,
                formatter: formatResult?.formatter
            };
            result.timestamp = Date.now();
            return IntelligentValidationResultSchema.parse(result);
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`Intelligent validation failed for ${filePath}: ${error.message}`);
            return {
                isValid: false,
                errors: [`Intelligent validation system error: ${error.message}`],
                warnings: [],
                suggestions: [],
                optimizations: [],
                cognitiveScore: 0,
                orchestrationCompatibility: 0,
                adaptiveRecommendations: [],
                fixedContent: undefined,
                formatted: false
            };
        }
    }
    generateIntelligentSuggestions(context, cognition) {
        const suggestions = [];
        if (cognition.complexity === 'expert') {
            suggestions.push('Consider breaking down this complex logic into smaller, more manageable functions');
        }
        if (cognition.riskLevel === 'high') {
            suggestions.push('Add comprehensive error handling and input validation');
        }
        if (cognition.framework === 'react' && cognition.complexity !== 'simple') {
            suggestions.push('Consider using React.memo() for performance optimization');
        }
        if (cognition.orchestrationLevel >= 8) {
            suggestions.push('This component is part of a complex orchestration - ensure proper event handling');
        }
        return suggestions;
    }
    generateOptimizations(context, cognition) {
        const optimizations = [];
        if (cognition.language === 'typescript' && context.content.includes(': any')) {
            optimizations.push('Replace "any" types with specific interfaces for better type safety');
        }
        if (cognition.framework === 'react' && context.content.includes('useEffect')) {
            optimizations.push('Review useEffect dependencies to prevent unnecessary re-renders');
        }
        if (cognition.complexity === 'complex' && !context.content.includes('async')) {
            optimizations.push('Consider using async/await for better readability in complex operations');
        }
        return optimizations;
    }
    generateAdaptiveRecommendations(context, cognition) {
        const recommendations = [];
        const errorTolerance = this.adaptiveThresholds.get('errorTolerance') || 0.1;
        const complexityThreshold = this.adaptiveThresholds.get('complexityThreshold') || 0.7;
        if (cognition.complexity === 'expert' && errorTolerance < 0.05) {
            recommendations.push('Based on project patterns, extra scrutiny recommended for expert-level complexity');
        }
        if (cognition.orchestrationLevel >= 8 && complexityThreshold > 0.8) {
            recommendations.push('High orchestration level detected - ensure compatibility with existing agent workflows');
        }
        return recommendations;
    }
    calculateCognitiveScore(errors, warnings, cognition) {
        let score = 1.0;
        score -= errors.length * 0.1;
        score -= warnings.length * 0.05;
        if (cognition.complexity === 'simple')
            score += 0.1;
        if (cognition.riskLevel === 'low')
            score += 0.1;
        score += cognition.contextAwareness * 0.1;
        return Math.min(1, Math.max(0, score));
    }
    calculateOrchestrationCompatibility(context, cognition) {
        let compatibility = 0.5;
        if (context.agentId)
            compatibility += 0.2;
        if (context.projectType)
            compatibility += 0.1;
        compatibility += (cognition.orchestrationLevel / 10) * 0.2;
        compatibility += cognition.contextAwareness * 0.1;
        return Math.min(1, Math.max(0, compatibility));
    }
    assessValidityWithCognition(errors, warnings, cognition) {
        const errorTolerance = this.adaptiveThresholds.get('errorTolerance') || 0.1;
        const warningTolerance = this.adaptiveThresholds.get('warningTolerance') || 0.3;
        let adjustedErrorTolerance = errorTolerance;
        let adjustedWarningTolerance = warningTolerance;
        if (cognition.complexity === 'expert') {
            adjustedErrorTolerance *= 1.5;
            adjustedWarningTolerance *= 1.2;
        }
        if (cognition.riskLevel === 'critical') {
            adjustedErrorTolerance *= 0.5;
            adjustedWarningTolerance *= 0.7;
        }
        const errorRatio = errors.length / 100;
        const warningRatio = warnings.length / 100;
        return errorRatio <= adjustedErrorTolerance && warningRatio <= adjustedWarningTolerance;
    }
    async attemptIntelligentAutoFix(content, filePath, errors, cognition) {
        let fixedContent = content;
        fixedContent = await this.attemptAutoFix(content, filePath, errors);
        if (cognition.framework === 'react') {
            fixedContent = this.applyReactCognitiveFixes(fixedContent, errors);
        }
        if (cognition.riskLevel === 'high' || cognition.riskLevel === 'critical') {
            fixedContent = this.applySecurityCognitiveFixes(fixedContent, errors);
        }
        if (cognition.complexity === 'expert') {
            fixedContent = this.applyComplexityCognitiveFixes(fixedContent, errors);
        }
        return fixedContent;
    }
    applyReactCognitiveFixes(content, errors) {
        let fixedContent = content;
        if (errors.some(e => e.includes('performance')) && !content.includes('React.memo')) {
            fixedContent = fixedContent.replace(/export\s+default\s+function\s+(\w+)/, 'export default React.memo(function $1');
            if (fixedContent !== content) {
                fixedContent += ')';
            }
        }
        return fixedContent;
    }
    applySecurityCognitiveFixes(content, errors) {
        let fixedContent = content;
        if (errors.some(e => e.includes('security') || e.includes('validation'))) {
            if (!content.includes('validateInput') && content.includes('function')) {
                fixedContent = '// TODO: Add input validation\n' + fixedContent;
            }
        }
        return fixedContent;
    }
    applyComplexityCognitiveFixes(content, errors) {
        let fixedContent = content;
        if (errors.some(e => e.includes('complexity'))) {
            if (!content.includes('// TODO: Consider refactoring')) {
                fixedContent = '// TODO: Consider refactoring for reduced complexity\n' + fixedContent;
            }
        }
        return fixedContent;
    }
    updateAdaptiveThresholds(context, result) {
        if (result.isValid && result.cognitiveScore > 0.8) {
            const currentTolerance = this.adaptiveThresholds.get('errorTolerance') || 0.1;
            this.adaptiveThresholds.set('errorTolerance', Math.min(0.2, currentTolerance * 1.05));
        }
        if (result.orchestrationCompatibility > 0.9) {
            const currentCompatibility = this.orchestrationMetrics.get('agentCoordination') || 0.8;
            this.orchestrationMetrics.set('agentCoordination', Math.min(1.0, currentCompatibility * 1.02));
        }
    }
    cleanupIntelligentCache() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000;
        for (const [key, result] of this.validationCache.entries()) {
            const timestamp = result.timestamp || 0;
            if (now - timestamp > maxAge) {
                this.validationCache.delete(key);
            }
        }
        advanced_cli_ui_1.advancedUI.logInfo(`🧠 Cleaned intelligent cache, ${this.validationCache.size} entries remaining`);
    }
    createSecurityValidator() {
        return async (content, filePath) => {
            const errors = [];
            const warnings = [];
            const securityPatterns = [
                { pattern: /eval\s*\(/, message: 'eval() usage detected - security risk', level: 'error' },
                { pattern: /innerHTML\s*=/, message: 'innerHTML usage - consider textContent for security', level: 'warning' },
                { pattern: /process\.exit\s*\(/, message: 'process.exit() usage - ensure graceful shutdown', level: 'warning' },
                { pattern: /\.exec\s*\(/, message: 'exec() usage detected - validate input thoroughly', level: 'error' }
            ];
            securityPatterns.forEach(({ pattern, message, level }) => {
                if (pattern.test(content)) {
                    if (level === 'error') {
                        errors.push(message);
                    }
                    else {
                        warnings.push(message);
                    }
                }
            });
            return { isValid: errors.length === 0, errors, warnings };
        };
    }
    createComplexityValidator() {
        return async (content, filePath) => {
            const errors = [];
            const warnings = [];
            const lines = content.split('\n').length;
            const cyclomaticComplexity = this.calculateCyclomaticComplexity(content);
            if (lines > 500) {
                warnings.push('File is very large (>500 lines) - consider splitting into smaller modules');
            }
            if (cyclomaticComplexity > 15) {
                errors.push('Cyclomatic complexity is too high - consider refactoring');
            }
            else if (cyclomaticComplexity > 10) {
                warnings.push('Cyclomatic complexity is getting high - consider simplification');
            }
            return { isValid: errors.length === 0, errors, warnings };
        };
    }
    createOrchestrationValidator() {
        return async (content, filePath) => {
            const errors = [];
            const warnings = [];
            if (content.includes('EventEmitter') || content.includes('emit(')) {
                if (!content.includes('removeListener') && !content.includes('off(')) {
                    warnings.push('EventEmitter usage detected - ensure proper cleanup to prevent memory leaks');
                }
            }
            if (content.includes('async') && content.includes('await')) {
                if (!content.includes('try') || !content.includes('catch')) {
                    warnings.push('Async operations detected - consider proper error handling for orchestration');
                }
            }
            if (filePath.includes('/agents/') || filePath.includes('/services/')) {
                if (!content.includes('interface') && !content.includes('type')) {
                    warnings.push('Service/Agent file should have clear type definitions for orchestration');
                }
            }
            return { isValid: errors.length === 0, errors, warnings };
        };
    }
    selectValidators(context) {
        const { filePath, agentId, projectType } = context;
        const validators = [];
        if (this.config.enableLSP) {
            validators.push(write_file_tool_1.ContentValidators.autoValidator);
        }
        else {
            if (filePath.match(/\.(tsx?)$/)) {
                validators.push(write_file_tool_1.ContentValidators.typeScriptSyntax);
            }
            if (filePath.match(/\.(jsx|tsx)$/)) {
                validators.push(write_file_tool_1.ContentValidators.reactSyntax);
            }
            if (filePath.endsWith('.json')) {
                validators.push(write_file_tool_1.ContentValidators.jsonSyntax);
            }
        }
        validators.push(write_file_tool_1.ContentValidators.codeQuality);
        validators.push(write_file_tool_1.ContentValidators.noAbsolutePaths);
        if (filePath.endsWith('package.json')) {
            validators.push(write_file_tool_1.ContentValidators.noLatestVersions);
        }
        for (const [pattern, customValidators] of this.customValidators) {
            if (this.matchesPattern(filePath, pattern) || pattern === agentId) {
                validators.push(...customValidators);
            }
        }
        if (projectType) {
            validators.push(...this.getProjectValidators(projectType));
        }
        return validators;
    }
    getProjectValidators(projectType) {
        const validators = [];
        switch (projectType.toLowerCase()) {
            case 'react':
            case 'next.js':
                validators.push(this.createReactProjectValidator());
                break;
            case 'node':
            case 'express':
                validators.push(this.createNodeProjectValidator());
                break;
            case 'typescript':
                validators.push(this.createTypeScriptProjectValidator());
                break;
        }
        return validators;
    }
    createReactProjectValidator() {
        return async (content, filePath) => {
            const errors = [];
            const warnings = [];
            if (filePath.match(/\.(tsx|jsx)$/)) {
                if (content.includes('class ') && content.includes('extends Component')) {
                    warnings.push('Consider using functional components with hooks instead of class components');
                }
                if (content.includes('componentDidMount') || content.includes('componentWillUnmount')) {
                    warnings.push('Consider using useEffect hook instead of lifecycle methods');
                }
                if (content.includes('useState') && !content.includes('import') && !content.includes('React.useState')) {
                    errors.push('useState hook used but not imported from React');
                }
            }
            return { isValid: errors.length === 0, errors, warnings };
        };
    }
    createNodeProjectValidator() {
        return async (content, filePath) => {
            const errors = [];
            const warnings = [];
            if (filePath.match(/\.(ts|js)$/) && !filePath.includes('test')) {
                if (content.includes('process.env.') && !content.includes('dotenv')) {
                    warnings.push('Consider using dotenv for environment variable management');
                }
                if (content.includes('require(') && filePath.endsWith('.ts')) {
                    warnings.push('Consider using ES6 imports instead of require() in TypeScript');
                }
            }
            return { isValid: errors.length === 0, errors, warnings };
        };
    }
    createTypeScriptProjectValidator() {
        return async (content, filePath) => {
            const errors = [];
            const warnings = [];
            if (filePath.match(/\.(ts|tsx)$/)) {
                if (content.includes(': any')) {
                    warnings.push('Avoid using "any" type - consider using specific types');
                }
                if (content.includes('// @ts-ignore')) {
                    warnings.push('Avoid @ts-ignore - fix the underlying type issue instead');
                }
                const exportMatches = content.match(/export\s+(?:default\s+)?(?:function|class|interface|const|let|var)\s+(\w+)/g);
                if (exportMatches && exportMatches.length > 5) {
                    warnings.push('Consider splitting large files into smaller modules');
                }
            }
            return { isValid: errors.length === 0, errors, warnings };
        };
    }
    async attemptAutoFix(content, filePath, errors) {
        let fixedContent = content;
        advanced_cli_ui_1.advancedUI.logInfo(`🔧 Attempting auto-fix for ${errors.length} errors...`);
        for (const error of errors) {
            try {
                if (error.includes('React import missing')) {
                    fixedContent = this.fixMissingReactImport(fixedContent);
                }
                if (error.includes('should start with uppercase letter')) {
                    fixedContent = this.fixComponentNaming(fixedContent, error);
                }
                if (error.includes('missing props interface')) {
                    fixedContent = this.fixMissingPropsInterface(fixedContent);
                }
                if (error.includes('Missing semicolon')) {
                    fixedContent = this.fixMissingSemicolons(fixedContent);
                }
                if (error.includes('JSON contains trailing commas')) {
                    fixedContent = this.fixTrailingCommas(fixedContent);
                }
            }
            catch (fixError) {
                advanced_cli_ui_1.advancedUI.logWarning(`Auto-fix failed for error "${error}": ${fixError.message}`);
            }
        }
        if (fixedContent !== content) {
            advanced_cli_ui_1.advancedUI.logSuccess('✅ Auto-fix applied successfully');
        }
        return fixedContent;
    }
    fixMissingReactImport(content) {
        if (!content.includes('import React') && !content.includes('import * as React')) {
            return `import React from 'react';\n${content}`;
        }
        return content;
    }
    fixComponentNaming(content, error) {
        const match = error.match(/'([a-z][a-zA-Z0-9]*)'/);
        if (match) {
            const oldName = match[1];
            const newName = oldName.charAt(0).toUpperCase() + oldName.slice(1);
            return content.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
        }
        return content;
    }
    fixMissingPropsInterface(content) {
        const componentMatch = content.match(/(?:export\s+(?:default\s+)?(?:function|const)\s+)([A-Z][a-zA-Z0-9]*)/);
        if (componentMatch) {
            const componentName = componentMatch[1];
            const propsInterface = `\ninterface ${componentName}Props {\n  // Define component props here\n}\n`;
            const componentIndex = content.indexOf(componentMatch[0]);
            const fixedContent = content.slice(0, componentIndex) + propsInterface + content.slice(componentIndex);
            return fixedContent.replace(new RegExp(`(const\\s+${componentName})[^=]*=`, 'g'), `$1: React.FC<${componentName}Props> =`);
        }
        return content;
    }
    fixMissingSemicolons(content) {
        return content.replace(/^(import.*from\s+['"][^'"]*['"])(?!\s*;)/gm, '$1;');
    }
    fixTrailingCommas(content) {
        return content.replace(/,(\s*[}\]])/g, '$1');
    }
    isCriticalError(error) {
        const criticalPatterns = [
            'syntax error',
            'cannot find module',
            'type error',
            'compilation error',
            'invalid json'
        ];
        return criticalPatterns.some(pattern => error.toLowerCase().includes(pattern));
    }
    matchesPattern(filePath, pattern) {
        if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(filePath);
        }
        return filePath.includes(pattern);
    }
    logProcessingResults(filePath, formatResult, errors, warnings, agentId) {
        const fileName = filePath.split('/').pop();
        const prefix = agentId ? `[${agentId}] ` : '';
        if (formatResult?.formatted) {
            advanced_cli_ui_1.advancedUI.logSuccess(`${prefix}🎨 ${fileName} - Formatted with ${formatResult.formatter}`);
        }
        if (errors.length === 0 && warnings.length === 0) {
            advanced_cli_ui_1.advancedUI.logSuccess(`${prefix}✅ ${fileName} - No validation issues found`);
            return;
        }
        if (errors.length > 0) {
            advanced_cli_ui_1.advancedUI.logError(`${prefix}❌ ${fileName} - ${errors.length} error(s):`);
            errors.forEach((error, index) => {
                console.log(chalk_1.default.red(`   ${index + 1}. ${error}`));
            });
        }
        if (warnings.length > 0) {
            advanced_cli_ui_1.advancedUI.logWarning(`${prefix}⚠️  ${fileName} - ${warnings.length} warning(s):`);
            warnings.forEach((warning, index) => {
                console.log(chalk_1.default.yellow(`   ${index + 1}. ${warning}`));
            });
        }
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    getConfig() {
        return { ...this.config };
    }
    getCognitiveMetrics() {
        return {
            cacheSize: this.validationCache.size,
            patternCount: this.cognitivePatterns.size,
            adaptiveThresholds: Object.fromEntries(this.adaptiveThresholds),
            orchestrationMetrics: Object.fromEntries(this.orchestrationMetrics)
        };
    }
}
exports.ValidatorManager = ValidatorManager;
exports.validatorManager = ValidatorManager.getInstance({
    enableLSP: true,
    autoFix: true,
    autoFormat: true,
    strictMode: false,
    skipWarnings: false
});
