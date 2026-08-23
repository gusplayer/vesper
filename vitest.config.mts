import { defineConfig } from 'vitest/config';

/**
 * Tests cover the pure modules: src/domain/ and the SQL text helpers. They import no
 * React and no native module, so no React Native transform is needed. Anything that
 * touches op-sqlite or React is verified by running the app.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/domain/**/*.ts', 'src/db/sql.ts'],
      exclude: ['src/domain/types.ts'],
      thresholds: { lines: 80, functions: 80 },
    },
  },
});
