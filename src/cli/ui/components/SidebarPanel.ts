/**
 * Sidebar Panel Component
 * Navigation and project structure panel
 */

import blessed from 'blessed';
import { EventEmitter } from 'events';
import { TUIComponent, Theme, Position, FileTreeNode } from './types';
import { Logger } from '../../core/logger';
import { ConfigManager } from '../../config/config-manager';

export class SidebarPanel extends EventEmitter implements TUIComponent {
  private container!: blessed.Widgets.BoxElement;
  private fileTree!: blessed.Widgets.ListElement;
  private agentList!: blessed.Widgets.ListElement;
  private tabBar!: blessed.Widgets.BoxElement;
  private config: ConfigManager;
  private logger: Logger;
  private currentTab: 'files' | 'agents' = 'files';
  private focused: boolean = false;

  constructor(parent: blessed.Widgets.Node, config: ConfigManager, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;

    this.createComponents(parent);
    this.setupEventHandlers();
  }

  /**
   * Create sidebar components
   */
  private createComponents(parent: blessed.Widgets.Node): void {
    // Main container
    this.container = blessed.box({
      parent,
      top: 0,
      left: 0,
      width: '25%',
      height: '70%',
      border: 'line',
      style: {
        border: { fg: 'cyan' },
        bg: 'black',
        fg: 'white'
      },
      label: ' Sidebar ',
      tags: true
    });

    // Tab bar
    this.tabBar = blessed.box({
      parent: this.container,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line' },
      style: {
        border: { fg: 'blue' },
        bg: 'black',
        fg: 'white'
      }
    });

    // Files tab
    const filesTab = blessed.box({
      parent: this.tabBar,
      top: 0,
      left: 0,
      width: '50%',
      height: 1,
      content: ' Files ',
      style: {
        bg: this.currentTab === 'files' ? 'blue' : 'black',
        fg: 'white'
      },
      mouse: true,
      clickable: true
    });

    // Agents tab
    const agentsTab = blessed.box({
      parent: this.tabBar,
      top: 0,
      left: '50%',
      width: '50%',
      height: 1,
      content: ' Agents ',
      style: {
        bg: this.currentTab === 'agents' ? 'blue' : 'black',
        fg: 'white'
      },
      mouse: true,
      clickable: true
    });

    // File tree
    this.fileTree = blessed.list({
      parent: this.container,
      top: 3,
      left: 0,
      width: '100%',
      bottom: 0,
      style: {
        bg: 'black',
        fg: 'white',
        selected: {
          bg: 'blue',
          fg: 'white'
        }
      },
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      template: {
        lines: true,
        extend: ' ',
        retract: ' '
      }
    });

    // Agent list
    this.agentList = blessed.list({
      parent: this.container,
      top: 3,
      left: 0,
      width: '100%',
      bottom: 0,
      hidden: true,
      style: {
        bg: 'black',
        fg: 'white',
        selected: {
          bg: 'blue',
          fg: 'white'
        }
      },
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true
    });

    // Tab click handlers
    filesTab.on('click', () => this.switchTab('files'));
    agentsTab.on('click', () => this.switchTab('agents'));
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // File tree events
    this.fileTree.on('select', (node: any) => {
      if (node && node.data) {
        this.emit('file-select', node.data);
      }
    });

    this.fileTree.on('expand', (node: any) => {
      if (node && node.data && node.data.type === 'directory') {
        this.loadDirectoryContents(node);
      }
    });

    // Agent list events
    this.agentList.on('select', (item: any, index: number) => {
      this.emit('agent-select', { item, index });
    });

    // Keyboard navigation
    this.container.key(['tab'], () => {
      this.switchTab(this.currentTab === 'files' ? 'agents' : 'files');
    });

    this.container.key(['enter'], () => {
      if (this.currentTab === 'files') {
        // Emit file selection event
        this.emit('file-selected', 'selected-file');
      } else {
        // Emit agent selection event
        this.emit('agent-selected', 'selected-agent');
      }
    });
  }

  /**
   * Switch between tabs
   */
  private switchTab(tab: 'files' | 'agents'): void {
    this.currentTab = tab;

    if (tab === 'files') {
      this.fileTree.show();
      this.agentList.hide();
    } else {
      this.fileTree.hide();
      this.agentList.show();
    }

    this.updateTabStyles();
    this.emit('tab-changed', tab);
  }

  /**
   * Update tab styles
   */
  private updateTabStyles(): void {
    const filesTab = this.tabBar.children[0] as blessed.Widgets.BoxElement;
    const agentsTab = this.tabBar.children[1] as blessed.Widgets.BoxElement;

    filesTab.style.bg = this.currentTab === 'files' ? 'blue' : 'black';
    agentsTab.style.bg = this.currentTab === 'agents' ? 'blue' : 'black';
  }

