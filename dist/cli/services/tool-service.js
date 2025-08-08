"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolService = exports.ToolService = void 0;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class ToolService {
    constructor() {
        this.tools = new Map();
        this.executions = new Map();
        this.workingDirectory = process.cwd();
        this.registerDefaultTools();
    }
    setWorkingDirectory(dir) {
        this.workingDirectory = dir;
    }
    registerDefaultTools() {
        // File operations
        this.registerTool({
            name: 'read_file',
            description: 'Read file contents',
            category: 'file',
            handler: this.readFile.bind(this)
        });
        this.registerTool({
            name: 'write_file',
            description: 'Write content to file',
            category: 'file',
            handler: this.writeFile.bind(this)
        });
        this.registerTool({
            name: 'list_files',
            description: 'List files in directory',
            category: 'file',
            handler: this.listFiles.bind(this)
        });
        this.registerTool({
            name: 'find_files',
            description: 'Find files matching pattern',
            category: 'file',
            handler: this.findFiles.bind(this)
        });
        // Command execution
        this.registerTool({
            name: 'execute_command',
            description: 'Execute shell command',
            category: 'command',
            handler: this.executeCommand.bind(this)
        });
        // Git operations
        this.registerTool({
            name: 'git_status',
            description: 'Get git repository status',
            category: 'git',
            handler: this.gitStatus.bind(this)
        });
        this.registerTool({
            name: 'git_diff',
            description: 'Get git diff',
            category: 'git',
            handler: this.gitDiff.bind(this)
        });
        // Package management
        this.registerTool({
            name: 'npm_install',
            description: 'Install npm package',
            category: 'package',
            handler: this.npmInstall.bind(this)
        });
        // Project analysis
        this.registerTool({
            name: 'analyze_project',
            description: 'Analyze project structure',
            category: 'analysis',
            handler: this.analyzeProject.bind(this)
        });
    }
    registerTool(tool) {
        this.tools.set(tool.name, tool);
        console.log(chalk_1.default.dim(`🔧 Registered tool: ${tool.name}`));
    }
    async executeTool(toolName, args) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Tool '${toolName}' not found`);
        }
        const execution = {
            id: Date.now().toString(),
            toolName,
            args,
            startTime: new Date(),
            status: 'running'
        };
        this.executions.set(execution.id, execution);
        try {
            console.log(chalk_1.default.blue(`🔧 Executing ${toolName}...`));
            const result = await tool.handler(args);
            execution.endTime = new Date();
            execution.status = 'completed';
            execution.result = result;
            const duration = execution.endTime.getTime() - execution.startTime.getTime();
            console.log(chalk_1.default.green(`✅ ${toolName} completed (${duration}ms)`));
            return result;
        }
        catch (error) {
            execution.endTime = new Date();
            execution.status = 'failed';
            execution.error = error.message;
            console.log(chalk_1.default.red(`❌ ${toolName} failed: ${error.message}`));
            throw error;
        }
    }
    getAvailableTools() {
        return Array.from(this.tools.values());
    }
    getExecutionHistory() {
        return Array.from(this.executions.values());
    }
    // Tool implementations
    async readFile(args) {
        const fullPath = path.resolve(this.workingDirectory, args.filePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${args.filePath}`);
        }
        const content = fs.readFileSync(fullPath, 'utf8');
        return {
            content,
            size: content.length
        };
    }
    async writeFile(args) {
        const fullPath = path.resolve(this.workingDirectory, args.filePath);
        const dir = path.dirname(fullPath);
        // Ensure directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, args.content, 'utf8');
        return {
            written: true,
            size: args.content.length
        };
    }
    async listFiles(args) {
        const targetPath = path.resolve(this.workingDirectory, args.path || '.');
        if (!fs.existsSync(targetPath)) {
            throw new Error(`Directory not found: ${args.path || '.'}`);
        }
        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        const files = items.map(item => {
            const result = {
                name: item.name,
                type: item.isDirectory() ? 'directory' : 'file'
            };
            if (item.isFile()) {
                try {
                    const stats = fs.statSync(path.join(targetPath, item.name));
                    result.size = stats.size;
                }
                catch {
                    // Ignore stat errors
                }
            }
            return result;
        });
        return { files };
    }
    async findFiles(args) {
        const searchPath = path.resolve(this.workingDirectory, args.path || '.');
        const matches = [];
        const searchRecursive = (dir) => {
            try {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    const relativePath = path.relative(this.workingDirectory, fullPath);
                    if (item.isDirectory()) {
                        searchRecursive(fullPath);
                    }
                    else if (item.name.includes(args.pattern) || relativePath.includes(args.pattern)) {
                        matches.push(relativePath);
                    }
                }
            }
            catch {
                // Ignore directory access errors
            }
        };
        searchRecursive(searchPath);
        return { matches };
    }
    async executeCommand(args) {
        try {
            const result = (0, child_process_1.execSync)(args.command, {
                cwd: this.workingDirectory,
                encoding: 'utf8',
                timeout: args.timeout || 30000
            });
            return {
                stdout: result.toString(),
                stderr: '',
                exitCode: 0
            };
        }
        catch (error) {
            return {
                stdout: error.stdout?.toString() || '',
                stderr: error.stderr?.toString() || error.message,
                exitCode: error.status || 1
            };
        }
    }
    async gitStatus(args) {
        try {
            const result = (0, child_process_1.execSync)('git status --porcelain', {
                cwd: this.workingDirectory,
                encoding: 'utf8'
            });
            const files = result.trim().split('\\n').filter(line => line).map(line => {
                const status = line.slice(0, 2);
                const path = line.slice(3);
                return { path, status };
            });
            return {
                status: files.length > 0 ? 'dirty' : 'clean',
                files
            };
        }
        catch (error) {
            throw new Error('Not a git repository or git not available');
        }
    }
    async gitDiff(args) {
        try {
            const command = args.staged ? 'git diff --cached' : 'git diff';
            const result = (0, child_process_1.execSync)(command, {
                cwd: this.workingDirectory,
                encoding: 'utf8'
            });
            return { diff: result };
        }
        catch (error) {
            throw new Error('Failed to get git diff');
        }
    }
    async npmInstall(args) {
        try {
            let command = 'npm install';
            if (args.package) {
                command += ` ${args.package}`;
                if (args.dev) {
                    command += ' --save-dev';
                }
            }
            const result = (0, child_process_1.execSync)(command, {
                cwd: this.workingDirectory,
                encoding: 'utf8'
            });
            return {
                installed: args.package ? [args.package] : ['dependencies'],
            };
        }
        catch (error) {
            return {
                installed: [],
                error: error.message
            };
        }
    }
    async analyzeProject(args) {
        try {
            // Read package.json if available
            let projectName = path.basename(this.workingDirectory);
            let projectType = 'unknown';
            try {
                const packageJsonPath = path.join(this.workingDirectory, 'package.json');
                if (fs.existsSync(packageJsonPath)) {
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                    projectName = packageJson.name || projectName;
                    projectType = 'node';
                }
            }
            catch {
                // Ignore package.json errors
            }
            // Detect languages
            const languages = new Set();
            let fileCount = 0;
            const analyzeDir = (dir, depth = 0) => {
                if (depth > 3)
                    return; // Limit recursion depth
                try {
                    const items = fs.readdirSync(dir, { withFileTypes: true });
                    for (const item of items) {
                        if (item.name.startsWith('.'))
                            continue;
                        const fullPath = path.join(dir, item.name);
                        if (item.isDirectory()) {
                            analyzeDir(fullPath, depth + 1);
                        }
                        else {
                            fileCount++;
                            const ext = path.extname(item.name);
                            // Map extensions to languages
                            const langMap = {
                                '.js': 'JavaScript',
                                '.ts': 'TypeScript',
                                '.tsx': 'TypeScript',
                                '.jsx': 'JavaScript',
                                '.py': 'Python',
                                '.rs': 'Rust',
                                '.go': 'Go',
                                '.java': 'Java',
                                '.cpp': 'C++',
                                '.c': 'C'
                            };
                            if (langMap[ext]) {
                                languages.add(langMap[ext]);
                            }
                        }
                    }
                }
                catch {
                    // Ignore directory access errors
                }
            };
            analyzeDir(this.workingDirectory);
            return {
                name: projectName,
                type: projectType,
                languages: Array.from(languages),
                fileCount,
                structure: {} // Could be expanded
            };
        }
        catch (error) {
            throw new Error(`Failed to analyze project: ${error.message}`);
        }
    }
}
exports.ToolService = ToolService;
exports.toolService = new ToolService();
