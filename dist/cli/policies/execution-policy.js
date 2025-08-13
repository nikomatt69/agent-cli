"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionPolicyManager = void 0;
const logger_1 = require("../utils/logger");
class ExecutionPolicyManager {
    constructor(configManager) {
        this.trustedCommands = new Set(['ls', 'cat', 'pwd', 'echo', 'which', 'whoami']);
        this.dangerousCommands = new Set(['rm -rf', 'sudo', 'su', 'chmod 777', 'dd', 'mkfs']);
        this.commandPolicies = new Map();
        this.toolPolicies = new Map();
        this.sessionApprovals = new Set();
        this.devModeExpiry = null;
        this.configManager = configManager;
        this.initializeCommandPolicies();
        this.initializeToolPolicies();
    }
    async getPolicy() {
        const cfg = this.configManager.getAll();
        return {
            approval: cfg.approvalPolicy || 'untrusted',
            sandbox: cfg.sandbox || 'workspace-write',
            timeoutMs: cfg.defaultAgentTimeout || 300000,
            maxRetries: 3
        };
    }
    async shouldAskForApproval(command, exitCode) {
        const { approval } = await this.getPolicy();
        const cmdName = command.split(/\s+/)[0];
        const isTrusted = this.trustedCommands.has(cmdName);
        if (approval === 'never')
            return false;
        if (approval === 'untrusted')
            return !isTrusted;
        if (approval === 'on-failure')
            return exitCode !== undefined && exitCode !== 0;
        return true;
    }
    async allowWorkspaceWrite() {
        const { sandbox } = await this.getPolicy();
        return sandbox === 'workspace-write' || sandbox === 'danger-full-access';
    }
    async allowGlobalWrite() {
        const { sandbox } = await this.getPolicy();
        return sandbox === 'system-write' || sandbox === 'danger-full-access';
    }
    initializeCommandPolicies() {
        const safeCommands = ['ls', 'cat', 'pwd', 'echo', 'which', 'whoami', 'date', 'env'];
        safeCommands.forEach(cmd => {
            this.commandPolicies.set(cmd, {
                command: cmd,
                allowed: true,
                requiresApproval: false,
                riskLevel: 'low',
                sandbox: ['read-only', 'workspace-write', 'system-write', 'danger-full-access']
            });
        });
        const devCommands = ['npm', 'yarn', 'git', 'node', 'tsc', 'jest'];
        devCommands.forEach(cmd => {
            this.commandPolicies.set(cmd, {
                command: cmd,
                allowed: true,
                requiresApproval: false,
                riskLevel: 'medium',
                sandbox: ['workspace-write', 'system-write', 'danger-full-access']
            });
        });
        const systemCommands = ['chmod', 'chown', 'cp', 'mv', 'mkdir', 'rmdir'];
        systemCommands.forEach(cmd => {
            this.commandPolicies.set(cmd, {
                command: cmd,
                allowed: true,
                requiresApproval: true,
                riskLevel: 'medium',
                sandbox: ['system-write', 'danger-full-access']
            });
        });
        const dangerousCommands = ['rm', 'sudo', 'su', 'dd', 'mkfs', 'fdisk'];
        dangerousCommands.forEach(cmd => {
            this.commandPolicies.set(cmd, {
                command: cmd,
                allowed: false,
                requiresApproval: true,
                riskLevel: 'high',
                sandbox: ['danger-full-access']
            });
        });
    }
    initializeToolPolicies() {
        const safePolicies = [
            { category: 'analysis', riskLevel: 'low', requiresApproval: false, allowedInSafeMode: true, description: 'Project analysis and information gathering' },
            { category: 'file', riskLevel: 'low', requiresApproval: false, allowedInSafeMode: true, description: 'Read-only file operations' },
        ];
        const safeTools = ['read_file', 'list_files', 'find_files', 'analyze_project', 'grep_search'];
        safeTools.forEach(tool => {
            this.toolPolicies.set(tool, {
                toolName: tool,
                ...safePolicies.find(p => tool.includes('file') ? p.category === 'file' : p.category === 'analysis')
            });
        });
        const riskyTools = [
            { name: 'write_file', category: 'file', description: 'Write content to files', riskyOps: ['system files', 'config files'] },
            { name: 'edit_file', category: 'file', description: 'Edit existing files', riskyOps: ['destructive edits', 'system files'] },
            { name: 'multi_edit', category: 'file', description: 'Batch file editing', riskyOps: ['multiple files', 'batch operations'] },
            { name: 'git_status', category: 'git', description: 'Git status check', riskyOps: [] },
            { name: 'git_diff', category: 'git', description: 'Git diff display', riskyOps: [] },
            { name: 'git_commit', category: 'git', description: 'Git commit operation', riskyOps: ['permanent changes', 'history modification'] },
            { name: 'git_push', category: 'git', description: 'Push to remote repository', riskyOps: ['remote changes', 'public repositories'] },
            { name: 'npm_install', category: 'package', description: 'Install npm packages', riskyOps: ['global installations', 'security vulnerabilities'] },
        ];
        riskyTools.forEach(tool => {
            this.toolPolicies.set(tool.name, {
                toolName: tool.name,
                category: tool.category,
                riskLevel: 'medium',
                requiresApproval: tool.name.includes('git_status') || tool.name.includes('git_diff') ? false : true,
                allowedInSafeMode: !tool.riskyOps.some(op => op.includes('permanent') || op.includes('destructive')),
                description: tool.description,
                riskyOperations: tool.riskyOps
            });
        });
        const dangerousTools = [
            { name: 'execute_command', category: 'system', description: 'Execute system commands', riskyOps: ['system modification', 'data loss', 'security bypass'] },
            { name: 'delete_file', category: 'file', description: 'Delete files', riskyOps: ['data loss', 'irreversible'] },
            { name: 'git_reset', category: 'git', description: 'Git reset operations', riskyOps: ['history loss', 'irreversible'] },
            { name: 'network_request', category: 'network', description: 'Make network requests', riskyOps: ['data exfiltration', 'external communication'] },
        ];
        dangerousTools.forEach(tool => {
            this.toolPolicies.set(tool.name, {
                toolName: tool.name,
                category: tool.category,
                riskLevel: 'high',
                requiresApproval: true,
                allowedInSafeMode: false,
                description: tool.description,
                riskyOperations: tool.riskyOps
            });
        });
    }
    getCommandPolicy(command) {
        const cmdName = command.split(/\s+/)[0];
        return this.commandPolicies.get(cmdName) || null;
    }
    async isCommandAllowed(command) {
        const policy = this.getCommandPolicy(command);
        const { sandbox } = await this.getPolicy();
        if (!policy) {
            switch (sandbox) {
                case 'read-only':
                    return this.trustedCommands.has(command.split(/\s+/)[0]);
                case 'workspace-write':
                case 'system-write':
                    return !this.dangerousCommands.has(command);
                case 'danger-full-access':
                    return true;
                default:
                    return false;
            }
        }
        return policy.allowed && policy.sandbox.includes(sandbox);
    }
    async evaluateCommandRisk(command) {
        const policy = this.getCommandPolicy(command);
        const { sandbox, approval } = await this.getPolicy();
        const reasons = [];
        let riskLevel = 'low';
        let requiresApproval = false;
        let allowed = true;
        if (policy) {
            riskLevel = policy.riskLevel;
            requiresApproval = policy.requiresApproval;
            allowed = policy.allowed && policy.sandbox.includes(sandbox);
            if (!policy.sandbox.includes(sandbox)) {
                reasons.push(`Command not allowed in ${sandbox} sandbox`);
                allowed = false;
            }
        }
        else {
            const cmdName = command.split(/\s+/)[0];
            if (this.dangerousCommands.has(command) || this.dangerousCommands.has(cmdName)) {
                riskLevel = 'high';
                requiresApproval = true;
                allowed = sandbox === 'danger-full-access';
                reasons.push('Command identified as dangerous');
            }
            else if (!this.trustedCommands.has(cmdName)) {
                riskLevel = 'medium';
                requiresApproval = approval === 'untrusted' || approval === 'always';
                reasons.push('Unknown command');
            }
        }
        if (approval === 'always') {
            requiresApproval = true;
            reasons.push('Always require approval policy active');
        }
        else if (approval === 'never') {
            requiresApproval = false;
        }
        return {
            riskLevel,
            reasons,
            requiresApproval,
            allowed
        };
    }
    getToolPolicy(toolName) {
        return this.toolPolicies.get(toolName) || null;
    }
    async shouldApproveToolOperation(toolName, operation, args) {
        const config = this.configManager.getAll();
        const toolPolicy = this.getToolPolicy(toolName);
        const securityMode = config.securityMode;
        const toolApprovalPolicies = config.toolApprovalPolicies;
        if (this.isDevModeActive() && toolPolicy?.riskLevel !== 'high') {
            return null;
        }
        const sessionKey = `${toolName}:${operation}`;
        if (this.sessionApprovals.has(sessionKey)) {
            return null;
        }
        if (!toolPolicy) {
            return {
                toolName,
                operation,
                args,
                riskAssessment: {
                    level: 'medium',
                    reasons: ['Unknown tool - requires approval for safety'],
                    irreversible: false
                }
            };
        }
        const riskAssessment = this.assessToolRisk(toolName, operation, args, toolPolicy);
        const categoryPolicy = this.getCategoryApprovalPolicy(toolPolicy.category, toolApprovalPolicies);
        let needsApproval = false;
        switch (categoryPolicy) {
            case 'always':
                needsApproval = true;
                break;
            case 'risky':
                needsApproval = riskAssessment.level === 'medium' || riskAssessment.level === 'high';
                break;
            case 'never':
                needsApproval = false;
                break;
        }
        if (securityMode === 'safe') {
            needsApproval = needsApproval || !toolPolicy.allowedInSafeMode;
        }
        else if (securityMode === 'developer') {
            needsApproval = needsApproval && riskAssessment.level === 'high';
        }
        return needsApproval ? {
            toolName,
            operation,
            args,
            riskAssessment
        } : null;
    }
    assessToolRisk(toolName, operation, args, policy) {
        const reasons = [];
        let level = policy.riskLevel;
        let affectedFiles = [];
        let irreversible = false;
        if (policy.category === 'file') {
            if (args.filePath || args.path) {
                const filePath = args.filePath || args.path;
                affectedFiles.push(filePath);
                if (this.isSystemFile(filePath)) {
                    level = 'high';
                    reasons.push('Affects system files');
                }
                if (this.isConfigFile(filePath)) {
                    level = 'medium';
                    reasons.push('Affects configuration files');
                }
            }
            if (toolName === 'delete_file' || operation.includes('delete')) {
                irreversible = true;
                reasons.push('Irreversible file deletion');
            }
        }
        if (policy.category === 'git') {
            if (toolName.includes('push') || toolName.includes('commit')) {
                irreversible = true;
                reasons.push('Permanent git operation');
            }
            if (args.force || operation.includes('force')) {
                level = 'high';
                reasons.push('Force operation detected');
            }
        }
        if (policy.category === 'system') {
            if (args.command) {
                const command = args.command.toLowerCase();
                if (this.dangerousCommands.has(command) || command.includes('sudo') || command.includes('rm')) {
                    level = 'high';
                    irreversible = true;
                    reasons.push('Dangerous system command');
                }
            }
        }
        return { level, reasons, affectedFiles, irreversible };
    }
    getCategoryApprovalPolicy(category, policies) {
        switch (category) {
            case 'file':
                return policies.fileOperations;
            case 'git':
                return policies.gitOperations;
            case 'package':
                return policies.packageOperations;
            case 'system':
                return policies.systemCommands;
            case 'network':
                return policies.networkRequests;
            default:
                return 'risky';
        }
    }
    isSystemFile(filePath) {
        const systemPaths = ['/etc', '/usr', '/var', '/bin', '/sbin', '/boot'];
        return systemPaths.some(path => filePath.startsWith(path));
    }
    isConfigFile(filePath) {
        const configExtensions = ['.config', '.conf', '.ini', '.env', '.json', '.yaml', '.yml'];
        const configNames = ['Dockerfile', 'Makefile', 'package.json', 'tsconfig.json'];
        return configExtensions.some(ext => filePath.endsWith(ext)) ||
            configNames.some(name => filePath.endsWith(name));
    }
    enableDevMode(timeoutMs) {
        const timeout = timeoutMs || this.configManager.getAll().sessionSettings.devModeTimeoutMs;
        this.devModeExpiry = new Date(Date.now() + timeout);
    }
    isDevModeActive() {
        if (!this.devModeExpiry)
            return false;
        return new Date() < this.devModeExpiry;
    }
    addSessionApproval(toolName, operation) {
        this.sessionApprovals.add(`${toolName}:${operation}`);
    }
    clearSessionApprovals() {
        this.sessionApprovals.clear();
    }
    async logPolicyDecision(command, decision, context = {}) {
        await logger_1.logger.audit('execution_policy_decision', {
            command,
            decision,
            timestamp: new Date().toISOString(),
            sandbox: (await this.getPolicy()).sandbox,
            approvalPolicy: (await this.getPolicy()).approval,
            ...context
        });
    }
    async getPolicySummary() {
        const policy = await this.getPolicy();
        const allowedCommands = Array.from(this.commandPolicies.values())
            .filter(p => p.allowed && p.sandbox.includes(policy.sandbox)).length;
        const deniedCommands = Array.from(this.commandPolicies.values())
            .filter(p => !p.allowed || !p.sandbox.includes(policy.sandbox)).length;
        return {
            currentPolicy: policy,
            allowedCommands,
            deniedCommands,
            trustedCommands: Array.from(this.trustedCommands),
            dangerousCommands: Array.from(this.dangerousCommands)
        };
    }
}
exports.ExecutionPolicyManager = ExecutionPolicyManager;