  /**
   * Load file tree data
   */
  async loadFileTree(rootPath: string): Promise<void> {
    try {
      this.logger.info(`Loading file tree for: ${rootPath}`);

      // Mock file tree data - in real implementation, this would scan the filesystem
      const mockData = {
        name: 'Project Root',
        path: rootPath,
        type: 'directory' as const,
        expanded: true,
        children: [
          {
            name: 'src',
            path: `${rootPath}/src`,
            type: 'directory' as const,
            children: [
              { name: 'cli', path: `${rootPath}/src/cli`, type: 'directory' as const },
              { name: 'components', path: `${rootPath}/src/components`, type: 'directory' as const },
              { name: 'utils', path: `${rootPath}/src/utils`, type: 'directory' as const }
            ]
          },
          {
            name: 'package.json',
            path: `${rootPath}/package.json`,
            type: 'file' as const
          },
          {
            name: 'README.md',
            path: `${rootPath}/README.md`,
            type: 'file' as const
          }
        ]
      };

      // Set file tree items using setItems instead of setData
      this.fileTree.setItems(['📁 src/', '📁 components/', '📄 index.ts', '📄 README.md']);
      this.fileTree.screen.render();
      this.emit('file-tree-loaded', mockData);
    } catch (error) {
      this.logger.error('Failed to load file tree:', error);
      this.emit('error', error);
    }
  }

  /**
   * Load directory contents
   */
  private async loadDirectoryContents(node: any): Promise<void> {
    // Mock implementation - in real app, this would read directory contents
    this.logger.debug(`Loading contents for: ${node.data.path}`);
  }

  /**
   * Load agent list
   */
  async loadAgents(): Promise<void> {
    try {
      this.logger.info('Loading agent list...');

      // Mock agent data - in real implementation, this would come from agent registry
      const agents = [
        '🤖 Code Analyzer - Analyze code structure and patterns',
        '🧪 Test Runner - Execute and manage tests',
        '📚 Documentation Generator - Generate code documentation',
        '🔒 Security Scanner - Scan for security vulnerabilities',
        '🔧 Refactoring Assistant - Assist with code refactoring',
        '📊 Metrics Collector - Collect code metrics and statistics',
        '🚀 Deployment Agent - Handle deployment processes',
        '🐛 Bug Detector - Detect potential bugs and issues'
      ];

      this.agentList.setItems(agents);
      this.emit('agents-loaded', agents);
    } catch (error) {
      this.logger.error('Failed to load agents:', error);
      this.emit('error', error);
    }
  }

  /**
   * Set position
   */
  setPosition(position: Partial<Position>): void {
    if (position.top !== undefined) this.container.top = position.top;
    if (position.left !== undefined) this.container.left = position.left;
    if (position.width !== undefined) this.container.width = position.width;
    if (position.height !== undefined) this.container.height = position.height;
  }

  /**
   * Initialize the sidebar panel
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing SidebarPanel...');

    // Load initial data
    await Promise.all([
      this.loadFileTree('/current/project'),
      this.loadAgents()
    ]);

    this.logger.info('SidebarPanel initialized successfully');
  }

  /**
   * Cleanup the sidebar panel
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up SidebarPanel...');
    // Cleanup logic here
  }

  /**
   * Refresh the sidebar panel
   */
  refresh(): void {
    if (this.currentTab === 'files') {
      this.loadFileTree('/current/project');
    } else {
      this.loadAgents();
    }
  }

  /**
   * Focus the sidebar panel
   */
  focus(): void {
    this.focused = true;
    this.container.style.border = { fg: 'yellow' };

    if (this.currentTab === 'files') {
      this.fileTree.focus();
    } else {
      this.agentList.focus();
    }
  }

  /**
   * Blur the sidebar panel
   */
  blur(): void {
    this.focused = false;
    this.container.style.border = { fg: 'cyan' };
  }

  /**
   * Handle window resize
   */
  handleResize(): void {
    // Sidebar panel handles resize automatically through blessed
  }

  /**
   * Apply theme to the sidebar panel
   */
  applyTheme(theme: Theme): void {
    this.container.style.border = { fg: theme.colors.border };
    this.container.style.bg = theme.colors.background;
    this.container.style.fg = theme.colors.foreground;

    this.fileTree.style.bg = theme.colors.background;
    this.fileTree.style.fg = theme.colors.foreground;
    this.fileTree.style.selected = {
      bg: theme.colors.primary,
      fg: theme.colors.foreground
    };

    this.agentList.style.bg = theme.colors.background;
    this.agentList.style.fg = theme.colors.foreground;
    this.agentList.style.selected = {
      bg: theme.colors.primary,
      fg: theme.colors.foreground
    };

    if (this.focused) {
      this.container.style.border = { fg: theme.styles.focusBorder };
    }
  }

  /**
   * Get current tab
   */
  getCurrentTab(): 'files' | 'agents' {
    return this.currentTab;
  }

  /**
   * Get selected file
   */
  getSelectedFile(): any {
    return null; // Placeholder - blessed API doesn't have 'selected' property
  }

  /**
   * Get selected agent
   */
  getSelectedAgent(): any {
    return null; // Placeholder - blessed API doesn't have 'selected' property
  }

  /**
   * Expand file tree node
   */
  expandNode(path: string): void {
    // Implementation to expand specific node
    this.logger.debug(`Expanding node: ${path}`);
  }

  /**
   * Collapse file tree node
   */
  collapseNode(path: string): void {
    // Implementation to collapse specific node
    this.logger.debug(`Collapsing node: ${path}`);
  }
}
