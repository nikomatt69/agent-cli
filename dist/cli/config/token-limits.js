"use strict";
/**
 * Token limits configuration - Optimized for detailed analysis while managing costs
 * Based on maxTokens: 12000 (Claude), Context: 120000 tokens
 * Estimated cost considerations for sustainable operation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COST_ESTIMATES = exports.TOKEN_LIMITS = void 0;
exports.TOKEN_LIMITS = {
    // Analysis limits - Balanced for quality and cost efficiency
    ANALYSIS: {
        PROMPT_MAX_CHARS: 16000, // ~4k tokens (balanced output)
        CONTEXT_MAX_CHARS: 12000, // ~3k tokens (efficient context)
        COMPACT_MAX_CHARS: 20000, // ~5k tokens (good detail level)
        MAX_DIRECTORIES: 150, // Adequate structure analysis
        MAX_FILES: 300, // Sufficient file coverage
    },
    // Display limits - For UI/UX (modest increase, minimal cost impact)
    DISPLAY: {
        CONVERSATION_SUMMARY: 200, // Up from 100 (better context)
        TASK_DESCRIPTION: 100, // Up from 50 (clearer descriptions)
        FILE_PREVIEW: 300, // Up from 200 (adequate file understanding)
        ERROR_CONTEXT: 250, // Up from 200 (better debugging)
        QUERY_TRUNCATION: 250, // Up from 200 (preserve user intent)
    },
    // Cache limits - For performance (balanced increase, cost-conscious)
    CACHE: {
        SYSTEM_CONTEXT: 800, // Up from 200 (better cache hits)
        COMPLETION_CONTEXT: 500, // Maintained (adequate caching)
        RESPONSE_PREVIEW: 800, // Up from 200 (better preview quality)
    },
    // List/Array limits - For comprehensive coverage
    ARRAYS: {
        RECENT_FILES: 15, // Up from 5 (better context)
        POPULAR_QUERIES: 10, // Up from 5 (better analytics)
        TODO_DISPLAY: 10, // Up from 5 (better task visibility)
        EXECUTION_CONTEXT: 8, // Up from 3 (better debugging)
        AFFECTED_FILES: 12, // Up from 5 (better impact view)
        DIRECTORY_SAMPLE: 20, // Up from 5 (better structure view)
    }
};
/**
 * Cost estimation helper
 * Rough estimates for monitoring usage
 */
exports.COST_ESTIMATES = {
    // Per 1000 tokens (approximate)
    CLAUDE_INPUT_COST: 0.003, // $3 per 1M tokens
    CLAUDE_OUTPUT_COST: 0.015, // $15 per 1M tokens
    // Daily usage estimates with new limits
    ESTIMATED_DAILY_TOKENS: 50000, // Conservative estimate
    ESTIMATED_DAILY_COST: 0.90, // ~$0.90/day with new limits
};
