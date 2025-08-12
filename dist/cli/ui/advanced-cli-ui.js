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
const cli_highlight_1 = require("cli-highlight");
const path = __importStar(require("path"));
class AdvancedCliUI {
    constructor() {
        this.indicators = new Map();
        this.liveUpdates = [];
        this.spinners = new Map();
        this.progressBars = new Map();
        this.isInteractiveMode = false;
        this.panels = new Map();
        this.layoutMode = 'dual';
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
        this.isInteractiveMode = false; // Keep disabled to avoid panels
        // Don't clear console
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
        const header = (0, boxen_1.default)(`${chalk_1.default.cyanBright.bold('🤖 NikCLI')} ${chalk_1.default.gray('v0.1.3-beta')}\n` +
            `${chalk_1.default.gray('Autonomous AI Developer Assistant')}\n\n` +
            `${chalk_1.default.blue('Status:')} ${this.getOverallStatus()}  ${chalk_1.default.blue('Active Tasks:')} ${this.indicators.size}\n` +
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
     * Ask user for confirmation (non-blocking in chat mode)
     */
    async askConfirmation(question, details, defaultValue = false) {
        // In chat mode, just return default to avoid blocking
        // Log the question for user awareness but don't block execution
        const icon = defaultValue ? '✅' : '❓';
        console.log(`${icon} ${chalk_1.default.cyan(question)} ${chalk_1.default.gray('(auto-approved)')}`);
        if (details) {
            console.log(chalk_1.default.gray(`   ${details}`));
        }
        // Auto-approve to prevent blocking in chat mode
        return defaultValue;
    }
    /**
     * Show multi-choice selection (simple readline, no panels)
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
            const prompt = `\nSelect option (1-${choices.length}, default ${defaultIndex + 1}): `;
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
        process.stdout.write('\x1B[2J\x1B[H');
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
     * Show file diff in structured panel
     */
    showFileDiff(filePath, oldContent, newContent) {
        const diffContent = this.generateDiffContent(oldContent, newContent);
        this.panels.set('diff', {
            id: 'diff',
            title: `📝 ${path.basename(filePath)}`,
            content: diffContent,
            type: 'diff',
            filePath,
            visible: true,
            borderColor: 'yellow'
        });
        this.autoLayout();
    }
    /**
     * Show Todos panel with real items
     */
    showTodos(todos, title = 'Update Todos') {
        const lines = [];
        for (const t of todos) {
            const text = (t.title || t.content || '').trim();
            if (!text)
                continue;
            const icon = t.status === 'completed' ? '☑' : t.status === 'in_progress' ? '⚡' : '☐';
            const styled = t.status === 'completed' ? this.theme.success.strikethrough(text) : this.theme.info(text);
            lines.push(`${icon} ${styled}`);
        }
        const content = lines.join('\n');
        this.panels.set('todos', {
            id: 'todos',
            title: `📝 ${title}`,
            content,
            type: 'todos',
            visible: true,
            borderColor: 'yellow',
        });
        this.autoLayout();
    }
    /**
     * Parse a markdown Todo file (todo.md) and render as Todos panel
     */
    showTodosFromMarkdown(markdown, title = 'Todo Plan') {
        try {
            const items = [];
            const lines = markdown.split(/\r?\n/);
            let inTodos = false;
            let currentTitle = null;
            let currentStatus = undefined;
            const flush = () => {
                if (currentTitle) {
                    items.push({ content: currentTitle.trim(), status: currentStatus });
                }
                currentTitle = null;
                currentStatus = undefined;
            };
            for (const raw of lines) {
                const line = raw.trim();
                if (line.startsWith('## ')) {
                    const isTodoHeader = /#+\s*Todo Items/i.test(line);
                    if (!inTodos && isTodoHeader) {
                        inTodos = true;
                        continue;
                    }
                    if (inTodos && !isTodoHeader) {
                        // end of todo section
                        break;
                    }
                }
                if (!inTodos)
                    continue;
                const mTitle = line.match(/^###\s*\d+\.\s*(.+)$/);
                if (mTitle) {
                    flush();
                    currentTitle = mTitle[1];
                    continue;
                }
                const mStatus = line.match(/^Status:\s*(.+)$/i);
                if (mStatus) {
                    const s = mStatus[1].toLowerCase();
                    if (s.includes('complete') || s.includes('done') || s.includes('✅'))
                        currentStatus = 'completed';
                    else if (s.includes('progress'))
                        currentStatus = 'in_progress';
                    else if (s.includes('pending') || s.includes('todo'))
                        currentStatus = 'pending';
                    else
                        currentStatus = undefined;
                    continue;
                }
            }
            flush();
            if (items.length > 0) {
                this.showTodos(items, title);
            }
            else {
                this.showFileContent('todo.md', markdown);
            }
        }
        catch {
            this.showFileContent('todo.md', markdown);
        }
    }
    /**
     * Show file content with syntax highlighting
     */
    showFileContent(filePath, content, highlightLines) {
        const language = this.detectLanguage(filePath);
        const formattedContent = this.formatCodeContent(content, language, highlightLines);
        this.panels.set('file', {
            id: 'file',
            title: `📄 ${path.basename(filePath)}`,
            content: formattedContent,
            type: 'file',
            language,
            filePath,
            visible: true,
            borderColor: 'green'
        });
        this.showCodingLayout();
    }
    /**
     * Show file list (grep/find results)
     */
    showFileList(files, title = '📁 Files') {
        const listContent = files.map((file, index) => {
            const icon = this.getFileIcon(path.extname(file));
            return `${icon} ${file}`;
        }).join('\n');
        this.panels.set('list', {
            id: 'list',
            title,
            content: listContent,
            type: 'list',
            visible: true,
            borderColor: 'magenta'
        });
        this.autoLayout();
    }
    /**
     * Show coding layout (file content + status)
     */
    showCodingLayout() {
        this.hidePanel('diff');
        this.hidePanel('list');
        this.layoutMode = 'single';
        this.renderStructuredLayout();
    }
    /**
     * Show diff layout (diff + status)
     */
    showDiffLayout() {
        this.hidePanel('file');
        this.hidePanel('list');
        this.layoutMode = 'dual';
        this.renderStructuredLayout();
    }
    /**
     * Show search layout (list + file + status)
     */
    showSearchLayout() {
        this.layoutMode = 'triple';
        this.renderStructuredLayout();
    }
    /**
     * Auto-layout based on current visible panels
     */
    autoLayout() {
        const visiblePanels = Array.from(this.panels.values()).filter(p => p.visible);
        if (visiblePanels.length <= 1) {
            this.layoutMode = 'single';
        }
        else if (visiblePanels.length === 2) {
            this.layoutMode = 'dual';
        }
        else {
            this.layoutMode = 'triple';
        }
        this.renderStructuredLayout();
    }
    /**
     * Show grep results in structured format
     */
    showGrepResults(pattern, matches) {
        const grepContent = matches.map(match => {
            const fileName = chalk_1.default.blue(match.file || match.filePath);
            const lineNum = chalk_1.default.yellow(`${match.lineNumber || match.line}`);
            const line = (match.content || match.match || '').replace(new RegExp(pattern, 'gi'), chalk_1.default.bgYellow.black('$&'));
            return `${fileName}:${lineNum}: ${line}`;
        }).join('\n');
        this.panels.set('list', {
            id: 'list',
            title: `🔍 Grep: ${pattern}`,
            content: grepContent,
            type: 'list',
            visible: true,
            borderColor: 'cyan'
        });
        this.showSearchLayout();
    }
    /**
     * Hide panel
     */
    hidePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            panel.visible = false;
            this.adjustLayout();
        }
    }
    /**
     * Clear all panels
     */
    clearPanels() {
        this.panels.clear();
        this.layoutMode = 'single';
    }
    /**
     * Show persistent todos (disabled in simple mode)
     */
    /**
     * Render structured layout with panels
     */
    renderStructuredLayout() {
        if (!this.isInteractiveMode) {
            this.renderSimpleLayout();
            return;
        }
        console.clear();
        this.showHeader();
        const visiblePanels = Array.from(this.panels.values()).filter(p => p.visible);
        if (visiblePanels.length === 0) {
            this.showActiveIndicators();
            return;
        }
        // Promote layout based on visible panel count
        if (visiblePanels.length >= 3) {
            this.renderTripleLayout(visiblePanels);
            return;
        }
        if (this.layoutMode === 'single' || visiblePanels.length === 1) {
            this.renderSinglePanel(visiblePanels[0]);
        }
        else if (this.layoutMode === 'dual' || visiblePanels.length === 2) {
            this.renderDualLayout(visiblePanels);
        }
        else {
            this.renderTripleLayout(visiblePanels);
        }
        this.showActiveIndicators();
    }
    renderSimpleLayout() {
        const visiblePanels = Array.from(this.panels.values()).filter(p => p.visible);
        visiblePanels.forEach(panel => {
            console.log((0, boxen_1.default)(this.formatPanelContent(panel), {
                title: panel.title,
                titleAlignment: 'left',
                padding: 1,
                borderStyle: 'round',
                borderColor: panel.borderColor || 'white'
            }));
        });
    }
    renderSinglePanel(panel) {
        const terminalWidth = process.stdout.columns || 80;
        console.log((0, boxen_1.default)(this.formatPanelContent(panel), {
            title: panel.title,
            titleAlignment: 'left',
            padding: 1,
            borderStyle: 'round',
            borderColor: panel.borderColor || 'white',
            width: Math.min(terminalWidth - 4, 120)
        }));
    }
    renderDualLayout(panels) {
        const terminalWidth = process.stdout.columns || 80;
        const panelWidth = Math.floor((terminalWidth - 6) / 2);
        panels.slice(0, 2).forEach(panel => {
            console.log((0, boxen_1.default)(this.formatPanelContent(panel), {
                title: panel.title,
                titleAlignment: 'left',
                padding: 1,
                borderStyle: 'round',
                borderColor: panel.borderColor || 'white',
                width: Math.max(panelWidth, 30),
                margin: { left: 1, right: 1 }
            }));
        });
    }
    renderTripleLayout(panels) {
        const terminalWidth = process.stdout.columns || 80;
        const panelWidth = Math.floor((terminalWidth - 8) / 3);
        panels.slice(0, 3).forEach(panel => {
            console.log((0, boxen_1.default)(this.formatPanelContent(panel), {
                title: panel.title,
                titleAlignment: 'left',
                padding: 1,
                borderStyle: 'round',
                borderColor: panel.borderColor || 'white',
                width: Math.max(panelWidth, 25),
                margin: { left: 1, right: 1 }
            }));
        });
    }
    formatPanelContent(panel) {
        switch (panel.type) {
            case 'diff':
                return this.formatDiffContent(panel.content);
            case 'file':
                return panel.content; // Already formatted in showFileContent
            case 'list':
                return this.formatListContent(panel.content);
            default:
                return panel.content;
        }
    }
    formatDiffContent(content) {
        return content.split('\n').map(line => {
            if (line.startsWith('+')) {
                return chalk_1.default.green(line);
            }
            else if (line.startsWith('-')) {
                return chalk_1.default.red(line);
            }
            else if (line.startsWith('@@')) {
                return chalk_1.default.cyan(line);
            }
            else {
                return chalk_1.default.gray(line);
            }
        }).join('\n');
    }
    formatCodeContent(content, language, highlightLines) {
        try {
            let formatted = language ? (0, cli_highlight_1.highlight)(content, { language }) : content;
            if (highlightLines && highlightLines.length > 0) {
                const lines = formatted.split('\n');
                formatted = lines.map((line, index) => {
                    const lineNum = (index + 1).toString().padStart(4, ' ');
                    const isHighlighted = highlightLines.includes(index + 1);
                    if (isHighlighted) {
                        return chalk_1.default.bgYellow.black(`${lineNum}`) + ` ${line}`;
                    }
                    else {
                        return chalk_1.default.gray(`${lineNum}`) + ` ${line}`;
                    }
                }).join('\n');
            }
            return formatted;
        }
        catch (error) {
            return content;
        }
    }
    formatListContent(content) {
        return content.split('\n').map(line => {
            if (line.trim()) {
                return line.startsWith('•') ? line : `${chalk_1.default.blue('•')} ${line}`;
            }
            return line;
        }).join('\n');
    }
    generateDiffContent(oldContent, newContent) {
        const lines1 = oldContent.split('\n');
        const lines2 = newContent.split('\n');
        let diff = '';
        const maxLines = Math.max(lines1.length, lines2.length);
        for (let i = 0; i < maxLines; i++) {
            const line1 = lines1[i] || '';
            const line2 = lines2[i] || '';
            if (line1 !== line2) {
                if (line1)
                    diff += `-${line1}\n`;
                if (line2)
                    diff += `+${line2}\n`;
            }
            else if (line1) {
                diff += ` ${line1}\n`;
            }
        }
        return diff;
    }
    detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const basename = path.basename(filePath).toLowerCase();
        // Special filenames
        if (basename === 'dockerfile')
            return 'dockerfile';
        if (basename === 'makefile')
            return 'makefile';
        if (basename === 'rakefile')
            return 'ruby';
        if (basename === 'gemfile')
            return 'ruby';
        if (basename === 'package.json')
            return 'json';
        if (basename === 'composer.json')
            return 'json';
        if (basename === 'tsconfig.json')
            return 'json';
        if (basename.endsWith('.config.js'))
            return 'javascript';
        if (basename.endsWith('.config.ts'))
            return 'typescript';
        const languageMap = {
            // JavaScript family
            '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
            '.ts': 'typescript', '.tsx': 'typescript', '.mts': 'typescript', '.cts': 'typescript',
            '.vue': 'vue', '.svelte': 'svelte',
            // Web technologies
            '.html': 'html', '.htm': 'html', '.xhtml': 'html',
            '.css': 'css', '.scss': 'scss', '.sass': 'sass', '.less': 'less', '.styl': 'stylus',
            // Backend languages
            '.py': 'python', '.pyx': 'python', '.pyi': 'python', '.pyw': 'python',
            '.java': 'java', '.scala': 'scala', '.kt': 'kotlin', '.kts': 'kotlin',
            '.rb': 'ruby', '.rbx': 'ruby', '.gemspec': 'ruby',
            '.php': 'php', '.phtml': 'php', '.php3': 'php', '.php4': 'php', '.php5': 'php',
            '.go': 'go', '.rs': 'rust', '.swift': 'swift',
            '.cs': 'csharp', '.vb': 'vbnet', '.fs': 'fsharp',
            // Systems programming
            '.c': 'c', '.h': 'c',
            '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp', '.hxx': 'cpp',
            '.m': 'objectivec', '.mm': 'objectivec',
            // Shell and scripting
            '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash', '.fish': 'bash',
            '.ps1': 'powershell', '.psm1': 'powershell',
            '.bat': 'batch', '.cmd': 'batch',
            // Data formats
            '.json': 'json', '.jsonc': 'json', '.json5': 'json',
            '.xml': 'xml', '.xsd': 'xml', '.xsl': 'xml',
            '.yaml': 'yaml', '.yml': 'yaml',
            '.toml': 'toml', '.ini': 'ini', '.conf': 'ini', '.cfg': 'ini',
            '.env': 'bash', '.properties': 'properties',
            // Documentation
            '.md': 'markdown', '.markdown': 'markdown', '.mdown': 'markdown',
            '.rst': 'rst', '.tex': 'latex',
            // Database
            '.sql': 'sql', '.mysql': 'sql', '.pgsql': 'sql', '.sqlite': 'sql',
            // Other languages
            '.r': 'r', '.R': 'r', '.rmd': 'r',
            '.lua': 'lua', '.pl': 'perl', '.pm': 'perl',
            '.dart': 'dart', '.elm': 'elm', '.ex': 'elixir', '.exs': 'elixir',
            '.clj': 'clojure', '.cljs': 'clojure', '.cljc': 'clojure',
            '.hs': 'haskell', '.lhs': 'haskell',
            '.ml': 'ocaml', '.mli': 'ocaml',
            '.jl': 'julia',
            // Config and DevOps
            '.dockerfile': 'dockerfile',
            '.dockerignore': 'gitignore',
            '.gitignore': 'gitignore',
            '.gitattributes': 'gitattributes',
            '.editorconfig': 'editorconfig',
            '.prettierrc': 'json',
            '.eslintrc': 'json',
            // Templates
            '.hbs': 'handlebars', '.handlebars': 'handlebars',
            '.mustache': 'mustache',
            '.jinja': 'jinja2', '.j2': 'jinja2',
            '.ejs': 'ejs', '.erb': 'erb'
        };
        return languageMap[ext] || 'text';
    }
    getFileIcon(ext) {
        const iconMap = {
            // JavaScript ecosystem
            '.js': '📄', '.jsx': '⚛️', '.ts': '📘', '.tsx': '⚛️',
            '.vue': '💚', '.svelte': '🧡', '.mjs': '📄', '.cjs': '📄',
            // Web technologies
            '.html': '🌐', '.htm': '🌐', '.css': '🎨', '.scss': '🎨', '.sass': '🎨', '.less': '🎨',
            // Backend languages
            '.py': '🐍', '.java': '☕', '.scala': '🔴', '.kt': '🟣',
            '.rb': '💎', '.php': '🐘', '.go': '🐹', '.rs': '🦀', '.swift': '🦉',
            '.cs': '🔷', '.vb': '🔵', '.fs': '🔸',
            // Systems programming
            '.c': '⚙️', '.h': '⚙️', '.cpp': '⚙️', '.hpp': '⚙️',
            '.m': '🍎', '.mm': '🍎',
            // Shell and config
            '.sh': '📜', '.bash': '📜', '.zsh': '📜', '.fish': '🐠',
            '.ps1': '💙', '.bat': '⚫', '.cmd': '⚫',
            // Data formats
            '.json': '📋', '.xml': '📄', '.yaml': '⚙️', '.yml': '⚙️',
            '.toml': '📝', '.ini': '⚙️', '.env': '🔑',
            // Documentation
            '.md': '📝', '.rst': '📄', '.tex': '📄',
            // Database
            '.sql': '🗃️',
            // Other languages
            '.r': '📊', '.lua': '🌙', '.pl': '🐪', '.dart': '🎯',
            '.elm': '🌳', '.ex': '💧', '.clj': '🔵', '.hs': '🎩',
            '.ml': '🐪', '.jl': '🟢',
            // DevOps
            '.dockerfile': '🐳', '.dockerignore': '🐳',
            '.gitignore': '📋', '.gitattributes': '📋',
            // Templates
            '.hbs': '🔧', '.mustache': '👨', '.ejs': '📄', '.erb': '💎'
        };
        return iconMap[ext.toLowerCase()] || '📄';
    }
    adjustLayout() {
        const visiblePanels = Array.from(this.panels.values()).filter(p => p.visible);
        if (visiblePanels.length <= 1) {
            this.layoutMode = 'single';
        }
        else if (visiblePanels.length === 2) {
            this.layoutMode = 'dual';
        }
        else {
            this.layoutMode = 'triple';
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
        // Clear panels
        this.panels.clear();
    }
}
exports.AdvancedCliUI = AdvancedCliUI;
// Export singleton instance
exports.advancedUI = new AdvancedCliUI();
