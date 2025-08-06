import { Agent } from './types';

export abstract class BaseAgent implements Agent {
  abstract name: string;
  abstract description: string;
  
  async initialize(): Promise<void> {
    // Implement initialization logic for the agent
    console.log(`Initializing agent: ${this.name}`);
  }

  async run(task?: string): Promise<any> {
    // Implement main agent logic
    console.log(`Running agent: ${this.name}`);
    if (task) {
      console.log(`Task: ${task}`);
    }
    return `Agent ${this.name} completed successfully`;
  }

  async cleanup(): Promise<void> {
    // Implement cleanup logic
    console.log(`Cleaning up agent: ${this.name}`);
  }
}
