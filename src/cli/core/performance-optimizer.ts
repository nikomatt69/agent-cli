import { CoreMessage } from 'ai';
import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
    tokenCount: number;
    processingTime: number;
    cacheHitRate: number;
    toolCallCount: number;
    responseQuality: number;
}

// Quiet logging utility for cache operations
export class QuietCacheLogger {
    private static readonly CACHE_ICON = '💾';
    private static totalSavings: number = 0;
    
    static logCacheSave(tokensSaved?: number): void {
        if (tokensSaved && tokensSaved > 0) {
            this.totalSavings += tokensSaved;
            process.stdout.write(this.CACHE_ICON);
        }
    }
    
    static getTotalSavings(): number {
        return this.totalSavings;
    }
    
    static resetSavings(): void {
        this.totalSavings = 0;
    }
}

// Token optimization interface
export interface TokenOptimizationResult {
    content: string;
    originalTokens: number;
    optimizedTokens: number;
    tokensSaved: number;
    compressionRatio: number;
}

export interface TokenOptimizationConfig {
    level: 'conservative' | 'balanced' | 'aggressive';
    enablePredictive: boolean;
    enableMicroCache: boolean;
    maxCompressionRatio: number;
}

// Main token optimizer class
export class TokenOptimizer {
    private config: TokenOptimizationConfig;
    private compressionDictionary: Map<string, string> = new Map();
    private usagePatterns: Map<string, number> = new Map();
    
    constructor(config: TokenOptimizationConfig = {
        level: 'balanced',
        enablePredictive: true,
        enableMicroCache: true,
        maxCompressionRatio: 0.6
    }) {
        this.config = config;
        this.initializeCompressionDictionary();
    }
    
    private initializeCompressionDictionary(): void {
        // Common programming terms compression
        this.compressionDictionary.set('function', 'fn');
        this.compressionDictionary.set('implement', 'impl');
        this.compressionDictionary.set('configuration', 'config');
        this.compressionDictionary.set('component', 'comp');
        this.compressionDictionary.set('interface', 'intfc');
        this.compressionDictionary.set('performance', 'perf');
        this.compressionDictionary.set('optimization', 'opt');
        this.compressionDictionary.set('application', 'app');
        this.compressionDictionary.set('development', 'dev');
        this.compressionDictionary.set('management', 'mgmt');
    }
    
    async optimizePrompt(input: string): Promise<TokenOptimizationResult> {
        const originalTokens = this.estimateTokens(input);
        let optimized = input;
        
        switch (this.config.level) {
            case 'conservative':
                optimized = this.conservativeOptimization(input);
                break;
            case 'balanced':
                optimized = this.balancedOptimization(input);
                break;
            case 'aggressive':
                optimized = this.aggressiveOptimization(input);
                break;
        }
        
        const optimizedTokens = this.estimateTokens(optimized);
        const tokensSaved = originalTokens - optimizedTokens;
        const compressionRatio = optimizedTokens / originalTokens;
        
        // Log cache save if significant savings
        if (tokensSaved > 5) {
            QuietCacheLogger.logCacheSave(tokensSaved);
        }
        
        return {
            content: optimized,
            originalTokens,
            optimizedTokens,
            tokensSaved,
            compressionRatio
        };
    }
    
    private conservativeOptimization(text: string): string {
        return text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\b(um|uh|well)\b/gi, '') // Remove obvious filler
            .trim();
    }
    
    private balancedOptimization(text: string): string {
        let optimized = this.conservativeOptimization(text);
        
        // Apply compression dictionary
        this.compressionDictionary.forEach((short, full) => {
            const regex = new RegExp(`\\b${full}\\b`, 'gi');
            optimized = optimized.replace(regex, short);
        });
        
        // Remove redundant phrases
        optimized = optimized
            .replace(/\b(please note that|it should be noted)\b/gi, '')
            .replace(/\b(in my opinion|I think|I believe)\b/gi, '')
            .replace(/\bfor example\b/gi, 'e.g.')
            .replace(/\bthat is\b/gi, 'i.e.');
        
        return optimized.replace(/\s+/g, ' ').trim();
    }
    
    private aggressiveOptimization(text: string): string {
        let optimized = this.balancedOptimization(text);
        
        // More aggressive compression
        optimized = optimized
            .replace(/\b(very|really|quite|extremely)\s+/gi, '')
            .replace(/\b(basically|essentially|fundamentally)\b/gi, '')
            .replace(/\b(you should|you must|you need to)\b/gi, '')
            .replace(/\bin order to\b/gi, 'to')
            .replace(/\band so on\b/gi, 'etc.');
        
        return optimized.replace(/\s+/g, ' ').trim();
    }
    
    private estimateTokens(text: string): number {
        if (!text) return 0;
        const words = text.split(/\s+/).filter(word => word.length > 0);
        const specialChars = (text.match(/[{}[\](),.;:!?'"]/g) || []).length;
        return Math.ceil((words.length + specialChars * 0.5) * 1.3);
    }
}

export class PerformanceOptimizer {
    private metrics: Map<string, PerformanceMetrics> = new Map();
    private startTime: number = 0;
    private tokenOptimizer: TokenOptimizer;

    constructor(optimizationConfig?: TokenOptimizationConfig) {
        this.tokenOptimizer = new TokenOptimizer(optimizationConfig);
    }

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

    // Optimize messages for better performance with token optimization
    async optimizeMessages(messages: CoreMessage[]): Promise<CoreMessage[]> {
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

        // Apply token optimization to each message
        for (let i = 0; i < optimized.length; i++) {
            if (typeof optimized[i].content === 'string') {
                const result = await this.tokenOptimizer.optimizePrompt(optimized[i].content as string);
                (optimized[i] as any).content = result.content;
            }
        }

        return optimized;
    }

    // Get token optimizer instance
    getTokenOptimizer(): TokenOptimizer {
        return this.tokenOptimizer;
    }

    // Optimize single text content
    async optimizeText(text: string): Promise<TokenOptimizationResult> {
        return this.tokenOptimizer.optimizePrompt(text);
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
