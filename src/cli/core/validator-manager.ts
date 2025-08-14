/**
 * Central Validator Manager for all file operations
 * Provides unified validation across all agents and tools
 */

import { type ContentValidator, type ValidationResult } from '../schemas/tool-schemas';
import { ContentValidators } from '../tools/write-file-tool';
import { advancedUI } from '../ui/advanced-cli-ui';
import { createFormatterManager, FormatResult } from './formatter-manager';
import chalk from 'chalk';

export interface ValidationConfig {
  enableLSP: boolean;
  autoFix: boolean;
  autoFormat: boolean;
  strictMode: boolean;
  skipWarnings: boolean;
  customValidators?: ContentValidator[];
}

export interface ValidationContext {
  filePath: string;
  content: string;
  operation: 'create' | 'update' | 'append';
  agentId?: string;
  projectType?: string;
}

export class ValidatorManager {
  private static instance: ValidatorManager;
  private config: ValidationConfig;
  private customValidators: Map<string, ContentValidator[]> = new Map();
  private formatterManager: ReturnType<typeof createFormatterManager> | null = null;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = {
      enableLSP: true,
      autoFix: true,
      autoFormat: true,
      strictMode: false,
      skipWarnings: false,
      ...config
    };
  }

  static getInstance(config?: Partial<ValidationConfig>): ValidatorManager {
    if (!ValidatorManager.instance) {
      ValidatorManager.instance = new ValidatorManager(config);
    }
    return ValidatorManager.instance;
  }

  /**
   * Register custom validators for specific file patterns or agent types
   */
  registerValidator(pattern: string, validator: ContentValidator): void {
    if (!this.customValidators.has(pattern)) {
      this.customValidators.set(pattern, []);
    }
    this.customValidators.get(pattern)!.push(validator);
  }

  /**
   * Initialize formatter manager with working directory
   */
  private initializeFormatter(workingDirectory: string): void {
    if (!this.formatterManager) {
      this.formatterManager = createFormatterManager(workingDirectory, {
        enabled: this.config.autoFormat,
        formatOnSave: true,
        respectEditorConfig: true
      });
    }
  }

  /**
   * Main validation method - formats then validates content before any file operation
   */
  async validateContent(context: ValidationContext): Promise<ExtendedValidationResult> {
    const { filePath, content, operation, agentId } = context;
    
    advancedUI.logInfo(`🎨 Processing ${operation}: ${filePath.split('/').pop()}`);
    
    const errors: string[] = [];
    const warnings: string[] = [];
    let processedContent = content;
    let formatResult: FormatResult | null = null;
    
    try {
      // Initialize formatter with working directory from file path
      const workingDirectory = filePath.substring(0, filePath.lastIndexOf('/')) || process.cwd();
      this.initializeFormatter(workingDirectory);

      // 1. 🎨 FORMAT FIRST - Format code according to language standards
      if (this.config.autoFormat && this.formatterManager) {
        advancedUI.logInfo(`🎨 Auto-formatting ${filePath.split('/').pop()}...`);
        formatResult = await this.formatterManager.formatContent(content, filePath);
        
        if (formatResult.success && formatResult.formatted) {
          processedContent = formatResult.content;
          advancedUI.logSuccess(`✅ Formatted with ${formatResult.formatter}`);
        } else if (formatResult.warnings) {
          warnings.push(...formatResult.warnings);
        }
        
        if (formatResult.error && !formatResult.success) {
          warnings.push(`Formatting failed: ${formatResult.error}`);
        }
      }
      
      // 2. 🔍 VALIDATE - Run LSP and syntax validation on formatted content
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
          
        } catch (validatorError: any) {
          warnings.push(`Validator error: ${validatorError.message}`);
        }
      }
      
      // 3. 📋 LOG RESULTS - Show formatting and validation results
      this.logProcessingResults(filePath, formatResult, errors, warnings, agentId);
      
      // 4. 🔧 AUTO-FIX - Fix remaining errors if possible
      let finalContent = processedContent;
      if (errors.length > 0 && this.config.autoFix) {
        finalContent = await this.attemptAutoFix(processedContent, filePath, errors);
        
        // Re-validate after auto-fix
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
      
    } catch (error: any) {
      advancedUI.logError(`Processing failed for ${filePath}: ${error.message}`);
      return {
        isValid: false,
        errors: [`Processing system error: ${error.message}`],
        warnings: [],
        fixedContent: undefined,
        formatted: false
      };
    }
  }

  /**
   * Select appropriate validators based on file context
   */
  private selectValidators(context: ValidationContext): ContentValidator[] {
    const { filePath, agentId, projectType } = context;
    const validators: ContentValidator[] = [];
    
    // 1. Auto-select based on file extension (includes LSP validation)
    if (this.config.enableLSP) {
      validators.push(ContentValidators.autoValidator);
    } else {
      // Fallback to syntax-only validation
      if (filePath.match(/\.(tsx?)$/)) {
        validators.push(ContentValidators.typeScriptSyntax);
      }
      if (filePath.match(/\.(jsx|tsx)$/)) {
        validators.push(ContentValidators.reactSyntax);
      }
      if (filePath.endsWith('.json')) {
        validators.push(ContentValidators.jsonSyntax);
      }
    }
    
    // 2. Add general code quality validators
    validators.push(ContentValidators.codeQuality);
    validators.push(ContentValidators.noAbsolutePaths);
    
    if (filePath.endsWith('package.json')) {
      validators.push(ContentValidators.noLatestVersions);
    }
    
    // 3. Add custom validators based on patterns
    for (const [pattern, customValidators] of this.customValidators) {
      if (this.matchesPattern(filePath, pattern) || pattern === agentId) {
        validators.push(...customValidators);
      }
    }
    
    // 4. Add project-specific validators
    if (projectType) {
      validators.push(...this.getProjectValidators(projectType));
    }
    
    return validators;
  }

  /**
   * Get validators specific to project type
   */
  private getProjectValidators(projectType: string): ContentValidator[] {
    const validators: ContentValidator[] = [];
    
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

  /**
   * Create React project specific validator
   */
  private createReactProjectValidator(): ContentValidator {
    return async (content: string, filePath: string): Promise<ValidationResult> => {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      if (filePath.match(/\.(tsx|jsx)$/)) {
        // React-specific validations
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

  /**
   * Create Node.js project specific validator
   */
  private createNodeProjectValidator(): ContentValidator {
    return async (content: string, filePath: string): Promise<ValidationResult> => {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      if (filePath.match(/\.(ts|js)$/) && !filePath.includes('test')) {
        // Node.js specific validations
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

  /**
   * Create TypeScript project specific validator
   */
  private createTypeScriptProjectValidator(): ContentValidator {
    return async (content: string, filePath: string): Promise<ValidationResult> => {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      if (filePath.match(/\.(ts|tsx)$/)) {
        // TypeScript specific validations
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

  /**
   * Attempt to automatically fix common issues
   */
  private async attemptAutoFix(content: string, filePath: string, errors: string[]): Promise<string> {
    let fixedContent = content;
    
    advancedUI.logInfo(`🔧 Attempting auto-fix for ${errors.length} errors...`);
    
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
        
      } catch (fixError: any) {
        advancedUI.logWarning(`Auto-fix failed for error "${error}": ${fixError.message}`);
      }
    }
    
    if (fixedContent !== content) {
      advancedUI.logSuccess('✅ Auto-fix applied successfully');
    }
    
    return fixedContent;
  }

  /**
   * Fix missing React import
   */
  private fixMissingReactImport(content: string): string {
    if (!content.includes('import React') && !content.includes('import * as React')) {
      return `import React from 'react';\n${content}`;
    }
    return content;
  }

  /**
   * Fix component naming (lowercase to uppercase)
   */
  private fixComponentNaming(content: string, error: string): string {
    const match = error.match(/'([a-z][a-zA-Z0-9]*)'/);
    if (match) {
      const oldName = match[1];
      const newName = oldName.charAt(0).toUpperCase() + oldName.slice(1);
      return content.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
    }
    return content;
  }

  /**
   * Fix missing props interface
   */
  private fixMissingPropsInterface(content: string): string {
    const componentMatch = content.match(/(?:export\s+(?:default\s+)?(?:function|const)\s+)([A-Z][a-zA-Z0-9]*)/);
    if (componentMatch) {
      const componentName = componentMatch[1];
      const propsInterface = `\ninterface ${componentName}Props {\n  // Define component props here\n}\n`;
      
      // Insert interface before component declaration
      const componentIndex = content.indexOf(componentMatch[0]);
      const fixedContent = content.slice(0, componentIndex) + propsInterface + content.slice(componentIndex);
      
      // Update component to use props interface
      return fixedContent.replace(
        new RegExp(`(const\\s+${componentName})[^=]*=`, 'g'),
        `$1: React.FC<${componentName}Props> =`
      );
    }
    return content;
  }

  /**
   * Fix missing semicolons
   */
  private fixMissingSemicolons(content: string): string {
    // Add semicolons to import statements
    return content.replace(/^(import.*from\s+['"][^'"]*['"])(?!\s*;)/gm, '$1;');
  }

  /**
   * Fix trailing commas in JSON
   */
  private fixTrailingCommas(content: string): string {
    return content.replace(/,(\s*[}\]])/g, '$1');
  }

  /**
   * Check if error is critical and should block file creation
   */
  private isCriticalError(error: string): boolean {
    const criticalPatterns = [
      'syntax error',
      'cannot find module',
      'type error',
      'compilation error',
      'invalid json'
    ];
    
    return criticalPatterns.some(pattern => error.toLowerCase().includes(pattern));
  }

  /**
   * Check if file path matches pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  }

  /**
   * Log processing results including formatting and validation
   */
  private logProcessingResults(
    filePath: string, 
    formatResult: FormatResult | null, 
    errors: string[], 
    warnings: string[], 
    agentId?: string
  ): void {
    const fileName = filePath.split('/').pop();
    const prefix = agentId ? `[${agentId}] ` : '';
    
    // Log formatting results
    if (formatResult?.formatted) {
      advancedUI.logSuccess(`${prefix}🎨 ${fileName} - Formatted with ${formatResult.formatter}`);
    }
    
    // Log validation results
    if (errors.length === 0 && warnings.length === 0) {
      advancedUI.logSuccess(`${prefix}✅ ${fileName} - No validation issues found`);
      return;
    }
    
    if (errors.length > 0) {
      advancedUI.logError(`${prefix}❌ ${fileName} - ${errors.length} error(s):`);
      errors.forEach((error, index) => {
        console.log(chalk.red(`   ${index + 1}. ${error}`));
      });
    }
    
    if (warnings.length > 0) {
      advancedUI.logWarning(`${prefix}⚠️  ${fileName} - ${warnings.length} warning(s):`);
      warnings.forEach((warning, index) => {
        console.log(chalk.yellow(`   ${index + 1}. ${warning}`));
      });
    }
  }

  /**
   * Log validation results with appropriate colors and formatting (legacy method)
   */
  private logValidationResults(filePath: string, errors: string[], warnings: string[], agentId?: string): void {
    this.logProcessingResults(filePath, null, errors, warnings, agentId);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ValidationConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const validatorManager = ValidatorManager.getInstance({
  enableLSP: true,
  autoFix: true,
  autoFormat: true,
  strictMode: false,
  skipWarnings: false
});

// Extended validation result interface
export interface ExtendedValidationResult extends ValidationResult {
  fixedContent?: string;
  formatted?: boolean;
  formatter?: string;
}