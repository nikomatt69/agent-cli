"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIKeyProxy = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const events_1 = require("events");
const crypto_1 = __importDefault(require("crypto"));
const advanced_ai_provider_1 = require("../../ai/advanced-ai-provider");
const token_manager_1 = require("./token-manager");
const cli_ui_1 = require("../../utils/cli-ui");
class APIKeyProxy extends events_1.EventEmitter {
    constructor() {
        super();
        this.app = (0, express_1.default)();
        this.server = null;
        this.port = 0;
        this.activeAgents = new Map();
        this.requestAuditLog = [];
        this.MAX_REQUESTS_PER_MINUTE = 30;
        this.MAX_TOKENS_PER_REQUEST = 4000;
        this.AUDIT_LOG_MAX_SIZE = 10000;
        this.proxySecret = process.env.NIKCLI_PROXY_SECRET || crypto_1.default.randomBytes(32).toString('hex');
        this.tokenManager = token_manager_1.TokenManager.getInstance();
        this.setupExpressApp();
        this.setupSecurityMiddleware();
        this.setupRoutes();
    }
    static getInstance() {
        if (!APIKeyProxy.instance) {
            APIKeyProxy.instance = new APIKeyProxy();
        }
        return APIKeyProxy.instance;
    }
    async start(port = 0) {
        return new Promise((resolve, reject) => {
            this.server = (0, http_1.createServer)(this.app);
            this.server.listen(port, '127.0.0.1', () => {
                const address = this.server.address();
                this.port = typeof address === 'object' && address ? address.port : port;
                cli_ui_1.CliUI.logSuccess(`🔐 API Key Proxy started on localhost:${this.port}`);
                this.emit('proxy:started', { port: this.port });
                resolve(this.port);
            });
            this.server.on('error', (error) => {
                cli_ui_1.CliUI.logError(`❌ Proxy server error: ${error.message}`);
                reject(error);
            });
        });
    }
    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    cli_ui_1.CliUI.logInfo('🛑 API Key Proxy stopped');
                    this.emit('proxy:stopped');
                    resolve();
                });
            });
        }
    }
    async registerAgent(agentId, sessionToken) {
        try {
            const tokenData = await this.tokenManager.verifyToken(sessionToken);
            if (tokenData.agentId !== agentId) {
                throw new Error('Token agent ID mismatch');
            }
            const session = {
                agentId,
                sessionToken,
                registeredAt: new Date(),
                tokenBudget: tokenData.tokenBudget,
                tokenUsed: 0,
                requestCount: 0,
                lastActivity: new Date(),
                capabilities: tokenData.capabilities || []
            };
            this.activeAgents.set(agentId, session);
            cli_ui_1.CliUI.logSuccess(`✅ Agent ${agentId} registered with proxy`);
            this.emit('agent:registered', { agentId, session });
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to register agent ${agentId}: ${error.message}`);
            throw error;
        }
    }
    async unregisterAgent(agentId) {
        const session = this.activeAgents.get(agentId);
        if (session) {
            this.activeAgents.delete(agentId);
            cli_ui_1.CliUI.logInfo(`🔓 Agent ${agentId} unregistered from proxy`);
            this.emit('agent:unregistered', { agentId, session });
        }
    }
    async makeAIRequest(request) {
        try {
            const session = await this.validateSession(request.agentId, request.sessionToken);
            if (session.tokenUsed + this.MAX_TOKENS_PER_REQUEST > session.tokenBudget) {
                throw new Error('Token budget exceeded');
            }
            const aiResponse = await advanced_ai_provider_1.advancedAIProvider.executeAutonomousTask(request.prompt, {
                model: request.model || 'claude-4-sonnet-20250514',
                temperature: request.temperature || 0.7,
                maxTokens: Math.min(request.maxTokens || 2000, this.MAX_TOKENS_PER_REQUEST),
                context: request.context
            });
            let content = '';
            let tokenUsage = 1000;
            try {
                for await (const chunk of aiResponse) {
                    if (typeof chunk === 'object' && chunk && 'type' in chunk && chunk.type === 'text_delta') {
                        content += chunk.delta || '';
                    }
                    else if (typeof chunk === 'object' && chunk && 'usage' in chunk) {
                        tokenUsage = chunk.usage?.totalTokens || tokenUsage;
                    }
                    else if (typeof chunk === 'string') {
                        content += chunk;
                    }
                }
            }
            catch (streamError) {
                content = typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse);
            }
            session.tokenUsed += tokenUsage;
            session.requestCount++;
            session.lastActivity = new Date();
            this.logRequest({
                agentId: request.agentId,
                timestamp: new Date(),
                prompt: request.prompt.slice(0, 100) + '...',
                tokenUsage,
                success: true,
                model: request.model || 'claude-3-5-sonnet-20241022'
            });
            cli_ui_1.CliUI.logDebug(`🤖 AI request completed for ${request.agentId}: ${tokenUsage} tokens`);
            return {
                result: content,
                tokenUsage,
                model: request.model || 'claude-3-5-sonnet-20241022',
                success: true
            };
        }
        catch (error) {
            this.logRequest({
                agentId: request.agentId,
                timestamp: new Date(),
                prompt: request.prompt.slice(0, 100) + '...',
                tokenUsage: 0,
                success: false,
                error: error.message,
                model: request.model || 'claude-3-5-sonnet-20241022'
            });
            cli_ui_1.CliUI.logError(`❌ AI request failed for ${request.agentId}: ${error.message}`);
            throw error;
        }
    }
    async *makeStreamingAIRequest(request) {
        try {
            const session = await this.validateSession(request.agentId, request.sessionToken);
            if (session.tokenUsed + this.MAX_TOKENS_PER_REQUEST > session.tokenBudget) {
                throw new Error('Token budget exceeded');
            }
            cli_ui_1.CliUI.logDebug(`🌊 Starting streaming AI request for ${request.agentId}`);
            let totalTokenUsage = 0;
            let accumulatedContent = '';
            try {
                for await (const streamEvent of advanced_ai_provider_1.advancedAIProvider.executeAutonomousTask(request.prompt, {
                    model: request.model || 'claude-4-sonnet-20250514',
                    temperature: request.temperature || 0.7,
                    maxTokens: Math.min(request.maxTokens || 2000, this.MAX_TOKENS_PER_REQUEST),
                    context: request.context
                })) {
                    cli_ui_1.CliUI.logDebug(`📦 Stream event: ${streamEvent.type} - ${streamEvent.content?.slice(0, 50) || 'no content'}`);
                    switch (streamEvent.type) {
                        case 'text_delta':
                            if (streamEvent.content) {
                                accumulatedContent += streamEvent.content;
                                yield {
                                    type: 'content',
                                    content: streamEvent.content,
                                    accumulated: accumulatedContent,
                                    agentId: request.agentId
                                };
                            }
                            break;
                        case 'start':
                        case 'thinking':
                            if (streamEvent.content) {
                                yield {
                                    type: 'content',
                                    content: `${streamEvent.content}\n`,
                                    accumulated: accumulatedContent,
                                    agentId: request.agentId
                                };
                            }
                            break;
                        case 'tool_call':
                            if (streamEvent.toolName && streamEvent.content) {
                                const toolMessage = `🔧 Using ${streamEvent.toolName}: ${streamEvent.content}\n`;
                                yield {
                                    type: 'content',
                                    content: toolMessage,
                                    accumulated: accumulatedContent,
                                    agentId: request.agentId
                                };
                            }
                            break;
                        case 'tool_result':
                            if (streamEvent.content) {
                                const resultMessage = `📋 Result: ${streamEvent.content}\n`;
                                yield {
                                    type: 'content',
                                    content: resultMessage,
                                    accumulated: accumulatedContent,
                                    agentId: request.agentId
                                };
                            }
                            break;
                        case 'complete':
                            totalTokenUsage = Math.max(100, Math.floor(accumulatedContent.length / 4));
                            yield {
                                type: 'usage',
                                content: '',
                                accumulated: accumulatedContent,
                                agentId: request.agentId,
                                tokenUsage: totalTokenUsage
                            };
                            break;
                        case 'error':
                            throw new Error(streamEvent.error || 'Unknown streaming error');
                    }
                }
            }
            catch (streamError) {
                cli_ui_1.CliUI.logError(`❌ Advanced AI provider streaming error: ${streamError.message}`);
                throw streamError;
            }
            if (totalTokenUsage === 0) {
                totalTokenUsage = Math.max(100, Math.floor(accumulatedContent.length / 4));
            }
            session.tokenUsed += totalTokenUsage;
            session.requestCount++;
            session.lastActivity = new Date();
            this.logRequest({
                agentId: request.agentId,
                timestamp: new Date(),
                prompt: request.prompt.slice(0, 100) + '...',
                tokenUsage: totalTokenUsage,
                success: true,
                model: request.model || 'claude-3-5-sonnet-20241022'
            });
            yield {
                type: 'complete',
                content: '',
                accumulated: accumulatedContent,
                agentId: request.agentId,
                tokenUsage: totalTokenUsage,
                success: true
            };
            cli_ui_1.CliUI.logDebug(`🌊 Streaming AI request completed for ${request.agentId}: ${totalTokenUsage} tokens`);
        }
        catch (error) {
            this.logRequest({
                agentId: request.agentId,
                timestamp: new Date(),
                prompt: request.prompt.slice(0, 100) + '...',
                tokenUsage: 0,
                success: false,
                error: error.message,
                model: request.model || 'claude-3-5-sonnet-20241022'
            });
            yield {
                type: 'error',
                content: '',
                accumulated: '',
                agentId: request.agentId,
                error: error.message
            };
            cli_ui_1.CliUI.logError(`❌ Streaming AI request failed for ${request.agentId}: ${error.message}`);
            throw error;
        }
    }
    async getEndpoint() {
        if (!this.server) {
            await this.start();
        }
        return `http://127.0.0.1:${this.port}`;
    }
    getActiveSessions() {
        return Array.from(this.activeAgents.values());
    }
    getAuditLog(limit = 100) {
        return this.requestAuditLog.slice(-limit);
    }
    setupExpressApp() {
        this.app = (0, express_1.default)();
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true }));
        this.app.use((0, cors_1.default)({
            origin: ['http://127.0.0.1', 'http://localhost'],
            credentials: true
        }));
    }
    setupSecurityMiddleware() {
        this.app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:"],
                    connectSrc: ["'self'"],
                },
            },
        }));
        const limiter = (0, express_rate_limit_1.default)({
            windowMs: 60 * 1000,
            max: this.MAX_REQUESTS_PER_MINUTE,
            message: 'Too many requests from this IP',
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.app.use('/api/', limiter);
        this.app.use('/api/', this.authenticateRequest.bind(this));
    }
    setupRoutes() {
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                activeAgents: this.activeAgents.size,
                uptime: process.uptime()
            });
        });
        this.app.post('/api/ai/request', this.handleAIRequest.bind(this));
        this.app.post('/api/ai/stream', this.handleStreamingAIRequest.bind(this));
        this.app.get('/api/agent/:agentId/status', this.handleAgentStatus.bind(this));
        this.app.get('/api/usage/stats', this.handleUsageStats.bind(this));
        this.app.use(this.errorHandler.bind(this));
    }
    async authenticateRequest(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({ error: 'Missing or invalid authorization header' });
                return;
            }
            const token = authHeader.slice(7);
            const tokenData = await this.tokenManager.verifyToken(token);
            req.agentId = tokenData.agentId;
            req.tokenData = tokenData;
            next();
        }
        catch (error) {
            res.status(401).json({ error: 'Invalid token' });
        }
    }
    async handleAIRequest(req, res) {
        try {
            const { prompt, model, temperature, maxTokens, context } = req.body;
            const agentId = req.agentId;
            const sessionToken = req.headers.authorization?.slice(7);
            if (!prompt) {
                res.status(400).json({ error: 'Missing prompt' });
                return;
            }
            const response = await this.makeAIRequest({
                agentId,
                sessionToken: sessionToken,
                prompt,
                model,
                temperature,
                maxTokens,
                context
            });
            res.json(response);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async handleStreamingAIRequest(req, res) {
        try {
            const { prompt, model, temperature, maxTokens, context } = req.body;
            const agentId = req.agentId;
            const sessionToken = req.headers.authorization?.slice(7);
            if (!prompt) {
                res.status(400).json({ error: 'Missing prompt' });
                return;
            }
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Transfer-Encoding', 'chunked');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            try {
                for await (const chunk of this.makeStreamingAIRequest({
                    agentId,
                    sessionToken: sessionToken,
                    prompt,
                    model,
                    temperature,
                    maxTokens,
                    context
                })) {
                    const chunkLine = JSON.stringify(chunk) + '\n';
                    res.write(chunkLine);
                    if (res.flush) {
                        res.flush();
                    }
                }
                res.end();
            }
            catch (streamError) {
                const errorChunk = JSON.stringify({
                    type: 'error',
                    error: streamError.message,
                    agentId
                }) + '\n';
                res.write(errorChunk);
                res.end();
            }
        }
        catch (error) {
            if (!res.headersSent) {
                res.status(500).json({ error: error.message });
            }
        }
    }
    async handleAgentStatus(req, res) {
        const agentId = req.params.agentId;
        const session = this.activeAgents.get(agentId);
        if (!session) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }
        res.json({
            agentId: session.agentId,
            tokenUsage: {
                used: session.tokenUsed,
                budget: session.tokenBudget,
                remaining: session.tokenBudget - session.tokenUsed
            },
            requestCount: session.requestCount,
            lastActivity: session.lastActivity,
            capabilities: session.capabilities
        });
    }
    async getSecurityStats() {
        return {
            isActive: this.server !== null,
            registeredAgents: this.activeAgents.size,
            activeSessions: this.activeAgents.size,
            totalRequests: this.requestAuditLog.length,
            securityViolations: this.requestAuditLog.filter(log => !log.success).length,
            uptime: this.server ? process.uptime() : 0
        };
    }
    async handleUsageStats(req, res) {
        const stats = {
            totalAgents: this.activeAgents.size,
            totalRequests: this.requestAuditLog.length,
            totalTokens: Array.from(this.activeAgents.values()).reduce((sum, session) => sum + session.tokenUsed, 0),
            averageTokensPerRequest: this.requestAuditLog.length > 0
                ? this.requestAuditLog.reduce((sum, log) => sum + log.tokenUsage, 0) / this.requestAuditLog.length
                : 0,
            recentRequests: this.requestAuditLog.slice(-10)
        };
        res.json(stats);
    }
    async validateSession(agentId, sessionToken) {
        const session = this.activeAgents.get(agentId);
        if (!session) {
            throw new Error('Agent not registered');
        }
        if (session.sessionToken !== sessionToken) {
            throw new Error('Invalid session token');
        }
        await this.tokenManager.verifyToken(sessionToken);
        return session;
    }
    logRequest(audit) {
        this.requestAuditLog.push(audit);
        if (this.requestAuditLog.length > this.AUDIT_LOG_MAX_SIZE) {
            this.requestAuditLog = this.requestAuditLog.slice(-this.AUDIT_LOG_MAX_SIZE / 2);
        }
        this.emit('request:logged', audit);
    }
    errorHandler(error, req, res, next) {
        cli_ui_1.CliUI.logError(`❌ Proxy error: ${error.message}`);
        res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
exports.APIKeyProxy = APIKeyProxy;
