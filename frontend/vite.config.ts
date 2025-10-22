/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'src/setupTests.ts',
        'src/reportWebVitals.ts',
        'src/react-app-env.d.ts',
        'src/index.tsx',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/build/**',
        '**/coverage/**',
        '**/*.d.ts'
      ],
      // Removemos 'all' y usamos 'include' en su lugar
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      // Thresholds de cobertura
      thresholds: {
        lines: 76,
        functions: 76,
        branches: 76,
        statements: 76
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000
  }
});