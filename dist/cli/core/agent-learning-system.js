"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentLearningSystem = exports.AgentLearningSystem = void 0;
const fs = __importStar(require("fs/promises"));
const fsSync = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class AgentLearningSystem {
    constructor() {
        this.learningData = new Map();
        this.maxMemoryEntries = 1000;
        this.learningFile = path.join(os.homedir(), '.nikcli', 'agent-learning.json');
        this.loadLearningData();
    }
    /**
     * Analizza il contesto e fornisce raccomandazioni per la scelta del tool
     */
    async getToolRecommendations(context) {
        const pattern = this.extractPattern(context);
        const learningData = this.learningData.get(pattern);
        if (!learningData) {
            // Nessun apprendimento precedente - usa euristica di base
            return this.getHeuristicRecommendation(context);
        }
        // Analizza successi passati per questo pattern
        const toolScores = this.calculateToolScores(learningData, context);
        const topTool = this.getBestTool(toolScores);
        if (!topTool) {
            return this.getHeuristicRecommendation(context);
        }
        const alternatives = Object.entries(toolScores)
            .filter(([tool, score]) => tool !== topTool.tool && score > 0.3)
            .map(([tool, score]) => ({
            tool,
            confidence: score,
            reason: this.getToolReason(tool, learningData)
        }))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3);
        return {
            recommendedTool: topTool.tool,
            confidence: topTool.score,
            reasoning: this.generateReasoning(topTool.tool, learningData, context),
            alternatives,
            preventiveActions: this.generatePreventiveActions(learningData, context)
        };
    }
    /**
     * Registra il risultato di una decisione per apprendimento futuro
     */
    async recordDecision(context, chosenTool, parameters, outcome, executionTime, error) {
        const pattern = this.extractPattern(context);
        let learningData = this.learningData.get(pattern);
        if (!learningData) {
            learningData = {
                contextPattern: pattern,
                successfulChoices: [],
                failurePatterns: [],
                lastUpdated: new Date().toISOString()
            };
        }
        // Registra scelta
        learningData.successfulChoices.push({
            tool: chosenTool,
            parameters,
            outcome,
            executionTime,
            timestamp: new Date().toISOString()
        });
        // Registra pattern di fallimento se necessario
        if (outcome === 'failure' && error) {
            let failurePattern = learningData.failurePatterns.find(fp => fp.tool === chosenTool && fp.error === error);
            if (failurePattern) {
                failurePattern.frequency++;
            }
            else {
                learningData.failurePatterns.push({
                    tool: chosenTool,
                    error,
                    frequency: 1
                });
            }
        }
        // Mantieni solo gli ultimi N record per evitare crescita eccessiva
        learningData.successfulChoices = learningData.successfulChoices
            .slice(-100); // Ultimi 100 per pattern
        learningData.failurePatterns = learningData.failurePatterns
            .filter(fp => fp.frequency > 1) // Mantieni solo errori ricorrenti
            .slice(-20); // Massimo 20 pattern di errore
        learningData.lastUpdated = new Date().toISOString();
        this.learningData.set(pattern, learningData);
        // Salva periodicamente
        if (this.learningData.size % 10 === 0) {
            await this.saveLearningData();
        }
    }
    /**
     * Ottieni insight di apprendimento per un agente specifico
     */
    getAgentInsights(agentType) {
        const allChoices = Array.from(this.learningData.values())
            .flatMap(ld => ld.successfulChoices);
        const allFailures = Array.from(this.learningData.values())
            .flatMap(ld => ld.failurePatterns);
        // Tool più usato con successo
        const toolUsage = new Map();
        allChoices.forEach(choice => {
            if (!toolUsage.has(choice.tool)) {
                toolUsage.set(choice.tool, { success: 0, total: 0 });
            }
            const usage = toolUsage.get(choice.tool);
            usage.total++;
            if (choice.outcome === 'success') {
                usage.success++;
            }
        });
        const bestTool = Array.from(toolUsage.entries())
            .sort((a, b) => (b[1].success / b[1].total) - (a[1].success / a[1].total))[0]?.[0] || 'unknown';
        // Calcola confidence score complessivo
        const totalSuccesses = allChoices.filter(c => c.outcome === 'success').length;
        const totalAttempts = allChoices.length;
        const confidenceScore = totalAttempts > 0 ? totalSuccesses / totalAttempts : 0.5;
        // Suggerimenti di miglioramento
        const improvementSuggestions = this.generateImprovementSuggestions(allFailures, toolUsage);
        return {
            totalPatterns: this.learningData.size,
            mostSuccessfulTool: bestTool,
            commonFailures: allFailures
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 5),
            improvementSuggestions,
            confidenceScore: Number(confidenceScore.toFixed(2))
        };
    }
    /**
     * Predice la probabilità di successo per una scelta specifica
     */
    predictSuccessProbability(context, proposedTool, parameters) {
        const pattern = this.extractPattern(context);
        const learningData = this.learningData.get(pattern);
        if (!learningData) {
            // Nessun dato storico - usa confidenza base
            return this.getBaseConfidence(proposedTool, context);
        }
        const relevantChoices = learningData.successfulChoices
            .filter(choice => choice.tool === proposedTool);
        if (relevantChoices.length === 0) {
            return this.getBaseConfidence(proposedTool, context);
        }
        const successes = relevantChoices.filter(choice => choice.outcome === 'success').length;
        const probability = successes / relevantChoices.length;
        // Aggiusta basandoti su failure patterns
        const relevantFailures = learningData.failurePatterns
            .filter(fp => fp.tool === proposedTool);
        let adjustment = 0;
        relevantFailures.forEach(failure => {
            adjustment -= (failure.frequency * 0.05); // Riduce probabilità per errori frequenti
        });
        return Math.max(0.1, Math.min(0.95, probability + adjustment));
    }
    /**
     * Sistema di raccomandazioni adattive basato su contesto
     */
    getAdaptiveStrategy(context) {
        const pattern = this.extractPattern(context);
        const learningData = this.learningData.get(pattern);
        // Analizza storico per determinare strategia
        if (!learningData || learningData.successfulChoices.length < 5) {
            return {
                strategy: 'exploratory',
                reasoning: 'Limited historical data available - exploring different approaches',
                toolPreferences: this.getExploratoryTools(context)
            };
        }
        const recentChoices = learningData.successfulChoices.slice(-10);
        const successRate = recentChoices.filter(c => c.outcome === 'success').length / recentChoices.length;
        const avgExecutionTime = recentChoices.reduce((sum, c) => sum + c.executionTime, 0) / recentChoices.length;
        if (successRate > 0.8 && avgExecutionTime < 5000) {
            return {
                strategy: 'conservative',
                reasoning: 'High success rate with good performance - stick to proven approaches',
                toolPreferences: this.getProvenTools(learningData)
            };
        }
        else if (context.urgency === 'high' && successRate > 0.6) {
            return {
                strategy: 'aggressive',
                reasoning: 'High urgency context - use fastest reliable tools',
                toolPreferences: this.getFastestReliableTools(learningData)
            };
        }
        else {
            return {
                strategy: 'exploratory',
                reasoning: 'Mixed results or new patterns - trying alternative approaches',
                toolPreferences: this.getAlternativeTools(learningData, context)
            };
        }
    }
    extractPattern(context) {
        // Crea pattern identificativo basato su task e contesto
        const taskKey = context.task.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(' ')
            .slice(0, 3)
            .join('_');
        const contextKey = context.userContext.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(' ')
            .slice(0, 2)
            .join('_');
        return `${taskKey}_${contextKey}`;
    }
    calculateToolScores(learningData, context) {
        const scores = {};
        // Analizza scelte passate
        learningData.successfulChoices.forEach(choice => {
            if (!scores[choice.tool])
                scores[choice.tool] = 0;
            // Peso basato su outcome
            const outcomeWeight = choice.outcome === 'success' ? 1 : -0.5;
            // Peso basato su tempo (preferisci esecuzioni più veloci)
            const timeWeight = choice.executionTime < 3000 ? 1.2 : choice.executionTime < 10000 ? 1.0 : 0.8;
            // Peso basato su recency (preferisci dati più recenti)
            const age = Date.now() - new Date(choice.timestamp).getTime();
            const recencyWeight = Math.max(0.5, 1 - (age / (30 * 24 * 60 * 60 * 1000))); // Decadimento in 30 giorni
            scores[choice.tool] += outcomeWeight * timeWeight * recencyWeight * 0.1;
        });
        // Penalizza tools con failure patterns
        learningData.failurePatterns.forEach(failure => {
            if (scores[failure.tool]) {
                scores[failure.tool] -= failure.frequency * 0.05;
            }
        });
        // Normalizza scores
        const maxScore = Math.max(...Object.values(scores));
        if (maxScore > 0) {
            Object.keys(scores).forEach(tool => {
                scores[tool] = scores[tool] / maxScore;
            });
        }
        return scores;
    }
    getBestTool(scores) {
        const entries = Object.entries(scores);
        if (entries.length === 0)
            return null;
        const [tool, score] = entries.reduce((best, current) => current[1] > best[1] ? current : best);
        return { tool, score };
    }
    getHeuristicRecommendation(context) {
        // Raccomandazioni basate su euristica quando non c'è apprendimento
        const taskLower = context.task.toLowerCase();
        let recommendedTool = 'docs_request';
        let reasoning = 'Default recommendation for documentation tasks';
        if (taskLower.includes('file') || taskLower.includes('read') || taskLower.includes('write')) {
            recommendedTool = 'read_file';
            reasoning = 'File operation detected in task description';
        }
        else if (taskLower.includes('search') || taskLower.includes('find')) {
            recommendedTool = 'smart_docs_search';
            reasoning = 'Search operation detected in task description';
        }
        else if (taskLower.includes('analysis') || taskLower.includes('analyze')) {
            recommendedTool = 'code_analysis';
            reasoning = 'Analysis task detected in task description';
        }
        else if (taskLower.includes('git') || taskLower.includes('commit')) {
            recommendedTool = 'git_workflow';
            reasoning = 'Git operation detected in task description';
        }
        return {
            recommendedTool,
            confidence: 0.6,
            reasoning,
            alternatives: [],
            preventiveActions: ['Verify tool availability', 'Check required parameters']
        };
    }
    generateReasoning(tool, learningData, context) {
        const relevantChoices = learningData.successfulChoices.filter(c => c.tool === tool);
        const successRate = relevantChoices.filter(c => c.outcome === 'success').length / relevantChoices.length;
        const avgTime = relevantChoices.reduce((sum, c) => sum + c.executionTime, 0) / relevantChoices.length;
        return `Tool ${tool} recommended based on ${(successRate * 100).toFixed(0)}% success rate ` +
            `in similar contexts (avg execution: ${avgTime.toFixed(0)}ms)`;
    }
    generatePreventiveActions(learningData, context) {
        const actions = [];
        // Analizza failure patterns comuni
        const commonFailures = learningData.failurePatterns
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 3);
        commonFailures.forEach(failure => {
            if (failure.error.includes('permission')) {
                actions.push('Verify file/directory permissions before execution');
            }
            else if (failure.error.includes('not found')) {
                actions.push('Check file/path existence before operation');
            }
            else if (failure.error.includes('timeout')) {
                actions.push('Consider breaking down large operations into smaller chunks');
            }
        });
        if (actions.length === 0) {
            actions.push('Monitor execution for any unusual patterns');
        }
        return actions;
    }
    generateImprovementSuggestions(failures, toolUsage) {
        const suggestions = [];
        // Analizza pattern di fallimento
        const groupedFailures = new Map();
        failures.forEach(f => {
            groupedFailures.set(f.error, (groupedFailures.get(f.error) || 0) + f.frequency);
        });
        const topFailures = Array.from(groupedFailures.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        topFailures.forEach(([error, frequency]) => {
            if (error.includes('permission')) {
                suggestions.push('Implement permission checking before file operations');
            }
            else if (error.includes('timeout')) {
                suggestions.push('Add timeout handling and retry mechanisms');
            }
            else if (error.includes('not found')) {
                suggestions.push('Add existence validation before operations');
            }
        });
        // Analizza tool performance
        const lowPerformanceTools = Array.from(toolUsage.entries())
            .filter(([tool, usage]) => usage.total > 5 && (usage.success / usage.total) < 0.7)
            .map(([tool]) => tool);
        if (lowPerformanceTools.length > 0) {
            suggestions.push(`Review and improve reliability of: ${lowPerformanceTools.join(', ')}`);
        }
        return suggestions;
    }
    getBaseConfidence(tool, context) {
        // Confidence di base senza dati storici
        const toolConfidence = {
            'docs_request': 0.8,
            'smart_docs_search': 0.85,
            'read_file': 0.9,
            'write_file': 0.8,
            'code_analysis': 0.75,
            'git_workflow': 0.7,
            'execute_command': 0.65
        };
        return toolConfidence[tool] || 0.6;
    }
    getExploratoryTools(context) {
        return ['docs_request', 'smart_docs_search', 'read_file', 'code_analysis'];
    }
    getProvenTools(learningData) {
        return learningData.successfulChoices
            .filter(c => c.outcome === 'success')
            .map(c => c.tool)
            .slice(0, 3);
    }
    getFastestReliableTools(learningData) {
        return learningData.successfulChoices
            .filter(c => c.outcome === 'success' && c.executionTime < 5000)
            .sort((a, b) => a.executionTime - b.executionTime)
            .map(c => c.tool)
            .slice(0, 3);
    }
    getAlternativeTools(learningData, context) {
        const usedTools = new Set(learningData.successfulChoices.map(c => c.tool));
        const allTools = context.availableTools;
        return allTools.filter(tool => !usedTools.has(tool)).slice(0, 3);
    }
    getToolReason(tool, learningData) {
        const choices = learningData.successfulChoices.filter(c => c.tool === tool);
        const successes = choices.filter(c => c.outcome === 'success').length;
        return `${successes}/${choices.length} success rate in similar contexts`;
    }
    async loadLearningData() {
        try {
            if (fsSync.existsSync(this.learningFile)) {
                const data = fsSync.readFileSync(this.learningFile, 'utf-8');
                const parsed = JSON.parse(data);
                this.learningData = new Map(Object.entries(parsed));
            }
        }
        catch (error) {
            console.debug('Could not load agent learning data, starting fresh');
        }
    }
    async saveLearningData() {
        try {
            const data = Object.fromEntries(this.learningData);
            await fs.writeFile(this.learningFile, JSON.stringify(data, null, 2));
        }
        catch (error) {
            console.debug('Failed to save agent learning data:', error);
        }
    }
}
exports.AgentLearningSystem = AgentLearningSystem;
// Singleton instance
exports.agentLearningSystem = new AgentLearningSystem();
