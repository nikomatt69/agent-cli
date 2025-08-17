"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenManager = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
const cli_ui_1 = require("../../utils/cli-ui");
class TokenManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.activeTokens = new Map();
        this.revokedTokens = new Set();
        this.DEFAULT_TTL = 3600;
        this.MAX_TTL = 86400;
        this.TOKEN_CLEANUP_INTERVAL = 300000;
        this.jwtSecret = process.env.NIKCLI_JWT_SECRET || this.generateSecretKey();
        this.setupTokenCleanup();
    }
    static getInstance() {
        if (!TokenManager.instance) {
            TokenManager.instance = new TokenManager();
        }
        return TokenManager.instance;
    }
    async generateSessionToken(agentId, options = {}) {
        try {
            const tokenId = crypto_1.default.randomUUID();
            const now = Math.floor(Date.now() / 1000);
            const ttl = Math.min(options.ttl || this.DEFAULT_TTL, this.MAX_TTL);
            const payload = {
                jti: tokenId,
                sub: agentId,
                iat: now,
                exp: now + ttl,
                aud: 'nikcli-vm-agent',
                iss: 'nikcli-proxy',
                agentId,
                tokenBudget: options.tokenBudget || 50000,
                capabilities: options.capabilities || [],
                sessionId: crypto_1.default.randomUUID(),
                maxRequestsPerMinute: options.maxRequestsPerMinute || 30,
                allowedModels: options.allowedModels || ['claude-4-sonnet-20250514', 'gpt-5-mini-2025-08-07', 'gemini-2.5-pro'],
                maxTokensPerRequest: options.maxTokensPerRequest || 4000
            };
            const token = jsonwebtoken_1.default.sign(payload, this.jwtSecret, {
                algorithm: 'HS256',
                header: {
                    typ: 'JWT',
                    alg: 'HS256',
                    kid: tokenId
                }
            });
            const tokenInfo = {
                tokenId,
                agentId,
                issuedAt: new Date(now * 1000),
                expiresAt: new Date((now + ttl) * 1000),
                tokenBudget: payload.tokenBudget,
                capabilities: payload.capabilities,
                sessionId: payload.sessionId,
                revoked: false,
                usageStats: {
                    requestCount: 0,
                    tokenUsage: 0,
                    lastUsed: null
                }
            };
            this.activeTokens.set(tokenId, tokenInfo);
            cli_ui_1.CliUI.logSuccess(`🔑 Session token generated for agent ${agentId} (TTL: ${ttl}s)`);
            this.emit('token:generated', { agentId, tokenId, ttl });
            return token;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to generate session token: ${error.message}`);
            throw error;
        }
    }
    async verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token, { complete: true });
            if (!decoded || !decoded.header || !decoded.header.kid) {
                throw new Error('Invalid token format');
            }
            const tokenId = decoded.header.kid;
            if (this.revokedTokens.has(tokenId)) {
                throw new Error('Token has been revoked');
            }
            const payload = jsonwebtoken_1.default.verify(token, this.jwtSecret, {
                algorithms: ['HS256'],
                audience: 'nikcli-vm-agent',
                issuer: 'nikcli-proxy'
            });
            const tokenInfo = this.activeTokens.get(tokenId);
            if (tokenInfo && !tokenInfo.revoked) {
                tokenInfo.usageStats.lastUsed = new Date();
            }
            return payload;
        }
        catch (error) {
            if (error.name === 'TokenExpiredError') {
                cli_ui_1.CliUI.logWarning(`⚠️ Token expired: ${error.message}`);
            }
            else if (error.name === 'JsonWebTokenError') {
                cli_ui_1.CliUI.logError(`❌ Invalid token: ${error.message}`);
            }
            else {
                cli_ui_1.CliUI.logError(`❌ Token verification failed: ${error.message}`);
            }
            throw error;
        }
    }
    async revokeToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token, { complete: true });
            if (!decoded || !decoded.header || !decoded.header.kid) {
                throw new Error('Invalid token format');
            }
            const tokenId = decoded.header.kid;
            const agentId = decoded.payload.agentId;
            this.revokedTokens.add(tokenId);
            const tokenInfo = this.activeTokens.get(tokenId);
            if (tokenInfo) {
                tokenInfo.revoked = true;
                this.activeTokens.set(tokenId, tokenInfo);
            }
            cli_ui_1.CliUI.logInfo(`🚫 Token revoked for agent ${agentId}`);
            this.emit('token:revoked', { agentId, tokenId });
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to revoke token: ${error.message}`);
            throw error;
        }
    }
    async refreshToken(token, newTtl) {
        try {
            const payload = await this.verifyToken(token);
            await this.revokeToken(token);
            const newToken = await this.generateSessionToken(payload.agentId, {
                tokenBudget: payload.tokenBudget,
                capabilities: payload.capabilities,
                ttl: newTtl || this.DEFAULT_TTL,
                maxRequestsPerMinute: payload.maxRequestsPerMinute,
                allowedModels: payload.allowedModels,
                maxTokensPerRequest: payload.maxTokensPerRequest
            });
            cli_ui_1.CliUI.logInfo(`🔄 Token refreshed for agent ${payload.agentId}`);
            this.emit('token:refreshed', { agentId: payload.agentId });
            return newToken;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to refresh token: ${error.message}`);
            throw error;
        }
    }
    updateTokenUsage(tokenId, requestCount, tokenUsage) {
        const tokenInfo = this.activeTokens.get(tokenId);
        if (tokenInfo && !tokenInfo.revoked) {
            tokenInfo.usageStats.requestCount += requestCount;
            tokenInfo.usageStats.tokenUsage += tokenUsage;
            tokenInfo.usageStats.lastUsed = new Date();
            this.activeTokens.set(tokenId, tokenInfo);
            this.emit('token:usage_updated', {
                tokenId,
                agentId: tokenInfo.agentId,
                usage: tokenInfo.usageStats
            });
        }
    }
    getAgentTokens(agentId) {
        return Array.from(this.activeTokens.values())
            .filter(token => token.agentId === agentId && !token.revoked);
    }
    getAllActiveTokens() {
        return Array.from(this.activeTokens.values())
            .filter(token => !token.revoked);
    }
    getTokenStatistics() {
        const activeTokens = this.getAllActiveTokens();
        const totalTokens = this.activeTokens.size;
        const revokedCount = this.revokedTokens.size;
        const totalRequests = activeTokens.reduce((sum, token) => sum + token.usageStats.requestCount, 0);
        const totalTokenUsage = activeTokens.reduce((sum, token) => sum + token.usageStats.tokenUsage, 0);
        return {
            totalTokens,
            activeTokens: activeTokens.length,
            revokedTokens: revokedCount,
            totalRequests,
            totalTokenUsage,
            averageTokensPerRequest: totalRequests > 0 ? totalTokenUsage / totalRequests : 0,
            oldestToken: activeTokens.length > 0
                ? Math.min(...activeTokens.map(t => t.issuedAt.getTime()))
                : null,
            newestToken: activeTokens.length > 0
                ? Math.max(...activeTokens.map(t => t.issuedAt.getTime()))
                : null
        };
    }
    cleanupExpiredTokens() {
        const now = new Date();
        let cleanedCount = 0;
        for (const [tokenId, tokenInfo] of this.activeTokens.entries()) {
            if (tokenInfo.expiresAt < now || tokenInfo.revoked) {
                this.activeTokens.delete(tokenId);
                this.revokedTokens.delete(tokenId);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            cli_ui_1.CliUI.logDebug(`🧹 Cleaned up ${cleanedCount} expired tokens`);
            this.emit('tokens:cleanup', { cleanedCount });
        }
    }
    generateSecretKey() {
        const secret = crypto_1.default.randomBytes(64).toString('hex');
        cli_ui_1.CliUI.logWarning('⚠️ Using generated JWT secret. Set NIKCLI_JWT_SECRET environment variable for production');
        return secret;
    }
    setupTokenCleanup() {
        setInterval(() => {
            this.cleanupExpiredTokens();
        }, this.TOKEN_CLEANUP_INTERVAL);
        cli_ui_1.CliUI.logDebug(`🔧 Token cleanup scheduled every ${this.TOKEN_CLEANUP_INTERVAL / 1000}s`);
    }
}
exports.TokenManager = TokenManager;
