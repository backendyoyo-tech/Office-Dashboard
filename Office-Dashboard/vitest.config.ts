import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/'],
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: [
      { find: 'dotenv/config', replacement: path.resolve(__dirname, 'node_modules/dotenv/config.js') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});
