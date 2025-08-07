#!/usr/bin/env node
"use strict";
/**
 * TUI Main Entry Point
 * Standalone entry point for running the TUI
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cli_integration_1 = __importDefault(require("./cli-integration"));
async function main() {
    const integration = new cli_integration_1.default();
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nShutting down TUI...');
        await integration.stop();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        console.log('\nShutting down TUI...');
        await integration.stop();
        process.exit(0);
    });
    try {
        await integration.start();
    }
    catch (error) {
        console.error('Failed to start TUI:', error);
        process.exit(1);
    }
}
// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}
exports.default = main;
