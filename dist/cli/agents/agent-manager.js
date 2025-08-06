"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentManager = void 0;
class AgentManager {
    constructor() {
        this.agents = new Map();
    }
    registerAgent(agentClass) {
        // Create a temporary instance to get the name
        const tempInstance = new agentClass();
        if (!tempInstance.name) {
            throw new Error('Agent class must have a name property');
        }
        this.agents.set(tempInstance.name, agentClass);
    }
    getAgent(name) {
        const AgentClass = this.agents.get(name);
        if (!AgentClass)
            return null;
        return new AgentClass();
    }
    listAgents() {
        return Array.from(this.agents.values()).map(AgentClass => new AgentClass());
    }
    getAvailableAgentNames() {
        return Array.from(this.agents.keys());
    }
}
exports.AgentManager = AgentManager;
