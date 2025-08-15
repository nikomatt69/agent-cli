"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
const base_tool_1 = require("./base-tool");
const find_files_tool_1 = require("./find-files-tool");
const read_file_tool_1 = require("./read-file-tool");
const write_file_tool_1 = require("./write-file-tool");
const replace_in_file_tool_1 = require("./replace-in-file-tool");
const run_command_tool_1 = require("./run-command-tool");
const cli_ui_1 = require("../utils/cli-ui");
class ToolRegistry {
    constructor(workingDirectory) {
        this.tools = new Map();
        this.toolMetadata = new Map();
        this.workingDirectory = workingDirectory;
        this.initializeDefaultTools(workingDirectory);
    }
    getWorkingDirectory() {
        return this.workingDirectory;
    }
    registerTool(name, tool, metadata) {
        if (this.tools.has(name)) {
            cli_ui_1.CliUI.logWarning(`Tool ${name} is already registered. Overwriting...`);
        }
        this.tools.set(name, tool);
        this.toolMetadata.set(name, {
            name,
            description: metadata?.description || `${name} tool`,
            category: metadata?.category || 'general',
            riskLevel: metadata?.riskLevel || 'medium',
            reversible: metadata?.reversible ?? true,
            estimatedDuration: metadata?.estimatedDuration || 5000,
            requiredPermissions: metadata?.requiredPermissions || [],
            supportedFileTypes: metadata?.supportedFileTypes || [],
            version: metadata?.version || '1.0.0',
            author: metadata?.author || 'system',
            tags: metadata?.tags || []
        });
        cli_ui_1.CliUI.logInfo(`Registered tool: ${cli_ui_1.CliUI.highlight(name)}`);
    }
    getTool(name) {
        return this.tools.get(name);
    }
    getToolMetadata(name) {
        return this.toolMetadata.get(name);
    }
    listTools() {
        return Array.from(this.tools.keys());
    }
    listToolsByCategory(category) {
        return Array.from(this.toolMetadata.entries())
            .filter(([_, metadata]) => metadata.category === category)
            .map(([name, _]) => name);
    }
    listToolsByRiskLevel(riskLevel) {
        return Array.from(this.toolMetadata.entries())
            .filter(([_, metadata]) => metadata.riskLevel === riskLevel)
            .map(([name, _]) => name);
    }
    searchToolsByTags(tags) {
        return Array.from(this.toolMetadata.entries())
            .filter(([_, metadata]) => tags.some(tag => metadata.tags.includes(tag)))
            .map(([name, _]) => name);
    }
    getToolsForFileType(fileType) {
        return Array.from(this.toolMetadata.entries())
            .filter(([_, metadata]) => metadata.supportedFileTypes.includes(fileType) ||
            metadata.supportedFileTypes.includes('*'))
            .map(([name, _]) => name);
    }
    validateTool(name, requiredPermissions = []) {
        const tool = this.tools.get(name);
        const metadata = this.toolMetadata.get(name);
        if (!tool || !metadata) {
            return {
                isValid: false,
                errors: [`Tool '${name}' not found`],
                warnings: []
            };
        }
        const errors = [];
        const warnings = [];
        const missingPermissions = metadata.requiredPermissions.filter(perm => !requiredPermissions.includes(perm));
        if (missingPermissions.length > 0) {
            errors.push(`Missing required permissions: ${missingPermissions.join(', ')}`);
        }
        if (metadata.riskLevel === 'high') {
            warnings.push('This tool performs high-risk operations');
        }
        if (!metadata.reversible) {
            warnings.push('This tool performs irreversible operations');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    getToolStats() {
        const totalTools = this.tools.size;
        const categories = new Set(Array.from(this.toolMetadata.values()).map(m => m.category));
        const riskDistribution = Array.from(this.toolMetadata.values())
            .reduce((acc, metadata) => {
            acc[metadata.riskLevel] = (acc[metadata.riskLevel] || 0) + 1;
            return acc;
        }, {});
        return {
            totalTools,
            categories: Array.from(categories),
            riskDistribution,
            reversibleTools: Array.from(this.toolMetadata.values())
                .filter(m => m.reversible).length,
            averageEstimatedDuration: Array.from(this.toolMetadata.values())
                .reduce((sum, m) => sum + m.estimatedDuration, 0) / totalTools
        };
    }
    exportConfig() {
        return {
            tools: Array.from(this.toolMetadata.values()),
            exportedAt: new Date(),
            version: '1.0.0'
        };
    }
    importConfig(config) {
        cli_ui_1.CliUI.logInfo(`Import config with ${config.tools.length} tools (not implemented)`);
    }
    displayRegistry() {
        cli_ui_1.CliUI.logSection('Tool Registry');
        const stats = this.getToolStats();
        cli_ui_1.CliUI.logKeyValue('Total Tools', stats.totalTools.toString());
        cli_ui_1.CliUI.logKeyValue('Categories', stats.categories.join(', '));
        cli_ui_1.CliUI.logKeyValue('Reversible Tools', stats.reversibleTools.toString());
        cli_ui_1.CliUI.logSubsection('Risk Distribution');
        Object.entries(stats.riskDistribution).forEach(([risk, count]) => {
            const icon = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
            cli_ui_1.CliUI.logKeyValue(`${icon} ${risk}`, count.toString());
        });
        cli_ui_1.CliUI.logSubsection('Available Tools');
        Array.from(this.toolMetadata.entries()).forEach(([name, metadata]) => {
            const riskIcon = metadata.riskLevel === 'high' ? '🔴' :
                metadata.riskLevel === 'medium' ? '🟡' : '🟢';
            const reversibleIcon = metadata.reversible ? '↩️' : '⚠️';
            console.log(`  ${riskIcon} ${reversibleIcon} ${cli_ui_1.CliUI.bold(name)}`);
            console.log(`    ${cli_ui_1.CliUI.dim(metadata.description)}`);
            console.log(`    ${cli_ui_1.CliUI.dim(`Category: ${metadata.category} | Duration: ~${metadata.estimatedDuration}ms`)}`);
        });
    }
    initializeDefaultTools(workingDirectory) {
        this.registerTool('find-files-tool', new find_files_tool_1.FindFilesTool(workingDirectory), {
            description: 'Find files matching glob patterns',
            category: 'filesystem',
            riskLevel: 'low',
            reversible: true,
            estimatedDuration: 3000,
            requiredPermissions: ['read'],
            supportedFileTypes: ['*'],
            tags: ['search', 'filesystem', 'glob']
        });
        this.registerTool('read-file-tool', new read_file_tool_1.ReadFileTool(workingDirectory), {
            description: 'Read file contents with security validation',
            category: 'filesystem',
            riskLevel: 'low',
            reversible: true,
            estimatedDuration: 2000,
            requiredPermissions: ['read'],
            supportedFileTypes: ['*'],
            tags: ['read', 'filesystem']
        });
        this.registerTool('write-file-tool', new write_file_tool_1.WriteFileTool(workingDirectory), {
            description: 'Write files with backup and validation',
            category: 'filesystem',
            riskLevel: 'medium',
            reversible: true,
            estimatedDuration: 4000,
            requiredPermissions: ['write'],
            supportedFileTypes: ['*'],
            tags: ['write', 'filesystem', 'create']
        });
        this.registerTool('replace-in-file-tool', new replace_in_file_tool_1.ReplaceInFileTool(workingDirectory), {
            description: 'Replace content in files with validation',
            category: 'filesystem',
            riskLevel: 'medium',
            reversible: false,
            estimatedDuration: 3000,
            requiredPermissions: ['write'],
            supportedFileTypes: ['*'],
            tags: ['modify', 'filesystem', 'replace']
        });
        this.registerTool('run-command-tool', new run_command_tool_1.RunCommandTool(workingDirectory), {
            description: 'Execute commands with whitelist security',
            category: 'system',
            riskLevel: 'high',
            reversible: false,
            estimatedDuration: 5000,
            requiredPermissions: ['execute'],
            supportedFileTypes: ['*'],
            tags: ['command', 'system', 'execute']
        });
        this.registerTool('delete-file-tool', new MockTool(workingDirectory), {
            description: 'Delete files and directories',
            category: 'filesystem',
            riskLevel: 'high',
            reversible: false,
            estimatedDuration: 2000,
            requiredPermissions: ['write', 'delete'],
            supportedFileTypes: ['*'],
            tags: ['delete', 'filesystem', 'destructive']
        });
        cli_ui_1.CliUI.logInfo(`Initialized tool registry with ${this.tools.size} tools`);
    }
}
exports.ToolRegistry = ToolRegistry;
class MockTool extends base_tool_1.BaseTool {
    constructor(workingDirectory) {
        super('mock-tool', workingDirectory);
    }
    async execute(...args) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
            success: true,
            data: { args, message: 'Mock tool executed successfully' },
            metadata: {
                executionTime: 1000,
                toolName: this.getName(),
                parameters: args
            }
        };
    }
}
