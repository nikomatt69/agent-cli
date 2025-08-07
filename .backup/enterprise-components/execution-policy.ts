import { ConfigManager, CliConfig } from '../config/config-manager';
import { logger } from '../utils/logger';

export type ApprovalPolicy = 'never' | 'untrusted' | 'on-failure' | 'always';
export type SandboxPolicy = 'read-only' | 'workspace-write' | 'system-write' | 'danger-full-access';

export interface ExecutionPolicy {
  approval: ApprovalPolicy;
  sandbox: SandboxPolicy;
  timeoutMs: number;
  maxRetries: number;
}

export interface CommandPolicy {
  command: string;
  allowed: boolean;
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  sandbox: SandboxPolicy[];
}

export class ExecutionPolicyManager {
  private configManager: ConfigManager;
  private trustedCommands = new Set(['ls', 'cat', 'pwd', 'echo', 'which', 'whoami']);
  private dangerousCommands = new Set(['rm -rf', 'sudo', 'su', 'chmod 777', 'dd', 'mkfs']);
  private commandPolicies = new Map<string, CommandPolicy>();

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.initializeCommandPolicies();
  }

  async getPolicy(): Promise<ExecutionPolicy> {
    const cfg: CliConfig = await this.configManager.load();
    return {
      approval: cfg.approvalPolicy || 'untrusted',
      sandbox: cfg.sandbox || 'workspace-write',
      timeoutMs: cfg.defaultAgentTimeout || 300000,
      maxRetries: 3
    };
  }

  async shouldAskForApproval(command: string, exitCode?: number): Promise<boolean> {
    const { approval } = await this.getPolicy();
    const cmdName = command.split(/\s+/)[0];
    const isTrusted = this.trustedCommands.has(cmdName);
    if (approval === 'never') return false;
    if (approval === 'untrusted') return !isTrusted;
    if (approval === 'on-failure') return exitCode !== undefined && exitCode !== 0;
    return true;
  }

  async allowWorkspaceWrite(): Promise<boolean> {
    const { sandbox } = await this.getPolicy();
    return sandbox === 'workspace-write' || sandbox === 'danger-full-access';
  }

  async allowGlobalWrite(): Promise<boolean> {
    const { sandbox } = await this.getPolicy();
    return sandbox === 'system-write' || sandbox === 'danger-full-access';
  }

  /**
   * Initialize command policies
   */
  private initializeCommandPolicies(): void {
    // Safe commands
    const safeCommands = ['ls', 'cat', 'pwd', 'echo', 'which', 'whoami', 'date', 'env'];
    safeCommands.forEach(cmd => {
      this.commandPolicies.set(cmd, {
        command: cmd,
        allowed: true,
        requiresApproval: false,
        riskLevel: 'low',
        sandbox: ['read-only', 'workspace-write', 'system-write', 'danger-full-access']
      });
    });

    // Development commands
    const devCommands = ['npm', 'yarn', 'git', 'node', 'tsc', 'jest'];
    devCommands.forEach(cmd => {
      this.commandPolicies.set(cmd, {
        command: cmd,
        allowed: true,
        requiresApproval: false,
        riskLevel: 'medium',
        sandbox: ['workspace-write', 'system-write', 'danger-full-access']
      });
    });

    // System commands
    const systemCommands = ['chmod', 'chown', 'cp', 'mv', 'mkdir', 'rmdir'];
    systemCommands.forEach(cmd => {
      this.commandPolicies.set(cmd, {
        command: cmd,
        allowed: true,
        requiresApproval: true,
        riskLevel: 'medium',
        sandbox: ['system-write', 'danger-full-access']
      });
    });

    // Dangerous commands
    const dangerousCommands = ['rm', 'sudo', 'su', 'dd', 'mkfs', 'fdisk'];
    dangerousCommands.forEach(cmd => {
      this.commandPolicies.set(cmd, {
        command: cmd,
        allowed: false,
        requiresApproval: true,
        riskLevel: 'high',
        sandbox: ['danger-full-access']
      });
    });
  }

  /**
   * Get command policy
   */
  getCommandPolicy(command: string): CommandPolicy | null {
    const cmdName = command.split(/\s+/)[0];
    return this.commandPolicies.get(cmdName) || null;
  }

  /**
   * Check if command is allowed in current sandbox
   */
  async isCommandAllowed(command: string): Promise<boolean> {
    const policy = this.getCommandPolicy(command);
    const { sandbox } = await this.getPolicy();

    if (!policy) {
      // Unknown command - apply default policy based on sandbox
      switch (sandbox) {
        case 'read-only':
          return this.trustedCommands.has(command.split(/\s+/)[0]);
        case 'workspace-write':
        case 'system-write':
          return !this.dangerousCommands.has(command);
        case 'danger-full-access':
          return true;
        default:
          return false;
      }
    }

    return policy.allowed && policy.sandbox.includes(sandbox);
  }

  /**
   * Evaluate command risk
   */
  async evaluateCommandRisk(command: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    reasons: string[];
    requiresApproval: boolean;
    allowed: boolean;
  }> {
    const policy = this.getCommandPolicy(command);
    const { sandbox, approval } = await this.getPolicy();
    
    const reasons: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let requiresApproval = false;
    let allowed = true;

    // Check if command exists in policy
    if (policy) {
      riskLevel = policy.riskLevel;
      requiresApproval = policy.requiresApproval;
      allowed = policy.allowed && policy.sandbox.includes(sandbox);
      
      if (!policy.sandbox.includes(sandbox)) {
        reasons.push(`Command not allowed in ${sandbox} sandbox`);
        allowed = false;
      }
    } else {
      // Unknown command evaluation
      const cmdName = command.split(/\s+/)[0];
      
      if (this.dangerousCommands.has(command) || this.dangerousCommands.has(cmdName)) {
        riskLevel = 'high';
        requiresApproval = true;
        allowed = sandbox === 'danger-full-access';
        reasons.push('Command identified as dangerous');
      } else if (!this.trustedCommands.has(cmdName)) {
        riskLevel = 'medium';
        requiresApproval = approval === 'untrusted' || approval === 'always';
        reasons.push('Unknown command');
      }
    }

    // Apply approval policy
    if (approval === 'always') {
      requiresApproval = true;
      reasons.push('Always require approval policy active');
    } else if (approval === 'never') {
      requiresApproval = false;
    }

    return {
      riskLevel,
      reasons,
      requiresApproval,
      allowed
    };
  }

  /**
   * Log policy decision for audit trail
   */
  async logPolicyDecision(
    command: string,
    decision: 'allowed' | 'denied' | 'requires_approval',
    context: Record<string, any> = {}
  ): Promise<void> {
    await logger.audit('execution_policy_decision', {
      command,
      decision,
      timestamp: new Date().toISOString(),
      sandbox: (await this.getPolicy()).sandbox,
      approvalPolicy: (await this.getPolicy()).approval,
      ...context
    });
  }

  /**
   * Get policy summary for display
   */
  async getPolicySummary(): Promise<{
    currentPolicy: ExecutionPolicy;
    allowedCommands: number;
    deniedCommands: number;
    trustedCommands: string[];
    dangerousCommands: string[];
  }> {
    const policy = await this.getPolicy();
    const allowedCommands = Array.from(this.commandPolicies.values())
      .filter(p => p.allowed && p.sandbox.includes(policy.sandbox)).length;
    const deniedCommands = Array.from(this.commandPolicies.values())
      .filter(p => !p.allowed || !p.sandbox.includes(policy.sandbox)).length;

    return {
      currentPolicy: policy,
      allowedCommands,
      deniedCommands,
      trustedCommands: Array.from(this.trustedCommands),
      dangerousCommands: Array.from(this.dangerousCommands)
    };
  }
}
