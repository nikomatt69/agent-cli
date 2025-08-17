"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VMOrchestrator = void 0;
const events_1 = require("events");
const cli_ui_1 = require("../utils/cli-ui");
class VMOrchestrator extends events_1.EventEmitter {
    constructor(containerManager) {
        super();
        this.activeContainers = new Map();
        this.containerMetrics = new Map();
        this.containerManager = containerManager;
        this.setupCleanupHandlers();
    }
    async createSecureContainer(config) {
        try {
            cli_ui_1.CliUI.logInfo(`🐳 Creating secure container for agent ${config.agentId}`);
            const containerName = `nikcli-vm-${config.agentId}-${Date.now()}`;
            const containerConfig = {
                name: containerName,
                image: 'node:20-alpine',
                environment: {
                    AGENT_ID: config.agentId,
                    SESSION_TOKEN: config.sessionToken,
                    PROXY_ENDPOINT: config.proxyEndpoint
                },
                volumes: [
                    `${containerName}-workspace:/workspace`,
                    '/var/run/docker.sock:/var/run/docker.sock'
                ],
                ports: [
                    `${this.generateVSCodePort()}:8080`
                ],
                security: {
                    readOnlyRootfs: false,
                    noNewPrivileges: true,
                    capabilities: {
                        drop: ['ALL'],
                        add: ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'SETGID', 'SETUID']
                    }
                },
                resources: {
                    memory: '2g',
                    cpuQuota: '1.0',
                    diskQuota: '10g'
                },
                network: {
                    mode: 'bridge',
                    isolate: true
                }
            };
            const containerId = await this.containerManager.createContainer(containerConfig);
            const containerInfo = {
                id: containerId,
                name: containerName,
                agentId: config.agentId,
                repositoryUrl: config.repositoryUrl,
                createdAt: new Date(),
                status: 'running',
                vscodePort: this.extractVSCodePort(containerConfig.ports[0])
            };
            this.activeContainers.set(containerId, containerInfo);
            await this.initializeContainer(containerId);
            cli_ui_1.CliUI.logSuccess(`✅ Secure container created: ${containerId}`);
            this.emit('container:created', { containerId, agentId: config.agentId });
            return containerId;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to create secure container: ${error.message}`);
            throw error;
        }
    }
    async initializeContainer(containerId) {
        cli_ui_1.CliUI.logInfo(`🔧 Initializing container ${containerId}`);
        const initCommands = [
            'apk add --no-cache git curl',
            'node --version && npm --version',
            'git --version && curl --version',
            'mkdir -p /workspace',
            'git config --global user.email "nikcli-agent@localhost"',
            'git config --global user.name "NikCLI Agent"',
            'git config --global init.defaultBranch main'
        ];
        for (let i = 0; i < initCommands.length; i++) {
            const command = initCommands[i];
            try {
                cli_ui_1.CliUI.logDebug(`Executing init command ${i + 1}/${initCommands.length}`);
                await this.executeCommand(containerId, command);
                if (i === 0) {
                    cli_ui_1.CliUI.logInfo('⏳ Waiting for packages to install...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    cli_ui_1.CliUI.logSuccess('✅ Packages installed');
                }
            }
            catch (error) {
                cli_ui_1.CliUI.logError(`Warning: Init command failed: ${command} - ${error.message}`);
                if (i === 0) {
                    throw new Error(`Critical: Package installation failed - ${error.message}`);
                }
            }
        }
        cli_ui_1.CliUI.logSuccess(`✅ Container ${containerId} initialized`);
    }
    async setupRepository(containerId, repositoryUrl) {
        try {
            cli_ui_1.CliUI.logInfo(`📦 Setting up repository ${repositoryUrl} in container`);
            const setupCommands = [
                'git config --global http.sslverify false',
                `cd /workspace && git clone ${repositoryUrl} repo`,
                'git config --global http.sslverify true',
                'cd /workspace/repo && if [ -f package.json ]; then npm install; fi',
                'if command -v pip3 >/dev/null 2>&1; then cd /workspace/repo && if [ -f requirements.txt ]; then pip3 install -r requirements.txt; fi; else echo "pip3 not found, skipping python deps"; fi',
                'chmod -R 755 /workspace'
            ];
            for (const command of setupCommands) {
                await this.executeCommand(containerId, command);
            }
            const containerInfo = this.activeContainers.get(containerId);
            if (containerInfo) {
                containerInfo.repositoryPath = '/workspace/repo';
                this.activeContainers.set(containerId, containerInfo);
            }
            cli_ui_1.CliUI.logSuccess(`✅ Repository setup completed in container ${containerId}`);
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to setup repository: ${error.message}`);
            throw error;
        }
    }
    async setupVSCodeServer(containerId) {
        try {
            cli_ui_1.CliUI.logInfo(`🛠️ Setting up development environment in container ${containerId}`);
            const devCommands = [
                'cd /workspace/repo && node --version',
                'cd /workspace/repo && [ -f package.json ] && npm install || echo "No package.json found, skipping npm install"'
            ];
            for (const command of devCommands) {
                await this.executeCommand(containerId, command);
            }
            cli_ui_1.CliUI.logSuccess(`✅ Development environment ready`);
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to setup development environment: ${error.message}`);
            throw error;
        }
    }
    async getContainerLogs(containerId, lines = 100) {
        return await this.containerManager.getContainerLogs(containerId, lines);
    }
    async setupDevelopmentEnvironment(containerId) {
        try {
            cli_ui_1.CliUI.logInfo(`🛠️ Setting up shell environment in container ${containerId}`);
            const devCommands = [
                'echo "cd /workspace/repo" >> ~/.bashrc',
                'echo "alias ll=\'ls -la\'" >> ~/.bashrc'
            ];
            for (const command of devCommands) {
                await this.executeCommand(containerId, command);
            }
            cli_ui_1.CliUI.logSuccess(`✅ Shell environment ready`);
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to setup shell environment: ${error.message}`);
            throw error;
        }
    }
    async executeCommand(containerId, command) {
        try {
            const result = await this.containerManager.executeCommand(containerId, command);
            cli_ui_1.CliUI.logDebug(`🔧 Container ${containerId.slice(0, 8)}: ${command}`);
            this.emit('command:executed', {
                containerId,
                command,
                result,
                timestamp: new Date()
            });
            return result;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Command failed in ${containerId.slice(0, 8)}: ${command}`);
            this.emit('command:error', {
                containerId,
                command,
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }
    async *executeCommandStreaming(containerId, command) {
        try {
            cli_ui_1.CliUI.logDebug(`🌊 Streaming command in ${containerId.slice(0, 8)}: ${command}`);
            yield {
                type: 'start',
                containerId,
                command,
                timestamp: new Date()
            };
            const result = await this.containerManager.executeCommand(containerId, command);
            const lines = result.split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    yield {
                        type: 'output',
                        containerId,
                        command,
                        output: line + '\n',
                        timestamp: new Date()
                    };
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
            yield {
                type: 'complete',
                containerId,
                command,
                finalOutput: result,
                timestamp: new Date()
            };
            this.emit('command:executed', {
                containerId,
                command,
                result,
                timestamp: new Date()
            });
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Streaming command failed in ${containerId.slice(0, 8)}: ${command}`);
            yield {
                type: 'error',
                containerId,
                command,
                error: error.message,
                timestamp: new Date()
            };
            this.emit('command:error', {
                containerId,
                command,
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }
    async createPullRequest(containerId, prConfig) {
        try {
            cli_ui_1.CliUI.logInfo(`📝 Creating pull request from container ${containerId}`);
            const branchName = prConfig.branch || `automated-changes-${Date.now()}`;
            const prCommands = [
                'cd /workspace/repo',
                `git checkout -b ${branchName}`,
                `git push -u origin ${branchName}`
            ];
            for (const command of prCommands) {
                await this.executeCommand(containerId, command);
            }
            const active = this.activeContainers.get(containerId);
            const prUrl = await this.createGitHubPullRequest({ ...prConfig, repositoryUrl: active?.repositoryUrl }, branchName);
            cli_ui_1.CliUI.logSuccess(`✅ Pull request created: ${prUrl}`);
            return prUrl;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to create pull request: ${error.message}`);
            throw error;
        }
    }
    async createGitHubPullRequest(prConfig, branchName) {
        try {
            const fetchFn = global.fetch;
            const repoMatch = prConfig.repositoryUrl?.match(/github\.com[\/:]([^\/:]+)\/([^\/]+)(?:\.git)?/);
            if (!repoMatch) {
                throw new Error('Invalid GitHub repository URL');
            }
            const [, owner, rawRepo] = repoMatch;
            const repoName = rawRepo.replace(/\.git$/, '');
            const githubToken = process.env.GITHUB_TOKEN;
            if (!githubToken || !fetchFn) {
                cli_ui_1.CliUI.logWarning('⚠️ Missing fetch or GITHUB_TOKEN; returning manual PR URL');
                return `https://github.com/${owner}/${repoName}/compare/${branchName}?expand=1&title=${encodeURIComponent(prConfig.title)}&body=${encodeURIComponent(prConfig.description)}`;
            }
            let baseBranch = prConfig.baseBranch;
            if (!baseBranch) {
                try {
                    const repoResp = await fetchFn(`https://api.github.com/repos/${owner}/${repoName}`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${githubToken}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'NikCLI-VM-Agent'
                        }
                    });
                    if (repoResp.ok) {
                        const repoInfo = await repoResp.json();
                        baseBranch = repoInfo.default_branch || 'main';
                    }
                    else {
                        baseBranch = 'main';
                    }
                }
                catch {
                    baseBranch = 'main';
                }
            }
            const headRef = `${owner}:${branchName}`;
            const response = await fetchFn(`https://api.github.com/repos/${owner}/${repoName}/pulls`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'NikCLI-VM-Agent'
                },
                body: JSON.stringify({
                    title: prConfig.title,
                    body: prConfig.description,
                    head: headRef,
                    base: baseBranch,
                    draft: prConfig.draft || false
                })
            });
            if (!response.ok) {
                const error = await response.json();
                if (response.status === 422 && typeof error?.message === 'string' && error.message.toLowerCase().includes('a pull request already exists')) {
                    try {
                        const existingResp = await fetchFn(`https://api.github.com/repos/${owner}/${repoName}/pulls?head=${encodeURIComponent(headRef)}&state=open`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${githubToken}`,
                                'Accept': 'application/vnd.github.v3+json',
                                'User-Agent': 'NikCLI-VM-Agent'
                            }
                        });
                        if (existingResp.ok) {
                            const prs = await existingResp.json();
                            if (Array.isArray(prs) && prs.length > 0) {
                                return prs[0].html_url;
                            }
                        }
                    }
                    catch {
                    }
                }
                throw new Error(`GitHub API error: ${error?.message || response.statusText}`);
            }
            const pullRequest = await response.json();
            return pullRequest.html_url;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to create GitHub PR: ${error.message}`);
            const repoMatch = prConfig.repositoryUrl?.match(/github\.com[\/:]([^\/:]+)\/([^\/]+)(?:\.git)?/);
            if (repoMatch) {
                const [, owner, repo] = repoMatch;
                const repoName = repo.replace(/\.git$/, '');
                return `https://github.com/${owner}/${repoName}/compare/${branchName}?expand=1&title=${encodeURIComponent(prConfig.title)}&body=${encodeURIComponent(prConfig.description)}`;
            }
            throw error;
        }
    }
    async stopContainer(containerId) {
        try {
            cli_ui_1.CliUI.logInfo(`🛑 Stopping container ${containerId}`);
            await this.containerManager.stopContainer(containerId);
            const containerInfo = this.activeContainers.get(containerId);
            if (containerInfo) {
                containerInfo.status = 'stopped';
                this.activeContainers.set(containerId, containerInfo);
            }
            this.emit('container:stopped', { containerId });
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to stop container: ${error.message}`);
            throw error;
        }
    }
    async removeContainer(containerId) {
        try {
            cli_ui_1.CliUI.logInfo(`🗑️ Removing container ${containerId}`);
            await this.containerManager.removeContainer(containerId);
            this.activeContainers.delete(containerId);
            this.containerMetrics.delete(containerId);
            this.emit('container:removed', { containerId });
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to remove container: ${error.message}`);
            throw error;
        }
    }
    async getContainerMetrics(containerId) {
        try {
            const stats = await this.containerManager.getContainerStats(containerId);
            const metrics = {
                memoryUsage: stats.memory_usage || 0,
                cpuUsage: stats.cpu_usage || 0,
                diskUsage: stats.disk_usage || 0,
                networkActivity: stats.network_activity || 0,
                uptime: stats.uptime || 0
            };
            this.containerMetrics.set(containerId, metrics);
            return metrics;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to get container metrics: ${error.message}`);
            return {
                memoryUsage: 0,
                cpuUsage: 0,
                diskUsage: 0,
                networkActivity: 0,
                uptime: 0
            };
        }
    }
    async getVSCodePort(containerId) {
        const containerInfo = this.activeContainers.get(containerId);
        return containerInfo?.vscodePort || 8080;
    }
    getActiveContainers() {
        return Array.from(this.activeContainers.values());
    }
    generateVSCodePort() {
        return Math.floor(Math.random() * (9000 - 8080 + 1)) + 8080;
    }
    extractVSCodePort(portMapping) {
        const match = portMapping.match(/^(\d+):/);
        return match ? parseInt(match[1]) : 8080;
    }
    setupCleanupHandlers() {
        process.on('SIGINT', () => this.cleanupAllContainers());
        process.on('SIGTERM', () => this.cleanupAllContainers());
        process.on('exit', () => this.cleanupAllContainers());
    }
    async cleanupAllContainers() {
        cli_ui_1.CliUI.logInfo(`🧹 Cleaning up ${this.activeContainers.size} active containers`);
        const cleanupPromises = Array.from(this.activeContainers.keys()).map(async (containerId) => {
            try {
                await this.stopContainer(containerId);
                await this.removeContainer(containerId);
            }
            catch (error) {
                cli_ui_1.CliUI.logError(`Error cleaning up container ${containerId}: ${error.message}`);
            }
        });
        await Promise.allSettled(cleanupPromises);
    }
}
exports.VMOrchestrator = VMOrchestrator;
