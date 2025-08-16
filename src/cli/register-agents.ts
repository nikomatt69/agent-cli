import { AgentManager } from './core/agent-manager';
import { UniversalAgent } from './automation/agents/universal-agent';
import { AutonomousVMAgent } from './automation/agents/autonomous-vm-agent';

export function registerAgents(agentManager: AgentManager): void {
  // Register the unified UniversalAgent for enterprise production use
  agentManager.registerAgentClass(UniversalAgent, {
    id: 'universal-agent',
    name: 'Universal Agent',
    description: 'All-in-one enterprise agent with complete coding, analysis, and autonomous capabilities',
    specialization: 'universal',
    version: '0.1.15-beta',
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

  // Register the Autonomous VM Agent for VM-based operations
  agentManager.registerAgentClass(AutonomousVMAgent, {
    id: 'autonomous-vm-agent',
    name: 'Autonomous VM Agent',
    description: 'Autonomous agent that operates in isolated VM environments for repository analysis and development tasks',
    specialization: 'vm-operations',
    version: '0.1.15-beta',
    capabilities: [
      // VM Management capabilities
      'vm-management',
      'docker-operations',
      'container-orchestration',
      'isolated-environments',

      // Repository analysis capabilities
      'repository-analysis',
      'code-analysis',
      'security-scanning',
      'dependency-analysis',
      'architecture-review',

      // Development capabilities
      'autonomous-coding',
      'testing',
      'deployment',
      'ci-cd-setup',

      // Tool installation and setup
      'vscode-setup',
      'development-tools',
      'package-management',
      'environment-configuration'
    ],
    category: 'vm-autonomous',
    tags: ['vm', 'autonomous', 'repository-analysis', 'docker', 'isolated'],
    requiresGuidance: false,
    defaultConfig: {
      autonomyLevel: 'fully-autonomous',
      maxConcurrentTasks: 2,
      defaultTimeout: 600000, // 10 minutes for VM operations
      retryPolicy: {
        maxAttempts: 2,
        backoffMs: 2000,
        backoffMultiplier: 2,
        retryableErrors: ['timeout', 'network', 'docker-error']
      },
      enabledTools: ['docker', 'git', 'terminal', 'file'],
      guidanceFiles: [],
      logLevel: 'info',
      permissions: {
        canReadFiles: true,
        canWriteFiles: true,
        canDeleteFiles: true,
        allowedPaths: ['*'],
        forbiddenPaths: ['/etc', '/system'],
        canExecuteCommands: true,
        allowedCommands: ['docker', 'git', 'npm', 'node', 'bash'],
        forbiddenCommands: ['rm -rf /', 'format', 'fdisk'],
        canAccessNetwork: true,
        allowedDomains: ['*'],
        canInstallPackages: true,
        canModifyConfig: true,
        canAccessSecrets: false
      },
      sandboxRestrictions: ['vm-isolation']
    }
  });
}
