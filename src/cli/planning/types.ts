/**
 * Execution Planning System Types
 * Production-ready interfaces for step-by-step plan generation and execution
 */

export interface ExecutionStep {
  id: string;
  type: 'tool' | 'validation' | 'user_input' | 'decision';
  title: string;
  description: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  dependencies?: string[]; // IDs of steps that must complete first
  estimatedDuration?: number; // in milliseconds
  riskLevel: 'low' | 'medium' | 'high';
  reversible: boolean;
  metadata?: Record<string, any>;
}

export interface ExecutionPlan {
  id: string;
  title: string;
  description: string;
  steps: ExecutionStep[];
  estimatedTotalDuration: number;
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high';
    destructiveOperations: number;
    fileModifications: number;
    externalCalls: number;
  };
  createdAt: Date;
  createdBy: string; // agent name
  context: {
    userRequest: string;
    projectPath: string;
    relevantFiles?: string[];
  };
}

export interface StepExecutionResult {
  stepId: string;
  status: 'success' | 'failure' | 'skipped' | 'cancelled';
  output?: any;
  error?: Error;
  duration: number;
  timestamp: Date;
  logs?: string[];
}

export interface PlanExecutionResult {
  planId: string;
  status: 'completed' | 'failed' | 'cancelled' | 'partial';
  startTime: Date;
  endTime?: Date;
  stepResults: StepExecutionResult[];
  summary: {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    skippedSteps: number;
  };
}

export interface PlanApprovalRequest {
  plan: ExecutionPlan;
  timestamp: Date;
  requiresConfirmation: boolean;
  warningMessages?: string[];
}

export interface PlanApprovalResponse {
  approved: boolean;
  modifiedSteps?: string[]; // IDs of steps to skip
  userComments?: string;
  timestamp: Date;
}

export interface PlannerConfig {
  maxStepsPerPlan: number;
  requireApprovalForRisk: 'medium' | 'high';
  enableRollback: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  timeoutPerStep: number; // milliseconds
}

export interface ToolCapability {
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  reversible: boolean;
  estimatedDuration: number;
  requiredArgs: string[];
  optionalArgs: string[];
}

export interface PlanValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface PlannerContext {
  userRequest: string;
  projectPath: string;
  availableTools: ToolCapability[];
  projectAnalysis?: {
    fileCount: number;
    languages: string[];
    frameworks: string[];
    hasTests: boolean;
    hasDocumentation: boolean;
  };
  userPreferences?: {
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    preferredTools: string[];
    excludedOperations: string[];
  };
}
