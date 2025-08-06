import { BaseAgent } from './base-agent';
import { modelProvider, ChatMessage } from '../ai/model-provider';

export class DevOpsAgent extends BaseAgent {
  name = 'devops-expert';
  description = 'DevOps and infrastructure specialist for CI/CD, Docker, Kubernetes, and cloud deployments';

  async run(task?: string): Promise<any> {
    if (!task) {
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

    const messages: ChatMessage[] = [
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
        content: task,
      },
    ];

    try {
      const response = await modelProvider.generateResponse({ messages });
      return { response, task, agent: 'DevOps Expert' };
    } catch (error: any) {
      return { error: error.message, task, agent: 'DevOps Expert' };
    }
  }
}