import chalk from 'chalk';
import inquirer from 'inquirer';
import boxen from 'boxen';
import { DiffViewer, FileDiff } from './diff-viewer';

export interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  actions: ApprovalAction[];
  context?: {
    workingDirectory?: string;
    affectedFiles?: string[];
    estimatedDuration?: number;
  };
  timeout?: number; // milliseconds
}

export interface ApprovalAction {
  type: 'file_create' | 'file_modify' | 'file_delete' | 'command_execute' | 'package_install' | 'network_request';
  description: string;
  details: any;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ApprovalResponse {
  approved: boolean;
  modifiedActions?: string[]; // IDs of actions to skip
  userComments?: string;
  timestamp: Date;
}

export interface ApprovalConfig {
  autoApprove?: {
    lowRisk?: boolean;
    mediumRisk?: boolean;
    fileOperations?: boolean;
    packageInstalls?: boolean;
  };
  requireConfirmation?: {
    destructiveOperations?: boolean;
    networkRequests?: boolean;
    systemCommands?: boolean;
  };
  timeout?: number; // Default timeout in milliseconds
}

export class ApprovalSystem {
  private config: ApprovalConfig;
  private pendingRequests: Map<string, ApprovalRequest> = new Map();

  constructor(config: ApprovalConfig = {}) {
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
      timeout: 60000, // 1 minute default
      ...config,
    };
  }

  /**
   * Request approval for a set of actions
   */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    this.pendingRequests.set(request.id, request);

