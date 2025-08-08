"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentStore = void 0;
const zustand_1 = require("zustand");
exports.AgentStore = (0, zustand_1.create)((set) => ({
    agents: [],
    runningAgents: 0,
    addAgent: (agent) => set((state) => ({
        agents: [...state.agents, agent],
        runningAgents: state.runningAgents + 1,
    })),
    removeAgent: (id) => set((state) => ({
        agents: state.agents.filter((agent) => agent.id !== id),
        runningAgents: state.runningAgents - 1,
    })),
    updateAgentStatus: (id, status) => set((state) => ({
        agents: state.agents.map((agent) => agent.id === id ? { ...agent, status } : agent),
    })),
}));
