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
exports.FilePickerHandler = void 0;
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const find_files_tool_1 = require("../tools/find-files-tool");
class FilePickerHandler {
    constructor(workingDirectory) {
        this.selections = new Map();
        this.workingDirectory = workingDirectory;
        this.findTool = new find_files_tool_1.FindFilesTool(workingDirectory);
    }
    async selectFiles(pattern, options = {}) {
        const defaultOptions = {
            maxDisplay: 50,
            maxFilesPerDirectory: 10,
            showIcons: true,
            groupByDirectory: true
        };
        const opts = { ...defaultOptions, ...options };
        const result = await this.findTool.execute(pattern, { cwd: this.workingDirectory });
        if (!result.success || result.data.length === 0) {
            throw new Error(`No files found matching pattern: ${pattern}`);
        }
        const selection = {
            files: result.data,
            pattern,
            timestamp: new Date()
        };
        this.storeSelection(pattern, selection);
        await this.displayFileSelection(selection, opts);
        return selection;
    }
    async displayFileSelection(selection, options) {
        const { files, pattern } = selection;
        console.log(chalk_1.default.blue(`\n📂 Found ${files.length} files matching "${pattern}":`));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        if (options.groupByDirectory) {
            await this.displayGroupedFiles(files, options);
        }
        else {
            await this.displayFlatFiles(files, options);
        }
        this.displaySelectionOptions(selection);
    }
    async displayGroupedFiles(files, options) {
        const groupedFiles = this.groupFilesByDirectory(files);
        let fileIndex = 0;
        for (const [directory, dirFiles] of groupedFiles.entries()) {
            if (fileIndex >= options.maxDisplay) {
                console.log(chalk_1.default.yellow(`... and ${files.length - fileIndex} more files`));
                break;
            }
            if (directory !== '.') {
                console.log(chalk_1.default.cyan(`\n📁 ${directory}/`));
            }
            const displayCount = Math.min(dirFiles.length, options.maxFilesPerDirectory, options.maxDisplay - fileIndex);
            for (let i = 0; i < displayCount; i++) {
                const file = dirFiles[i];
                const fileIcon = options.showIcons ? this.getFileIcon(path.extname(file)) : '📄';
                const relativePath = directory === '.' ? file : `${directory}/${file}`;
                console.log(`  ${fileIcon} ${chalk_1.default.white(file)} ${chalk_1.default.dim('(' + relativePath + ')')}`);
                fileIndex++;
            }
            if (dirFiles.length > options.maxFilesPerDirectory) {
                console.log(chalk_1.default.dim(`    ... and ${dirFiles.length - options.maxFilesPerDirectory} more in this directory`));
            }
        }
    }
    async displayFlatFiles(files, options) {
        const displayCount = Math.min(files.length, options.maxDisplay);
        for (let i = 0; i < displayCount; i++) {
            const file = files[i];
            const fileIcon = options.showIcons ? this.getFileIcon(path.extname(file)) : '📄';
            console.log(`  ${fileIcon} ${chalk_1.default.white(file)}`);
        }
        if (files.length > options.maxDisplay) {
            console.log(chalk_1.default.yellow(`... and ${files.length - options.maxDisplay} more files`));
        }
    }
    displaySelectionOptions(selection) {
        console.log(chalk_1.default.gray('\n─'.repeat(60)));
        console.log(chalk_1.default.green('📋 File Selection Options:'));
        console.log(chalk_1.default.dim('• Files are now available for reference in your next message'));
        console.log(chalk_1.default.dim('• Use the file paths directly: "Analyze these files: file1.ts, file2.ts"'));
        console.log(chalk_1.default.dim('• Integration with agent commands: "@code-review analyze these files"'));
        if (selection.files.length <= 10) {
            console.log(chalk_1.default.yellow('\n💡 Quick reference paths:'));
            selection.files.forEach((file, index) => {
                console.log(chalk_1.default.dim(`   ${index + 1}. ${file}`));
            });
        }
        this.displayPatternSuggestions(selection.pattern);
    }
    displayPatternSuggestions(currentPattern) {
        console.log(chalk_1.default.cyan('\n🔍 Try these pattern variations:'));
        if (currentPattern === '*') {
            console.log(chalk_1.default.dim('  * *.ts      - TypeScript files only'));
            console.log(chalk_1.default.dim('  * src/**    - Files in src directory'));
            console.log(chalk_1.default.dim('  * **/*.tsx  - React components'));
        }
        else if (currentPattern.includes('*')) {
            console.log(chalk_1.default.dim('  *           - All files'));
            console.log(chalk_1.default.dim('  * *.json    - Configuration files'));
            console.log(chalk_1.default.dim('  * test/**   - Test files'));
        }
    }
    groupFilesByDirectory(files) {
        const groups = new Map();
        files.forEach(file => {
            const directory = path.dirname(file);
            const fileName = path.basename(file);
            if (!groups.has(directory)) {
                groups.set(directory, []);
            }
            groups.get(directory).push(fileName);
        });
        return new Map([...groups.entries()].sort(([a], [b]) => {
            if (a === '.')
                return -1;
            if (b === '.')
                return 1;
            return a.localeCompare(b);
        }));
    }
    getFileIcon(extension) {
        const iconMap = {
            '.ts': '🔷',
            '.tsx': '⚛️',
            '.js': '💛',
            '.jsx': '⚛️',
            '.json': '📋',
            '.md': '📝',
            '.txt': '📄',
            '.yml': '⚙️',
            '.yaml': '⚙️',
            '.css': '🎨',
            '.scss': '🎨',
            '.html': '🌐',
            '.py': '🐍',
            '.java': '☕',
            '.go': '🔷',
            '.rust': '🦀',
            '.rs': '🦀',
            '.vue': '💚',
            '.php': '🐘',
            '.rb': '💎',
            '.sh': '📜',
            '.sql': '🗃️',
            '.xml': '📄',
            '.dockerfile': '🐳',
            '.gitignore': '🙈',
        };
        return iconMap[extension.toLowerCase()] || '📄';
    }
    storeSelection(pattern, selection) {
        this.selections.set(pattern, selection);
        if (this.selections.size > 5) {
            const oldestKey = this.selections.keys().next().value;
            if (oldestKey !== undefined) {
                this.selections.delete(oldestKey);
            }
        }
    }
    getSelection(pattern) {
        return this.selections.get(pattern);
    }
    getAllSelections() {
        return new Map(this.selections);
    }
    clearSelections() {
        this.selections.clear();
    }
    async getFiles(pattern) {
        const result = await this.findTool.execute(pattern, { cwd: this.workingDirectory });
        return result.success ? result.data : [];
    }
    async hasMatches(pattern) {
        const files = await this.getFiles(pattern);
        return files.length > 0;
    }
}
exports.FilePickerHandler = FilePickerHandler;
