"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
class BaseAgent {
    async initialize() {
        // Implement initialization logic for the agent
        console.log(`Initializing agent: ${this.name}`);
    }
    async run(task) {
        // Implement main agent logic
        console.log(`Running agent: ${this.name}`);
        if (task) {
            console.log(`Task: ${task}`);
        }
        return `Agent ${this.name} completed successfully`;
    }
    async cleanup() {
        // Implement cleanup logic
        console.log(`Cleaning up agent: ${this.name}`);
    }
}
exports.BaseAgent = BaseAgent;
