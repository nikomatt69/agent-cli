"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiAgentOrchestrator = void 0;
/**
 * Coordinates execution of todos across multiple agents
 * with a concurrency limit.
 */
class MultiAgentOrchestrator {
    constructor(agentManager) {
        this.agentManager = agentManager;
    }
    async runParallel(concurrency = 2) {
        await this.agentManager.runParallel(concurrency);
    }
}
exports.MultiAgentOrchestrator = MultiAgentOrchestrator;
