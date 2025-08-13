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
exports.DiffViewer = void 0;
const chalk_1 = __importDefault(require("chalk"));
const diff = __importStar(require("diff"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class DiffViewer {
    static showFileDiff(fileDiff, options = {}) {
        const { context = 3, showLineNumbers = true, highlightWords = true, compact = false } = options;
        console.log(chalk_1.default.blue.bold(`\n📄 File: ${fileDiff.filePath}`));
        if (fileDiff.isNew) {
            console.log(chalk_1.default.green('✨ New file created'));
            this.showNewFileContent(fileDiff.newContent, showLineNumbers, compact);
            return;
        }
        if (fileDiff.isDeleted) {
            console.log(chalk_1.default.red('🗑️  File deleted'));
            return;
        }
        const diffResult = diff.diffLines(fileDiff.originalContent, fileDiff.newContent);
        if (diffResult.length === 1 && !diffResult[0].added && !diffResult[0].removed) {
            console.log(chalk_1.default.gray('   No changes'));
            return;
        }
        console.log(chalk_1.default.gray('─'.repeat(80)));
        let lineNumber = 1;
        let addedLines = 0;
        let removedLines = 0;
        diffResult.forEach(part => {
            const lines = part.value.split('\n').filter((line, index, arr) => index < arr.length - 1 || line.length > 0);
            if (part.added) {
                addedLines += lines.length;
                lines.forEach(line => {
                    const lineNum = showLineNumbers ? chalk_1.default.green(`+${lineNumber.toString().padStart(4)} `) : '';
                    console.log(`${lineNum}${chalk_1.default.green(`+ ${line}`)}`);
                    lineNumber++;
                });
            }
            else if (part.removed) {
                removedLines += lines.length;
                lines.forEach(line => {
                    const lineNum = showLineNumbers ? chalk_1.default.red(`-${lineNumber.toString().padStart(4)} `) : '';
                    console.log(`${lineNum}${chalk_1.default.red(`- ${line}`)}`);
                });
            }
            else {
                lines.forEach(line => {
                    const lineNum = showLineNumbers ? chalk_1.default.gray(` ${lineNumber.toString().padStart(4)} `) : '';
                    console.log(`${lineNum}${chalk_1.default.gray(`  ${line}`)}`);
                    lineNumber++;
                });
            }
        });
        console.log(chalk_1.default.gray('─'.repeat(80)));
        console.log(chalk_1.default.green(`+${addedLines} additions`) + chalk_1.default.gray(' | ') + chalk_1.default.red(`-${removedLines} deletions`));
    }
    static showMultiFileDiff(fileDiffs, options = {}) {
        console.log(chalk_1.default.blue.bold(`\n📁 File Changes Summary (${fileDiffs.length} files)`));
        console.log(chalk_1.default.gray('═'.repeat(80)));
        const summary = {
            created: fileDiffs.filter(f => f.isNew).length,
            modified: fileDiffs.filter(f => !f.isNew && !f.isDeleted).length,
            deleted: fileDiffs.filter(f => f.isDeleted).length,
        };
        if (summary.created > 0)
            console.log(chalk_1.default.green(`✨ ${summary.created} files created`));
        if (summary.modified > 0)
            console.log(chalk_1.default.yellow(`📝 ${summary.modified} files modified`));
        if (summary.deleted > 0)
            console.log(chalk_1.default.red(`🗑️  ${summary.deleted} files deleted`));
        console.log();
        fileDiffs.forEach(fileDiff => {
            const status = fileDiff.isNew ? chalk_1.default.green('NEW') :
                fileDiff.isDeleted ? chalk_1.default.red('DEL') :
                    chalk_1.default.yellow('MOD');
            console.log(`${status} ${fileDiff.filePath}`);
            if (!options.compact) {
                this.showFileDiff(fileDiff, { ...options, compact: true });
            }
        });
    }
    static showNewFileContent(content, showLineNumbers, compact) {
        const lines = content.split('\n');
        if (compact && lines.length > 10) {
            console.log(chalk_1.default.green('✨ New file created'));
            console.log(chalk_1.default.gray(`   ${lines.length} lines`));
            console.log(chalk_1.default.gray('   First 5 lines:'));
            lines.slice(0, 5).forEach((line, index) => {
                const lineNum = showLineNumbers ? chalk_1.default.green(`+${(index + 1).toString().padStart(4)} `) : '';
                console.log(`${lineNum}${chalk_1.default.green(`+ ${line}`)}`);
            });
            if (lines.length > 5) {
                console.log(chalk_1.default.gray(`   ... ${lines.length - 5} more lines`));
            }
        }
        else {
            lines.forEach((line, index) => {
                const lineNum = showLineNumbers ? chalk_1.default.green(`+${(index + 1).toString().padStart(4)} `) : '';
                console.log(`${lineNum}${chalk_1.default.green(`+ ${line}`)}`);
            });
        }
    }
    static async createFileDiff(filePath, originalPath) {
        const fullPath = path.resolve(filePath);
        let originalContent = '';
        let newContent = '';
        let isNew = false;
        let isDeleted = false;
        try {
            newContent = await fs.promises.readFile(fullPath, 'utf8');
        }
        catch (error) {
            isDeleted = true;
        }
        if (originalPath) {
            try {
                originalContent = await fs.promises.readFile(originalPath, 'utf8');
            }
            catch (error) {
                isNew = true;
            }
        }
        else {
            try {
                const stats = await fs.promises.stat(fullPath);
                const now = Date.now();
                const fileTime = stats.mtime.getTime();
                isNew = (now - fileTime) < 5000;
            }
            catch (error) {
                isNew = true;
            }
        }
        return {
            filePath,
            originalContent,
            newContent,
            isNew,
            isDeleted,
        };
    }
    static async showDiffAndAskApproval(fileDiffs) {
        console.log(chalk_1.default.yellow.bold('\n⚠️  The following files will be modified:'));
        this.showMultiFileDiff(fileDiffs, { compact: true });
        console.log(chalk_1.default.yellow('\n📋 Review the changes above carefully.'));
        return new Promise((resolve) => {
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            rl.question(chalk_1.default.cyan('Do you want to proceed with these changes? (y/N): '), (answer) => {
                rl.close();
                resolve(answer.toLowerCase().startsWith('y'));
            });
        });
    }
    static showWordDiff(original, modified) {
        const wordDiff = diff.diffWords(original, modified);
        let result = '';
        wordDiff.forEach(part => {
            if (part.added) {
                result += chalk_1.default.green.bold(part.value);
            }
            else if (part.removed) {
                result += chalk_1.default.red.strikethrough(part.value);
            }
            else {
                result += part.value;
            }
        });
        console.log(result);
    }
    static async saveDiffToFile(fileDiffs, outputPath) {
        let content = `# File Changes Report\n\nGenerated: ${new Date().toISOString()}\n\n`;
        content += `## Summary\n`;
        content += `- ${fileDiffs.filter(f => f.isNew).length} files created\n`;
        content += `- ${fileDiffs.filter(f => !f.isNew && !f.isDeleted).length} files modified\n`;
        content += `- ${fileDiffs.filter(f => f.isDeleted).length} files deleted\n\n`;
        fileDiffs.forEach(fileDiff => {
            content += `## ${fileDiff.filePath}\n\n`;
            if (fileDiff.isNew) {
                content += `**Status**: New file\n\n`;
                content += '```\n' + fileDiff.newContent + '\n```\n\n';
            }
            else if (fileDiff.isDeleted) {
                content += `**Status**: Deleted\n\n`;
            }
            else {
                content += `**Status**: Modified\n\n`;
                const diffResult = diff.createPatch(fileDiff.filePath, fileDiff.originalContent, fileDiff.newContent);
                content += '```diff\n' + diffResult + '\n```\n\n';
            }
        });
        await fs.promises.writeFile(outputPath, content, 'utf8');
        console.log(chalk_1.default.green(`📄 Diff report saved to: ${outputPath}`));
    }
}
exports.DiffViewer = DiffViewer;