    try {
      // Check if auto-approval is enabled for this type
      if (this.shouldAutoApprove(request)) {
        console.log(chalk.green(`✓ Auto-approved: ${request.title} (${request.riskLevel} risk)`));
        return {
          approved: true,
          timestamp: new Date(),
        };
      }

      // Show request details
      this.displayApprovalRequest(request);

      // Get user input
      const response = await this.promptForApproval(request);

      return response;
    } finally {
      this.pendingRequests.delete(request.id);
    }
  }

  /**
   * Quick approval for simple operations
   */
  async quickApproval(
    title: string, 
    description: string, 
    riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<boolean> {
    const request: ApprovalRequest = {
      id: `quick-${Date.now()}`,
      title,
      description,
      riskLevel,
      actions: [],
    };

    const response = await this.requestApproval(request);
    return response.approved;
  }

  /**
   * Request approval for file operations with diff preview
   */
  async requestFileApproval(
    title: string,
    fileDiffs: FileDiff[],
    riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<boolean> {
    console.log(chalk.blue.bold(`\\n🔍 ${title}`));
    
    // Show file diffs
    DiffViewer.showMultiFileDiff(fileDiffs, { compact: true });
    
    const actions: ApprovalAction[] = fileDiffs.map(diff => ({
      type: diff.isNew ? 'file_create' : diff.isDeleted ? 'file_delete' : 'file_modify',
      description: `${diff.isNew ? 'Create' : diff.isDeleted ? 'Delete' : 'Modify'} ${diff.filePath}`,
      details: diff,
      riskLevel: diff.isDeleted ? 'high' : 'medium',
    }));

    const request: ApprovalRequest = {
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

  /**
   * Request approval for command execution
   */
  async requestCommandApproval(
    command: string,
    args: string[] = [],
    workingDir?: string
  ): Promise<boolean> {
    const fullCommand = `${command} ${args.join(' ')}`;
    
    // Assess risk level based on command
    const riskLevel = this.assessCommandRisk(command, args);
    
    const request: ApprovalRequest = {
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

  /**
   * Request approval for package installation
   */
  async requestPackageApproval(
    packages: string[],
    manager: 'npm' | 'yarn' | 'pnpm' = 'npm',
    isGlobal: boolean = false
  ): Promise<boolean> {
    const riskLevel = isGlobal ? 'high' : 'medium';
    
    const request: ApprovalRequest = {
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

  /**
   * Display approval request to user
   */
  private displayApprovalRequest(request: ApprovalRequest): void {
    const riskColor = this.getRiskColor(request.riskLevel);
    const riskIcon = this.getRiskIcon(request.riskLevel);
    
    console.log(boxen(
      `${riskIcon} ${chalk.bold(request.title)}\\n\\n` +
      `${chalk.gray('Description:')} ${request.description}\\n` +
      `${chalk.gray('Risk Level:')} ${riskColor(request.riskLevel.toUpperCase())}\\n` +
      `${chalk.gray('Actions:')} ${request.actions.length}`,
      {
        padding: 1,
        margin: { top: 1, bottom: 0, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: request.riskLevel === 'critical' ? 'red' : 
                    request.riskLevel === 'high' ? 'yellow' : 'blue',
      }
    ));

    // Show detailed actions
    if (request.actions.length > 0) {
      console.log(chalk.blue.bold('\\n📋 Planned Actions:'));
      request.actions.forEach((action, index) => {
        const actionRisk = this.getRiskColor(action.riskLevel);
        const actionIcon = this.getActionIcon(action.type);
        
        console.log(`  ${index + 1}. ${actionIcon} ${action.description} ${actionRisk(`[${action.riskLevel}]`)}`);
      });
    }

    // Show context if available
    if (request.context) {
      console.log(chalk.blue.bold('\\n🔍 Context:'));
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

  /**
   * Prompt user for approval
   */
  private async promptForApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    const questions: any[] = [
      {
        type: 'confirm',
        name: 'approved',
        message: chalk.cyan('Do you approve this operation?'),
        default: request.riskLevel === 'low',
      },
    ];

    // For high-risk operations, ask for additional confirmation
    if (request.riskLevel === 'critical' || request.riskLevel === 'high') {
      questions.push({
        type: 'confirm',
        name: 'confirmHighRisk',
        message: chalk.red('This is a high-risk operation. Are you sure?'),
        default: false,
        when: (answers: any) => answers.approved,
      });
    }

    // Option to add comments for complex operations
    if (request.actions.length > 3) {
      questions.push({
        type: 'input',
        name: 'userComments',
        message: 'Add any comments (optional):',
        when: (answers: any) => answers.approved,
      });
    }

    try {
      const answers = await inquirer.prompt(questions);
      
      const approved = answers.approved && (answers.confirmHighRisk !== false);
      
      if (approved) {
        console.log(chalk.green('✅ Operation approved'));
      } else {
        console.log(chalk.yellow('❌ Operation cancelled'));
      }

      return {
        approved,
        userComments: answers.userComments,
        timestamp: new Date(),
      };
    } catch (error) {
      // Handle Ctrl+C or other interruption
      console.log(chalk.red('\\n❌ Operation cancelled by user'));
      return {
        approved: false,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check if operation should be auto-approved
   */
  private shouldAutoApprove(request: ApprovalRequest): boolean {
    const config = this.config.autoApprove;
    
    if (!config) return false;

    // Check risk level auto-approval
    if (request.riskLevel === 'low' && config.lowRisk) return true;
    if (request.riskLevel === 'medium' && config.mediumRisk) return true;

    // Check specific operation types
    const hasFileOps = request.actions.some(a => 
      ['file_create', 'file_modify', 'file_delete'].includes(a.type)
    );
    if (hasFileOps && config.fileOperations) return true;

    const hasPackageInstalls = request.actions.some(a => a.type === 'package_install');
    if (hasPackageInstalls && config.packageInstalls) return true;

    return false;
  }

  /**
   * Assess command risk level
   */
  private assessCommandRisk(command: string, args: string[]): 'low' | 'medium' | 'high' | 'critical' {
    const cmd = command.toLowerCase();
    const fullCommand = `${cmd} ${args.join(' ')}`.toLowerCase();

    // Critical risk commands
    const criticalCommands = ['rm -rf', 'sudo rm', 'format', 'fdisk', 'dd'];
    if (criticalCommands.some(dangerous => fullCommand.includes(dangerous))) {
      return 'critical';
    }

    // High risk commands
    const highRiskCommands = ['rm', 'del', 'sudo', 'chmod 777', 'chown'];
    if (highRiskCommands.some(risky => fullCommand.includes(risky))) {
      return 'high';
    }

    // Medium risk commands
    const mediumRiskCommands = ['npm install -g', 'yarn global', 'pip install', 'docker run'];
    if (mediumRiskCommands.some(medium => fullCommand.includes(medium))) {
      return 'medium';
    }

    // Network commands
    const networkCommands = ['curl', 'wget', 'fetch', 'http'];
    if (networkCommands.some(net => cmd.includes(net))) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get color for risk level
   */
  private getRiskColor(risk: string): any {
    switch (risk) {
      case 'critical': return chalk.red.bold;
      case 'high': return chalk.red;
      case 'medium': return chalk.yellow;
      case 'low': return chalk.green;
      default: return chalk.gray;
    }
  }

  /**
   * Get icon for risk level
   */
  private getRiskIcon(risk: string): string {
    switch (risk) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📋';
    }
  }

  /**
   * Get icon for action type
   */
  private getActionIcon(type: string): string {
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

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ApprovalConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ApprovalConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const approvalSystem = new ApprovalSystem();
