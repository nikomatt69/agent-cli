"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const autonomous_claude_interface_1 = require("./chat/autonomous-claude-interface");
/**
 * Unified CLI Entry Point
 * Provides Claude Code-style autonomous terminal interface
 */
async function main() {
    try {
        autonomous_claude_interface_1.autonomousClaudeInterface.start();
    }
    catch (error) {
        console.error('Failed to start autonomous interface:', error);
        process.exit(1);
    }
}
// Handle process termination
process.on('SIGINT', () => {
    autonomous_claude_interface_1.autonomousClaudeInterface.stop();
    process.exit(0);
});
process.on('SIGTERM', () => {
    autonomous_claude_interface_1.autonomousClaudeInterface.stop();
    process.exit(0);
});
// Start the CLI
main();
