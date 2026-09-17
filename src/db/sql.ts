/**
 * Pure SQL text helpers. No database import, so this is unit testable.
 */

/**
 * Splits a migration into single statements, because executeSync runs one at a time.
 *
 * Line comments are stripped before splitting: a migration starts with a comment
 * block, and splitting first would glue that block to the first statement and then
 * discard both.
 *
 * Naive on purpose. Migrations are hand-written DDL with no semicolons inside string
 * literals, and a dumb splitter is safer than shipping half a SQL parser.
 */
export function splitStatements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/** The migrations not yet applied, in id order. */
export function pendingMigrations<T extends { id: number }>(
  all: readonly T[],
  appliedIds: ReadonlySet<number>,
): T[] {
  return all.filter((migration) => !appliedIds.has(migration.id)).sort((a, b) => a.id - b.id);
}
