"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanGenerator = void 0;
const nanoid_1 = require("nanoid");
const cli_ui_1 = require("../utils/cli-ui");
class PlanGenerator {
    constructor() {
        this.toolCapabilities = new Map();
        this.initializeToolCapabilities();
    }
    async generatePlan(context) {
        cli_ui_1.CliUI.startSpinner('Analyzing request and generating execution plan...');
        try {
            const requestAnalysis = this.analyzeUserRequest(context.userRequest);
            const steps = await this.generateSteps(requestAnalysis, context);
            const riskAssessment = this.assessPlanRisk(steps);
            const estimatedTotalDuration = steps.reduce((total, step) => total + (step.estimatedDuration || 0), 0);
            const plan = {
                id: (0, nanoid_1.nanoid)(),
                title: this.generatePlanTitle(requestAnalysis),
                description: this.generatePlanDescription(requestAnalysis, steps),
                steps,
                todos: [],
                status: 'pending',
                estimatedTotalDuration,
                riskAssessment,
                createdAt: new Date(),
                createdBy: 'ai-planner',
                context: {
                    userRequest: context.userRequest,
                    projectPath: context.projectPath,
                    relevantFiles: context.projectAnalysis ? [] : undefined
                }
            };
            cli_ui_1.CliUI.succeedSpinner('Execution plan generated successfully');
            return plan;
        }
        catch (error) {
            cli_ui_1.CliUI.failSpinner('Failed to generate execution plan');
            throw new Error(`Plan generation failed: ${error.message}`);
        }
    }
    validatePlan(plan) {
        const errors = [];
        const warnings = [];
        const suggestions = [];
        if (this.hasCircularDependencies(plan.steps)) {
            errors.push('Plan contains circular dependencies between steps');
        }
        for (const step of plan.steps) {
            if (step.type === 'tool' && step.toolName) {
                if (!this.toolCapabilities.has(step.toolName)) {
                    errors.push(`Unknown tool: ${step.toolName}`);
                }
            }
        }
        if (plan.riskAssessment.overallRisk === 'high') {
            warnings.push('Plan contains high-risk operations');
        }
        if (plan.riskAssessment.destructiveOperations > 0) {
            warnings.push(`Plan includes ${plan.riskAssessment.destructiveOperations} potentially destructive operations`);
        }
        if (plan.estimatedTotalDuration > 300000) {
            suggestions.push('Consider breaking this plan into smaller, more manageable chunks');
        }
        if (plan.steps.length > 20) {
            suggestions.push('Plan has many steps - consider consolidating similar operations');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            suggestions
        };
    }
    analyzeUserRequest(request) {
        const lowerRequest = request.toLowerCase();
        const operations = [];
        const entities = [];
        const modifiers = [];
        if (lowerRequest.includes('create') || lowerRequest.includes('add')) {
            operations.push('create');
        }
        if (lowerRequest.includes('update') || lowerRequest.includes('modify') || lowerRequest.includes('change')) {
            operations.push('update');
        }
        if (lowerRequest.includes('delete') || lowerRequest.includes('remove')) {
            operations.push('delete');
        }
        if (lowerRequest.includes('read') || lowerRequest.includes('show') || lowerRequest.includes('list')) {
            operations.push('read');
        }
        if (lowerRequest.includes('file') || lowerRequest.includes('component') || lowerRequest.includes('class')) {
            entities.push('file');
        }
        if (lowerRequest.includes('test') || lowerRequest.includes('spec')) {
            entities.push('test');
        }
        if (lowerRequest.includes('documentation') || lowerRequest.includes('readme')) {
            entities.push('documentation');
        }
        const complexity = this.assessRequestComplexity(lowerRequest);
        return {
            originalRequest: request,
            operations,
            entities,
            modifiers,
            complexity,
            requiresFileSystem: operations.some(op => ['create', 'update', 'delete'].includes(op)),
            requiresAnalysis: lowerRequest.includes('analyze') || lowerRequest.includes('review'),
            requiresUserInput: lowerRequest.includes('ask') || lowerRequest.includes('confirm')
        };
    }
    async generateSteps(analysis, context) {
        const steps = [];
        steps.push({
            id: (0, nanoid_1.nanoid)(),
            type: 'validation',
            title: 'Validate Request',
            description: 'Validate user request and check prerequisites',
            estimatedDuration: 2000,
            riskLevel: 'low',
            reversible: true
        });
        if (analysis.requiresAnalysis) {
            steps.push({
                id: (0, nanoid_1.nanoid)(),
                type: 'tool',
                title: 'Analyze Project',
                description: 'Analyze current project structure and relevant files',
                toolName: 'find-files-tool',
                toolArgs: { pattern: '**/*', options: { cwd: context.projectPath } },
                estimatedDuration: 5000,
                riskLevel: 'low',
                reversible: true,
                dependencies: [steps[0].id]
            });
        }
        for (const operation of analysis.operations) {
            const operationSteps = this.generateOperationSteps(operation, analysis, context);
            steps.push(...operationSteps);
        }
        const hasHighRiskSteps = steps.some(step => step.riskLevel === 'high');
        if (hasHighRiskSteps) {
            const confirmationStep = {
                id: (0, nanoid_1.nanoid)(),
                type: 'user_input',
                title: 'Confirm High-Risk Operations',
                description: 'User confirmation required for potentially destructive operations',
                estimatedDuration: 10000,
                riskLevel: 'low',
                reversible: true,
                dependencies: steps.slice(0, -1).map(s => s.id)
            };
            const lastHighRiskIndex = this.findLastIndex(steps, (step) => step.riskLevel === 'high');
            if (lastHighRiskIndex >= 0) {
                steps.splice(lastHighRiskIndex, 0, confirmationStep);
            }
        }
        steps.push({
            id: (0, nanoid_1.nanoid)(),
            type: 'validation',
            title: 'Verify Results',
            description: 'Verify that all operations completed successfully',
            estimatedDuration: 3000,
            riskLevel: 'low',
            reversible: true,
            dependencies: steps.slice(-2, -1).map(s => s.id)
        });
        return steps;
    }
    generateOperationSteps(operation, analysis, context) {
        const steps = [];
        switch (operation) {
            case 'create':
                steps.push({
                    id: (0, nanoid_1.nanoid)(),
                    type: 'tool',
                    title: 'Create Files',
                    description: `Create new ${analysis.entities.join(', ')} files`,
                    toolName: 'write-file-tool',
                    estimatedDuration: 8000,
                    riskLevel: 'medium',
                    reversible: true
                });
                break;
            case 'update':
                steps.push({
                    id: (0, nanoid_1.nanoid)(),
                    type: 'tool',
                    title: 'Update Files',
                    description: `Update existing ${analysis.entities.join(', ')} files`,
                    toolName: 'replace-in-file-tool',
                    estimatedDuration: 6000,
                    riskLevel: 'medium',
                    reversible: false
                });
                break;
            case 'delete':
                steps.push({
                    id: (0, nanoid_1.nanoid)(),
                    type: 'tool',
                    title: 'Delete Files',
                    description: `Delete ${analysis.entities.join(', ')} files`,
                    toolName: 'delete-file-tool',
                    estimatedDuration: 3000,
                    riskLevel: 'high',
                    reversible: false
                });
                break;
            case 'read':
                steps.push({
                    id: (0, nanoid_1.nanoid)(),
                    type: 'tool',
                    title: 'Read Files',
                    description: `Read and analyze ${analysis.entities.join(', ')} files`,
                    toolName: 'read-file-tool',
                    estimatedDuration: 4000,
                    riskLevel: 'low',
                    reversible: true
                });
                break;
        }
        return steps;
    }
    assessPlanRisk(steps) {
        const destructiveOperations = steps.filter(s => !s.reversible).length;
        const fileModifications = steps.filter(s => s.toolName?.includes('write') || s.toolName?.includes('delete') || s.toolName?.includes('replace')).length;
        const externalCalls = steps.filter(s => s.toolName?.includes('api') || s.toolName?.includes('network')).length;
        let overallRisk = 'low';
        if (destructiveOperations > 0 || steps.some(s => s.riskLevel === 'high')) {
            overallRisk = 'high';
        }
        else if (fileModifications > 2 || steps.some(s => s.riskLevel === 'medium')) {
            overallRisk = 'medium';
        }
        return {
            overallRisk,
            destructiveOperations,
            fileModifications,
            externalCalls
        };
    }
    hasCircularDependencies(steps) {
        const stepMap = new Map(steps.map(step => [step.id, step]));
        const visited = new Set();
        const recursionStack = new Set();
        const hasCycle = (stepId) => {
            if (recursionStack.has(stepId))
                return true;
            if (visited.has(stepId))
                return false;
            visited.add(stepId);
            recursionStack.add(stepId);
            const step = stepMap.get(stepId);
            if (step?.dependencies) {
                for (const depId of step.dependencies) {
                    if (hasCycle(depId))
                        return true;
                }
            }
            recursionStack.delete(stepId);
            return false;
        };
        return steps.some(step => hasCycle(step.id));
    }
    initializeToolCapabilities() {
        const tools = [
            {
                name: 'find-files-tool',
                description: 'Find files matching patterns',
                riskLevel: 'low',
                reversible: true,
                estimatedDuration: 3000,
                requiredArgs: ['pattern'],
                optionalArgs: ['options']
            },
            {
                name: 'read-file-tool',
                description: 'Read file contents',
                riskLevel: 'low',
                reversible: true,
                estimatedDuration: 2000,
                requiredArgs: ['filePath'],
                optionalArgs: []
            },
            {
                name: 'write-file-tool',
                description: 'Write content to file',
                riskLevel: 'medium',
                reversible: true,
                estimatedDuration: 4000,
                requiredArgs: ['filePath', 'content'],
                optionalArgs: []
            },
            {
                name: 'replace-in-file-tool',
                description: 'Replace content in existing file',
                riskLevel: 'medium',
                reversible: false,
                estimatedDuration: 3000,
                requiredArgs: ['filePath', 'searchPattern', 'replacement'],
                optionalArgs: []
            },
            {
                name: 'delete-file-tool',
                description: 'Delete files or directories',
                riskLevel: 'high',
                reversible: false,
                estimatedDuration: 2000,
                requiredArgs: ['filePath'],
                optionalArgs: []
            }
        ];
        tools.forEach(tool => this.toolCapabilities.set(tool.name, tool));
    }
    generatePlanTitle(analysis) {
        const operations = analysis.operations.join(', ');
        const entities = analysis.entities.join(', ');
        if (operations && entities) {
            return `${operations.charAt(0).toUpperCase() + operations.slice(1)} ${entities}`;
        }
        else if (operations) {
            return `${operations.charAt(0).toUpperCase() + operations.slice(1)} Operation`;
        }
        else {
            return 'Custom Execution Plan';
        }
    }
    generatePlanDescription(analysis, steps) {
        const stepCount = steps.length;
        const riskLevel = steps.some(s => s.riskLevel === 'high') ? 'high' :
            steps.some(s => s.riskLevel === 'medium') ? 'medium' : 'low';
        return `Execution plan with ${stepCount} steps to fulfill: "${analysis.originalRequest}". Risk level: ${riskLevel}.`;
    }
    assessRequestComplexity(request) {
        const indicators = [
            request.includes('multiple'),
            request.includes('all'),
            request.includes('refactor'),
            request.includes('migrate'),
            request.includes('restructure'),
            request.split(' ').length > 10,
            (request.match(/and|or|then|also/g) || []).length > 2
        ];
        const complexityScore = indicators.filter(Boolean).length;
        if (complexityScore >= 4)
            return 'complex';
        if (complexityScore >= 2)
            return 'moderate';
        return 'simple';
    }
    findLastIndex(array, predicate) {
        for (let i = array.length - 1; i >= 0; i--) {
            if (predicate(array[i], i, array)) {
                return i;
            }
        }
        return -1;
    }
}
exports.PlanGenerator = PlanGenerator;
