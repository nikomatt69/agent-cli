"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LSP_SERVERS = void 0;
exports.getApplicableLSPServers = getApplicableLSPServers;
exports.findLSPWorkspaceRoot = findLSPWorkspaceRoot;
exports.ensureLSPDependencies = ensureLSPDependencies;
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
const chalk_1 = __importDefault(require("chalk"));
// Find workspace root by walking up directory tree
function findWorkspaceRoot(startPath, patterns) {
    let currentPath = (0, path_1.resolve)(startPath);
    const root = (0, path_1.resolve)('/');
    while (currentPath !== root) {
        for (const pattern of patterns) {
            const patternPath = (0, path_1.join)(currentPath, pattern);
            if ((0, fs_1.existsSync)(patternPath)) {
                return currentPath;
            }
        }
        currentPath = (0, path_1.dirname)(currentPath);
    }
    return undefined;
}
// Check if command exists in PATH
function commandExists(command) {
    try {
        const { execSync } = require('child_process');
        execSync(`which ${command}`, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
exports.LSP_SERVERS = {
    typescript: {
        id: 'typescript',
        name: 'TypeScript Language Server',
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'],
        rootPatterns: ['package.json', 'tsconfig.json', 'jsconfig.json'],
        async spawn(workspaceRoot) {
            try {
                // Try to find typescript-language-server
                if (!commandExists('typescript-language-server')) {
                    console.log(chalk_1.default.yellow('📦 Installing typescript-language-server...'));
                    const installProcess = (0, child_process_1.spawn)('yarn', ['global', 'add', 'typescript-language-server', 'typescript'], {
                        cwd: workspaceRoot,
                        stdio: 'inherit'
                    });
                    await new Promise((resolve, reject) => {
                        installProcess.on('close', (code) => {
                            if (code === 0)
                                resolve(undefined);
                            else
                                reject(new Error(`Installation failed with code ${code}`));
                        });
                    });
                }
                const process = (0, child_process_1.spawn)('typescript-language-server', ['--stdio'], {
                    cwd: workspaceRoot,
                    stdio: ['pipe', 'pipe', 'inherit']
                });
                return {
                    process,
                    initialization: {
                        preferences: {
                            includeCompletionsForModuleExports: true,
                            includeCompletionsWithInsertText: true,
                        },
                        typescript: {
                            suggest: {
                                autoImports: true,
                            },
                        },
                    },
                };
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Failed to start TypeScript LSP: ${error}`));
                return undefined;
            }
        },
    },
    python: {
        id: 'python',
        name: 'Pylsp (Python LSP Server)',
        extensions: ['.py', '.pyi'],
        rootPatterns: ['pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt', 'Pipfile'],
        async spawn(workspaceRoot) {
            try {
                // Check if pylsp is available
                if (!commandExists('pylsp')) {
                    console.log(chalk_1.default.yellow('📦 Installing python-lsp-server...'));
                    const installProcess = (0, child_process_1.spawn)('pip', ['install', 'python-lsp-server[all]'], {
                        cwd: workspaceRoot,
                        stdio: 'inherit'
                    });
                    await new Promise((resolve, reject) => {
                        installProcess.on('close', (code) => {
                            if (code === 0)
                                resolve(undefined);
                            else
                                reject(new Error(`Installation failed with code ${code}`));
                        });
                    });
                }
                const process = (0, child_process_1.spawn)('pylsp', [], {
                    cwd: workspaceRoot,
                    stdio: ['pipe', 'pipe', 'inherit']
                });
                return {
                    process,
                    initialization: {
                        plugins: {
                            pycodestyle: { enabled: false },
                            mccabe: { enabled: false },
                            pyflakes: { enabled: true },
                            autopep8: { enabled: true },
                            yapf: { enabled: false },
                        },
                    },
                };
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Failed to start Python LSP: ${error}`));
                return undefined;
            }
        },
    },
    rust: {
        id: 'rust',
        name: 'Rust Analyzer',
        extensions: ['.rs'],
        rootPatterns: ['Cargo.toml', 'Cargo.lock'],
        async spawn(workspaceRoot) {
            try {
                if (!commandExists('rust-analyzer')) {
                    console.log(chalk_1.default.yellow('📦 Installing rust-analyzer...'));
                    const installProcess = (0, child_process_1.spawn)('rustup', ['component', 'add', 'rust-analyzer'], {
                        cwd: workspaceRoot,
                        stdio: 'inherit'
                    });
                    await new Promise((resolve, reject) => {
                        installProcess.on('close', (code) => {
                            if (code === 0)
                                resolve(undefined);
                            else
                                reject(new Error(`Installation failed with code ${code}`));
                        });
                    });
                }
                const process = (0, child_process_1.spawn)('rust-analyzer', [], {
                    cwd: workspaceRoot,
                    stdio: ['pipe', 'pipe', 'inherit']
                });
                return { process };
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Failed to start Rust Analyzer: ${error}`));
                return undefined;
            }
        },
    },
    go: {
        id: 'go',
        name: 'Gopls (Go Language Server)',
        extensions: ['.go'],
        rootPatterns: ['go.mod', 'go.sum', 'go.work'],
        async spawn(workspaceRoot) {
            try {
                if (!commandExists('gopls')) {
                    console.log(chalk_1.default.yellow('📦 Installing gopls...'));
                    const installProcess = (0, child_process_1.spawn)('go', ['install', 'golang.org/x/tools/gopls@latest'], {
                        cwd: workspaceRoot,
                        stdio: 'inherit',
                        env: { ...process.env, GO111MODULE: 'on' }
                    });
                    await new Promise((resolve, reject) => {
                        installProcess.on('close', (code) => {
                            if (code === 0)
                                resolve(undefined);
                            else
                                reject(new Error(`Installation failed with code ${code}`));
                        });
                    });
                }
                const goplsProcess = (0, child_process_1.spawn)('gopls', [], {
                    cwd: workspaceRoot,
                    stdio: ['pipe', 'pipe', 'inherit']
                });
                return { process: goplsProcess };
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Failed to start Gopls: ${error}`));
                return undefined;
            }
        },
    },
    java: {
        id: 'java',
        name: 'Eclipse JDT Language Server',
        extensions: ['.java'],
        rootPatterns: ['pom.xml', 'build.gradle', 'build.xml', '.project'],
        async spawn(workspaceRoot) {
            try {
                // This is a simplified version - full Java LSP setup is complex
                console.log(chalk_1.default.yellow('⚠️ Java LSP requires manual Eclipse JDT Language Server setup'));
                return undefined;
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Failed to start Java LSP: ${error}`));
                return undefined;
            }
        },
    },
    ruby: {
        id: 'ruby',
        name: 'Ruby LSP',
        extensions: ['.rb', '.rake', '.gemspec', '.ru'],
        rootPatterns: ['Gemfile', 'Rakefile'],
        async spawn(workspaceRoot) {
            try {
                if (!commandExists('ruby-lsp')) {
                    console.log(chalk_1.default.yellow('📦 Installing ruby-lsp...'));
                    const installProcess = (0, child_process_1.spawn)('gem', ['install', 'ruby-lsp'], {
                        cwd: workspaceRoot,
                        stdio: 'inherit'
                    });
                    await new Promise((resolve, reject) => {
                        installProcess.on('close', (code) => {
                            if (code === 0)
                                resolve(undefined);
                            else
                                reject(new Error(`Installation failed with code ${code}`));
                        });
                    });
                }
                const process = (0, child_process_1.spawn)('ruby-lsp', ['--stdio'], {
                    cwd: workspaceRoot,
                    stdio: ['pipe', 'pipe', 'inherit']
                });
                return { process };
            }
            catch (error) {
                console.log(chalk_1.default.red(`❌ Failed to start Ruby LSP: ${error}`));
                return undefined;
            }
        },
    }
};
// Get appropriate LSP servers for a file
function getApplicableLSPServers(filePath) {
    const extension = (0, path_1.extname)(filePath);
    const servers = [];
    for (const server of Object.values(exports.LSP_SERVERS)) {
        if (server.extensions.includes(extension)) {
            servers.push(server);
        }
    }
    return servers;
}
// Find workspace root for a file using LSP server patterns
function findLSPWorkspaceRoot(filePath, serverInfo) {
    if (serverInfo) {
        return findWorkspaceRoot((0, path_1.dirname)(filePath), serverInfo.rootPatterns);
    }
    // Try all server patterns
    for (const server of Object.values(exports.LSP_SERVERS)) {
        const root = findWorkspaceRoot((0, path_1.dirname)(filePath), server.rootPatterns);
        if (root)
            return root;
    }
    return undefined;
}
// Auto-install missing LSP dependencies
async function ensureLSPDependencies(serverIds) {
    console.log(chalk_1.default.blue('🔍 Checking LSP server dependencies...'));
    const installPromises = [];
    for (const serverId of serverIds) {
        const server = exports.LSP_SERVERS[serverId];
        if (!server)
            continue;
        // Check if server command exists
        if (serverId === 'typescript' && !commandExists('typescript-language-server')) {
            installPromises.push(installTypeScriptLSP());
        }
        else if (serverId === 'python' && !commandExists('pylsp')) {
            installPromises.push(installPythonLSP());
        }
        else if (serverId === 'rust' && !commandExists('rust-analyzer')) {
            installPromises.push(installRustAnalyzer());
        }
        else if (serverId === 'go' && !commandExists('gopls')) {
            installPromises.push(installGopls());
        }
        else if (serverId === 'ruby' && !commandExists('ruby-lsp')) {
            installPromises.push(installRubyLSP());
        }
    }
    if (installPromises.length > 0) {
        await Promise.allSettled(installPromises);
        console.log(chalk_1.default.green('✅ LSP dependencies check completed'));
    }
}
// Individual LSP installer functions
async function installTypeScriptLSP() {
    console.log(chalk_1.default.yellow('📦 Installing TypeScript Language Server...'));
    return new Promise((resolve, reject) => {
        const process = (0, child_process_1.spawn)('yarn', ['global', 'add', 'typescript-language-server', 'typescript'], {
            stdio: 'inherit'
        });
        process.on('close', (code) => {
            if (code === 0) {
                console.log(chalk_1.default.green('✅ TypeScript LSP installed'));
                resolve();
            }
            else {
                console.log(chalk_1.default.red('❌ TypeScript LSP installation failed'));
                reject(new Error(`Installation failed with code ${code}`));
            }
        });
    });
}
async function installPythonLSP() {
    console.log(chalk_1.default.yellow('📦 Installing Python LSP Server...'));
    return new Promise((resolve, reject) => {
        const process = (0, child_process_1.spawn)('pip', ['install', 'python-lsp-server[all]'], {
            stdio: 'inherit'
        });
        process.on('close', (code) => {
            if (code === 0) {
                console.log(chalk_1.default.green('✅ Python LSP installed'));
                resolve();
            }
            else {
                console.log(chalk_1.default.red('❌ Python LSP installation failed'));
                reject(new Error(`Installation failed with code ${code}`));
            }
        });
    });
}
async function installRustAnalyzer() {
    console.log(chalk_1.default.yellow('📦 Installing Rust Analyzer...'));
    return new Promise((resolve, reject) => {
        const process = (0, child_process_1.spawn)('rustup', ['component', 'add', 'rust-analyzer'], {
            stdio: 'inherit'
        });
        process.on('close', (code) => {
            if (code === 0) {
                console.log(chalk_1.default.green('✅ Rust Analyzer installed'));
                resolve();
            }
            else {
                console.log(chalk_1.default.red('❌ Rust Analyzer installation failed'));
                reject(new Error(`Installation failed with code ${code}`));
            }
        });
    });
}
async function installGopls() {
    console.log(chalk_1.default.yellow('📦 Installing Gopls...'));
    return new Promise((resolve, reject) => {
        const childProcess = (0, child_process_1.spawn)('go', ['install', 'golang.org/x/tools/gopls@latest'], {
            stdio: 'inherit',
            env: { NODE_ENV: process.env.NODE_ENV }
        });
        childProcess.on('close', (code) => {
            if (code === 0) {
                console.log(chalk_1.default.green('✅ Gopls installed'));
                resolve();
            }
            else {
                console.log(chalk_1.default.red('❌ Gopls installation failed'));
                reject(new Error(`Installation failed with code ${code}`));
            }
        });
    });
}
async function installRubyLSP() {
    console.log(chalk_1.default.yellow('📦 Installing Ruby LSP...'));
    return new Promise((resolve, reject) => {
        const process = (0, child_process_1.spawn)('gem', ['install', 'ruby-lsp'], {
            stdio: 'inherit'
        });
        process.on('close', (code) => {
            if (code === 0) {
                console.log(chalk_1.default.green('✅ Ruby LSP installed'));
                resolve();
            }
            else {
                console.log(chalk_1.default.red('❌ Ruby LSP installation failed'));
                reject(new Error(`Installation failed with code ${code}`));
            }
        });
    });
}
