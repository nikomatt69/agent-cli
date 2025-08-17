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
exports.VMKeyboardControls = void 0;
const events_1 = require("events");
const readline = __importStar(require("readline"));
const chalk_1 = __importDefault(require("chalk"));
const vm_status_indicator_1 = require("./vm-status-indicator");
const cli_ui_1 = require("../utils/cli-ui");
class VMKeyboardControls extends events_1.EventEmitter {
    constructor() {
        super();
        this.isActive = false;
        this.currentMode = 'normal';
        this.selectedAgentIndex = 0;
        this.currentPanel = null;
        this.panelContent = '';
        this.autoRefresh = true;
        this.refreshInterval = null;
        this.keyMappings = {
            '\u000C': 'show_logs',
            '\u000D': 'main_chat',
            '\u0013': 'security_dash',
            '\u000B': 'kill_agent',
            '\u0016': 'toggle_display',
            '\u0014': 'token_usage',
            '\u001B[11~': 'select_f1',
            '\u001B[12~': 'select_f2',
            '\u001B[13~': 'select_f3',
            '\u001B[14~': 'select_f4',
            '\u001B[15~': 'select_f5',
            '\u001B[17~': 'select_f6',
            '\u001B[18~': 'select_f7',
            '\u001B[19~': 'select_f8',
            '\u001B[20~': 'select_f9',
            '\u001B[21~': 'select_f10',
            '\u001B[23~': 'select_f11',
            '\u001B[24~': 'select_f12',
            '\u001B': 'escape',
            'q': 'quit_panel',
            'r': 'refresh_panel',
            'h': 'show_help',
            '\u001B[A': 'arrow_up',
            '\u001B[B': 'arrow_down',
            '\u001B[C': 'arrow_right',
            '\u001B[D': 'arrow_left'
        };
        this.statusIndicator = vm_status_indicator_1.VMStatusIndicator.getInstance();
        this.originalRawMode = process.stdin.isRaw || false;
        this.setupKeyboardHandling();
    }
    static getInstance() {
        if (!VMKeyboardControls.instance) {
            VMKeyboardControls.instance = new VMKeyboardControls();
        }
        return VMKeyboardControls.instance;
    }
    activate() {
        if (this.isActive)
            return;
        this.isActive = true;
        this.enableRawMode();
        cli_ui_1.CliUI.logInfo('⌨️ VM keyboard controls activated');
        this.showKeyboardHelp();
        this.emit('controls:activated');
    }
    deactivate() {
        if (!this.isActive)
            return;
        this.isActive = false;
        this.closePanels();
        this.disableRawMode();
        cli_ui_1.CliUI.logInfo('⌨️ VM keyboard controls deactivated');
        this.emit('controls:deactivated');
    }
    setupKeyboardHandling() {
        if (process.stdin.isTTY) {
            readline.emitKeypressEvents(process.stdin);
            process.stdin.on('keypress', (str, key) => {
                if (!this.isActive)
                    return;
                this.handleKeypress(str, key);
            });
        }
    }
    handleKeypress(str, key) {
        try {
            if (key && key.ctrl) {
                this.handleCtrlKeys(key);
                return;
            }
            if (str && this.keyMappings[str]) {
                this.handleCommand(this.keyMappings[str]);
                return;
            }
            if (this.currentPanel && str && this.keyMappings[str]) {
                this.handleCommand(this.keyMappings[str]);
                return;
            }
            if (this.currentPanel) {
                this.handlePanelInput(str, key);
            }
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Keyboard handler error: ${error.message}`);
        }
    }
    handleCtrlKeys(key) {
        switch (key.name) {
            case 'l':
                this.showLogsPanel();
                break;
            case 'm':
                this.returnToMainChat();
                break;
            case 's':
                this.showSecurityDashboard();
                break;
            case 'k':
                this.emergencyKillAgent();
                break;
            case 'v':
                this.toggleDisplayMode();
                break;
            case 't':
                this.showTokenUsage();
                break;
            case 'c':
                if (this.currentPanel) {
                    this.closePanels();
                }
                else {
                    this.emit('interrupt');
                }
                break;
        }
    }
    handleCommand(command) {
        switch (command) {
            case 'show_logs':
                this.showLogsPanel();
                break;
            case 'main_chat':
                this.returnToMainChat();
                break;
            case 'security_dash':
                this.showSecurityDashboard();
                break;
            case 'kill_agent':
                this.emergencyKillAgent();
                break;
            case 'toggle_display':
                this.toggleDisplayMode();
                break;
            case 'token_usage':
                this.showTokenUsage();
                break;
            case 'escape':
                this.closePanels();
                break;
            case 'quit_panel':
                this.closePanels();
                break;
            case 'refresh_panel':
                this.refreshCurrentPanel();
                break;
            case 'show_help':
                this.showKeyboardHelp();
                break;
            case 'arrow_up':
                this.navigateAgents(-1);
                break;
            case 'arrow_down':
                this.navigateAgents(1);
                break;
            default:
                if (command.startsWith('select_f')) {
                    const fNum = parseInt(command.replace('select_f', ''));
                    this.selectAgentByFunction(fNum);
                }
        }
    }
    showLogsPanel() {
        const agents = this.statusIndicator.getActiveAgents();
        if (agents.length === 0) {
            this.showMessage('No active VM agents');
            return;
        }
        const selectedAgent = agents[this.selectedAgentIndex] || agents[0];
        this.currentPanel = 'logs';
        this.panelContent = this.statusIndicator.getAgentLogsPanel(selectedAgent.agentId);
        this.displayPanel();
        this.startAutoRefresh();
        this.emit('panel:opened', { type: 'logs', agentId: selectedAgent.agentId });
    }
    returnToMainChat() {
        this.closePanels();
        this.currentMode = 'normal';
        console.clear();
        console.log(chalk_1.default.green('✅ Returned to main chat stream'));
        this.emit('mode:changed', { mode: 'normal' });
    }
    showSecurityDashboard() {
        this.currentPanel = 'security';
        this.panelContent = this.statusIndicator.getSecurityDashboard();
        this.displayPanel();
        this.startAutoRefresh();
        this.emit('panel:opened', { type: 'security' });
    }
    emergencyKillAgent() {
        const agents = this.statusIndicator.getActiveAgents();
        if (agents.length === 0) {
            this.showMessage('No active VM agents to kill');
            return;
        }
        const selectedAgent = agents[this.selectedAgentIndex] || agents[0];
        this.showConfirmation(`Emergency kill agent ${selectedAgent.agentId}?`, () => {
            this.emit('agent:emergency_kill', { agentId: selectedAgent.agentId });
            this.showMessage(`Agent ${selectedAgent.agentId} kill signal sent`);
        });
    }
    toggleDisplayMode() {
        const modes = ['compact', 'detailed', 'minimal'];
        const currentMode = this.statusIndicator['displayMode'] || 'compact';
        const currentIndex = modes.indexOf(currentMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        const nextMode = modes[nextIndex];
        this.statusIndicator.setDisplayMode(nextMode);
        this.showMessage(`Display mode: ${nextMode}`);
        this.emit('display:mode_changed', { mode: nextMode });
    }
    showTokenUsage() {
        this.currentPanel = 'tokens';
        const agents = this.statusIndicator.getActiveAgents();
        const lines = [];
        lines.push(chalk_1.default.cyan.bold('🎫 Token Usage Summary'));
        lines.push(chalk_1.default.gray('─'.repeat(60)));
        let totalUsed = 0;
        let totalBudget = 0;
        for (const agent of agents) {
            const usage = agent.tokenUsage;
            const percent = Math.round((usage.used / usage.budget) * 100);
            const color = percent > 90 ? chalk_1.default.red : percent > 70 ? chalk_1.default.yellow : chalk_1.default.green;
            lines.push(`${agent.agentId.slice(0, 12)}: ${color(`${usage.used}/${usage.budget} (${percent}%)`)}`);
            totalUsed += usage.used;
            totalBudget += usage.budget;
        }
        lines.push('');
        lines.push(chalk_1.default.white.bold('Total:'));
        const totalPercent = totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 100) : 0;
        lines.push(`${totalUsed}/${totalBudget} tokens (${totalPercent}%)`);
        this.panelContent = lines.join('\n');
        this.displayPanel();
        this.emit('panel:opened', { type: 'tokens' });
    }
    navigateAgents(direction) {
        const agents = this.statusIndicator.getActiveAgents();
        if (agents.length === 0)
            return;
        this.selectedAgentIndex = Math.max(0, Math.min(agents.length - 1, this.selectedAgentIndex + direction));
        const selectedAgent = agents[this.selectedAgentIndex];
        this.showMessage(`Selected: ${selectedAgent.agentId.slice(0, 12)}`);
        if (this.currentPanel === 'logs') {
            this.refreshCurrentPanel();
        }
    }
    selectAgentByFunction(fNum) {
        const agents = this.statusIndicator.getActiveAgents();
        const index = fNum - 1;
        if (index >= 0 && index < agents.length) {
            this.selectedAgentIndex = index;
            const selectedAgent = agents[index];
            this.showMessage(`Selected: ${selectedAgent.agentId.slice(0, 12)}`);
        }
    }
    displayPanel() {
        console.clear();
        console.log(this.panelContent);
        console.log('');
        console.log(chalk_1.default.dim('Controls: Q=quit, R=refresh, H=help, ↑↓=navigate, Esc=close'));
    }
    closePanels() {
        this.currentPanel = null;
        this.panelContent = '';
        this.stopAutoRefresh();
        this.emit('panel:closed');
    }
    refreshCurrentPanel() {
        if (!this.currentPanel)
            return;
        switch (this.currentPanel) {
            case 'logs':
                this.showLogsPanel();
                break;
            case 'security':
                this.showSecurityDashboard();
                break;
            case 'tokens':
                this.showTokenUsage();
                break;
        }
    }
    startAutoRefresh() {
        if (!this.autoRefresh)
            return;
        this.stopAutoRefresh();
        this.refreshInterval = setInterval(() => {
            this.refreshCurrentPanel();
        }, 5000);
    }
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    handlePanelInput(str, key) {
    }
    showMessage(message) {
        console.log(chalk_1.default.blue(`📢 ${message}`));
        setTimeout(() => {
            if (this.currentPanel) {
                this.displayPanel();
            }
        }, 2000);
    }
    showConfirmation(message, onConfirm) {
        console.log(chalk_1.default.yellow(`❓ ${message} [y/N]`));
        const originalHandler = process.stdin.listeners('keypress')[0];
        const confirmHandler = (str, key) => {
            if (str && str.toLowerCase() === 'y') {
                onConfirm();
            }
            process.stdin.removeListener('keypress', confirmHandler);
            if (this.currentPanel) {
                this.displayPanel();
            }
        };
        process.stdin.on('keypress', confirmHandler);
    }
    showKeyboardHelp() {
        const help = [
            chalk_1.default.cyan.bold('⌨️ VM Agent Keyboard Controls'),
            chalk_1.default.gray('─'.repeat(60)),
            '',
            chalk_1.default.white.bold('Global Controls:'),
            '  Ctrl+L    Show agent logs panel',
            '  Ctrl+M    Return to main chat',
            '  Ctrl+S    Security dashboard',
            '  Ctrl+K    Emergency kill agent',
            '  Ctrl+V    Toggle display mode',
            '  Ctrl+T    Token usage summary',
            '',
            chalk_1.default.white.bold('Panel Controls:'),
            '  Q         Quit current panel',
            '  R         Refresh panel',
            '  H         Show this help',
            '  ↑↓        Navigate agents',
            '  Esc       Close all panels',
            '',
            chalk_1.default.white.bold('Quick Selection:'),
            '  F1-F12    Select agent by number',
            '',
            chalk_1.default.gray('─'.repeat(60)),
            chalk_1.default.dim('Press any key to continue...')
        ].join('\n');
        console.log(help);
    }
    enableRawMode() {
        if (process.stdin.isTTY && !process.stdin.isRaw) {
            process.stdin.setRawMode(true);
        }
    }
    disableRawMode() {
        if (process.stdin.isTTY && process.stdin.isRaw) {
            process.stdin.setRawMode(this.originalRawMode);
        }
    }
}
exports.VMKeyboardControls = VMKeyboardControls;
