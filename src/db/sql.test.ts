import { describe, expect, it } from 'vitest';

import { migrations } from './migrations';
import { pendingMigrations, splitStatements } from './sql';

describe('splitStatements', () => {
  it('keeps the first statement when the file opens with a comment block', () => {
    const statements = splitStatements(`
      -- a comment
      -- another one

      CREATE TABLE a (id TEXT);
    `);

    expect(statements).toEqual(['CREATE TABLE a (id TEXT)']);
  });

  it('splits several statements and drops the trailing empty chunk', () => {
    const statements = splitStatements('CREATE TABLE a (id TEXT);\nCREATE INDEX i ON a(id);\n');

    expect(statements).toHaveLength(2);
  });

  it('does not strip a trailing same-line comment', () => {
    // Naive on purpose: only whole comment lines are dropped (see the docblock in
    // sql.ts). Migrations are written knowing this, so pin it rather than hide it.
    const statements = splitStatements('CREATE TABLE a (id TEXT); -- trailing');

    expect(statements).toEqual(['CREATE TABLE a (id TEXT)', '-- trailing']);
  });

  it('is empty for empty or whitespace input', () => {
    expect(splitStatements('')).toEqual([]);
    expect(splitStatements('  \n\t\n')).toEqual([]);
  });

  it('handles CRLF line endings', () => {
    const statements = splitStatements(
      '-- comment\r\nCREATE TABLE a (id TEXT);\r\nCREATE TABLE b (id TEXT);\r\n',
    );

    expect(statements).toEqual(['CREATE TABLE a (id TEXT)', 'CREATE TABLE b (id TEXT)']);
  });

  it('splits two statements on one line', () => {
    expect(splitStatements('CREATE TABLE a (id TEXT); CREATE TABLE b (id TEXT);')).toEqual([
      'CREATE TABLE a (id TEXT)',
      'CREATE TABLE b (id TEXT)',
    ]);
  });

  it('produces only CREATE and ALTER statements from the real migrations', () => {
    for (const migration of migrations) {
      const statements = splitStatements(migration.sql);

      expect(statements.length).toBeGreaterThan(0);
      for (const statement of statements) {
        expect(statement.startsWith('CREATE ') || statement.startsWith('ALTER TABLE ')).toBe(true);
      }
    }
  });

  it('produces every table and index of the init migration', () => {
    const [init] = migrations;
    const statements = splitStatements(init?.sql ?? '');

    expect(statements.filter((s) => s.startsWith('CREATE TABLE'))).toHaveLength(5);
    expect(statements.filter((s) => s.startsWith('CREATE INDEX'))).toHaveLength(2);
  });

  it('does not swallow the table that follows an inline comment block', () => {
    const [init] = migrations;
    const statements = splitStatements(init?.sql ?? '');

    expect(statements.some((s) => s.includes('CREATE TABLE habits'))).toBe(true);
    expect(statements.some((s) => s.includes('CREATE TABLE habit_marks'))).toBe(true);
  });
});

describe('migrations', () => {
  it('have unique, ascending ids', () => {
    const ids = migrations.map((migration) => migration.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});

describe('pendingMigrations', () => {
  const all = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it('is everything in id order when nothing was applied', () => {
    expect(pendingMigrations(all, new Set())).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('is the rest when some were applied', () => {
    expect(pendingMigrations(all, new Set([1, 2]))).toEqual([{ id: 3 }]);
  });

  it('sorts unsorted input', () => {
    expect(pendingMigrations([{ id: 3 }, { id: 1 }, { id: 2 }], new Set())).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
  });

  it('is empty when everything was applied, or there is nothing', () => {
    expect(pendingMigrations(all, new Set([1, 2, 3]))).toEqual([]);
    expect(pendingMigrations([], new Set())).toEqual([]);
  });
});

describe('migration registry', () => {
  it('numbers migrations 1..n with no gap, so a database can never skip one', () => {
    expect(migrations.map((m) => m.id)).toEqual(migrations.map((_, i) => i + 1));
  });

  it('gives every migration a distinct name and at least one statement', () => {
    expect(new Set(migrations.map((m) => m.name)).size).toBe(migrations.length);
    for (const migration of migrations) {
      expect(splitStatements(migration.sql).length).toBeGreaterThan(0);
    }
  });

  it('creates every table once: a later migration alters, never re-creates', () => {
    const created = migrations.flatMap((m) =>
      [...m.sql.matchAll(/CREATE TABLE (\w+)/g)].map((match) => match[1] ?? ''),
    );

    expect(new Set(created).size).toBe(created.length);
  });
});
