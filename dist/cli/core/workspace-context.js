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
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceContext = exports.WorkspaceContext = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Workspace context manager for tracking project information
 */
class WorkspaceContext {
    constructor(workspacePath = process.cwd()) {
        this.workspaceInfo = null;
        this.workspacePath = workspacePath;
        this.initialize();
    }
    initialize() {
        this.workspaceInfo = this.detectWorkspaceInfo();
    }
    detectWorkspaceInfo() {
        const name = path.basename(this.workspacePath);
        const info = {
            path: this.workspacePath,
            name,
            type: 'project'
        };
        // Detect package.json for Node.js projects
        const packageJsonPath = path.join(this.workspacePath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                info.language = 'javascript';
                // Detect framework based on dependencies
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                if (deps.react)
                    info.framework = 'react';
                else if (deps.vue)
                    info.framework = 'vue';
                else if (deps.angular)
                    info.framework = 'angular';
                else if (deps.next)
                    info.framework = 'nextjs';
                else if (deps.nuxt)
                    info.framework = 'nuxtjs';
                else if (deps.svelte)
                    info.framework = 'svelte';
                // Detect package manager
                if (fs.existsSync(path.join(this.workspacePath, 'yarn.lock'))) {
                    info.packageManager = 'yarn';
                }
                else if (fs.existsSync(path.join(this.workspacePath, 'pnpm-lock.yaml'))) {
                    info.packageManager = 'pnpm';
                }
                else {
                    info.packageManager = 'npm';
                }
            }
            catch (error) {
                // Ignore JSON parse errors
            }
        }
        // Detect Python projects
        if (fs.existsSync(path.join(this.workspacePath, 'requirements.txt')) ||
            fs.existsSync(path.join(this.workspacePath, 'pyproject.toml')) ||
            fs.existsSync(path.join(this.workspacePath, 'setup.py'))) {
            info.language = 'python';
        }
        // Detect Rust projects
        if (fs.existsSync(path.join(this.workspacePath, 'Cargo.toml'))) {
            info.language = 'rust';
        }
        // Detect Go projects
        if (fs.existsSync(path.join(this.workspacePath, 'go.mod'))) {
            info.language = 'go';
        }
        return info;
    }
    getWorkspaceInfo() {
        return this.workspaceInfo;
    }
    getWorkspacePath() {
        return this.workspacePath;
    }
    setWorkspacePath(newPath) {
        this.workspacePath = newPath;
        this.initialize();
    }
    isValidWorkspace() {
        return fs.existsSync(this.workspacePath) && fs.statSync(this.workspacePath).isDirectory();
    }
    getProjectFiles(extensions = []) {
        const files = [];
        const scanDirectory = (dir, depth = 0) => {
            if (depth > 3)
                return; // Limit recursion depth
            try {
                const entries = fs.readdirSync(dir);
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        // Skip common ignore directories
                        if (['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(entry)) {
                            continue;
                        }
                        scanDirectory(fullPath, depth + 1);
                    }
                    else if (stat.isFile()) {
                        if (extensions.length === 0 || extensions.some(ext => entry.endsWith(ext))) {
                            files.push(fullPath);
                        }
                    }
                }
            }
            catch (error) {
                // Ignore permission errors
            }
        };
        scanDirectory(this.workspacePath);
        return files;
    }
    getRelativePath(filePath) {
        return path.relative(this.workspacePath, filePath);
    }
}
exports.WorkspaceContext = WorkspaceContext;
// Export singleton instance
exports.workspaceContext = new WorkspaceContext();
