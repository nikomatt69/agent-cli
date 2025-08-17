import { EventEmitter } from 'events';
import chalk from 'chalk';
import { agentPersistence, AgentState, AgentConfig } from '../../persistence/agent-persistence';
import { BaseAgent } from './base-agent';
import { secureTools } from '../../tools/secure-tools-registry';

export interface AutoModePolicy {
  maxSteps: number;
  maxTokens: number;
  maxCost: number;
  timeLimit: number; // in millisecondi
  safeToolsOnly: boolean;
  allowWrite: boolean;
  backoffMultiplier: number;
  maxRetries: number;
}

export interface AutoModeBudget {
  stepsUsed: number;
  tokensUsed: number;
  costUsed: number;
  startTime: Date;
  lastActivity: Date;
}

export interface AutoModeStep {
  stepNumber: number;
  type: 'perception' | 'reasoning' | 'action' | 'evaluation';
  description: string;
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
  tokensUsed?: number;
  cost?: number;
}

export class AutoRunner extends EventEmitter {
  private agent: BaseAgent;
  private config: AgentConfig;
  private policy: AutoModePolicy;
  private budget: AutoModeBudget;
  private steps: AutoModeStep[] = [];
  private isRunning: boolean = false;
  private shouldStop: boolean = false;
  private runId: string;

  constructor(agent: BaseAgent, config: AgentConfig, policy: AutoModePolicy) {
    super();
    this.agent = agent;
    this.config = config;
    this.policy = policy;
    this.runId = agentPersistence.createRunId();
    
    this.budget = {
      stepsUsed: 0,
      tokensUsed: 0,
      costUsed: 0,
      startTime: new Date(),
      lastActivity: new Date()
    };
  }

