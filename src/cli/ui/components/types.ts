/**
 * TUI Component Types and Interfaces
 * Shared type definitions for all TUI components
 */

import blessed from 'blessed';

// Base component interface
export interface TUIComponent {
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  refresh(): void;
  focus(): void;
  blur(): void;
  handleResize(): void;
  applyTheme(theme: Theme): void;
}

// Position and sizing
export interface Position {
  top: number | string;
  left: number | string;
  width: number | string;
  height: number | string;
}

export interface Dimensions {
  width: number;
  height: number;
}

// Theme interface
export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    muted: string;
  };
  styles: {
    border: 'line' | 'bg' | 'none';
    focusBorder: string;
    selectedBg: string;
    selectedFg: string;
  };
}

// Status types
export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'loading';

// Notification types
export interface Notification {
  id: string;
  type: StatusType;
  title: string;
  message: string;
  timestamp: Date;
  duration?: number;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

// Agent types
export interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'error' | 'completed';
  description: string;
  capabilities: string[];
  lastRun?: Date;
  progress?: number;
}

export interface AgentTask {
  id: string;
  agentId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}

// File tree types
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  size?: number;
  modified?: Date;
  expanded?: boolean;
  selected?: boolean;
}

// Code viewer types
export interface CodeViewerOptions {
  language?: string;
  lineNumbers?: boolean;
  syntaxHighlighting?: boolean;
  wordWrap?: boolean;
  readOnly?: boolean;
  theme?: string;
}

// Log entry types
export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  data?: any;
}

// Command types
export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  category: string;
  execute: (args: string[]) => Promise<void>;
  validate?: (args: string[]) => boolean;
}

// Form types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'textarea';
  required?: boolean;
  defaultValue?: any;
  options?: FormFieldOption[];
  validation?: (value: any) => string | null;
}

export interface FormFieldOption {
  label: string;
  value: any;
}

export interface FormData {
  [key: string]: any;
}

// Table types
export interface TableColumn {
  key: string;
  title: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (value: any, row: any) => string;
}

export interface TableRow {
  [key: string]: any;
}

// Chart types
export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

// Progress types
export interface ProgressInfo {
  current: number;
  total: number;
  label?: string;
  percentage?: number;
}

// Event types
export interface TUIEvent {
  type: string;
  source: string;
  data?: any;
  timestamp: Date;
}

// Blessed widget extensions
export interface BlessedBoxExtended extends blessed.Widgets.BoxElement {
  setPosition(position: Partial<Position>): void;
  getPosition(): Position;
  setTheme(theme: Theme): void;
}

// Component state
export interface ComponentState {
  focused: boolean;
  visible: boolean;
  enabled: boolean;
  loading: boolean;
  error?: string;
}

// Layout types
export type LayoutMode = 'default' | 'agent-focused' | 'code-focused' | 'logs-focused';

export interface LayoutConfig {
  mode: LayoutMode;
  panels: {
    sidebar: Partial<Position>;
    content: Partial<Position>;
    agent: Partial<Position>;
    log: Partial<Position>;
  };
}

// Key binding types
export interface KeyBinding {
  key: string | string[];
  description: string;
  action: () => void;
  global?: boolean;
}

// Plugin types
export interface TUIPlugin {
  name: string;
  version: string;
  description: string;
  initialize(tui: any): Promise<void>;
  cleanup(): Promise<void>;
  getCommands?(): Command[];
  getComponents?(): any[];
}

// Configuration types
export interface TUIConfig {
  theme: string;
  layout: LayoutMode;
  keyBindings: KeyBinding[];
  plugins: string[];
  features: {
    syntaxHighlighting: boolean;
    lineNumbers: boolean;
    autoSave: boolean;
    notifications: boolean;
  };
}
