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
exports.feedbackSystem = exports.FeedbackSystem = void 0;
const fs = __importStar(require("fs/promises"));
const fsSync = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const chalk_1 = __importDefault(require("chalk"));
const cloud_docs_provider_1 = require("./cloud-docs-provider");
const crypto_1 = require("crypto");
class FeedbackSystem {
    constructor(cacheDir = './.nikcli') {
        this.pendingFeedback = [];
        this.lastSubmit = new Date();
        this.feedbackDir = path.join(os.homedir(), '.nikcli', 'feedback');
        this.feedbackFile = path.join(this.feedbackDir, 'feedback.json');
        this.configFile = path.join(this.feedbackDir, 'feedback-config.json');
        this.config = {
            enabled: true,
            autoSubmit: true,
            anonymousMode: true,
            batchSize: 10,
            submitInterval: 60,
            keepLocal: true
        };
        this.ensureFeedbackDir();
        this.loadConfig();
        this.loadPendingFeedback();
    }
    ensureFeedbackDir() {
        if (!fsSync.existsSync(this.feedbackDir)) {
            fsSync.mkdirSync(this.feedbackDir, { recursive: true });
        }
    }
    loadConfig() {
        try {
            if (fsSync.existsSync(this.configFile)) {
                const data = fsSync.readFileSync(this.configFile, 'utf-8');
                this.config = { ...this.config, ...JSON.parse(data) };
            }
        }
        catch (error) {
            console.debug('Could not load feedback config, using defaults');
        }
    }
    async saveConfig() {
        try {
            await fs.writeFile(this.configFile, JSON.stringify(this.config, null, 2));
        }
        catch (error) {
            console.error('Failed to save feedback config:', error);
        }
    }
    loadPendingFeedback() {
        try {
            if (fsSync.existsSync(this.feedbackFile)) {
                const data = fsSync.readFileSync(this.feedbackFile, 'utf-8');
                this.pendingFeedback = JSON.parse(data);
            }
        }
        catch (error) {
            console.debug('Could not load pending feedback, starting fresh');
            this.pendingFeedback = [];
        }
    }
    async savePendingFeedback() {
        try {
            await fs.writeFile(this.feedbackFile, JSON.stringify(this.pendingFeedback, null, 2));
        }
        catch (error) {
            console.error('Failed to save pending feedback:', error);
        }
    }
    async reportDocGap(concept, context, impact, frequency, metadata = {}) {
        if (!this.config.enabled)
            return;
        const feedback = {
            id: this.generateId(),
            type: 'doc_gap',
            timestamp: new Date().toISOString(),
            concept,
            context,
            impact,
            frequency,
            metadata,
            status: 'pending',
            anonymized: this.config.anonymousMode
        };
        this.pendingFeedback.push(feedback);
        await this.savePendingFeedback();
        console.debug(`Internal agent feedback: Doc gap for ${concept} (${impact} impact)`);
        if (this.shouldAutoSubmit()) {
            await this.submitPendingFeedback();
        }
    }
    async reportSuccess(concept, context, resolution, metadata = {}) {
        if (!this.config.enabled)
            return;
        const feedback = {
            id: this.generateId(),
            type: 'success',
            timestamp: new Date().toISOString(),
            concept,
            context,
            impact: 'low',
            frequency: 'first-time',
            metadata: { ...metadata, resolution },
            status: 'resolved',
            anonymized: this.config.anonymousMode
        };
        this.pendingFeedback.push(feedback);
        await this.savePendingFeedback();
        if (this.shouldAutoSubmit()) {
            await this.submitPendingFeedback();
        }
    }
    async reportUsage(action, context, metadata = {}) {
        if (!this.config.enabled)
            return;
        const feedback = {
            id: this.generateId(),
            type: 'usage',
            timestamp: new Date().toISOString(),
            concept: action,
            context,
            impact: 'low',
            frequency: 'first-time',
            metadata: { ...metadata, userAction: action },
            status: 'acknowledged',
            anonymized: this.config.anonymousMode
        };
        this.pendingFeedback.push(feedback);
        if (this.shouldAutoSubmit()) {
            await this.submitPendingFeedback();
        }
    }
    async submitPendingFeedback() {
        if (!this.config.enabled || this.pendingFeedback.length === 0) {
            return { submitted: 0, failed: 0 };
        }
        const cloudProvider = (0, cloud_docs_provider_1.getCloudDocsProvider)();
        if (!cloudProvider) {
            console.debug('Cloud provider not available, keeping feedback local');
            return { submitted: 0, failed: 0 };
        }
        console.debug(`Submitting ${this.pendingFeedback.length} internal feedback entries`);
        let submitted = 0;
        let failed = 0;
        try {
            const batches = this.chunkArray(this.pendingFeedback, this.config.batchSize);
            for (const batch of batches) {
                try {
                    await this.submitFeedbackBatch(batch);
                    submitted += batch.length;
                    if (!this.config.keepLocal) {
                        this.pendingFeedback = this.pendingFeedback.filter(f => !batch.find(b => b.id === f.id));
                    }
                    else {
                        batch.forEach(b => {
                            const local = this.pendingFeedback.find(f => f.id === b.id);
                            if (local)
                                local.status = 'acknowledged';
                        });
                    }
                }
                catch (error) {
                    console.debug('Batch submission failed:', error);
                    failed += batch.length;
                }
            }
            await this.savePendingFeedback();
            this.lastSubmit = new Date();
            if (submitted > 0) {
                console.debug(`Internal: Submitted ${submitted} feedback entries for agent learning`);
            }
            if (failed > 0) {
                console.debug(`Internal: Failed to submit ${failed} feedback entries`);
            }
        }
        catch (error) {
            console.debug('Feedback submission failed:', error);
            failed = this.pendingFeedback.length;
        }
        return { submitted, failed };
    }
    async submitFeedbackBatch(batch) {
        const cloudProvider = (0, cloud_docs_provider_1.getCloudDocsProvider)();
        if (!cloudProvider)
            throw new Error('Cloud provider not available');
        const anonymizedBatch = batch.map(f => this.anonymizeFeedback(f));
        console.debug(`Would submit ${batch.length} feedback entries to cloud`);
    }
    anonymizeFeedback(feedback) {
        if (!this.config.anonymousMode)
            return feedback;
        return {
            ...feedback,
            metadata: {
                ...feedback.metadata,
                sessionId: feedback.metadata.sessionId ? 'anonymous' : undefined,
                userAction: feedback.metadata.userAction
            },
            anonymized: true
        };
    }
    shouldAutoSubmit() {
        if (!this.config.autoSubmit)
            return false;
        if (this.pendingFeedback.length >= this.config.batchSize)
            return true;
        const timeSinceLastSubmit = Date.now() - this.lastSubmit.getTime();
        const intervalMs = this.config.submitInterval * 60 * 1000;
        return timeSinceLastSubmit >= intervalMs && this.pendingFeedback.length > 0;
    }
    generateId() {
        return `feedback_${Date.now()}_${(0, crypto_1.randomBytes)(6).toString('base64url')}`;
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    getStats() {
        const now = Date.now();
        const dayAgo = now - (24 * 60 * 60 * 1000);
        const stats = {
            total: this.pendingFeedback.length,
            pending: this.pendingFeedback.filter(f => f.status === 'pending').length,
            byType: {},
            byImpact: {},
            recent: this.pendingFeedback.filter(f => new Date(f.timestamp).getTime() > dayAgo).length
        };
        this.pendingFeedback.forEach(f => {
            stats.byType[f.type] = (stats.byType[f.type] || 0) + 1;
            stats.byImpact[f.impact] = (stats.byImpact[f.impact] || 0) + 1;
        });
        return stats;
    }
    async configure(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await this.saveConfig();
        console.log(chalk_1.default.green('✅ Feedback configuration updated'));
        console.log(chalk_1.default.gray(`   Enabled: ${this.config.enabled}`));
        console.log(chalk_1.default.gray(`   Auto-submit: ${this.config.autoSubmit}`));
        console.log(chalk_1.default.gray(`   Anonymous: ${this.config.anonymousMode}`));
    }
    getTopGaps(limit = 10) {
        const gaps = this.pendingFeedback.filter(f => f.type === 'doc_gap');
        const grouped = new Map();
        gaps.forEach(gap => {
            if (!grouped.has(gap.concept)) {
                grouped.set(gap.concept, []);
            }
            grouped.get(gap.concept).push(gap);
        });
        const result = Array.from(grouped.entries())
            .map(([concept, entries]) => {
            const impacts = entries.map(e => e.impact);
            const avgImpact = this.calculateAverageImpact(impacts);
            const lastSeen = Math.max(...entries.map(e => new Date(e.timestamp).getTime()));
            return {
                concept,
                count: entries.length,
                avgImpact,
                lastSeen: new Date(lastSeen).toISOString()
            };
        })
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
        return result;
    }
    calculateAverageImpact(impacts) {
        const weights = { low: 1, medium: 2, high: 3, critical: 4 };
        const avgWeight = impacts.reduce((sum, impact) => sum + weights[impact], 0) / impacts.length;
        if (avgWeight >= 3.5)
            return 'critical';
        if (avgWeight >= 2.5)
            return 'high';
        if (avgWeight >= 1.5)
            return 'medium';
        return 'low';
    }
}
exports.FeedbackSystem = FeedbackSystem;
exports.feedbackSystem = new FeedbackSystem();
