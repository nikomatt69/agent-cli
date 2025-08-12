"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAgents = registerAgents;
const universal_agent_1 = require("./automation/agents/universal-agent");
function registerAgents(agentManager) {
    // Register the unified UniversalAgent for enterprise production use
    agentManager.registerAgentClass(universal_agent_1.UniversalAgent, {
        id: 'universal-agent',
        name: 'Universal Agent',
        description: 'All-in-one enterprise agent with complete coding, analysis, and autonomous capabilities',
        specialization: 'universal',
        version: '0.1.3-beta',
        capabilities: [
            // Core capabilities
            'code-generation',
            'code-analysis',
            'code-review',
            'optimization',
            'debugging',
            'refactoring',
            'testing',
            // Frontend capabilities
            'react',
            'nextjs',
            'typescript',
            'javascript',
            'html',
            'css',
            'frontend',
            'components',
            'hooks',
            'jsx',
            'tsx',
            // Backend capabilities
            'backend',
            'nodejs',
            'api-development',
            'database',
            'server-architecture',
            'rest-api',
            'graphql',
            'microservices',
            // DevOps capabilities
            'devops',
            'ci-cd',
            'docker',
            'kubernetes',
            'deployment',
            'infrastructure',
            'monitoring',
            'security',
            // Autonomous capabilities
            'file-operations',
            'project-creation',
            'autonomous-coding',
            'system-administration',
            'full-stack-development',
            // Analysis capabilities
            'performance-analysis',
            'security-analysis',
            'quality-assessment',
            'architecture-review',
            'documentation-generation'
        ],
        category: 'enterprise',
        tags: ['universal', 'all-in-one', 'enterprise', 'autonomous', 'fullstack'],
        requiresGuidance: false,
        defaultConfig: {
            autonomyLevel: 'fully-autonomous',
            maxConcurrentTasks: 3,
            defaultTimeout: 300000,
            retryPolicy: {
                maxAttempts: 3,
                backoffMs: 1000,
                backoffMultiplier: 2,
                retryableErrors: ['timeout', 'network', 'temporary']
            },
            enabledTools: ['file', 'terminal', 'git', 'npm', 'analysis'],
            guidanceFiles: [],
            logLevel: 'info',
            permissions: {
                canReadFiles: true,
                canWriteFiles: true,
                canDeleteFiles: true,
                allowedPaths: ['*'],
                forbiddenPaths: ['/etc', '/system'],
                canExecuteCommands: true,
                allowedCommands: ['*'],
                forbiddenCommands: ['rm -rf /', 'format', 'fdisk'],
                canAccessNetwork: true,
                allowedDomains: ['*'],
                canInstallPackages: true,
                canModifyConfig: true,
                canAccessSecrets: false
            },
            sandboxRestrictions: []
        }
    });
}
