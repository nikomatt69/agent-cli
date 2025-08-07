/**
 * TUI Components Index
 * Centralized exports for all TUI components
 */

// Core Components
export { StatusBar } from './StatusBar';
export { CommandPalette } from './CommandPalette';
export { NotificationManager } from './NotificationManager';

// Panel Components
export { SidebarPanel } from './SidebarPanel';
export { ContentPanel } from './ContentPanel';
export { AgentPanel } from './AgentPanel';
export { LogPanel } from './LogPanel';

// Component Types
export * from './types';

// Re-export commonly used types
export type {
  TUIComponent,
  Theme,
  Position,
  StatusType,
  Notification,
  Command,
  Agent,
  LogEntry,
  FileTreeNode,
  CodeViewerOptions
} from './types';

// Component utilities
export const COMPONENT_DEFAULTS = {
  BORDER_STYLE: 'line' as const,
  FOCUS_COLOR: 'yellow' as const,
  NORMAL_COLOR: 'white' as const
};