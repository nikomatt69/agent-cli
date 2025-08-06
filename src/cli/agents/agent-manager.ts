import { Agent } from './types';
import { BaseAgent } from './base-agent';

// Type for concrete agent classes that extend BaseAgent
type ConcreteAgentClass = new () => BaseAgent;

export class AgentManager {
  private agents: Map<string, ConcreteAgentClass> = new Map();

  registerAgent(agentClass: ConcreteAgentClass): void {
    // Create a temporary instance to get the name
    const tempInstance = new agentClass();
    if (!tempInstance.name) {
      throw new Error('Agent class must have a name property');
    }
    this.agents.set(tempInstance.name, agentClass);
  }

  getAgent(name: string): BaseAgent | null {
    const AgentClass = this.agents.get(name);
    if (!AgentClass) return null;
    return new AgentClass();
  }

  listAgents(): BaseAgent[] {
    return Array.from(this.agents.values()).map(AgentClass => new AgentClass());
  }

  getAvailableAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }
}
