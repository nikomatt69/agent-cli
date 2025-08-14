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
exports.ReplaceInFileTool = exports.ListDirectoryTool = exports.WriteFileTool = exports.ReadFileTool = void 0;
exports.sanitizePath = sanitizePath;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const input_queue_1 = require("../core/input-queue");
function sanitizePath(filePath, workingDir = process.cwd()) {
    const normalizedPath = path.normalize(filePath);
    const absolutePath = path.resolve(workingDir, normalizedPath);
    const workingDirAbsolute = path.resolve(workingDir);
    if (!absolutePath.startsWith(workingDirAbsolute)) {
        throw new Error(`Path traversal detected: ${filePath} resolves outside working directory`);
    }
    return absolutePath;
}
class ReadFileTool {
    constructor(workingDir) {
        this.workingDirectory = workingDir || process.cwd();
    }
    async execute(filePath) {
        try {
            const safePath = sanitizePath(filePath, this.workingDirectory);
            if (!fs.existsSync(safePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            const stats = fs.statSync(safePath);
            if (!stats.isFile()) {
                throw new Error(`Path is not a file: ${filePath}`);
            }
            const content = fs.readFileSync(safePath, 'utf8');
            const extension = path.extname(safePath).slice(1);
            console.log(chalk_1.default.green(`📖 Read file: ${filePath}`));
            return {
                path: filePath,
                content,
                size: stats.size,
                modified: stats.mtime,
                extension,
            };
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to read file: ${error.message}`));
            throw error;
        }
    }
}
exports.ReadFileTool = ReadFileTool;
class WriteFileTool {
    constructor(workingDir) {
        this.workingDirectory = workingDir || process.cwd();
    }
    async execute(filePath, content, options = {}) {
        try {
            const safePath = sanitizePath(filePath, this.workingDirectory);
            const fileExists = fs.existsSync(safePath);
            if (!options.skipConfirmation) {
                const action = fileExists ? 'overwrite' : 'create';
                input_queue_1.inputQueue.enableBypass();
                try {
                    const { confirmed } = await inquirer_1.default.prompt([{
                            type: 'confirm',
                            name: 'confirmed',
                            message: `${action === 'overwrite' ? '⚠️  Overwrite' : '📝 Create'} file: ${filePath}?`,
                            default: false,
                        }]);
                    if (!confirmed) {
                        console.log(chalk_1.default.yellow('✋ File operation cancelled by user'));
                        return;
                    }
                }
                finally {
                    input_queue_1.inputQueue.disableBypass();
                }
            }
            if (options.createDirectories) {
                const dir = path.dirname(safePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(chalk_1.default.blue(`📁 Created directory: ${path.relative(this.workingDirectory, dir)}`));
                }
            }
            fs.writeFileSync(safePath, content, 'utf8');
            console.log(chalk_1.default.green(`✅ File ${fileExists ? 'updated' : 'created'}: ${filePath}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to write file: ${error.message}`));
            throw error;
        }
    }
}
exports.WriteFileTool = WriteFileTool;
class ListDirectoryTool {
    constructor(workingDir) {
        this.workingDirectory = workingDir || process.cwd();
    }
    async execute(directoryPath = '.', options = {}) {
        try {
            const safePath = sanitizePath(directoryPath, this.workingDirectory);
            if (!fs.existsSync(safePath)) {
                throw new Error(`Directory not found: ${directoryPath}`);
            }
            const stats = fs.statSync(safePath);
            if (!stats.isDirectory()) {
                throw new Error(`Path is not a directory: ${directoryPath}`);
            }
            const files = [];
            const directories = [];
            const walkDir = (dir, currentDepth = 0) => {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    if (!options.includeHidden && item.startsWith('.')) {
                        continue;
                    }
                    const itemPath = path.join(dir, item);
                    const relativePath = path.relative(safePath, itemPath);
                    const stats = fs.statSync(itemPath);
                    if (stats.isDirectory()) {
                        if (['node_modules', '.git', 'dist', 'build', '.next'].includes(item)) {
                            continue;
                        }
                        directories.push(relativePath || item);
                        if (options.recursive) {
                            walkDir(itemPath, currentDepth + 1);
                        }
                    }
                    else {
                        if (!options.pattern || options.pattern.test(relativePath || item)) {
                            files.push(relativePath || item);
                        }
                    }
                }
            };
            walkDir(safePath);
            console.log(chalk_1.default.green(`📂 Listed directory: ${directoryPath} (${files.length} files, ${directories.length} directories)`));
            return {
                files: files.sort(),
                directories: directories.sort(),
                total: files.length + directories.length,
            };
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to list directory: ${error.message}`));
            throw error;
        }
    }
}
exports.ListDirectoryTool = ListDirectoryTool;
class ReplaceInFileTool {
    constructor(workingDir) {
        this.workingDirectory = workingDir || process.cwd();
    }
    async execute(filePath, replacements, options = {}) {
        try {
            const safePath = sanitizePath(filePath, this.workingDirectory);
            if (!fs.existsSync(safePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            const originalContent = fs.readFileSync(safePath, 'utf8');
            let modifiedContent = originalContent;
            let totalReplacements = 0;
            for (const replacement of replacements) {
                const regex = typeof replacement.find === 'string'
                    ? new RegExp(replacement.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), replacement.global ? 'g' : '')
                    : replacement.find;
                const matches = modifiedContent.match(regex);
                if (matches) {
                    modifiedContent = modifiedContent.replace(regex, replacement.replace);
                    totalReplacements += matches.length;
                }
            }
            if (totalReplacements === 0) {
                console.log(chalk_1.default.yellow(`⚠️  No replacements made in: ${filePath}`));
                return { replacements: 0 };
            }
            if (!options.skipConfirmation) {
                console.log(chalk_1.default.blue(`\n📝 Proposed changes to ${filePath}:`));
                console.log(chalk_1.default.gray(`${totalReplacements} replacement(s) will be made`));
                input_queue_1.inputQueue.enableBypass();
                try {
                    const { confirmed } = await inquirer_1.default.prompt([{
                            type: 'confirm',
                            name: 'confirmed',
                            message: 'Apply these changes?',
                            default: false,
                        }]);
                    if (!confirmed) {
                        console.log(chalk_1.default.yellow('✋ File replacement cancelled by user'));
                        return { replacements: 0 };
                    }
                }
                finally {
                    input_queue_1.inputQueue.disableBypass();
                }
            }
            let backupPath;
            if (options.createBackup) {
                backupPath = `${safePath}.backup.${Date.now()}`;
                fs.writeFileSync(backupPath, originalContent, 'utf8');
                console.log(chalk_1.default.blue(`💾 Backup created: ${path.relative(this.workingDirectory, backupPath)}`));
            }
            fs.writeFileSync(safePath, modifiedContent, 'utf8');
            console.log(chalk_1.default.green(`✅ Applied ${totalReplacements} replacement(s) to: ${filePath}`));
            return {
                replacements: totalReplacements,
                backup: backupPath ? path.relative(this.workingDirectory, backupPath) : undefined,
            };
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to replace in file: ${error.message}`));
            throw error;
        }
    }
}
exports.ReplaceInFileTool = ReplaceInFileTool;
