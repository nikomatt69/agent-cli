/**
 * Notification Manager Component
 * Handles toast notifications and alerts in the TUI
 */

import blessed from 'blessed';
import { EventEmitter } from 'events';
import { TUIComponent, Theme, Notification, NotificationAction, StatusType } from './types';
import { ThemeManager } from '../utils/ThemeManager';

export class NotificationManager extends EventEmitter implements TUIComponent {
  private screen: blessed.Widgets.Screen;
  private container!: blessed.Widgets.BoxElement;
  private themeManager: ThemeManager;
  private notifications: Notification[] = [];
  private activeNotifications: Map<string, blessed.Widgets.BoxElement> = new Map();
  private maxNotifications: number = 5;
  private defaultDuration: number = 5000;

  constructor(screen: blessed.Widgets.Screen, themeManager: ThemeManager) {
    super();
    this.screen = screen;
    this.themeManager = themeManager;

    this.createContainer();
  }

  /**
   * Create the notification container
   */
  private createContainer(): void {
    this.container = blessed.box({
      parent: this.screen,
      top: 1,
      right: 1,
      width: '30%',
      height: '50%',
      style: {
        bg: 'transparent'
      },
      tags: true
    });
  }

  /**
   * Show an info notification
   */
  showInfo(title: string, message: string, duration?: number, actions?: NotificationAction[]): string {
    return this.addNotification('info', title, message, duration, actions);
  }

  /**
   * Show a success notification
   */
  showSuccess(title: string, message: string, duration?: number, actions?: NotificationAction[]): string {
    return this.addNotification('success', title, message, duration, actions);
  }

  /**
   * Show a warning notification
   */
  showWarning(title: string, message: string, duration?: number, actions?: NotificationAction[]): string {
    return this.addNotification('warning', title, message, duration, actions);
  }

  /**
   * Show an error notification
   */
  showError(title: string, message: string, duration?: number, actions?: NotificationAction[]): string {
    return this.addNotification('error', title, message, duration, actions);
  }

  /**
   * Add a notification
   */
  private addNotification(
    type: StatusType,
    title: string,
    message: string,
    duration?: number,
    actions?: NotificationAction[]
  ): string {
    const notification: Notification = {
      id: this.generateId(),
      type,
      title,
      message,
      timestamp: new Date(),
      duration: duration || this.defaultDuration,
      actions
    };

    this.notifications.unshift(notification);

    // Limit number of stored notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }

    this.displayNotification(notification);
    this.emit('notification-added', notification);

    return notification.id;
  }

