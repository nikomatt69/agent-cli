import chalk from 'chalk';
import boxen from 'boxen';
import ora, { Ora } from 'ora';
import cliProgress from 'cli-progress';
import * as readline from 'readline';

export interface StatusIndicator {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'warning';
  details?: string;
  progress?: number; // 0-100
  startTime?: Date;
  endTime?: Date;
  subItems?: StatusIndicator[];
}

export interface LiveUpdate {
  type: 'status' | 'progress' | 'log' | 'error' | 'warning' | 'info';
  content: string;
  timestamp: Date;
  source?: string;
}

export interface UITheme {
  primary: any;
  secondary: any;
  success: any;
  warning: any;
  error: any;
  info: any;
  muted: any;
}

export class AdvancedCliUI {
  private indicators: Map<string, StatusIndicator> = new Map();
  private liveUpdates: LiveUpdate[] = [];
  private spinners: Map<string, Ora> = new Map();
  private progressBars: Map<string, cliProgress.SingleBar> = new Map();
  private theme: UITheme;
  private isInteractiveMode: boolean = false;

  constructor() {
    this.theme = {
      primary: chalk.blue,
      secondary: chalk.cyan,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      info: chalk.gray,
      muted: chalk.dim,
    };
  }

  /**
   * Start interactive mode with live updates
   */
  startInteractiveMode(): void {
    this.isInteractiveMode = true;
    console.clear();
    this.showHeader();
  }

  /**
   * Stop interactive mode
   */
  stopInteractiveMode(): void {
    this.isInteractiveMode = false;
    this.cleanup();
  }

  /**
   * Show application header
   */
  showHeader(): void {
    const header = boxen(
      `${chalk.cyanBright.bold('🤖 NikCLI')} ${chalk.gray('v0.1.2-beta')}\\n` +
      `${chalk.gray('Autonomous AI Developer Assistant')}\\n\\n` +
      `${chalk.blue('Status:')} ${this.getOverallStatus()}  ${chalk.blue('Active Tasks:')} ${this.indicators.size}\\n` +
      `${chalk.blue('Mode:')} Interactive  ${chalk.blue('Live Updates:')} Enabled`,
      {
        padding: 1,
        margin: { top: 0, bottom: 1, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: 'cyan',
        textAlignment: 'center',
      }
    );

    console.log(header);
  }

  /**
   * Create a new status indicator
   */
  createIndicator(id: string, title: string, details?: string): StatusIndicator {
    const indicator: StatusIndicator = {
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
    } else {
      this.logInfo(`📋 ${title}`, details);
    }

    return indicator;
  }

  /**
   * Update status indicator
   */
  updateIndicator(
    id: string,
    updates: Partial<StatusIndicator>
  ): void {
    const indicator = this.indicators.get(id);
    if (!indicator) return;

    Object.assign(indicator, updates);

    if (updates.status === 'completed' || updates.status === 'failed') {
      indicator.endTime = new Date();
    }

    if (this.isInteractiveMode) {
      this.refreshDisplay();
    } else {
      this.logStatusUpdate(indicator);
    }
  }

  /**
   * Start a spinner for long-running tasks
   */
  startSpinner(id: string, text: string): void {
    if (this.isInteractiveMode) {
      this.updateIndicator(id, { status: 'running' });
      return;
    }

    const spinner = ora({
      text,
      spinner: 'dots',
      color: 'cyan',
    }).start();

    this.spinners.set(id, spinner);
  }

  /**
   * Update spinner text
   */
  updateSpinner(id: string, text: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.text = text;
    }

    this.updateIndicator(id, { details: text });
  }

