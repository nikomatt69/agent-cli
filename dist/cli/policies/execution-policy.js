"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionPolicyManager = void 0;
class ExecutionPolicyManager {
    constructor(configManager) {
        this.trustedCommands = new Set(['ls', 'cat', 'pwd']);
        this.configManager = configManager;
    }
    async getPolicy() {
        const cfg = await this.configManager.load();
        return {
            approval: cfg.approvalPolicy || 'untrusted',
            sandbox: cfg.sandbox || 'read-only'
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
        return sandbox === 'danger-full-access';
    }
}
exports.ExecutionPolicyManager = ExecutionPolicyManager;
