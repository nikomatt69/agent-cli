import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';

import { unifiedAgentFactory } from '../core/unified-agent-factory';
import { agentPersistence } from '../persistence/agent-persistence';
import { AutoModePolicy } from '../automation/agents/auto-runner';

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export class AgentCommands {
  /**
   * Comando: create-agent
   * Crea un nuovo agente da profilo o configurazione
   */
  static async createAgent(args: string[]): Promise<CommandResult> {
    try {
      const options = this.parseCreateAgentArgs(args);
      
      if (options.help) {
        return {
          success: true,
          message: this.getCreateAgentHelp()
        };
      }

      if (!options.name) {
        return {
          success: false,
          message: 'Agent name is required. Use --name <name>',
          error: 'Agent name is required. Use --name <name>'
        };
      }

      // Valida il nome dell'agente secondo il pattern regex
      const namePattern = /^[a-zA-Z0-9_-]+$/;
      if (!namePattern.test(options.name)) {
        return {
          success: false,
          message: 'Invalid agent name. Use only letters, numbers, underscores, and hyphens.',
          error: 'Invalid agent configuration: name must match pattern ^[a-zA-Z0-9_-]+$'
        };
      }

      if (!options.profile && !options.config) {
        return {
          success: false,
          message: 'Either --profile or --config is required',
          error: 'Either --profile or --config is required'
        };
      }

      let instance;
      
      if (options.config) {
        // Crea da file di configurazione
        const configData = await fs.readFile(options.config, 'utf-8');
        const config = JSON.parse(configData);
        instance = await unifiedAgentFactory.createAgent(config);
      } else {
        // Crea da profilo
        instance = await unifiedAgentFactory.createAgentFromProfile(
          options.profile!,
          options.name,
          options.overrides
        );
      }

      return {
        success: true,
        message: `✅ Agent '${options.name}' created successfully`,
        data: {
          name: instance.config.name,
          profile: instance.config.profile,
          status: instance.status
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to create agent: ${error.message}`,
        error: `Failed to create agent: ${error.message}`
      };
    }
  }

  /**
   * Comando: launch-agent
   * Avvia un agente in modalità auto o interattiva
   */
  static async launchAgent(args: string[]): Promise<CommandResult> {
    try {
      const options = this.parseLaunchAgentArgs(args);
      
      if (options.help) {
        return {
          success: true,
          message: this.getLaunchAgentHelp()
        };
      }

      if (!options.name) {
        return {
          success: false,
          message: 'Agent name is required. Use --name <name>',
          error: 'Agent name is required. Use --name <name>'
        };
      }

      // Verifica che l'agente esista
      const exists = await agentPersistence.agentExists(options.name);
      if (!exists) {
        return {
          success: false,
          message: `Agent '${options.name}' not found. Use create-agent first.`,
          error: `Agent '${options.name}' not found. Use create-agent first.`
        };
      }

      // Carica l'agente se non è già caricato
      const info = await unifiedAgentFactory.describeAgent(options.name);
      if (!info.instance) {
        // Ricrea l'istanza dall'ultima configurazione
        if (info.config) {
          await unifiedAgentFactory.createAgent(info.config);
        } else {
          return {
            success: false,
            message: `No configuration found for agent '${options.name}'`,
            error: `No configuration found for agent '${options.name}'`
          };
        }
      }

      // Prepara la policy per modalità auto
      let policy: Partial<AutoModePolicy> | undefined;
      if (options.auto) {
        policy = {
          maxSteps: options.maxSteps,
          maxTokens: options.maxTokens,
          maxCost: options.maxCost,
          timeLimit: options.timeLimit ? this.parseTimeLimit(options.timeLimit) : undefined,
          safeToolsOnly: options.safeToolsOnly,
          allowWrite: options.allowWrite
        };
      }

      // Avvia l'agente
      const instance = await unifiedAgentFactory.launchAgent(
        options.name,
        options.auto,
        policy
      );

      const mode = options.auto ? 'auto' : 'interactive';
      return {
        success: true,
        message: `✅ Agent '${options.name}' launched in ${mode} mode`,
        data: {
          name: instance.config.name,
          status: instance.status,
          autoMode: options.auto
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to launch agent: ${error.message}`,
        error: `Failed to launch agent: ${error.message}`
      };
    }
  }

  /**
   * Comando: list-agents
   * Lista tutti gli agenti con il loro stato
   */
  static async listAgents(args: string[]): Promise<CommandResult> {
    try {
      const options = this.parseListAgentsArgs(args);
      
      if (options.help) {
        return {
          success: true,
          message: this.getListAgentsHelp()
        };
      }

      const agents = await unifiedAgentFactory.listAgents();

      if (options.json) {
        return {
          success: true,
          message: 'Agents listed successfully',
          data: agents
        };
      }

      // Formato tabella
      const table = this.formatAgentsTable(agents);
      return {
        success: true,
        message: table
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to list agents: ${error.message}`,
        error: `Failed to list agents: ${error.message}`
      };
    }
  }

  /**
   * Comando: describe-agent
   * Mostra informazioni dettagliate su un agente
   */
  static async describeAgent(args: string[]): Promise<CommandResult> {
    try {
      const options = this.parseDescribeAgentArgs(args);
      
      if (options.help) {
        return {
          success: true,
          message: this.getDescribeAgentHelp()
        };
      }

      if (!options.name) {
        return {
          success: false,
          message: 'Agent name is required. Use --name <name>',
          error: 'Agent name is required. Use --name <name>'
        };
      }

      const info = await unifiedAgentFactory.describeAgent(options.name);

      if (!info.config) {
        return {
          success: false,
          message: `Agent '${options.name}' not found`,
          error: `Agent '${options.name}' not found`
        };
      }

      if (options.json) {
        return {
          success: true,
          message: 'Agent information retrieved successfully',
          data: info
        };
      }

      // Formato leggibile
      const description = this.formatAgentDescription(info);
      return {
        success: true,
        message: description
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to describe agent: ${error.message}`,
        error: `Failed to describe agent: ${error.message}`
      };
    }
  }

  /**
   * Comando: pause-agent
   * Pausa un agente in esecuzione
   */
  static async pauseAgent(args: string[]): Promise<CommandResult> {
    try {
      const options = this.parsePauseAgentArgs(args);
      
      if (options.help) {
        return {
          success: true,
          message: this.getPauseAgentHelp()
        };
      }

      if (!options.name) {
        return {
          success: false,
          message: 'Agent name is required. Use --name <name>',
          error: 'Agent name is required. Use --name <name>'
        };
      }

      await unifiedAgentFactory.pauseAgent(options.name);

      return {
        success: true,
        message: `✅ Agent '${options.name}' paused successfully`
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to pause agent: ${error.message}`,
        error: `Failed to pause agent: ${error.message}`
      };
    }
  }

  /**
   * Comando: resume-agent
   * Riprende un agente in pausa
   */
  static async resumeAgent(args: string[]): Promise<CommandResult> {
    try {
      const options = this.parseResumeAgentArgs(args);
      
      if (options.help) {
        return {
          success: true,
          message: this.getResumeAgentHelp()
        };
      }

      if (!options.name) {
        return {
          success: false,
          message: 'Agent name is required. Use --name <name>',
          error: 'Agent name is required. Use --name <name>'
        };
      }

      await unifiedAgentFactory.resumeAgent(options.name);

      return {
        success: true,
        message: `✅ Agent '${options.name}' resumed successfully`
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to resume agent: ${error.message}`,
        error: `Failed to resume agent: ${error.message}`
      };
    }
  }

  /**
   * Comando: kill-agent
   * Ferma e elimina un agente
   */
  static async killAgent(args: string[]): Promise<CommandResult> {
    try {
      const options = this.parseKillAgentArgs(args);
      
      if (options.help) {
        return {
          success: true,
          message: this.getKillAgentHelp()
        };
      }

      if (!options.name) {
        return {
          success: false,
          message: 'Agent name is required. Use --name <name>',
          error: 'Agent name is required. Use --name <name>'
        };
      }

      await unifiedAgentFactory.deleteAgent(options.name);

      return {
        success: true,
        message: `✅ Agent '${options.name}' killed and removed successfully`
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Failed to kill agent: ${error.message}`,
        error: `Failed to kill agent: ${error.message}`
      };
    }
  }

  /**
   * Comando: factory
   * Mostra la dashboard della factory
   */
  static async factory(args: string[]): Promise<CommandResult> {
    try {
      const options = this.parseFactoryArgs(args);
      
      if (options.help) {
        return {
          success: true,
          message: this.getFactoryHelp()
        };
      }

      if (options.profile && options.name) {
        // Valida il nome dell'agente secondo il pattern regex
        const namePattern = /^[a-zA-Z0-9_-]+$/;
        if (!namePattern.test(options.name)) {
          return {
            success: false,
            message: 'Invalid agent name. Use only letters, numbers, underscores, and hyphens.',
            error: 'Invalid agent configuration: name must match pattern ^[a-zA-Z0-9_-]+$'
          };
        }

        // Crea agente da profilo
        const overrides = options.overrides ? JSON.parse(options.overrides) : {};
        const instance = await unifiedAgentFactory.createAgentFromProfile(
          options.profile,
          options.name,
          overrides
        );

        return {
          success: true,
          message: `✅ Agent '${options.name}' created from profile '${options.profile}'`,
          data: {
            name: instance.config.name,
            profile: instance.config.profile,
            status: instance.status
          }
        };
      }

      // Mostra dashboard
      unifiedAgentFactory.showFactoryDashboard();
      return {
        success: true,
        message: 'Factory dashboard displayed'
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Factory command failed: ${error.message}`,
        error: `Factory command failed: ${error.message}`
      };
    }
  }

  // Metodi di parsing degli argomenti
  private static parseCreateAgentArgs(args: string[]): any {
    const options: any = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--help' || arg === '-h') {
        options.help = true;
      } else if (arg === '--name' || arg === '-n') {
        options.name = args[++i];
      } else if (arg === '--profile' || arg === '-p') {
        options.profile = args[++i];
      } else if (arg === '--config' || arg === '-c') {
        options.config = args[++i];
      } else if (arg === '--json') {
        options.json = true;
      } else if (arg.startsWith('--override.')) {
        const key = arg.substring(11);
        options.overrides = options.overrides || {};
        options.overrides[key] = args[++i];
      }
    }
    
    return options;
  }

  private static parseLaunchAgentArgs(args: string[]): any {
    const options: any = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--help' || arg === '-h') {
        options.help = true;
      } else if (arg === '--name' || arg === '-n') {
        options.name = args[++i];
      } else if (arg === '--auto') {
        options.auto = true;
      } else if (arg === '--max-steps') {
        options.maxSteps = parseInt(args[++i]);
      } else if (arg === '--max-tokens') {
        options.maxTokens = parseInt(args[++i]);
      } else if (arg === '--max-cost') {
        options.maxCost = parseFloat(args[++i]);
      } else if (arg === '--time-limit') {
        options.timeLimit = args[++i];
      } else if (arg === '--safe-tools-only') {
        options.safeToolsOnly = true;
      } else if (arg === '--allow-write') {
        options.allowWrite = true;
      } else if (arg === '--json') {
        options.json = true;
      }
    }
    
    return options;
  }

  private static parseListAgentsArgs(args: string[]): any {
    const options: any = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--help' || arg === '-h') {
        options.help = true;
      } else if (arg === '--json') {
        options.json = true;
      }
    }
    
    return options;
  }

  private static parseDescribeAgentArgs(args: string[]): any {
    const options: any = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--help' || arg === '-h') {
        options.help = true;
      } else if (arg === '--name' || arg === '-n') {
        options.name = args[++i];
      } else if (arg === '--json') {
        options.json = true;
      }
    }
    
    return options;
  }

  private static parsePauseAgentArgs(args: string[]): any {
    const options: any = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--help' || arg === '-h') {
        options.help = true;
      } else if (arg === '--name' || arg === '-n') {
        options.name = args[++i];
      }
    }
    
    return options;
  }

  private static parseResumeAgentArgs(args: string[]): any {
    const options: any = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--help' || arg === '-h') {
        options.help = true;
      } else if (arg === '--name' || arg === '-n') {
        options.name = args[++i];
      } else if (arg === '--auto') {
        options.auto = true;
      }
    }
    
    return options;
  }

  private static parseKillAgentArgs(args: string[]): any {
    const options: any = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--help' || arg === '-h') {
        options.help = true;
      } else if (arg === '--name' || arg === '-n') {
        options.name = args[++i];
      }
    }
    
    return options;
  }

  private static parseFactoryArgs(args: string[]): any {
    const options: any = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--help' || arg === '-h') {
        options.help = true;
      } else if (arg === '--profile' || arg === '-p') {
        options.profile = args[++i];
      } else if (arg === '--name' || arg === '-n') {
        options.name = args[++i];
      } else if (arg === '--overrides') {
        options.overrides = args[++i];
      }
    }
    
    return options;
  }

  // Metodi helper per formattazione
  private static formatAgentsTable(agents: any[]): string {
    if (agents.length === 0) {
      return chalk.yellow('No agents found');
    }

    const headers = ['Name', 'Profile', 'Status', 'Last Activity'];
    const rows = agents.map(agent => [
      agent.name,
      agent.profile,
      this.getStatusIcon(agent.status) + ' ' + agent.status,
      agent.latestState?.lastActivity ? 
        new Date(agent.latestState.lastActivity).toLocaleString() : 
        'Never'
    ]);

    const table = this.createTable(headers, rows);
    return table;
  }

  private static formatAgentDescription(info: any): string {
    const { config, instance, latestState } = info;
    
    let description = chalk.blue.bold(`\n🤖 Agent: ${config.name}\n`);
    description += chalk.gray('─'.repeat(40)) + '\n';
    
    description += chalk.cyan('Profile:') + ` ${config.profile}\n`;
    description += chalk.cyan('Specialization:') + ` ${config.specialization}\n`;
    description += chalk.cyan('Status:') + ` ${instance?.status || 'not-loaded'}\n`;
    description += chalk.cyan('Autonomy Level:') + ` ${config.autonomyLevel}\n`;
    description += chalk.cyan('Context Scope:') + ` ${config.contextScope}\n`;
    
    if (latestState) {
      description += chalk.cyan('Current Step:') + ` ${latestState.currentStep}/${latestState.totalSteps}\n`;
      description += chalk.cyan('Last Activity:') + ` ${new Date(latestState.lastActivity).toLocaleString()}\n`;
    }
    
    return description;
  }

  private static createTable(headers: string[], rows: string[][]): string {
    const maxWidths = headers.map((_, i) => {
      const columnValues = [headers[i], ...rows.map(row => row[i] || '')];
      return Math.max(...columnValues.map(val => val.length));
    });

    const separator = '│';
    const topBorder = '┌' + maxWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐';
    const bottomBorder = '└' + maxWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘';
    const middleBorder = '├' + maxWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤';

    const formatRow = (row: string[]) => {
      return separator + row.map((cell, i) => 
        ' ' + cell.padEnd(maxWidths[i]) + ' '
      ).join(separator) + separator;
    };

    let table = topBorder + '\n';
    table += formatRow(headers) + '\n';
    table += middleBorder + '\n';
    
    for (const row of rows) {
      table += formatRow(row) + '\n';
    }
    
    table += bottomBorder;
    return table;
  }

  private static getStatusIcon(status: string): string {
    switch (status) {
      case 'running': return '🟢';
      case 'paused': return '🟡';
      case 'stopped': return '🔴';
      case 'error': return '❌';
      default: return '⚪';
    }
  }

  private static parseTimeLimit(timeLimit: string): number {
    const match = timeLimit.match(/^(\d+)([smh])$/);
    if (!match) {
      throw new Error(`Invalid time limit format: ${timeLimit}. Use format like '30s', '30m' or '2h'`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    if (unit === 's') {
      return value * 1000; // secondi in millisecondi
    } else if (unit === 'm') {
      return value * 60 * 1000; // minuti in millisecondi
    } else if (unit === 'h') {
      return value * 60 * 60 * 1000; // ore in millisecondi
    }

    throw new Error(`Unsupported time unit: ${unit}`);
  }

  // Metodi di help
  private static getCreateAgentHelp(): string {
    return `
${chalk.blue.bold('create-agent - Create a new agent')}

${chalk.cyan('Usage:')}
  create-agent --name <name> --profile <profile> [options]
  create-agent --name <name> --config <config-file> [options]

${chalk.cyan('Options:')}
  --name, -n <name>           Agent name (required)
  --profile, -p <profile>     Agent profile (researcher, coder, planner, etc.)
  --config, -c <file>         Configuration file path
  --json                      Output in JSON format
  --override.<key> <value>    Override configuration value
  --help, -h                  Show this help

${chalk.cyan('Examples:')}
  create-agent --name demo --profile researcher
  create-agent --name demo --config ./agent-config.json
  create-agent --name demo --profile coder --override.autoMode.maxSteps 100
`;
  }

  private static getLaunchAgentHelp(): string {
    return `
${chalk.blue.bold('launch-agent - Launch an agent')}

${chalk.cyan('Usage:')}
  launch-agent --name <name> [options]

${chalk.cyan('Options:')}
  --name, -n <name>           Agent name (required)
  --auto                      Launch in auto mode
  --max-steps <number>        Maximum steps for auto mode
  --max-tokens <number>       Maximum tokens for auto mode
  --max-cost <number>         Maximum cost for auto mode
  --time-limit <time>         Time limit (e.g., 30s, 30m, 2h)
  --safe-tools-only           Use only safe tools
  --allow-write               Allow write operations
  --json                      Output in JSON format
  --help, -h                  Show this help

${chalk.cyan('Examples:')}
  launch-agent --name demo
  launch-agent --name demo --auto --max-steps 50
  launch-agent --name demo --auto --time-limit 30m --safe-tools-only
`;
  }

  private static getListAgentsHelp(): string {
    return `
${chalk.blue.bold('list-agents - List all agents')}

${chalk.cyan('Usage:')}
  list-agents [options]

${chalk.cyan('Options:')}
  --json                      Output in JSON format
  --help, -h                  Show this help

${chalk.cyan('Examples:')}
  list-agents
  list-agents --json
`;
  }

  private static getDescribeAgentHelp(): string {
    return `
${chalk.blue.bold('describe-agent - Show agent details')}

${chalk.cyan('Usage:')}
  describe-agent --name <name> [options]

${chalk.cyan('Options:')}
  --name, -n <name>           Agent name (required)
  --json                      Output in JSON format
  --help, -h                  Show this help

${chalk.cyan('Examples:')}
  describe-agent --name demo
  describe-agent --name demo --json
`;
  }

  private static getPauseAgentHelp(): string {
    return `
${chalk.blue.bold('pause-agent - Pause an agent')}

${chalk.cyan('Usage:')}
  pause-agent --name <name>

${chalk.cyan('Options:')}
  --name, -n <name>           Agent name (required)
  --help, -h                  Show this help

${chalk.cyan('Examples:')}
  pause-agent --name demo
`;
  }

  private static getResumeAgentHelp(): string {
    return `
${chalk.blue.bold('resume-agent - Resume an agent')}

${chalk.cyan('Usage:')}
  resume-agent --name <name> [options]

${chalk.cyan('Options:')}
  --name, -n <name>           Agent name (required)
  --auto                      Resume in auto mode
  --help, -h                  Show this help

${chalk.cyan('Examples:')}
  resume-agent --name demo
  resume-agent --name demo --auto
`;
  }

  private static getKillAgentHelp(): string {
    return `
${chalk.blue.bold('kill-agent - Stop and delete an agent')}

${chalk.cyan('Usage:')}
  kill-agent --name <name>

${chalk.cyan('Options:')}
  --name, -n <name>           Agent name (required)
  --help, -h                  Show this help

${chalk.cyan('Examples:')}
  kill-agent --name demo
`;
  }

  private static getFactoryHelp(): string {
    return `
${chalk.blue.bold('factory - Agent factory dashboard')}

${chalk.cyan('Usage:')}
  factory [options]

${chalk.cyan('Options:')}
  --profile, -p <profile>     Create agent from profile
  --name, -n <name>           Agent name for profile creation
  --overrides <json>          JSON overrides for profile
  --help, -h                  Show this help

${chalk.cyan('Examples:')}
  factory
  factory --profile coder --name demo-coder
  factory --profile researcher --name demo-researcher --overrides '{"autoMode.maxSteps": 100}'
`;
  }
}