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
exports.advancedUI = exports.AdvancedCliUI = void 0;
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const ora_1 = __importDefault(require("ora"));
const cli_progress_1 = __importDefault(require("cli-progress"));
const readline = __importStar(require("readline"));
class AdvancedCliUI {
    constructor() {
        this.indicators = new Map();
        this.liveUpdates = [];
        this.spinners = new Map();
        this.progressBars = new Map();
        this.isInteractiveMode = false;
        this.theme = {
            primary: chalk_1.default.blue,
            secondary: chalk_1.default.cyan,
            success: chalk_1.default.green,
            warning: chalk_1.default.yellow,
            error: chalk_1.default.red,
            info: chalk_1.default.gray,
            muted: chalk_1.default.dim,
        };
    }
    /**
     * Start interactive mode with live updates
     */
    startInteractiveMode() {
        this.isInteractiveMode = true;
        console.clear();
        this.showHeader();
    }
    /**
     * Stop interactive mode
     */
    stopInteractiveMode() {
        this.isInteractiveMode = false;
        this.cleanup();
    }
    /**
     * Show application header
     */
    showHeader() {
        const header = (0, boxen_1.default)(`${chalk_1.default.cyanBright.bold('🤖 NikCLI')} ${chalk_1.default.gray('v0.1.2-beta')}\\n` +
            `${chalk_1.default.gray('Autonomous AI Developer Assistant')}\\n\\n` +
            `${chalk_1.default.blue('Status:')} ${this.getOverallStatus()}  ${chalk_1.default.blue('Active Tasks:')} ${this.indicators.size}\\n` +
            `${chalk_1.default.blue('Mode:')} Interactive  ${chalk_1.default.blue('Live Updates:')} Enabled`, {
            padding: 1,
            margin: { top: 0, bottom: 1, left: 0, right: 0 },
            borderStyle: 'round',
            borderColor: 'cyan',
            textAlignment: 'center',
        });
        console.log(header);
    }
    /**
     * Create a new status indicator
     */
    createIndicator(id, title, details) {
        const indicator = {
            id,
            title,
            status: 'pending',
            details,
            startTime: new Date(),
            subItems: [],
        };
        this.indicators.set(id, indicator);
        if (this.isInteractiveMode) {
            this.refreshDisplay();
        }
        else {
            this.logInfo(`📋 ${title}`, details);
        }
        return indicator;
    }
    /**
     * Update status indicator
     */
    updateIndicator(id, updates) {
        const indicator = this.indicators.get(id);
        if (!indicator)
            return;
        Object.assign(indicator, updates);
        if (updates.status === 'completed' || updates.status === 'failed') {
            indicator.endTime = new Date();
        }
        if (this.isInteractiveMode) {
            this.refreshDisplay();
        }
        else {
            this.logStatusUpdate(indicator);
        }
    }
    /**
     * Start a spinner for long-running tasks
     */
    startSpinner(id, text) {
        if (this.isInteractiveMode) {
            this.updateIndicator(id, { status: 'running' });
            return;
        }
        const spinner = (0, ora_1.default)({
            text,
            spinner: 'dots',
            color: 'cyan',
        }).start();
        this.spinners.set(id, spinner);
    }
    /**
     * Update spinner text
     */
    updateSpinner(id, text) {
        const spinner = this.spinners.get(id);
        if (spinner) {
            spinner.text = text;
        }
        this.updateIndicator(id, { details: text });
    }
    /**
     * Stop spinner with result
     */
    stopSpinner(id, success, finalText) {
        const spinner = this.spinners.get(id);
        if (spinner) {
            if (success) {
                spinner.succeed(finalText);
            }
            else {
                spinner.fail(finalText);
            }
            this.spinners.delete(id);
        }
        this.updateIndicator(id, {
            status: success ? 'completed' : 'failed',
            details: finalText,
        });
    }
    /**
     * Create progress bar
     */
    createProgressBar(id, title, total) {
        if (this.isInteractiveMode) {
            this.createIndicator(id, title);
            this.updateIndicator(id, { progress: 0 });
            return;
        }
        const progressBar = new cli_progress_1.default.SingleBar({
            format: `${chalk_1.default.cyan(title)} |${chalk_1.default.cyan('{bar}')}| {percentage}% | {value}/{total} | ETA: {eta}s`,
            barCompleteChar: '█',
            barIncompleteChar: '░',
        });
        progressBar.start(total, 0);
        this.progressBars.set(id, progressBar);
    }
    /**
     * Update progress bar
     */
    updateProgress(id, current, total) {
        const progressBar = this.progressBars.get(id);
        if (progressBar) {
            progressBar.update(current);
        }
        const progress = total ? Math.round((current / total) * 100) : current;
        this.updateIndicator(id, { progress });
    }
    /**
     * Complete progress bar
     */
    completeProgress(id, message) {
        const progressBar = this.progressBars.get(id);
        if (progressBar) {
            progressBar.stop();
            this.progressBars.delete(id);
        }
        this.updateIndicator(id, {
            status: 'completed',
            progress: 100,
            details: message,
        });
    }
    /**
     * Add live update
     */
    addLiveUpdate(update) {
        const liveUpdate = {
            ...update,
            timestamp: new Date(),
        };
        this.liveUpdates.push(liveUpdate);
        // Keep only recent updates
        if (this.liveUpdates.length > 50) {
            this.liveUpdates = this.liveUpdates.slice(-50);
        }
        if (this.isInteractiveMode) {
            this.refreshDisplay();
        }
        else {
            this.printLiveUpdate(liveUpdate);
        }
    }
    /**
     * Log different types of messages
     */
    logInfo(message, details) {
        this.addLiveUpdate({
            type: 'info',
            content: message,
            source: details,
        });
    }
    logSuccess(message, details) {
        this.addLiveUpdate({
            type: 'log',
            content: `✅ ${message}`,
            source: details,
        });
    }
    logWarning(message, details) {
        this.addLiveUpdate({
            type: 'warning',
            content: `⚠️ ${message}`,
            source: details,
        });
    }
    logError(message, details) {
        this.addLiveUpdate({
            type: 'error',
            content: `❌ ${message}`,
            source: details,
        });
    }
    /**
     * Show execution summary
     */
    showExecutionSummary() {
        const indicators = Array.from(this.indicators.values());
        const completed = indicators.filter(i => i.status === 'completed').length;
        const failed = indicators.filter(i => i.status === 'failed').length;
        const warnings = indicators.filter(i => i.status === 'warning').length;
        const summary = (0, boxen_1.default)(`${chalk_1.default.bold('Execution Summary')}\\n\\n` +
            `${chalk_1.default.green('✅ Completed:')} ${completed}\\n` +
            `${chalk_1.default.red('❌ Failed:')} ${failed}\\n` +
            `${chalk_1.default.yellow('⚠️ Warnings:')} ${warnings}\\n` +
            `${chalk_1.default.blue('📊 Total:')} ${indicators.length}\\n\\n` +
            `${chalk_1.default.gray('Overall Status:')} ${this.getOverallStatusText()}`, {
            padding: 1,
            margin: { top: 1, bottom: 1, left: 0, right: 0 },
            borderStyle: 'round',
            borderColor: failed > 0 ? 'red' : completed === indicators.length ? 'green' : 'yellow',
        });
        console.log(summary);
    }
    /**
     * Show detailed status of all indicators
     */
    showDetailedStatus() {
        console.log(chalk_1.default.blue.bold('\\n📊 Detailed Status Report'));
        console.log(chalk_1.default.gray('═'.repeat(80)));
        const indicators = Array.from(this.indicators.values());
        if (indicators.length === 0) {
            console.log(chalk_1.default.gray('No active tasks'));
            return;
        }
        indicators.forEach(indicator => {
            this.printIndicatorDetails(indicator);
        });
    }
    /**
     * Ask user for confirmation with enhanced UI
     */
    async askConfirmation(question, details, defaultValue = false) {
        const icon = defaultValue ? '✅' : '❓';
        const prompt = `${icon} ${chalk_1.default.cyan(question)}`;
        if (details) {
            console.log(chalk_1.default.gray(`   ${details}`));
        }
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            rl.question(`${prompt} ${chalk_1.default.gray(defaultValue ? '(Y/n)' : '(y/N)')}: `, (answer) => {
                rl.close();
                const normalized = answer.toLowerCase().trim();
                if (normalized === '') {
                    resolve(defaultValue);
                }
                else {
                    resolve(normalized.startsWith('y'));
                }
            });
        });
    }
    /**
     * Show multi-choice selection
     */
    async showSelection(title, choices, defaultIndex = 0) {
        console.log(chalk_1.default.cyan.bold(`\\n${title}`));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        choices.forEach((choice, index) => {
            const indicator = index === defaultIndex ? chalk_1.default.green('→') : ' ';
            console.log(`${indicator} ${index + 1}. ${chalk_1.default.bold(choice.label)}`);
            if (choice.description) {
                console.log(`   ${chalk_1.default.gray(choice.description)}`);
            }
        });
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            const prompt = `\\nSelect option (1-${choices.length}, default ${defaultIndex + 1}): `;
            rl.question(prompt, (answer) => {
                rl.close();
                let selection = defaultIndex;
                const num = parseInt(answer.trim());
                if (!isNaN(num) && num >= 1 && num <= choices.length) {
                    selection = num - 1;
                }
                console.log(chalk_1.default.green(`✓ Selected: ${choices[selection].label}`));
                resolve(choices[selection].value);
            });
        });
    }
    /**
     * Show real-time file watching
     */
    startFileWatcher(pattern) {
        const watcherId = `watch-${Date.now()}`;
        this.createIndicator(watcherId, `Watching files: ${pattern}`);
        this.updateIndicator(watcherId, { status: 'running' });
        this.logInfo(`👀 Started watching: ${pattern}`);
        return watcherId;
    }
    /**
     * Report file change
     */
    reportFileChange(watcherId, filePath, changeType) {
        const emoji = changeType === 'created' ? '📄' :
            changeType === 'modified' ? '✏️' : '🗑️';
        this.addLiveUpdate({
            type: 'info',
            content: `${emoji} ${changeType}: ${filePath}`,
            source: 'file-watcher',
        });
    }
    /**
     * Refresh display in interactive mode
     */
    refreshDisplay() {
        if (!this.isInteractiveMode)
            return;
        // Move cursor to top and clear
        process.stdout.write('\\x1B[2J\\x1B[H');
        this.showHeader();
        this.showActiveIndicators();
        this.showRecentUpdates();
    }
    /**
     * Show active indicators
     */
    showActiveIndicators() {
        const indicators = Array.from(this.indicators.values());
        if (indicators.length === 0)
            return;
        console.log(chalk_1.default.blue.bold('📊 Active Tasks:'));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        indicators.forEach(indicator => {
            this.printIndicatorLine(indicator);
        });
        console.log();
    }
    /**
     * Show recent updates
     */
    showRecentUpdates() {
        const recentUpdates = this.liveUpdates.slice(-10);
        if (recentUpdates.length === 0)
            return;
        console.log(chalk_1.default.blue.bold('📝 Recent Updates:'));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        recentUpdates.forEach(update => {
            this.printLiveUpdate(update);
        });
    }
    /**
     * Print indicator line
     */
    printIndicatorLine(indicator) {
        const statusIcon = this.getStatusIcon(indicator.status);
        const statusColor = this.getStatusColor(indicator.status);
        const duration = this.getDuration(indicator);
        let line = `${statusIcon} ${chalk_1.default.bold(indicator.title)}`;
        if (indicator.progress !== undefined) {
            const progressBar = this.createProgressBarString(indicator.progress);
            line += ` ${progressBar}`;
        }
        if (duration) {
            line += ` ${chalk_1.default.gray(`(${duration})`)}`;
        }
        console.log(line);
        if (indicator.details) {
            console.log(`   ${chalk_1.default.gray(indicator.details)}`);
        }
    }
    /**
     * Print indicator details
     */
    printIndicatorDetails(indicator) {
        const statusIcon = this.getStatusIcon(indicator.status);
        const statusColor = this.getStatusColor(indicator.status);
        const duration = this.getDuration(indicator);
        console.log(`\\n${statusIcon} ${chalk_1.default.bold(indicator.title)}`);
        console.log(`   Status: ${statusColor(indicator.status.toUpperCase())}`);
        if (indicator.details) {
            console.log(`   Details: ${indicator.details}`);
        }
        if (indicator.progress !== undefined) {
            console.log(`   Progress: ${indicator.progress}%`);
        }
        if (duration) {
            console.log(`   Duration: ${duration}`);
        }
        if (indicator.subItems && indicator.subItems.length > 0) {
            console.log(`   Sub-tasks: ${indicator.subItems.length}`);
            indicator.subItems.forEach(subItem => {
                const subIcon = this.getStatusIcon(subItem.status);
                console.log(`     ${subIcon} ${subItem.title}`);
            });
        }
    }
    /**
     * Print live update
     */
    printLiveUpdate(update) {
        const timeStr = update.timestamp.toLocaleTimeString();
        const typeColor = this.getUpdateTypeColor(update.type);
        const sourceStr = update.source ? chalk_1.default.gray(`[${update.source}]`) : '';
        const line = `${chalk_1.default.gray(timeStr)} ${sourceStr} ${typeColor(update.content)}`;
        console.log(line);
    }
    /**
     * Log status update in non-interactive mode
     */
    logStatusUpdate(indicator) {
        const statusIcon = this.getStatusIcon(indicator.status);
        const statusColor = this.getStatusColor(indicator.status);
        console.log(`${statusIcon} ${statusColor(indicator.title)}`);
        if (indicator.details) {
            console.log(`   ${chalk_1.default.gray(indicator.details)}`);
        }
    }
    /**
     * Utility methods
     */
    getStatusIcon(status) {
        switch (status) {
            case 'pending': return '⏳';
            case 'running': return '🔄';
            case 'completed': return '✅';
            case 'failed': return '❌';
            case 'warning': return '⚠️';
            default: return '📋';
        }
    }
    getStatusColor(status) {
        switch (status) {
            case 'pending': return chalk_1.default.gray;
            case 'running': return chalk_1.default.blue;
            case 'completed': return chalk_1.default.green;
            case 'failed': return chalk_1.default.red;
            case 'warning': return chalk_1.default.yellow;
            default: return chalk_1.default.gray;
        }
    }
    getUpdateTypeColor(type) {
        switch (type) {
            case 'error': return chalk_1.default.red;
            case 'warning': return chalk_1.default.yellow;
            case 'info': return chalk_1.default.blue;
            case 'log': return chalk_1.default.green;
            default: return chalk_1.default.white;
        }
    }
    createProgressBarString(progress, width = 20) {
        const filled = Math.round((progress / 100) * width);
        const empty = width - filled;
        const bar = chalk_1.default.cyan('█'.repeat(filled)) + chalk_1.default.gray('░'.repeat(empty));
        return `[${bar}] ${progress}%`;
    }
    getDuration(indicator) {
        if (!indicator.startTime)
            return null;
        const endTime = indicator.endTime || new Date();
        const duration = endTime.getTime() - indicator.startTime.getTime();
        const seconds = Math.round(duration / 1000);
        if (seconds < 60) {
            return `${seconds}s`;
        }
        else {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        }
    }
    getOverallStatus() {
        const indicators = Array.from(this.indicators.values());
        if (indicators.length === 0)
            return chalk_1.default.gray('Idle');
        const hasRunning = indicators.some(i => i.status === 'running');
        const hasFailed = indicators.some(i => i.status === 'failed');
        const hasWarning = indicators.some(i => i.status === 'warning');
        if (hasRunning)
            return chalk_1.default.blue('Running');
        if (hasFailed)
            return chalk_1.default.red('Failed');
        if (hasWarning)
            return chalk_1.default.yellow('Warning');
        return chalk_1.default.green('Ready');
    }
    getOverallStatusText() {
        const indicators = Array.from(this.indicators.values());
        if (indicators.length === 0)
            return chalk_1.default.gray('No tasks');
        const completed = indicators.filter(i => i.status === 'completed').length;
        const failed = indicators.filter(i => i.status === 'failed').length;
        if (failed > 0) {
            return chalk_1.default.red('Some tasks failed');
        }
        else if (completed === indicators.length) {
            return chalk_1.default.green('All tasks completed successfully');
        }
        else {
            return chalk_1.default.blue('Tasks in progress');
        }
    }
    /**
     * Cleanup resources
     */
    cleanup() {
        // Stop all spinners
        this.spinners.forEach(spinner => spinner.stop());
        this.spinners.clear();
        // Stop all progress bars
        this.progressBars.forEach(bar => bar.stop());
        this.progressBars.clear();
    }
}
exports.AdvancedCliUI = AdvancedCliUI;
// Export singleton instance
exports.advancedUI = new AdvancedCliUI();