  /**
   * Avvia l'esecuzione autonoma
   */
  async start(initialTask?: string): Promise<void> {
    if (this.isRunning) {
      throw new Error('AutoRunner is already running');
    }

    this.isRunning = true;
    this.shouldStop = false;

    console.log(chalk.blue(`🤖 Starting autonomous execution for agent: ${this.config.name}`));
    console.log(chalk.gray(`📋 Run ID: ${this.runId}`));
    console.log(chalk.gray(`🎯 Policy: ${this.policy.maxSteps} steps, ${this.policy.maxTokens} tokens, $${this.policy.maxCost} cost`));

    // Inizializza lo stato
    const initialState: AgentState = {
      id: this.agent.id,
      name: this.config.name,
      status: 'running',
      runId: this.runId,
      currentStep: 0,
      totalSteps: 0,
      startTime: this.budget.startTime,
      lastActivity: this.budget.lastActivity,
      memory: [],
      artifacts: [],
      metrics: {
        stepsCompleted: 0,
        tokensUsed: 0,
        cost: 0,
        executionTime: 0
      }
    };

    await agentPersistence.saveAgentState(this.config.name, this.runId, initialState);
    await this.log('info', 'AutoRunner started', { initialTask });

    try {
      // Loop principale di esecuzione autonoma
      while (!this.shouldStop && !this.isBudgetExceeded() && !this.isPolicyDone()) {
        await this.executeStep();
        
        // Pausa tra gli step per evitare sovraccarico
        await this.sleep(100);
      }

      if (this.shouldStop) {
        await this.log('info', 'AutoRunner stopped by user request');
      } else if (this.isBudgetExceeded()) {
        await this.log('warn', 'AutoRunner stopped due to budget limits exceeded');
      } else if (this.isPolicyDone()) {
        await this.log('info', 'AutoRunner completed successfully');
      }

    } catch (error: any) {
      await this.log('error', `AutoRunner failed: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      this.isRunning = false;
      await this.finalize();
    }
  }

  /**
   * Esegue un singolo step del ciclo autonomo
   */
  private async executeStep(): Promise<void> {
    const stepNumber = this.budget.stepsUsed + 1;
    const step: AutoModeStep = {
      stepNumber,
      type: 'perception',
      description: `Step ${stepNumber}: Perception phase`,
      startTime: new Date()
    };

    this.steps.push(step);
    this.budget.stepsUsed++;
    this.budget.lastActivity = new Date();

    await this.log('info', `Starting step ${stepNumber}`, { stepType: step.type });

    try {
      // Fase 1: Percezione
      step.type = 'perception';
      step.description = `Step ${stepNumber}: Analyzing current state and context`;
      const perception = await this.perceptionPhase();
      step.result = perception;

      // Fase 2: Ragionamento
      step.type = 'reasoning';
      step.description = `Step ${stepNumber}: Planning next action`;
      const reasoning = await this.reasoningPhase(perception);
      step.result = reasoning;

      // Fase 3: Azione
      step.type = 'action';
      step.description = `Step ${stepNumber}: Executing planned action`;
      const action = await this.actionPhase(reasoning);
      step.result = action;

      // Fase 4: Valutazione
      step.type = 'evaluation';
      step.description = `Step ${stepNumber}: Evaluating results`;
      const evaluation = await this.evaluationPhase(action);
      step.result = evaluation;

      step.endTime = new Date();
      await this.log('info', `Step ${stepNumber} completed successfully`, { 
        duration: step.endTime.getTime() - step.startTime.getTime() 
      });

      // Salva snapshot dello stato
      await this.saveSnapshot();

    } catch (error: any) {
      step.endTime = new Date();
      step.error = error.message;
      
      await this.log('error', `Step ${stepNumber} failed: ${error.message}`, { 
        error: error.stack,
        stepType: step.type 
      });

      // Gestione retry con backoff esponenziale
      if (this.shouldRetry(error)) {
        await this.handleRetry(stepNumber, error);
      } else {
        throw error;
      }
    }
  }

  /**
   * Fase di percezione: analizza lo stato corrente
   */
  private async perceptionPhase(): Promise<any> {
    // Analizza il contesto di lavoro
    const context = await this.getContext();
    
    // Analizza i file modificati
    const modifiedFiles = await this.getModifiedFiles();
    
    // Analizza lo stato del progetto
    const projectState = await this.analyzeProjectState();

    return {
      context,
      modifiedFiles,
      projectState,
      timestamp: new Date()
    };
  }

  /**
   * Fase di ragionamento: pianifica la prossima azione
   */
  private async reasoningPhase(perception: any): Promise<any> {
    // Determina se ci sono task da completare
    const pendingTasks = await this.getPendingTasks();
    
    // Valuta la priorità delle azioni
    const actionPriority = await this.evaluateActionPriority(pendingTasks, perception);
    
    // Seleziona la prossima azione
    const nextAction = await this.selectNextAction(actionPriority);

    return {
      pendingTasks,
      actionPriority,
      nextAction,
      reasoning: `Selected action: ${nextAction?.type || 'none'}`
    };
  }

  /**
   * Fase di azione: esegue l'azione pianificata
   */
  private async actionPhase(reasoning: any): Promise<any> {
    const { nextAction } = reasoning;
    
    if (!nextAction) {
      return { action: 'none', result: 'No actions to perform' };
    }

    // Valida l'azione contro le policy di sicurezza
    if (!this.validateAction(nextAction)) {
      throw new Error(`Action not allowed by security policy: ${nextAction.type}`);
    }

    // Esegui l'azione
    const result = await this.executeAction(nextAction);

    return {
      action: nextAction,
      result,
      timestamp: new Date()
    };
  }

  /**
   * Fase di valutazione: valuta i risultati dell'azione
   */
  private async evaluationPhase(action: any): Promise<any> {
    const { action: executedAction, result } = action;
    
    // Valuta se l'azione ha avuto successo
    const success = this.evaluateSuccess(result);
    
    // Aggiorna la memoria dell'agente
    await this.updateMemory(executedAction, result, success);
    
    // Determina se continuare o fermarsi
    const shouldContinue = this.shouldContinue(result, success);

    return {
      success,
      shouldContinue,
      evaluation: `Action ${success ? 'succeeded' : 'failed'}, should ${shouldContinue ? 'continue' : 'stop'}`
    };
  }

  /**
   * Pausa l'esecuzione
   */
  async pause(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('AutoRunner is not running');
    }

    this.shouldStop = true;
    await this.log('info', 'AutoRunner paused by user request');
    
    // Salva lo stato corrente
    await this.saveSnapshot();
  }

  /**
   * Riprende l'esecuzione
   */
  async resume(): Promise<void> {
    if (this.isRunning) {
      throw new Error('AutoRunner is already running');
    }

    this.shouldStop = false;
    await this.log('info', 'AutoRunner resumed by user request');
    
    // Continua l'esecuzione
    await this.start();
  }

  /**
   * Ferma l'esecuzione
   */
  async stop(): Promise<void> {
    this.shouldStop = true;
    this.isRunning = false;
    await this.log('info', 'AutoRunner stopped by user request');
    await this.finalize();
  }

  /**
   * Verifica se il budget è stato superato
   */
  private isBudgetExceeded(): boolean {
    const now = new Date();
    const timeElapsed = now.getTime() - this.budget.startTime.getTime();

    return (
      this.budget.stepsUsed >= this.policy.maxSteps ||
      this.budget.tokensUsed >= this.policy.maxTokens ||
      this.budget.costUsed >= this.policy.maxCost ||
      timeElapsed >= this.policy.timeLimit
    );
  }

  /**
   * Verifica se la policy è soddisfatta
   */
  private isPolicyDone(): boolean {
    // Implementa logica per determinare se il task è completato
    // Per ora, considera completato se non ci sono più task pendenti
    return false; // TODO: implementare logica di completamento
  }

  /**
   * Salva uno snapshot dello stato corrente
   */
  private async saveSnapshot(): Promise<void> {
    const state: AgentState = {
      id: this.agent.id,
      name: this.config.name,
      status: this.isRunning ? 'running' : 'paused',
      runId: this.runId,
      currentStep: this.budget.stepsUsed,
      totalSteps: this.steps.length,
      startTime: this.budget.startTime,
      lastActivity: this.budget.lastActivity,
      memory: await this.getMemory(),
      artifacts: await this.getArtifacts(),
      metrics: {
        stepsCompleted: this.budget.stepsUsed,
        tokensUsed: this.budget.tokensUsed,
        cost: this.budget.costUsed,
        executionTime: this.budget.lastActivity.getTime() - this.budget.startTime.getTime()
      }
    };

    await agentPersistence.saveAgentState(this.config.name, this.runId, state);
  }

  /**
   * Finalizza l'esecuzione
   */
  private async finalize(): Promise<void> {
    const finalState: AgentState = {
      id: this.agent.id,
      name: this.config.name,
      status: 'stopped',
      runId: this.runId,
      currentStep: this.budget.stepsUsed,
      totalSteps: this.steps.length,
      startTime: this.budget.startTime,
      lastActivity: new Date(),
      memory: await this.getMemory(),
      artifacts: await this.getArtifacts(),
      metrics: {
        stepsCompleted: this.budget.stepsUsed,
        tokensUsed: this.budget.tokensUsed,
        cost: this.budget.costUsed,
        executionTime: new Date().getTime() - this.budget.startTime.getTime()
      }
    };

    await agentPersistence.saveAgentState(this.config.name, this.runId, finalState);
    await this.log('info', 'AutoRunner finalized', { 
      totalSteps: this.budget.stepsUsed,
      totalCost: this.budget.costUsed 
    });
  }

  /**
   * Logga un messaggio
   */
  private async log(level: 'info' | 'warn' | 'error' | 'debug', message: string, metadata?: any): Promise<void> {
    await agentPersistence.appendLog(this.config.name, this.runId, {
      timestamp: new Date(),
      level,
      message,
      metadata
    });

    // Emetti evento per logging esterno
    this.emit('log', { level, message, metadata, timestamp: new Date() });
  }

  // Metodi helper (da implementare secondo le specifiche del progetto)
  private async getContext(): Promise<any> {
    // Implementa secondo il contesto del progetto
    return {};
  }

  private async getModifiedFiles(): Promise<string[]> {
    // Implementa rilevamento file modificati
    return [];
  }

  private async analyzeProjectState(): Promise<any> {
    // Implementa analisi stato progetto
    return {};
  }

  private async getPendingTasks(): Promise<any[]> {
    // Implementa recupero task pendenti
    return [];
  }

  private async evaluateActionPriority(tasks: any[], perception: any): Promise<any[]> {
    // Implementa valutazione priorità
    return tasks;
  }

  private async selectNextAction(actions: any[]): Promise<any> {
    // Implementa selezione prossima azione
    return actions[0] || null;
  }

  private validateAction(action: any): boolean {
    // Implementa validazione sicurezza
    if (this.policy.safeToolsOnly && !this.isSafeTool(action.tool)) {
      return false;
    }
    if (!this.policy.allowWrite && this.isWriteAction(action)) {
      return false;
    }
    return true;
  }

  private async executeAction(action: any): Promise<any> {
    // Implementa esecuzione azione
    return { success: true, result: 'Action executed' };
  }

  private evaluateSuccess(result: any): boolean {
    // Implementa valutazione successo
    return result?.success === true;
  }

  private async updateMemory(action: any, result: any, success: boolean): Promise<void> {
    // Implementa aggiornamento memoria
  }

  private shouldContinue(result: any, success: boolean): boolean {
    // Implementa logica continuazione
    return success && !this.isBudgetExceeded();
  }

  private shouldRetry(error: any): boolean {
    // Implementa logica retry
    return this.budget.stepsUsed < this.policy.maxRetries;
  }

  private async handleRetry(stepNumber: number, error: any): Promise<void> {
    // Implementa gestione retry con backoff
    const delay = Math.pow(this.policy.backoffMultiplier, stepNumber) * 1000;
    await this.sleep(delay);
  }

  private async getMemory(): Promise<any[]> {
    // Implementa recupero memoria
    return [];
  }

  private async getArtifacts(): Promise<string[]> {
    // Implementa recupero artefatti
    return [];
  }

  private isSafeTool(tool: string): boolean {
    // Implementa verifica strumenti sicuri
    return true; // TODO: implementare verifica sicura
  }

  private isWriteAction(action: any): boolean {
    // Implementa verifica azioni di scrittura
    return action?.type?.includes('write') || action?.type?.includes('create');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Getters per stato pubblico
  get isActive(): boolean {
    return this.isRunning;
  }

  get currentStep(): number {
    return this.budget.stepsUsed;
  }

  get totalSteps(): number {
    return this.steps.length;
  }

  get budgetInfo(): AutoModeBudget {
    return { ...this.budget };
  }

  get policyInfo(): AutoModePolicy {
    return { ...this.policy };
  }
}