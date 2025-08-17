"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiDocsTools = exports.docsGapReportTool = exports.docsRequestTool = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const chalk_1 = __importDefault(require("chalk"));
const docs_context_manager_1 = require("../context/docs-context-manager");
const cloud_docs_provider_1 = require("../core/cloud-docs-provider");
const documentation_library_1 = require("../core/documentation-library");
const feedback_system_1 = require("../core/feedback-system");
exports.docsRequestTool = (0, ai_1.tool)({
    description: 'Request documentation when you encounter unknown concepts, technologies, or need implementation guidance',
    parameters: zod_1.z.object({
        concept: zod_1.z.string().describe('The concept, technology, or implementation you need help with'),
        context: zod_1.z.string().describe('What you are trying to do or where you encountered this'),
        urgency: zod_1.z.enum(['low', 'medium', 'high']).default('medium').describe('How urgently you need this information'),
        autoLoad: zod_1.z.boolean().default(true).describe('Automatically load found documentation into context'),
        suggestSources: zod_1.z.boolean().default(true).describe('Suggest external sources if not found locally')
    }),
    execute: async ({ concept, context, urgency, autoLoad, suggestSources }) => {
        try {
            console.log(chalk_1.default.blue(`🤖 Agent requesting docs: "${concept}"`));
            const result = {
                concept,
                context,
                found: false,
                suggestions: [],
                loadedDocs: [],
                externalSources: [],
                summary: ''
            };
            const currentDocs = docs_context_manager_1.docsContextManager.getLoadedDocs();
            const relevantLoaded = currentDocs.filter(doc => doc.title.toLowerCase().includes(concept.toLowerCase()) ||
                doc.content.toLowerCase().includes(concept.toLowerCase()) ||
                doc.tags.some(tag => tag.toLowerCase().includes(concept.toLowerCase())));
            if (relevantLoaded.length > 0) {
                result.found = true;
                result.loadedDocs = relevantLoaded.map(doc => ({
                    title: doc.title,
                    category: doc.category,
                    source: doc.source,
                    relevance: 'already-loaded'
                }));
                result.summary = `✅ Found ${relevantLoaded.length} relevant documents already loaded in context:\n${relevantLoaded.map(doc => `- ${doc.title}`).join('\n')}\n\nYou can use this information immediately.`;
                return result;
            }
            const searchQueries = [
                concept,
                `${concept} tutorial`,
                `${concept} implementation`,
                `${concept} guide`,
                `how to ${concept}`,
                `${concept} best practices`
            ];
            let bestMatches = [];
            const cloudProvider = (0, cloud_docs_provider_1.getCloudDocsProvider)();
            for (const query of searchQueries.slice(0, 3)) {
                try {
                    const localResults = await documentation_library_1.docLibrary.search(query, undefined, 3);
                    let cloudResults = [];
                    if (cloudProvider) {
                        try {
                            cloudResults = await cloudProvider.searchShared(query, undefined, 3);
                        }
                        catch (error) {
                            console.debug('Cloud search failed:', error);
                        }
                    }
                    const combinedResults = [
                        ...localResults.map(r => ({ ...r, source: 'local', score: r.score })),
                        ...cloudResults.map(r => ({
                            entry: {
                                title: r.title,
                                category: r.category,
                                url: r.url,
                                tags: r.tags,
                                content: r.content
                            },
                            source: 'cloud',
                            score: r.popularity_score / 100
                        }))
                    ];
                    bestMatches.push(...combinedResults.filter(r => r.score > 0.3));
                }
                catch (error) {
                    console.error(`Search failed for query "${query}":`, error);
                }
            }
            const uniqueMatches = bestMatches
                .filter((match, index, self) => index === self.findIndex(m => m.entry.title === match.entry.title))
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);
            if (uniqueMatches.length > 0) {
                result.found = true;
                if (autoLoad && (urgency === 'medium' || urgency === 'high')) {
                    const docsToLoad = uniqueMatches.slice(0, 2).map(match => match.entry.title);
                    try {
                        const loadedDocs = await docs_context_manager_1.docsContextManager.loadDocs(docsToLoad);
                        result.loadedDocs = loadedDocs.map(doc => ({
                            title: doc.title,
                            category: doc.category,
                            source: doc.source,
                            relevance: 'auto-loaded'
                        }));
                        console.log(chalk_1.default.green(`🤖 Auto-loaded ${loadedDocs.length} docs for "${concept}"`));
                    }
                    catch (error) {
                        console.error('Auto-load failed:', error);
                    }
                }
                result.suggestions = uniqueMatches.map(match => ({
                    title: match.entry.title,
                    category: match.entry.category,
                    source: match.source,
                    score: Math.round(match.score * 100) + '%',
                    url: match.entry.url
                }));
            }
            if (!result.found && suggestSources) {
                const conceptLower = concept.toLowerCase();
                if (conceptLower.includes('react')) {
                    result.externalSources.push({
                        name: 'React Official Documentation',
                        url: 'https://react.dev/',
                        description: 'Official React documentation and tutorials'
                    });
                }
                if (conceptLower.includes('typescript') || conceptLower.includes('ts')) {
                    result.externalSources.push({
                        name: 'TypeScript Handbook',
                        url: 'https://www.typescriptlang.org/docs/',
                        description: 'Official TypeScript documentation'
                    });
                }
                if (conceptLower.includes('node') || conceptLower.includes('nodejs')) {
                    result.externalSources.push({
                        name: 'Node.js Documentation',
                        url: 'https://nodejs.org/docs/',
                        description: 'Official Node.js API documentation'
                    });
                }
                if (conceptLower.includes('next')) {
                    result.externalSources.push({
                        name: 'Next.js Documentation',
                        url: 'https://nextjs.org/docs',
                        description: 'Official Next.js documentation'
                    });
                }
                result.externalSources.push({
                    name: 'MDN Web Docs',
                    url: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(concept)}`,
                    description: 'Mozilla Developer Network documentation'
                }, {
                    name: 'Stack Overflow',
                    url: `https://stackoverflow.com/search?q=${encodeURIComponent(concept)}`,
                    description: 'Community Q&A and solutions'
                });
            }
            if (result.found) {
                const loaded = result.loadedDocs.length;
                const available = result.suggestions.length;
                await feedback_system_1.feedbackSystem.reportSuccess(concept, context, `Found ${loaded + available} relevant documents`, { agentType: 'docs_request' });
                result.summary = `🎯 Found documentation for "${concept}"!\n\n`;
                if (loaded > 0) {
                    result.summary += `✅ **Auto-loaded ${loaded} documents into context:**\n`;
                    result.summary += result.loadedDocs.map(doc => `- ${doc.title} (${doc.category})`).join('\n') + '\n\n';
                }
                if (available > loaded) {
                    result.summary += `📚 **Additional documentation available:**\n`;
                    result.summary += result.suggestions.slice(loaded).map(doc => `- ${doc.title} (${doc.category}) - ${doc.score} match`).join('\n') + '\n\n';
                    result.summary += `💡 Use the smart_docs_load tool to load additional documents.\n\n`;
                }
                result.summary += `**Context:** ${context}\n`;
                result.summary += `**Next steps:** You now have relevant documentation loaded. Proceed with your implementation using the provided information.`;
            }
            else {
                const impactLevel = urgency === 'high' ? 'high' : urgency === 'medium' ? 'medium' : 'low';
                await feedback_system_1.feedbackSystem.reportDocGap(concept, context, impactLevel, 'first-time', {
                    agentType: 'docs_request',
                    sources: result.externalSources.map(s => s.url)
                });
                result.summary = `❌ No local documentation found for "${concept}".\n\n`;
                result.summary += `**Context:** ${context}\n\n`;
                if (result.externalSources.length > 0) {
                    result.summary += `🌐 **Suggested external sources:**\n`;
                    result.summary += result.externalSources.map(source => `- [${source.name}](${source.url}) - ${source.description}`).join('\n') + '\n\n';
                    result.summary += `💡 **Recommendation:** Use the /doc-add command to add documentation from these sources to your local library for future use.\n\n`;
                }
                result.summary += `**Alternative approaches:**\n`;
                result.summary += `- Try more specific or alternative keywords\n`;
                result.summary += `- Break down the concept into smaller parts\n`;
                result.summary += `- Ask the user for more context or clarification\n`;
                result.summary += `- Implement a basic solution and iterate`;
            }
            return result;
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Docs request failed: ${error.message}`));
            return {
                success: false,
                error: error.message,
                concept,
                context,
                found: false,
                summary: `Failed to request documentation: ${error.message}`
            };
        }
    }
});
exports.docsGapReportTool = (0, ai_1.tool)({
    description: 'Report documentation gaps when you repeatedly encounter unknown concepts that block your progress',
    parameters: zod_1.z.object({
        missingConcept: zod_1.z.string().describe('The concept or technology that is missing documentation'),
        frequency: zod_1.z.enum(['first-time', 'occasional', 'frequent', 'blocking']).describe('How often this gap is encountered'),
        impact: zod_1.z.enum(['low', 'medium', 'high', 'critical']).describe('How much this impacts your ability to help users'),
        suggestedSources: zod_1.z.array(zod_1.z.string()).optional().describe('URLs or sources where this documentation might be found'),
        userContext: zod_1.z.string().describe('What the user was trying to do when this gap was encountered')
    }),
    execute: async ({ missingConcept, frequency, impact, suggestedSources, userContext }) => {
        try {
            console.log(chalk_1.default.yellow(`🔍 Reporting docs gap: "${missingConcept}"`));
            await feedback_system_1.feedbackSystem.reportDocGap(missingConcept, userContext, impact, frequency, {
                sources: suggestedSources,
                agentType: 'manual_report'
            });
            const gapReport = {
                concept: missingConcept,
                frequency,
                impact,
                reportedAt: new Date().toISOString(),
                userContext,
                suggestedSources: suggestedSources || [],
                status: 'reported'
            };
            const priorityLevel = impact === 'critical' ? '🚨 CRITICAL' :
                impact === 'high' ? '⚠️ HIGH' :
                    impact === 'medium' ? '📝 MEDIUM' : '💡 LOW';
            const summary = `${priorityLevel} Documentation Gap Reported\n\n` +
                `**Missing Concept:** ${missingConcept}\n` +
                `**Frequency:** ${frequency}\n` +
                `**Impact:** ${impact}\n` +
                `**User Context:** ${userContext}\n\n` +
                `**Status:** This gap has been logged and will be aggregated with other feedback for system improvements.\n\n` +
                (suggestedSources && suggestedSources.length > 0 ?
                    `**Suggested Sources:**\n${suggestedSources.map(s => `- ${s}`).join('\n')}\n\n` : '') +
                `**Immediate Actions:**\n` +
                `- Use external sources temporarily\n` +
                `- Add documentation using /doc-add command\n` +
                `- Implement with available information and iterate\n` +
                `- Ask user for specific guidance or examples`;
            return {
                success: true,
                gapReport,
                summary,
                recommendations: [
                    'Add documentation from external sources',
                    'Create implementation examples',
                    'Build internal knowledge base',
                    'Prioritize commonly missing concepts'
                ]
            };
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Gap report failed: ${error.message}`));
            return {
                success: false,
                error: error.message,
                summary: `Failed to report documentation gap: ${error.message}`
            };
        }
    }
});
exports.aiDocsTools = {
    request: exports.docsRequestTool,
    gapReport: exports.docsGapReportTool
};
