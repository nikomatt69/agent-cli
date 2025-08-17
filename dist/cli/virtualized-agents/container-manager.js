"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainerManager = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const events_1 = require("events");
const cli_ui_1 = require("../utils/cli-ui");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ContainerManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.networkName = 'nikcli-network';
        this.ensureDockerNetwork();
    }
    async createContainer(config) {
        try {
            cli_ui_1.CliUI.logInfo(`🐳 Creating container for agent ${config.name}`);
            const args = ['docker', 'run', '-d'];
            args.push('--name', config.name);
            args.push('--network', this.networkName);
            if (config.security?.noNewPrivileges !== false) {
                args.push('--security-opt', 'no-new-privileges:true');
            }
            if (config.security?.readOnlyRootfs) {
                args.push('--read-only');
            }
            (config.security?.capabilities?.drop || []).forEach(cap => args.push('--cap-drop', cap));
            (config.security?.capabilities?.add || []).forEach(cap => args.push('--cap-add', cap));
            args.push('--tmpfs', '/tmp:rw,noexec,nosuid,size=100m');
            args.push('--tmpfs', '/var/tmp:rw,noexec,nosuid,size=50m');
            args.push('--memory', config.resources?.memory || '256m');
            args.push('--cpus', config.resources?.cpuQuota || '0.5');
            Object.entries(config.environment || {}).forEach(([key, value]) => {
                args.push('-e', `${key}=${value}`);
            });
            (config.volumes || []).forEach(volume => args.push('-v', volume));
            (config.ports || []).forEach(port => args.push('-p', port));
            args.push(config.image, 'sleep', 'infinity');
            cli_ui_1.CliUI.logDebug(`Docker command: ${args.join(' ')}`);
            const { stdout, stderr } = await execAsync(args.join(' '), { timeout: 120000 });
            if (stderr &&
                !stderr.includes('Warning') &&
                !stderr.includes('Pulling from') &&
                !stderr.includes('Pull complete') &&
                !stderr.includes('Download complete') &&
                !stderr.includes('Digest:') &&
                !stderr.includes('Status:') &&
                !stderr.includes('Unable to find image')) {
                throw new Error(`Docker create failed: ${stderr}`);
            }
            const containerId = stdout.trim();
            if (!containerId) {
                throw new Error('Failed to get container ID from Docker');
            }
            cli_ui_1.CliUI.logSuccess(`✅ Container created: ${containerId.slice(0, 12)}`);
            this.emit('container:created', { containerId, name: config.name });
            return containerId;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to create container: ${error.message}`);
            throw error;
        }
    }
    async startContainer(containerId) {
        try {
            cli_ui_1.CliUI.logInfo(`▶️ Starting container: ${containerId.slice(0, 12)}`);
            const { stderr } = await execAsync(`docker start ${containerId}`);
            if (stderr) {
                throw new Error(`Docker start failed: ${stderr}`);
            }
            await this.waitForContainer(containerId);
            cli_ui_1.CliUI.logSuccess(`✅ Container started: ${containerId.slice(0, 12)}`);
            this.emit('container:started', { containerId });
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to start container: ${error.message}`);
            throw error;
        }
    }
    async stopContainer(containerId) {
        try {
            cli_ui_1.CliUI.logInfo(`⏹️ Stopping container: ${containerId.slice(0, 12)}`);
            const { stderr } = await execAsync(`docker stop -t 10 ${containerId}`);
            if (stderr && !stderr.includes('Warning')) {
                cli_ui_1.CliUI.logError(`Warning stopping container: ${stderr}`);
            }
            cli_ui_1.CliUI.logSuccess(`✅ Container stopped: ${containerId.slice(0, 12)}`);
            this.emit('container:stopped', { containerId });
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to stop container: ${error.message}`);
            try {
                await execAsync(`docker kill ${containerId}`);
                cli_ui_1.CliUI.logWarning(`⚠️ Container force killed: ${containerId.slice(0, 12)}`);
            }
            catch (killError) {
                cli_ui_1.CliUI.logError(`❌ Failed to kill container: ${killError.message}`);
            }
        }
    }
    async removeContainer(containerId) {
        try {
            cli_ui_1.CliUI.logInfo(`🗑️ Removing container: ${containerId.slice(0, 12)}`);
            const { stderr } = await execAsync(`docker rm -v ${containerId}`);
            if (stderr && !stderr.includes('Warning')) {
                cli_ui_1.CliUI.logError(`Warning removing container: ${stderr}`);
            }
            cli_ui_1.CliUI.logSuccess(`✅ Container removed: ${containerId.slice(0, 12)}`);
            this.emit('container:removed', { containerId });
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to remove container: ${error.message}`);
        }
    }
    async executeCommand(containerId, command) {
        try {
            const dockerExecCommand = `docker exec ${containerId} sh -c "${command.replace(/"/g, '\\"')}"`;
            cli_ui_1.CliUI.logDebug(`🔧 Executing: ${command}`);
            cli_ui_1.CliUI.logDebug(`📋 Docker command: ${dockerExecCommand}`);
            const { stdout, stderr } = await execAsync(dockerExecCommand, {
                timeout: 180000
            });
            if (stdout) {
                cli_ui_1.CliUI.logDebug(`📤 Command output: ${stdout.trim()}`);
            }
            if (stderr && !this.isWarningOnly(stderr)) {
                cli_ui_1.CliUI.logError(`⚠️ Command stderr: ${stderr}`);
            }
            return stdout;
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Command execution failed: ${error.message}`);
            cli_ui_1.CliUI.logError(`❌ Command failed in ${containerId.slice(0, 8)}: ${command}`);
            throw new Error(`Command failed: ${command} - ${error.message}`);
        }
    }
    async getContainerLogs(containerId, lines = 100) {
        try {
            cli_ui_1.CliUI.logInfo(`📋 Getting logs for container ${containerId.slice(0, 12)}`);
            const { stdout, stderr } = await execAsync(`docker logs --tail ${lines} ${containerId}`);
            if (stderr) {
                cli_ui_1.CliUI.logError(`⚠️ Docker logs stderr: ${stderr}`);
            }
            return stdout || stderr || 'No logs available';
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to get container logs: ${error.message}`);
            throw error;
        }
    }
    async getContainerStats(containerId) {
        try {
            const { stdout } = await execAsync(`docker stats ${containerId} --no-stream --format "table {{.MemUsage}}\t{{.CPUPerc}}\t{{.NetIO}}\t{{.BlockIO}}"`);
            const lines = stdout.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('Invalid stats output');
            }
            const statsLine = lines[1];
            const [memUsage, cpuPerc, netIO, blockIO] = statsLine.split('\t');
            return {
                memory_usage: this.parseMemoryUsage(memUsage),
                cpu_usage: this.parseCPUUsage(cpuPerc),
                network_activity: this.parseNetworkIO(netIO),
                disk_usage: this.parseBlockIO(blockIO),
                uptime: await this.getContainerUptime(containerId)
            };
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`❌ Failed to get container stats: ${error.message}`);
            return {
                memory_usage: 0,
                cpu_usage: 0,
                network_activity: 0,
                disk_usage: 0,
                uptime: 0
            };
        }
    }
    async checkDockerAvailability() {
        try {
            await execAsync('docker version --format "{{.Server.Version}}"');
            return true;
        }
        catch (error) {
            cli_ui_1.CliUI.logError('❌ Docker is not available or not running');
            return false;
        }
    }
    buildDockerCommand(config) {
        const parts = [
            'docker create',
            `--name ${config.name}`,
            `--network ${this.networkName}`,
            '--security-opt no-new-privileges=true',
            config.security?.readOnlyRootfs ? '--read-only' : '',
            ...(config.security?.capabilities?.drop || []).map(cap => `--cap-drop ${cap}`),
            ...(config.security?.capabilities?.add || []).map(cap => `--cap-add ${cap}`),
            config.resources?.memory ? `--memory ${config.resources.memory}` : '--memory 2g',
            config.resources?.cpuQuota ? `--cpus ${config.resources.cpuQuota}` : '--cpus 1.0',
            ...Object.entries(config.environment || {}).map(([key, value]) => `-e ${key}="${value}"`),
            ...(config.volumes || []).map(volume => `-v ${volume}`),
            ...(config.ports || []).map(port => `-p ${port}`),
            '--rm',
            config.image,
            'sh -c "while true; do sleep 30; done"'
        ];
        return parts.filter(part => part).join(' ');
    }
    async ensureDockerNetwork() {
        try {
            await execAsync(`docker network inspect ${this.networkName}`);
            cli_ui_1.CliUI.logDebug(`Docker network ${this.networkName} already exists`);
        }
        catch (error) {
            try {
                await execAsync(`docker network create --driver bridge ${this.networkName}`);
                cli_ui_1.CliUI.logSuccess(`✅ Created secure Docker network: ${this.networkName}`);
            }
            catch (createError) {
                cli_ui_1.CliUI.logError(`❌ Failed to create Docker network: ${createError.message}`);
            }
        }
    }
    async waitForContainer(containerId, maxAttempts = 30) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const { stdout } = await execAsync(`docker inspect ${containerId} --format="{{.State.Status}}"`);
                if (stdout.trim() === 'running') {
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                if (attempt === maxAttempts) {
                    throw new Error(`Container failed to start after ${maxAttempts} attempts`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    async getContainerUptime(containerId) {
        try {
            const { stdout } = await execAsync(`docker inspect ${containerId} --format="{{.State.StartedAt}}"`);
            const startTime = new Date(stdout.trim());
            const now = new Date();
            return Math.floor((now.getTime() - startTime.getTime()) / 1000);
        }
        catch (error) {
            return 0;
        }
    }
    parseMemoryUsage(memUsage) {
        const match = memUsage.match(/([0-9.]+)([KMGT]?i?B)/);
        if (!match)
            return 0;
        const value = parseFloat(match[1]);
        const unit = match[2];
        const multipliers = {
            'B': 1,
            'KiB': 1024,
            'MiB': 1024 * 1024,
            'GiB': 1024 * 1024 * 1024,
            'KB': 1000,
            'MB': 1000 * 1000,
            'GB': 1000 * 1000 * 1000
        };
        return value * (multipliers[unit] || 1);
    }
    parseCPUUsage(cpuPerc) {
        const match = cpuPerc.match(/([0-9.]+)%/);
        return match ? parseFloat(match[1]) : 0;
    }
    parseNetworkIO(netIO) {
        const parts = netIO.split(' / ');
        let total = 0;
        for (const part of parts) {
            const match = part.match(/([0-9.]+)([KMGT]?i?B)/);
            if (match) {
                const value = parseFloat(match[1]);
                const unit = match[2];
                total += value * this.getByteMultiplier(unit);
            }
        }
        return total;
    }
    parseBlockIO(blockIO) {
        const parts = blockIO.split(' / ');
        let total = 0;
        for (const part of parts) {
            const match = part.match(/([0-9.]+)([KMGT]?i?B)/);
            if (match) {
                const value = parseFloat(match[1]);
                const unit = match[2];
                total += value * this.getByteMultiplier(unit);
            }
        }
        return total;
    }
    getByteMultiplier(unit) {
        const multipliers = {
            'B': 1,
            'KiB': 1024,
            'MiB': 1024 * 1024,
            'GiB': 1024 * 1024 * 1024,
            'KB': 1000,
            'MB': 1000 * 1000,
            'GB': 1000 * 1000 * 1000
        };
        return multipliers[unit] || 1;
    }
    isWarningOnly(stderr) {
        const warningPatterns = [
            'Warning:',
            'WARNING:',
            'WARN:',
            'debconf: unable to initialize frontend'
        ];
        return warningPatterns.some(pattern => stderr.includes(pattern));
    }
}
exports.ContainerManager = ContainerManager;
class DockerClient {
    async version() {
        const { stdout } = await execAsync('docker version --format "{{.Server.Version}}"');
        return stdout.trim();
    }
}
