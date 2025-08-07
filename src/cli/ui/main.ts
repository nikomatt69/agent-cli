#!/usr/bin/env node

/**
 * TUI Main Entry Point
 * Standalone entry point for running the TUI
 */

import CLITUIIntegration from './cli-integration';

async function main() {
  const integration = new CLITUIIntegration();
  
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
  } catch (error) {
    console.error('Failed to start TUI:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default main;
