"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logCommandError = exports.logCommandSuccess = exports.logCommandStart = exports.formatError = exports.logKeyValue = exports.logProgress = exports.logSubsection = exports.logSection = exports.logInfo = exports.logWarning = exports.logError = exports.logSuccess = exports.stopSpinner = exports.failSpinner = exports.succeedSpinner = exports.updateSpinner = exports.startSpinner = exports.subsection = exports.section = exports.bold = exports.dim = exports.highlight = exports.info = exports.warning = exports.error = exports.success = exports.CliUI = void 0;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
class CliUI {
    static success(message) {
        return chalk_1.default.green(`✓ ${message}`);
    }
    static error(message) {
        return chalk_1.default.red(`✗ ${message}`);
    }
    static warning(message) {
        return chalk_1.default.yellow(`⚠ ${message}`);
    }
    static info(message) {
        return chalk_1.default.blue(`ℹ ${message}`);
    }
    static highlight(message) {
        return chalk_1.default.cyan(message);
    }
    static dim(message) {
        return chalk_1.default.gray(message);
    }
    static bold(message) {
        return chalk_1.default.bold(message);
    }
    static section(title) {
        return chalk_1.default.bold.magenta(`\n=== ${title} ===\n`);
    }
    static subsection(title) {
        return chalk_1.default.bold.blue(`\n--- ${title} ---`);
    }
    static startSpinner(message) {
        if (this.spinner) {
            this.spinner.stop();
        }
        this.spinner = (0, ora_1.default)({
            text: message,
            color: 'cyan',
            spinner: 'dots'
        }).start();
    }
    static updateSpinner(message) {
        if (this.spinner) {
            this.spinner.text = message;
        }
    }
    static succeedSpinner(message) {
        if (this.spinner) {
            this.spinner.succeed(message);
            this.spinner = null;
        }
    }
    static failSpinner(message) {
        if (this.spinner) {
            this.spinner.fail(message);
            this.spinner = null;
        }
    }
    static stopSpinner() {
        if (this.spinner) {
            this.spinner.stop();
            this.spinner = null;
        }
    }
    static logSuccess(message) {
        console.log(this.success(message));
    }
    static logError(message) {
        console.error(this.error(message));
    }
    static logWarning(message) {
        console.warn(this.warning(message));
    }
    static logInfo(message) {
        console.log(this.info(message));
    }
    static logDebug(message, data) {
        if (process.env.DEBUG || process.env.DEBUG_EVENTS) {
            console.log(chalk_1.default.gray('🐛'), chalk_1.default.dim(message));
            if (data) {
                console.log(chalk_1.default.dim(JSON.stringify(data, null, 2)));
            }
        }
    }
    static logSection(title) {
        console.log(this.section(title));
    }
    static logSubsection(title) {
        console.log(this.subsection(title));
    }
    static logProgress(current, total, message) {
        const percentage = Math.round((current / total) * 100);
        const progressBar = this.createProgressBar(current, total);
        console.log(`${progressBar} ${percentage}% ${this.dim(message)}`);
    }
    static createProgressBar(current, total, width = 20) {
        const filled = Math.round((current / total) * width);
        const empty = width - filled;
        const filledBar = chalk_1.default.cyan('█'.repeat(filled));
        const emptyBar = chalk_1.default.gray('░'.repeat(empty));
        return `[${filledBar}${emptyBar}]`;
    }
    static logKeyValue(key, value, indent = 0) {
        const spaces = ' '.repeat(indent);
        console.log(`${spaces}${chalk_1.default.bold(key)}: ${chalk_1.default.white(value)}`);
    }
    static formatError(error, context) {
        let message = this.error(`Error: ${error.message}`);
        if (context) {
            message += `\n${this.dim(`Context: ${context}`)}`;
        }
        if (error.stack) {
            message += `\n${this.dim(error.stack)}`;
        }
        return message;
    }
    static logCommandStart(command) {
        console.log(this.info(`Executing: ${this.highlight(command)}`));
    }
    static logCommandSuccess(command, duration) {
        let message = `Command completed: ${this.highlight(command)}`;
        if (duration) {
            message += ` ${this.dim(`(${duration}ms)`)}`;
        }
        console.log(this.success(message));
    }
    static logCommandError(command, error) {
        console.log(this.error(`Command failed: ${this.highlight(command)}`));
        console.log(this.dim(`Error: ${error}`));
    }
}
exports.CliUI = CliUI;
CliUI.spinner = null;
exports.success = CliUI.success, exports.error = CliUI.error, exports.warning = CliUI.warning, exports.info = CliUI.info, exports.highlight = CliUI.highlight, exports.dim = CliUI.dim, exports.bold = CliUI.bold, exports.section = CliUI.section, exports.subsection = CliUI.subsection, exports.startSpinner = CliUI.startSpinner, exports.updateSpinner = CliUI.updateSpinner, exports.succeedSpinner = CliUI.succeedSpinner, exports.failSpinner = CliUI.failSpinner, exports.stopSpinner = CliUI.stopSpinner, exports.logSuccess = CliUI.logSuccess, exports.logError = CliUI.logError, exports.logWarning = CliUI.logWarning, exports.logInfo = CliUI.logInfo, exports.logSection = CliUI.logSection, exports.logSubsection = CliUI.logSubsection, exports.logProgress = CliUI.logProgress, exports.logKeyValue = CliUI.logKeyValue, exports.formatError = CliUI.formatError, exports.logCommandStart = CliUI.logCommandStart, exports.logCommandSuccess = CliUI.logCommandSuccess, exports.logCommandError = CliUI.logCommandError;
