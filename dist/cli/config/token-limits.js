"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COST_ESTIMATES = exports.TOKEN_LIMITS = void 0;
exports.TOKEN_LIMITS = {
    ANALYSIS: {
        PROMPT_MAX_CHARS: 16000,
        CONTEXT_MAX_CHARS: 12000,
        COMPACT_MAX_CHARS: 20000,
        MAX_DIRECTORIES: 150,
        MAX_FILES: 300,
    },
    DISPLAY: {
        CONVERSATION_SUMMARY: 200,
        TASK_DESCRIPTION: 100,
        FILE_PREVIEW: 300,
        ERROR_CONTEXT: 250,
        QUERY_TRUNCATION: 250,
    },
    CACHE: {
        SYSTEM_CONTEXT: 800,
        COMPLETION_CONTEXT: 500,
        RESPONSE_PREVIEW: 800,
    },
    ARRAYS: {
        RECENT_FILES: 15,
        POPULAR_QUERIES: 10,
        TODO_DISPLAY: 10,
        EXECUTION_CONTEXT: 8,
        AFFECTED_FILES: 12,
        DIRECTORY_SAMPLE: 20,
    }
};
exports.COST_ESTIMATES = {
    CLAUDE_INPUT_COST: 0.003,
    CLAUDE_OUTPUT_COST: 0.015,
    ESTIMATED_DAILY_TOKENS: 50000,
    ESTIMATED_DAILY_COST: 0.90,
};
