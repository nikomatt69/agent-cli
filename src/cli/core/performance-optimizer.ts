import { CoreMessage } from 'ai';
import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
    tokenCount: number;
    processingTime: number;
    cacheHitRate: number;
    toolCallCount: number;
    responseQuality: number;
}

export class PerformanceOptimizer {
    private metrics: Map<string, PerformanceMetrics> = new Map();
    private startTime: number = 0;

    // Start performance monitoring
    startMonitoring(): void {
        this.startTime = performance.now();
    }

    // End monitoring and collect metrics
    endMonitoring(sessionId: string, metrics: Partial<PerformanceMetrics>): PerformanceMetrics {
        const processingTime = performance.now() - this.startTime;

        const fullMetrics: PerformanceMetrics = {
            tokenCount: metrics.tokenCount || 0,
            processingTime,
            cacheHitRate: metrics.cacheHitRate || 0,
            toolCallCount: metrics.toolCallCount || 0,
            responseQuality: metrics.responseQuality || 0
        };

        this.metrics.set(sessionId, fullMetrics);
        return fullMetrics;
    }

    // Optimize messages for better performance
    optimizeMessages(messages: CoreMessage[]): CoreMessage[] {
        const optimized = [...messages];

        // Remove redundant system messages
        const systemMessages = optimized.filter(msg => msg.role === 'system');
        if (systemMessages.length > 1) {
            const mergedSystemContent = systemMessages.map(msg => msg.content).join('\n\n');
            optimized.splice(0, systemMessages.length, {
                role: 'system',
                content: mergedSystemContent
            });
        }

        // Truncate very long messages
        optimized.forEach(msg => {
            if (typeof msg.content === 'string' && msg.content.length > 5000) {
                msg.content = msg.content.substring(0, 5000) + '... [truncated]';
            }
        });

        return optimized;
    }

    // Get performance recommendations
    getRecommendations(sessionId: string): string[] {
        const metrics = this.metrics.get(sessionId);
        if (!metrics) return [];

        const recommendations: string[] = [];

        if (metrics.processingTime > 10000) {
            recommendations.push('Consider using caching for repeated queries');
        }

        if (metrics.tokenCount > 50000) {
            recommendations.push('Reduce context size to improve response time');
        }

        if (metrics.toolCallCount > 10) {
            recommendations.push('Batch tool calls to reduce overhead');
        }

        if (metrics.cacheHitRate < 0.3) {
            recommendations.push('Enable more aggressive caching strategies');
        }

        return recommendations;
    }

    // Analyze response quality
    analyzeResponseQuality(response: string): number {
        let quality = 0;

        // Check for structured content
        if (response.includes('```') || response.includes('**')) quality += 20;

        // Check for actionable content
        if (response.includes('1.') || response.includes('•') || response.includes('-')) quality += 20;

        // Check for code examples
        if (response.includes('const ') || response.includes('function ') || response.includes('import ')) quality += 20;

        // Check for explanations
        if (response.includes('because') || response.includes('therefore') || response.includes('however')) quality += 20;

        // Check for appropriate length
        if (response.length > 100 && response.length < 2000) quality += 20;

        return Math.min(100, quality);
    }

    // Get performance summary
    getPerformanceSummary(): string {
        const sessions = Array.from(this.metrics.values());
        if (sessions.length === 0) return 'No performance data available';

        const avgProcessingTime = sessions.reduce((sum, m) => sum + m.processingTime, 0) / sessions.length;
        const avgTokenCount = sessions.reduce((sum, m) => sum + m.tokenCount, 0) / sessions.length;
        const avgCacheHitRate = sessions.reduce((sum, m) => sum + m.cacheHitRate, 0) / sessions.length;

        return `Performance Summary:
- Average processing time: ${avgProcessingTime.toFixed(2)}ms
- Average token count: ${avgTokenCount.toFixed(0)}
- Average cache hit rate: ${(avgCacheHitRate * 100).toFixed(1)}%
- Total sessions analyzed: ${sessions.length}`;
    }
}
