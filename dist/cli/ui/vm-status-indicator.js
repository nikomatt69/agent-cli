"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VMStatusIndicator = void 0;
const chalk_1 = __importDefault(require("chalk"));
const events_1 = require("events");
const cli_ui_1 = require("../utils/cli-ui");
class VMStatusIndicator extends events_1.EventEmitter {
    constructor() {
        super();
        this.activeAgents = new Map();
        this.displayMode = 'compact';
        this.updateInterval = null;
        this.UPDATE_INTERVAL = 2000;
        this.COMPACT_MAX_AGENTS = 3;
        this.LOG_BUFFER_SIZE = 1000;
        this.startStatusUpdates();
    }
    static getInstance() {
        if (!VMStatusIndicator.instance) {
            VMStatusIndicator.instance = new VMStatusIndicator();
        }
        return VMStatusIndicator.instance;
    }
    registerAgent(agentOrId, name, status) {
        if (typeof agentOrId === 'string') {
            const agentStatus = {
                agentId: agentOrId,
                vmState: status || 'stopped',
                containerId: undefined,
                tokenUsage: { used: 0, budget: 50000, remaining: 50000 },
                startTime: new Date(),
                lastActivity: new Date(),
                logs: [],
                metrics: {
                    cpuUsage: 0,
                    memoryUsage: 0,
                    networkActivity: 0,
                    diskUsage: 0
                }
            };
            this.activeAgents.set(agentOrId, agentStatus);
            this.emit('agent_registered', agentStatus);
            return;
        }
        const agent = agentOrId;
        const agentStatus = {
            agentId: agent.id,
            vmState: agent.getVMState(),
            containerId: agent.getContainerId(),
            tokenUsage: agent.getTokenUsage(),
            vscodePort: agent.getVSCodePort(),
            startTime: new Date(),
            lastActivity: new Date(),
            logs: [],
            metrics: {
                cpuUsage: 0,
                memoryUsage: 0,
                networkActivity: 0,
                diskUsage: 0
            }
        };
        this.activeAgents.set(agent.id, agentStatus);
        cli_ui_1.CliUI.logSuccess(`📊 VM agent ${agent.id} registered for status tracking`);
        this.emit('agent:registered', { agentId: agent.id });
    }
    unregisterAgent(agentId) {
        if (this.activeAgents.has(agentId)) {
            this.activeAgents.delete(agentId);
            cli_ui_1.CliUI.logInfo(`📊 VM agent ${agentId} unregistered from status tracking`);
            this.emit('agent:unregistered', { agentId });
        }
    }
    updateAgentStatus(agentId, updates) {
        const status = this.activeAgents.get(agentId);
        if (status) {
            Object.assign(status, updates, { lastActivity: new Date() });
            this.activeAgents.set(agentId, status);
            this.emit('agent:updated', { agentId, status });
        }
    }
    addAgentLog(agentId, log) {
        const status = this.activeAgents.get(agentId);
        if (status) {
            status.logs.push(log);
            if (status.logs.length > this.LOG_BUFFER_SIZE) {
                status.logs = status.logs.slice(-this.LOG_BUFFER_SIZE / 2);
            }
            this.emit('agent:log', { agentId, log });
        }
    }
    getPromptIndicators() {
        const activeCount = this.activeAgents.size;
        if (activeCount === 0) {
            return '';
        }
        const indicators = [];
        if (activeCount === 1) {
            const agent = Array.from(this.activeAgents.values())[0];
            indicators.push(this.getSingleAgentIndicator(agent));
        }
        else {
            indicators.push(this.getMultiAgentIndicator(activeCount));
        }
        if (this.hasSecurityIssues()) {
            indicators.push(chalk_1.default.red('🔒'));
        }
        else {
            indicators.push(chalk_1.default.green('🔐'));
        }
        return indicators.join('');
    }
    getStatusPanel() {
        if (this.activeAgents.size === 0) {
            return chalk_1.default.dim('No active VM agents');
        }
        const lines = [];
        lines.push(chalk_1.default.cyan.bold(`🤖 Active VM Agents (${this.activeAgents.size})`));
        lines.push(chalk_1.default.gray('─'.repeat(60)));
        for (const [agentId, status] of this.activeAgents.entries()) {
            lines.push(this.formatAgentStatus(agentId, status));
            lines.push('');
        }
        return lines.join('\n');
    }
    getAgentLogsPanel(agentId, lines = 20) {
        const status = this.activeAgents.get(agentId);
        if (!status) {
            return chalk_1.default.red(`Agent ${agentId} not found`);
        }
        const logLines = [];
        logLines.push(chalk_1.default.cyan.bold(`📋 Logs for VM Agent: ${agentId}`));
        logLines.push(chalk_1.default.gray('─'.repeat(60)));
        const recentLogs = status.logs.slice(-lines);
        if (recentLogs.length === 0) {
            logLines.push(chalk_1.default.dim('No logs available'));
        }
        else {
            for (const log of recentLogs) {
                logLines.push(this.formatLogEntry(log));
            }
        }
        logLines.push(chalk_1.default.gray('─'.repeat(60)));
        logLines.push(chalk_1.default.dim(`Showing last ${recentLogs.length} entries`));
        return logLines.join('\n');
    }
    getSecurityDashboard() {
        const lines = [];
        lines.push(chalk_1.default.cyan.bold('🔐 VM Security Dashboard'));
        lines.push(chalk_1.default.gray('─'.repeat(60)));
        let totalTokenUsage = 0;
        let totalBudget = 0;
        let securityIssues = 0;
        for (const [agentId, status] of this.activeAgents.entries()) {
            totalTokenUsage += status.tokenUsage.used;
            totalBudget += status.tokenUsage.budget;
            const issues = this.checkAgentSecurity(status);
            if (issues.length > 0) {
                securityIssues++;
                lines.push(chalk_1.default.red(`⚠️ ${agentId}: ${issues.join(', ')}`));
            }
            else {
                lines.push(chalk_1.default.green(`✅ ${agentId}: Secure`));
            }
        }
        lines.push('');
        lines.push(chalk_1.default.white.bold('Summary:'));
        lines.push(`Total Token Usage: ${totalTokenUsage}/${totalBudget} (${Math.round((totalTokenUsage / totalBudget) * 100)}%)`);
        lines.push(`Security Issues: ${securityIssues}/${this.activeAgents.size} agents`);
        return lines.join('\n');
    }
    setDisplayMode(mode) {
        this.displayMode = mode;
        this.emit('display:mode_changed', { mode });
    }
    getActiveAgents() {
        return Array.from(this.activeAgents.values());
    }
    clearAll() {
        this.activeAgents.clear();
        this.emit('status:cleared');
    }
    getSingleAgentIndicator(agent) {
        const stateIcon = this.getStateIcon(agent.vmState);
        const usagePercent = Math.round((agent.tokenUsage.used / agent.tokenUsage.budget) * 100);
        let indicator = stateIcon;
        if (usagePercent > 90) {
            indicator = chalk_1.default.red(stateIcon);
        }
        else if (usagePercent > 70) {
            indicator = chalk_1.default.yellow(stateIcon);
        }
        else {
            indicator = chalk_1.default.green(stateIcon);
        }
        return indicator;
    }
    getMultiAgentIndicator(_count) {
        const runningAgents = Array.from(this.activeAgents.values())
            .filter(agent => agent.vmState === 'running').length;
        return chalk_1.default.blue(`${runningAgents}🤖`);
    }
    getStateIcon(state) {
        switch (state) {
            case 'running':
                return '🟢';
            case 'starting':
                return '🟡';
            case 'stopping':
                return '🟠';
            case 'stopped':
                return '⚫';
            case 'error':
                return '🔴';
            default:
                return '⚪';
        }
    }
    formatAgentStatus(agentId, status) {
        const stateIcon = this.getStateIcon(status.vmState);
        const truncatedId = agentId.slice(0, 12);
        const uptime = Math.floor((Date.now() - status.startTime.getTime()) / 1000);
        const tokenPercent = Math.round((status.tokenUsage.used / status.tokenUsage.budget) * 100);
        const lines = [];
        lines.push(`${stateIcon} ${chalk_1.default.bold(truncatedId)} ${chalk_1.default.dim(`(${status.vmState})`)} - ${this.formatUptime(uptime)}`);
        if (status.containerId) {
            lines.push(`   📦 Container: ${status.containerId.slice(0, 12)}`);
        }
        if (status.vscodePort) {
            lines.push(`   💻 VS Code: localhost:${status.vscodePort}`);
        }
        const tokenColor = tokenPercent > 90 ? chalk_1.default.red : tokenPercent > 70 ? chalk_1.default.yellow : chalk_1.default.green;
        lines.push(`   🎫 Tokens: ${tokenColor(`${status.tokenUsage.used}/${status.tokenUsage.budget} (${tokenPercent}%)`)}`);
        if (status.metrics) {
            lines.push(`   📊 CPU: ${status.metrics.cpuUsage.toFixed(1)}% | MEM: ${this.formatBytes(status.metrics.memoryUsage)}`);
        }
        return lines.join('\n');
    }
    formatLogEntry(log) {
        const timestamp = log.timestamp.toLocaleTimeString();
        const levelColor = this.getLogLevelColor(log.level);
        return `${chalk_1.default.dim(timestamp)} ${levelColor(log.level.toUpperCase().padEnd(5))} ${log.message}`;
    }
    getLogLevelColor(level) {
        switch (level) {
            case 'error':
                return chalk_1.default.red;
            case 'warn':
                return chalk_1.default.yellow;
            case 'info':
                return chalk_1.default.blue;
            case 'debug':
                return chalk_1.default.gray;
            default:
                return chalk_1.default.white;
        }
    }
    checkAgentSecurity(status) {
        const issues = [];
        const tokenPercent = (status.tokenUsage.used / status.tokenUsage.budget) * 100;
        if (tokenPercent > 95) {
            issues.push('Token budget almost exhausted');
        }
        if (status.vmState === 'error') {
            issues.push('VM in error state');
        }
        const ageHours = (Date.now() - status.startTime.getTime()) / (1000 * 60 * 60);
        if (ageHours > 24) {
            issues.push('Long-running container');
        }
        return issues;
    }
    hasSecurityIssues() {
        for (const status of this.activeAgents.values()) {
            if (this.checkAgentSecurity(status).length > 0) {
                return true;
            }
        }
        return false;
    }
    formatUptime(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        else if (seconds < 3600) {
            return `${Math.floor(seconds / 60)}m`;
        }
        else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h${minutes}m`;
        }
    }
    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)}${units[unitIndex]}`;
    }
    startStatusUpdates() {
        this.updateInterval = setInterval(() => {
            this.emit('status:update', {
                activeAgents: this.activeAgents.size,
                indicators: this.getPromptIndicators()
            });
        }, this.UPDATE_INTERVAL);
    }
    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}
exports.VMStatusIndicator = VMStatusIndicator;
