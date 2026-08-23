import { describe, expect, it } from 'vitest';

import { migrations } from './migrations';
import { splitStatements } from './sql';

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

  it('produces every statement of the real init migration', () => {
    const [init] = migrations;
    const statements = splitStatements(init?.sql ?? '');

    // 5 tables plus 2 indexes.
    expect(statements).toHaveLength(7);
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
