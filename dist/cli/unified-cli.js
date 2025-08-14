"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const autonomous_claude_interface_1 = require("./chat/autonomous-claude-interface");
async function main() {
    try {
        autonomous_claude_interface_1.autonomousClaudeInterface.start();
    }
    catch (error) {
        console.error('Failed to start autonomous interface:', error);
        process.exit(1);
    }
}
process.on('SIGINT', () => {
    autonomous_claude_interface_1.autonomousClaudeInterface.stop();
    process.exit(0);
});
process.on('SIGTERM', () => {
    autonomous_claude_interface_1.autonomousClaudeInterface.stop();
    process.exit(0);
});
main();
