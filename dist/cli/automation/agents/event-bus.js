"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventTypes = exports.EventBus = void 0;
const events_1 = require("events");
const cli_ui_1 = require("../../utils/cli-ui");
/**
 * Production-ready Event Bus for Multi-Agent Communication
 * Handles asynchronous communication between agents and system components
 */
class EventBus extends events_1.EventEmitter {
    constructor() {
        super();
        this.eventHistory = [];
        this.maxHistorySize = 1000;
        this.subscribers = new Map();
        this.eventMetrics = new Map();
        this.setMaxListeners(100); // Allow many subscribers
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
    /**
     * Publish an event to all subscribers
     */
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
        // Record event in history
        this.recordEvent(event);
        // Update metrics
        this.updateMetrics(eventType);
        // Log event if debug mode
        if (process.env.DEBUG_EVENTS) {
            cli_ui_1.CliUI.logDebug(`📡 Event published: ${eventType}`, {
                id: event.id,
                source: event.source,
                priority: event.priority
            });
        }
        try {
            // Emit to EventEmitter subscribers
            this.emit(eventType, event);
            // Notify custom subscribers
            const subscribers = this.subscribers.get(eventType) || new Set();
            const promises = Array.from(subscribers).map(subscriber => this.notifySubscriber(subscriber, event));
            await Promise.allSettled(promises);
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Failed to publish event ${eventType}: ${error.message}`);
            throw error;
        }
    }
    /**
     * Subscribe to events with typed handler
     */
    subscribe(eventType, handler, options = {}) {
        const subscriber = {
            id: this.generateSubscriberId(),
            handler,
            filter: options.filter,
            priority: options.priority || 0,
            once: options.once || false,
            created: new Date()
        };
        // Add to subscribers map
        if (!this.subscribers.has(eventType)) {
            this.subscribers.set(eventType, new Set());
        }
        this.subscribers.get(eventType).add(subscriber);
        // Sort subscribers by priority
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
    /**
     * Subscribe to events once
     */
    subscribeOnce(eventType, handler) {
        return this.subscribe(eventType, handler, { once: true });
    }
    /**
     * Unsubscribe from events
     */
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
    /**
     * Wait for a specific event with timeout
     */
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
    /**
     * Get event history
     */
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
    /**
     * Get event metrics
     */
    getEventMetrics() {
        return new Map(this.eventMetrics);
    }
    /**
     * Clear event history
     */
    clearHistory() {
        this.eventHistory = [];
        cli_ui_1.CliUI.logInfo('📡 Event history cleared');
    }
    /**
     * Get current subscribers count
     */
    getSubscribersCount(eventType) {
        if (eventType) {
            return this.subscribers.get(eventType)?.size || 0;
        }
        return Array.from(this.subscribers.values())
            .reduce((total, subscribers) => total + subscribers.size, 0);
    }
    /**
     * Notify a single subscriber
     */
    async notifySubscriber(subscriber, event) {
        try {
            // Apply filter if present
            if (subscriber.filter && !subscriber.filter(event)) {
                return;
            }
            // Call handler
            await subscriber.handler(event);
            // Remove if once subscription
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
    /**
     * Record event in history
     */
    recordEvent(event) {
        const record = {
            event,
            processed: new Date()
        };
        this.eventHistory.push(record);
        // Trim history if too large
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
        }
    }
    /**
     * Update event metrics
     */
    updateMetrics(eventType) {
        const metrics = this.eventMetrics.get(eventType) || {
            count: 0,
            firstSeen: new Date(),
            lastSeen: new Date(),
            averageFrequency: 0
        };
        metrics.count++;
        metrics.lastSeen = new Date();
        // Calculate average frequency (events per minute)
        const timeSpan = metrics.lastSeen.getTime() - metrics.firstSeen.getTime();
        metrics.averageFrequency = metrics.count / (timeSpan / 60000) || 0;
        this.eventMetrics.set(eventType, metrics);
    }
    /**
     * Generate unique event ID
     */
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Generate unique subscriber ID
     */
    generateSubscriberId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.EventBus = EventBus;
// Common event types
exports.EventTypes = {
    // Agent lifecycle
    AGENT_STARTED: 'agent.started',
    AGENT_STOPPED: 'agent.stopped',
    AGENT_ERROR: 'agent.error',
    // Task management
    TASK_CREATED: 'task.created',
    TASK_ASSIGNED: 'task.assigned',
    TASK_STARTED: 'task.started',
    TASK_COMPLETED: 'task.completed',
    TASK_FAILED: 'task.failed',
    // Tool execution
    TOOL_EXECUTED: 'tool.executed',
    TOOL_FAILED: 'tool.failed',
    // Planning
    PLAN_GENERATED: 'plan.generated',
    PLAN_APPROVED: 'plan.approved',
    PLAN_EXECUTED: 'plan.executed',
    // System
    SYSTEM_READY: 'system.ready',
    SYSTEM_SHUTDOWN: 'system.shutdown',
    // Communication
    AGENT_MESSAGE: 'agent.message',
    USER_INPUT: 'user.input',
    // File operations
    FILE_CHANGED: 'file.changed',
    FILE_CREATED: 'file.created',
    FILE_DELETED: 'file.deleted'
};
