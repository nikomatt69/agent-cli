import { AgentManager } from './agents/agent-manager';
import { AIAnalysisAgent } from './agents/ai-agent';
import { CodeGeneratorAgent } from './agents/code-generator-agent';
import { CodeReviewAgent } from './agents/code-review-agent';
import { OptimizationAgent } from './agents/optimization-agent';
import { CodingAgent } from './agents/coding-agent';
import { ReactAgent } from './agents/react-agent';
import { BackendAgent } from './agents/backend-agent';
import { DevOpsAgent } from './agents/devops-agent';
import { AutonomousOrchestrator } from './agents/autonomous-orchestrator';
import { AutonomousCoder } from './agents/autonomous-coder';
import { SystemAdminAgent } from './agents/system-admin-agent';

export function registerAgents(agentManager: AgentManager): void {
  // Legacy agents (for backward compatibility)
  agentManager.registerAgent(AIAnalysisAgent);
  agentManager.registerAgent(CodeGeneratorAgent);
  agentManager.registerAgent(CodeReviewAgent);
  agentManager.registerAgent(OptimizationAgent);
  
  // New specialized coding agents
  agentManager.registerAgent(CodingAgent);
  agentManager.registerAgent(ReactAgent);
  agentManager.registerAgent(BackendAgent);
  agentManager.registerAgent(DevOpsAgent);
  agentManager.registerAgent(AutonomousCoder);
  agentManager.registerAgent(SystemAdminAgent);
  
  // Autonomous orchestrator (special case - requires AgentManager)
  class AutonomousOrchestratorWrapper extends AutonomousOrchestrator {
    constructor() {
      super(agentManager);
    }
  }
  agentManager.registerAgent(AutonomousOrchestratorWrapper);
}
