"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRouter = exports.ToolRouter = void 0;
const chalk_1 = __importDefault(require("chalk"));
const zod_1 = require("zod");
const events_1 = require("events");
const ToolSecurityLevel = zod_1.z.enum(['safe', 'moderate', 'risky', 'dangerous']);
const ToolCategory = zod_1.z.enum(['file', 'command', 'search', 'analysis', 'git', 'package', 'ide', 'ai']);
const AdvancedToolRecommendation = zod_1.z.object({
    tool: zod_1.z.string(),
    confidence: zod_1.z.number().min(0).max(1),
    reason: zod_1.z.string(),
    securityLevel: ToolSecurityLevel,
    category: ToolCategory,
    suggestedParams: zod_1.z.record(zod_1.z.any()).optional(),
    alternativeTools: zod_1.z.array(zod_1.z.string()).optional(),
    executionOrder: zod_1.z.number().optional(),
    dependencies: zod_1.z.array(zod_1.z.string()).optional(),
    estimatedDuration: zod_1.z.number().optional(),
    requiresApproval: zod_1.z.boolean().default(false),
    workspaceRestricted: zod_1.z.boolean().default(true)
});
const RoutingContext = zod_1.z.object({
    userIntent: zod_1.z.string(),
    projectType: zod_1.z.string().optional(),
    currentWorkspace: zod_1.z.string(),
    availableTools: zod_1.z.array(zod_1.z.string()),
    securityMode: zod_1.z.enum(['strict', 'normal', 'permissive']).default('strict'),
    cognition: zod_1.z.any().optional(),
    orchestrationPlan: zod_1.z.any().optional()
});
class ToolRouter extends events_1.EventEmitter {
    constructor() {
        super();
        this.toolKeywords = [
            {
                tool: 'web_search',
                keywords: ['cerca', 'search', 'trova', 'find', 'informazioni', 'information', 'documentazione', 'documentation', 'stackoverflow', 'github', 'medium', 'blog', 'tutorial', 'guida', 'guide', 'come fare', 'how to', 'best practice', 'migliore pratica', 'aggiornamento', 'update', 'novità', 'news', 'versione', 'version'],
                priority: 8,
                description: 'Ricerca informazioni web aggiornate',
                examples: ['cerca React 18 features', 'trova tutorial TypeScript', 'informazioni su Next.js 15']
            },
            {
                tool: 'ide_context',
                keywords: ['ambiente', 'environment', 'editor', 'ide', 'workspace', 'progetto', 'project', 'struttura', 'structure', 'dipendenze', 'dependencies', 'package.json', 'git', 'branch', 'commit', 'stato', 'status', 'file aperti', 'open files', 'recenti', 'recent'],
                priority: 7,
                description: 'Analisi contesto IDE e workspace',
                examples: ['analizza ambiente di sviluppo', 'stato del progetto', 'dipendenze installate']
            },
            {
                tool: 'semantic_search',
                keywords: ['simile', 'similar', 'uguale', 'same', 'pattern', 'modello', 'esempio', 'example', 'come questo', 'like this', 'stesso tipo', 'same type', 'funzione simile', 'similar function', 'componente simile', 'similar component', 'implementazione', 'implementation'],
                priority: 9,
                description: 'Ricerca semantica nel codebase',
                examples: ['trova file simili a questo', 'cerca implementazioni simili', 'pattern simili nel codice']
            },
            {
                tool: 'code_analysis',
                keywords: ['analizza', 'analyze', 'qualità', 'quality', 'problemi', 'issues', 'bug', 'errori', 'errors', 'migliora', 'improve', 'ottimizza', 'optimize', 'refactor', 'refactoring', 'pulizia', 'clean', 'sicurezza', 'security', 'performance', 'prestazioni', 'complessità', 'complexity'],
                priority: 8,
                description: 'Analisi qualità e ottimizzazione codice',
                examples: ['analizza qualità del codice', 'trova problemi di sicurezza', 'ottimizza performance']
            },
            {
                tool: 'dependency_analysis',
                keywords: ['dipendenze', 'dependencies', 'package', 'npm', 'yarn', 'node_modules', 'vulnerabilità', 'vulnerabilities', 'sicurezza', 'security', 'aggiorna', 'update', 'outdated', 'obsoleto', 'versione', 'version', 'lock', 'package-lock', 'yarn.lock'],
                priority: 7,
                description: 'Analisi dipendenze e sicurezza',
                examples: ['analizza dipendenze', 'trova vulnerabilità', 'aggiorna pacchetti obsoleti']
            },
            {
                tool: 'git_workflow',
                keywords: ['git', 'commit', 'branch', 'merge', 'pull', 'push', 'repository', 'repo', 'workflow', 'storia', 'history', 'log', 'stato', 'status', 'cambia', 'changes', 'diff', 'conflict', 'conflitto', 'rebase', 'cherry-pick'],
                priority: 6,
                description: 'Analisi workflow Git',
                examples: ['analizza workflow Git', 'stato del repository', 'storia dei commit']
            },
            {
                tool: 'read_file',
                keywords: ['leggi', 'read', 'mostra', 'show', 'visualizza', 'view', 'contenuto', 'content', 'file', 'codice', 'code', 'script', 'configurazione', 'configuration', 'config'],
                priority: 5,
                description: 'Lettura file',
                examples: ['leggi package.json', 'mostra contenuto file', 'visualizza configurazione']
            },
            {
                tool: 'write_file',
                keywords: ['scrivi', 'write', 'crea', 'create', 'genera', 'generate', 'salva', 'save', 'nuovo', 'new', 'file', 'codice', 'code', 'componente', 'component', 'funzione', 'function'],
                priority: 5,
                description: 'Scrittura file',
                examples: ['crea nuovo componente', 'genera funzione', 'scrivi file di configurazione']
            },
            {
                tool: 'explore_directory',
                keywords: ['esplora', 'explore', 'lista', 'list', 'struttura', 'structure', 'cartella', 'directory', 'folder', 'percorso', 'path', 'trova', 'find', 'cerca', 'search', 'file', 'files'],
                priority: 4,
                description: 'Esplorazione directory',
                examples: ['esplora struttura progetto', 'lista file nella cartella', 'trova file TypeScript']
            },
            {
                tool: 'run_command',
                keywords: ['esegui', 'execute', 'run', 'comando', 'command', 'script', 'build', 'test', 'install', 'start', 'dev', 'development', 'production', 'deploy', 'deployment'],
                priority: 3,
                description: 'Esecuzione comandi',
                examples: ['esegui test', 'avvia development server', 'build del progetto']
            }
        ];
    }
    analyzeMessage(message) {
        const content = typeof message.content === 'string'
            ? message.content
            : String(message.content);
        const lowerContent = content.toLowerCase();
        const recommendations = [];
        for (const toolKeyword of this.toolKeywords) {
            const matches = toolKeyword.keywords.filter(keyword => lowerContent.includes(keyword.toLowerCase()));
            if (matches.length > 0) {
                const confidence = this.calculateConfidence(matches, toolKeyword, lowerContent);
                if (confidence > 0.3) {
                    recommendations.push({
                        tool: toolKeyword.tool,
                        confidence,
                        reason: `Matched keywords: ${matches.join(', ')}`,
                        suggestedParams: this.suggestParameters(toolKeyword.tool, content)
                    });
                }
            }
        }
        return recommendations
            .sort((a, b) => {
            const toolA = this.toolKeywords.find(t => t.tool === a.tool);
            const toolB = this.toolKeywords.find(t => t.tool === b.tool);
            const priorityA = toolA?.priority || 0;
            const priorityB = toolB?.priority || 0;
            if (a.confidence !== b.confidence) {
                return b.confidence - a.confidence;
            }
            return priorityB - priorityA;
        })
            .slice(0, 3);
    }
    calculateConfidence(matches, toolKeyword, content) {
        let confidence = 0;
        confidence += matches.length * 0.2;
        for (const match of matches) {
            if (content.toLowerCase().includes(match.toLowerCase())) {
                confidence += 0.1;
            }
        }
        const contextWords = this.getContextWords(toolKeyword.tool);
        const contextMatches = contextWords.filter(word => content.toLowerCase().includes(word));
        confidence += contextMatches.length * 0.05;
        if (content.length > 50) {
            confidence += 0.1;
        }
        return Math.min(1.0, confidence);
    }
    getContextWords(tool) {
        const contextMap = {
            'web_search': ['web', 'online', 'internet', 'browser', 'url', 'link'],
            'ide_context': ['editor', 'vscode', 'intellij', 'workspace', 'project'],
            'semantic_search': ['similar', 'pattern', 'example', 'implementation'],
            'code_analysis': ['quality', 'review', 'improve', 'optimize'],
            'dependency_analysis': ['package', 'npm', 'security', 'update'],
            'git_workflow': ['repository', 'commit', 'branch', 'merge'],
            'read_file': ['file', 'content', 'show', 'display'],
            'write_file': ['create', 'generate', 'new', 'save'],
            'explore_directory': ['folder', 'directory', 'structure', 'list'],
            'run_command': ['execute', 'run', 'script', 'terminal']
        };
        return contextMap[tool] || [];
    }
    suggestParameters(tool, content) {
        const suggestions = {};
        switch (tool) {
            case 'web_search':
                const searchMatch = content.match(/(?:cerca|search|trova|find)\s+(.+?)(?:\s|$)/i);
                if (searchMatch) {
                    suggestions.query = searchMatch[1];
                }
                if (content.includes('stackoverflow') || content.includes('error')) {
                    suggestions.searchType = 'stackoverflow';
                }
                else if (content.includes('documentazione') || content.includes('docs')) {
                    suggestions.searchType = 'documentation';
                }
                else if (content.includes('github') || content.includes('code')) {
                    suggestions.searchType = 'technical';
                }
                break;
            case 'code_analysis':
                const fileMatch = content.match(/(?:analizza|analyze)\s+(.+?)(?:\s|$)/i);
                if (fileMatch) {
                    suggestions.filePath = fileMatch[1];
                }
                if (content.includes('sicurezza') || content.includes('security')) {
                    suggestions.analysisType = 'security';
                }
                else if (content.includes('performance') || content.includes('prestazioni')) {
                    suggestions.analysisType = 'performance';
                }
                else if (content.includes('pattern') || content.includes('modello')) {
                    suggestions.analysisType = 'patterns';
                }
                break;
            case 'semantic_search':
                const semanticMatch = content.match(/(?:trova|cerca|find)\s+(.+?)(?:\s|$)/i);
                if (semanticMatch) {
                    suggestions.query = semanticMatch[1];
                }
                break;
        }
        return suggestions;
    }
    getToolDescription(tool) {
        const toolKeyword = this.toolKeywords.find(t => t.tool === tool);
        return toolKeyword?.description || 'Tool generico';
    }
    getAllTools() {
        return this.toolKeywords;
    }
    logRecommendations(message, recommendations) {
        console.log(chalk_1.default.blue(`Processing message: "${message.substring(0, 50)}..."\n`));
        if (recommendations.length === 0) {
            return;
        }
        recommendations.forEach((rec, index) => {
            const confidenceColor = rec.confidence > 0.7 ? chalk_1.default.green : rec.confidence > 0.4 ? chalk_1.default.yellow : chalk_1.default.red;
            console.log(chalk_1.default.blue(`  ${index + 1}. ${rec.tool}`));
            console.log(confidenceColor(`     Confidence: ${(rec.confidence * 100).toFixed(1)}%`));
            console.log(chalk_1.default.gray(`     Reason: ${rec.reason}`));
            if (rec.suggestedParams && Object.keys(rec.suggestedParams).length > 0) {
                console.log(chalk_1.default.cyan(`     Suggested params: ${JSON.stringify(rec.suggestedParams)}`));
            }
        });
    }
    async routeWithCognition(context) {
        console.log(chalk_1.default.blue(`🎯 Advanced routing for: ${context.userIntent.slice(0, 50)}...`));
        try {
            const intentAnalysis = this.analyzeIntentAdvanced(context.userIntent);
            const cognitiveEnhancement = context.cognition
                ? this.applyCognitiveEnhancement(intentAnalysis, context.cognition)
                : intentAnalysis;
            const toolCandidates = await this.scoreToolsMultiDimensional(cognitiveEnhancement, context);
            const secureTools = this.applySecurityFiltering(toolCandidates, context.securityMode);
            const sequencedTools = context.orchestrationPlan
                ? this.optimizeToolSequence(secureTools, context.orchestrationPlan)
                : this.defaultToolSequencing(secureTools);
            const validatedTools = this.validateAndFinalize(sequencedTools, context);
            console.log(chalk_1.default.green(`✅ Selected ${validatedTools.length} optimal tools`));
            return validatedTools;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Advanced routing failed: ${error.message}`));
            const basicRecommendations = this.analyzeMessage({ role: 'user', content: context.userIntent });
            return this.convertToAdvancedRecommendations(basicRecommendations);
        }
    }
    analyzeIntentAdvanced(userIntent) {
        const lowerIntent = userIntent.toLowerCase();
        const actionPatterns = {
            'read': /\b(read|show|display|view|see|check|examine|analyze)\b/,
            'write': /\b(write|create|generate|make|build|add|insert)\b/,
            'search': /\b(search|find|locate|discover|explore|look)\b/,
            'modify': /\b(modify|edit|change|update|alter|fix|repair)\b/,
            'execute': /\b(run|execute|start|launch|deploy|install|build)\b/,
            'analyze': /\b(analyze|investigate|review|audit|assess|evaluate)\b/
        };
        let primaryAction = 'analyze';
        let actionConfidence = 0;
        for (const [action, pattern] of Object.entries(actionPatterns)) {
            if (pattern.test(lowerIntent)) {
                const matches = (lowerIntent.match(pattern) || []).length;
                if (matches > actionConfidence) {
                    primaryAction = action;
                    actionConfidence = matches;
                }
            }
        }
        const objectPatterns = [
            /\b([a-zA-Z0-9_-]+\.(js|ts|tsx|jsx|json|md|css|html|py|java))\b/g,
            /\b(package\.json|tsconfig\.json|\.env|dockerfile)\b/gi,
            /\b(component|function|class|interface|type|hook)\s+([a-zA-Z0-9_]+)/gi,
            /\b(api|endpoint|route|controller|service)\s+([a-zA-Z0-9_\/]+)/gi
        ];
        const targetObjects = [];
        for (const pattern of objectPatterns) {
            const matches = [...userIntent.matchAll(pattern)];
            targetObjects.push(...matches.map(m => m[1] || m[0]));
        }
        const urgencyKeywords = {
            'critical': ['urgent', 'asap', 'immediately', 'critical', 'emergency'],
            'high': ['quickly', 'fast', 'soon', 'priority', 'important'],
            'low': ['when possible', 'eventually', 'later', 'if time']
        };
        let urgency = 'normal';
        for (const [level, keywords] of Object.entries(urgencyKeywords)) {
            if (keywords.some(keyword => lowerIntent.includes(keyword))) {
                urgency = level;
                break;
            }
        }
        let complexity = 3;
        if (targetObjects.length > 3)
            complexity += 2;
        if (lowerIntent.includes('all') || lowerIntent.includes('entire'))
            complexity += 2;
        if (lowerIntent.includes('refactor') || lowerIntent.includes('restructure'))
            complexity += 3;
        if (lowerIntent.includes('deploy') || lowerIntent.includes('production'))
            complexity += 2;
        const capabilityMap = {
            'react': ['component', 'jsx', 'tsx', 'hook', 'state'],
            'backend': ['api', 'server', 'database', 'endpoint', 'service'],
            'testing': ['test', 'spec', 'mock', 'coverage', 'assertion'],
            'devops': ['deploy', 'docker', 'ci', 'cd', 'pipeline', 'build'],
            'git': ['commit', 'branch', 'merge', 'pull', 'push', 'repository'],
            'security': ['security', 'vulnerability', 'audit', 'permission', 'auth']
        };
        const requiredCapabilities = [];
        for (const [capability, keywords] of Object.entries(capabilityMap)) {
            if (keywords.some(keyword => lowerIntent.includes(keyword))) {
                requiredCapabilities.push(capability);
            }
        }
        return {
            primaryAction,
            targetObjects: [...new Set(targetObjects)],
            modifiers: [],
            urgency,
            complexity: Math.min(complexity, 10),
            requiredCapabilities
        };
    }
    applyCognitiveEnhancement(intentAnalysis, cognition) {
        const enhanced = { ...intentAnalysis };
        if (cognition.intent.urgency !== 'normal') {
            enhanced.urgency = cognition.intent.urgency;
        }
        enhanced.complexity = Math.max(enhanced.complexity, cognition.estimatedComplexity);
        enhanced.requiredCapabilities = [
            ...new Set([
                ...enhanced.requiredCapabilities,
                ...cognition.requiredCapabilities
            ])
        ];
        enhanced.cognitiveContexts = cognition.contexts;
        enhanced.riskLevel = cognition.riskLevel;
        return enhanced;
    }
    async scoreToolsMultiDimensional(intentAnalysis, context) {
        const toolCandidates = [];
        const toolDatabase = this.getAdvancedToolDatabase();
        for (const toolInfo of toolDatabase) {
            const score = this.calculateToolScore(toolInfo, intentAnalysis, context);
            if (score.totalScore > 0.2) {
                const recommendation = {
                    tool: toolInfo.name,
                    confidence: score.totalScore,
                    reason: score.primaryReason,
                    securityLevel: toolInfo.securityLevel,
                    category: toolInfo.category,
                    suggestedParams: score.suggestedParams,
                    alternativeTools: toolInfo.alternatives,
                    estimatedDuration: toolInfo.estimatedDuration,
                    requiresApproval: toolInfo.requiresApproval,
                    workspaceRestricted: toolInfo.workspaceRestricted,
                    rawScore: score.totalScore
                };
                toolCandidates.push(recommendation);
            }
        }
        return toolCandidates.sort((a, b) => b.rawScore - a.rawScore);
    }
    getAdvancedToolDatabase() {
        return [
            {
                name: 'Read',
                category: 'file',
                securityLevel: 'safe',
                keywords: ['read', 'show', 'view', 'display', 'content', 'file'],
                capabilities: ['file-read', 'content-analysis'],
                estimatedDuration: 5,
                requiresApproval: false,
                workspaceRestricted: true,
                alternatives: ['LS', 'Grep']
            },
            {
                name: 'Write',
                category: 'file',
                securityLevel: 'moderate',
                keywords: ['write', 'create', 'generate', 'save', 'new'],
                capabilities: ['file-write', 'code-generation'],
                estimatedDuration: 15,
                requiresApproval: true,
                workspaceRestricted: true,
                alternatives: ['Edit', 'MultiEdit']
            },
            {
                name: 'Bash',
                category: 'command',
                securityLevel: 'risky',
                keywords: ['run', 'execute', 'command', 'bash', 'shell'],
                capabilities: ['command-execution', 'system-access'],
                estimatedDuration: 30,
                requiresApproval: true,
                workspaceRestricted: true,
                alternatives: []
            },
            {
                name: 'Grep',
                category: 'search',
                securityLevel: 'safe',
                keywords: ['search', 'find', 'grep', 'pattern', 'text'],
                capabilities: ['text-search', 'pattern-matching'],
                estimatedDuration: 10,
                requiresApproval: false,
                workspaceRestricted: true,
                alternatives: ['Glob']
            },
            {
                name: 'LS',
                category: 'file',
                securityLevel: 'safe',
                keywords: ['list', 'directory', 'folder', 'structure', 'files'],
                capabilities: ['directory-listing', 'file-exploration'],
                estimatedDuration: 5,
                requiresApproval: false,
                workspaceRestricted: true,
                alternatives: ['Glob']
            },
            {
                name: 'WebFetch',
                category: 'search',
                securityLevel: 'moderate',
                keywords: ['web', 'internet', 'documentation', 'search', 'fetch'],
                capabilities: ['web-access', 'information-retrieval'],
                estimatedDuration: 20,
                requiresApproval: false,
                workspaceRestricted: false,
                alternatives: ['WebSearch']
            }
        ];
    }
    calculateToolScore(toolInfo, intentAnalysis, context) {
        let totalScore = 0;
        let primaryReason = '';
        const reasons = [];
        const keywordScore = this.scoreKeywordMatch(toolInfo.keywords, intentAnalysis.primaryAction);
        totalScore += keywordScore * 0.3;
        if (keywordScore > 0.7) {
            reasons.push(`Strong keyword match (${Math.round(keywordScore * 100)}%)`);
        }
        const capabilityScore = this.scoreCapabilityAlignment(toolInfo.capabilities, intentAnalysis.requiredCapabilities);
        totalScore += capabilityScore * 0.25;
        if (capabilityScore > 0.6) {
            reasons.push(`Capability alignment (${Math.round(capabilityScore * 100)}%)`);
        }
        const securityScore = this.scoreSecurityLevel(toolInfo.securityLevel, context.securityMode, intentAnalysis.riskLevel);
        totalScore += securityScore * 0.2;
        if (securityScore < 0.5) {
            reasons.push(`Security concerns (${toolInfo.securityLevel})`);
        }
        const contextScore = this.scoreContextRelevance(toolInfo, intentAnalysis, context);
        totalScore += contextScore * 0.15;
        const performanceScore = this.scorePerformanceMatch(toolInfo.estimatedDuration, intentAnalysis.urgency);
        totalScore += performanceScore * 0.1;
        primaryReason = reasons.length > 0 ? reasons.join(', ') : `General ${toolInfo.category} tool`;
        const suggestedParams = this.generateSuggestedParams(toolInfo, intentAnalysis);
        return {
            totalScore: Math.min(totalScore, 1.0),
            primaryReason,
            suggestedParams
        };
    }
    applySecurityFiltering(tools, securityMode) {
        const securityThresholds = {
            'strict': { dangerous: 0, risky: 0.9, moderate: 0.7, safe: 0.3 },
            'normal': { dangerous: 0, risky: 0.8, moderate: 0.5, safe: 0.2 },
            'permissive': { dangerous: 0.9, risky: 0.6, moderate: 0.3, safe: 0.1 }
        };
        const thresholds = securityThresholds[securityMode];
        return tools.filter(tool => {
            const threshold = thresholds[tool.securityLevel];
            const passes = tool.rawScore >= threshold;
            if (!passes) {
                console.log(chalk_1.default.yellow(`⚠️ Security filter blocked: ${tool.tool} (${tool.securityLevel})`));
            }
            return passes;
        });
    }
    optimizeToolSequence(tools, orchestrationPlan) {
        const currentPhase = orchestrationPlan.phases[0];
        const phaseTools = currentPhase?.tools || [];
        tools.forEach((tool, index) => {
            if (phaseTools.includes(tool.tool)) {
                tool.rawScore += 0.2;
                tool.executionOrder = index;
                tool.reason += ` (orchestration priority)`;
            }
        });
        return tools.sort((a, b) => {
            if (a.executionOrder !== undefined && b.executionOrder !== undefined) {
                return a.executionOrder - b.executionOrder;
            }
            if (a.executionOrder !== undefined)
                return -1;
            if (b.executionOrder !== undefined)
                return 1;
            return b.rawScore - a.rawScore;
        });
    }
    defaultToolSequencing(tools) {
        const sequencePriority = {
            'file': { read: 1, list: 2 },
            'search': { search: 3, analyze: 4 },
            'analysis': { analyze: 5 },
            'ai': { generate: 6 },
            'command': { execute: 7 },
            'git': { git: 8 },
            'package': { package: 9 },
            'ide': { ide: 10 }
        };
        tools.forEach((tool, index) => {
            const categoryPriority = sequencePriority[tool.category] || {};
            const toolKey = tool.tool.toLowerCase();
            tool.executionOrder = categoryPriority[toolKey] || (100 + index);
        });
        return tools.sort((a, b) => (a.executionOrder || 100) - (b.executionOrder || 100));
    }
    validateAndFinalize(tools, context) {
        const validated = [];
        const maxTools = 5;
        for (let i = 0; i < Math.min(tools.length, maxTools); i++) {
            const tool = tools[i];
            try {
                const validatedTool = AdvancedToolRecommendation.parse({
                    tool: tool.tool,
                    confidence: tool.confidence,
                    reason: tool.reason,
                    securityLevel: tool.securityLevel,
                    category: tool.category,
                    suggestedParams: tool.suggestedParams,
                    alternativeTools: tool.alternativeTools,
                    executionOrder: tool.executionOrder,
                    estimatedDuration: tool.estimatedDuration,
                    requiresApproval: tool.requiresApproval,
                    workspaceRestricted: tool.workspaceRestricted
                });
                validated.push(validatedTool);
            }
            catch (error) {
                console.log(chalk_1.default.yellow(`⚠️ Tool validation failed: ${tool.tool}`));
            }
        }
        return validated;
    }
    scoreKeywordMatch(toolKeywords, primaryAction) {
        if (!toolKeywords || toolKeywords.length === 0)
            return 0;
        for (const keyword of toolKeywords) {
            if (keyword.toLowerCase().includes(primaryAction.toLowerCase()) ||
                primaryAction.toLowerCase().includes(keyword.toLowerCase())) {
                return 1.0;
            }
        }
        return 0.0;
    }
    scoreCapabilityAlignment(toolCapabilities, requiredCapabilities) {
        if (!requiredCapabilities || requiredCapabilities.length === 0)
            return 0.5;
        if (!toolCapabilities || toolCapabilities.length === 0)
            return 0.3;
        let matches = 0;
        for (const required of requiredCapabilities) {
            if (toolCapabilities.some(cap => cap.includes(required) || required.includes(cap))) {
                matches++;
            }
        }
        return matches / requiredCapabilities.length;
    }
    scoreSecurityLevel(toolSecurity, contextSecurity, riskLevel) {
        const securityScores = {
            'strict': { safe: 1.0, moderate: 0.7, risky: 0.3, dangerous: 0.0 },
            'normal': { safe: 1.0, moderate: 0.9, risky: 0.6, dangerous: 0.2 },
            'permissive': { safe: 1.0, moderate: 1.0, risky: 0.8, dangerous: 0.5 }
        };
        const scores = securityScores[contextSecurity] || securityScores.strict;
        let score = scores[toolSecurity] || 0;
        if (riskLevel === 'high' && toolSecurity === 'risky') {
            score *= 0.5;
        }
        return score;
    }
    scoreContextRelevance(toolInfo, intentAnalysis, context) {
        let score = 0.5;
        if (context.projectType) {
            const projectKeywords = context.projectType.toLowerCase();
            if (toolInfo.keywords.some((kw) => projectKeywords.includes(kw))) {
                score += 0.3;
            }
        }
        if (intentAnalysis.targetObjects?.length > 0) {
            const hasFileTargets = intentAnalysis.targetObjects.some((obj) => obj.includes('.'));
            if (hasFileTargets && toolInfo.category === 'file') {
                score += 0.2;
            }
        }
        return Math.min(score, 1.0);
    }
    scorePerformanceMatch(estimatedDuration, urgency) {
        const urgencyThresholds = {
            'critical': 10,
            'high': 30,
            'normal': 60,
            'low': 120
        };
        const threshold = urgencyThresholds[urgency] || 60;
        if (estimatedDuration <= threshold) {
            return 1.0;
        }
        else if (estimatedDuration <= threshold * 2) {
            return 0.7;
        }
        else {
            return 0.4;
        }
    }
    generateSuggestedParams(toolInfo, intentAnalysis) {
        const params = {};
        switch (toolInfo.name) {
            case 'Read':
                if (intentAnalysis.targetObjects?.length > 0) {
                    params.file_path = intentAnalysis.targetObjects[0];
                }
                break;
            case 'Grep':
                if (intentAnalysis.targetObjects?.length > 0) {
                    params.pattern = intentAnalysis.targetObjects[0];
                }
                break;
            case 'Bash':
                if (intentAnalysis.primaryAction === 'execute') {
                    params.command = 'npm --version';
                }
                break;
        }
        return Object.keys(params).length > 0 ? params : undefined;
    }
    convertToAdvancedRecommendations(basic) {
        return basic.map(rec => ({
            tool: rec.tool,
            confidence: rec.confidence,
            reason: rec.reason,
            securityLevel: 'safe',
            category: 'analysis',
            suggestedParams: rec.suggestedParams,
            workspaceRestricted: true,
            requiresApproval: false
        }));
    }
    getRoutingStats() {
        return {
            totalRoutes: 0,
            averageConfidence: 0.85,
            topTools: ['Read', 'Write', 'Grep', 'LS', 'Bash'],
            securityDistribution: { safe: 60, moderate: 25, risky: 15, dangerous: 0 }
        };
    }
}
exports.ToolRouter = ToolRouter;
exports.toolRouter = new ToolRouter();
