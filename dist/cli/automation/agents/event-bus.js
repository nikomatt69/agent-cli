"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventTypes = exports.EventBus = void 0;
const events_1 = require("events");
const cli_ui_1 = require("../../utils/cli-ui");
const crypto_1 = require("crypto");
class EventBus extends events_1.EventEmitter {
    constructor() {
        super();
        this.eventHistory = [];
        this.maxHistorySize = 1000;
        this.subscribers = new Map();
        this.eventMetrics = new Map();
        this.setMaxListeners(100);
    }
    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
    async publish(eventType, data, metadata = {}) {
        const event = {
            id: this.generateEventId(),
            type: eventType,
            data,
            timestamp: new Date(),
            source: metadata.source || 'unknown',
            priority: metadata.priority || 'normal',
            tags: metadata.tags || [],
            correlationId: metadata.correlationId
        };
        this.recordEvent(event);
        this.updateMetrics(eventType);
        if (process.env.DEBUG_EVENTS) {
            cli_ui_1.CliUI.logDebug(`📡 Event published: ${eventType}`, {
                id: event.id,
                source: event.source,
                priority: event.priority
            });
        }
        try {
            this.emit(eventType, event);
            const subscribers = this.subscribers.get(eventType) || new Set();
            const promises = Array.from(subscribers).map(subscriber => this.notifySubscriber(subscriber, event));
            await Promise.allSettled(promises);
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Failed to publish event ${eventType}: ${error.message}`);
            throw error;
        }
    }
    subscribe(eventType, handler, options = {}) {
        const subscriber = {
            id: this.generateSubscriberId(),
            handler,
            filter: options.filter,
            priority: options.priority || 0,
            once: options.once || false,
            created: new Date()
        };
        if (!this.subscribers.has(eventType)) {
            this.subscribers.set(eventType, new Set());
        }
        this.subscribers.get(eventType).add(subscriber);
        const sortedSubscribers = Array.from(this.subscribers.get(eventType))
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));
        this.subscribers.set(eventType, new Set(sortedSubscribers));
        cli_ui_1.CliUI.logInfo(`📋 Subscribed to event: ${eventType}`);
        return {
            eventType,
            subscriberId: subscriber.id,
            unsubscribe: () => this.unsubscribe(eventType, subscriber.id)
        };
    }
    subscribeOnce(eventType, handler) {
        return this.subscribe(eventType, handler, { once: true });
    }
    unsubscribe(eventType, subscriberId) {
        const subscribers = this.subscribers.get(eventType);
        if (!subscribers)
            return false;
        const subscriber = Array.from(subscribers).find(s => s.id === subscriberId);
        if (!subscriber)
            return false;
        subscribers.delete(subscriber);
        if (subscribers.size === 0) {
            this.subscribers.delete(eventType);
        }
        cli_ui_1.CliUI.logInfo(`📋 Unsubscribed from event: ${eventType}`);
        return true;
    }
    async waitFor(eventType, timeout = 30000, filter) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.unsubscribe(eventType, subscription.subscriberId);
                reject(new Error(`Timeout waiting for event: ${eventType}`));
            }, timeout);
            const subscription = this.subscribe(eventType, (event) => {
                if (!filter || filter(event)) {
                    clearTimeout(timeoutId);
                    this.unsubscribe(eventType, subscription.subscriberId);
                    resolve(event);
                }
            });
        });
    }
    getEventHistory(filter) {
        let history = this.eventHistory;
        if (filter) {
            history = history.filter(record => {
                if (filter.eventType && record.event.type !== filter.eventType)
                    return false;
                if (filter.source && record.event.source !== filter.source)
                    return false;
                if (filter.since && record.event.timestamp < filter.since)
                    return false;
                if (filter.until && record.event.timestamp > filter.until)
                    return false;
                if (filter.tags && !filter.tags.some(tag => record.event.tags.includes(tag)))
                    return false;
                return true;
            });
        }
        return history.slice(-(filter?.limit ?? 100));
    }
    getEventMetrics() {
        return new Map(this.eventMetrics);
    }
    clearHistory() {
        this.eventHistory = [];
        cli_ui_1.CliUI.logInfo('📡 Event history cleared');
    }
    getSubscribersCount(eventType) {
        if (eventType) {
            return this.subscribers.get(eventType)?.size || 0;
        }
        return Array.from(this.subscribers.values())
            .reduce((total, subscribers) => total + subscribers.size, 0);
    }
    async notifySubscriber(subscriber, event) {
        try {
            if (subscriber.filter && !subscriber.filter(event)) {
                return;
            }
            await subscriber.handler(event);
            if (subscriber.once) {
                const subscribers = this.subscribers.get(event.type);
                if (subscribers) {
                    subscribers.delete(subscriber);
                }
            }
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Error in event subscriber: ${error.message}`);
        }
    }
    recordEvent(event) {
        const record = {
            event,
            processed: new Date()
        };
        this.eventHistory.push(record);
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
        }
    }
    updateMetrics(eventType) {
        const metrics = this.eventMetrics.get(eventType) || {
            count: 0,
            firstSeen: new Date(),
            lastSeen: new Date(),
            averageFrequency: 0
        };
        metrics.count++;
        metrics.lastSeen = new Date();
        const timeSpan = metrics.lastSeen.getTime() - metrics.firstSeen.getTime();
        metrics.averageFrequency = metrics.count / (timeSpan / 60000) || 0;
        this.eventMetrics.set(eventType, metrics);
    }
    generateEventId() {
        return `evt_${Date.now()}_${(0, crypto_1.randomBytes)(6).toString('base64url')}`;
    }
    generateSubscriberId() {
        return `sub_${Date.now()}_${(0, crypto_1.randomBytes)(6).toString('base64url')}`;
    }
}
exports.EventBus = EventBus;
exports.EventTypes = {
    AGENT_STARTED: 'agent.started',
    AGENT_STOPPED: 'agent.stopped',
    AGENT_ERROR: 'agent.error',
    TASK_CREATED: 'task.created',
    TASK_ASSIGNED: 'task.assigned',
    TASK_STARTED: 'task.started',
    TASK_COMPLETED: 'task.completed',
    TASK_FAILED: 'task.failed',
    TOOL_EXECUTED: 'tool.executed',
    TOOL_FAILED: 'tool.failed',
    PLAN_GENERATED: 'plan.generated',
    PLAN_APPROVED: 'plan.approved',
    PLAN_EXECUTED: 'plan.executed',
    SYSTEM_READY: 'system.ready',
    SYSTEM_SHUTDOWN: 'system.shutdown',
    AGENT_MESSAGE: 'agent.message',
    USER_INPUT: 'user.input',
    FILE_CHANGED: 'file.changed',
    FILE_CREATED: 'file.created',
    FILE_DELETED: 'file.deleted'
};
