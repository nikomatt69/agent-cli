"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSearch = exports.formatAgent = exports.formatProgress = exports.formatFileOp = exports.formatCommand = exports.formatStatus = exports.wrapCyan = exports.wrapBlue = exports.TextWrapper = void 0;
const chalk_1 = __importDefault(require("chalk"));
/**
 * Text wrapping utilities for proper CLI output formatting
 */
class TextWrapper {
    /**
     * Get terminal width or fall back to default
     */
    static getTerminalWidth() {
        return process.stdout.columns || this.defaultWidth;
    }
    /**
     * Wrap long blue text with proper line breaks and indentation
     */
    static wrapBlueText(text, indent = '  ', maxWidth) {
        const terminalWidth = maxWidth || this.defaultWidth;
        const availableWidth = terminalWidth - indent.length - 4; // Account for colors and padding
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
                    // Word is too long, break it
                    lines.push(word.substring(0, availableWidth));
                    currentLine = word.substring(availableWidth);
                }
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        // Apply blue color to each line and add indentation
        return lines
            .map((line, index) => {
            const prefix = index === 0 ? '' : indent;
            return prefix + chalk_1.default.blue(line);
        })
            .join('\n');
    }
    /**
     * Wrap cyan text with proper line breaks
     */
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
    /**
     * Wrap any colored text with proper line breaks
     */
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
    /**
     * Smart format for status messages with icons and wrapping
     */
    static formatStatus(icon, message, details) {
        const fullText = details ? `${message} - ${details}` : message;
        return `${icon} ${this.wrapBlueText(fullText)}`;
    }
    /**
     * Format command execution messages with proper wrapping
     */
    static formatCommand(command, args) {
        const fullCommand = args ? `${command} ${args.join(' ')}` : command;
        return this.wrapBlueText(`⚡ Running: ${fullCommand}`);
    }
    /**
     * Format file operation messages with proper wrapping
     */
    static formatFileOperation(operation, filePath, details) {
        const message = details ? `${operation} ${filePath} - ${details}` : `${operation} ${filePath}`;
        return this.wrapBlueText(message);
    }
    /**
     * Format progress messages with proper wrapping
     */
    static formatProgress(current, total, operation) {
        const baseMessage = `📊 Progress: ${current}/${total} (${Math.round((current / total) * 100)}%)`;
        const fullMessage = operation ? `${baseMessage} - ${operation}` : baseMessage;
        return this.wrapBlueText(fullMessage);
    }
    /**
     * Format agent messages with proper wrapping
     */
    static formatAgent(agentType, action, task) {
        const baseMessage = `🤖 Agent ${agentType} ${action}`;
        const fullMessage = task ? `${baseMessage}: ${task}` : baseMessage;
        // Truncate very long tasks to prevent excessive wrapping
        const truncatedMessage = fullMessage.length > 150
            ? fullMessage.substring(0, 147) + '...'
            : fullMessage;
        return this.wrapBlueText(truncatedMessage);
    }
    /**
     * Format search/find operations with proper wrapping
     */
    static formatSearch(query, location, results) {
        const baseMessage = `🔍 Searching for "${query}" in ${location}`;
        const fullMessage = results !== undefined
            ? `${baseMessage} (${results} results)`
            : baseMessage;
        return this.wrapBlueText(fullMessage);
    }
}
exports.TextWrapper = TextWrapper;
TextWrapper.defaultWidth = 80;
// Export convenient wrapper functions
exports.wrapBlue = TextWrapper.wrapBlueText;
exports.wrapCyan = TextWrapper.wrapCyanText;
exports.formatStatus = TextWrapper.formatStatus;
exports.formatCommand = TextWrapper.formatCommand;
exports.formatFileOp = TextWrapper.formatFileOperation;
exports.formatProgress = TextWrapper.formatProgress;
exports.formatAgent = TextWrapper.formatAgent;
exports.formatSearch = TextWrapper.formatSearch;
