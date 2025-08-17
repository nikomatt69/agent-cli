"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentPersistence = exports.AgentPersistence = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const nanoid_1 = require("nanoid");
class AgentPersistence {
    constructor(baseDir) {
        this.baseDir = baseDir || path_1.default.join(os_1.default.homedir(), '.agent-cli');
        this.agentsDir = path_1.default.join(this.baseDir, 'agents');
    }
    async initialize() {
        await fs_1.promises.mkdir(this.baseDir, { recursive: true });
        await fs_1.promises.mkdir(this.agentsDir, { recursive: true });
    }
    getAgentDir(agentName) {
        return path_1.default.join(this.agentsDir, agentName);
    }
    getRunDir(agentName, runId) {
        return path_1.default.join(this.getAgentDir(agentName), runId);
    }
    async saveAgentConfig(agentName, config) {
        const agentDir = this.getAgentDir(agentName);
        await fs_1.promises.mkdir(agentDir, { recursive: true });
        const configPath = path_1.default.join(agentDir, 'config.json');
        await fs_1.promises.writeFile(configPath, JSON.stringify(config, null, 2));
    }
    async loadAgentConfig(agentName) {
        try {
            const configPath = path_1.default.join(this.getAgentDir(agentName), 'config.json');
            const data = await fs_1.promises.readFile(configPath, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return null;
            throw error;
        }
    }
    async saveAgentState(agentName, runId, state) {
        const runDir = this.getRunDir(agentName, runId);
        await fs_1.promises.mkdir(runDir, { recursive: true });
        const statePath = path_1.default.join(runDir, 'state.json');
        await fs_1.promises.writeFile(statePath, JSON.stringify(state, null, 2));
    }
    async loadAgentState(agentName, runId) {
        try {
            const statePath = path_1.default.join(this.getRunDir(agentName, runId), 'state.json');
            const data = await fs_1.promises.readFile(statePath, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return null;
            throw error;
        }
    }
    async appendLog(agentName, runId, entry) {
        const runDir = this.getRunDir(agentName, runId);
        await fs_1.promises.mkdir(runDir, { recursive: true });
        const logPath = path_1.default.join(runDir, 'logs.ndjson');
        const logLine = JSON.stringify(entry) + '\n';
        await fs_1.promises.appendFile(logPath, logLine);
    }
    async loadLogs(agentName, runId) {
        try {
            const logPath = path_1.default.join(this.getRunDir(agentName, runId), 'logs.ndjson');
            const data = await fs_1.promises.readFile(logPath, 'utf-8');
            return data.trim().split('\n').map(line => JSON.parse(line));
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return [];
            throw error;
        }
    }
    async saveMemory(agentName, runId, memory) {
        const runDir = this.getRunDir(agentName, runId);
        await fs_1.promises.mkdir(runDir, { recursive: true });
        const memoryPath = path_1.default.join(runDir, 'memory.jsonl');
        const memoryLines = memory.map(item => JSON.stringify(item)).join('\n');
        await fs_1.promises.writeFile(memoryPath, memoryLines + '\n');
    }
    async loadMemory(agentName, runId) {
        try {
            const memoryPath = path_1.default.join(this.getRunDir(agentName, runId), 'memory.jsonl');
            const data = await fs_1.promises.readFile(memoryPath, 'utf-8');
            return data.trim().split('\n').map(line => JSON.parse(line));
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return [];
            throw error;
        }
    }
    async listAgents() {
        try {
            const entries = await fs_1.promises.readdir(this.agentsDir, { withFileTypes: true });
            return entries
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name);
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return [];
            throw error;
        }
    }
    async listRuns(agentName) {
        try {
            const agentDir = this.getAgentDir(agentName);
            const entries = await fs_1.promises.readdir(agentDir, { withFileTypes: true });
            return entries
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name);
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return [];
            throw error;
        }
    }
    async getLatestRun(agentName) {
        const runs = await this.listRuns(agentName);
        if (runs.length === 0)
            return null;
        runs.sort().reverse();
        return runs[0];
    }
    async deleteAgent(agentName) {
        const agentDir = this.getAgentDir(agentName);
        await fs_1.promises.rm(agentDir, { recursive: true, force: true });
    }
    async deleteRun(agentName, runId) {
        const runDir = this.getRunDir(agentName, runId);
        await fs_1.promises.rm(runDir, { recursive: true, force: true });
    }
    createRunId() {
        return `${Date.now()}-${(0, nanoid_1.nanoid)(8)}`;
    }
    async agentExists(agentName) {
        try {
            const configPath = path_1.default.join(this.getAgentDir(agentName), 'config.json');
            await fs_1.promises.access(configPath);
            return true;
        }
        catch {
            return false;
        }
    }
    async getAgentInfo(agentName) {
        const config = await this.loadAgentConfig(agentName);
        const runs = await this.listRuns(agentName);
        const latestRun = await this.getLatestRun(agentName);
        const latestState = latestRun ? await this.loadAgentState(agentName, latestRun) : null;
        return {
            config,
            runs,
            latestRun,
            latestState
        };
    }
}
exports.AgentPersistence = AgentPersistence;
exports.agentPersistence = new AgentPersistence();
