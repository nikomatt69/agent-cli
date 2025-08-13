"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSearchProvider = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const util_1 = require("util");
const chalk_1 = __importDefault(require("chalk"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class WebSearchProvider {
    // Web search tool using AI SDK
    getWebSearchTool() {
        return (0, ai_1.tool)({
            description: 'Search the web for current information, documentation, or solutions',
            parameters: zod_1.z.object({
                query: zod_1.z.string().describe('Search query to find relevant information'),
                maxResults: zod_1.z.number().default(5).describe('Maximum number of results to return'),
                searchType: zod_1.z.enum(['general', 'technical', 'documentation', 'stackoverflow']).default('general').describe('Type of search to perform')
            }),
            execute: async ({ query, maxResults, searchType }) => {
                try {
                    console.log(chalk_1.default.blue(`🔍 Searching web for: "${query}" (${searchType})`));
                    // Use different search strategies based on type
                    let searchResults = [];
                    switch (searchType) {
                        case 'technical':
                            searchResults = await this.searchTechnical(query, maxResults);
                            break;
                        case 'documentation':
                            searchResults = await this.searchDocumentation(query, maxResults);
                            break;
                        case 'stackoverflow':
                            searchResults = await this.searchStackOverflow(query, maxResults);
                            break;
                        default:
                            searchResults = await this.searchGeneral(query, maxResults);
                    }
                    return {
                        query,
                        searchType,
                        results: searchResults,
                        totalFound: searchResults.length,
                        searchTime: new Date().toISOString()
                    };
                }
                catch (error) {
                    return {
                        error: `Web search failed: ${error.message}`,
                        query,
                        searchType
                    };
                }
            }
        });
    }
    // General web search using curl and search engines
    async searchGeneral(query, maxResults) {
        try {
            // Use DuckDuckGo for privacy-friendly search
            const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const { stdout } = await execAsync(`curl -s -A "Mozilla/5.0" "${searchUrl}" | grep -o 'href="[^"]*" class="result__url"' | head -${maxResults}`);
            const results = [];
            const lines = stdout.split('\n').filter(line => line.trim());
            lines.forEach((line, index) => {
                const urlMatch = line.match(/href="([^"]*)"/);
                if (urlMatch) {
                    results.push({
                        title: `Result ${index + 1}`,
                        url: urlMatch[1],
                        snippet: `Found result for: ${query}`,
                        relevance: 1 - (index * 0.1)
                    });
                }
            });
            return results;
        }
        catch (error) {
            console.warn('General search failed, using fallback');
            return this.getFallbackResults(query, maxResults);
        }
    }
    // Technical search focusing on developer resources
    async searchTechnical(query, maxResults) {
        const technicalQuery = `${query} site:github.com OR site:stackoverflow.com OR site:dev.to OR site:medium.com`;
        return this.searchGeneral(technicalQuery, maxResults);
    }
    // Documentation search
    async searchDocumentation(query, maxResults) {
        const docQuery = `${query} site:docs.npmjs.com OR site:developer.mozilla.org OR site:docs.python.org OR site:docs.oracle.com`;
        return this.searchGeneral(docQuery, maxResults);
    }
    // Stack Overflow specific search
    async searchStackOverflow(query, maxResults) {
        const soQuery = `${query} site:stackoverflow.com`;
        return this.searchGeneral(soQuery, maxResults);
    }
    // Fallback results when search fails
    getFallbackResults(query, maxResults) {
        return [
            {
                title: `Search results for: ${query}`,
                url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                snippet: `Manual search link for: ${query}`,
                relevance: 1.0
            },
            {
                title: `Stack Overflow search`,
                url: `https://stackoverflow.com/search?q=${encodeURIComponent(query)}`,
                snippet: `Search Stack Overflow for: ${query}`,
                relevance: 0.9
            },
            {
                title: `GitHub search`,
                url: `https://github.com/search?q=${encodeURIComponent(query)}`,
                snippet: `Search GitHub repositories for: ${query}`,
                relevance: 0.8
            }
        ].slice(0, maxResults);
    }
}
exports.WebSearchProvider = WebSearchProvider;
