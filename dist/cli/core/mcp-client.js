"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpClient = exports.McpClient = void 0;
const config_manager_1 = require("./config-manager");
const child_process_1 = require("child_process");
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const chalk_1 = __importDefault(require("chalk"));
const events_1 = require("events");
const completion_protocol_cache_1 = require("./completion-protocol-cache");
/**
 * Enhanced MCP Client with connection pooling, caching, and robust error handling
 */
class McpClient extends events_1.EventEmitter {
    constructor() {
        super();
        this.configManager = config_manager_1.simpleConfigManager;
        this.connections = new Map();
        this.connectionPools = new Map();
        this.healthStatus = new Map();
        this.requestQueue = new Map();
        this.retryAttempts = new Map();
        this.lastHealthCheck = new Map();
        this.DEFAULT_TIMEOUT = 30000; // 30 seconds
        this.DEFAULT_RETRIES = 3;
        this.HEALTH_CHECK_INTERVAL = 60000; // 1 minute
        this.MAX_POOL_SIZE = 5;
        this.startHealthChecker();
    }
    /**
     * Get configured MCP servers
     */
    getConfiguredServers() {
        const config = this.configManager.get('mcpServers') || {};
        return Object.values(config).filter(server => server.enabled);
    }
    /**
     * Call the specified MCP server with caching and error handling
     */
    async call(serverName, request) {
        const startTime = Date.now();
        try {
            // Check cache first for GET-like operations
            if (this.isCacheable(request)) {
                const cacheKey = this.generateCacheKey(serverName, request);
                const cachedResponse = await completion_protocol_cache_1.completionCache.getCompletion({
                    prefix: cacheKey,
                    context: JSON.stringify(request.params || {}),
                    maxTokens: 1000,
                    temperature: 0,
                    model: 'mcp-cache'
                });
                if (cachedResponse) {
                    console.log(chalk_1.default.green(`🎯 MCP Cache Hit: ${serverName}`));
                    return {
                        result: JSON.parse(cachedResponse.completion),
                        fromCache: true,
                        serverName,
                        executionTime: Date.now() - startTime
                    };
                }
            }
            // Get server configuration
            const server = await this.getServerConfig(serverName);
            if (!server) {
                throw new Error(`MCP server '${serverName}' not found or disabled`);
            }
            // Check server health
            if (!await this.checkServerHealth(serverName)) {
                throw new Error(`MCP server '${serverName}' is unhealthy`);
            }
            // Execute the request
            const response = await this.executeRequest(server, request);
            // Cache successful responses
            if (response.result && this.isCacheable(request)) {
                const cacheKey = this.generateCacheKey(serverName, request);
                await completion_protocol_cache_1.completionCache.storeCompletion({
                    prefix: cacheKey,
                    context: JSON.stringify(request.params || {}),
                    maxTokens: 1000,
                    temperature: 0,
                    model: 'mcp-cache'
                }, JSON.stringify(response.result));
            }
            console.log(chalk_1.default.blue(`🔮 MCP Call: ${serverName} (${Date.now() - startTime}ms)`));
            return {
                ...response,
                serverName,
                executionTime: Date.now() - startTime
            };
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ MCP Error: ${serverName} - ${error.message}`));
            // Attempt retry logic
            const retryCount = this.retryAttempts.get(serverName) || 0;
            const server = await this.getServerConfig(serverName);
            const maxRetries = server?.retries || this.DEFAULT_RETRIES;
            if (retryCount < maxRetries) {
                this.retryAttempts.set(serverName, retryCount + 1);
                console.log(chalk_1.default.yellow(`🔄 Retrying MCP call to ${serverName} (${retryCount + 1}/${maxRetries})`));
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                return this.call(serverName, request);
            }
            this.retryAttempts.delete(serverName);
            throw error;
        }
    }
    /**
     * Execute request based on server type
     */
    async executeRequest(server, request) {
        switch (server.type) {
            case 'http':
                return this.executeHttpRequest(server, request);
            case 'websocket':
                return this.executeWebSocketRequest(server, request);
            case 'command':
            case 'stdio':
                return this.executeCommandRequest(server, request);
            default:
                throw new Error(`Unsupported MCP server type: ${server.type}`);
        }
    }
    /**
     * Execute HTTP-based MCP request
     */
    async executeHttpRequest(server, request) {
        if (!server.endpoint) {
            throw new Error('HTTP server requires endpoint configuration');
        }
        const url = new URL(server.endpoint);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https_1.default : http_1.default;
        // Prepare request payload
        const payload = {
            jsonrpc: '2.0',
            id: request.id || Date.now().toString(),
            method: request.method,
            params: request.params
        };
        // Prepare headers
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'NikCLI-MCP-Client/1.0',
            ...server.headers
        };
        // Add authentication
        if (server.authentication) {
            this.addAuthHeaders(headers, server.authentication);
        }
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(payload);
            headers['Content-Length'] = Buffer.byteLength(postData).toString();
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers,
                timeout: server.timeout || this.DEFAULT_TIMEOUT
            };
            const req = httpModule.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.error) {
                            reject(new Error(`MCP Error: ${response.error.message}`));
                        }
                        else {
                            resolve({ result: response.result, id: response.id });
                        }
                    }
                    catch (error) {
                        reject(new Error('Invalid JSON response from MCP server'));
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('MCP request timeout'));
            });
            req.write(postData);
            req.end();
        });
    }
    /**
     * Execute WebSocket-based MCP request
     */
    async executeWebSocketRequest(server, request) {
        // WebSocket implementation would go here
        // For now, throw not implemented error
        throw new Error('WebSocket MCP servers not yet implemented');
    }
    /**
     * Execute command-based MCP request
     */
    async executeCommandRequest(server, request) {
        if (!server.command) {
            throw new Error('Command server requires command configuration');
        }
        const payload = {
            jsonrpc: '2.0',
            id: request.id || Date.now().toString(),
            method: request.method,
            params: request.params
        };
        return new Promise((resolve, reject) => {
            const process = (0, child_process_1.spawn)(server.command, server.args || [], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let stdout = '';
            let stderr = '';
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const response = JSON.parse(stdout);
                        if (response.error) {
                            reject(new Error(`MCP Command Error: ${response.error.message}`));
                        }
                        else {
                            resolve({ result: response.result, id: response.id });
                        }
                    }
                    catch (error) {
                        reject(new Error('Invalid JSON response from MCP command'));
                    }
                }
                else {
                    reject(new Error(`MCP command failed with code ${code}: ${stderr}`));
                }
            });
            process.on('error', reject);
            // Send request
            process.stdin.write(JSON.stringify(payload));
            process.stdin.end();
            // Timeout handling
            setTimeout(() => {
                if (!process.killed) {
                    process.kill();
                    reject(new Error('MCP command timeout'));
                }
            }, server.timeout || this.DEFAULT_TIMEOUT);
        });
    }
    /**
     * Add authentication headers
     */
    addAuthHeaders(headers, auth) {
        if (!auth)
            return;
        switch (auth.type) {
            case 'bearer':
                if (auth.token) {
                    headers['Authorization'] = `Bearer ${auth.token}`;
                }
                break;
            case 'basic':
                if (auth.username && auth.password) {
                    const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
                    headers['Authorization'] = `Basic ${credentials}`;
                }
                break;
            case 'api_key':
                if (auth.apiKey) {
                    const headerName = auth.header || 'X-API-Key';
                    headers[headerName] = auth.apiKey;
                }
                break;
        }
    }
    /**
     * Check if request is cacheable
     */
    isCacheable(request) {
        // Cache read-only operations
        const cacheableMethods = [
            'list', 'get', 'read', 'search', 'query', 'find',
            'describe', 'status', 'info', 'help'
        ];
        return cacheableMethods.some(method => request.method.toLowerCase().includes(method));
    }
    /**
     * Generate cache key for request
     */
    generateCacheKey(serverName, request) {
        return `mcp:${serverName}:${request.method}:${JSON.stringify(request.params || {})}`;
    }
    /**
     * Get server configuration
     */
    async getServerConfig(serverName) {
        const servers = this.getConfiguredServers();
        return servers.find(server => server.name === serverName) || null;
    }
    /**
     * Check server health
     */
    async checkServerHealth(serverName) {
        const now = Date.now();
        const lastCheck = this.lastHealthCheck.get(serverName) || 0;
        // Return cached health status if checked recently
        if (now - lastCheck < this.HEALTH_CHECK_INTERVAL) {
            return this.healthStatus.get(serverName) || false;
        }
        const server = await this.getServerConfig(serverName);
        if (!server) {
            this.healthStatus.set(serverName, false);
            return false;
        }
        try {
            // Try a simple health check request
            const healthRequest = {
                method: 'ping',
                params: {},
                id: 'health_check'
            };
            await this.executeRequest(server, healthRequest);
            this.healthStatus.set(serverName, true);
            this.lastHealthCheck.set(serverName, now);
            return true;
        }
        catch (error) {
            this.healthStatus.set(serverName, false);
            this.lastHealthCheck.set(serverName, now);
            return false;
        }
    }
    /**
     * List available servers with status
     */
    async listServers() {
        const servers = this.getConfiguredServers();
        const serverStatuses = await Promise.all(servers.map(async (server) => ({
            ...server,
            healthy: await this.checkServerHealth(server.name)
        })));
        return serverStatuses;
    }
    /**
     * Test server connection
     */
    async testServer(serverName) {
        const startTime = Date.now();
        try {
            const healthy = await this.checkServerHealth(serverName);
            if (!healthy) {
                return { success: false, error: 'Health check failed' };
            }
            return {
                success: true,
                latency: Date.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                latency: Date.now() - startTime
            };
        }
    }
    /**
     * Start background health checker
     */
    startHealthChecker() {
        setInterval(async () => {
            const servers = this.getConfiguredServers();
            for (const server of servers) {
                // Reset last check to force recheck
                this.lastHealthCheck.delete(server.name);
                await this.checkServerHealth(server.name);
            }
        }, this.HEALTH_CHECK_INTERVAL);
    }
    /**
     * Clean up connections on shutdown
     */
    async shutdown() {
        // Close all active connections
        for (const [serverName, connection] of this.connections.entries()) {
            try {
                if (connection && typeof connection.kill === 'function') {
                    connection.kill();
                }
            }
            catch (error) {
                console.log(chalk_1.default.yellow(`Warning: Could not close connection to ${serverName}`));
            }
        }
        this.connections.clear();
        this.connectionPools.clear();
        console.log(chalk_1.default.blue('🔮 MCP Client shut down'));
    }
}
exports.McpClient = McpClient;
// Export singleton instance
exports.mcpClient = new McpClient();
