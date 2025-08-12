"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindFilesTool = void 0;
const glob_1 = require("glob");
const base_tool_1 = require("./base-tool");
const secure_file_tools_1 = require("./secure-file-tools");
const terminal_ui_1 = require("../ui/terminal-ui");
class FindFilesTool extends base_tool_1.BaseTool {
    constructor(workingDirectory) {
        super('find-files-tool', workingDirectory);
    }
    async execute(pattern, options = {}) {
        const startTime = Date.now();
        try {
            const sanitizedCwd = (0, secure_file_tools_1.sanitizePath)(options.cwd || '.', this.workingDirectory);
            const files = glob_1.glob.sync(pattern, { cwd: sanitizedCwd, nodir: true });
            // Show file list in structured UI
            if (files.length > 0) {
                terminal_ui_1.advancedUI.showFileList(files, `🔍 Find: ${pattern}`);
            }
            return {
                success: true,
                data: files,
                metadata: {
                    executionTime: Date.now() - startTime,
                    toolName: this.name,
                    parameters: { pattern, options }
                }
            };
        }
        catch (error) {
            return {
                success: false,
                data: [],
                error: error.message,
                metadata: {
                    executionTime: Date.now() - startTime,
                    toolName: this.name,
                    parameters: { pattern, options }
                }
            };
        }
    }
}
exports.FindFilesTool = FindFilesTool;