  /**
   * Display a notification on screen
   */
  private displayNotification(notification: Notification): void {
    // Remove oldest notification if we're at the limit
    if (this.activeNotifications.size >= this.maxNotifications) {
      const oldestId = Array.from(this.activeNotifications.keys())[0];
      this.removeNotificationDisplay(oldestId);
    }

    const notificationBox = this.createNotificationBox(notification);
    this.activeNotifications.set(notification.id, notificationBox);
    this.repositionNotifications();

    // Auto-remove after duration
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(notification.id);
      }, notification.duration);
    }

    this.screen.render();
  }

  /**
   * Create a notification box
   */
  private createNotificationBox(notification: Notification): blessed.Widgets.BoxElement {
    const theme = this.themeManager.getCurrentTheme();
    const colors = this.getNotificationColors(notification.type, theme);

    const box = blessed.box({
      parent: this.container,
      width: '100%',
      height: 'shrink',
      border: 'line',
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      style: {
        border: { fg: colors.border },
        bg: colors.background,
        fg: colors.foreground
      },
      tags: true,
      mouse: true
    });

    // Title
    const titleText = blessed.text({
      parent: box,
      top: 0,
      left: 0,
      width: '80%',
      height: 1,
      content: `{bold}${this.getTypeIcon(notification.type)} ${notification.title}{/bold}`,
      style: {
        bg: colors.background,
        fg: colors.foreground
      },
      tags: true
    });

    // Close button
    const closeButton = blessed.text({
      parent: box,
      top: 0,
      right: 0,
      width: 3,
      height: 1,
      content: ' ✕ ',
      style: {
        bg: colors.background,
        fg: colors.foreground,
        hover: {
          bg: colors.foreground,
          fg: colors.background
        }
      },
      mouse: true
    });

    closeButton.on('click', () => {
      this.removeNotification(notification.id);
    });

    // Message
    const messageText = blessed.text({
      parent: box,
      top: 1,
      left: 0,
      right: 0,
      height: 'shrink',
      content: notification.message,
      style: {
        bg: colors.background,
        fg: colors.foreground
      },
      wrap: true
    });

    // Actions (if any)
    if (notification.actions && notification.actions.length > 0) {
      let actionTop = 2;
      notification.actions.forEach((action, index) => {
        const actionButton = blessed.button({
          parent: box,
          top: actionTop,
          left: index * 12,
          width: 10,
          height: 1,
          content: action.label,
          style: {
            bg: this.getActionButtonColor(action.style, theme),
            fg: theme.colors.foreground,
            focus: {
              bg: theme.colors.primary,
              fg: theme.colors.foreground
            }
          },
          mouse: true
        });

        actionButton.on('press', () => {
          action.action();
          this.removeNotification(notification.id);
        });
      });
    }

    // Timestamp
    const timestampText = blessed.text({
      parent: box,
      bottom: 0,
      right: 0,
      width: 'shrink',
      height: 1,
      content: this.formatTimestamp(notification.timestamp),
      style: {
        bg: colors.background,
        fg: theme.colors.muted
      }
    });

    return box;
  }

  /**
   * Get notification colors based on type
   */
  private getNotificationColors(type: StatusType, theme: Theme) {
    switch (type) {
      case 'success':
        return {
          border: theme.colors.success,
          background: theme.colors.background,
          foreground: theme.colors.success
        };
      case 'warning':
        return {
          border: theme.colors.warning,
          background: theme.colors.background,
          foreground: theme.colors.warning
        };
      case 'error':
        return {
          border: theme.colors.error,
          background: theme.colors.background,
          foreground: theme.colors.error
        };
      case 'info':
      default:
        return {
          border: theme.colors.info,
          background: theme.colors.background,
          foreground: theme.colors.info
        };
    }
  }

  /**
   * Get type icon
   */
  private getTypeIcon(type: StatusType): string {
    switch (type) {
      case 'success': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✗';
      case 'loading': return '⟳';
      case 'info':
      default: return 'ℹ';
    }
  }

  /**
   * Get action button color
   */
  private getActionButtonColor(style: string | undefined, theme: Theme): string {
    switch (style) {
      case 'primary': return theme.colors.primary;
      case 'danger': return theme.colors.error;
      case 'secondary':
      default: return theme.colors.secondary;
    }
  }

  /**
   * Format timestamp
   */
  private formatTimestamp(timestamp: Date): string {
    return timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Remove a notification
   */
  removeNotification(id: string): void {
    this.removeNotificationDisplay(id);
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.emit('notification-removed', id);
  }

  /**
   * Remove notification display
   */
  private removeNotificationDisplay(id: string): void {
    const box = this.activeNotifications.get(id);
    if (box) {
      box.destroy();
      this.activeNotifications.delete(id);
      this.repositionNotifications();
      this.screen.render();
    }
  }

  /**
   * Reposition all notifications
   */
  private repositionNotifications(): void {
    let currentTop = 0;
    this.activeNotifications.forEach((box) => {
      box.top = currentTop;
      currentTop += box.height as number + 1;
    });
  }

  /**
   * Show next notification (for keyboard navigation)
   */
  showNext(): void {
    if (this.notifications.length === 0) {
      this.showInfo('No Notifications', 'No notifications to display');
      return;
    }

    // Show a summary of recent notifications
    const recent = this.notifications.slice(0, 5);
    const summary = recent.map(n =>
      `${this.getTypeIcon(n.type)} ${n.title}: ${n.message.substring(0, 50)}${n.message.length > 50 ? '...' : ''}`
    ).join('\n');

    this.showInfo('Recent Notifications', summary, 10000);
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.activeNotifications.forEach((box, id) => {
      box.destroy();
    });
    this.activeNotifications.clear();
    this.notifications = [];
    this.screen.render();
    this.emit('notifications-cleared');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize the notification manager
   */
  async initialize(): Promise<void> {
    // Notification manager is ready to use
  }

  /**
   * Cleanup the notification manager
   */
  async cleanup(): Promise<void> {
    this.clearAll();
  }

  /**
   * Refresh the notification manager
   */
  refresh(): void {
    this.repositionNotifications();
    this.screen.render();
  }

  /**
   * Focus the notification manager
   */
  focus(): void {
    // Notifications are not directly focusable
  }

  /**
   * Blur the notification manager
   */
  blur(): void {
    // Notifications are not directly focusable
  }

  /**
   * Handle window resize
   */
  handleResize(): void {
    this.repositionNotifications();
    this.screen.render();
  }

  /**
   * Apply theme to the notification manager
   */
  applyTheme(theme: Theme): void {
    // Re-create all active notifications with new theme
    const currentNotifications = Array.from(this.activeNotifications.keys());
    currentNotifications.forEach(id => {
      const notification = this.notifications.find(n => n.id === id);
      if (notification) {
        this.removeNotificationDisplay(id);
        this.displayNotification(notification);
      }
    });
  }

  /**
   * Get all notifications
   */
  getNotifications(): Notification[] {
    return [...this.notifications];
  }

  /**
   * Get active notifications count
   */
  getActiveCount(): number {
    return this.activeNotifications.size;
  }
}
