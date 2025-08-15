"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSearch = exports.formatAgent = exports.formatProgress = exports.formatFileOp = exports.formatCommand = exports.formatStatus = exports.wrapCyan = exports.wrapBlue = exports.TextWrapper = void 0;
const chalk_1 = __importDefault(require("chalk"));
class TextWrapper {
    static getTerminalWidth() {
        return process.stdout.columns || this.defaultWidth;
    }
    static wrapBlueText(text, indent = '  ', maxWidth) {
        const terminalWidth = maxWidth || 80;
        const availableWidth = terminalWidth - indent.length - 4;
        if (text.length <= availableWidth) {
            return chalk_1.default.blue(text);
        }
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length <= availableWidth) {
                currentLine = testLine;
            }
            else {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                }
                else {
                    lines.push(word.substring(0, availableWidth));
                    currentLine = word.substring(availableWidth);
                }
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines
            .map((line, index) => {
            const prefix = index === 0 ? '' : indent;
            return prefix + chalk_1.default.blue(line);
        })
            .join('\n');
    }
    static wrapCyanText(text, indent = '  ', maxWidth) {
        const terminalWidth = maxWidth || this.getTerminalWidth();
        const availableWidth = terminalWidth - indent.length - 4;
        if (text.length <= availableWidth) {
            return chalk_1.default.cyan(text);
        }
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length <= availableWidth) {
                currentLine = testLine;
            }
            else {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                }
                else {
                    lines.push(word.substring(0, availableWidth));
                    currentLine = word.substring(availableWidth);
                }
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines
            .map((line, index) => {
            const prefix = index === 0 ? '' : indent;
            return prefix + chalk_1.default.cyan(line);
        })
            .join('\n');
    }
    static wrapColoredText(text, colorFn, indent = '  ', maxWidth) {
        const terminalWidth = maxWidth || this.getTerminalWidth();
        const availableWidth = terminalWidth - indent.length - 4;
        if (text.length <= availableWidth) {
            return colorFn(text);
        }
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length <= availableWidth) {
                currentLine = testLine;
            }
            else {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                }
                else {
                    lines.push(word.substring(0, availableWidth));
                    currentLine = word.substring(availableWidth);
                }
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines
            .map((line, index) => {
            const prefix = index === 0 ? '' : indent;
            return prefix + colorFn(line);
        })
            .join('\n');
    }
    static formatStatus(icon, message, details) {
        const fullText = details ? `${message} - ${details}` : message;
        return `${icon} ${TextWrapper.wrapBlueText(fullText)}`;
    }
    static formatCommand(command, args) {
        const fullCommand = args ? `${command} ${args.join(' ')}` : command;
        return TextWrapper.wrapBlueText(`⚡ Running: ${fullCommand}`);
    }
    static formatFileOperation(operation, filePath, details) {
        const message = details ? `${operation} ${filePath} - ${details}` : `${operation} ${filePath}`;
        return TextWrapper.wrapBlueText(message);
    }
    static formatProgress(current, total, operation) {
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
        const baseMessage = `📊 Progress: ${current}/${total} (${percentage}%)`;
        const fullMessage = operation ? `${baseMessage} - ${operation}` : baseMessage;
        return this.wrapBlueText(fullMessage);
    }
    static formatAgent(agentType, action, task) {
        const baseMessage = `🤖 Agent ${agentType} ${action}`;
        const fullMessage = task ? `${baseMessage}: ${task}` : baseMessage;
        const truncatedMessage = fullMessage.length > 150
            ? fullMessage.substring(0, 147) + '...'
            : fullMessage;
        return TextWrapper.wrapBlueText(truncatedMessage);
    }
    static formatSearch(query, location, results) {
        const baseMessage = `🔍 Searching for "${query}" in ${location}`;
        const fullMessage = results !== undefined
            ? `${baseMessage} (${results} results)`
            : baseMessage;
        return TextWrapper.wrapBlueText(fullMessage);
    }
}
exports.TextWrapper = TextWrapper;
TextWrapper.defaultWidth = 80;
exports.wrapBlue = TextWrapper.wrapBlueText;
exports.wrapCyan = TextWrapper.wrapCyanText;
exports.formatStatus = TextWrapper.formatStatus;
exports.formatCommand = TextWrapper.formatCommand;
exports.formatFileOp = TextWrapper.formatFileOperation;
exports.formatProgress = TextWrapper.formatProgress;
exports.formatAgent = TextWrapper.formatAgent;
exports.formatSearch = TextWrapper.formatSearch;
