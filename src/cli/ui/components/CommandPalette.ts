/**
 * Command Palette Component
 * Quick command execution interface with fuzzy search
 */

import blessed from 'blessed';
import { EventEmitter } from 'events';
import { TUIComponent, Theme, Command } from './types';
import { ThemeManager } from '../utils/ThemeManager';

export class CommandPalette extends EventEmitter implements TUIComponent {
  private screen: blessed.Widgets.Screen;
  private container!: blessed.Widgets.BoxElement;
  private input!: blessed.Widgets.TextareaElement;
  private list!: blessed.Widgets.ListElement;
  private themeManager: ThemeManager;
  private commands: Command[] = [];
  private filteredCommands: Command[] = [];
  private isVisible: boolean = false;

  constructor(screen: blessed.Widgets.Screen, themeManager: ThemeManager) {
    super();
    this.screen = screen;
    this.themeManager = themeManager;

    this.createComponents();
    this.setupEventHandlers();
    this.loadCommands();
  }

  /**
   * Create command palette components
   */
  private createComponents(): void {
    // Main container (overlay)
    this.container = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '50%',
      border: 'line',
      hidden: true,
      style: {
        border: { fg: 'cyan' },
        bg: 'black',
        fg: 'white'
      },
      label: ' Command Palette ',
      tags: true
    });

    // Input field
    this.input = blessed.textbox({
      parent: this.container,
      top: 1,
      left: 1,
      right: 1,
      height: 3,
      border: 'line',
      style: {
        border: { fg: 'blue' },
        bg: 'black',
        fg: 'white',
        focus: {
          border: { fg: 'yellow' },
          bg: 'black',
          fg: 'white'
        }
      },
      label: ' Search Commands ',
      inputOnFocus: true
    });

    // Command list
    this.list = blessed.list({
      parent: this.container,
      top: 5,
      left: 1,
      right: 1,
      bottom: 1,
      border: 'line',
      style: {
        border: { fg: 'blue' },
        bg: 'black',
        fg: 'white',
        selected: {
          bg: 'blue',
          fg: 'white'
        }
      },
      label: ' Commands ',
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Input events
    this.input.on('submit', () => {
      this.executeSelectedCommand();
    });

    this.input.on('keypress', (ch: string, key: any) => {
      if (key.name === 'down') {
        this.list.focus();
        this.list.down(1);
      } else if (key.name === 'up') {
        this.list.focus();
        this.list.up(1);
      } else if (key.name === 'escape') {
        this.hide();
      } else {
        // Filter commands as user types
        setTimeout(() => {
          this.filterCommands(this.input.getValue());
        }, 10);
      }
    });

    // List events
    this.list.on('select', () => {
      this.executeSelectedCommand();
    });

    this.list.on('keypress', (ch: string, key: any) => {
      if (key.name === 'escape') {
        this.hide();
      } else if (key.name === 'enter') {
        this.executeSelectedCommand();
      } else if (key.name === 'backspace' || (key.name && key.name.length === 1)) {
        this.input.focus();
      }
    });

    // Container events
    this.container.on('keypress', (ch: string, key: any) => {
      if (key.name === 'escape') {
        this.hide();
      }
    });
  }

  /**
   * Load available commands
   */
  private loadCommands(): void {
    this.commands = [
      {
        name: 'agent:list',
        description: 'List all available agents',
        category: 'Agents',
        execute: async () => { this.emit('execute', 'agent:list'); }
      },
      {
        name: 'agent:run',
        description: 'Run a specific agent',
        category: 'Agents',
        execute: async () => { this.emit('execute', 'agent:run'); }
      },
      {
        name: 'project:analyze',
        description: 'Analyze current project',
        category: 'Project',
        execute: async () => { this.emit('execute', 'project:analyze'); }
      },
      {
        name: 'file:open',
        description: 'Open a file',
        category: 'Files',
        execute: async () => { this.emit('execute', 'file:open'); }
      },
      {
        name: 'file:create',
        description: 'Create a new file',
        category: 'Files',
        execute: async () => { this.emit('execute', 'file:create'); }
      },
      {
        name: 'config:edit',
        description: 'Edit configuration',
        category: 'Configuration',
        execute: async () => { this.emit('execute', 'config:edit'); }
      },
      {
        name: 'theme:switch',
        description: 'Switch theme',
        category: 'UI',
        execute: async () => { this.emit('execute', 'theme:switch'); return Promise.resolve(); }
      },
      {
        name: 'layout:default',
        description: 'Switch to default layout',
        category: 'UI',
        execute: async () => { this.emit('execute', 'layout:default'); return Promise.resolve(); }
      },
      {
        name: 'layout:agent-focused',
        description: 'Switch to agent-focused layout',
        category: 'UI',
        execute: async () => { this.emit('execute', 'layout:agent-focused'); return Promise.resolve(); }
      },
      {
        name: 'layout:code-focused',
        description: 'Switch to code-focused layout',
        category: 'UI',
        execute: async () => { this.emit('execute', 'layout:code-focused'); return Promise.resolve(); }
      },
      {
        name: 'help:shortcuts',
        description: 'Show keyboard shortcuts',
        category: 'Help',
        execute: async () => { this.emit('execute', 'help:shortcuts'); }
      },
      {
        name: 'help:about',
        description: 'About this application',
        category: 'Help',
        execute: async () => { this.emit('execute', 'help:about'); }
      }
    ];

    this.filteredCommands = [...this.commands];
    this.updateList();
  }

  /**
   * Filter commands based on search query
   */
  private filterCommands(query: string): void {
    if (!query.trim()) {
      this.filteredCommands = [...this.commands];
    } else {
      const lowerQuery = query.toLowerCase();
      this.filteredCommands = this.commands.filter(command =>
        command.name.toLowerCase().includes(lowerQuery) ||
        command.description.toLowerCase().includes(lowerQuery) ||
        command.category.toLowerCase().includes(lowerQuery)
      );
    }

    this.updateList();
  }

  /**
   * Update the command list display
   */
  private updateList(): void {
    const items = this.filteredCommands.map(command => {
      const category = `{cyan-fg}[${command.category}]{/cyan-fg}`;
      const name = `{yellow-fg}${command.name}{/yellow-fg}`;
      const description = `{white-fg}${command.description}{/white-fg}`;
      return `${category} ${name} - ${description}`;
    });

    this.list.setItems(items);
    this.list.select(0);
    this.screen.render();
  }

  /**
   * Execute the currently selected command
   */
  private executeSelectedCommand(): void {
    const selectedIndex = 0; // Placeholder - blessed API doesn't have 'selected' property
    if (selectedIndex >= 0 && selectedIndex < this.filteredCommands.length) {
      const command = this.filteredCommands[selectedIndex];
      this.hide();
      this.emit('execute', command.name);
    }
  }

  /**
   * Show the command palette
   */
  show(): void {
    if (this.isVisible) return;

    this.isVisible = true;
    this.container.show();
    this.input.clearValue();
    this.input.focus();
    this.filteredCommands = [...this.commands];
    this.updateList();
    this.screen.render();
    this.emit('show');
  }

  /**
   * Hide the command palette
   */
  hide(): void {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.container.hide();
    this.screen.render();
    this.emit('hide');
  }

  /**
   * Toggle command palette visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Add a new command
   */
  addCommand(command: Command): void {
    this.commands.push(command);
    if (this.isVisible) {
      this.filterCommands(this.input.getValue());
    }
  }

  /**
   * Remove a command
   */
  removeCommand(name: string): void {
    this.commands = this.commands.filter(cmd => cmd.name !== name);
    if (this.isVisible) {
      this.filterCommands(this.input.getValue());
    }
  }

  /**
   * Initialize the command palette
   */
  async initialize(): Promise<void> {
    // Command palette is ready to use
  }

  /**
   * Cleanup the command palette
   */
  async cleanup(): Promise<void> {
    this.hide();
  }

  /**
   * Refresh the command palette
   */
  refresh(): void {
    if (this.isVisible) {
      this.updateList();
    }
  }

  /**
   * Focus the command palette
   */
  focus(): void {
    if (this.isVisible) {
      this.input.focus();
    }
  }

  /**
   * Blur the command palette
   */
  blur(): void {
    // Command palette handles its own focus
  }

  /**
   * Handle window resize
   */
  handleResize(): void {
    // Command palette is centered and responsive
    this.screen.render();
  }

  /**
   * Apply theme to the command palette
   */
  applyTheme(theme: Theme): void {
    this.container.style.border = { fg: theme.colors.border };
    this.container.style.bg = theme.colors.background;
    this.container.style.fg = theme.colors.foreground;

    this.input.style.border = { fg: theme.colors.accent };
    this.input.style.bg = theme.colors.background;
    this.input.style.fg = theme.colors.foreground;
    this.input.style.focus = {
      border: { fg: theme.colors.primary },
      bg: theme.colors.background,
      fg: theme.colors.foreground
    };

    this.list.style.border = { fg: theme.colors.accent };
    this.list.style.bg = theme.colors.background;
    this.list.style.fg = theme.colors.foreground;
    this.list.style.selected = {
      bg: theme.colors.primary,
      fg: theme.colors.foreground
    };

    if (this.isVisible) {
      this.screen.render();
    }
  }

  /**
   * Check if command palette is visible
   */
  isCommandPaletteVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Get all commands
   */
  getCommands(): Command[] {
    return [...this.commands];
  }

  /**
   * Get filtered commands
   */
  getFilteredCommands(): Command[] {
    return [...this.filteredCommands];
  }
}
