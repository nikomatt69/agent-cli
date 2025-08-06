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
exports.toolsManager = exports.ToolsManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const chalk_1 = __importDefault(require("chalk"));
const os = __importStar(require("os"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ToolsManager {
    constructor(workingDir) {
        this.runningProcesses = new Map();
        this.commandHistory = [];
        this.workingDirectory = workingDir || process.cwd();
    }
    // File Operations
    async readFile(filePath) {
        const fullPath = path.resolve(this.workingDirectory, filePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const stats = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const extension = path.extname(fullPath).slice(1);
        return {
            path: filePath,
            content,
            size: stats.size,
            modified: stats.mtime,
            extension,
            language: this.getLanguageFromExtension(extension),
        };
    }
    async writeFile(filePath, content) {
        const fullPath = path.resolve(this.workingDirectory, filePath);
        const dir = path.dirname(fullPath);
        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(chalk_1.default.green(`✅ File written: ${filePath}`));
    }
    async editFile(filePath, changes) {
        const fileInfo = await this.readFile(filePath);
        let lines = fileInfo.content.split('\n');
        for (const change of changes) {
            if (change.line !== undefined) {
                // Line-based edit
                if (change.insert) {
                    lines.splice(change.line, 0, change.replace);
                }
                else {
                    lines[change.line] = change.replace;
                }
            }
            else if (change.find) {
                // Find and replace
                lines = lines.map(line => line.replace(new RegExp(change.find, 'g'), change.replace));
            }
        }
        const newContent = lines.join('\n');
        await this.writeFile(filePath, newContent);
    }
    async listFiles(directory = '.', pattern) {
        const fullPath = path.resolve(this.workingDirectory, directory);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Directory not found: ${directory}`);
        }
        const files = [];
        function walkDir(dir) {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const relativePath = path.relative(fullPath, itemPath);
                if (fs.statSync(itemPath).isDirectory()) {
                    if (!item.startsWith('.') && item !== 'node_modules') {
                        walkDir(itemPath);
                    }
                }
                else {
                    if (!pattern || pattern.test(relativePath)) {
                        files.push(path.relative(directory, relativePath));
                    }
                }
            }
        }
        walkDir(fullPath);
        return files;
    }
    // Search Operations
    async searchInFiles(query, directory = '.', filePattern) {
        const files = await this.listFiles(directory, filePattern);
        const results = [];
        const searchRegex = typeof query === 'string' ? new RegExp(query, 'gi') : query;
        for (const file of files) {
            try {
                const fileInfo = await this.readFile(file);
                const lines = fileInfo.content.split('\n');
                lines.forEach((line, index) => {
                    if (searchRegex.test(line)) {
                        results.push({
                            file,
                            line: index + 1,
                            content: line.trim(),
                            context: [
                                lines[index - 1]?.trim() || '',
                                line.trim(),
                                lines[index + 1]?.trim() || '',
                            ].filter(Boolean),
                        });
                    }
                });
            }
            catch (error) {
                // Skip files that can't be read
                continue;
            }
        }
        return results;
    }
    // Advanced Command Execution
    async runCommand(command, args = [], options = {}) {
        const fullCommand = options.sudo ? `sudo ${command} ${args.join(' ')}` : `${command} ${args.join(' ')}`;
        const cwd = options.cwd ? path.resolve(this.workingDirectory, options.cwd) : this.workingDirectory;
        const env = { ...process.env, ...options.env };
        console.log(chalk_1.default.blue(`⚡ Executing: ${fullCommand}`));
        console.log(chalk_1.default.gray(`📁 Working directory: ${cwd}`));
        try {
            const startTime = Date.now();
            if (options.stream || options.interactive) {
                return await this.runCommandStream(fullCommand, { cwd, env, interactive: options.interactive });
            }
            else {
                const { stdout, stderr } = await execAsync(fullCommand, {
                    cwd,
                    timeout: options.timeout || 60000,
                    env,
                    maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                });
                const duration = Date.now() - startTime;
                this.addToHistory(fullCommand, true, stdout + stderr);
                console.log(chalk_1.default.green(`✅ Command completed in ${duration}ms`));
                return { stdout, stderr, code: 0 };
            }
        }
        catch (error) {
            const duration = Date.now() - Date.now();
            this.addToHistory(fullCommand, false, error.message);
            console.log(chalk_1.default.red(`❌ Command failed: ${fullCommand}`));
            console.log(chalk_1.default.gray(`Error: ${error.message}`));
            return {
                stdout: error.stdout || '',
                stderr: error.stderr || error.message,
                code: error.code || 1,
            };
        }
    }
    async runCommandStream(command, options) {
        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            const child = (0, child_process_1.spawn)('sh', ['-c', command], {
                cwd: options.cwd,
                env: options.env,
                stdio: options.interactive ? 'inherit' : 'pipe',
            });
            const processInfo = {
                pid: child.pid,
                command: command.split(' ')[0],
                args: command.split(' ').slice(1),
                cwd: options.cwd,
                startTime: new Date(),
                status: 'running',
            };
            this.runningProcesses.set(child.pid, processInfo);
            if (!options.interactive && child.stdout && child.stderr) {
                child.stdout.on('data', (data) => {
                    const output = data.toString();
                    stdout += output;
                    process.stdout.write(chalk_1.default.cyan(output));
                });
                child.stderr.on('data', (data) => {
                    const output = data.toString();
                    stderr += output;
                    process.stderr.write(chalk_1.default.yellow(output));
                });
            }
            child.on('close', (code) => {
                processInfo.status = code === 0 ? 'completed' : 'failed';
                processInfo.exitCode = code || 0;
                this.runningProcesses.delete(child.pid);
                this.addToHistory(command, code === 0, stdout + stderr);
                if (code === 0) {
                    console.log(chalk_1.default.green(`✅ Process completed (PID: ${child.pid})`));
                }
                else {
                    console.log(chalk_1.default.red(`❌ Process failed with code ${code} (PID: ${child.pid})`));
                }
                resolve({ stdout, stderr, code: code || 0, pid: child.pid });
            });
            child.on('error', (error) => {
                console.log(chalk_1.default.red(`❌ Process error: ${error.message}`));
                processInfo.status = 'failed';
                this.runningProcesses.delete(child.pid);
                resolve({ stdout, stderr: error.message, code: 1, pid: child.pid });
            });
        });
    }
    async installPackage(packageName, options = {}) {
        const manager = options.manager || 'npm';
        let command = manager;
        let args = [];
        switch (manager) {
            case 'npm':
                args = ['install'];
                if (options.global)
                    args.push('-g');
                if (options.dev)
                    args.push('--save-dev');
                args.push(packageName);
                break;
            case 'yarn':
                args = ['add'];
                if (options.global)
                    args = ['global', 'add'];
                if (options.dev)
                    args.push('--dev');
                args.push(packageName);
                break;
            case 'pnpm':
                args = ['add'];
                if (options.global)
                    args.push('-g');
                if (options.dev)
                    args.push('--save-dev');
                args.push(packageName);
                break;
        }
        console.log(chalk_1.default.blue(`📦 Installing ${packageName} with ${manager}...`));
        const result = await this.runCommand(command, args);
        if (result.code === 0) {
            console.log(chalk_1.default.green(`✅ Successfully installed ${packageName}`));
            return true;
        }
        else {
            console.log(chalk_1.default.red(`❌ Failed to install ${packageName}`));
            return false;
        }
    }
    async killProcess(pid) {
        try {
            process.kill(pid, 'SIGTERM');
            const processInfo = this.runningProcesses.get(pid);
            if (processInfo) {
                processInfo.status = 'killed';
                this.runningProcesses.delete(pid);
            }
            console.log(chalk_1.default.yellow(`⚠️ Process ${pid} terminated`));
            return true;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Could not kill process ${pid}`));
            return false;
        }
    }
    getRunningProcesses() {
        return Array.from(this.runningProcesses.values());
    }
    getCommandHistory(limit) {
        return limit ? this.commandHistory.slice(-limit) : this.commandHistory;
    }
    addToHistory(command, success, output) {
        this.commandHistory.push({
            command,
            timestamp: new Date(),
            success,
            output: output.slice(0, 1000), // Limit output size
        });
        // Keep only last 100 commands
        if (this.commandHistory.length > 100) {
            this.commandHistory = this.commandHistory.slice(-100);
        }
    }
    // Build and Test Operations
    async build(framework) {
        let buildCommand = 'npm run build';
        if (framework === 'next')
            buildCommand = 'npm run build';
        else if (framework === 'react')
            buildCommand = 'npm run build';
        else if (framework === 'node')
            buildCommand = 'npm run build';
        const result = await this.runCommand('npm', ['run', 'build']);
        const errors = this.parseErrors(result.stderr);
        return {
            success: result.code === 0,
            output: result.stdout + result.stderr,
            errors: errors.length > 0 ? errors : undefined,
        };
    }
    async runTests(testPattern) {
        const args = ['test'];
        if (testPattern)
            args.push(testPattern);
        const result = await this.runCommand('npm', args);
        const errors = this.parseErrors(result.stderr);
        return {
            success: result.code === 0,
            output: result.stdout + result.stderr,
            errors: errors.length > 0 ? errors : undefined,
        };
    }
    async lint(filePath) {
        const args = ['run', 'lint'];
        if (filePath)
            args.push(filePath);
        const result = await this.runCommand('npm', args);
        const errors = this.parseErrors(result.stderr);
        return {
            success: result.code === 0,
            output: result.stdout + result.stderr,
            errors: errors.length > 0 ? errors : undefined,
        };
    }
    async typeCheck() {
        const result = await this.runCommand('npx', ['tsc', '--noEmit']);
        const errors = this.parseTypeErrors(result.stderr);
        return {
            success: result.code === 0,
            output: result.stdout + result.stderr,
            errors: errors.length > 0 ? errors : undefined,
        };
    }
    // Error Analysis
    parseErrors(output) {
        const errors = [];
        const lines = output.split('\n');
        for (const line of lines) {
            // Parse different error formats
            if (line.includes('Error:') || line.includes('error:')) {
                errors.push(this.parseErrorLine(line, 'error'));
            }
            else if (line.includes('Warning:') || line.includes('warning:')) {
                errors.push(this.parseErrorLine(line, 'warning'));
            }
        }
        return errors;
    }
    parseTypeErrors(output) {
        const errors = [];
        const lines = output.split('\n');
        for (const line of lines) {
            const match = line.match(/(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+TS(\d+):\s*(.+)/);
            if (match) {
                const [, file, line, column, severity, code, message] = match;
                errors.push({
                    type: 'type',
                    severity: severity,
                    message: `TS${code}: ${message}`,
                    file: path.relative(this.workingDirectory, file),
                    line: parseInt(line),
                    column: parseInt(column),
                });
            }
        }
        return errors;
    }
    parseErrorLine(line, severity) {
        // Basic error parsing - can be enhanced
        return {
            type: 'compile',
            severity,
            message: line.trim(),
        };
    }
    // Git Operations
    async gitStatus() {
        const result = await this.runCommand('git', ['status', '--porcelain']);
        const lines = result.stdout.split('\n').filter(Boolean);
        const modified = [];
        const untracked = [];
        const staged = [];
        for (const line of lines) {
            const status = line.slice(0, 2);
            const file = line.slice(3);
            if (status.includes('M'))
                modified.push(file);
            if (status.includes('??'))
                untracked.push(file);
            if (status[0] !== ' ' && status[0] !== '?')
                staged.push(file);
        }
        return { modified, untracked, staged };
    }
    async gitAdd(files) {
        await this.runCommand('git', ['add', ...files]);
        console.log(chalk_1.default.green(`✅ Added files to git: ${files.join(', ')}`));
    }
    async gitCommit(message) {
        await this.runCommand('git', ['commit', '-m', message]);
        console.log(chalk_1.default.green(`✅ Committed with message: ${message}`));
    }
    // System Information and Advanced Operations
    async getSystemInfo() {
        const platform = os.platform();
        const arch = os.arch();
        const nodeVersion = process.version;
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        // Get versions of common tools
        let npmVersion, gitVersion, dockerVersion;
        try {
            const npmResult = await this.runCommand('npm', ['--version']);
            npmVersion = npmResult.stdout.trim();
        }
        catch { }
        try {
            const gitResult = await this.runCommand('git', ['--version']);
            gitVersion = gitResult.stdout.match(/git version ([\d.]+)/)?.[1];
        }
        catch { }
        try {
            const dockerResult = await this.runCommand('docker', ['--version']);
            dockerVersion = dockerResult.stdout.match(/Docker version ([\d.]+)/)?.[1];
        }
        catch { }
        return {
            platform,
            arch,
            nodeVersion,
            npmVersion,
            gitVersion,
            dockerVersion,
            memory: {
                total: totalMemory,
                free: freeMemory,
                used: totalMemory - freeMemory,
            },
            cpus: os.cpus().length,
            uptime: os.uptime(),
        };
    }
    async runScript(scriptContent, options = {}) {
        const language = options.language || 'bash';
        let tempFile = options.file;
        if (!tempFile) {
            const tempDir = os.tmpdir();
            const extension = language === 'bash' ? '.sh' : language === 'python' ? '.py' : '.js';
            tempFile = path.join(tempDir, `script_${Date.now()}${extension}`);
            // Write script to temp file
            fs.writeFileSync(tempFile, scriptContent);
            if (language === 'bash') {
                fs.chmodSync(tempFile, '755');
            }
        }
        try {
            let result;
            switch (language) {
                case 'bash':
                    result = await this.runCommand('bash', [tempFile]);
                    break;
                case 'python':
                    result = await this.runCommand('python3', [tempFile]);
                    break;
                case 'node':
                    result = await this.runCommand('node', [tempFile]);
                    break;
                default:
                    throw new Error(`Unsupported script language: ${language}`);
            }
            // Clean up temp file if we created it
            if (!options.file) {
                try {
                    fs.unlinkSync(tempFile);
                }
                catch { }
            }
            return {
                success: result.code === 0,
                output: result.stdout + result.stderr,
            };
        }
        catch (error) {
            return {
                success: false,
                output: error.message,
            };
        }
    }
    async checkDependencies(dependencies) {
        const results = {};
        for (const dep of dependencies) {
            try {
                const result = await this.runCommand('which', [dep]);
                if (result.code === 0) {
                    try {
                        const versionResult = await this.runCommand(dep, ['--version']);
                        const version = versionResult.stdout.split('\n')[0];
                        results[dep] = { installed: true, version };
                    }
                    catch {
                        results[dep] = { installed: true };
                    }
                }
                else {
                    results[dep] = { installed: false };
                }
            }
            catch {
                results[dep] = { installed: false };
            }
        }
        return results;
    }
    async setupProject(projectType, projectName) {
        const commands = [];
        let success = false;
        const projectPath = path.join(this.workingDirectory, projectName);
        console.log(chalk_1.default.blue(`🚀 Setting up ${projectType} project: ${projectName}`));
        try {
            switch (projectType) {
                case 'next':
                    commands.push(`npx create-next-app@latest ${projectName} --typescript --tailwind --eslint --app --src-dir`);
                    await this.runCommand('npx', ['create-next-app@latest', projectName, '--typescript', '--tailwind', '--eslint', '--app', '--src-dir']);
                    break;
                case 'react':
                    commands.push(`npx create-react-app ${projectName} --template typescript`);
                    await this.runCommand('npx', ['create-react-app', projectName, '--template', 'typescript']);
                    break;
                case 'node':
                    commands.push(`mkdir ${projectName}`, 'cd ' + projectName, 'npm init -y', 'npm install -D typescript @types/node ts-node');
                    fs.mkdirSync(projectPath, { recursive: true });
                    await this.runCommand('npm', ['init', '-y'], { cwd: projectPath });
                    await this.runCommand('npm', ['install', '-D', 'typescript', '@types/node', 'ts-node'], { cwd: projectPath });
                    break;
                case 'express':
                    commands.push(`mkdir ${projectName}`, 'cd ' + projectName, 'npm init -y');
                    commands.push('npm install express', 'npm install -D typescript @types/node @types/express ts-node');
                    fs.mkdirSync(projectPath, { recursive: true });
                    await this.runCommand('npm', ['init', '-y'], { cwd: projectPath });
                    await this.runCommand('npm', ['install', 'express'], { cwd: projectPath });
                    await this.runCommand('npm', ['install', '-D', 'typescript', '@types/node', '@types/express', 'ts-node'], { cwd: projectPath });
                    break;
            }
            success = true;
            console.log(chalk_1.default.green(`✅ Project ${projectName} created successfully!`));
            console.log(chalk_1.default.gray(`📁 Location: ${projectPath}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to create project: ${error.message}`));
        }
        return { success, path: projectPath, commands };
    }
    async monitorLogs(logFile, callback) {
        console.log(chalk_1.default.blue(`👀 Monitoring logs: ${logFile}`));
        const child = (0, child_process_1.spawn)('tail', ['-f', logFile], {
            cwd: this.workingDirectory,
        });
        child.stdout?.on('data', (data) => {
            const lines = data.toString().split('\n').filter(Boolean);
            lines.forEach((line) => {
                console.log(chalk_1.default.cyan(`📝 ${line}`));
                callback?.(line);
            });
        });
        child.stderr?.on('data', (data) => {
            console.log(chalk_1.default.red(`❌ Log monitor error: ${data}`));
        });
        return child;
    }
    // Helper Methods
    getLanguageFromExtension(ext) {
        const languageMap = {
            js: 'javascript',
            jsx: 'javascript',
            ts: 'typescript',
            tsx: 'typescript',
            py: 'python',
            java: 'java',
            cpp: 'cpp',
            c: 'c',
            html: 'html',
            css: 'css',
            scss: 'scss',
            json: 'json',
            md: 'markdown',
            yml: 'yaml',
            yaml: 'yaml',
            xml: 'xml',
        };
        return languageMap[ext.toLowerCase()];
    }
    async analyzeProject() {
        const files = await this.listFiles('.');
        const structure = this.buildDirectoryStructure(files);
        let packageInfo;
        let framework;
        let technologies = [];
        try {
            const pkg = await this.readFile('package.json');
            packageInfo = JSON.parse(pkg.content);
            // Detect framework
            if (packageInfo.dependencies?.next)
                framework = 'Next.js';
            else if (packageInfo.dependencies?.react)
                framework = 'React';
            else if (packageInfo.dependencies?.express)
                framework = 'Express';
            else if (packageInfo.dependencies?.fastify)
                framework = 'Fastify';
            // Detect technologies
            Object.keys(packageInfo.dependencies || {}).forEach(dep => {
                if (dep.includes('typescript'))
                    technologies.push('TypeScript');
                if (dep.includes('tailwind'))
                    technologies.push('Tailwind CSS');
                if (dep.includes('prisma'))
                    technologies.push('Prisma');
                if (dep.includes('next'))
                    technologies.push('Next.js');
                if (dep.includes('react'))
                    technologies.push('React');
                if (dep.includes('vue'))
                    technologies.push('Vue.js');
                if (dep.includes('express'))
                    technologies.push('Express');
            });
        }
        catch (error) {
            // No package.json or invalid JSON
        }
        return {
            structure,
            packageInfo,
            framework,
            technologies: Array.from(new Set(technologies)),
        };
    }
    buildDirectoryStructure(files) {
        const structure = {};
        for (const file of files) {
            const parts = file.split('/');
            let current = structure;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    // It's a file
                    if (!current._files)
                        current._files = [];
                    current._files.push(part);
                }
                else {
                    // It's a directory
                    if (!current[part])
                        current[part] = {};
                    current = current[part];
                }
            }
        }
        return structure;
    }
}
exports.ToolsManager = ToolsManager;
exports.toolsManager = new ToolsManager();
