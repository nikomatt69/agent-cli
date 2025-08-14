"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRouter = void 0;
const chalk_1 = __importDefault(require("chalk"));
class ToolRouter {
    constructor() {
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
        console.log(chalk_1.default.blue(`🔍 Tool Analysis for: "${message.substring(0, 50)}..."\n`));
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
}
exports.ToolRouter = ToolRouter;
