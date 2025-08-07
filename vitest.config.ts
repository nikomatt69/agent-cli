import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    root: '.',
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'tests/**/*.{test,spec}.{js,ts}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'build',
      'coverage'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/cli/**/*.ts'
      ],
      exclude: [
        'src/cli/**/*.{test,spec}.ts',
        'src/cli/**/types.ts',
        'src/cli/index.ts',
        'src/pages/**/*',
        'src/store/**/*',
        'src/stores/**/*',
        'src/types/**/*'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    setupFiles: ['./tests/setup.ts']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@cli': resolve(__dirname, './src/cli'),
      '@tests': resolve(__dirname, './tests')
    }
  }
});