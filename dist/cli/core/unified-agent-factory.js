"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedAgentFactory = exports.UnifiedAgentFactory = void 0;
const events_1 = require("events");
const chalk_1 = __importDefault(require("chalk"));
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const agent_persistence_1 = require("../persistence/agent-persistence");
const auto_runner_1 = require("../automation/agents/auto-runner");
const universal_agent_1 = require("../automation/agents/universal-agent");
const coding_agent_1 = require("../automation/agents/coding-agent");
const devops_agent_1 = require("../automation/agents/devops-agent");
const code_review_agent_1 = require("../automation/agents/code-review-agent");
const agent_config_schema_json_1 = __importDefault(require("../schemas/agent-config.schema.json"));
class UnifiedAgentFactory extends events_1.EventEmitter {
    constructor() {
        super();
        this.profiles = new Map();
        this.builders = new Map();
        this.instances = new Map();
        this.validator = new ajv_1.default({ allErrors: true });
        (0, ajv_formats_1.default)(this.validator);
        this.validator.addSchema(agent_config_schema_json_1.default, 'agent-config');
        this.registerDefaultProfiles();
    }
    registerProfile(name, profile, builder) {
        this.profiles.set(name, profile);
        this.builders.set(name, builder);
        this.emit('profile.registered', { name, profile });
    }
    async createAgent(config, workingDirectory) {
        this.validateConfig(config);
        if (!this.profiles.has(config.profile)) {
            throw new Error(`Profile '${config.profile}' not found. Available profiles: ${Array.from(this.profiles.keys()).join(', ')}`);
        }
        const builder = this.builders.get(config.profile);
        const agent = builder(config, workingDirectory);
        await agent.initialize();
        const instance = {
            agent,
            config,
            status: 'created'
        };
        await agent_persistence_1.agentPersistence.saveAgentConfig(config.name, config);
        this.instances.set(config.name, instance);
        this.emit('agent.created', { name: config.name, config });
        return instance;
    }
    async createAgentFromProfile(profileName, agentName, overrides) {
        const profile = this.profiles.get(profileName);
        if (!profile) {
            throw new Error(`Profile '${profileName}' not found`);
        }
        const config = {
            name: agentName,
            profile: profileName,
            specialization: profile.specialization,
            systemPrompt: profile.systemPrompt,
            capabilities: profile.capabilities,
            requiredTools: profile.requiredTools,
            personality: profile.personality,
            autonomyLevel: 'fully-autonomous',
            contextScope: 'project',
            workingStyle: 'adaptive',
            autoMode: {
                enabled: true,
                maxSteps: 50,
                maxTokens: 10000,
                maxCost: 5.0,
                timeLimit: '30m',
                safeToolsOnly: true,
                allowWrite: false
            },
            ...profile.defaultConfig,
            ...overrides
        };
        return this.createAgent(config);
    }
    async launchAgent(agentName, autoMode = false, policy) {
        const instance = this.instances.get(agentName);
        if (!instance) {
            throw new Error(`Agent '${agentName}' not found. Use create-agent first.`);
        }
        if (autoMode) {
            const defaultPolicy = {
                maxSteps: instance.config.autoMode?.maxSteps || 50,
                maxTokens: instance.config.autoMode?.maxTokens || 10000,
                maxCost: instance.config.autoMode?.maxCost || 5.0,
                timeLimit: this.parseTimeLimit(instance.config.autoMode?.timeLimit || '30m'),
                safeToolsOnly: instance.config.autoMode?.safeToolsOnly || true,
                allowWrite: instance.config.autoMode?.allowWrite || false,
                backoffMultiplier: 2,
                maxRetries: 3
            };
            const finalPolicy = { ...defaultPolicy, ...policy };
            const autoRunner = new auto_runner_1.AutoRunner(instance.agent, instance.config, finalPolicy);
            instance.autoRunner = autoRunner;
            instance.status = 'running';
            autoRunner.start();
            this.emit('agent.launched', { name: agentName, autoMode: true, policy: finalPolicy });
        }
        else {
            instance.status = 'running';
            this.emit('agent.launched', { name: agentName, autoMode: false });
        }
        return instance;
    }
    async pauseAgent(agentName) {
        const instance = this.instances.get(agentName);
        if (!instance) {
            throw new Error(`Agent '${agentName}' not found`);
        }
        if (instance.autoRunner) {
            await instance.autoRunner.pause();
        }
        instance.status = 'paused';
        this.emit('agent.paused', { name: agentName });
    }
    async resumeAgent(agentName) {
        const instance = this.instances.get(agentName);
        if (!instance) {
            throw new Error(`Agent '${agentName}' not found`);
        }
        if (instance.autoRunner) {
            await instance.autoRunner.resume();
        }
        instance.status = 'running';
        this.emit('agent.resumed', { name: agentName });
    }
    async stopAgent(agentName) {
        const instance = this.instances.get(agentName);
        if (!instance) {
            throw new Error(`Agent '${agentName}' not found`);
        }
        if (instance.autoRunner) {
            await instance.autoRunner.stop();
        }
        instance.status = 'stopped';
        this.emit('agent.stopped', { name: agentName });
    }
    async deleteAgent(agentName) {
        const instance = this.instances.get(agentName);
        if (instance) {
            await this.stopAgent(agentName);
            this.instances.delete(agentName);
        }
        await agent_persistence_1.agentPersistence.deleteAgent(agentName);
        this.emit('agent.deleted', { name: agentName });
    }
    async listAgents() {
        const agentNames = await agent_persistence_1.agentPersistence.listAgents();
        const results = [];
        for (const name of agentNames) {
            const info = await agent_persistence_1.agentPersistence.getAgentInfo(name);
            const instance = this.instances.get(name);
            results.push({
                name,
                profile: info.config?.profile || 'unknown',
                status: instance?.status || 'not-loaded',
                config: info.config,
                latestState: info.latestState
            });
        }
        return results;
    }
    async describeAgent(agentName) {
        const instance = this.instances.get(agentName);
        const info = await agent_persistence_1.agentPersistence.getAgentInfo(agentName);
        return {
            config: info.config,
            instance: instance || null,
            info
        };
    }
    showFactoryDashboard() {
        console.log(chalk_1.default.blue.bold('\n🏭 Unified Agent Factory Dashboard'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.cyan('\n📋 Available Profiles:'));
        for (const [name, profile] of this.profiles) {
            console.log(chalk_1.default.white(`  • ${name}: ${profile.description}`));
        }
        console.log(chalk_1.default.cyan('\n🤖 Active Agents:'));
        for (const [name, instance] of this.instances) {
            const statusIcon = this.getStatusIcon(instance.status);
            console.log(chalk_1.default.white(`  ${statusIcon} ${name} (${instance.config.profile}) - ${instance.status}`));
        }
        console.log(chalk_1.default.gray('\nUse /create-agent, /launch-agent, /list-agents for management'));
    }
    validateConfig(config) {
        const valid = this.validator.validate('agent-config', config);
        if (!valid) {
            const errors = this.validator.errorsText();
            throw new Error(`Invalid agent configuration: ${errors}`);
        }
    }
    registerDefaultProfiles() {
        this.registerProfile('researcher', {
            name: 'researcher',
            description: 'Research and analysis specialist',
            specialization: 'Research and Data Analysis',
            systemPrompt: `You are a research specialist focused on gathering, analyzing, and synthesizing information. 
      You excel at finding relevant data, evaluating sources, and presenting findings clearly.`,
            capabilities: ['web_search', 'data_analysis', 'report_writing', 'source_evaluation'],
            requiredTools: ['web_search', 'read_file', 'write_file'],
            personality: {
                proactive: 80,
                collaborative: 70,
                analytical: 95,
                creative: 60
            },
            defaultConfig: {
                autonomyLevel: 'fully-autonomous',
                contextScope: 'workspace',
                workingStyle: 'sequential'
            }
        }, (config, workingDirectory) => {
            const agent = new universal_agent_1.UniversalAgent(workingDirectory || process.cwd());
            agent.eventBus = agent['eventBus'] || {};
            agent.toolRegistry = agent['toolRegistry'] || {};
            agent.taskHistory = agent['taskHistory'] || [];
            agent.agentMetrics = agent['agentMetrics'] || {};
            return agent;
        });
        this.registerProfile('coder', {
            name: 'coder',
            description: 'Software development and coding expert',
            specialization: 'Software Development',
            systemPrompt: `You are a software development expert with deep knowledge of programming languages, 
      best practices, and software architecture. You excel at writing clean, efficient, and maintainable code.`,
            capabilities: ['code_generation', 'code_review', 'refactoring', 'testing', 'debugging'],
            requiredTools: ['read_file', 'write_file', 'run_command', 'git'],
            personality: {
                proactive: 85,
                collaborative: 75,
                analytical: 90,
                creative: 80
            },
            defaultConfig: {
                autonomyLevel: 'fully-autonomous',
                contextScope: 'project',
                workingStyle: 'adaptive'
            }
        }, (config, workingDirectory) => {
            return new coding_agent_1.CodingAgent(workingDirectory || process.cwd());
        });
        this.registerProfile('planner', {
            name: 'planner',
            description: 'Strategic planning and project management',
            specialization: 'Strategic Planning',
            systemPrompt: `You are a strategic planner and project manager. You excel at breaking down complex 
      projects into manageable tasks, creating timelines, and coordinating resources.`,
            capabilities: ['project_planning', 'task_breakdown', 'timeline_creation', 'resource_coordination'],
            requiredTools: ['read_file', 'write_file'],
            personality: {
                proactive: 90,
                collaborative: 85,
                analytical: 85,
                creative: 70
            },
            defaultConfig: {
                autonomyLevel: 'semi-autonomous',
                contextScope: 'project',
                workingStyle: 'sequential'
            }
        }, (config, workingDirectory) => {
            const agent = new universal_agent_1.UniversalAgent(workingDirectory || process.cwd());
            agent.eventBus = agent['eventBus'] || {};
            agent.toolRegistry = agent['toolRegistry'] || {};
            agent.taskHistory = agent['taskHistory'] || [];
            agent.agentMetrics = agent['agentMetrics'] || {};
            return agent;
        });
        this.registerProfile('tester', {
            name: 'tester',
            description: 'Quality assurance and testing specialist',
            specialization: 'Quality Assurance',
            systemPrompt: `You are a quality assurance specialist focused on testing, validation, and ensuring 
      software quality. You excel at creating test plans, executing tests, and reporting issues.`,
            capabilities: ['test_planning', 'test_execution', 'bug_reporting', 'quality_assurance'],
            requiredTools: ['read_file', 'write_file', 'run_command'],
            personality: {
                proactive: 75,
                collaborative: 80,
                analytical: 90,
                creative: 65
            },
            defaultConfig: {
                autonomyLevel: 'semi-autonomous',
                contextScope: 'project',
                workingStyle: 'sequential'
            }
        }, (config, workingDirectory) => {
            return new code_review_agent_1.CodeReviewAgent(workingDirectory || process.cwd());
        });
        this.registerProfile('devops', {
            name: 'devops',
            description: 'DevOps and infrastructure specialist',
            specialization: 'DevOps and Infrastructure',
            systemPrompt: `You are a DevOps specialist focused on automation, infrastructure, and deployment. 
      You excel at CI/CD pipelines, containerization, and infrastructure as code.`,
            capabilities: ['ci_cd', 'containerization', 'infrastructure_as_code', 'monitoring', 'automation'],
            requiredTools: ['run_command', 'read_file', 'write_file', 'docker'],
            personality: {
                proactive: 85,
                collaborative: 80,
                analytical: 85,
                creative: 75
            },
            defaultConfig: {
                autonomyLevel: 'fully-autonomous',
                contextScope: 'project',
                workingStyle: 'parallel'
            }
        }, (config, workingDirectory) => {
            return new devops_agent_1.DevOpsAgent(workingDirectory || process.cwd());
        });
    }
    parseTimeLimit(timeLimit) {
        const match = timeLimit.match(/^(\d+)([mh])$/);
        if (!match) {
            throw new Error(`Invalid time limit format: ${timeLimit}. Use format like '30m' or '2h'`);
        }
        const value = parseInt(match[1]);
        const unit = match[2];
        if (unit === 'm') {
            return value * 60 * 1000;
        }
        else if (unit === 'h') {
            return value * 60 * 60 * 1000;
        }
        throw new Error(`Unsupported time unit: ${unit}`);
    }
    getStatusIcon(status) {
        switch (status) {
            case 'running': return '🟢';
            case 'paused': return '🟡';
            case 'stopped': return '🔴';
            case 'error': return '❌';
            default: return '⚪';
        }
    }
    get availableProfiles() {
        return Array.from(this.profiles.keys());
    }
    get activeAgents() {
        return Array.from(this.instances.keys());
    }
}
exports.UnifiedAgentFactory = UnifiedAgentFactory;
exports.unifiedAgentFactory = new UnifiedAgentFactory();
