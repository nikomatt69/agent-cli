import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { nanoid } from 'nanoid';
import chalk from 'chalk';

export interface AgentState {
  id: string;
  name: string;
  status: 'created' | 'running' | 'paused' | 'stopped' | 'error';
  runId: string;
  currentStep: number;
  totalSteps: number;
  startTime: Date;
  lastActivity: Date;
  memory: any[];
  artifacts: string[];
  error?: string;
  metrics: {
    stepsCompleted: number;
    tokensUsed: number;
    cost: number;
    executionTime: number;
  };
}

export interface AgentConfig {
  name: string;
  profile: string;
  specialization: string;
  systemPrompt: string;
  capabilities: string[];
  requiredTools: string[];
  personality: {
    proactive: number;
    collaborative: number;
    analytical: number;
    creative: number;
  };
  autonomyLevel: 'supervised' | 'semi-autonomous' | 'fully-autonomous';
  contextScope: 'file' | 'directory' | 'project' | 'workspace';
  workingStyle: 'sequential' | 'parallel' | 'adaptive';
  autoMode: {
    enabled: boolean;
    maxSteps?: number;
    maxTokens?: number;
    maxCost?: number;
    timeLimit?: string;
    safeToolsOnly?: boolean;
    allowWrite?: boolean;
  };
  resources?: {
    memory?: string;
    cpu?: string;
    disk?: string;
  };
  environment?: Record<string, string>;
}

export interface AgentLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: any;
}

export class AgentPersistence {
  private baseDir: string;
  private agentsDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(os.homedir(), '.agent-cli');
    this.agentsDir = path.join(this.baseDir, 'agents');
  }

  /**
   * Inizializza la directory di persistenza
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.mkdir(this.agentsDir, { recursive: true });
  }

  /**
   * Crea la directory per un agente specifico
   */
  private getAgentDir(agentName: string): string {
    return path.join(this.agentsDir, agentName);
  }

  /**
   * Crea la directory per una specifica esecuzione
   */
  private getRunDir(agentName: string, runId: string): string {
    return path.join(this.getAgentDir(agentName), runId);
  }

  /**
   * Salva la configurazione di un agente
   */
  async saveAgentConfig(agentName: string, config: AgentConfig): Promise<void> {
    const agentDir = this.getAgentDir(agentName);
    await fs.mkdir(agentDir, { recursive: true });
    
    const configPath = path.join(agentDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Carica la configurazione di un agente
   */
  async loadAgentConfig(agentName: string): Promise<AgentConfig | null> {
    try {
      const configPath = path.join(this.getAgentDir(agentName), 'config.json');
      const data = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  /**
   * Salva lo stato di un agente
   */
  async saveAgentState(agentName: string, runId: string, state: AgentState): Promise<void> {
    const runDir = this.getRunDir(agentName, runId);
    await fs.mkdir(runDir, { recursive: true });
    
    const statePath = path.join(runDir, 'state.json');
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * Carica lo stato di un agente
   */
  async loadAgentState(agentName: string, runId: string): Promise<AgentState | null> {
    try {
      const statePath = path.join(this.getRunDir(agentName, runId), 'state.json');
      const data = await fs.readFile(statePath, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  /**
   * Salva un log entry
   */
  async appendLog(agentName: string, runId: string, entry: AgentLogEntry): Promise<void> {
    const runDir = this.getRunDir(agentName, runId);
    await fs.mkdir(runDir, { recursive: true });
    
    const logPath = path.join(runDir, 'logs.ndjson');
    const logLine = JSON.stringify(entry) + '\n';
    await fs.appendFile(logPath, logLine);
  }

  /**
   * Carica i log di un agente
   */
  async loadLogs(agentName: string, runId: string): Promise<AgentLogEntry[]> {
    try {
      const logPath = path.join(this.getRunDir(agentName, runId), 'logs.ndjson');
      const data = await fs.readFile(logPath, 'utf-8');
      return data.trim().split('\n').map(line => JSON.parse(line));
    } catch (error: any) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  /**
   * Salva la memoria di un agente
   */
  async saveMemory(agentName: string, runId: string, memory: any[]): Promise<void> {
    const runDir = this.getRunDir(agentName, runId);
    await fs.mkdir(runDir, { recursive: true });
    
    const memoryPath = path.join(runDir, 'memory.jsonl');
    const memoryLines = memory.map(item => JSON.stringify(item)).join('\n');
    await fs.writeFile(memoryPath, memoryLines + '\n');
  }

  /**
   * Carica la memoria di un agente
   */
  async loadMemory(agentName: string, runId: string): Promise<any[]> {
    try {
      const memoryPath = path.join(this.getRunDir(agentName, runId), 'memory.jsonl');
      const data = await fs.readFile(memoryPath, 'utf-8');
      return data.trim().split('\n').map(line => JSON.parse(line));
    } catch (error: any) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  /**
   * Lista tutti gli agenti
   */
  async listAgents(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.agentsDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error: any) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  /**
   * Lista tutte le esecuzioni di un agente
   */
  async listRuns(agentName: string): Promise<string[]> {
    try {
      const agentDir = this.getAgentDir(agentName);
      const entries = await fs.readdir(agentDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error: any) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  /**
   * Ottieni l'ultima esecuzione di un agente
   */
  async getLatestRun(agentName: string): Promise<string | null> {
    const runs = await this.listRuns(agentName);
    if (runs.length === 0) return null;
    
    // Ordina per timestamp (assumendo che i runId contengano timestamp)
    runs.sort().reverse();
    return runs[0];
  }

  /**
   * Elimina un agente e tutti i suoi dati
   */
  async deleteAgent(agentName: string): Promise<void> {
    const agentDir = this.getAgentDir(agentName);
    await fs.rm(agentDir, { recursive: true, force: true });
  }

  /**
   * Elimina una specifica esecuzione
   */
  async deleteRun(agentName: string, runId: string): Promise<void> {
    const runDir = this.getRunDir(agentName, runId);
    await fs.rm(runDir, { recursive: true, force: true });
  }

  /**
   * Crea un nuovo runId
   */
  createRunId(): string {
    return `${Date.now()}-${nanoid(8)}`;
  }

  /**
   * Verifica se un agente esiste
   */
  async agentExists(agentName: string): Promise<boolean> {
    try {
      const configPath = path.join(this.getAgentDir(agentName), 'config.json');
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ottieni informazioni complete su un agente
   */
  async getAgentInfo(agentName: string): Promise<{
    config: AgentConfig | null;
    runs: string[];
    latestRun: string | null;
    latestState: AgentState | null;
  }> {
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

// Esporta un'istanza singleton
export const agentPersistence = new AgentPersistence();