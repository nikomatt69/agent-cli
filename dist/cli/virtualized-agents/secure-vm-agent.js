"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureVirtualizedAgent = void 0;
const events_1 = require("events");
const container_manager_1 = require("./container-manager");
const vm_orchestrator_1 = require("./vm-orchestrator");
const api_key_proxy_1 = require("./security/api-key-proxy");
const token_manager_1 = require("./security/token-manager");
const cli_ui_1 = require("../utils/cli-ui");
class SecureVirtualizedAgent extends events_1.EventEmitter {
    constructor(workingDirectory, config = {}) {
        super();
        this.version = '0.1.15-beta';
        this.status = 'initializing';
        this.currentTasks = 0;
        this.maxConcurrentTasks = 1;
        this.vmState = 'stopped';
        this.tokenUsed = 0;
        this.requestCount = 0;
        this.id = config.agentId || `vm-agent-${Date.now()}`;
        this.name = config.name || 'Secure VM Agent';
        this.description = config.description || 'Autonomous development agent with isolated VM environment';
        this.capabilities = config.capabilities || [
            'repository-analysis', 'code-generation', 'testing',
            'documentation', 'refactoring', 'pull-request-creation'
        ];
        this.specialization = config.specialization || 'autonomous-development';
        this.containerManager = new container_manager_1.ContainerManager();
        this.vmOrchestrator = new vm_orchestrator_1.VMOrchestrator(this.containerManager);
        this.apiProxy = api_key_proxy_1.APIKeyProxy.getInstance();
        this.tokenManager = token_manager_1.TokenManager.getInstance();
        this.tokenBudget = config.tokenBudget || 50000;
        this.vmMetrics = {
            memoryUsage: 0,
            cpuUsage: 0,
            diskUsage: 0,
            networkActivity: 0,
            uptime: 0
        };
        this.setupVMEventHandlers();
    }
    async onInitialize() {
        try {
            cli_ui_1.CliUI.logInfo(`🔐 Initializing secure VM agent: ${this.id}`);
            this.sessionJWT = await this.tokenManager.generateSessionToken(this.id, {
                tokenBudget: this.tokenBudget,
                capabilities: this.capabilities,
                ttl: 3600
            });
            await this.apiProxy.registerAgent(this.id, this.sessionJWT);
            cli_ui_1.CliUI.logSuccess(`✅ VM agent ${this.id} security initialized`);
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to initialize VM agent security: ${error.message}`);
            throw error;
        }
    }
    async initialize(context) {
        try {
            this.status = 'initializing';
            cli_ui_1.CliUI.logInfo(`🔐 Initializing secure VM agent: ${this.id}`);
            try {
                await this.apiProxy.getEndpoint();
            }
            catch (proxyError) {
                cli_ui_1.CliUI.logInfo(`🚀 Starting API proxy server...`);
                await this.apiProxy.start();
            }
            this.sessionJWT = await this.tokenManager.generateSessionToken(this.id, {
                tokenBudget: this.tokenBudget,
                capabilities: this.capabilities,
                ttl: 3600
            });
            await this.apiProxy.registerAgent(this.id, this.sessionJWT);
            this.status = 'ready';
            cli_ui_1.CliUI.logSuccess(`✅ VM agent ${this.id} security initialized`);
        }
        catch (error) {
            this.status = 'error';
            cli_ui_1.CliUI.logError(`❌ Failed to initialize VM agent security: ${error.message}`);
            throw error;
        }
    }
    async executeTask(task) {
        const startTime = new Date();
        this.currentTasks++;
        this.status = 'busy';
        try {
            cli_ui_1.CliUI.logInfo(`🚀 VM Agent ${this.id} starting autonomous task`);
            const repoUrl = this.extractRepositoryUrl(task);
            if (!repoUrl) {
                throw new Error('No repository URL found in task');
            }
            await this.startVMEnvironment(repoUrl);
            const result = await this.executeAutonomousWorkflow(task);
            if (task.data?.createPR !== false) {
                await this.createPullRequest(result);
            }
            this.status = 'ready';
            this.currentTasks--;
            return {
                taskId: task.id,
                agentId: this.id,
                status: 'completed',
                startTime,
                endTime: new Date(),
                result,
                duration: Date.now() - startTime.getTime()
            };
        }
        catch (error) {
            this.status = 'error';
            this.currentTasks--;
            cli_ui_1.CliUI.logError(`❌ VM Agent task failed: ${error.message}`);
            return {
                taskId: task.id,
                agentId: this.id,
                status: 'failed',
                startTime,
                endTime: new Date(),
                error: error.message,
                duration: Date.now() - startTime.getTime()
            };
        }
    }
    getMetrics() {
        return {
            vmState: this.vmState,
            tokenUsage: this.getTokenUsage(),
            containerId: this.containerId,
            uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
            vscodePort: this.vscodeServerPort,
            requestCount: this.requestCount
        };
    }
    canHandle(task) {
        const taskDesc = task.description.toLowerCase();
        const hasRepo = this.extractRepositoryUrl(task) !== null;
        return hasRepo ||
            taskDesc.includes('repository') ||
            taskDesc.includes('analizza') ||
            taskDesc.includes('autonomous') ||
            this.capabilities.some(cap => taskDesc.includes(cap.toLowerCase()));
    }
    async onExecuteTask(task) {
        try {
            cli_ui_1.CliUI.logInfo(`🚀 VM Agent ${this.id} starting autonomous task`);
            const repoUrl = this.extractRepositoryUrl(task);
            if (!repoUrl) {
                throw new Error('No repository URL found in task');
            }
            await this.startVMEnvironment(repoUrl);
            const result = await this.executeAutonomousWorkflow(task);
            if (task.data?.createPR !== false) {
                await this.createPullRequest(result);
            }
            return result;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ VM Agent task failed: ${error.message}`);
            throw error;
        }
    }
    async onStop() {
        try {
            cli_ui_1.CliUI.logInfo(`🛑 Stopping VM agent: ${this.id}`);
            if (this.containerId) {
                await this.stopVMEnvironment();
            }
            await this.cleanupSecurity();
            cli_ui_1.CliUI.logSuccess(`✅ VM agent ${this.id} stopped and cleaned up`);
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Error stopping VM agent: ${error.message}`);
        }
    }
    async run(task) {
        const startTime = new Date();
        try {
            const result = await this.onExecuteTask(task);
            return {
                taskId: task.id,
                agentId: this.id,
                status: 'completed',
                startTime,
                endTime: new Date(),
                result,
                duration: Date.now() - startTime.getTime()
            };
        }
        catch (error) {
            return {
                taskId: task.id,
                agentId: this.id,
                status: 'failed',
                startTime,
                endTime: new Date(),
                error: error.message,
                duration: Date.now() - startTime.getTime()
            };
        }
    }
    async executeTodo(todo) {
        const task = {
            id: todo.id,
            title: todo.title,
            description: todo.description,
            type: 'vm-todo',
            priority: todo.priority,
            status: 'pending',
            createdAt: todo.createdAt,
            updatedAt: todo.updatedAt,
            data: { todo },
            progress: 0
        };
        await this.executeTask(task);
    }
    getStatus() {
        return this.status;
    }
    getCapabilities() {
        return [...this.capabilities];
    }
    updateGuidance(guidance) {
        cli_ui_1.CliUI.logDebug(`VM agent ${this.id} ignoring guidance update`);
    }
    updateConfiguration(config) {
        if (config.maxConcurrentTasks) {
            this.maxConcurrentTasks = config.maxConcurrentTasks;
        }
        if (config.maxTokens) {
            this.tokenBudget = config.maxTokens;
        }
        cli_ui_1.CliUI.logInfo(`VM agent ${this.id} configuration updated`);
    }
    async cleanup() {
        return await this.onStop();
    }
    async startVMEnvironment(repoUrl) {
        try {
            this.vmState = 'starting';
            this.startTime = new Date();
            cli_ui_1.CliUI.logInfo(`🐳 Creating isolated VM container for ${repoUrl}`);
            this.containerId = await this.vmOrchestrator.createSecureContainer({
                agentId: this.id,
                repositoryUrl: repoUrl,
                sessionToken: this.sessionJWT,
                proxyEndpoint: await this.apiProxy.getEndpoint(),
                capabilities: this.capabilities
            });
            await this.vmOrchestrator.setupRepository(this.containerId, repoUrl);
            this.repositoryPath = '/workspace/repo';
            await this.vmOrchestrator.setupVSCodeServer(this.containerId);
            await this.vmOrchestrator.setupDevelopmentEnvironment(this.containerId);
            this.vmState = 'running';
            this.vscodeServerPort = await this.vmOrchestrator.getVSCodePort(this.containerId);
            cli_ui_1.CliUI.logSuccess(`✅ VM environment ready - VS Code available on port ${this.vscodeServerPort}`);
        }
        catch (error) {
            this.vmState = 'error';
            throw new Error(`Failed to start VM environment: ${error.message}`);
        }
    }
    async executeAutonomousWorkflow(task) {
        if (!this.containerId) {
            throw new Error('VM environment not initialized');
        }
        cli_ui_1.CliUI.logInfo(`🤖 Executing autonomous workflow in VM`);
        const workflow = [
            'cd /workspace/repo && git status',
            'cd /workspace/repo && if [ -f package.json ]; then (npm ci || npm install); else echo "No package.json found"; fi',
            'cd /workspace/repo && if [ -f package.json ]; then (npm test || npm run test || echo "No tests configured"); else echo "No package.json found"; fi',
            `echo "Analyzing repository for: ${task.description}"`
        ];
        const results = [];
        for (const command of workflow) {
            const result = await this.vmOrchestrator.executeCommand(this.containerId, command);
            results.push(result);
            this.trackTokenUsage(100);
        }
        const developmentResult = await this.performAutonomousDevelopment(task);
        return {
            workflowResults: results,
            developmentResult,
            vmMetrics: await this.getVMMetrics(),
            tokenUsage: this.tokenUsed
        };
    }
    async performAutonomousDevelopment(task) {
        const aiRequest = {
            agentId: this.id,
            sessionToken: this.sessionJWT,
            prompt: `Autonomous development task: ${task.description}`,
            context: {
                repository: this.repositoryPath,
                capabilities: this.capabilities
            }
        };
        const response = await this.apiProxy.makeAIRequest(aiRequest);
        this.trackTokenUsage(response.tokenUsage || 1000);
        return response.result;
    }
    async createPullRequest(result) {
        if (!this.containerId) {
            throw new Error('VM environment not available');
        }
        cli_ui_1.CliUI.logInfo(`📝 Creating pull request for autonomous changes`);
        await this.vmOrchestrator.executeCommand(this.containerId, 'cd /workspace/repo && git add . && git commit -m "Autonomous development changes by VM agent" || echo "No changes to commit"');
        const prUrl = await this.vmOrchestrator.createPullRequest(this.containerId, {
            title: `Autonomous development by ${this.id}`,
            description: `Automated changes generated by VM agent\n\nResults: ${JSON.stringify(result, null, 2)}`
        });
        cli_ui_1.CliUI.logSuccess(`✅ Pull request created: ${prUrl}`);
        return prUrl;
    }
    async stopVMEnvironment() {
        if (!this.containerId)
            return;
        try {
            this.vmState = 'stopping';
            await this.vmOrchestrator.stopContainer(this.containerId);
            await this.vmOrchestrator.removeContainer(this.containerId);
            this.vmState = 'stopped';
            this.containerId = undefined;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Error stopping VM: ${error.message}`);
        }
    }
    async cleanupSecurity() {
        if (this.sessionJWT) {
            await this.tokenManager.revokeToken(this.sessionJWT);
            await this.apiProxy.unregisterAgent(this.id);
            this.sessionJWT = undefined;
        }
    }
    trackTokenUsage(tokens) {
        this.tokenUsed += tokens;
        this.requestCount++;
        if (this.tokenUsed > this.tokenBudget) {
            cli_ui_1.CliUI.logError(`⚠️ Token budget exceeded: ${this.tokenUsed}/${this.tokenBudget}`);
            throw new Error('Token budget exceeded');
        }
        if (this.requestCount % 10 === 0) {
            cli_ui_1.CliUI.logInfo(`📊 Token usage: ${this.tokenUsed}/${this.tokenBudget} (${this.requestCount} requests)`);
        }
    }
    async getVMMetrics() {
        if (!this.containerId) {
            return this.vmMetrics;
        }
        return await this.vmOrchestrator.getContainerMetrics(this.containerId);
    }
    extractRepositoryUrl(task) {
        const urlPattern = /https?:\/\/github\.com\/[\w-]+\/[\w-]+/;
        const match = task.description.match(urlPattern);
        return match ? match[0] : null;
    }
    setupVMEventHandlers() {
        this.on('vm:started', (containerId) => {
            cli_ui_1.CliUI.logSuccess(`🐳 VM container started: ${containerId}`);
            this.emitVMCommunication(`Container ${containerId.slice(0, 12)} started successfully`);
        });
        this.on('vm:stopped', (containerId) => {
            cli_ui_1.CliUI.logInfo(`🛑 VM container stopped: ${containerId}`);
            this.emitVMCommunication(`Container ${containerId.slice(0, 12)} stopped`);
        });
        this.on('vm:error', (error) => {
            cli_ui_1.CliUI.logError(`❌ VM error: ${error.message}`);
            this.emitVMCommunication(`Error: ${error.message}`);
        });
        this.on('vm:command', (command, result) => {
            this.emitVMCommunication(`Executed: ${command} | Result: ${typeof result === 'string' ? result.slice(0, 100) : 'Success'}`);
        });
        this.on('vm:ai-request', (prompt) => {
            this.emitVMCommunication(`AI Request: ${prompt.slice(0, 80)}...`);
        });
        this.on('vm:ai-response', (response) => {
            this.emitVMCommunication(`AI Response received (${response.length} chars)`);
        });
    }
    emitVMCommunication(message) {
        if (global && global.__streamingOrchestrator) {
            global.__streamingOrchestrator.queueMessage({
                type: 'vm',
                content: `[${this.id.slice(0, 8)}] ${message}`,
                metadata: {
                    vmAgentId: this.id,
                    vmState: this.vmState,
                    containerId: this.containerId
                }
            });
        }
    }
    async startChatMode(repositoryUrl) {
        try {
            cli_ui_1.CliUI.logInfo(`🐳 Starting VM Chat Mode for agent: ${this.id}`);
            if (this.status === 'initializing') {
                await this.initialize();
            }
            if (this.vmState !== 'running') {
                if (repositoryUrl) {
                    await this.startVMEnvironment(repositoryUrl);
                }
                else {
                    const containers = this.vmOrchestrator.getActiveContainers();
                    if (containers.length > 0) {
                        const container = containers[0];
                        this.containerId = container.id;
                        this.vmState = 'running';
                        this.vscodeServerPort = container.vscodePort;
                        this.repositoryPath = container.repositoryPath || '/workspace/repo';
                        cli_ui_1.CliUI.logInfo(`🔗 Connected to existing container: ${container.id.slice(0, 12)}`);
                    }
                    else {
                        throw new Error('No repository URL provided and no existing containers available');
                    }
                }
            }
            this.status = 'ready';
            this.emitVMCommunication(`VM Chat Mode active - ready for conversation`);
            cli_ui_1.CliUI.logSuccess(`✅ VM Chat Mode activated for agent: ${this.id}`);
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to start VM Chat Mode: ${error.message}`);
            this.status = 'error';
            throw error;
        }
    }
    async processChatMessage(message) {
        try {
            if (this.vmState !== 'running') {
                throw new Error('VM environment not running. Use startChatMode() first.');
            }
            this.status = 'busy';
            this.emitVMCommunication(`Processing message: ${message.slice(0, 50)}...`);
            let response = '';
            if (message.toLowerCase().includes('analyze') || message.toLowerCase().includes('analizza') || message.toLowerCase().includes('anallyze')) {
                cli_ui_1.CliUI.logInfo(`🔍 Starting repository analysis...`);
                const repoInfo = await this.analyzeRepository();
                response = `🔍 **Repository Analysis:**\n\n${repoInfo}`;
                cli_ui_1.CliUI.logInfo(`✅ Repository analysis completed, response length: ${response.length}`);
            }
            else if (message.toLowerCase().includes('status')) {
                const status = await this.getContainerStatus();
                response = `📊 **Container Status:**\n\n${status}`;
            }
            else {
                try {
                    const aiResult = await this.performAutonomousDevelopment({
                        id: `chat-${Date.now()}`,
                        title: 'Chat Message',
                        description: message,
                        type: 'user_request',
                        priority: 'medium',
                        status: 'pending',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        data: { isChat: true },
                        progress: 0
                    });
                    response = aiResult || `✅ Task completed successfully in VM environment`;
                }
                catch (aiError) {
                    response = `🤖 VM Agent processed your request: "${message}"\n\nContainer is active and ready for commands.`;
                }
            }
            this.status = 'ready';
            this.emitVMCommunication(`Message processed successfully`);
            cli_ui_1.CliUI.logInfo(`🔍 Returning response: ${response.slice(0, 100)}${response.length > 100 ? '...' : ''}`);
            return response;
        }
        catch (error) {
            this.status = 'ready';
            this.emitVMCommunication(`Error processing message: ${error.message}`);
            return `❌ Error processing message: ${error.message}`;
        }
    }
    async *processChatMessageStreaming(message) {
        try {
            if (this.vmState !== 'running') {
                throw new Error('VM environment not running. Use startChatMode() first.');
            }
            this.status = 'busy';
            this.emitVMCommunication(`🌊 Streaming AI processing: ${message.slice(0, 50)}...`);
            if (message.toLowerCase().includes('analyze') || message.toLowerCase().includes('analizza') || message.toLowerCase().includes('anallyze')) {
                yield '🔍 **Starting repository analysis...**\n\n';
                const repoInfo = await this.analyzeRepository();
                yield `**Repository Analysis:**\n\n${repoInfo}`;
            }
            else if (message.toLowerCase().includes('status')) {
                yield '📊 **Getting container status...**\n\n';
                const status = await this.getContainerStatus();
                yield `**Container Status:**\n\n${status}`;
            }
            else {
                yield '🤖 **Processing with AI...**\n\n';
                try {
                    const aiRequest = {
                        agentId: this.id,
                        sessionToken: this.sessionJWT,
                        prompt: `VM Agent Chat: User says "${message}". You are an autonomous development agent running in a secure VM environment. Respond helpfully and conversationally.`,
                        context: {
                            repository: this.repositoryPath,
                            capabilities: this.capabilities,
                            containerState: this.vmState,
                            isStreamingChat: true
                        }
                    };
                    for await (const chunk of this.apiProxy.makeStreamingAIRequest(aiRequest)) {
                        if (chunk.type === 'content' && chunk.content) {
                            this.emitVMCommunication(`AI chunk: ${chunk.content.slice(0, 30)}...`);
                            yield chunk.content;
                        }
                        else if (chunk.type === 'usage') {
                            this.trackTokenUsage(chunk.tokenUsage || 0);
                            this.emitVMCommunication(`Token usage: ${chunk.tokenUsage}`);
                        }
                        else if (chunk.type === 'complete') {
                            this.emitVMCommunication(`AI streaming completed: ${chunk.tokenUsage} tokens`);
                        }
                        else if (chunk.type === 'error') {
                            this.emitVMCommunication(`AI streaming error: ${chunk.error}`);
                            yield `\n\n❌ AI Error: ${chunk.error}`;
                            break;
                        }
                    }
                }
                catch (aiError) {
                    yield `\n\n🤖 VM Agent processed your request: "${message}"\n\nContainer is active and ready for commands.`;
                    this.emitVMCommunication(`AI fallback: ${aiError.message}`);
                }
            }
            this.status = 'ready';
            this.emitVMCommunication(`🌊 Streaming message processing completed`);
        }
        catch (error) {
            this.status = 'ready';
            this.emitVMCommunication(`Streaming error: ${error.message}`);
            yield `❌ Error processing message: ${error.message}`;
        }
    }
    async analyzeRepository() {
        if (!this.containerId) {
            return 'No container available for analysis';
        }
        try {
            const commands = [
                'cd /workspace/repo && pwd',
                'cd /workspace/repo && ls -la',
                'cd /workspace/repo && find . -name "*.json" -o -name "*.md" -o -name "*.js" -o -name "*.ts" | head -10',
                'cd /workspace/repo && if [ -f package.json ]; then cat package.json | head -20; fi',
                'cd /workspace/repo && if [ -f README.md ]; then head -10 README.md; fi'
            ];
            const results = [];
            for (const command of commands) {
                try {
                    const result = await this.vmOrchestrator.executeCommand(this.containerId, command);
                    results.push(`$ ${command}\n${result}`);
                }
                catch (error) {
                    results.push(`$ ${command}\nError: ${error}`);
                }
            }
            return results.join('\n\n---\n\n');
        }
        catch (error) {
            return `Analysis error: ${error.message}`;
        }
    }
    async getContainerStatus() {
        if (!this.containerId) {
            return 'No container available';
        }
        try {
            const metrics = await this.getVMMetrics();
            const containers = this.vmOrchestrator.getActiveContainers();
            const containerInfo = containers.find(c => c.id === this.containerId);
            const status = [
                `Container ID: ${this.containerId.slice(0, 12)}`,
                `State: ${this.vmState}`,
                `Status: ${this.status}`,
                `Repository: ${containerInfo?.repositoryUrl || 'N/A'}`,
                `VS Code Port: ${this.vscodeServerPort || 'N/A'}`,
                `Memory Usage: ${metrics.memoryUsage} MB`,
                `CPU Usage: ${metrics.cpuUsage}%`,
                `Uptime: ${Math.floor(metrics.uptime / 60)} minutes`,
                `Token Usage: ${this.tokenUsed}/${this.tokenBudget}`,
                `Created: ${containerInfo?.createdAt?.toLocaleString() || 'N/A'}`
            ];
            return status.join('\n');
        }
        catch (error) {
            return `Status error: ${error.message}`;
        }
    }
    getVMState() {
        return this.vmState;
    }
    getContainerId() {
        return this.containerId;
    }
    getTokenUsage() {
        return {
            used: this.tokenUsed,
            budget: this.tokenBudget,
            remaining: this.tokenBudget - this.tokenUsed
        };
    }
    getVSCodePort() {
        return this.vscodeServerPort;
    }
}
exports.SecureVirtualizedAgent = SecureVirtualizedAgent;
