"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexProject = indexProject;
exports.search = search;
const chromadb_1 = require("chromadb");
const glob_1 = require("glob");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const cli_ui_1 = require("../utils/cli-ui");
const config_manager_1 = require("../core/config-manager");
class OpenAIEmbeddingFunction {
    constructor() {
        this.model = 'text-embedding-3-small'; // Most cost-effective OpenAI embedding model
        this.maxTokens = 8191; // Max tokens per request for this model
        this.batchSize = 100; // Process in batches to avoid rate limits
        this.apiKey = config_manager_1.configManager.getApiKey('openai') || process.env.OPENAI_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('OpenAI API key not found. Set it using: npm run cli set-key openai YOUR_API_KEY');
        }
    }
    async generate(texts) {
        if (texts.length === 0)
            return [];
        try {
            // Process texts in batches to avoid rate limits and token limits
            const results = [];
            for (let i = 0; i < texts.length; i += this.batchSize) {
                const batch = texts.slice(i, i + this.batchSize);
                const batchResults = await this.generateBatch(batch);
                results.push(...batchResults);
                // Add small delay between batches to respect rate limits
                if (i + this.batchSize < texts.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            return results;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Embedding generation failed: ${error.message}`);
            throw error;
        }
    }
    async generateBatch(texts) {
        // Truncate texts that are too long to avoid token limit
        const processedTexts = texts.map(text => this.truncateText(text));
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                input: processedTexts,
                encoding_format: 'float', // More efficient than base64
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${error}`);
        }
        const data = await response.json();
        return data.data.map((item) => item.embedding);
    }
    truncateText(text) {
        // Rough estimation: 1 token ≈ 4 characters for English text
        const maxChars = this.maxTokens * 4;
        if (text.length <= maxChars)
            return text;
        // Truncate and add indication
        return text.substring(0, maxChars - 50) + '\n[... content truncated ...]';
    }
    // Utility method to estimate cost
    static estimateCost(texts) {
        const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
        const estimatedTokens = Math.ceil(totalChars / 4); // Rough estimation
        const costPer1KTokens = 0.00002; // $0.00002 per 1K tokens for text-embedding-3-small
        return (estimatedTokens / 1000) * costPer1KTokens;
    }
}
const embedder = new OpenAIEmbeddingFunction();
const client = new chromadb_1.ChromaClient();
// Utility functions
async function estimateIndexingCost(files, projectPath) {
    let totalChars = 0;
    let processedFiles = 0;
    for (const file of files.slice(0, Math.min(files.length, 10))) { // Sample first 10 files
        try {
            const filePath = (0, path_1.join)(projectPath, file);
            const content = await (0, promises_1.readFile)(filePath, "utf-8");
            if (!isBinaryFile(content) && content.length <= 1000000) {
                totalChars += content.length;
                processedFiles++;
            }
        }
        catch {
            // Skip files that can't be read
        }
    }
    if (processedFiles === 0)
        return 0;
    // Estimate total based on sample
    const avgCharsPerFile = totalChars / processedFiles;
    const estimatedTotalChars = avgCharsPerFile * files.length;
    return OpenAIEmbeddingFunction.estimateCost([{ length: estimatedTotalChars }]);
}
function isBinaryFile(content) {
    // Simple heuristic: if more than 1% of characters are null bytes or non-printable, consider it binary
    const nullBytes = (content.match(/\0/g) || []).length;
    const nonPrintable = (content.match(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g) || []).length;
    const threshold = content.length * 0.01;
    return nullBytes > 0 || nonPrintable > threshold;
}
async function indexProject(projectPath) {
    cli_ui_1.CliUI.logSection('Project Indexing');
    cli_ui_1.CliUI.startSpinner('Starting project indexing...');
    try {
        const collection = await client.getOrCreateCollection({
            name: "project_index",
            embeddingFunction: embedder,
        });
        cli_ui_1.CliUI.updateSpinner('Finding files to index...');
        const files = glob_1.glob.sync("**/*", {
            cwd: projectPath,
            ignore: ["node_modules/**", ".git/**", "*.log", "dist/**", "build/**"],
            nodir: true,
        });
        cli_ui_1.CliUI.stopSpinner();
        cli_ui_1.CliUI.logInfo(`Found ${cli_ui_1.CliUI.highlight(files.length.toString())} files to index`);
        // Estimate cost before proceeding
        const estimatedCost = await estimateIndexingCost(files, projectPath);
        cli_ui_1.CliUI.logInfo(`Estimated embedding cost: ${cli_ui_1.CliUI.highlight('$' + estimatedCost.toFixed(4))}`);
        cli_ui_1.CliUI.startSpinner('Indexing files...');
        let processedFiles = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const filePath = (0, path_1.join)(projectPath, file);
            try {
                const content = await (0, promises_1.readFile)(filePath, "utf-8");
                // Skip binary files and very large files
                if (isBinaryFile(content) || content.length > 1000000) {
                    cli_ui_1.CliUI.logWarning(`Skipping large/binary file: ${cli_ui_1.CliUI.dim(file)}`);
                    continue;
                }
                await collection.add({
                    ids: [filePath],
                    documents: [content],
                    metadatas: [{ source: file, size: content.length }],
                });
                processedFiles++;
                cli_ui_1.CliUI.updateSpinner(`Indexing files... (${processedFiles}/${files.length})`);
            }
            catch (fileError) {
                cli_ui_1.CliUI.logWarning(`Failed to index ${cli_ui_1.CliUI.dim(file)}: ${fileError.message}`);
            }
        }
        cli_ui_1.CliUI.succeedSpinner(`Project indexed successfully! Processed ${cli_ui_1.CliUI.highlight(processedFiles.toString())} files`);
        cli_ui_1.CliUI.logInfo(`Index ready for search queries`);
    }
    catch (error) {
        cli_ui_1.CliUI.failSpinner('Error indexing project');
        console.error(cli_ui_1.CliUI.formatError(error, 'Project indexing'));
    }
}
async function search(query) {
    const collection = await client.getOrCreateCollection({
        name: "project_index",
        embeddingFunction: embedder,
    });
    const results = await collection.query({
        nResults: 5,
        queryTexts: [query],
    });
    return results;
}
