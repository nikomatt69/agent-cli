"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpClient = void 0;
const config_manager_1 = require("./config-manager");
const child_process_1 = require("child_process");
/**
 * McpClient delegates LLM requests to external MCP servers defined
 * in configuration under 'mcpServers'.
 */
class McpClient {
    constructor() {
        this.configManager = new config_manager_1.ConfigManager();
    }
    /** Call the specified MCP server with given payload. */
    async call(serverName, payload) {
        // TODO: Add mcpServers to config schema
        const cfg = await this.configManager.getAll();
        // const server = cfg.mcpServers?.[serverName];
        // For now, return a placeholder response
        console.warn(`MCP server ${serverName} not configured`);
        return { status: 'not_configured', message: 'MCP servers not yet implemented' };
    }
    execCommand(cmd, args, payload) {
        return new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)(cmd, args);
            let out = '';
            proc.stdin.write(JSON.stringify(payload));
            proc.stdin.end();
            proc.stdout.on('data', d => out += d.toString());
            proc.on('close', code => code === 0 ? resolve(out) : reject(new Error(`Exit ${code}`)));
        });
    }
    httpPost(server) {
        // Placeholder: implement real HTTP POST
        return Promise.reject(new Error('HTTP mode not implemented'));
    }
}
exports.McpClient = McpClient;
