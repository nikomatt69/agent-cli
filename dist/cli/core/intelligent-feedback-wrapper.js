"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelligentFeedbackWrapper = exports.IntelligentFeedbackWrapper = void 0;
const chalk_1 = __importDefault(require("chalk"));
const feedback_system_1 = require("./feedback-system");
class IntelligentFeedbackWrapper {
    constructor() {
        this.learningPatterns = new Map();
        this.executionHistory = [];
        this.maxHistorySize = 1000;
        this.loadLearningPatterns();
    }
    /**
     * Wrapper per l'esecuzione dei tools che raccoglie feedback automaticamente
     */
    async executeToolWithFeedback(toolName, toolFunction, parameters, context, agentType) {
        const startTime = Date.now();
        try {
            // Esecuzione silenziosa - niente output per utente
            const result = await toolFunction();
            const executionTime = Date.now() - startTime;
            const executionResult = {
                success: true,
                toolName,
                parameters,
                result,
                executionTime,
                context,
                agentType
            };
            await this.analyzeAndGenerateFeedback(executionResult);
            this.addToHistory(executionResult);
            return result;
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            const executionResult = {
                success: false,
                toolName,
                parameters,
                result: null,
                error: error.message,
                executionTime,
                context,
                agentType
            };
            await this.analyzeAndGenerateFeedback(executionResult);
            this.addToHistory(executionResult);
            throw error;
        }
    }
    /**
     * Analizza i risultati e genera feedback intelligente
     */
    async analyzeAndGenerateFeedback(execution) {
        const { success, toolName, parameters, result, error, context, agentType } = execution;
        // 1. Feedback basato su successo/fallimento
        if (success) {
            await this.handleSuccessfulExecution(execution);
        }
        else {
            await this.handleFailedExecution(execution);
        }
        // 2. Feedback specifico per tipo di tool
        await this.handleToolSpecificFeedback(execution);
        // 3. Aggiorna pattern di apprendimento
        this.updateLearningPatterns(execution);
        // 4. Analisi performance
        this.analyzePerformance(execution);
    }
    async handleSuccessfulExecution(execution) {
        const { toolName, result, context, agentType, executionTime } = execution;
        // Feedback per successi significativi
        if (this.isSignificantSuccess(execution)) {
            await feedback_system_1.feedbackSystem.reportSuccess(toolName, context, `Successfully executed ${toolName} with positive outcome`, {
                agentType,
                sessionId: execution.context
            });
        }
        // Analisi qualità risultato
        const qualityScore = this.assessResultQuality(execution);
        if (qualityScore < 0.7) {
            await feedback_system_1.feedbackSystem.reportDocGap(`${toolName} result quality`, `Tool ${toolName} succeeded but result quality could be improved`, 'medium', 'occasional', {
                agentType,
                sessionId: execution.context,
                toolName: execution.toolName,
                errorType: 'quality_score',
                operation: execution.parameters.operation || 'unknown'
            });
        }
    }
    async handleFailedExecution(execution) {
        const { toolName, error, context, agentType, parameters } = execution;
        // Classifica tipo di errore
        const errorType = this.classifyError(error || '');
        const impact = this.determineErrorImpact(execution);
        await feedback_system_1.feedbackSystem.reportDocGap(`${toolName} execution failure`, `Tool ${toolName} failed: ${error}. Context: ${context}`, impact, 'occasional', {
            agentType,
            sessionId: execution.context,
            toolName: execution.toolName,
            errorType: errorType,
            operation: execution.parameters.operation || 'unknown'
        });
        // Suggerisci soluzioni alternative
        const alternatives = this.suggestAlternatives(execution);
        if (alternatives.length > 0) {
            console.log(chalk_1.default.yellow(`💡 Suggested alternatives for ${toolName}:`));
            alternatives.forEach(alt => console.log(chalk_1.default.gray(`   - ${alt}`)));
        }
    }
    async handleToolSpecificFeedback(execution) {
        const { toolName, result, success, parameters } = execution;
        switch (toolName) {
            case 'smart_docs_search':
                await this.handleDocsSearchFeedback(execution);
                break;
            case 'docs_request':
                await this.handleDocsRequestFeedback(execution);
                break;
            case 'file_operations':
                await this.handleFileOperationsFeedback(execution);
                break;
            case 'code_analysis':
                await this.handleCodeAnalysisFeedback(execution);
                break;
            default:
                // Feedback generico per altri tools
                await this.handleGenericToolFeedback(execution);
        }
    }
    async handleDocsSearchFeedback(execution) {
        const { result, parameters, context } = execution;
        if (execution.success && result) {
            const foundResults = result.totalResults || 0;
            const query = parameters.query || 'unknown';
            if (foundResults === 0) {
                // Nessun risultato trovato - gap importante
                await feedback_system_1.feedbackSystem.reportDocGap(query, `Documentation search for "${query}" returned no results`, 'high', 'frequent', {
                    agentType: execution.agentType,
                    sessionId: context
                });
            }
            else if (foundResults < 3) {
                // Pochi risultati - possibile miglioramento
                await feedback_system_1.feedbackSystem.reportDocGap(`${query} documentation coverage`, `Limited documentation found for "${query}" (${foundResults} results)`, 'medium', 'occasional', {
                    agentType: execution.agentType,
                    sessionId: execution.context
                });
            }
        }
    }
    async handleDocsRequestFeedback(execution) {
        const { result, parameters, context } = execution;
        if (execution.success && result) {
            const concept = parameters.concept || 'unknown';
            const found = result.found || false;
            if (!found) {
                // Concetto completamente mancante
                await feedback_system_1.feedbackSystem.reportDocGap(concept, `Agent requested documentation for "${concept}" but none available`, parameters.urgency === 'high' ? 'high' : 'medium', 'frequent', {
                    agentType: execution.agentType,
                    sessionId: execution.context,
                    toolName: execution.toolName,
                    errorType: 'not_found',
                    operation: execution.parameters.operation || 'unknown'
                });
            }
        }
    }
    async handleFileOperationsFeedback(execution) {
        // Analisi operazioni file per pattern di errore comuni
        if (!execution.success && execution.error) {
            const isPermissionError = execution.error.includes('permission') || execution.error.includes('EACCES');
            const isNotFoundError = execution.error.includes('ENOENT') || execution.error.includes('not found');
            if (isPermissionError || isNotFoundError) {
                await feedback_system_1.feedbackSystem.reportDocGap('file operations troubleshooting', `Common file operation error encountered: ${execution.error}`, 'medium', 'occasional', {
                    agentType: execution.agentType,
                    sessionId: execution.context,
                    toolName: execution.toolName,
                    errorType: 'not_found',
                    operation: execution.parameters.operation || 'unknown'
                });
            }
        }
    }
    async handleCodeAnalysisFeedback(execution) {
        // Feedback per analisi del codice
        if (execution.success && execution.result) {
            const analysisQuality = this.assessCodeAnalysisQuality(execution.result);
            if (analysisQuality < 0.6) {
                await feedback_system_1.feedbackSystem.reportDocGap('code analysis patterns', 'Code analysis could be improved with better pattern recognition', 'medium', 'occasional', {
                    agentType: execution.agentType,
                    sessionId: execution.context,
                    toolName: execution.toolName,
                    errorType: 'quality_score',
                    operation: execution.parameters.operation || 'unknown'
                });
            }
        }
    }
    async handleGenericToolFeedback(execution) {
        // Pattern analysis per tools generici
        const { toolName, success, executionTime } = execution;
        // Feedback per performance
        if (executionTime > 10000) { // > 10 secondi
            await feedback_system_1.feedbackSystem.reportUsage(`slow_${toolName}`, `Tool ${toolName} took ${executionTime}ms to execute`, {
                agentType: execution.agentType,
                sessionId: execution.context,
                duration: executionTime
            });
        }
        // Pattern di uso frequente
        const recentUsage = this.getRecentToolUsage(toolName);
        if (recentUsage > 5) { // Usato più di 5 volte di recente
            await feedback_system_1.feedbackSystem.reportUsage(`frequent_${toolName}`, `Tool ${toolName} used frequently (${recentUsage} times recently)`, {
                agentType: execution.agentType,
                sessionId: execution.context,
                duration: executionTime
            });
        }
    }
    updateLearningPatterns(execution) {
        const { toolName, success, parameters, context } = execution;
        const patternKey = `${toolName}_${this.extractConceptFromContext(context)}`;
        let pattern = this.learningPatterns.get(patternKey);
        if (!pattern) {
            pattern = {
                concept: patternKey,
                successfulApproaches: [],
                failedApproaches: [],
                contextPatterns: [],
                confidenceScore: 0.5,
                lastUpdated: new Date().toISOString()
            };
        }
        const approach = JSON.stringify(parameters);
        if (success) {
            if (!pattern.successfulApproaches.includes(approach)) {
                pattern.successfulApproaches.push(approach);
                pattern.confidenceScore = Math.min(pattern.confidenceScore + 0.1, 1.0);
            }
        }
        else {
            if (!pattern.failedApproaches.includes(approach)) {
                pattern.failedApproaches.push(approach);
                pattern.confidenceScore = Math.max(pattern.confidenceScore - 0.1, 0.0);
            }
        }
        // Mantieni solo i pattern più recenti
        pattern.successfulApproaches = pattern.successfulApproaches.slice(-10);
        pattern.failedApproaches = pattern.failedApproaches.slice(-10);
        if (!pattern.contextPatterns.includes(context)) {
            pattern.contextPatterns.push(context);
            pattern.contextPatterns = pattern.contextPatterns.slice(-5);
        }
        pattern.lastUpdated = new Date().toISOString();
        this.learningPatterns.set(patternKey, pattern);
        // Salva pattern periodicamente
        if (this.learningPatterns.size % 10 === 0) {
            this.saveLearningPatterns();
        }
    }
    isSignificantSuccess(execution) {
        const { toolName, result, executionTime } = execution;
        // Successo significativo se:
        // 1. Tool di documentazione trova risultati utili
        if (toolName.includes('docs') && result && result.found && result.totalResults > 0) {
            return true;
        }
        // 2. Operazione complessa completata velocemente
        if (executionTime < 1000 && ['code_analysis', 'file_operations', 'git_workflow'].includes(toolName)) {
            return true;
        }
        // 3. Prima volta che un tool riesce in un contesto specifico
        const recentFailures = this.getRecentFailures(toolName, execution.context);
        return recentFailures > 2;
    }
    assessResultQuality(execution) {
        const { result, toolName } = execution;
        if (!result)
            return 0;
        // Criteri specifici per tipo di tool
        switch (toolName) {
            case 'smart_docs_search':
                return this.assessDocsSearchQuality(result);
            case 'code_analysis':
                return this.assessCodeAnalysisQuality(result);
            default:
                return 0.8; // Default quality score
        }
    }
    assessDocsSearchQuality(result) {
        let score = 0.5;
        if (result.found)
            score += 0.3;
        if (result.totalResults > 0)
            score += 0.2;
        if (result.totalResults > 3)
            score += 0.1;
        if (result.contextUpdated)
            score += 0.2;
        return Math.min(score, 1.0);
    }
    assessCodeAnalysisQuality(result) {
        let score = 0.5;
        if (result.suggestions && result.suggestions.length > 0)
            score += 0.2;
        if (result.issues && result.issues.length > 0)
            score += 0.2;
        if (result.complexity !== undefined)
            score += 0.1;
        return Math.min(score, 1.0);
    }
    classifyError(error) {
        if (error.includes('permission') || error.includes('EACCES'))
            return 'permission';
        if (error.includes('not found') || error.includes('ENOENT'))
            return 'not_found';
        if (error.includes('timeout'))
            return 'timeout';
        if (error.includes('network') || error.includes('connection'))
            return 'network';
        if (error.includes('syntax') || error.includes('parse'))
            return 'syntax';
        return 'unknown';
    }
    determineErrorImpact(execution) {
        const { toolName, error } = execution;
        // Tool critici hanno impatto alto
        if (['file_operations', 'git_workflow', 'docs_request'].includes(toolName)) {
            return 'high';
        }
        // Errori di permesso/accesso sono sempre significativi
        if (error && (error.includes('permission') || error.includes('EACCES'))) {
            return 'high';
        }
        return 'medium';
    }
    suggestAlternatives(execution) {
        const { toolName } = execution;
        const alternatives = [];
        const pattern = this.learningPatterns.get(`${toolName}_${this.extractConceptFromContext(execution.context)}`);
        if (pattern && pattern.successfulApproaches.length > 0) {
            alternatives.push(`Try successful approach: ${pattern.successfulApproaches[0]}`);
        }
        // Suggerimenti specifici per tool
        switch (toolName) {
            case 'smart_docs_search':
                alternatives.push('Try broader search terms', 'Search in different categories', 'Use /doc-add to add relevant documentation');
                break;
            case 'file_operations':
                alternatives.push('Check file permissions', 'Verify file path exists', 'Try relative path instead');
                break;
        }
        return alternatives;
    }
    analyzePerformance(execution) {
        const { toolName, executionTime } = execution;
        // Calcola performance media per questo tool
        const recentExecutions = this.executionHistory
            .filter(e => e.toolName === toolName)
            .slice(-10);
        if (recentExecutions.length > 5) {
            const avgTime = recentExecutions.reduce((sum, e) => sum + e.executionTime, 0) / recentExecutions.length;
            if (executionTime > avgTime * 2) {
                console.log(chalk_1.default.yellow(`⚠️ ${toolName} performance degradation detected (${executionTime}ms vs ${avgTime.toFixed(0)}ms avg)`));
            }
        }
    }
    addToHistory(execution) {
        this.executionHistory.push(execution);
        // Mantieni solo gli ultimi N esecuzioni
        if (this.executionHistory.length > this.maxHistorySize) {
            this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
        }
    }
    getRecentToolUsage(toolName) {
        const recent = Date.now() - (60 * 60 * 1000); // ultima ora
        return this.executionHistory.filter(e => e.toolName === toolName && new Date(e.context).getTime() > recent).length;
    }
    getRecentFailures(toolName, context) {
        const recent = Date.now() - (24 * 60 * 60 * 1000); // ultimo giorno
        return this.executionHistory.filter(e => e.toolName === toolName &&
            !e.success &&
            new Date(e.context).getTime() > recent).length;
    }
    extractConceptFromContext(context) {
        // Estrae concetti chiave dal contesto usando parole chiave
        const keywords = ['react', 'node', 'typescript', 'git', 'file', 'api', 'database'];
        const lowercaseContext = context.toLowerCase();
        for (const keyword of keywords) {
            if (lowercaseContext.includes(keyword)) {
                return keyword;
            }
        }
        return 'general';
    }
    loadLearningPatterns() {
        // TODO: Carica pattern da file locale
        console.debug('Learning patterns loaded');
    }
    saveLearningPatterns() {
        // TODO: Salva pattern su file locale
        console.debug('Learning patterns saved');
    }
    /**
     * Ottieni statistiche di apprendimento
     */
    getLearningStats() {
        const patterns = Array.from(this.learningPatterns.values());
        const avgConfidence = patterns.reduce((sum, p) => sum + p.confidenceScore, 0) / patterns.length || 0;
        const conceptCounts = new Map();
        patterns.forEach(p => {
            const concept = p.concept.split('_')[1] || 'unknown';
            conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
        });
        const topConcepts = Array.from(conceptCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([concept]) => concept);
        const recent = Date.now() - (24 * 60 * 60 * 1000);
        const recentActivity = this.executionHistory.filter(e => new Date(e.context).getTime() > recent).length;
        return {
            totalPatterns: patterns.length,
            avgConfidence: Number(avgConfidence.toFixed(2)),
            topConcepts,
            recentActivity
        };
    }
}
exports.IntelligentFeedbackWrapper = IntelligentFeedbackWrapper;
// Singleton instance
exports.intelligentFeedbackWrapper = new IntelligentFeedbackWrapper();
