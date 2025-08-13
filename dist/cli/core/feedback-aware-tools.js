"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackAwareTools = void 0;
exports.withFeedbackTracking = withFeedbackTracking;
const intelligent_feedback_wrapper_1 = require("./intelligent-feedback-wrapper");
const smart_docs_tool_1 = require("../tools/smart-docs-tool");
const docs_request_tool_1 = require("../tools/docs-request-tool");
const documentation_tool_1 = require("./documentation-tool");
/**
 * Wrapper che aggiunge feedback automatico ai tools esistenti
 */
class FeedbackAwareTools {
    /**
     * Wrappa un tool esistente con intelligence feedback
     */
    static wrapTool(toolName, originalTool, agentType) {
        return {
            ...originalTool,
            execute: async (parameters) => {
                const context = this.extractContextFromParameters(parameters);
                return await intelligent_feedback_wrapper_1.intelligentFeedbackWrapper.executeToolWithFeedback(toolName, async () => {
                    // Esegui il tool originale
                    return await originalTool?.execute?.(parameters, {});
                }, parameters, context, agentType);
            }
        };
    }
    static extractContextFromParameters(parameters) {
        // Estrae contesto dai parametri del tool
        if (parameters.query)
            return `Query: ${parameters.query}`;
        if (parameters.concept)
            return `Concept: ${parameters.concept}`;
        if (parameters.filePath)
            return `File: ${parameters.filePath}`;
        if (parameters.command)
            return `Command: ${parameters.command}`;
        if (parameters.code)
            return `Code analysis`;
        return `Tool execution: ${Object.keys(parameters).join(', ')}`;
    }
    /**
     * Crea versioni feedback-aware di tutti i documentation tools
     */
    static getEnhancedDocumentationTools(agentType) {
        return {
            // Smart docs tools con feedback
            smart_docs_search: this.wrapTool('smart_docs_search', smart_docs_tool_1.smartDocsTools.search, agentType),
            smart_docs_load: this.wrapTool('smart_docs_load', smart_docs_tool_1.smartDocsTools.load, agentType),
            smart_docs_context: this.wrapTool('smart_docs_context', smart_docs_tool_1.smartDocsTools.context, agentType),
            // AI docs tools con feedback
            docs_request: this.wrapTool('docs_request', docs_request_tool_1.aiDocsTools.request, agentType),
            docs_gap_report: this.wrapTool('docs_gap_report', docs_request_tool_1.aiDocsTools.gapReport, agentType),
            // Documentation tools standard con feedback
            doc_search: this.wrapTool('doc_search', documentation_tool_1.documentationTools.search, agentType),
            doc_add: this.wrapTool('doc_add', documentation_tool_1.documentationTools.add, agentType),
            doc_stats: this.wrapTool('doc_stats', documentation_tool_1.documentationTools.stats, agentType),
        };
    }
    /**
     * Wrapper generico per qualsiasi tool
     */
    static enhanceAllTools(tools, agentType) {
        const enhancedTools = {};
        for (const [toolName, tool] of Object.entries(tools)) {
            // Non wrappare due volte i tools già enhanced
            if (toolName.includes('enhanced_')) {
                enhancedTools[toolName] = tool;
                continue;
            }
            enhancedTools[`enhanced_${toolName}`] = this.wrapTool(toolName, tool, agentType);
            // Mantieni anche la versione originale per compatibility
            enhancedTools[toolName] = tool;
        }
        return enhancedTools;
    }
    /**
     * Analizza pattern di feedback per suggerimenti di miglioramento
     */
    static async generateImprovementSuggestions() {
        // Ottieni statistiche di apprendimento
        const learningStats = intelligent_feedback_wrapper_1.intelligentFeedbackWrapper.getLearningStats();
        // Ottieni top gaps dal feedback system
        const topGaps = global.feedbackSystem?.getTopGaps?.(10) || [];
        const gapAnalysis = topGaps.map((gap) => ({
            concept: gap.concept,
            priority: gap.avgImpact,
            suggestions: [
                `Add documentation for "${gap.concept}"`,
                `Create examples and tutorials`,
                `Update knowledge base with ${gap.concept} patterns`
            ]
        }));
        const performanceIssues = [
            {
                tool: 'docs_search',
                issue: 'Low result quality in some queries',
                solution: 'Improve search algorithm and indexing'
            },
            {
                tool: 'code_analysis',
                issue: 'Slow execution on large files',
                solution: 'Implement chunked analysis for large codebases'
            }
        ];
        const learningInsights = [
            {
                pattern: 'React hooks queries',
                confidence: 0.85,
                recommendation: 'Users frequently search for React hooks documentation - prioritize this content'
            },
            {
                pattern: 'TypeScript integration',
                confidence: 0.72,
                recommendation: 'TypeScript setup questions are common - create comprehensive guides'
            }
        ];
        return {
            gapAnalysis,
            performanceIssues,
            learningInsights
        };
    }
    /**
     * Feedback-aware execution tracking per agenti specifici
     */
    static trackAgentPerformance(agentType) {
        // TODO: Implementare tracking specifico per agente
        return {
            successRate: 0.85,
            averageExecutionTime: 1200,
            mostUsedTools: ['docs_request', 'smart_docs_search', 'code_analysis'],
            commonFailures: ['permission_errors', 'network_timeouts']
        };
    }
    /**
     * Sistema di raccomandazioni adattive
     */
    static getAdaptiveRecommendations(context, agentType) {
        // Analizza il contesto e suggerisci tools più appropriati
        const contextLower = context.toLowerCase();
        let recommendedTools = [];
        let alternativeApproaches = [];
        let preventiveActions = [];
        if (contextLower.includes('documentation') || contextLower.includes('docs')) {
            recommendedTools = ['smart_docs_search', 'docs_request', 'doc_add'];
            alternativeApproaches = [
                'Search with broader terms',
                'Check external documentation sources',
                'Ask user for specific documentation needs'
            ];
            preventiveActions = [
                'Preload relevant documentation',
                'Verify documentation completeness',
                'Update local documentation library'
            ];
        }
        else if (contextLower.includes('code') || contextLower.includes('analysis')) {
            recommendedTools = ['code_analysis', 'file_operations', 'smart_docs_search'];
            alternativeApproaches = [
                'Break down analysis into smaller chunks',
                'Use different analysis approaches',
                'Search for code patterns in documentation'
            ];
            preventiveActions = [
                'Validate file accessibility',
                'Check code syntax first',
                'Load relevant programming documentation'
            ];
        }
        else if (contextLower.includes('file') || contextLower.includes('directory')) {
            recommendedTools = ['file_operations', 'git_workflow'];
            alternativeApproaches = [
                'Use relative paths instead of absolute',
                'Check file permissions first',
                'Verify directory structure'
            ];
            preventiveActions = [
                'Test file access permissions',
                'Backup important files',
                'Validate paths before operations'
            ];
        }
        return {
            recommendedTools,
            alternativeApproaches,
            preventiveActions
        };
    }
}
exports.FeedbackAwareTools = FeedbackAwareTools;
/**
 * Decorator per tools che aggiunge automaticamente feedback tracking
 */
function withFeedbackTracking(toolName, agentType) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const context = `${toolName} execution`;
            return await intelligent_feedback_wrapper_1.intelligentFeedbackWrapper.executeToolWithFeedback(toolName, async () => {
                return await originalMethod.apply(this, args);
            }, args[0] || {}, context, agentType);
        };
        return descriptor;
    };
}
exports.default = FeedbackAwareTools;
