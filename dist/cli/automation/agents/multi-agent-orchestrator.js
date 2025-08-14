"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiAgentOrchestrator = void 0;
class MultiAgentOrchestrator {
    constructor(agentManager) {
        this.agentManager = agentManager;
    }
    async runParallel(concurrency = 2) {
        await this.agentManager.runParallel(concurrency);
    }
}
exports.MultiAgentOrchestrator = MultiAgentOrchestrator;
