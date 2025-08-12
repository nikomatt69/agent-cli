import { ConfigManager, simpleConfigManager } from './config-manager';
import { spawn, ChildProcess } from 'child_process';
import https from 'https';
import http from 'http';
import { promisify } from 'util';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import { wrapBlue, formatStatus } from '../ui/terminal-ui';
import { completionCache } from './completion-protocol-cache';

export interface McpServerConfig {
  name: string;
  type: 'http' | 'websocket' | 'command' | 'stdio';
  endpoint?: string; // For HTTP/WebSocket
  command?: string; // For command-based servers
  args?: string[]; // Command arguments
  headers?: Record<string, string>; // HTTP headers
  timeout?: number; // Request timeout in ms
  retries?: number; // Max retries
  healthCheck?: string; // Health check endpoint
  enabled: boolean;
  priority?: number; // Higher priority servers are preferred
  capabilities?: string[]; // What this server can do
  authentication?: {
    type: 'bearer' | 'basic' | 'api_key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    header?: string; // For API key header name
  };
}

export interface McpRequest {
  method: string;
  params?: any;
  id?: string;
  serverName?: string;
}

export interface McpResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id?: string;
  fromCache?: boolean;
  serverName?: string;
  executionTime?: number;
}

/**
 * Enhanced MCP Client with connection pooling, caching, and robust error handling
 */
export class McpClient extends EventEmitter {
  private configManager = simpleConfigManager;
  private connections: Map<string, ChildProcess | any> = new Map();
  private connectionPools: Map<string, any[]> = new Map();
  private healthStatus: Map<string, boolean> = new Map();
  private requestQueue: Map<string, McpRequest[]> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  private lastHealthCheck: Map<string, number> = new Map();
  
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly DEFAULT_RETRIES = 3;
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  private readonly MAX_POOL_SIZE = 5;

  constructor() {
    super();
    this.startHealthChecker();
  }

  /**
   * Get configured MCP servers
   */
  getConfiguredServers(): McpServerConfig[] {
    const config = this.configManager.get('mcpServers') as Record<string, McpServerConfig> || {};
    return Object.values(config).filter(server => server.enabled);
  }

  /**
   * Call the specified MCP server with caching and error handling
   */
  async call(serverName: string, request: McpRequest): Promise<McpResponse> {
    const startTime = Date.now();
    
    try {
      // Check cache first for GET-like operations
      if (this.isCacheable(request)) {
        const cacheKey = this.generateCacheKey(serverName, request);
        const cachedResponse = await completionCache.getCompletion({
          prefix: cacheKey,
          context: JSON.stringify(request.params || {}),
          maxTokens: 1000,
          temperature: 0,
          model: 'mcp-cache'
        });

        if (cachedResponse) {
          console.log(chalk.green(`🎯 MCP Cache Hit: ${serverName}`));
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
        await completionCache.storeCompletion({
          prefix: cacheKey,
          context: JSON.stringify(request.params || {}),
          maxTokens: 1000,
          temperature: 0,
          model: 'mcp-cache'
        }, JSON.stringify(response.result));
      }

      console.log(chalk.blue(`🔮 MCP Call: ${serverName} (${Date.now() - startTime}ms)`));
      
      return {
        ...response,
        serverName,
        executionTime: Date.now() - startTime
      };

    } catch (error: any) {
      console.log(chalk.red(`❌ MCP Error: ${serverName} - ${error.message}`));
      
      // Attempt retry logic
      const retryCount = this.retryAttempts.get(serverName) || 0;
      const server = await this.getServerConfig(serverName);
      const maxRetries = server?.retries || this.DEFAULT_RETRIES;

      if (retryCount < maxRetries) {
        this.retryAttempts.set(serverName, retryCount + 1);
        console.log(chalk.yellow(`🔄 Retrying MCP call to ${serverName} (${retryCount + 1}/${maxRetries})`));
        
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
  private async executeRequest(server: McpServerConfig, request: McpRequest): Promise<McpResponse> {
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
  private async executeHttpRequest(server: McpServerConfig, request: McpRequest): Promise<McpResponse> {
    if (!server.endpoint) {
      throw new Error('HTTP server requires endpoint configuration');
    }

    const url = new URL(server.endpoint);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    // Prepare request payload
    const payload = {
      jsonrpc: '2.0',
      id: request.id || Date.now().toString(),
      method: request.method,
      params: request.params
    };

    // Prepare headers
    const headers: Record<string, string> = {
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
            } else {
              resolve({ result: response.result, id: response.id });
            }
          } catch (error) {
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
  private async executeWebSocketRequest(server: McpServerConfig, request: McpRequest): Promise<McpResponse> {
    // WebSocket implementation would go here
    // For now, throw not implemented error
    throw new Error('WebSocket MCP servers not yet implemented');
  }

  /**
   * Execute command-based MCP request
   */
  private async executeCommandRequest(server: McpServerConfig, request: McpRequest): Promise<McpResponse> {
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
      const process = spawn(server.command!, server.args || [], {
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
            } else {
              resolve({ result: response.result, id: response.id });
            }
          } catch (error) {
            reject(new Error('Invalid JSON response from MCP command'));
          }
        } else {
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
  private addAuthHeaders(headers: Record<string, string>, auth: McpServerConfig['authentication']) {
    if (!auth) return;

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
  private isCacheable(request: McpRequest): boolean {
    // Cache read-only operations
    const cacheableMethods = [
      'list', 'get', 'read', 'search', 'query', 'find',
      'describe', 'status', 'info', 'help'
    ];
    
    return cacheableMethods.some(method => 
      request.method.toLowerCase().includes(method)
    );
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(serverName: string, request: McpRequest): string {
    return `mcp:${serverName}:${request.method}:${JSON.stringify(request.params || {})}`;
  }

  /**
   * Get server configuration
   */
  private async getServerConfig(serverName: string): Promise<McpServerConfig | null> {
    const servers = this.getConfiguredServers();
    return servers.find(server => server.name === serverName) || null;
  }

  /**
   * Check server health
   */
  async checkServerHealth(serverName: string): Promise<boolean> {
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
      const healthRequest: McpRequest = {
        method: 'ping',
        params: {},
        id: 'health_check'
      };

      await this.executeRequest(server, healthRequest);
      
      this.healthStatus.set(serverName, true);
      this.lastHealthCheck.set(serverName, now);
      return true;

    } catch (error) {
      this.healthStatus.set(serverName, false);
      this.lastHealthCheck.set(serverName, now);
      return false;
    }
  }

  /**
   * List available servers with status
   */
  async listServers(): Promise<Array<McpServerConfig & { healthy: boolean }>> {
    const servers = this.getConfiguredServers();
    const serverStatuses = await Promise.all(
      servers.map(async server => ({
        ...server,
        healthy: await this.checkServerHealth(server.name)
      }))
    );

    return serverStatuses;
  }

  /**
   * Test server connection
   */
  async testServer(serverName: string): Promise<{ success: boolean; error?: string; latency?: number }> {
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

    } catch (error: any) {
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
  private startHealthChecker(): void {
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
  async shutdown(): Promise<void> {
    // Close all active connections
    for (const [serverName, connection] of this.connections.entries()) {
      try {
        if (connection && typeof connection.kill === 'function') {
          connection.kill();
        }
      } catch (error) {
        console.log(chalk.yellow(`Warning: Could not close connection to ${serverName}`));
      }
    }
    
    this.connections.clear();
    this.connectionPools.clear();
    
    console.log(chalk.blue('🔮 MCP Client shut down'));
  }
}

// Export singleton instance
export const mcpClient = new McpClient();
