"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseBashtool = void 0;
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const util_1 = require("util");
const tool_1 = require("./tool");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const MAX_OUTPUT_LENGTH = 50000;
const DEFAULT_TIMEOUT = 2 * 60 * 1000; // 2 minutes
const MAX_TIMEOUT = 10 * 60 * 1000; // 10 minutes
// Advanced command analysis for safety
class CommandAnalyzer {
    constructor() {
        this.dangerousCommands = [
            'rm', 'rmdir', 'mv', 'dd', 'format', 'fdisk',
            'chmod 777', 'chown -R', 'sudo rm', 'kill -9',
            '> /dev/', 'shutdown', 'reboot', 'halt'
        ];
        this.cautionCommands = [
            'cp -r', 'mv', 'chmod', 'chown', 'git reset --hard',
            'npm install -g', 'yarn global', 'docker rm', 'docker rmi'
        ];
    }
    analyzeSafety(command) {
        const reasons = [];
        // Check for dangerous patterns
        for (const dangerous of this.dangerousCommands) {
            if (command.includes(dangerous)) {
                if (dangerous === 'rm' && (command.includes('-rf') || command.includes('-fr'))) {
                    reasons.push('Recursive file deletion detected - EXTREMELY DANGEROUS');
                    return { level: 'DANGER', reasons };
                }
                reasons.push(`Dangerous command detected: ${dangerous}`);
                return { level: 'DANGER', reasons };
            }
        }
        // Check for caution patterns  
        for (const caution of this.cautionCommands) {
            if (command.includes(caution)) {
                reasons.push(`Caution required for: ${caution}`);
                return { level: 'CAUTION', reasons };
            }
        }
        return { level: 'SAFE', reasons: ['Command appears safe'] };
    }
    analyzeResourceImpact(command) {
        const highImpactPatterns = [
            'find /', 'grep -r /', 'tar -x', 'zip -r',
            'docker build', 'npm install', 'yarn install',
            'webpack', 'tsc', 'babel'
        ];
        const mediumImpactPatterns = [
            'git clone', 'npm run', 'yarn run', 'node',
            'python', 'java -jar', 'mvn', 'gradle'
        ];
        for (const pattern of highImpactPatterns) {
            if (command.includes(pattern))
                return 'HIGH';
        }
        for (const pattern of mediumImpactPatterns) {
            if (command.includes(pattern))
                return 'MEDIUM';
        }
        return 'LOW';
    }
    extractPotentialFilePaths(command) {
        const paths = [];
        // Extract paths from common patterns
        const pathPatterns = [
            /(['"]?)([^\s'"]+\.[a-zA-Z0-9]+)\1/g, // Files with extensions
            /(['"]?)(\.[\/][^\s'"]*)\1/g, // Relative paths starting with ./
            /(['"]?)(\/[^\s'"]*)\1/g, // Absolute paths
            /(['"]?)(\~\/[^\s'"]*)\1/g, // Home directory paths
        ];
        pathPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(command)) !== null) {
                paths.push(match[2]);
            }
        });
        return Array.from(new Set(paths));
    }
}
// Generate ultra-specific system prompt based on context
function generateContextualBashPrompt(ctx) {
    const analyzer = new CommandAnalyzer();
    const basePrompt = `You are an ADVANCED BASH EXECUTION SPECIALIST with enterprise-level security awareness and deep system knowledge.

CORE CAPABILITIES:
- Execute shell commands with comprehensive safety analysis
- Real-time command validation and risk assessment  
- Cross-platform compatibility (Linux, macOS, Windows WSL)
- Resource monitoring and performance optimization
- Intelligent error handling and recovery suggestions

SAFETY & SECURITY PROTOCOLS:
1. ALWAYS analyze commands for potential destructive operations
2. Implement multi-layer safety checks before execution
3. Warn about irreversible changes with specific impact assessment
4. Suggest safer alternatives and best practices
5. Require explicit confirmation for DANGER level operations
6. Monitor system resources during execution
7. Provide rollback instructions when possible`;
    // Add context-specific adaptations
    let contextualAdditions = '\n\nCONTEXT-AWARE INTELLIGENCE:\n';
    if (ctx.workspaceContext.gitInfo) {
        contextualAdditions += `- Git Repository: ${ctx.workspaceContext.gitInfo.branch} branch\n`;
        if (ctx.workspaceContext.gitInfo.hasUnstagedChanges) {
            contextualAdditions += `  ⚠️  UNSTAGED CHANGES DETECTED - Be extra careful with git operations\n`;
        }
        if (ctx.workspaceContext.gitInfo.hasUncommittedChanges) {
            contextualAdditions += `  ⚠️  UNCOMMITTED CHANGES DETECTED - Consider committing before risky operations\n`;
        }
    }
    if (ctx.workspaceContext.framework) {
        contextualAdditions += `- Framework: ${ctx.workspaceContext.framework}\n`;
        contextualAdditions += `  → Apply ${ctx.workspaceContext.framework}-specific safety measures\n`;
    }
    if (ctx.projectInfo.packageManager) {
        contextualAdditions += `- Package Manager: ${ctx.projectInfo.packageManager}\n`;
        contextualAdditions += `  → Use ${ctx.projectInfo.packageManager} for dependency operations\n`;
    }
    if (ctx.projectInfo.hasDocker) {
        contextualAdditions += `- Docker Environment Detected\n`;
        contextualAdditions += `  → Consider container implications for file operations\n`;
    }
    contextualAdditions += `\nEXECUTION ENVIRONMENT:
- Working Directory: ${ctx.workspaceContext.rootPath}
- Selected Paths: ${ctx.workspaceContext.selectedPaths.join(', ')}
- Languages: ${ctx.workspaceContext.languages.join(', ')}
- File Count: ${ctx.workspaceContext.fileCount}`;
    const executionModes = `\n\nEXECUTION MODES:
- DRY_RUN: Simulate execution and show expected results
- SAFE: Execute with maximum safety checks enabled
- INTERACTIVE: Prompt for confirmation at each step
- FORCE: Execute with minimal safety (requires explicit user confirmation)

MANDATORY SAFETY ANALYSIS FORMAT:
\`\`\`bash
# 🔍 COMMAND ANALYSIS
Command: [the exact command]
Safety Level: [SAFE|CAUTION|DANGER]
Resource Impact: [LOW|MEDIUM|HIGH]
Affected Areas: [filesystem|network|system|git|packages]

# ⚖️  RISK ASSESSMENT
Potential Impact: [detailed impact description]
Reversible: [Yes|No|Partial]
Backup Recommended: [Yes|No]
Alternative Safer Commands: [list if applicable]

# 🚀 EXECUTION PLAN
Pre-checks: [validations to perform]
Main Command: [the command with any safety modifications]
Post-validation: [verification steps]

# 📊 EXPECTED OUTCOME
Success Indicators: [how to verify success]
Failure Scenarios: [potential failure modes]
Recovery Steps: [how to recover from failures]
\`\`\`

CRITICAL SAFETY RULES:
1. NEVER execute destructive commands without explicit confirmation
2. ALWAYS provide safer alternatives when available
3. VERIFY file paths exist before operations
4. CHECK disk space before large operations
5. WARN about operations that modify many files
6. SUGGEST backups for irreversible changes
7. MONITOR resource usage during execution`;
    return basePrompt + contextualAdditions + executionModes;
}
exports.EnterpriseBashtool = (0, tool_1.define)('enterprise-bash', {
    category: tool_1.ToolCategory.DEVELOPMENT,
    version: '2.0.0',
    tags: ['bash', 'shell', 'terminal', 'execution', 'enterprise'],
    requiredPermissions: [tool_1.Permission.EXECUTE_COMMANDS, tool_1.Permission.READ_FILES],
    contextDependencies: [],
    init: async () => ({
        description: 'Enterprise-grade bash command execution with advanced safety analysis, context awareness, and intelligent error handling',
        parameters: zod_1.z.object({
            command: zod_1.z.string().describe('The bash command to execute with full safety analysis'),
            timeout: zod_1.z.number().optional().describe('Optional timeout in milliseconds (max 600000ms)'),
            mode: zod_1.z.enum(['dry-run', 'safe', 'interactive', 'force']).optional().default('safe').describe('Execution mode with different safety levels'),
            description: zod_1.z.string().describe('Clear, concise description of what this command accomplishes (5-15 words)'),
            workingDirectory: zod_1.z.string().optional().describe('Optional working directory override'),
            environmentVariables: zod_1.z.record(zod_1.z.string()).optional().describe('Optional environment variables'),
        }),
        systemPrompt: '', // Will be generated contextually
        contextualPrompts: [
            {
                condition: (ctx) => ctx.workspaceContext.gitInfo?.hasUncommittedChanges || false,
                promptAddition: 'CRITICAL: Uncommitted Git changes detected. Suggest committing before any risky file operations.'
            },
            {
                condition: (ctx) => ctx.projectInfo.hasDocker || false,
                promptAddition: 'Docker environment detected. Consider container implications and volume mounts for file operations.'
            },
            {
                condition: (ctx) => ctx.workspaceContext.framework === 'React' || ctx.workspaceContext.framework === 'Next.js',
                promptAddition: 'React/Next.js project detected. Be aware of build artifacts (dist/, .next/) and node_modules.'
            },
            {
                condition: (ctx) => ctx.projectInfo.packageManager === 'pnpm',
                promptAddition: 'PNPM detected. Use pnpm commands instead of npm. Be aware of workspace structure.'
            }
        ],
        safetyChecks: [
            {
                check: async (args, ctx) => {
                    const analyzer = new CommandAnalyzer();
                    const safety = analyzer.analyzeSafety(args.command);
                    if (safety.level === 'DANGER') {
                        return {
                            safe: false,
                            message: `DANGEROUS COMMAND DETECTED: ${safety.reasons.join(', ')}`,
                            requiresConfirmation: true,
                            suggestions: [
                                'Consider using a safer alternative',
                                'Make a backup before proceeding',
                                'Test in a isolated environment first'
                            ]
                        };
                    }
                    if (safety.level === 'CAUTION') {
                        return {
                            safe: true,
                            message: `CAUTION: ${safety.reasons.join(', ')}`,
                            requiresConfirmation: args.mode !== 'force',
                            suggestions: ['Verify the command parameters', 'Consider the impact on your project']
                        };
                    }
                    return { safe: true };
                },
                level: 'confirmation'
            },
            {
                check: async (args, ctx) => {
                    // Check for file path existence
                    const analyzer = new CommandAnalyzer();
                    const paths = analyzer.extractPotentialFilePaths(args.command);
                    // This would normally check if critical paths exist
                    return { safe: true };
                },
                level: 'warning'
            }
        ],
        async execute(args, ctx) {
            const startTime = Date.now();
            const analyzer = new CommandAnalyzer();
            // Generate contextual system prompt
            const systemPrompt = generateContextualBashPrompt(ctx);
            // Analyze command safety
            const safety = analyzer.analyzeSafety(args.command);
            const resourceImpact = analyzer.analyzeResourceImpact(args.command);
            const affectedPaths = analyzer.extractPotentialFilePaths(args.command);
            // Handle dry-run mode
            if (args.mode === 'dry-run') {
                const duration = Date.now() - startTime;
                return {
                    title: `Dry Run: ${args.command}`,
                    output: `DRY RUN MODE - Command would execute:
${args.command}

Safety Level: ${safety.level}
Resource Impact: ${resourceImpact}
Affected Paths: ${affectedPaths.join(', ') || 'None detected'}
Working Directory: ${args.workingDirectory || ctx.workspaceContext.rootPath}

This is a simulation - no actual execution occurred.`,
                    success: true,
                    duration,
                    metadata: {
                        command: args.command,
                        exitCode: 0,
                        duration,
                        safetyLevel: safety.level,
                        resourceImpact,
                        filesAffected: affectedPaths,
                        executionTime: duration,
                        contextAware: true
                    }
                };
            }
            try {
                // Update progress
                ctx.updateProgress?.(10, 'Analyzing command safety...');
                // Set up execution environment
                const execOptions = {
                    cwd: args.workingDirectory || ctx.workspaceContext.rootPath,
                    timeout: Math.min(args.timeout || DEFAULT_TIMEOUT, MAX_TIMEOUT),
                    env: { ...process.env, ...args.environmentVariables },
                    maxBuffer: MAX_OUTPUT_LENGTH
                };
                ctx.updateProgress?.(30, 'Executing command...');
                // Execute the command
                const { stdout, stderr } = await execAsync(args.command, execOptions);
                ctx.updateProgress?.(90, 'Processing output...');
                let output = '';
                if (stdout)
                    output += `STDOUT:\n${stdout}\n`;
                if (stderr)
                    output += `STDERR:\n${stderr}\n`;
                // Truncate if too long
                if (output.length > MAX_OUTPUT_LENGTH) {
                    output = output.substring(0, MAX_OUTPUT_LENGTH) + '\n... [OUTPUT TRUNCATED]';
                }
                const duration = Date.now() - startTime;
                // Generate follow-up suggestions
                const suggestions = [
                    'Verify the command completed successfully',
                    'Check any created/modified files',
                ];
                if (safety.level === 'CAUTION' || safety.level === 'DANGER') {
                    suggestions.push('Review system state for unexpected changes');
                }
                ctx.updateProgress?.(100, 'Command completed successfully');
                return {
                    title: `Executed: ${args.command}`,
                    output: `COMMAND: ${args.command}
WORKING DIR: ${execOptions.cwd}
DURATION: ${duration}ms
SAFETY: ${safety.level}
IMPACT: ${resourceImpact}

${output}`,
                    success: true,
                    duration,
                    metadata: {
                        command: args.command,
                        exitCode: 0,
                        duration,
                        safetyLevel: safety.level,
                        resourceImpact,
                        filesAffected: affectedPaths,
                        executionTime: duration,
                        contextAware: true
                    },
                    followUpSuggestions: suggestions
                };
            }
            catch (error) {
                const duration = Date.now() - startTime;
                return {
                    title: `Failed: ${args.command}`,
                    output: `COMMAND: ${args.command}
ERROR: ${error.message}
EXIT CODE: ${error.code || 1}
DURATION: ${duration}ms
SAFETY: ${safety.level}

TROUBLESHOOTING SUGGESTIONS:
${error.code === 'ENOENT' ? '- Command not found. Check if the program is installed and in PATH.' : ''}
${error.code === 'EACCES' ? '- Permission denied. Check file permissions or use sudo if appropriate.' : ''}
${error.signal === 'SIGTERM' ? '- Command timed out. Consider increasing timeout or optimizing the command.' : ''}
- Verify the command syntax and parameters
- Check if all required files and directories exist
- Ensure you have necessary permissions
${safety.level !== 'SAFE' ? '- This command was flagged as potentially risky - double-check parameters' : ''}`,
                    success: false,
                    duration,
                    metadata: {
                        command: args.command,
                        exitCode: error.code || 1,
                        duration,
                        safetyLevel: safety.level,
                        resourceImpact,
                        filesAffected: affectedPaths,
                        executionTime: duration,
                        contextAware: true
                    },
                    followUpSuggestions: [
                        'Check the error message for specific issues',
                        'Verify command syntax and parameters',
                        'Ensure all dependencies are installed',
                        'Check file permissions and paths'
                    ]
                };
            }
        }
    })
});
