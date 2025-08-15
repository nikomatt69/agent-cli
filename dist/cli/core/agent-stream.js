"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentStream = exports.AgentStreamManager = void 0;
const events_1 = require("events");
const chalk_1 = __importDefault(require("chalk"));
const crypto_1 = require("crypto");
class AgentStreamManager extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.streams = new Map();
        this.actions = new Map();
        this.activeAgents = new Set();
    }
    startAgentStream(agentId) {
        this.activeAgents.add(agentId);
        this.streams.set(agentId, []);
        this.actions.set(agentId, []);
        this.emitEvent(agentId, 'info', `🚀 Agent ${agentId} stream started`);
    }
    stopAgentStream(agentId) {
        this.activeAgents.delete(agentId);
        this.emitEvent(agentId, 'info', `✅ Agent ${agentId} stream completed`);
    }
    emitEvent(agentId, type, message, data, progress) {
        const event = {
            type,
            agentId,
            message,
            data,
            timestamp: new Date(),
            progress,
        };
        const agentStream = this.streams.get(agentId) || [];
        agentStream.push(event);
        this.streams.set(agentId, agentStream);
        this.displayEvent(event);
        this.emit('stream', event);
    }
    displayEvent(event) {
        const timeStr = event.timestamp.toLocaleTimeString();
        const agentStr = chalk_1.default.cyan(`[${event.agentId}]`);
        let color = chalk_1.default.gray;
        let icon = '•';
        switch (event.type) {
            case 'thinking':
                color = chalk_1.default.blue;
                icon = '🧠';
                break;
            case 'planning':
                color = chalk_1.default.yellow;
                icon = '📋';
                break;
            case 'executing':
                color = chalk_1.default.green;
                icon = '⚡';
                break;
            case 'progress':
                color = chalk_1.default.cyan;
                icon = '📊';
                break;
            case 'result':
                color = chalk_1.default.green;
                icon = '✅';
                break;
            case 'error':
                color = chalk_1.default.red;
                icon = '❌';
                break;
            case 'info':
                color = chalk_1.default.gray;
                icon = 'ℹ️';
                break;
        }
        let message = `${chalk_1.default.gray(timeStr)} ${agentStr} ${icon} ${color(event.message)}`;
        if (event.progress !== undefined) {
            const progressBar = '█'.repeat(Math.floor(event.progress / 10)) +
                '░'.repeat(10 - Math.floor(event.progress / 10));
            message += ` [${chalk_1.default.cyan(progressBar)}] ${event.progress}%`;
        }
        console.log(message);
        if (event.data && typeof event.data === 'object') {
            console.log(chalk_1.default.gray(`    ${JSON.stringify(event.data, null, 2)}`));
        }
    }
    trackAction(agentId, actionType, description, input) {
        const action = {
            id: `${agentId}-${Date.now()}-${(0, crypto_1.randomBytes)(6).toString('base64url')}`,
            agentId,
            type: actionType,
            description,
            status: 'pending',
            startTime: new Date(),
            input,
        };
        const agentActions = this.actions.get(agentId) || [];
        agentActions.push(action);
        this.actions.set(agentId, agentActions);
        this.emitEvent(agentId, 'executing', `Starting: ${description}`);
        return action.id;
    }
    updateAction(actionId, status, output, error) {
        for (const [agentId, actions] of Array.from(this.actions.entries())) {
            const action = actions.find(a => a.id === actionId);
            if (action) {
                action.status = status;
                action.endTime = new Date();
                action.output = output;
                action.error = error;
                const duration = action.endTime.getTime() - action.startTime.getTime();
                if (status === 'completed') {
                    this.emitEvent(agentId, 'result', `Completed: ${action.description} (${duration}ms)`, output);
                }
                else if (status === 'failed') {
                    this.emitEvent(agentId, 'error', `Failed: ${action.description} - ${error}`, { error });
                }
                break;
            }
        }
    }
    async streamThinking(agentId, thoughts) {
        this.emitEvent(agentId, 'thinking', 'Analyzing requirements...');
        for (const thought of thoughts) {
            await new Promise(resolve => setTimeout(resolve, 200));
            this.emitEvent(agentId, 'thinking', thought);
        }
    }
    async streamPlanning(agentId, planSteps) {
        this.emitEvent(agentId, 'planning', 'Creating execution plan...');
        for (let i = 0; i < planSteps.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 150));
            this.emitEvent(agentId, 'planning', `${i + 1}. ${planSteps[i]}`);
        }
        this.emitEvent(agentId, 'planning', `Plan created with ${planSteps.length} steps`);
    }
    streamProgress(agentId, current, total, message) {
        const progress = Math.round((current / total) * 100);
        const progressMessage = message || `Progress: ${current}/${total}`;
        this.emitEvent(agentId, 'progress', progressMessage, { current, total }, progress);
    }
    getAgentStream(agentId, limit) {
        const stream = this.streams.get(agentId) || [];
        return limit ? stream.slice(-limit) : stream;
    }
    getAgentActions(agentId) {
        return this.actions.get(agentId) || [];
    }
    getActiveAgents() {
        return Array.from(this.activeAgents);
    }
    showLiveDashboard() {
        const activeAgents = this.getActiveAgents();
        if (activeAgents.length === 0) {
            console.log(chalk_1.default.yellow('📊 No active agents'));
            return;
        }
        console.log(chalk_1.default.blue.bold('\n📺 Live Agent Dashboard'));
        console.log(chalk_1.default.gray('═'.repeat(60)));
        activeAgents.forEach(agentId => {
            const recentEvents = this.getAgentStream(agentId, 3);
            const actions = this.getAgentActions(agentId);
            const completedActions = actions.filter(a => a.status === 'completed').length;
            const failedActions = actions.filter(a => a.status === 'failed').length;
            console.log(chalk_1.default.cyan.bold(`\n🤖 Agent: ${agentId}`));
            console.log(chalk_1.default.gray('─'.repeat(30)));
            console.log(`📊 Actions: ${completedActions} completed, ${failedActions} failed`);
            console.log(`🕐 Last Activity: ${recentEvents[recentEvents.length - 1]?.timestamp.toLocaleTimeString() || 'None'}`);
            console.log(chalk_1.default.yellow('Recent Events:'));
            recentEvents.forEach(event => {
                const icon = event.type === 'result' ? '✅' :
                    event.type === 'error' ? '❌' :
                        event.type === 'executing' ? '⚡' : '•';
                console.log(`  ${icon} ${event.message}`);
            });
        });
    }
    streamCollaboration(fromAgent, toAgent, message, data) {
        this.emitEvent(fromAgent, 'info', `📤 Sent to ${toAgent}: ${message}`, data);
        this.emitEvent(toAgent, 'info', `📥 Received from ${fromAgent}: ${message}`, data);
    }
    clearAgentStream(agentId) {
        this.streams.delete(agentId);
        this.actions.delete(agentId);
        this.emitEvent(agentId, 'info', 'Stream history cleared');
    }
    exportStream(agentId, filename) {
        const stream = this.getAgentStream(agentId);
        const actions = this.getAgentActions(agentId);
        const exportData = {
            agentId,
            exportedAt: new Date(),
            events: stream,
            actions,
            summary: {
                totalEvents: stream.length,
                totalActions: actions.length,
                completedActions: actions.filter(a => a.status === 'completed').length,
                failedActions: actions.filter(a => a.status === 'failed').length,
            }
        };
        const fileName = filename || `agent-${agentId}-stream-${Date.now()}.json`;
        require('fs').writeFileSync(fileName, JSON.stringify(exportData, null, 2));
        console.log(chalk_1.default.green(`📄 Stream exported to ${fileName}`));
        return fileName;
    }
    getMetrics() {
        const activeAgents = this.activeAgents.size;
        const totalEvents = Array.from(this.streams.values())
            .reduce((sum, events) => sum + events.length, 0);
        const totalActions = Array.from(this.actions.values())
            .reduce((sum, actions) => sum + actions.length, 0);
        const oneMinuteAgo = new Date(Date.now() - 60000);
        const recentEvents = Array.from(this.streams.values())
            .flat()
            .filter(e => e.timestamp > oneMinuteAgo);
        const completedActions = Array.from(this.actions.values())
            .flat()
            .filter(a => a.status === 'completed' && a.endTime);
        const averageActionDuration = completedActions.length > 0
            ? completedActions.reduce((sum, action) => sum + (action.endTime.getTime() - action.startTime.getTime()), 0) / completedActions.length
            : 0;
        return {
            activeAgents,
            totalEvents,
            totalActions,
            eventsPerMinute: recentEvents.length,
            averageActionDuration: Math.round(averageActionDuration),
        };
    }
}
exports.AgentStreamManager = AgentStreamManager;
exports.agentStream = new AgentStreamManager();
