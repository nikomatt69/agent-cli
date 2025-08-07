"use strict";
/**
 * Agent Panel Component
 * Displays agent status, controls, and interactions
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentPanel = void 0;
const blessed_1 = __importDefault(require("blessed"));
const events_1 = require("events");
class AgentPanel extends events_1.EventEmitter {
    constructor(parent, config, logger) {
        super();
        this.agents = [];
        this.tasks = [];
        this.selectedAgent = null;
        this.focused = false;
        this.config = config;
        this.logger = logger;
        this.createComponents(parent);
        this.setupEventHandlers();
    }
    /**
     * Create agent panel components
     */
    createComponents(parent) {
        // Main container
        this.container = blessed_1.default.box({
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
        this.agentList = blessed_1.default.list({
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
        this.taskList = blessed_1.default.list({
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
        this.controlPanel = blessed_1.default.box({
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
        this.statusDisplay = blessed_1.default.box({
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
    createControlButtons() {
        const runButton = blessed_1.default.button({
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
        const stopButton = blessed_1.default.button({
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
        const configButton = blessed_1.default.button({
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
    setupEventHandlers() {
        // Agent list events
        this.agentList.on('select', (item, index) => {
            if (index >= 0 && index < this.agents.length) {
                this.selectedAgent = this.agents[index];
                this.updateStatusDisplay();
                this.emit('agent-selected', this.selectedAgent);
            }
        });
        // Task list events
        this.taskList.on('select', (item, index) => {
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
    async loadAgents() {
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
        }
        catch (error) {
            this.logger.error('Failed to load agents:', error);
            this.emit('error', error);
        }
    }
    /**
     * Load tasks
     */
    async loadTasks() {
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
        }
        catch (error) {
            this.logger.error('Failed to load tasks:', error);
            this.emit('error', error);
        }
    }
    /**
     * Update agent list display
     */
    updateAgentList() {
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
    updateTaskList() {
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
    getStatusIcon(status) {
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
    getTaskStatusIcon(status) {
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
    createProgressBar(percentage, width) {
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
    /**
     * Update status display
     */
    updateStatusDisplay() {
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
    async runSelectedAgent() {
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
            const task = {
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
        }
        catch (error) {
            this.logger.error('Failed to run agent:', error);
            this.emit('error', error);
        }
    }
    /**
     * Stop selected agent
     */
    async stopSelectedAgent() {
        if (!this.selectedAgent || this.selectedAgent.status !== 'running') {
            return;
        }
        try {
            this.logger.info(`Stopping agent: ${this.selectedAgent.name}`);
            this.selectedAgent.status = 'idle';
            this.selectedAgent.progress = undefined;
            // Update related tasks
            this.tasks.forEach(task => {
                if (task.agentId === this.selectedAgent.id && task.status === 'running') {
                    task.status = 'failed';
                    task.endTime = new Date();
                }
            });
            this.updateAgentList();
            this.updateTaskList();
            this.updateStatusDisplay();
            this.emit('agent-stopped', this.selectedAgent);
        }
        catch (error) {
            this.logger.error('Failed to stop agent:', error);
            this.emit('error', error);
        }
    }
    /**
     * Configure selected agent
     */
    configureSelectedAgent() {
        if (!this.selectedAgent) {
            return;
        }
        this.emit('agent-configure', this.selectedAgent);
    }
    /**
     * Refresh agents
     */
    async refreshAgents() {
        await Promise.all([
            this.loadAgents(),
            this.loadTasks()
        ]);
    }
    /**
     * Set position
     */
    setPosition(position) {
        if (position.top !== undefined)
            this.container.top = position.top;
        if (position.left !== undefined)
            this.container.left = position.left;
        if (position.width !== undefined)
            this.container.width = position.width;
        if (position.height !== undefined)
            this.container.height = position.height;
    }
    /**
     * Initialize the agent panel
     */
    async initialize() {
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
    async cleanup() {
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
    refresh() {
        this.refreshAgents();
    }
    /**
     * Focus the agent panel
     */
    focus() {
        this.focused = true;
        this.container.style.border = { fg: 'yellow' };
        this.agentList.focus();
    }
    /**
     * Blur the agent panel
     */
    blur() {
        this.focused = false;
        this.container.style.border = { fg: 'cyan' };
    }
    /**
     * Handle window resize
     */
    handleResize() {
        // Agent panel handles resize automatically through blessed
    }
    /**
     * Apply theme to the agent panel
     */
    applyTheme(theme) {
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
    getSelectedAgent() {
        return this.selectedAgent;
    }
    /**
     * Get all agents
     */
    getAgents() {
        return [...this.agents];
    }
    /**
     * Get all tasks
     */
    getTasks() {
        return [...this.tasks];
    }
    /**
     * Update agent progress
     */
    updateAgentProgress(agentId, progress) {
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
exports.AgentPanel = AgentPanel;
