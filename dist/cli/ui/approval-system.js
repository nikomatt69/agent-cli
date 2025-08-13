"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalSystem = exports.ApprovalSystem = void 0;
const chalk_1 = __importDefault(require("chalk"));
const inquirer_1 = __importDefault(require("inquirer"));
const boxen_1 = __importDefault(require("boxen"));
const diff_viewer_1 = require("./diff-viewer");
class ApprovalSystem {
    constructor(config = {}) {
        this.pendingRequests = new Map();
        this.config = {
            autoApprove: {
                lowRisk: false,
                mediumRisk: false,
                fileOperations: false,
                packageInstalls: false,
            },
            requireConfirmation: {
                destructiveOperations: true,
                networkRequests: true,
                systemCommands: true,
            },
            timeout: 60000,
            ...config,
        };
    }
    async requestApproval(request) {
        this.pendingRequests.set(request.id, request);
        try {
            if (this.shouldAutoApprove(request)) {
                console.log(chalk_1.default.green(`✓ Auto-approved: ${request.title} (${request.riskLevel} risk)`));
                return {
                    approved: true,
                    timestamp: new Date(),
                };
            }
            this.displayApprovalRequest(request);
            const response = await this.promptForApproval(request);
            return response;
        }
        finally {
            this.pendingRequests.delete(request.id);
        }
    }
    async quickApproval(title, description, riskLevel = 'medium') {
        const request = {
            id: `quick-${Date.now()}`,
            title,
            description,
            riskLevel,
            actions: [],
        };
        const response = await this.requestApproval(request);
        return response.approved;
    }
    async requestFileApproval(title, fileDiffs, riskLevel = 'medium') {
        console.log(chalk_1.default.blue.bold(`\\n🔍 ${title}`));
        diff_viewer_1.DiffViewer.showMultiFileDiff(fileDiffs, { compact: true });
        const actions = fileDiffs.map(diff => ({
            type: diff.isNew ? 'file_create' : diff.isDeleted ? 'file_delete' : 'file_modify',
            description: `${diff.isNew ? 'Create' : diff.isDeleted ? 'Delete' : 'Modify'} ${diff.filePath}`,
            details: diff,
            riskLevel: diff.isDeleted ? 'high' : 'medium',
        }));
        const request = {
            id: `file-${Date.now()}`,
            title,
            description: `File operations on ${fileDiffs.length} files`,
            riskLevel,
            actions,
            context: {
                affectedFiles: fileDiffs.map(d => d.filePath),
            },
        };
        const response = await this.requestApproval(request);
        return response.approved;
    }
    async requestCommandApproval(command, args = [], workingDir) {
        const fullCommand = `${command} ${args.join(' ')}`;
        const riskLevel = this.assessCommandRisk(command, args);
        const request = {
            id: `cmd-${Date.now()}`,
            title: 'Execute Command',
            description: `Run: ${fullCommand}`,
            riskLevel,
            actions: [{
                    type: 'command_execute',
                    description: `Execute: ${fullCommand}`,
                    details: { command, args, workingDir },
                    riskLevel,
                }],
            context: {
                workingDirectory: workingDir,
            },
        };
        const response = await this.requestApproval(request);
        return response.approved;
    }
    async requestPackageApproval(packages, manager = 'npm', isGlobal = false) {
        const riskLevel = isGlobal ? 'high' : 'medium';
        const request = {
            id: `pkg-${Date.now()}`,
            title: 'Install Packages',
            description: `Install ${packages.length} package(s) with ${manager}${isGlobal ? ' (global)' : ''}`,
            riskLevel,
            actions: packages.map(pkg => ({
                type: 'package_install',
                description: `Install ${pkg}`,
                details: { package: pkg, manager, isGlobal },
                riskLevel,
            })),
        };
        const response = await this.requestApproval(request);
        return response.approved;
    }
    displayApprovalRequest(request) {
        const riskColor = this.getRiskColor(request.riskLevel);
        const riskIcon = this.getRiskIcon(request.riskLevel);
        console.log(chalk_1.default.gray('─'.repeat(60)));
        console.log();
        console.log((0, boxen_1.default)(`${riskIcon} ${chalk_1.default.bold(request.title)}\n\n` +
            `${chalk_1.default.gray('Description:')} ${request.description}\n` +
            `${chalk_1.default.gray('Risk Level:')} ${riskColor(request.riskLevel.toUpperCase())}\n` +
            `${chalk_1.default.gray('Actions:')} ${request.actions.length}`, {
            padding: 1,
            margin: { top: 0, bottom: 1, left: 0, right: 0 },
            borderStyle: 'round',
            borderColor: request.riskLevel === 'critical' ? 'red' :
                request.riskLevel === 'high' ? 'yellow' : 'blue',
        }));
        if (request.actions.length > 0) {
            console.log(chalk_1.default.blue.bold('\n📋 Planned Actions:'));
            request.actions.forEach((action, index) => {
                const actionRisk = this.getRiskColor(action.riskLevel);
                const actionIcon = this.getActionIcon(action.type);
                console.log(`  ${index + 1}. ${actionIcon} ${action.description} ${actionRisk(`[${action.riskLevel}]`)}`);
            });
        }
        if (request.context) {
            console.log(chalk_1.default.blue.bold('\n🔍 Context:'));
            if (request.context.workingDirectory) {
                console.log(`  📁 Working Directory: ${request.context.workingDirectory}`);
            }
            if (request.context.affectedFiles && request.context.affectedFiles.length > 0) {
                console.log(`  📄 Affected Files: ${request.context.affectedFiles.length}`);
                request.context.affectedFiles.slice(0, 5).forEach(file => {
                    console.log(`     • ${file}`);
                });
                if (request.context.affectedFiles.length > 5) {
                    console.log(`     ... and ${request.context.affectedFiles.length - 5} more files`);
                }
            }
            if (request.context.estimatedDuration) {
                console.log(`  ⏱️  Estimated Duration: ${Math.round(request.context.estimatedDuration / 1000)}s`);
            }
        }
    }
    async promptForApproval(request) {
        console.log();
        const questions = [
            {
                type: 'confirm',
                name: 'approved',
                message: chalk_1.default.cyan.bold('\n❓ Do you approve this operation?'),
                default: request.riskLevel === 'low',
                prefix: '  ',
            },
        ];
        if (request.riskLevel === 'critical' || request.riskLevel === 'high') {
            questions.push({
                type: 'confirm',
                name: 'confirmHighRisk',
                message: chalk_1.default.red.bold('⚠️  This is a high-risk operation. Are you absolutely sure?'),
                default: false,
                prefix: '  ',
                when: (answers) => answers.approved,
            });
        }
        if (request.actions.length > 3) {
            questions.push({
                type: 'input',
                name: 'userComments',
                message: 'Add any comments (optional):',
                when: (answers) => answers.approved,
            });
        }
        try {
            const answers = await inquirer_1.default.prompt(questions);
            const approved = answers.approved && (answers.confirmHighRisk !== false);
            console.log();
            if (approved) {
                console.log(chalk_1.default.green.bold('✅ Operation approved'));
            }
            else {
                console.log(chalk_1.default.yellow.bold('❌ Operation cancelled'));
            }
            console.log();
            return {
                approved,
                userComments: answers.userComments,
                timestamp: new Date(),
            };
        }
        catch (error) {
            console.log(chalk_1.default.red('\n❌ Operation cancelled by user'));
            return {
                approved: false,
                timestamp: new Date(),
            };
        }
    }
    shouldAutoApprove(request) {
        const config = this.config.autoApprove;
        if (!config)
            return false;
        if (request.riskLevel === 'low' && config.lowRisk)
            return true;
        if (request.riskLevel === 'medium' && config.mediumRisk)
            return true;
        const hasFileOps = request.actions.some(a => ['file_create', 'file_modify', 'file_delete'].includes(a.type));
        if (hasFileOps && config.fileOperations)
            return true;
        const hasPackageInstalls = request.actions.some(a => a.type === 'package_install');
        if (hasPackageInstalls && config.packageInstalls)
            return true;
        return false;
    }
    assessCommandRisk(command, args) {
        const cmd = command.toLowerCase();
        const fullCommand = `${cmd} ${args.join(' ')}`.toLowerCase();
        const criticalCommands = ['rm -rf', 'sudo rm', 'format', 'fdisk', 'dd'];
        if (criticalCommands.some(dangerous => fullCommand.includes(dangerous))) {
            return 'critical';
        }
        const highRiskCommands = ['rm', 'del', 'sudo', 'chmod 777', 'chown'];
        if (highRiskCommands.some(risky => fullCommand.includes(risky))) {
            return 'high';
        }
        const mediumRiskCommands = ['npm install -g', 'yarn global', 'pip install', 'docker run'];
        if (mediumRiskCommands.some(medium => fullCommand.includes(medium))) {
            return 'medium';
        }
        const networkCommands = ['curl', 'wget', 'fetch', 'http'];
        if (networkCommands.some(net => cmd.includes(net))) {
            return 'medium';
        }
        return 'low';
    }
    getRiskColor(risk) {
        switch (risk) {
            case 'critical': return chalk_1.default.red.bold;
            case 'high': return chalk_1.default.red;
            case 'medium': return chalk_1.default.yellow;
            case 'low': return chalk_1.default.green;
            default: return chalk_1.default.gray;
        }
    }
    getRiskIcon(risk) {
        switch (risk) {
            case 'critical': return '🚨';
            case 'high': return '⚠️';
            case 'medium': return '⚡';
            case 'low': return 'ℹ️';
            default: return '📋';
        }
    }
    getActionIcon(type) {
        switch (type) {
            case 'file_create': return '📄';
            case 'file_modify': return '✏️';
            case 'file_delete': return '🗑️';
            case 'command_execute': return '⚡';
            case 'package_install': return '📦';
            case 'network_request': return '🌐';
            default: return '🔧';
        }
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    getConfig() {
        return { ...this.config };
    }
}
exports.ApprovalSystem = ApprovalSystem;
exports.approvalSystem = new ApprovalSystem();
