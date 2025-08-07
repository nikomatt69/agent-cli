"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevOpsAgent = void 0;
const base_agent_1 = require("./base-agent");
const model_provider_1 = require("../ai/model-provider");
class DevOpsAgent extends base_agent_1.BaseAgent {
    constructor(workingDirectory = process.cwd()) {
        super(workingDirectory);
        this.id = 'devops';
        this.capabilities = ["deployment", "ci-cd", "infrastructure", "containers"];
        this.specialization = 'DevOps and infrastructure management';
        this.name = 'devops';
        this.description = 'DevOps and infrastructure management';
        this.name = 'devops-expert';
        this.description = 'DevOps and infrastructure specialist for CI/CD, Docker, Kubernetes, and cloud deployments';
    }
    async onInitialize() {
        console.log('DevOps Agent initialized');
    }
    async onStop() {
        console.log('DevOps Agent stopped');
    }
    async onExecuteTask(task) {
        const taskData = typeof task === 'string' ? task : task.data;
        if (!taskData) {
            return {
                message: 'DevOps Expert ready! I can help with CI/CD, containerization, infrastructure, and cloud deployments',
                specialties: [
                    'Docker and container orchestration',
                    'Kubernetes deployment and management',
                    'CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins)',
                    'Infrastructure as Code (Terraform, CloudFormation)',
                    'Cloud platforms (AWS, GCP, Azure)',
                    'Monitoring and logging (Prometheus, Grafana, ELK)',
                    'Security and compliance',
                ],
            };
        }
        const messages = [
            {
                role: 'system',
                content: `You are a DevOps and infrastructure expert with deep knowledge of:
        
        - Docker containerization and multi-stage builds
        - Kubernetes orchestration and cluster management
        - CI/CD pipeline design and automation
        - Infrastructure as Code (IaC) with Terraform, CloudFormation
        - Cloud platforms: AWS, Google Cloud, Azure
        - Monitoring, logging, and observability
        - Security best practices and compliance
        - Performance optimization and scaling
        - GitOps and deployment strategies

        Always provide:
        - Production-ready configurations
        - Security-first approach
        - Scalable and maintainable infrastructure
        - Cost optimization strategies
        - Monitoring and alerting setup
        - Disaster recovery considerations
        - Clear deployment instructions`,
            },
            {
                role: 'user',
                content: taskData,
            },
        ];
        try {
            const response = await model_provider_1.modelProvider.generateResponse({ messages });
            return { response, taskData, agent: 'DevOps Expert' };
        }
        catch (error) {
            return { error: error.message, taskData, agent: 'DevOps Expert' };
        }
    }
    // Keep legacy methods for backward compatibility
    async run(taskData) {
        return await this.onExecuteTask(taskData);
    }
    async cleanup() {
        return await this.onStop();
    }
}
exports.DevOpsAgent = DevOpsAgent;
