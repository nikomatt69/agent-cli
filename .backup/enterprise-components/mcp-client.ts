import { ConfigManager } from '../config/config-manager';
import { spawn } from 'child_process';
import https from 'https';
import { promisify } from 'util';

/**
 * McpClient delegates LLM requests to external MCP servers defined
 * in configuration under 'mcpServers'.
 */
export class McpClient {
  private configManager = new ConfigManager();

  /** Call the specified MCP server with given payload. */
  async call(serverName: string, payload: any): Promise<any> {
    const cfg = await this.configManager.load();
    const server = cfg.mcpServers?.[serverName];
    if (!server) throw new Error(`MCP server not found: ${serverName}`);
    if (server.command) {
      // Executable mode
      return await this.execCommand(server.command, server.args, payload);
    } else {
      // HTTP mode (placeholder)
      return this.httpPost(server);
    }
  }

  private execCommand(cmd: string, args: string[], payload: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args);
      let out = '';
      proc.stdin.write(JSON.stringify(payload));
      proc.stdin.end();
      proc.stdout.on('data', d => out += d.toString());
      proc.on('close', code => code === 0 ? resolve(out) : reject(new Error(`Exit ${code}`)));
    });
  }

  private httpPost(server: any): Promise<any> {
    // Placeholder: implement real HTTP POST
    return Promise.reject(new Error('HTTP mode not implemented'));
  }
}
