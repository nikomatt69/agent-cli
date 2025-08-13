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
exports.diffManager = exports.DiffManager = void 0;
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const diff_1 = require("diff");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const advanced_cli_ui_1 = require("./advanced-cli-ui");
class DiffManager {
    constructor() {
        this.pendingDiffs = new Map();
        this.autoAccept = false;
    }
    setAutoAccept(enabled) {
        this.autoAccept = enabled;
    }
    addFileDiff(filePath, oldContent, newContent) {
        const changes = (0, diff_1.diffLines)(oldContent, newContent);
        const fileDiff = {
            filePath,
            oldContent,
            newContent,
            changes,
            status: this.autoAccept ? 'accepted' : 'pending'
        };
        this.pendingDiffs.set(filePath, fileDiff);
        if (!this.autoAccept && process.stdout.isTTY && typeof advanced_cli_ui_1.advancedUI?.showFileDiff === 'function') {
            void Promise.resolve(advanced_cli_ui_1.advancedUI.showFileDiff(filePath, oldContent, newContent))
                .catch((err) => {
                console.log(chalk_1.default.yellow(`⚠ Advanced UI failed for ${filePath}: ${err?.message ?? String(err)}`));
            });
        }
        if (this.autoAccept) {
            this.applyDiff(filePath);
        }
    }
    showDiff(filePath, options = {
        showLineNumbers: true,
        contextLines: 3,
        colorized: true
    }) {
        const diff = this.pendingDiffs.get(filePath);
        if (!diff) {
            console.log(chalk_1.default.red(`No diff found for ${filePath}`));
            return;
        }
        console.log((0, boxen_1.default)(`${chalk_1.default.blue.bold('File Diff:')} ${chalk_1.default.cyan(filePath)}\\n` +
            `${chalk_1.default.gray('Status:')} ${this.getStatusColor(diff.status)}`, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'blue'
        }));
        this.renderDiff(diff, options);
    }
    showAllDiffs(options) {
        const pendingFiles = Array.from(this.pendingDiffs.values())
            .filter(d => d.status === 'pending');
        if (pendingFiles.length === 0) {
            console.log(chalk_1.default.yellow('No pending diffs to review'));
            return;
        }
        console.log(chalk_1.default.cyan.bold(`\\n📋 ${pendingFiles.length} Pending File Changes:`));
        console.log(chalk_1.default.gray('─'.repeat(60)));
        pendingFiles.forEach((diff, index) => {
            const changeCount = diff.changes.filter(c => c.added || c.removed).length;
            console.log(`${index + 1}. ${chalk_1.default.blue(diff.filePath)} ${chalk_1.default.dim(`(${changeCount} changes)`)}`);
        });
        console.log('\\n' + chalk_1.default.yellow('Use /diff <file> to review individual changes'));
        console.log(chalk_1.default.green('Use /accept <file> to approve changes'));
        console.log(chalk_1.default.red('Use /reject <file> to discard changes'));
        console.log(chalk_1.default.blue('Use /accept-all to approve all pending changes\\n'));
    }
    acceptDiff(filePath) {
        const diff = this.pendingDiffs.get(filePath);
        if (!diff)
            return false;
        diff.status = 'accepted';
        return this.applyDiff(filePath);
    }
    rejectDiff(filePath) {
        const diff = this.pendingDiffs.get(filePath);
        if (!diff)
            return false;
        diff.status = 'rejected';
        console.log(chalk_1.default.red(`✖ Rejected changes to ${filePath}`));
        return true;
    }
    acceptAllDiffs() {
        let applied = 0;
        for (const [filePath, diff] of this.pendingDiffs) {
            if (diff.status === 'pending') {
                if (this.acceptDiff(filePath)) {
                    applied++;
                }
            }
        }
        console.log(chalk_1.default.green(`✅ Applied ${applied} file changes`));
        return applied;
    }
    getPendingCount() {
        return Array.from(this.pendingDiffs.values())
            .filter(d => d.status === 'pending').length;
    }
    clearDiffs() {
        this.pendingDiffs.clear();
    }
    applyDiff(filePath) {
        const diff = this.pendingDiffs.get(filePath);
        if (!diff)
            return false;
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, diff.newContent, 'utf8');
            console.log(chalk_1.default.green(`✅ Applied changes to ${filePath}`));
            return true;
        }
        catch (error) {
            console.log(chalk_1.default.red(`❌ Failed to apply changes to ${filePath}: ${error.message}`));
            return false;
        }
    }
    renderDiff(diff, options) {
        let lineNumber = 1;
        let contextCount = 0;
        for (const change of diff.changes) {
            const lines = change.value.split('\\n').filter(line => line !== '');
            for (const line of lines) {
                let prefix = ' ';
                let color = chalk_1.default.dim;
                let lineNumColor = chalk_1.default.dim;
                if (change.added) {
                    prefix = '+';
                    color = chalk_1.default.green;
                    lineNumColor = chalk_1.default.green;
                }
                else if (change.removed) {
                    prefix = '-';
                    color = chalk_1.default.red;
                    lineNumColor = chalk_1.default.red;
                }
                else {
                    if (options.contextLines > 0) {
                        contextCount++;
                        if (contextCount > options.contextLines) {
                            continue;
                        }
                    }
                }
                if (options.showLineNumbers) {
                    const lineNum = lineNumColor(String(lineNumber).padStart(4, ' '));
                    console.log(`${lineNum} ${prefix} ${color(line)}`);
                }
                else {
                    console.log(`${prefix} ${color(line)}`);
                }
                if (!change.removed) {
                    lineNumber++;
                }
            }
        }
    }
    getStatusColor(status) {
        switch (status) {
            case 'pending': return chalk_1.default.yellow('Pending');
            case 'accepted': return chalk_1.default.green('Accepted');
            case 'rejected': return chalk_1.default.red('Rejected');
            default: return chalk_1.default.gray('Unknown');
        }
    }
}
exports.DiffManager = DiffManager;
exports.diffManager = new DiffManager();
