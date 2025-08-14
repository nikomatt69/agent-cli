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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudDocsProvider = void 0;
exports.createCloudDocsProvider = createCloudDocsProvider;
exports.getCloudDocsProvider = getCloudDocsProvider;
const supabase_js_1 = require("@supabase/supabase-js");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const config_manager_1 = require("./config-manager");
class CloudDocsProvider {
    constructor(config, cacheDir = './.nikcli') {
        this.supabase = null;
        this.isInitialized = false;
        this.config = {
            enabled: true,
            provider: 'supabase',
            autoSync: true,
            contributionMode: true,
            maxContextSize: 50000,
            autoLoadForAgents: true,
            smartSuggestions: true,
            ...config
        };
        if (!this.config.apiUrl || !this.config.apiKey) {
            const cloudKeys = config_manager_1.simpleConfigManager.getCloudDocsApiKeys();
            if (!this.config.apiUrl && cloudKeys.apiUrl) {
                this.config.apiUrl = cloudKeys.apiUrl;
            }
            if (!this.config.apiKey && cloudKeys.apiKey) {
                this.config.apiKey = cloudKeys.apiKey;
            }
        }
        this.cacheDir = cacheDir;
        this.sharedIndexFile = path.join(cacheDir, 'shared-docs-index.json');
    }
    async ensureInitialized() {
        if (this.isInitialized)
            return;
        if (this.config.enabled && this.config.provider === 'supabase') {
            await this.initializeSupabase();
        }
    }
    async initializeSupabase() {
        try {
            if (!this.config.apiUrl || !this.config.apiKey) {
                console.log(chalk_1.default.yellow('⚠️ Supabase credentials not configured. Cloud docs disabled.'));
                console.log(chalk_1.default.gray('Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables'));
                return;
            }
            this.supabase = (0, supabase_js_1.createClient)(this.config.apiUrl, this.config.apiKey);
            this.isInitialized = true;
            console.log(chalk_1.default.green('✅ Connected to Supabase docs cloud'));
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Failed to initialize Supabase: ${error.message}`));
        }
    }
    async sync() {
        await this.ensureInitialized();
        if (!this.isInitialized || !this.supabase) {
            throw new Error('Cloud docs provider not initialized');
        }
        console.log(chalk_1.default.blue('🔄 Synchronizing with cloud library...'));
        try {
            const { data: cloudDocs, error: fetchError } = await this.supabase
                .from('shared_docs')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(100);
            if (fetchError)
                throw fetchError;
            let downloaded = 0;
            let uploaded = 0;
            if (cloudDocs && cloudDocs.length > 0) {
                await this.saveSharedIndex(cloudDocs);
                downloaded = cloudDocs.length;
                console.log(chalk_1.default.green(`📥 Downloaded ${downloaded} shared documents`));
            }
            if (this.config.contributionMode) {
                console.log(chalk_1.default.gray('📤 Contribution mode enabled (upload not yet implemented)'));
            }
            console.log(chalk_1.default.green(`✅ Sync completed: ${downloaded} downloaded, ${uploaded} uploaded`));
            return { downloaded, uploaded };
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Sync failed: ${error.message}`));
            throw error;
        }
    }
    async publishDoc(doc) {
        await this.ensureInitialized();
        if (!this.isInitialized || !this.supabase) {
            throw new Error('Cloud docs provider not initialized');
        }
        console.log(chalk_1.default.blue(`📤 Publishing: ${doc.title}`));
        try {
            const sharedDoc = {
                title: doc.title,
                url: doc.url,
                content: doc.content.substring(0, 50000),
                category: doc.category,
                tags: doc.tags,
                language: doc.metadata.language,
                word_count: doc.metadata.wordCount,
                access_count: 0,
                popularity_score: 0
            };
            const { data, error } = await this.supabase
                .from('shared_docs')
                .insert([sharedDoc])
                .select()
                .single();
            if (error)
                throw error;
            console.log(chalk_1.default.green(`✅ Published: ${data.title}`));
            return data;
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Publish failed: ${error.message}`));
            throw error;
        }
    }
    async searchShared(query, category, limit = 10) {
        await this.ensureInitialized();
        if (!this.isInitialized || !this.supabase) {
            throw new Error('Cloud docs provider not initialized');
        }
        try {
            let queryBuilder = this.supabase
                .from('shared_docs')
                .select('*');
            if (category) {
                queryBuilder = queryBuilder.eq('category', category);
            }
            queryBuilder = queryBuilder.or(`title.ilike.%${query}%, content.ilike.%${query}%`);
            const { data, error } = await queryBuilder
                .order('popularity_score', { ascending: false })
                .limit(limit);
            if (error)
                throw error;
            return data || [];
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Search failed: ${error.message}`));
            throw error;
        }
    }
    async getPopularLibraries(limit = 20) {
        await this.ensureInitialized();
        if (!this.isInitialized || !this.supabase) {
            return [];
        }
        try {
            const { data, error } = await this.supabase
                .from('docs_libraries')
                .select('*')
                .order('installs_count', { ascending: false })
                .limit(limit);
            if (error)
                throw error;
            return data || [];
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Failed to get popular libraries: ${error.message}`));
            return [];
        }
    }
    async installLibrary(libraryName) {
        await this.ensureInitialized();
        if (!this.isInitialized || !this.supabase) {
            throw new Error('Cloud docs provider not initialized');
        }
        console.log(chalk_1.default.blue(`📦 Installing library: ${libraryName}`));
        try {
            const { data: library, error: libError } = await this.supabase
                .from('docs_libraries')
                .select('*')
                .eq('name', libraryName)
                .single();
            if (libError)
                throw libError;
            if (!library)
                throw new Error(`Library '${libraryName}' not found`);
            const { data: docs, error: docsError } = await this.supabase
                .from('shared_docs')
                .select('*')
                .in('id', library.doc_ids);
            if (docsError)
                throw docsError;
            await this.supabase
                .from('docs_libraries')
                .update({ installs_count: library.installs_count + 1 })
                .eq('id', library.id);
            console.log(chalk_1.default.green(`✅ Installed ${docs?.length || 0} documents from '${libraryName}'`));
            return docs || [];
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Install failed: ${error.message}`));
            throw error;
        }
    }
    async saveSharedIndex(docs) {
        try {
            const index = {
                lastSync: new Date().toISOString(),
                totalDocs: docs.length,
                docs: docs.map(doc => ({
                    id: doc.id,
                    title: doc.title,
                    category: doc.category,
                    tags: doc.tags,
                    language: doc.language,
                    word_count: doc.word_count,
                    popularity_score: doc.popularity_score,
                    url: doc.url
                }))
            };
            await fs.writeFile(this.sharedIndexFile, JSON.stringify(index, null, 2));
            console.log(chalk_1.default.gray(`💾 Cached ${docs.length} shared docs locally`));
        }
        catch (error) {
            console.error('Failed to save shared docs index:', error);
        }
    }
    async loadSharedIndex() {
        try {
            const data = await fs.readFile(this.sharedIndexFile, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            return { lastSync: null, totalDocs: 0, docs: [] };
        }
    }
    isReady() {
        return this.isInitialized && this.supabase !== null;
    }
    async getCloudStats() {
        const index = await this.loadSharedIndex();
        return {
            totalSharedDocs: index.totalDocs,
            totalLibraries: 0,
            lastSync: index.lastSync
        };
    }
}
exports.CloudDocsProvider = CloudDocsProvider;
let cloudDocsProvider = null;
function createCloudDocsProvider(config) {
    if (!cloudDocsProvider) {
        cloudDocsProvider = new CloudDocsProvider(config);
    }
    return cloudDocsProvider;
}
function getCloudDocsProvider() {
    return cloudDocsProvider;
}
