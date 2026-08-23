import { defineConfig } from 'vitest/config';

/**
 * Only src/domain/ is tested. It is pure TypeScript with no React and no database
 * imports, so it needs no React Native transform. See docs/ARCHITECTURE.md.
 */
export default defineConfig({
  test: {
    include: ['src/domain/**/*.test.ts'],
    coverage: {
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/types.ts'],
      thresholds: { lines: 80, functions: 80 },
    },
  },
});
