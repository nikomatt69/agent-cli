import { BaseAgent } from './base-agent';
import { modelProvider, ChatMessage } from '../ai/model-provider';

export class BackendAgent extends BaseAgent {
  name = 'backend-expert';
  description = 'Node.js/Backend specialist for APIs, databases, and server architecture';

  async run(task?: string): Promise<any> {
    if (!task) {
      return {
        message: 'Backend Expert ready! I can help with APIs, databases, microservices, and server architecture',
        specialties: [
          'Node.js and Express/Fastify APIs',
          'Database design and queries (SQL/NoSQL)',
          'Authentication and security',
          'Microservices architecture',
          'Docker and containerization',
          'Testing and monitoring',
          'Cloud deployment (AWS, GCP, Azure)',
        ],
      };
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a backend development expert with deep knowledge of:
        
        - Node.js and server-side JavaScript/TypeScript
        - API design and RESTful services
        - Database design and optimization (SQL and NoSQL)
        - Authentication, authorization, and security best practices
        - Microservices and distributed systems
        - Docker, containers, and orchestration
        - Cloud platforms and deployment strategies
        - Performance monitoring and optimization
        - Testing strategies (unit, integration, load testing)

        Always provide:
        - Scalable and maintainable code
        - Security-first approach
        - Performance considerations
        - Error handling and logging
        - Database optimization tips
        - Deployment and DevOps guidance`,
      },
      {
        role: 'user',
        content: task,
      },
    ];

    try {
      const response = await modelProvider.generateResponse({ messages });
      return { response, task, agent: 'Backend Expert' };
    } catch (error: any) {
      return { error: error.message, task, agent: 'Backend Expert' };
    }
  }
}