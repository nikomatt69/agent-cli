"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smartDocsTools = exports.smartDocsContextTool = exports.smartDocsLoadTool = exports.smartDocsSearchTool = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const chalk_1 = __importDefault(require("chalk"));
const documentation_library_1 = require("../core/documentation-library");
const docs_context_manager_1 = require("../context/docs-context-manager");
const cloud_docs_provider_1 = require("../core/cloud-docs-provider");
exports.smartDocsSearchTool = (0, ai_1.tool)({
    description: 'Search and load documentation automatically when you need information about specific technologies, frameworks, or implementation details',
    parameters: zod_1.z.object({
        query: zod_1.z.string().describe('What you are looking for (e.g., "react hooks", "nodejs authentication", "express middleware")'),
        autoLoad: zod_1.z.boolean().default(true).describe('Automatically load relevant documentation into context'),
        maxResults: zod_1.z.number().default(3).describe('Maximum number of documents to find'),
        category: zod_1.z.string().optional().describe('Specific category to search in (frontend, backend, api, etc.)'),
        urgency: zod_1.z.enum(['low', 'medium', 'high']).default('medium').describe('How critical this information is for the current task')
    }),
    execute: async ({ query, autoLoad, maxResults, category, urgency }) => {
        try {
            console.log(chalk_1.default.blue(`🤖 Agent searching docs: "${query}"`));
            const results = {
                found: false,
                localResults: [],
                sharedResults: [],
                loadedToContext: [],
                suggestions: [],
                summary: ''
            };
            try {
                const localDocs = await documentation_library_1.docLibrary.search(query, category, maxResults);
                results.localResults = localDocs.map(result => ({
                    title: result.entry.title,
                    category: result.entry.category,
                    url: result.entry.url,
                    tags: result.entry.tags,
                    score: (result.score * 100).toFixed(1) + '%',
                    snippet: result.snippet?.substring(0, 200) || '',
                    source: 'local'
                }));
                if (localDocs.length > 0) {
                    results.found = true;
                }
            }
            catch (error) {
                console.error('Local docs search failed:', error);
            }
            const cloudProvider = (0, cloud_docs_provider_1.getCloudDocsProvider)();
            if (cloudProvider && results.localResults.length < maxResults) {
                try {
                    const remainingSlots = maxResults - results.localResults.length;
                    const cloudDocs = await cloudProvider.searchShared(query, category, remainingSlots);
                    results.sharedResults = cloudDocs.map(doc => ({
                        title: doc.title,
                        category: doc.category,
                        url: doc.url,
                        tags: doc.tags,
                        score: (doc.popularity_score * 100).toFixed(1) + '%',
                        snippet: doc.content.substring(0, 200) + '...',
                        source: 'shared'
                    }));
                    if (cloudDocs.length > 0) {
                        results.found = true;
                    }
                }
                catch (error) {
                    console.error('Cloud docs search failed:', error);
                }
            }
            if (autoLoad && results.found && (urgency === 'medium' || urgency === 'high')) {
                try {
                    const docsToLoad = [];
                    results.localResults.slice(0, 2).forEach(doc => {
                        docsToLoad.push(doc.title);
                    });
                    if (docsToLoad.length < 2) {
                        results.sharedResults.slice(0, 2 - docsToLoad.length).forEach(doc => {
                            docsToLoad.push(doc.title);
                        });
                    }
                    if (docsToLoad.length > 0) {
                        const loadedDocs = await docs_context_manager_1.docsContextManager.loadDocs(docsToLoad);
                        results.loadedToContext = loadedDocs.map(doc => ({
                            title: doc.title,
                            category: doc.category,
                            source: doc.source,
                            summary: doc.summary || ''
                        }));
                        console.log(chalk_1.default.green(`🤖 Auto-loaded ${loadedDocs.length} docs for agent context`));
                    }
                }
                catch (error) {
                    console.error('Auto-load failed:', error);
                }
            }
            if (results.found) {
                const allTags = [
                    ...results.localResults.flatMap(r => r.tags),
                    ...results.sharedResults.flatMap(r => r.tags)
                ];
                const uniqueTags = [...new Set(allTags)];
                results.suggestions = uniqueTags.slice(0, 5);
            }
            const totalFound = results.localResults.length + results.sharedResults.length;
            const loaded = results.loadedToContext.length;
            if (!results.found) {
                results.summary = `No documentation found for "${query}". Consider:
1. Using different keywords or more specific terms
2. Adding documentation with /doc-add <url>
3. Checking available categories with /doc-list`;
            }
            else {
                results.summary = `Found ${totalFound} relevant documentation entries for "${query}".
${loaded > 0 ? `✅ ${loaded} documents automatically loaded into context and ready to use.` : ''}
${results.suggestions.length > 0 ? `\n💡 Related topics: ${results.suggestions.join(', ')}` : ''}

Available documentation:
${[...results.localResults, ...results.sharedResults].map((doc, i) => `${i + 1}. ${doc.title} (${doc.category}) - ${doc.score} match`).join('\n')}`;
            }
            return {
                success: true,
                query,
                found: results.found,
                totalResults: totalFound,
                results: {
                    local: results.localResults,
                    shared: results.sharedResults,
                    loaded: results.loadedToContext
                },
                suggestions: results.suggestions,
                summary: results.summary,
                contextUpdated: results.loadedToContext.length > 0
            };
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Agent docs search failed: ${error.message}`));
            return {
                success: false,
                error: error.message,
                query,
                found: false,
                summary: `Documentation search failed: ${error.message}`
            };
        }
    }
});
exports.smartDocsLoadTool = (0, ai_1.tool)({
    description: 'Load specific documentation into AI context when you need detailed reference material',
    parameters: zod_1.z.object({
        docNames: zod_1.z.array(zod_1.z.string()).describe('Names or identifiers of documents to load'),
        replace: zod_1.z.boolean().default(false).describe('Replace current context or add to existing'),
        priority: zod_1.z.enum(['low', 'medium', 'high']).default('medium').describe('Priority level for context loading')
    }),
    execute: async ({ docNames, replace }) => {
        try {
            console.log(chalk_1.default.blue(`🤖 Agent loading docs: ${docNames.join(', ')}`));
            if (replace) {
                await docs_context_manager_1.docsContextManager.unloadDocs();
                console.log(chalk_1.default.gray('🤖 Cleared existing documentation context'));
            }
            const loadedDocs = await docs_context_manager_1.docsContextManager.loadDocs(docNames);
            const stats = docs_context_manager_1.docsContextManager.getContextStats();
            const result = {
                success: true,
                loaded: loadedDocs.length,
                failed: docNames.length - loadedDocs.length,
                contextStats: {
                    totalDocs: stats.loadedCount,
                    totalWords: stats.totalWords,
                    utilization: Math.round(stats.utilizationPercent),
                    categories: stats.categories
                },
                loadedDocs: loadedDocs.map(doc => ({
                    title: doc.title,
                    category: doc.category,
                    source: doc.source,
                    wordCount: doc.content.split(' ').length,
                    summary: doc.summary || ''
                }))
            };
            const summary = `Successfully loaded ${result.loaded} documents into context.
Context now contains ${result.contextStats.totalDocs} documents (${result.contextStats.totalWords.toLocaleString()} words, ${result.contextStats.utilization}% capacity).
Categories: ${result.contextStats.categories.join(', ')}

Loaded documents:
${result.loadedDocs.map((doc, i) => `${i + 1}. ${doc.title} (${doc.category}) - ${doc.wordCount.toLocaleString()} words`).join('\n')}`;
            return {
                ...result,
                summary
            };
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Agent docs loading failed: ${error.message}`));
            return {
                success: false,
                error: error.message,
                summary: `Failed to load documentation: ${error.message}`
            };
        }
    }
});
exports.smartDocsContextTool = (0, ai_1.tool)({
    description: 'Check what documentation is currently loaded in context and get suggestions',
    parameters: zod_1.z.object({
        includeContent: zod_1.z.boolean().default(false).describe('Include actual content snippets in response'),
        suggestForQuery: zod_1.z.string().optional().describe('Get suggestions for a specific query or task')
    }),
    execute: async ({ includeContent, suggestForQuery }) => {
        try {
            const stats = docs_context_manager_1.docsContextManager.getContextStats();
            const loadedDocs = docs_context_manager_1.docsContextManager.getLoadedDocs();
            const result = {
                hasContext: stats.loadedCount > 0,
                stats: {
                    totalDocs: stats.loadedCount,
                    totalWords: stats.totalWords,
                    utilization: Math.round(stats.utilizationPercent),
                    categories: stats.categories,
                    sources: stats.sources
                },
                documents: loadedDocs.map(doc => ({
                    title: doc.title,
                    category: doc.category,
                    source: doc.source,
                    tags: doc.tags,
                    wordCount: doc.content.split(' ').length,
                    loadedAt: doc.loadedAt.toISOString(),
                    summary: doc.summary || '',
                    ...(includeContent ? {
                        contentPreview: doc.content.substring(0, 500) + '...'
                    } : {})
                })),
                suggestions: []
            };
            if (suggestForQuery) {
                try {
                    const suggestions = await docs_context_manager_1.docsContextManager.suggestDocs(suggestForQuery, 5);
                    result.suggestions = suggestions;
                }
                catch (error) {
                    console.error('Failed to generate suggestions:', error);
                }
            }
            let summary = '';
            if (!result.hasContext) {
                summary = 'No documentation currently loaded in context. Use the documentation search tool to find and load relevant docs.';
            }
            else {
                summary = `Documentation context: ${result.stats.totalDocs} documents loaded (${result.stats.totalWords.toLocaleString()} words, ${result.stats.utilization}% capacity)

Current documents:
${result.documents.map((doc, i) => `${i + 1}. ${doc.title} (${doc.category}) - ${doc.wordCount.toLocaleString()} words`).join('\n')}

Categories: ${result.stats.categories.join(', ')}
Sources: Local: ${result.stats.sources.local}, Cloud: ${result.stats.sources.shared}`;
                if (result.suggestions.length > 0) {
                    summary += `\n\n💡 Related documentation suggestions: ${result.suggestions.join(', ')}`;
                }
            }
            return {
                success: true,
                ...result,
                summary
            };
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Agent context check failed: ${error.message}`));
            return {
                success: false,
                error: error.message,
                summary: `Failed to check documentation context: ${error.message}`
            };
        }
    }
});
exports.smartDocsTools = {
    search: exports.smartDocsSearchTool,
    load: exports.smartDocsLoadTool,
    context: exports.smartDocsContextTool
};
