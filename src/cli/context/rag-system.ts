import { ChromaClient, CloudClient, EmbeddingFunction } from "chromadb";
// Register default embed provider for CloudClient (server-side embeddings)
// This package is a side-effect import that wires up default embeddings
// when using Chroma Cloud.
import "@chroma-core/default-embed";
import { readFile } from "fs/promises";
import { join } from "path";
import { CliUI } from '../utils/cli-ui';
import { configManager } from '../core/config-manager';

class OpenAIEmbeddingFunction implements EmbeddingFunction {
  private apiKey: string;
  private model: string = 'text-embedding-3-small'; // Most cost-effective OpenAI embedding model
  private maxTokens: number = 8191; // Max tokens per request for this model
  private batchSize: number = 100; // Process in batches to avoid rate limits

  constructor() {
    this.apiKey = configManager.getApiKey('openai') || process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('OpenAI API key not found. Set it using: npm run cli set-key openai YOUR_API_KEY');
    }
  }

  async generate(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
      // Process texts in batches to avoid rate limits and token limits
      const results: number[][] = [];

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
    } catch (error: any) {
      CliUI.logError(`Embedding generation failed: ${error.message}`);
      throw error;
    }
  }

  private async generateBatch(texts: string[]): Promise<number[][]> {
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
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return (data as any).data.map((item: any) => item.embedding);
  }

  private truncateText(text: string): string {
    // Rough estimation: 1 token ≈ 4 characters for English text
    const maxChars = this.maxTokens * 4;
    if (text.length <= maxChars) return text;

    // Truncate and add indication
    return text.substring(0, maxChars - 50) + '\n[... content truncated ...]';
  }

  // Utility method to estimate cost
  static estimateCost(input: string[] | number): number {
    // Validate input
    if (typeof input === 'number' && input < 0) {
      throw new Error('Character count cannot be negative');
    }
    if (Array.isArray(input) && input.length === 0) {
      return 0;
    }
    const totalChars = typeof input === 'number'
      ? input
      : input.reduce((sum, text) => sum + text.length, 0);
    const estimatedTokens = Math.ceil(totalChars / 4); // Rough estimation
    const costPer1KTokens = 0.00002; // $0.00002 per 1K tokens for text-embedding-3-small
    return (estimatedTokens / 1000) * costPer1KTokens;
  }
}

// Lazy embedder initialization to avoid throwing at import time
let _embedder: OpenAIEmbeddingFunction | null = null;
function getEmbedder(): OpenAIEmbeddingFunction {
  if (_embedder) return _embedder;
  _embedder = new OpenAIEmbeddingFunction();
  return _embedder;
}

// Resolve Chroma client: prefer CloudClient (if API key present), otherwise local ChromaClient
function getClient() {
  const apiKey = process.env.CHROMA_API_KEY || process.env.CHROMA_CLOUD_API_KEY;
  const tenant = process.env.CHROMA_TENANT;
  const database = process.env.CHROMA_DATABASE || 'agent-cli';

  if (apiKey && tenant) {
    return new CloudClient({
      apiKey,
      tenant,
      database,
    });
  }

  // Fallback to local server
  return new ChromaClient({ path: process.env.CHROMA_URL || undefined });
}

// Utility functions
async function estimateIndexingCost(files: string[], projectPath: string): Promise<number> {
  let totalChars = 0;
  let processedFiles = 0;

  for (const file of files.slice(0, Math.min(files.length, 10))) { // Sample first 10 files
    try {
      const filePath = join(projectPath, file);
      const content = await readFile(filePath, "utf-8");
      if (!isBinaryFile(content) && content.length <= 1000000) {
        totalChars += content.length;
        processedFiles++;
      }
    } catch {
      // Skip files that can't be read
    }
  }

  if (processedFiles === 0) return 0;

  // Estimate total based on sample
  const avgCharsPerFile = totalChars / processedFiles;
  const estimatedTotalChars = avgCharsPerFile * files.length;

  return OpenAIEmbeddingFunction.estimateCost(estimatedTotalChars);
}

function isBinaryFile(content: string): boolean {
  // Simple heuristic: if more than 1% of characters are null bytes or non-printable, consider it binary
  const nullBytes = (content.match(/\0/g) || []).length;
  const nonPrintable = (content.match(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g) || []).length;
  const threshold = content.length * 0.01;

  return nullBytes > 0 || nonPrintable > threshold;
}

export async function indexProject(projectPath: string) {
  CliUI.logSection('Project Indexing');
  CliUI.startSpinner('Starting project indexing...');

  try {
    // ESM-only import handled via dynamic import to keep CJS build settings
    const { globby } = await import('globby');

    const client = getClient();
    const collection = await client.getOrCreateCollection({
      name: "project_index",
      // For CloudClient, embeddings are handled by the default embed provider
      // For local ChromaClient, we provide our OpenAI embedder
      ...(!process.env.CHROMA_API_KEY || !process.env.CHROMA_TENANT
        ? { embeddingFunction: getEmbedder() }
        : {}),
    });

    CliUI.updateSpinner('Finding files to index...');
    const files = await globby("**/*", {
      cwd: projectPath,
      ignore: ["node_modules/**", ".git/**", "*.log", "dist/**", "build/**"],
      onlyFiles: true,
    });

    CliUI.stopSpinner();
    CliUI.logInfo(`Found ${CliUI.highlight(files.length.toString())} files to index`);

    // Estimate cost before proceeding
    const estimatedCost = await estimateIndexingCost(files, projectPath);
    CliUI.logInfo(`Estimated embedding cost: ${CliUI.highlight('$' + estimatedCost.toFixed(4))}`);

    CliUI.startSpinner('Indexing files...');
    let processedFiles = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = join(projectPath, file);

      try {
        const content = await readFile(filePath, "utf-8");

        // Skip binary files and very large files
        if (isBinaryFile(content) || content.length > 1000000) {
          CliUI.logWarning(`Skipping large/binary file: ${CliUI.dim(file)}`);
          continue;
        }

        await collection.add({
          ids: [filePath],
          documents: [content],
          metadatas: [{ source: file, size: content.length }],
        });

        processedFiles++;
        CliUI.updateSpinner(`Indexing files... (${processedFiles}/${files.length})`);

      } catch (fileError: any) {
        CliUI.logWarning(`Failed to index ${CliUI.dim(file)}: ${fileError.message}`);
      }
    }

    CliUI.succeedSpinner(`Project indexed successfully! Processed ${CliUI.highlight(processedFiles.toString())} files`);
    CliUI.logInfo(`Index ready for search queries`);

  } catch (error: any) {
    CliUI.failSpinner('Error indexing project');
    console.error(CliUI.formatError(error, 'Project indexing'));
  }
}

export async function search(query: string) {
  const client = getClient();
  const collection = await client.getOrCreateCollection({
    name: "project_index",
    ...(client instanceof ChromaClient ? { embeddingFunction: getEmbedder() } : {}),
  });

  const results = await collection.query({
    nResults: 5,
    queryTexts: [query],
  });

  return results;
}