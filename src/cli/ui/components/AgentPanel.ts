/**
 * Agent Panel Component
 * Displays agent status, controls, and interactions
 */

import blessed from 'blessed';
import { EventEmitter } from 'events';
import { TUIComponent, Theme, Position, Agent, AgentTask, StatusType } from './types';
import { Logger } from '../../core/logger';
import { ConfigManager } from '../../config/config-manager';

export class AgentPanel extends EventEmitter implements TUIComponent {
    private container!: blessed.Widgets.BoxElement;
    private agentList!: blessed.Widgets.ListElement;
    private taskList!: blessed.Widgets.ListElement;
    private controlPanel!: blessed.Widgets.BoxElement;
    private statusDisplay!: blessed.Widgets.BoxElement;
    private config: ConfigManager;
    private logger: Logger;
    private agents: Agent[] = [];
    private tasks: AgentTask[] = [];
    private selectedAgent: Agent | null = null;
    private focused: boolean = false;

    constructor(parent: blessed.Widgets.Node, config: ConfigManager, logger: Logger) {
        super();
        this.config = config;
        this.logger = logger;

        this.createComponents(parent);
        this.setupEventHandlers();
    }

    /**
     * Create agent panel components
     */
    private createComponents(parent: blessed.Widgets.Node): void {
        // Main container
        this.container = blessed.box({
            parent,
            top: 0,
            left: '75%',
            width: '25%',
            height: '70%',
            border: 'line',
            style: {
                border: { fg: 'cyan' },
                bg: 'black',
                fg: 'white'
            },
            label: ' Agents ',
            tags: true
        });

        // Agent list (top section)
        this.agentList = blessed.list({
            parent: this.container,
            top: 0,
            left: 0,
            width: '100%',
            height: '40%',
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
            label: ' Available Agents ',
            keys: true,
            vi: true,
            mouse: true,
            scrollable: true,
            alwaysScroll: true,
            tags: true
        });

        // Task list (middle section)
        this.taskList = blessed.list({
            parent: this.container,
            top: '40%',
            left: 0,
            width: '100%',
            height: '35%',
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
            label: ' Active Tasks ',
            keys: true,
            vi: true,
            mouse: true,
            scrollable: true,
            alwaysScroll: true,
            tags: true
        });

        // Control panel (bottom section)
        this.controlPanel = blessed.box({
            parent: this.container,
            top: '75%',
            left: 0,
            width: '100%',
            height: '25%',
            style: {
                bg: 'black',
                fg: 'white'
            },
            tags: true
        });

        // Status display within control panel
        this.statusDisplay = blessed.box({
            parent: this.controlPanel,
            top: 0,
            left: 0,
            width: '100%',
            height: '50%',
            content: ' No agent selected ',
            style: {
                bg: 'black',
                fg: 'gray'
            },
            tags: true
        });

        // Control buttons
        this.createControlButtons();
    }

