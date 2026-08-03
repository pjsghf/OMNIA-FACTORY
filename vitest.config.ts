import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Node is the default because the library and server suites want a plain Node
    // context. Component tests opt into a DOM with a `@vitest-environment jsdom`
    // docblock (environmentMatchGlobs was removed in Vitest 4).
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'scripts/', 'tests/'],
    },
    testTimeout: 30000,
  },
});
