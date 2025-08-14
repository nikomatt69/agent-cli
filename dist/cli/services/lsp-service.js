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
exports.lspService = exports.LSPService = void 0;
const chalk_1 = __importDefault(require("chalk"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
class LSPService {
    constructor() {
        this.servers = new Map();
        this.workingDirectory = process.cwd();
        this.initializeDefaultServers();
    }
    setWorkingDirectory(dir) {
        this.workingDirectory = dir;
    }
    initializeDefaultServers() {
        this.servers.set('typescript', {
            name: 'TypeScript Language Server',
            command: 'typescript-language-server',
            args: ['--stdio'],
            filetypes: ['.ts', '.tsx', '.js', '.jsx'],
            status: 'stopped'
        });
        this.servers.set('python', {
            name: 'Python Language Server',
            command: 'pylsp',
            args: [],
            filetypes: ['.py'],
            status: 'stopped'
        });
        this.servers.set('rust', {
            name: 'Rust Analyzer',
            command: 'rust-analyzer',
            args: [],
            filetypes: ['.rs'],
            status: 'stopped'
        });
    }
    async startServer(serverName) {
        const server = this.servers.get(serverName);
        if (!server) {
            console.log(chalk_1.default.red(`LSP server '${serverName}' not found`));
            return false;
        }
        if (server.status === 'running') {
            console.log(chalk_1.default.yellow(`LSP server '${serverName}' is already running`));
            return true;
        }
        try {
            server.status = 'starting';
            console.log(chalk_1.default.blue(`🚀 Starting ${server.name}...`));
            const process = (0, child_process_1.spawn)(server.command, server.args, {
                cwd: this.workingDirectory,
                stdio: 'pipe'
            });
            server.process = process;
            process.on('spawn', () => {
                server.status = 'running';
                console.log(chalk_1.default.green(`✅ ${server.name} started successfully`));
            });
            process.on('error', (error) => {
                server.status = 'error';
                console.log(chalk_1.default.red(`❌ Failed to start ${server.name}: ${error.message}`));
            });
            process.on('exit', (code) => {
                server.status = 'stopped';
                console.log(chalk_1.default.yellow(`⏹️  ${server.name} stopped (code: ${code})`));
            });
            return true;
        }
        catch (error) {
            server.status = 'error';
            console.log(chalk_1.default.red(`❌ Failed to start ${server.name}: ${error.message}`));
            return false;
        }
    }
    async stopServer(serverName) {
        const server = this.servers.get(serverName);
        if (!server || !server.process) {
            console.log(chalk_1.default.yellow(`LSP server '${serverName}' is not running`));
            return false;
        }
        server.process.kill();
        server.status = 'stopped';
        console.log(chalk_1.default.green(`✅ Stopped ${server.name}`));
        return true;
    }
    getServerStatus() {
        return Array.from(this.servers.values()).map(server => ({
            name: server.name,
            status: server.status,
            filetypes: server.filetypes
        }));
    }
    async autoStartServers(projectPath) {
        const detectedLanguages = this.detectProjectLanguages(projectPath);
        console.log(chalk_1.default.cyan(`🔍 Detected languages: ${detectedLanguages.join(', ')}`));
        for (const lang of detectedLanguages) {
            const serverName = this.getServerForLanguage(lang);
            if (serverName) {
                await this.startServer(serverName);
            }
        }
    }
    detectProjectLanguages(projectPath) {
        const languages = [];
        try {
            const files = fs.readdirSync(projectPath);
            if (files.includes('tsconfig.json') || files.includes('package.json')) {
                languages.push('typescript');
            }
            if (files.includes('Cargo.toml')) {
                languages.push('rust');
            }
            if (files.includes('pyproject.toml') || files.includes('requirements.txt')) {
                languages.push('python');
            }
        }
        catch (error) {
        }
        return languages;
    }
    getServerForLanguage(language) {
        const mapping = {
            'typescript': 'typescript',
            'javascript': 'typescript',
            'python': 'python',
            'rust': 'rust'
        };
        return mapping[language] || null;
    }
}
exports.LSPService = LSPService;
exports.lspService = new LSPService();
