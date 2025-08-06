#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// Run the TypeScript CLI directly with ts-node
const cliPath = path.join(__dirname, '..', 'src', 'cli', 'index.ts');

try {
  execSync(`npx ts-node ${cliPath} ${process.argv.slice(2).join(' ')}`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  process.exit(error.status || 1);
}
