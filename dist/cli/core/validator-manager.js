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
class ValidatorManager {
    constructor(config = {}) {
        this.customValidators = new Map();
        this.formatterManager = null;
        this.config = {
            enableLSP: true,
            autoFix: true,
            autoFormat: true,
            strictMode: false,
            skipWarnings: false,
            ...config
        };
    }
    static getInstance(config) {
        if (!ValidatorManager.instance) {
            ValidatorManager.instance = new ValidatorManager(config);
        }
        return ValidatorManager.instance;
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
    logValidationResults(filePath, errors, warnings, agentId) {
        this.logProcessingResults(filePath, null, errors, warnings, agentId);
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    getConfig() {
        return { ...this.config };
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
