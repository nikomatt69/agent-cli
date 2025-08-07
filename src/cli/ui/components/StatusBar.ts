/**
 * Status Bar Component
 * Displays application status, shortcuts, and system information
 */

import blessed from 'blessed';
import { EventEmitter } from 'events';
import { TUIComponent, StatusType, Theme, Position } from './types';
import { ThemeManager } from '../utils/ThemeManager';

export interface StatusBarInfo {
  status: string;
  type: StatusType;
  details?: string;
}

export class StatusBar extends EventEmitter implements TUIComponent {
  private screen: blessed.Widgets.Screen;
  private container!: blessed.Widgets.BoxElement;
  private statusText!: blessed.Widgets.TextElement;
  private shortcutsText!: blessed.Widgets.TextElement;
  private systemInfo!: blessed.Widgets.TextElement;
  private themeManager: ThemeManager;
  private currentStatus: StatusBarInfo;

  constructor(screen: blessed.Widgets.Screen, themeManager: ThemeManager) {
    super();
    this.screen = screen;
    this.themeManager = themeManager;
    this.currentStatus = {
      status: 'Initializing...',
      type: 'info'
    };

    this.createComponents();
  }

  /**
   * Create status bar components
   */
  private createComponents(): void {
    // Main container
    this.container = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: {
        bg: 'blue',
        fg: 'white'
      }
    });

    // Status text (left side)
    this.statusText = blessed.text({
      parent: this.container,
      top: 0,
      left: 0,
      width: '40%',
      height: 1,
      content: this.formatStatus(),
      style: {
        bg: 'blue',
        fg: 'white'
      }
    });

    // Shortcuts (center)
    this.shortcutsText = blessed.text({
      parent: this.container,
      top: 0,
      left: '40%',
      width: '40%',
      height: 1,
      align: 'center',
      content: this.getShortcutsText(),
      style: {
        bg: 'blue',
        fg: 'white'
      }
    });

    // System info (right side)
    this.systemInfo = blessed.text({
      parent: this.container,
      top: 0,
      right: 0,
      width: '20%',
      height: 1,
      align: 'right',
      content: this.getSystemInfo(),
      style: {
        bg: 'blue',
        fg: 'white'
      }
    });
  }

  /**
   * Initialize the status bar
   */
  async initialize(): Promise<void> {
    this.updateDisplay();
    this.startSystemInfoUpdates();
  }

  /**
   * Cleanup the status bar
   */
  async cleanup(): Promise<void> {
    // Stop any running intervals
    this.stopSystemInfoUpdates();
  }

  /**
   * Set the current status
   */
  setStatus(status: string, type: StatusType = 'info', details?: string): void {
    this.currentStatus = { status, type, details };
    this.updateDisplay();
    this.emit('status-changed', this.currentStatus);
  }

  /**
   * Get the current status
   */
  getStatus(): StatusBarInfo {
    return { ...this.currentStatus };
  }

  /**
   * Update the display
   */
  private updateDisplay(): void {
    this.statusText.setContent(this.formatStatus());
    this.shortcutsText.setContent(this.getShortcutsText());
    this.systemInfo.setContent(this.getSystemInfo());
    this.screen.render();
  }

  /**
   * Format the status text with appropriate styling
   */
  private formatStatus(): string {
    const { status, type, details } = this.currentStatus;

    let prefix = '';
    switch (type) {
      case 'success':
        prefix = '✓';
        break;
      case 'warning':
        prefix = '⚠';
        break;
      case 'error':
        prefix = '✗';
        break;
      case 'loading':
        prefix = '⟳';
        break;
      case 'info':
      default:
        prefix = 'ℹ';
        break;
    }

    let text = `${prefix} ${status}`;
    if (details) {
      text += ` | ${details}`;
    }

    return text;
  }

  /**
   * Get shortcuts text
   */
  private getShortcutsText(): string {
    return 'F1:Help | Ctrl+P:Commands | Ctrl+R:Refresh | Tab:Navigate | Q:Quit';
  }

  /**
   * Get system information
   */
  private getSystemInfo(): string {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });

    const memUsage = process.memoryUsage();
    const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    return `${time} | Mem: ${memMB}MB`;
  }

  /**
   * Start system info updates
   */
  private systemInfoInterval?: NodeJS.Timeout;

  private startSystemInfoUpdates(): void {
    this.systemInfoInterval = setInterval(() => {
      this.systemInfo.setContent(this.getSystemInfo());
      this.screen.render();
    }, 1000);
  }

  /**
   * Stop system info updates
   */
  private stopSystemInfoUpdates(): void {
    if (this.systemInfoInterval) {
      clearInterval(this.systemInfoInterval);
      this.systemInfoInterval = undefined;
    }
  }

  /**
   * Set position (for layout management)
   */
  setPosition(position: Partial<Position>): void {
    if (position.top !== undefined) this.container.top = position.top;
    if (position.left !== undefined) this.container.left = position.left;
    if (position.width !== undefined) this.container.width = position.width;
    if (position.height !== undefined) this.container.height = position.height;
  }

  /**
   * Handle window resize
   */
  handleResize(): void {
    // Status bar automatically adjusts to screen width
    this.updateDisplay();
  }

  /**
   * Refresh the status bar
   */
  refresh(): void {
    this.updateDisplay();
  }

  /**
   * Focus the status bar (not typically focusable)
   */
  focus(): void {
    // Status bar is not focusable
  }

  /**
   * Blur the status bar
   */
  blur(): void {
    // Status bar is not focusable
  }

  /**
   * Apply theme to the status bar
   */
  applyTheme(theme: Theme): void {
    const statusColor = this.getStatusColor(this.currentStatus.type, theme);

    this.container.style.bg = theme.colors.primary;
    this.container.style.fg = theme.colors.foreground;

    this.statusText.style.bg = statusColor;
    this.statusText.style.fg = theme.colors.foreground;

    this.shortcutsText.style.bg = theme.colors.primary;
    this.shortcutsText.style.fg = theme.colors.muted;

    this.systemInfo.style.bg = theme.colors.primary;
    this.systemInfo.style.fg = theme.colors.muted;

    this.updateDisplay();
  }

  /**
   * Get color for status type
   */
  private getStatusColor(type: StatusType, theme: Theme): string {
    switch (type) {
      case 'success':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      case 'error':
        return theme.colors.error;
      case 'loading':
        return theme.colors.info;
      case 'info':
      default:
        return theme.colors.primary;
    }
  }

  /**
   * Show a temporary message
   */
  showTemporaryMessage(message: string, type: StatusType = 'info', duration: number = 3000): void {
    const originalStatus = { ...this.currentStatus };

    this.setStatus(message, type);

    setTimeout(() => {
      this.currentStatus = originalStatus;
      this.updateDisplay();
    }, duration);
  }

  /**
   * Add a progress indicator
   */
  showProgress(label: string, current: number, total: number): void {
    const percentage = Math.round((current / total) * 100);
    const progressBar = this.createProgressBar(percentage, 20);
    this.setStatus(`${label} ${progressBar} ${percentage}%`, 'loading');
  }

  /**
   * Create a simple progress bar
   */
  private createProgressBar(percentage: number, width: number): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Get the container element
   */
  getContainer(): blessed.Widgets.BoxElement {
    return this.container;
  }
}
