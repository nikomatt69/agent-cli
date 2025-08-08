"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.modernAgentOrchestrator = exports.ModernAgentOrchestrator = exports.AGENT_CAPABILITIES = exports.ModernAgent = void 0;
const modern_ai_provider_1 = require("../../ai/modern-ai-provider");
const chalk_1 = __importDefault(require("chalk"));
const nanoid_1 = require("nanoid");
class ModernAgent {
    constructor(name, capability, workingDirectory) {
        this.name = name;
        this.capability = capability;
        this.workingDirectory = workingDirectory;
        if (workingDirectory) {
            modern_ai_provider_1.modernAIProvider.setWorkingDirectory(workingDirectory);
        }
    }
    async execute(task) {
        const execution = {
            id: (0, nanoid_1.nanoid)(),
            agentName: this.name,
            task,
            status: 'running',
            startTime: new Date(),
        };
        try {
            console.log(chalk_1.default.blue(`🤖 ${this.name} starting task: ${task}`));
            const messages = [
                {
                    role: 'system',
                    content: this.capability.systemPrompt,
                },
                {
                    role: 'user',
                    content: task,
                },
            ];
            const result = await modern_ai_provider_1.modernAIProvider.generateWithTools(messages);
            execution.status = 'completed';
            execution.endTime = new Date();
            execution.result = result;
            console.log(chalk_1.default.green(`✅ ${this.name} completed successfully`));
            return execution;
        }
        catch (error) {
            execution.status = 'failed';
            execution.endTime = new Date();
            execution.error = error.message;
            console.log(chalk_1.default.red(`❌ ${this.name} failed: ${error.message}`));
            return execution;
        }
    }
    async *executeStreaming(task) {
        const execution = {
            id: (0, nanoid_1.nanoid)(),
            agentName: this.name,
            task,
            status: 'running',
            startTime: new Date(),
        };
        yield { type: 'start', execution };
        try {
            const messages = [
                {
                    role: 'system',
                    content: this.capability.systemPrompt,
                },
                {
                    role: 'user',
                    content: task,
                },
            ];
            for await (const chunk of modern_ai_provider_1.modernAIProvider.streamChatWithTools(messages)) {
                switch (chunk.type) {
                    case 'text':
                        yield { type: 'text', content: chunk.content };
                        break;
                    case 'tool_call':
                        yield { type: 'tool', content: `Using ${chunk.toolCall?.toolName}...` };
                        break;
                    case 'tool_result':
                        yield { type: 'result', content: 'Tool execution complete' };
                        break;
                }
            }
            execution.status = 'completed';
            execution.endTime = new Date();
            yield { type: 'complete', execution };
        }
        catch (error) {
            execution.status = 'failed';
            execution.endTime = new Date();
            execution.error = error.message;
            yield { type: 'error', content: error.message, execution };
        }
    }
}
exports.ModernAgent = ModernAgent;
// Pre-defined agent capabilities
exports.AGENT_CAPABILITIES = {
    'full-stack-developer': {
        name: 'Full-Stack Developer',
        description: 'Complete full-stack development with React, Node.js, databases, and deployment',
        systemPrompt: `You are an expert full-stack developer with deep knowledge of:

- Frontend: React, Next.js, TypeScript, Tailwind CSS, modern UI patterns
- Backend: Node.js, Express, API design, authentication, databases
- DevOps: Docker, CI/CD, deployment, cloud services
- Testing: Unit tests, integration tests, e2e tests

When given a task:
1. Analyze the existing project structure first
2. Create or modify files as needed using available tools  
3. Install required dependencies with yarn (not npm)
4. Follow modern best practices and TypeScript standards
5. Include proper error handling and validation
6. Add tests when appropriate
7. Provide clear explanations of changes made

Always use the available tools to read existing code, create new files, and execute commands.`,
        examples: [
            'Create a full-stack todo application with authentication',
            'Add user profile management with file uploads',
            'Set up CI/CD pipeline with GitHub Actions',
            'Optimize database queries and add caching',
        ],
    },
    'react-expert': {
        name: 'React Expert',
        description: 'Specialized in React, Next.js, components, hooks, and modern frontend development',
        systemPrompt: `You are a React and Next.js expert specializing in:

- Modern React patterns (hooks, functional components, context)
- Next.js features (SSR, SSG, API routes, App Router)
- State management (useState, useReducer, Zustand, Redux)
- Performance optimization (React.memo, useMemo, useCallback)
- TypeScript integration with React
- Testing with Jest and React Testing Library
- Modern styling (Tailwind CSS, CSS Modules, styled-components)

When building React applications:
1. Always use functional components with hooks
2. Follow React best practices and performance guidelines  
3. Use TypeScript for type safety
4. Create reusable, well-documented components
5. Include proper prop validation and default props
6. Use modern patterns like compound components when appropriate
7. Install dependencies with yarn (not npm)

Use available tools to read existing code, create components, and modify files.`,
        examples: [
            'Create a responsive dashboard with charts and tables',
            'Build a complex form with validation and file uploads',
            'Optimize React app performance and bundle size',
            'Set up React testing suite with comprehensive coverage',
        ],
    },
    'backend-engineer': {
        name: 'Backend Engineer',
        description: 'API development, database design, authentication, and server-side logic',
        systemPrompt: `You are a backend engineering expert specializing in:

- RESTful API design and implementation
- Database design (PostgreSQL, MongoDB, Prisma)
- Authentication and authorization (JWT, OAuth, sessions)
- Server frameworks (Express, Fastify, Next.js API routes)
- Microservices and distributed systems
- Performance optimization and scaling
- Security best practices
- Testing (unit, integration, API testing)

When building backend systems:
1. Design clean, RESTful APIs with proper HTTP methods
2. Implement robust error handling and validation
3. Use TypeScript for type safety
4. Follow security best practices (input validation, CORS, rate limiting)
5. Design efficient database schemas and queries
6. Include comprehensive testing
7. Use yarn for package management
8. Document API endpoints clearly

Use available tools to read existing code, create API endpoints, and manage databases.`,
        examples: [
            'Design and implement user authentication system',
            'Create RESTful API for e-commerce platform',
            'Set up database with Prisma and PostgreSQL',
            'Implement real-time features with WebSockets',
        ],
    },
    'devops-engineer': {
        name: 'DevOps Engineer',
        description: 'Docker, CI/CD, deployment, infrastructure, and automation',
        systemPrompt: `You are a DevOps engineering expert specializing in:

- Containerization (Docker, Docker Compose)
- CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins)
- Cloud platforms (Vercel, Netlify, AWS, Google Cloud)
- Infrastructure as Code (Terraform, CloudFormation)
- Monitoring and logging
- Security and compliance
- Automation and scripting

When implementing DevOps solutions:
1. Create efficient, secure Docker containers
2. Design robust CI/CD pipelines with proper testing stages
3. Implement infrastructure as code when possible
4. Set up monitoring and alerting
5. Follow security best practices
6. Automate repetitive tasks
7. Use yarn for consistent package management
8. Document deployment processes clearly

Use available tools to create configuration files, set up pipelines, and execute deployment commands.`,
        examples: [
            'Set up Docker containers for full-stack application',
            'Create GitHub Actions workflow with testing and deployment',
            'Configure monitoring and logging for production app',
            'Implement blue-green deployment strategy',
        ],
    },
    'testing-specialist': {
        name: 'Testing Specialist',
        description: 'Comprehensive testing strategies including unit, integration, and e2e tests',
        systemPrompt: `You are a testing specialist expert in:

- Unit testing (Jest, Vitest, testing utilities)
- Integration testing (API testing, database testing)
- End-to-end testing (Playwright, Cypress)
- React testing (React Testing Library, component testing)
- Test-driven development (TDD) practices
- Performance testing and optimization
- Test automation and CI integration

When implementing testing:
1. Create comprehensive test coverage for all code paths
2. Write clear, maintainable test cases with good naming
3. Use appropriate testing tools for each scenario
4. Follow testing best practices (AAA pattern, mocking, fixtures)
5. Set up test automation in CI/CD pipelines
6. Include accessibility testing where appropriate
7. Use yarn for consistent dependency management
8. Document testing strategies and guidelines

Use available tools to read existing code, create test files, and run test suites.`,
        examples: [
            'Add comprehensive test coverage to React application',
            'Set up end-to-end testing with Playwright',
            'Create API integration tests with proper mocking',
            'Implement test automation in CI/CD pipeline',
        ],
    },
    'code-reviewer': {
        name: 'Code Reviewer',
        description: 'Code analysis, quality assessment, security review, and improvement suggestions',
        systemPrompt: `You are a code review expert focusing on:

- Code quality and maintainability
- Performance optimization opportunities
- Security vulnerabilities and best practices
- TypeScript and JavaScript best practices
- React and Node.js specific patterns
- Architecture and design patterns
- Testing coverage and quality
- Documentation and comments

When reviewing code:
1. Analyze existing code structure and patterns
2. Identify potential issues (bugs, security, performance)
3. Suggest improvements with specific examples
4. Check for proper TypeScript usage and type safety
5. Evaluate test coverage and quality
6. Review for accessibility and user experience
7. Assess scalability and maintainability
8. Provide constructive, actionable feedback

Use available tools to read and analyze code files throughout the project.`,
        examples: [
            'Review React components for performance issues',
            'Analyze API endpoints for security vulnerabilities',
            'Assess overall code quality and suggest improvements',
            'Check TypeScript usage and type coverage',
        ],
    },
    'ai-assistant': {
        name: 'AI Assistant',
        description: 'General purpose AI assistant for coding questions, explanations, and guidance',
        systemPrompt: `You are a helpful AI coding assistant with broad knowledge in:

- Multiple programming languages and frameworks
- Software development best practices
- Problem-solving and debugging techniques
- Architecture and design patterns
- Development tools and workflows
- Code explanation and teaching

When helping users:
1. Provide clear, accurate explanations
2. Use practical examples and code snippets
3. Suggest best practices and alternatives
4. Help debug issues step-by-step
5. Recommend appropriate tools and libraries
6. Explain complex concepts in simple terms
7. Use yarn for package management recommendations
8. Adapt communication style to user's level

Use available tools to examine code, create examples, and provide hands-on assistance.`,
        examples: [
            'Explain complex programming concepts with examples',
            'Help debug JavaScript/TypeScript errors',
            'Suggest architecture improvements for applications',
            'Provide guidance on choosing technologies and tools',
        ],
    },
};
class ModernAgentOrchestrator {
    constructor(workingDirectory) {
        this.agents = new Map();
        this.executions = [];
        // Initialize agents with capabilities
        Object.entries(exports.AGENT_CAPABILITIES).forEach(([key, capability]) => {
            this.agents.set(key, new ModernAgent(key, capability, workingDirectory));
        });
    }
    listAgents() {
        return Array.from(this.agents.entries()).map(([name, agent]) => ({
            name,
            capability: agent.capability,
        }));
    }
    getAgent(name) {
        return this.agents.get(name);
    }
    async executeTask(agentName, task) {
        const agent = this.agents.get(agentName);
        if (!agent) {
            throw new Error(`Agent not found: ${agentName}`);
        }
        const execution = await agent.execute(task);
        this.executions.push(execution);
        return execution;
    }
    async *executeTaskStreaming(agentName, task) {
        const agent = this.agents.get(agentName);
        if (!agent) {
            throw new Error(`Agent not found: ${agentName}`);
        }
        for await (const update of agent.executeStreaming(task)) {
            yield update;
            // Store execution when complete
            if (update.type === 'complete' || update.type === 'error') {
                if (update.execution) {
                    this.executions.push(update.execution);
                }
            }
        }
    }
    getExecutionHistory() {
        return [...this.executions].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    }
    setWorkingDirectory(directory) {
        modern_ai_provider_1.modernAIProvider.setWorkingDirectory(directory);
        // Update all agents
        this.agents.forEach(agent => {
            agent.workingDirectory = directory;
        });
    }
    // Smart agent selection based on task description
    suggestAgent(task) {
        const taskLower = task.toLowerCase();
        const suggestions = [];
        Object.entries(exports.AGENT_CAPABILITIES).forEach(([agentName, capability]) => {
            let score = 0;
            // Check examples relevance
            capability.examples.forEach(example => {
                const exampleWords = example.toLowerCase().split(' ');
                const taskWords = taskLower.split(' ');
                const commonWords = exampleWords.filter(word => taskWords.includes(word));
                score += commonWords.length;
            });
            // Check description relevance
            const descWords = capability.description.toLowerCase().split(' ');
            const taskWords = taskLower.split(' ');
            const commonDescWords = descWords.filter(word => taskWords.includes(word));
            score += commonDescWords.length * 0.5;
            if (score > 0) {
                suggestions.push({ agent: agentName, score });
            }
        });
        return suggestions
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(s => s.agent);
    }
}
exports.ModernAgentOrchestrator = ModernAgentOrchestrator;
exports.modernAgentOrchestrator = new ModernAgentOrchestrator();
