"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentManager = void 0;
class AgentManager {
    constructor(workingDirectory = process.cwd()) {
        this.agents = new Map();
        this.workingDirectory = workingDirectory;
    }
    registerAgent(agentClass) {
        // Create a temporary instance to get the name
        const tempInstance = new agentClass(this.workingDirectory);
        if (!tempInstance.id) {
            throw new Error('Agent class must have an id property');
        }
        this.agents.set(tempInstance.id, agentClass);
    }
    getAgent(name) {
        const AgentClass = this.agents.get(name);
        if (!AgentClass)
            return null;
        return new AgentClass(this.workingDirectory);
    }
    listAgents() {
        return Array.from(this.agents.values()).map(AgentClass => new AgentClass(this.workingDirectory));
    }
    getAvailableAgentNames() {
        return Array.from(this.agents.keys());
    }
}
exports.AgentManager = AgentManager;
