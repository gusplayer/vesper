import { defineConfig } from 'vitest/config';

/**
 * Tests cover the pure modules — src/domain/, src/lib/ and src/db/sql.ts — plus the
 * repositories and the store through a fake database handle. They import no React
 * Native and no native module. Screens and components are verified by running the app.
 *
 * The timezone is pinned: day and week boundaries are local, and a test that passes in
 * Bogotá must pass in CI too. TZ_OVERRIDE lets a second run exercise a DST zone.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: {
      TZ: process.env.TZ_OVERRIDE ?? 'America/Bogota',
    },
    coverage: {
      include: ['src/domain/**/*.ts', 'src/lib/**/*.ts', 'src/db/**/*.ts', 'src/store/**/*.ts'],
      exclude: ['src/domain/types.ts', 'src/domain/fixtures.ts', 'src/lib/useNow.ts', 'src/lib/useRevision.ts', 'src/db/migrations/**'],
      thresholds: { lines: 80, functions: 80 },
    },
  },
});
