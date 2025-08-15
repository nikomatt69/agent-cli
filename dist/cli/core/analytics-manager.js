"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsManager = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
class AnalyticsManager {
    constructor(workingDirectory = process.cwd()) {
        this.events = [];
        this.maxEvents = 10000;
        this.analyticsFile = (0, path_1.join)(workingDirectory, '.nikcli-analytics.json');
        this.loadAnalytics();
    }
    trackEvent(event) {
        const fullEvent = {
            ...event,
            timestamp: new Date()
        };
        this.events.push(fullEvent);
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
        if (this.events.length % 100 === 0) {
            this.saveAnalytics();
        }
    }
    trackQuery(sessionId, query, metadata) {
        this.trackEvent({
            eventType: 'query',
            sessionId,
            data: { query: query.substring(0, 200) },
            metadata
        });
    }
    trackResponse(sessionId, response, processingTime, metadata) {
        this.trackEvent({
            eventType: 'response',
            sessionId,
            data: {
                responseLength: response.length,
                processingTime,
                hasCode: response.includes('```'),
                hasStructuredContent: response.includes('**') || response.includes('1.') || response.includes('•')
            },
            metadata
        });
    }
    trackToolCall(sessionId, toolName, success, duration) {
        this.trackEvent({
            eventType: 'tool_call',
            sessionId,
            data: { toolName, success, duration }
        });
    }
    trackCacheHit(sessionId, cacheType, tokensSaved) {
        this.trackEvent({
            eventType: 'cache_hit',
            sessionId,
            data: { cacheType, tokensSaved }
        });
    }
    trackPerformance(sessionId, metrics) {
        this.trackEvent({
            eventType: 'performance',
            sessionId,
            data: metrics
        });
    }
    getSummary() {
        const recentEvents = this.events.filter(e => e.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000));
        const queries = recentEvents.filter(e => e.eventType === 'query');
        const responses = recentEvents.filter(e => e.eventType === 'response');
        const toolCalls = recentEvents.filter(e => e.eventType === 'tool_call');
        const cacheHits = recentEvents.filter(e => e.eventType === 'cache_hit');
        const errors = recentEvents.filter(e => e.eventType === 'error');
        const toolUsage = {};
        toolCalls.forEach(event => {
            const toolName = event.data.toolName;
            toolUsage[toolName] = (toolUsage[toolName] || 0) + 1;
        });
        const queryTexts = queries.map(e => e.data.query);
        const queryFrequency = {};
        queryTexts.forEach(query => {
            queryFrequency[query] = (queryFrequency[query] || 0) + 1;
        });
        const popularQueries = Object.entries(queryFrequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([query]) => query);
        return {
            totalQueries: queries.length,
            averageResponseTime: responses.length > 0
                ? responses.reduce((sum, e) => sum + e.data.processingTime, 0) / responses.length
                : 0,
            cacheHitRate: cacheHits.length / (queries.length || 1),
            errorRate: errors.length / (queries.length || 1),
            mostUsedTools: toolUsage,
            popularQueries,
            performanceTrends: this.getPerformanceTrends()
        };
    }
    getPerformanceTrends() {
        const performanceEvents = this.events.filter(e => e.eventType === 'performance');
        return performanceEvents.slice(-10).map(e => ({
            timestamp: e.timestamp,
            ...e.data
        }));
    }
    generateInsights() {
        const summary = this.getSummary();
        const insights = [];
        if (summary.cacheHitRate < 0.3) {
            insights.push('Low cache hit rate - consider expanding cache coverage');
        }
        if (summary.averageResponseTime > 5000) {
            insights.push('High response times - consider optimizing context size');
        }
        if (summary.errorRate > 0.1) {
            insights.push('High error rate - review error patterns');
        }
        const mostUsedTool = Object.entries(summary.mostUsedTools)
            .sort(([, a], [, b]) => b - a)[0];
        if (mostUsedTool) {
            insights.push(`Most used tool: ${mostUsedTool[0]} (${mostUsedTool[1]} times)`);
        }
        return insights;
    }
    saveAnalytics() {
        try {
            const data = {
                events: this.events,
                lastUpdated: new Date().toISOString()
            };
            (0, fs_1.writeFileSync)(this.analyticsFile, JSON.stringify(data, null, 2));
        }
        catch (error) {
            console.warn('Failed to save analytics:', error);
        }
    }
    loadAnalytics() {
        try {
            if ((0, fs_1.existsSync)(this.analyticsFile)) {
                const data = JSON.parse((0, fs_1.readFileSync)(this.analyticsFile, 'utf-8'));
                this.events = data.events.map((e) => ({
                    ...e,
                    timestamp: new Date(e.timestamp)
                }));
            }
        }
        catch (error) {
            console.warn('Failed to load analytics:', error);
        }
    }
    exportReport() {
        const summary = this.getSummary();
        const insights = this.generateInsights();
        return `# NikCLI Analytics Report
Generated: ${new Date().toISOString()}

## Summary
- Total Queries: ${summary.totalQueries}
- Average Response Time: ${summary.averageResponseTime.toFixed(0)}ms
- Cache Hit Rate: ${(summary.cacheHitRate * 100).toFixed(1)}%
- Error Rate: ${(summary.errorRate * 100).toFixed(1)}%

## Most Used Tools
${Object.entries(summary.mostUsedTools)
            .sort(([, a], [, b]) => b - a)
            .map(([tool, count]) => `- ${tool}: ${count} times`)
            .join('\n')}

## Popular Queries
${summary.popularQueries.map(q => `- "${q}"`).join('\n')}

## Insights
${insights.map(insight => `- ${insight}`).join('\n')}

## Performance Trends
${summary.performanceTrends.map(trend => `- ${trend.timestamp.toISOString()}: ${JSON.stringify(trend)}`).join('\n')}`;
    }
}
exports.AnalyticsManager = AnalyticsManager;
