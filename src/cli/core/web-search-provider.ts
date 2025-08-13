import { tool } from 'ai';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
    relevance: number;
}

export class WebSearchProvider {

    // Web search tool using AI SDK
    getWebSearchTool() {
        return tool({
            description: 'Search the web for current information, documentation, or solutions',
            parameters: z.object({
                query: z.string().describe('Search query to find relevant information'),
                maxResults: z.number().default(5).describe('Maximum number of results to return'),
                searchType: z.enum(['general', 'technical', 'documentation', 'stackoverflow']).default('general').describe('Type of search to perform')
            }),
            execute: async ({ query, maxResults, searchType }) => {
                try {
                    console.log(chalk.blue(`🔍 Searching web for: "${query}" (${searchType})`));

                    // Use different search strategies based on type
                    let searchResults: WebSearchResult[] = [];

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
                } catch (error: any) {
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
    private async searchGeneral(query: string, maxResults: number): Promise<WebSearchResult[]> {
        try {
            // Use DuckDuckGo for privacy-friendly search
            const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const { stdout } = await execAsync(`curl -s -A "Mozilla/5.0" "${searchUrl}" | grep -o 'href="[^"]*" class="result__url"' | head -${maxResults}`);

            const results: WebSearchResult[] = [];
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
        } catch (error) {
            console.warn('General search failed, using fallback');
            return this.getFallbackResults(query, maxResults);
        }
    }

    // Technical search focusing on developer resources
    private async searchTechnical(query: string, maxResults: number): Promise<WebSearchResult[]> {
        const technicalQuery = `${query} site:github.com OR site:stackoverflow.com OR site:dev.to OR site:medium.com`;
        return this.searchGeneral(technicalQuery, maxResults);
    }

    // Documentation search
    private async searchDocumentation(query: string, maxResults: number): Promise<WebSearchResult[]> {
        const docQuery = `${query} site:docs.npmjs.com OR site:developer.mozilla.org OR site:docs.python.org OR site:docs.oracle.com`;
        return this.searchGeneral(docQuery, maxResults);
    }

    // Stack Overflow specific search
    private async searchStackOverflow(query: string, maxResults: number): Promise<WebSearchResult[]> {
        const soQuery = `${query} site:stackoverflow.com`;
        return this.searchGeneral(soQuery, maxResults);
    }

    // Fallback results when search fails
    private getFallbackResults(query: string, maxResults: number): WebSearchResult[] {
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
