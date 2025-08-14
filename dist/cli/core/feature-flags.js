"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureFlagManager = exports.FeatureFlagManager = exports.FeatureFlagConfigSchema = exports.FeatureFlagSchema = void 0;
const zod_1 = require("zod");
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const chalk_1 = __importDefault(require("chalk"));
const path_1 = require("path");
const events_1 = require("events");
const logger_1 = require("../utils/logger");
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
exports.FeatureFlagSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    enabled: zod_1.z.boolean().default(false),
    category: zod_1.z.enum(['core', 'tools', 'agents', 'ui', 'performance', 'security', 'experimental']),
    environment: zod_1.z.array(zod_1.z.enum(['development', 'staging', 'production', 'all'])).default(['all']),
    version: zod_1.z.string().default('1.0.0'),
    dependencies: zod_1.z.array(zod_1.z.string()).default([]),
    conflicts: zod_1.z.array(zod_1.z.string()).default([]),
    rolloutPercentage: zod_1.z.number().min(0).max(100).default(100),
    userGroups: zod_1.z.array(zod_1.z.string()).default(['all']),
    startDate: zod_1.z.date().optional(),
    endDate: zod_1.z.date().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).default({}),
    createdAt: zod_1.z.date().default(() => new Date()),
    updatedAt: zod_1.z.date().default(() => new Date()),
    createdBy: zod_1.z.string().optional(),
    lastModifiedBy: zod_1.z.string().optional()
});
exports.FeatureFlagConfigSchema = zod_1.z.object({
    configFile: zod_1.z.string().default('feature-flags.json'),
    environment: zod_1.z.enum(['development', 'staging', 'production']).default('development'),
    enableRemoteConfig: zod_1.z.boolean().default(false),
    remoteConfigUrl: zod_1.z.string().optional(),
    refreshInterval: zod_1.z.number().int().default(300000),
    enableLogging: zod_1.z.boolean().default(true),
    enableMetrics: zod_1.z.boolean().default(true),
    enableValidation: zod_1.z.boolean().default(true),
    enableHotReload: zod_1.z.boolean().default(true),
    userId: zod_1.z.string().optional(),
    userGroup: zod_1.z.string().default('default'),
    customAttributes: zod_1.z.record(zod_1.z.any()).default({})
});
class FeatureFlagManager extends events_1.EventEmitter {
    constructor(workingDirectory, config = {}) {
        super();
        this.flags = new Map();
        this.isInitialized = false;
        this.workingDirectory = workingDirectory;
        this.config = exports.FeatureFlagConfigSchema.parse(config);
        this.configFilePath = (0, path_1.join)(workingDirectory, this.config.configFile);
    }
    static getInstance(workingDirectory, config) {
        if (!FeatureFlagManager.instance && workingDirectory) {
            FeatureFlagManager.instance = new FeatureFlagManager(workingDirectory, config);
        }
        return FeatureFlagManager.instance;
    }
    async initialize() {
        if (this.isInitialized)
            return;
        advanced_cli_ui_1.advancedUI.logInfo('🚩 Initializing Feature Flag Manager...');
        const startTime = Date.now();
        try {
            await this.loadDefaultFlags();
            await this.loadFromFile();
            if (this.config.enableRemoteConfig) {
                await this.loadFromRemote();
            }
            if (this.config.enableValidation) {
                await this.validateFlags();
            }
            if (this.config.enableHotReload && this.config.refreshInterval > 0) {
                this.startRefreshTimer();
            }
            this.isInitialized = true;
            const loadTime = Date.now() - startTime;
            advanced_cli_ui_1.advancedUI.logSuccess(`✅ Feature Flag Manager initialized (${this.flags.size} flags, ${loadTime}ms)`);
            if (this.config.enableMetrics) {
                this.logFlagStats();
            }
        }
        catch (error) {
            advanced_cli_ui_1.advancedUI.logError(`❌ Feature Flag Manager initialization failed: ${error.message}`);
            throw error;
        }
    }
    isEnabled(flagId) {
        const flag = this.flags.get(flagId);
        if (!flag) {
            if (this.config.enableLogging) {
                logger_1.logger.debug(`Feature flag not found: ${flagId}, defaulting to false`);
            }
            return false;
        }
        if (!flag.environment.includes(this.config.environment) && !flag.environment.includes('all')) {
            return false;
        }
        const now = new Date();
        if (flag.startDate && now < flag.startDate)
            return false;
        if (flag.endDate && now > flag.endDate)
            return false;
        if (!flag.userGroups.includes('all') &&
            !flag.userGroups.includes(this.config.userGroup)) {
            return false;
        }
        if (flag.rolloutPercentage < 100) {
            const hash = this.hashString(flagId + (this.config.userId || 'anonymous'));
            const percentage = hash % 100;
            if (percentage >= flag.rolloutPercentage)
                return false;
        }
        if (flag.dependencies.length > 0) {
            for (const depId of flag.dependencies) {
                if (!this.isEnabled(depId))
                    return false;
            }
        }
        if (flag.conflicts.length > 0) {
            for (const conflictId of flag.conflicts) {
                if (this.isEnabled(conflictId))
                    return false;
            }
        }
        if (this.config.enableLogging && flag.enabled) {
            logger_1.logger.debug(`Feature flag enabled: ${flagId}`);
        }
        return flag.enabled;
    }
    async setFlag(flagId, enabled, source = 'manual') {
        const flag = this.flags.get(flagId);
        if (!flag) {
            throw new Error(`Feature flag not found: ${flagId}`);
        }
        const oldValue = flag.enabled;
        if (oldValue === enabled)
            return;
        flag.enabled = enabled;
        flag.updatedAt = new Date();
        flag.lastModifiedBy = this.config.userId || 'system';
        this.emit('flagChanged', {
            flagId,
            oldValue,
            newValue: enabled,
            timestamp: new Date(),
            source
        });
        if (this.config.enableLogging) {
            advanced_cli_ui_1.advancedUI.logInfo(`🚩 Feature flag ${enabled ? 'enabled' : 'disabled'}: ${flagId}`);
        }
        await this.saveToFile();
    }
    async createFlag(flag) {
        const flagId = flag.name.toLowerCase().replace(/\s+/g, '-');
        const newFlag = exports.FeatureFlagSchema.parse({
            ...flag,
            id: flagId,
            createdBy: this.config.userId || 'system'
        });
        if (this.flags.has(flagId)) {
            throw new Error(`Feature flag already exists: ${flagId}`);
        }
        this.flags.set(flagId, newFlag);
        if (this.config.enableLogging) {
            advanced_cli_ui_1.advancedUI.logSuccess(`✅ Created feature flag: ${flagId}`);
        }
        await this.saveToFile();
        return flagId;
    }
    async updateFlag(flagId, updates) {
        const flag = this.flags.get(flagId);
        if (!flag) {
            throw new Error(`Feature flag not found: ${flagId}`);
        }
        const updatedFlag = exports.FeatureFlagSchema.parse({
            ...flag,
            ...updates,
            id: flagId,
            updatedAt: new Date(),
            lastModifiedBy: this.config.userId || 'system'
        });
        this.flags.set(flagId, updatedFlag);
        if (this.config.enableLogging) {
            advanced_cli_ui_1.advancedUI.logInfo(`🚩 Updated feature flag: ${flagId}`);
        }
        await this.saveToFile();
    }
    async deleteFlag(flagId) {
        const flag = this.flags.get(flagId);
        if (!flag)
            return false;
        this.flags.delete(flagId);
        if (this.config.enableLogging) {
            advanced_cli_ui_1.advancedUI.logInfo(`🗑️  Deleted feature flag: ${flagId}`);
        }
        await this.saveToFile();
        return true;
    }
    getFlag(flagId) {
        return this.flags.get(flagId) || null;
    }
    getAllFlags() {
        return new Map(this.flags);
    }
    getFlagsByCategory(category) {
        return Array.from(this.flags.values()).filter(flag => flag.category === category);
    }
    getEnabledFlags() {
        return Array.from(this.flags.values()).filter(flag => this.isEnabled(flag.id));
    }
    searchFlags(query) {
        const searchTerm = query.toLowerCase();
        return Array.from(this.flags.values()).filter(flag => flag.name.toLowerCase().includes(searchTerm) ||
            flag.description.toLowerCase().includes(searchTerm) ||
            flag.id.toLowerCase().includes(searchTerm));
    }
    async refresh() {
        if (this.config.enableRemoteConfig) {
            await this.loadFromRemote();
        }
        else {
            await this.loadFromFile();
        }
    }
    getFlagStats() {
        const flags = Array.from(this.flags.values());
        const enabled = flags.filter(f => this.isEnabled(f.id));
        const stats = {
            total: flags.length,
            enabled: enabled.length,
            disabled: flags.length - enabled.length,
            byCategory: {},
            byEnvironment: {},
            experimental: flags.filter(f => f.category === 'experimental').length,
            recentlyUpdated: flags.filter(f => {
                const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                return f.updatedAt > dayAgo;
            }).length
        };
        for (const flag of flags) {
            stats.byCategory[flag.category] = (stats.byCategory[flag.category] || 0) + 1;
        }
        for (const flag of flags) {
            for (const env of flag.environment) {
                stats.byEnvironment[env] = (stats.byEnvironment[env] || 0) + 1;
            }
        }
        return stats;
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (newConfig.refreshInterval !== undefined && this.refreshTimer) {
            this.stopRefreshTimer();
            if (this.config.enableHotReload && this.config.refreshInterval > 0) {
                this.startRefreshTimer();
            }
        }
        advanced_cli_ui_1.advancedUI.logInfo('🚩 Feature Flag configuration updated');
    }
    async cleanup() {
        this.stopRefreshTimer();
        this.removeAllListeners();
        if (this.config.enableLogging) {
            advanced_cli_ui_1.advancedUI.logInfo('🚩 Feature Flag Manager cleanup completed');
        }
    }
    async loadDefaultFlags() {
        const defaultFlags = [
            {
                name: 'LSP Integration',
                description: 'Enable Language Server Protocol integration for code intelligence',
                enabled: true,
                category: 'core',
                dependencies: [],
                environment: ['all']
            },
            {
                name: 'Context Awareness',
                description: 'Enable workspace context awareness and RAG system',
                enabled: true,
                category: 'core',
                dependencies: [],
                environment: ['all']
            },
            {
                name: 'Advanced Validation',
                description: 'Enable comprehensive validation and formatting pipeline',
                enabled: true,
                category: 'tools',
                dependencies: [],
                environment: ['all']
            },
            {
                name: 'Tool Registry',
                description: 'Enable advanced tool registry and management system',
                enabled: true,
                category: 'tools',
                dependencies: [],
                environment: ['all']
            },
            {
                name: 'Prompt Engineering',
                description: 'Enable advanced prompt registry and template system',
                enabled: true,
                category: 'agents',
                dependencies: [],
                environment: ['all']
            },
            {
                name: 'Performance Monitoring',
                description: 'Enable performance metrics and monitoring',
                enabled: true,
                category: 'performance',
                dependencies: [],
                environment: ['all']
            },
            {
                name: 'Hot Reload',
                description: 'Enable hot reloading of tools and prompts during development',
                enabled: false,
                category: 'experimental',
                environment: ['development'],
                rolloutPercentage: 50
            },
            {
                name: 'Remote Config',
                description: 'Enable remote configuration management',
                enabled: false,
                category: 'experimental',
                environment: ['staging', 'production'],
                rolloutPercentage: 25
            },
            {
                name: 'Advanced Security',
                description: 'Enable advanced security features and sandboxing',
                enabled: false,
                category: 'security',
                environment: ['production'],
                dependencies: ['tool-registry'],
                rolloutPercentage: 75
            },
            {
                name: 'Plugin System',
                description: 'Enable dynamic plugin loading and management',
                enabled: false,
                category: 'experimental',
                dependencies: ['tool-registry', 'advanced-validation'],
                rolloutPercentage: 10
            }
        ];
        for (const flagData of defaultFlags) {
            const flagId = flagData.name.toLowerCase().replace(/\s+/g, '-');
            if (!this.flags.has(flagId)) {
                const flag = exports.FeatureFlagSchema.parse({
                    ...flagData,
                    id: flagId,
                    createdBy: 'system'
                });
                this.flags.set(flagId, flag);
            }
        }
    }
    async loadFromFile() {
        try {
            if (!await (0, fs_1.existsSync)(this.configFilePath)) {
                await this.saveToFile();
                return;
            }
            const content = await (0, promises_1.readFile)(this.configFilePath, 'utf8');
            const data = JSON.parse(content);
            if (data.flags && Array.isArray(data.flags)) {
                for (const flagData of data.flags) {
                    try {
                        const flag = exports.FeatureFlagSchema.parse(flagData);
                        this.flags.set(flag.id, flag);
                    }
                    catch (error) {
                        logger_1.logger.warn(`Invalid feature flag in config: ${flagData.id || 'unknown'}`, error.message);
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.warn(`Failed to load feature flags from file: ${error.message}`);
        }
    }
    async loadFromRemote() {
        if (!this.config.remoteConfigUrl)
            return;
        try {
            logger_1.logger.debug('Remote config loading not implemented yet');
        }
        catch (error) {
            logger_1.logger.warn(`Failed to load feature flags from remote: ${error.message}`);
        }
    }
    async saveToFile() {
        try {
            const data = {
                version: '1.0.0',
                lastUpdated: new Date().toISOString(),
                environment: this.config.environment,
                flags: Array.from(this.flags.values()).map(flag => ({
                    ...flag,
                    createdAt: flag.createdAt.toISOString(),
                    updatedAt: flag.updatedAt.toISOString(),
                    startDate: flag.startDate?.toISOString(),
                    endDate: flag.endDate?.toISOString()
                }))
            };
            await (0, promises_1.writeFile)(this.configFilePath, JSON.stringify(data, null, 2), 'utf8');
        }
        catch (error) {
            logger_1.logger.error(`Failed to save feature flags to file: ${error.message}`);
        }
    }
    async validateFlags() {
        const flags = Array.from(this.flags.values());
        const issues = [];
        for (const flag of flags) {
            for (const depId of flag.dependencies) {
                if (!this.flags.has(depId)) {
                    issues.push(`Flag ${flag.id} depends on non-existent flag: ${depId}`);
                }
            }
            for (const conflictId of flag.conflicts) {
                if (!this.flags.has(conflictId)) {
                    issues.push(`Flag ${flag.id} conflicts with non-existent flag: ${conflictId}`);
                }
            }
            if (this.hasCircularDependency(flag.id, new Set())) {
                issues.push(`Flag ${flag.id} has circular dependency`);
            }
        }
        if (issues.length > 0 && this.config.enableLogging) {
            advanced_cli_ui_1.advancedUI.logWarning(`⚠️  Feature flag validation issues found:`);
            for (const issue of issues) {
                logger_1.logger.warn(`  - ${issue}`);
            }
        }
    }
    hasCircularDependency(flagId, visited) {
        if (visited.has(flagId))
            return true;
        const flag = this.flags.get(flagId);
        if (!flag)
            return false;
        visited.add(flagId);
        for (const depId of flag.dependencies) {
            if (this.hasCircularDependency(depId, new Set(visited))) {
                return true;
            }
        }
        return false;
    }
    startRefreshTimer() {
        this.refreshTimer = setInterval(() => {
            this.refresh().catch(error => {
                logger_1.logger.warn(`Feature flag refresh failed: ${error.message}`);
            });
        }, this.config.refreshInterval);
    }
    stopRefreshTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    logFlagStats() {
        const stats = this.getFlagStats();
        advanced_cli_ui_1.advancedUI.logInfo(`🚩 Feature Flag Statistics:`);
        console.log(chalk_1.default.cyan(`   Total Flags: ${stats.total}`));
        console.log(chalk_1.default.cyan(`   Enabled: ${stats.enabled}`));
        console.log(chalk_1.default.cyan(`   Disabled: ${stats.disabled}`));
        console.log(chalk_1.default.cyan(`   Experimental: ${stats.experimental}`));
        console.log(chalk_1.default.cyan(`   Recently Updated: ${stats.recentlyUpdated}`));
        if (Object.keys(stats.byCategory).length > 0) {
            console.log(chalk_1.default.cyan(`   By Category:`));
            Object.entries(stats.byCategory).forEach(([category, count]) => {
                console.log(chalk_1.default.gray(`     ${category}: ${count}`));
            });
        }
    }
}
exports.FeatureFlagManager = FeatureFlagManager;
exports.featureFlagManager = FeatureFlagManager.getInstance();