    /**
     * Create control buttons
     */
    private createControlButtons(): void {
        const runButton = blessed.button({
            parent: this.controlPanel,
            bottom: 1,
            left: 1,
            width: 8,
            height: 1,
            content: ' Run ',
            style: {
                bg: 'green',
                fg: 'white',
                focus: {
                    bg: 'yellow',
                    fg: 'black'
                }
            },
            mouse: true
        });

        const stopButton = blessed.button({
            parent: this.controlPanel,
            bottom: 1,
            left: 10,
            width: 8,
            height: 1,
            content: ' Stop ',
            style: {
                bg: 'red',
                fg: 'white',
                focus: {
                    bg: 'yellow',
                    fg: 'black'
                }
            },
            mouse: true
        });

        const configButton = blessed.button({
            parent: this.controlPanel,
            bottom: 1,
            right: 1,
            width: 10,
            height: 1,
            content: ' Config ',
            style: {
                bg: 'blue',
                fg: 'white',
                focus: {
                    bg: 'yellow',
                    fg: 'black'
                }
            },
            mouse: true
        });

        // Button event handlers
        runButton.on('press', () => this.runSelectedAgent());
        stopButton.on('press', () => this.stopSelectedAgent());
        configButton.on('press', () => this.configureSelectedAgent());
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers(): void {
        // Agent list events
        this.agentList.on('select', (item: any, index: number) => {
            if (index >= 0 && index < this.agents.length) {
                this.selectedAgent = this.agents[index];
                this.updateStatusDisplay();
                this.emit('agent-selected', this.selectedAgent);
            }
        });

        // Task list events
        this.taskList.on('select', (item: any, index: number) => {
            if (index >= 0 && index < this.tasks.length) {
                const task = this.tasks[index];
                this.emit('task-selected', task);
            }
        });

        // Keyboard shortcuts
        this.container.key(['enter'], () => {
            this.runSelectedAgent();
        });

        this.container.key(['space'], () => {
            this.stopSelectedAgent();
        });

        this.container.key(['c'], () => {
            this.configureSelectedAgent();
        });

        this.container.key(['r'], () => {
            this.refreshAgents();
        });
    }

    /**
     * Load agents
     */
    async loadAgents(): Promise<void> {
        try {
            this.logger.info('Loading agents...');

            // Mock agent data - in real implementation, this would come from agent registry
            this.agents = [
                {
                    id: 'code-analyzer',
                    name: 'Code Analyzer',
                    type: 'analysis',
                    status: 'idle',
                    description: 'Analyzes code structure, patterns, and quality metrics',
                    capabilities: ['ast-parsing', 'metrics-collection', 'pattern-detection'],
                    lastRun: new Date(Date.now() - 3600000) // 1 hour ago
                },
                {
                    id: 'test-runner',
                    name: 'Test Runner',
                    type: 'testing',
                    status: 'idle',
                    description: 'Executes tests and generates coverage reports',
                    capabilities: ['unit-testing', 'integration-testing', 'coverage-analysis']
                },
                {
                    id: 'doc-generator',
                    name: 'Documentation Generator',
                    type: 'documentation',
                    status: 'running',
                    description: 'Generates comprehensive code documentation',
                    capabilities: ['api-docs', 'readme-generation', 'inline-docs'],
                    progress: 65
                },
                {
                    id: 'security-scanner',
                    name: 'Security Scanner',
                    type: 'security',
                    status: 'idle',
                    description: 'Scans for security vulnerabilities and issues',
                    capabilities: ['vulnerability-scanning', 'dependency-audit', 'code-analysis']
                },
                {
                    id: 'refactoring-assistant',
                    name: 'Refactoring Assistant',
                    type: 'refactoring',
                    status: 'error',
                    description: 'Assists with code refactoring and optimization',
                    capabilities: ['code-refactoring', 'optimization', 'pattern-application']
                }
            ];

            this.updateAgentList();
            this.emit('agents-loaded', this.agents);
        } catch (error) {
            this.logger.error('Failed to load agents:', error);
            this.emit('error', error);
        }
    }

    /**
     * Load tasks
     */
    async loadTasks(): Promise<void> {
        try {
            this.logger.info('Loading tasks...');

            // Mock task data
            this.tasks = [
                {
                    id: 'task-1',
                    agentId: 'doc-generator',
                    name: 'Generate API Documentation',
                    status: 'running',
                    progress: 65,
                    startTime: new Date(Date.now() - 300000) // 5 minutes ago
                },
                {
                    id: 'task-2',
                    agentId: 'code-analyzer',
                    name: 'Analyze Project Structure',
                    status: 'completed',
                    progress: 100,
                    startTime: new Date(Date.now() - 3600000), // 1 hour ago
                    endTime: new Date(Date.now() - 3300000) // 55 minutes ago
                },
                {
                    id: 'task-3',
                    agentId: 'security-scanner',
                    name: 'Security Vulnerability Scan',
                    status: 'pending',
                    progress: 0
                }
            ];

            this.updateTaskList();
            this.emit('tasks-loaded', this.tasks);
        } catch (error) {
            this.logger.error('Failed to load tasks:', error);
            this.emit('error', error);
        }
    }

    /**
     * Update agent list display
     */
    private updateAgentList(): void {
        const items = this.agents.map(agent => {
            const statusIcon = this.getStatusIcon(agent.status);
            const progressText = agent.progress ? ` (${agent.progress}%)` : '';
            return `${statusIcon} {bold}${agent.name}{/bold} - ${agent.description}${progressText}`;
        });

        this.agentList.setItems(items);
    }

    /**
     * Update task list display
     */
    private updateTaskList(): void {
        const items = this.tasks.map(task => {
            const statusIcon = this.getTaskStatusIcon(task.status);
            const progressBar = this.createProgressBar(task.progress, 10);
            const agentName = this.agents.find(a => a.id === task.agentId)?.name || 'Unknown';
            return `${statusIcon} ${task.name} [${agentName}]\n  ${progressBar} ${task.progress}%`;
        });

        this.taskList.setItems(items);
    }

    /**
     * Get status icon for agent
     */
    private getStatusIcon(status: Agent['status']): string {
        switch (status) {
            case 'idle': return '⚪';
            case 'running': return '🟢';
            case 'error': return '🔴';
            case 'completed': return '✅';
            default: return '⚪';
        }
    }

    /**
     * Get status icon for task
     */
    private getTaskStatusIcon(status: AgentTask['status']): string {
        switch (status) {
            case 'pending': return '⏳';
            case 'running': return '🔄';
            case 'completed': return '✅';
            case 'failed': return '❌';
            default: return '⏳';
        }
    }

    /**
     * Create progress bar
     */
    private createProgressBar(percentage: number, width: number): string {
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }

    /**
     * Update status display
     */
    private updateStatusDisplay(): void {
        if (!this.selectedAgent) {
            this.statusDisplay.setContent(' No agent selected ');
            return;
        }

        const agent = this.selectedAgent;
        const statusText = `
{bold}${agent.name}{/bold}
Type: ${agent.type}
Status: ${this.getStatusIcon(agent.status)} ${agent.status}
${agent.progress ? `Progress: ${agent.progress}%` : ''}
${agent.lastRun ? `Last Run: ${agent.lastRun.toLocaleTimeString()}` : ''}

Capabilities:
${agent.capabilities.map(cap => `• ${cap}`).join('\n')}
    `.trim();

        this.statusDisplay.setContent(statusText);
    }

    /**
     * Run selected agent
     */
    private async runSelectedAgent(): Promise<void> {
        if (!this.selectedAgent) {
            this.logger.warn('No agent selected');
            return;
        }

        try {
            this.logger.info(`Running agent: ${this.selectedAgent.name}`);

            // Update agent status
            this.selectedAgent.status = 'running';
            this.selectedAgent.progress = 0;

            // Create a new task
            const task: AgentTask = {
                id: `task-${Date.now()}`,
                agentId: this.selectedAgent.id,
                name: `${this.selectedAgent.name} Task`,
                status: 'running',
                progress: 0,
                startTime: new Date()
            };

            this.tasks.unshift(task);

            this.updateAgentList();
            this.updateTaskList();
            this.updateStatusDisplay();

            this.emit('agent-started', this.selectedAgent, task);
        } catch (error) {
            this.logger.error('Failed to run agent:', error);
            this.emit('error', error);
        }
    }

    /**
     * Stop selected agent
     */
    private async stopSelectedAgent(): Promise<void> {
        if (!this.selectedAgent || this.selectedAgent.status !== 'running') {
            return;
        }

        try {
            this.logger.info(`Stopping agent: ${this.selectedAgent.name}`);

            this.selectedAgent.status = 'idle';
            this.selectedAgent.progress = undefined;

            // Update related tasks
            this.tasks.forEach(task => {
                if (task.agentId === this.selectedAgent!.id && task.status === 'running') {
                    task.status = 'failed';
                    task.endTime = new Date();
                }
            });

            this.updateAgentList();
            this.updateTaskList();
            this.updateStatusDisplay();

            this.emit('agent-stopped', this.selectedAgent);
        } catch (error) {
            this.logger.error('Failed to stop agent:', error);
            this.emit('error', error);
        }
    }

    /**
     * Configure selected agent
     */
    private configureSelectedAgent(): void {
        if (!this.selectedAgent) {
            return;
        }

        this.emit('agent-configure', this.selectedAgent);
    }

    /**
     * Refresh agents
     */
    private async refreshAgents(): Promise<void> {
        await Promise.all([
            this.loadAgents(),
            this.loadTasks()
        ]);
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
     * Initialize the agent panel
     */
    async initialize(): Promise<void> {
        this.logger.info('Initializing AgentPanel...');

        await Promise.all([
            this.loadAgents(),
            this.loadTasks()
        ]);

        this.logger.info('AgentPanel initialized successfully');
    }

    /**
     * Cleanup the agent panel
     */
    async cleanup(): Promise<void> {
        this.logger.info('Cleaning up AgentPanel...');
        // Stop any running agents
        for (const agent of this.agents) {
            if (agent.status === 'running') {
                agent.status = 'idle';
            }
        }
    }

    /**
     * Refresh the agent panel
     */
    refresh(): void {
        this.refreshAgents();
    }

    /**
     * Focus the agent panel
     */
    focus(): void {
        this.focused = true;
        this.container.style.border = { fg: 'yellow' };
        this.agentList.focus();
    }

    /**
     * Blur the agent panel
     */
    blur(): void {
        this.focused = false;
        this.container.style.border = { fg: 'cyan' };
    }

    /**
     * Handle window resize
     */
    handleResize(): void {
        // Agent panel handles resize automatically through blessed
    }

    /**
     * Apply theme to the agent panel
     */
    applyTheme(theme: Theme): void {
        this.container.style.border = { fg: theme.colors.border };
        this.container.style.bg = theme.colors.background;
        this.container.style.fg = theme.colors.foreground;

        this.agentList.style.bg = theme.colors.background;
        this.agentList.style.fg = theme.colors.foreground;
        this.agentList.style.selected = {
            bg: theme.colors.primary,
            fg: theme.colors.foreground
        };

        this.taskList.style.bg = theme.colors.background;
        this.taskList.style.fg = theme.colors.foreground;
        this.taskList.style.selected = {
            bg: theme.colors.primary,
            fg: theme.colors.foreground
        };

        if (this.focused) {
            this.container.style.border = { fg: theme.styles.focusBorder };
        }
    }

    /**
     * Get selected agent
     */
    getSelectedAgent(): Agent | null {
        return this.selectedAgent;
    }

    /**
     * Get all agents
     */
    getAgents(): Agent[] {
        return [...this.agents];
    }

    /**
     * Get all tasks
     */
    getTasks(): AgentTask[] {
        return [...this.tasks];
    }

    /**
     * Update agent progress
     */
    updateAgentProgress(agentId: string, progress: number): void {
        const agent = this.agents.find(a => a.id === agentId);
        if (agent) {
            agent.progress = progress;
            this.updateAgentList();
            if (this.selectedAgent?.id === agentId) {
                this.updateStatusDisplay();
            }
        }

        // Update related tasks
        const task = this.tasks.find(t => t.agentId === agentId && t.status === 'running');
        if (task) {
            task.progress = progress;
            this.updateTaskList();
        }
    }
}
