"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAgents = registerAgents;
const ai_agent_1 = require("./agents/ai-agent");
const code_generator_agent_1 = require("./agents/code-generator-agent");
const code_review_agent_1 = require("./agents/code-review-agent");
const optimization_agent_1 = require("./agents/optimization-agent");
const coding_agent_1 = require("./agents/coding-agent");
const react_agent_1 = require("./agents/react-agent");
const backend_agent_1 = require("./agents/backend-agent");
const devops_agent_1 = require("./agents/devops-agent");
const autonomous_orchestrator_1 = require("./agents/autonomous-orchestrator");
const autonomous_coder_1 = require("./agents/autonomous-coder");
const system_admin_agent_1 = require("./agents/system-admin-agent");
function registerAgents(agentManager) {
    // Legacy agents (for backward compatibility)
    agentManager.registerAgent(ai_agent_1.AIAnalysisAgent);
    agentManager.registerAgent(code_generator_agent_1.CodeGeneratorAgent);
    agentManager.registerAgent(code_review_agent_1.CodeReviewAgent);
    agentManager.registerAgent(optimization_agent_1.OptimizationAgent);
    // New specialized coding agents
    agentManager.registerAgent(coding_agent_1.CodingAgent);
    agentManager.registerAgent(react_agent_1.ReactAgent);
    agentManager.registerAgent(backend_agent_1.BackendAgent);
    agentManager.registerAgent(devops_agent_1.DevOpsAgent);
    agentManager.registerAgent(autonomous_coder_1.AutonomousCoder);
    agentManager.registerAgent(system_admin_agent_1.SystemAdminAgent);
    // Autonomous orchestrator (special case - requires AgentManager)
    class AutonomousOrchestratorWrapper extends autonomous_orchestrator_1.AutonomousOrchestrator {
        constructor() {
            super(agentManager);
        }
    }
    agentManager.registerAgent(AutonomousOrchestratorWrapper);
}
