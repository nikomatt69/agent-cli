"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolsManager = exports.secureTools = exports.ToolsMigration = void 0;
exports.createSecureToolsManager = createSecureToolsManager;
const chalk_1 = __importDefault(require("chalk"));
const secure_tools_registry_1 = require("./secure-tools-registry");
const tools_manager_1 = require("./tools-manager");
/**
 * Migration script to safely transition from unsafe ToolsManager to SecureToolsRegistry
 * This provides backward compatibility while encouraging secure practices
 */
class ToolsMigration {
    constructor(workingDir) {
        this.migrationWarnings = [];
        this.legacyToolsManager = new tools_manager_1.ToolsManager(workingDir);
    }
    /**
     * Show migration warning for unsafe operations
     */
    showMigrationWarning(operation, secureAlternative) {
        const warning = `⚠️  DEPRECATED: ${operation} - Use ${secureAlternative} instead`;
        if (!this.migrationWarnings.includes(warning)) {
            console.log(chalk_1.default.yellow(warning));
            console.log(chalk_1.default.gray('   This operation lacks security controls and will be removed in future versions.'));
            this.migrationWarnings.push(warning);
        }
    }
    /**
     * Secure wrapper for file reading
     */
    async readFile(filePath) {
        console.log(chalk_1.default.blue('🔄 Migrating to secure file reading...'));
        return await secure_tools_registry_1.secureTools.readFile(filePath);
    }
    /**
     * Secure wrapper for file writing with deprecation warning
     */
    async writeFile(filePath, content, skipConfirmation = false) {
        if (skipConfirmation) {
            this.showMigrationWarning('writeFile without confirmation', 'secureTools.writeFile() with user confirmation');
        }
        console.log(chalk_1.default.blue('🔄 Migrating to secure file writing...'));
        return await secure_tools_registry_1.secureTools.writeFile(filePath, content, { skipConfirmation });
    }
    /**
     * Secure wrapper for directory listing
     */
    async listFiles(directory = '.', pattern) {
        console.log(chalk_1.default.blue('🔄 Migrating to secure directory listing...'));
        const result = await secure_tools_registry_1.secureTools.listDirectory(directory, { pattern });
        // Convert to legacy format for backward compatibility
        return [...result.data.files, ...result.data.directories];
    }
    /**
     * BLOCKED: Unsafe command execution
     */
    async runCommand(command, args = [], options = {}) {
        console.log(chalk_1.default.red('🚫 BLOCKED: Direct command execution is not allowed'));
        console.log(chalk_1.default.yellow('Use secureTools.executeCommand() instead for safe command execution'));
        console.log(chalk_1.default.gray(`Attempted command: ${command} ${args.join(' ')}`));
        throw new Error('Direct command execution blocked for security. Use secureTools.executeCommand() with proper confirmation.');
    }
    /**
     * BLOCKED: Unsafe command streaming
     */
    async runCommandStream(command, options = {}) {
        console.log(chalk_1.default.red('🚫 BLOCKED: Direct command streaming is not allowed'));
        console.log(chalk_1.default.yellow('Use secureTools.executeCommand() instead for safe command execution'));
        throw new Error('Direct command streaming blocked for security. Use secureTools.executeCommand() with proper confirmation.');
    }
    /**
     * BLOCKED: Package installation without confirmation
     */
    async installPackage(packageName, options = {}) {
        console.log(chalk_1.default.red('🚫 BLOCKED: Automatic package installation is not allowed'));
        console.log(chalk_1.default.yellow('Use secureTools.executeCommand() with npm/yarn commands and user confirmation'));
        console.log(chalk_1.default.gray(`Attempted package: ${packageName}`));
        throw new Error('Automatic package installation blocked for security. Use secureTools.executeCommand() with proper confirmation.');
    }
    /**
     * Safe wrapper for search operations
     */
    async searchInFiles(query, directory = '.', filePattern) {
        console.log(chalk_1.default.blue('🔄 Using legacy search (consider implementing secure search)...'));
        this.showMigrationWarning('searchInFiles', 'secureTools with grep command execution');
        return await this.legacyToolsManager.searchInFiles(query, directory, filePattern);
    }
    /**
     * Safe wrapper for project analysis
     */
    async analyzeProject() {
        console.log(chalk_1.default.blue('🔄 Using legacy project analysis...'));
        this.showMigrationWarning('analyzeProject', 'secureTools.listDirectory() with analysis logic');
        return await this.legacyToolsManager.analyzeProject();
    }
    /**
     * BLOCKED: Build operations without confirmation
     */
    async build(framework) {
        console.log(chalk_1.default.red('🚫 BLOCKED: Direct build operations are not allowed'));
        console.log(chalk_1.default.yellow('Use secureTools.executeCommand() with build commands and user confirmation'));
        console.log(chalk_1.default.gray(`Attempted framework: ${framework || 'auto-detect'}`));
        return {
            success: false,
            output: 'Direct build operations blocked for security. Use secureTools.executeCommand() with proper confirmation.',
            errors: [{
                    type: 'security',
                    severity: 'error',
                    message: 'Direct build operations are not allowed for security reasons'
                }]
        };
    }
    /**
     * BLOCKED: Test execution without confirmation
     */
    async runTests(testPattern) {
        console.log(chalk_1.default.red('🚫 BLOCKED: Direct test execution is not allowed'));
        console.log(chalk_1.default.yellow('Use secureTools.executeCommand() with test commands and user confirmation'));
        console.log(chalk_1.default.gray(`Attempted pattern: ${testPattern || 'all tests'}`));
        return {
            success: false,
            output: 'Direct test execution blocked for security. Use secureTools.executeCommand() with proper confirmation.',
            errors: [{
                    type: 'security',
                    severity: 'error',
                    message: 'Direct test execution is not allowed for security reasons'
                }]
        };
    }
    /**
     * BLOCKED: Lint operations without confirmation
     */
    async lint(filePath) {
        console.log(chalk_1.default.red('🚫 BLOCKED: Direct lint operations are not allowed'));
        console.log(chalk_1.default.yellow('Use secureTools.executeCommand() with lint commands and user confirmation'));
        console.log(chalk_1.default.gray(`Attempted file: ${filePath || 'all files'}`));
        return {
            success: false,
            output: 'Direct lint operations blocked for security. Use secureTools.executeCommand() with proper confirmation.',
            errors: [{
                    type: 'security',
                    severity: 'error',
                    message: 'Direct lint operations are not allowed for security reasons'
                }]
        };
    }
    /**
     * BLOCKED: Type checking without confirmation
     */
    async typeCheck() {
        console.log(chalk_1.default.red('🚫 BLOCKED: Direct type checking is not allowed'));
        console.log(chalk_1.default.yellow('Use secureTools.executeCommand() with TypeScript commands and user confirmation'));
        return {
            success: false,
            output: 'Direct type checking blocked for security. Use secureTools.executeCommand() with proper confirmation.',
            errors: [{
                    type: 'security',
                    severity: 'error',
                    message: 'Direct type checking is not allowed for security reasons'
                }]
        };
    }
    /**
     * Show migration summary
     */
    showMigrationSummary() {
        console.log(chalk_1.default.blue.bold('\n🔄 Migration Summary'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        if (this.migrationWarnings.length === 0) {
            console.log(chalk_1.default.green('✅ No deprecated operations used'));
        }
        else {
            console.log(chalk_1.default.yellow(`⚠️  ${this.migrationWarnings.length} deprecated operations detected:`));
            this.migrationWarnings.forEach(warning => {
                console.log(chalk_1.default.gray(`  • ${warning.replace('⚠️  DEPRECATED: ', '')}`));
            });
        }
        console.log(chalk_1.default.blue('\n💡 Migration Recommendations:'));
        console.log(chalk_1.default.gray('  • Replace ToolsManager with SecureToolsRegistry'));
        console.log(chalk_1.default.gray('  • Use secureTools.* methods for all operations'));
        console.log(chalk_1.default.gray('  • Enable user confirmation for write operations'));
        console.log(chalk_1.default.gray('  • Use command allow-listing for shell operations'));
    }
    /**
     * Get secure tools instance
     */
    getSecureTools() {
        return secure_tools_registry_1.secureTools;
    }
}
exports.ToolsMigration = ToolsMigration;
/**
 * Factory function to create a migration-aware tools instance
 * This provides a transition path from ToolsManager to SecureToolsRegistry
 */
function createSecureToolsManager(workingDir) {
    console.log(chalk_1.default.blue('🔒 Creating secure tools manager...'));
    console.log(chalk_1.default.yellow('⚠️  Legacy ToolsManager operations will show deprecation warnings'));
    return new ToolsMigration(workingDir);
}
/**
 * Direct access to secure tools (recommended)
 */
var secure_tools_registry_2 = require("./secure-tools-registry");
Object.defineProperty(exports, "secureTools", { enumerable: true, get: function () { return secure_tools_registry_2.secureTools; } });
/**
 * Legacy export for backward compatibility (deprecated)
 * @deprecated Use secureTools or createSecureToolsManager() instead
 */
exports.toolsManager = createSecureToolsManager();
