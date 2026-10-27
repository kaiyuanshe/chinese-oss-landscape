import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid({ hot: false })],
  server: {
    fs: {
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
  },
  resolve: {
    alias: {
      common: fileURLToPath(new URL('./src/test-utils/commonMock.tsx', import.meta.url)),
    },
    conditions: ['browser'],
    dedupe: ['solid-js', 'vitest'],
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts'],
      reporter: ['text', 'lcov', 'clover', 'json'],
    },
    environment: 'jsdom',
    include: [
      'src/**/__tests__/**/*.{ts,tsx}',
      'src/**/*.{spec,test}.{ts,tsx}',
      '../common/src/**/__tests__/**/*.{ts,tsx}',
      '../common/src/**/*.{spec,test}.{ts,tsx}',
      '../embed-item/src/**/__tests__/**/*.{ts,tsx}',
      '../embed-item/src/**/*.{spec,test}.{ts,tsx}',
    ],
    setupFiles: ['./vitest.setup.ts'],
  },
});
