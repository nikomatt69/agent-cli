"use strict";
/**
 * Secure Tools Module - Phase 1: Foundation & Security
 *
 * This module provides secure, sandboxed tools with user confirmation
 * for all potentially dangerous operations. It replaces the unsafe
 * ToolsManager with security-first implementations.
 *
 * Key Security Features:
 * - Path sanitization to prevent directory traversal
 * - User confirmation for all write operations
 * - Command allow-listing and analysis
 * - Execution tracking and audit logs
 * - Atomic operations with proper error handling
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolsManager = exports.toolsManager = exports.createSecureToolsManager = exports.ToolsMigration = exports.secureTools = exports.SecureToolsRegistry = exports.SecureCommandTool = exports.sanitizePath = exports.ReplaceInFileTool = exports.ListDirectoryTool = exports.WriteFileTool = exports.ReadFileTool = void 0;
exports.initializeSecureTools = initializeSecureTools;
exports.showSecurityGuidelines = showSecurityGuidelines;
const chalk_1 = __importDefault(require("chalk"));
// Export secure tools (recommended)
var secure_file_tools_1 = require("./secure-file-tools");
Object.defineProperty(exports, "ReadFileTool", { enumerable: true, get: function () { return secure_file_tools_1.ReadFileTool; } });
Object.defineProperty(exports, "WriteFileTool", { enumerable: true, get: function () { return secure_file_tools_1.WriteFileTool; } });
Object.defineProperty(exports, "ListDirectoryTool", { enumerable: true, get: function () { return secure_file_tools_1.ListDirectoryTool; } });
Object.defineProperty(exports, "ReplaceInFileTool", { enumerable: true, get: function () { return secure_file_tools_1.ReplaceInFileTool; } });
Object.defineProperty(exports, "sanitizePath", { enumerable: true, get: function () { return secure_file_tools_1.sanitizePath; } });
var secure_command_tool_1 = require("./secure-command-tool");
Object.defineProperty(exports, "SecureCommandTool", { enumerable: true, get: function () { return secure_command_tool_1.SecureCommandTool; } });
var secure_tools_registry_1 = require("./secure-tools-registry");
Object.defineProperty(exports, "SecureToolsRegistry", { enumerable: true, get: function () { return secure_tools_registry_1.SecureToolsRegistry; } });
Object.defineProperty(exports, "secureTools", { enumerable: true, get: function () { return secure_tools_registry_1.secureTools; } });
// Export migration utilities
var migration_to_secure_tools_1 = require("./migration-to-secure-tools");
Object.defineProperty(exports, "ToolsMigration", { enumerable: true, get: function () { return migration_to_secure_tools_1.ToolsMigration; } });
Object.defineProperty(exports, "createSecureToolsManager", { enumerable: true, get: function () { return migration_to_secure_tools_1.createSecureToolsManager; } });
Object.defineProperty(exports, "toolsManager", { enumerable: true, get: function () { return migration_to_secure_tools_1.toolsManager; } }); // deprecated, for backward compatibility
// Legacy ToolsManager (deprecated)
var tools_manager_1 = require("./tools-manager");
Object.defineProperty(exports, "ToolsManager", { enumerable: true, get: function () { return tools_manager_1.ToolsManager; } });
/**
 * Initialize secure tools and show security banner
 */
function initializeSecureTools(workingDir) {
    console.log(chalk_1.default.green.bold('\n🔒 Secure Tools Initialized'));
    console.log(chalk_1.default.gray('─'.repeat(50)));
    console.log(chalk_1.default.green('✅ Path sanitization enabled'));
    console.log(chalk_1.default.green('✅ User confirmation for write operations'));
    console.log(chalk_1.default.green('✅ Command allow-listing active'));
    console.log(chalk_1.default.green('✅ Execution tracking enabled'));
    console.log(chalk_1.default.yellow('⚠️  Legacy ToolsManager deprecated'));
    console.log(chalk_1.default.blue('💡 Use secureTools.* methods for all operations'));
    if (workingDir) {
        console.log(chalk_1.default.gray(`📁 Working directory: ${workingDir}`));
    }
    console.log(chalk_1.default.gray('─'.repeat(50)));
}
/**
 * Show security guidelines
 */
function showSecurityGuidelines() {
    console.log(chalk_1.default.blue.bold('\n🛡️  Security Guidelines'));
    console.log(chalk_1.default.gray('─'.repeat(50)));
    console.log(chalk_1.default.white('1. Always use secureTools.* methods'));
    console.log(chalk_1.default.white('2. Confirm all write operations'));
    console.log(chalk_1.default.white('3. Review command execution plans'));
    console.log(chalk_1.default.white('4. Use path validation for file operations'));
    console.log(chalk_1.default.white('5. Monitor execution history for anomalies'));
    console.log(chalk_1.default.gray('─'.repeat(50)));
}
// Show deprecation warning if legacy tools are imported
if (process.env.NODE_ENV !== 'test') {
    console.log(chalk_1.default.yellow('\n⚠️  Tools Module Loaded'));
    console.log(chalk_1.default.gray('Legacy ToolsManager is deprecated. Use secureTools instead.'));
}