  /**
   * Stop spinner with result
   */
  stopSpinner(id: string, success: boolean, finalText?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      if (success) {
        spinner.succeed(finalText);
      } else {
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
  createProgressBar(id: string, title: string, total: number): void {
    if (this.isInteractiveMode) {
      this.createIndicator(id, title);
      this.updateIndicator(id, { progress: 0 });
      return;
    }

    const progressBar = new cliProgress.SingleBar({
      format: `${chalk.cyan(title)} |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} | ETA: {eta}s`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
    });

    progressBar.start(total, 0);
    this.progressBars.set(id, progressBar);
  }

  /**
   * Update progress bar
   */
  updateProgress(id: string, current: number, total?: number): void {
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
  completeProgress(id: string, message?: string): void {
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
  addLiveUpdate(update: Omit<LiveUpdate, 'timestamp'>): void {
    const liveUpdate: LiveUpdate = {
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
    } else {
      this.printLiveUpdate(liveUpdate);
    }
  }

  /**
   * Log different types of messages
   */
  logInfo(message: string, details?: string): void {
    this.addLiveUpdate({
      type: 'info',
      content: message,
      source: details,
    });
  }

  logSuccess(message: string, details?: string): void {
    this.addLiveUpdate({
      type: 'log',
      content: `✅ ${message}`,
      source: details,
    });
  }

  logWarning(message: string, details?: string): void {
    this.addLiveUpdate({
      type: 'warning',
      content: `⚠️ ${message}`,
      source: details,
    });
  }

  logError(message: string, details?: string): void {
    this.addLiveUpdate({
      type: 'error',
      content: `❌ ${message}`,
      source: details,
    });
  }

  /**
   * Show execution summary
   */
  showExecutionSummary(): void {
    const indicators = Array.from(this.indicators.values());
    const completed = indicators.filter(i => i.status === 'completed').length;
    const failed = indicators.filter(i => i.status === 'failed').length;
    const warnings = indicators.filter(i => i.status === 'warning').length;

    const summary = boxen(
      `${chalk.bold('Execution Summary')}\\n\\n` +
      `${chalk.green('✅ Completed:')} ${completed}\\n` +
      `${chalk.red('❌ Failed:')} ${failed}\\n` +
      `${chalk.yellow('⚠️ Warnings:')} ${warnings}\\n` +
      `${chalk.blue('📊 Total:')} ${indicators.length}\\n\\n` +
      `${chalk.gray('Overall Status:')} ${this.getOverallStatusText()}`,
      {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: failed > 0 ? 'red' : completed === indicators.length ? 'green' : 'yellow',
      }
    );

    console.log(summary);
  }

  /**
   * Show detailed status of all indicators
   */
  showDetailedStatus(): void {
    console.log(chalk.blue.bold('\\n📊 Detailed Status Report'));
    console.log(chalk.gray('═'.repeat(80)));

    const indicators = Array.from(this.indicators.values());

    if (indicators.length === 0) {
      console.log(chalk.gray('No active tasks'));
      return;
    }

    indicators.forEach(indicator => {
      this.printIndicatorDetails(indicator);
    });
  }

  /**
   * Ask user for confirmation with enhanced UI
   */
  async askConfirmation(
    question: string,
    details?: string,
    defaultValue: boolean = false
  ): Promise<boolean> {
    const icon = defaultValue ? '✅' : '❓';
    const prompt = `${icon} ${chalk.cyan(question)}`;

    if (details) {
      console.log(chalk.gray(`   ${details}`));
    }

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(`${prompt} ${chalk.gray(defaultValue ? '(Y/n)' : '(y/N)')}: `, (answer) => {
        rl.close();

        const normalized = answer.toLowerCase().trim();
        if (normalized === '') {
          resolve(defaultValue);
        } else {
          resolve(normalized.startsWith('y'));
        }
      });
    });
  }

  /**
   * Show multi-choice selection
   */
  async showSelection<T>(
    title: string,
    choices: { value: T; label: string; description?: string }[],
    defaultIndex: number = 0
  ): Promise<T> {
    console.log(chalk.cyan.bold(`\\n${title}`));
    console.log(chalk.gray('─'.repeat(50)));

    choices.forEach((choice, index) => {
      const indicator = index === defaultIndex ? chalk.green('→') : ' ';
      console.log(`${indicator} ${index + 1}. ${chalk.bold(choice.label)}`);
      if (choice.description) {
        console.log(`   ${chalk.gray(choice.description)}`);
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

        console.log(chalk.green(`✓ Selected: ${choices[selection].label}`));
        resolve(choices[selection].value);
      });
    });
  }

  /**
   * Show real-time file watching
   */
  startFileWatcher(pattern: string): string {
    const watcherId = `watch-${Date.now()}`;

    this.createIndicator(watcherId, `Watching files: ${pattern}`);
    this.updateIndicator(watcherId, { status: 'running' });

    this.logInfo(`👀 Started watching: ${pattern}`);

    return watcherId;
  }

  /**
   * Report file change
   */
  reportFileChange(watcherId: string, filePath: string, changeType: 'created' | 'modified' | 'deleted'): void {
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
  private refreshDisplay(): void {
    if (!this.isInteractiveMode) return;

    // Move cursor to top and clear
    process.stdout.write('\\x1B[2J\\x1B[H');

    this.showHeader();
    this.showActiveIndicators();
    this.showRecentUpdates();
  }

  /**
   * Show active indicators
   */
  private showActiveIndicators(): void {
    const indicators = Array.from(this.indicators.values());

    if (indicators.length === 0) return;

    console.log(chalk.blue.bold('📊 Active Tasks:'));
    console.log(chalk.gray('─'.repeat(60)));

    indicators.forEach(indicator => {
      this.printIndicatorLine(indicator);
    });

    console.log();
  }

  /**
   * Show recent updates
   */
  private showRecentUpdates(): void {
    const recentUpdates = this.liveUpdates.slice(-10);

    if (recentUpdates.length === 0) return;

    console.log(chalk.blue.bold('📝 Recent Updates:'));
    console.log(chalk.gray('─'.repeat(60)));

    recentUpdates.forEach(update => {
      this.printLiveUpdate(update);
    });
  }

  /**
   * Print indicator line
   */
  private printIndicatorLine(indicator: StatusIndicator): void {
    const statusIcon = this.getStatusIcon(indicator.status);
    const statusColor = this.getStatusColor(indicator.status);
    const duration = this.getDuration(indicator);

    let line = `${statusIcon} ${chalk.bold(indicator.title)}`;

    if (indicator.progress !== undefined) {
      const progressBar = this.createProgressBarString(indicator.progress);
      line += ` ${progressBar}`;
    }

    if (duration) {
      line += ` ${chalk.gray(`(${duration})`)}`;
    }

    console.log(line);

    if (indicator.details) {
      console.log(`   ${chalk.gray(indicator.details)}`);
    }
  }

  /**
   * Print indicator details
   */
  private printIndicatorDetails(indicator: StatusIndicator): void {
    const statusIcon = this.getStatusIcon(indicator.status);
    const statusColor = this.getStatusColor(indicator.status);
    const duration = this.getDuration(indicator);

    console.log(`\\n${statusIcon} ${chalk.bold(indicator.title)}`);
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
  private printLiveUpdate(update: LiveUpdate): void {
    const timeStr = update.timestamp.toLocaleTimeString();
    const typeColor = this.getUpdateTypeColor(update.type);
    const sourceStr = update.source ? chalk.gray(`[${update.source}]`) : '';

    const line = `${chalk.gray(timeStr)} ${sourceStr} ${typeColor(update.content)}`;
    console.log(line);
  }

  /**
   * Log status update in non-interactive mode
   */
  private logStatusUpdate(indicator: StatusIndicator): void {
    const statusIcon = this.getStatusIcon(indicator.status);
    const statusColor = this.getStatusColor(indicator.status);

    console.log(`${statusIcon} ${statusColor(indicator.title)}`);

    if (indicator.details) {
      console.log(`   ${chalk.gray(indicator.details)}`);
    }
  }

  /**
   * Utility methods
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'warning': return '⚠️';
      default: return '📋';
    }
  }

  private getStatusColor(status: string): any {
    switch (status) {
      case 'pending': return chalk.gray;
      case 'running': return chalk.blue;
      case 'completed': return chalk.green;
      case 'failed': return chalk.red;
      case 'warning': return chalk.yellow;
      default: return chalk.gray;
    }
  }

  private getUpdateTypeColor(type: string): any {
    switch (type) {
      case 'error': return chalk.red;
      case 'warning': return chalk.yellow;
      case 'info': return chalk.blue;
      case 'log': return chalk.green;
      default: return chalk.white;
    }
  }

  private createProgressBarString(progress: number, width: number = 20): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;

    const bar = chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `[${bar}] ${progress}%`;
  }

  private getDuration(indicator: StatusIndicator): string | null {
    if (!indicator.startTime) return null;

    const endTime = indicator.endTime || new Date();
    const duration = endTime.getTime() - indicator.startTime.getTime();

    const seconds = Math.round(duration / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }
  }

  private getOverallStatus(): string {
    const indicators = Array.from(this.indicators.values());

    if (indicators.length === 0) return chalk.gray('Idle');

    const hasRunning = indicators.some(i => i.status === 'running');
    const hasFailed = indicators.some(i => i.status === 'failed');
    const hasWarning = indicators.some(i => i.status === 'warning');

    if (hasRunning) return chalk.blue('Running');
    if (hasFailed) return chalk.red('Failed');
    if (hasWarning) return chalk.yellow('Warning');

    return chalk.green('Ready');
  }

  private getOverallStatusText(): string {
    const indicators = Array.from(this.indicators.values());

    if (indicators.length === 0) return chalk.gray('No tasks');

    const completed = indicators.filter(i => i.status === 'completed').length;
    const failed = indicators.filter(i => i.status === 'failed').length;

    if (failed > 0) {
      return chalk.red('Some tasks failed');
    } else if (completed === indicators.length) {
      return chalk.green('All tasks completed successfully');
    } else {
      return chalk.blue('Tasks in progress');
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    // Stop all spinners
    this.spinners.forEach(spinner => spinner.stop());
    this.spinners.clear();

    // Stop all progress bars
    this.progressBars.forEach(bar => bar.stop());
    this.progressBars.clear();
  }
}

// Export singleton instance
export const advancedUI = new AdvancedCliUI();
