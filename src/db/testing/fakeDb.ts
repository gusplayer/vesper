/**
 * A fake database handle for repository tests. It records every executeSync call and
 * answers with whatever rows the test queued for a matching SQL pattern.
 *
 * Not a test file, so vitest does not collect it; not imported by app code either.
 */

export type FakeRows = Array<Record<string, unknown>>;

export type FakeCall = {
  sql: string;
  params: unknown[] | undefined;
};

export type FakeDb = {
  calls: FakeCall[];
  executeSync: (sql: string, params?: unknown[]) => { rows: FakeRows };
  /** Queues rows for the first query matching `pattern`. Earlier registrations win. */
  whenSql: (pattern: RegExp | string, rows: FakeRows) => void;
  /** The first recorded call matching `pattern`. Throws when there is none. */
  callMatching: (pattern: RegExp | string) => FakeCall;
};

function matches(pattern: RegExp | string, sql: string): boolean {
  return typeof pattern === 'string' ? sql.includes(pattern) : pattern.test(sql);
}

export function createFakeDb(): FakeDb {
  const calls: FakeCall[] = [];
  const stubs: Array<{ pattern: RegExp | string; rows: FakeRows }> = [];

  return {
    calls,
    executeSync: (sql, params) => {
      calls.push({ sql, params });
      const stub = stubs.find((candidate) => matches(candidate.pattern, sql));
      return { rows: stub?.rows ?? [] };
    },
    whenSql: (pattern, rows) => {
      stubs.push({ pattern, rows });
    },
    callMatching: (pattern) => {
      const call = calls.find((candidate) => matches(pattern, candidate.sql));
      if (call === undefined) {
        throw new Error(`no call matched ${String(pattern)}`);
      }
      return call;
    },
  };
}

/** The columns declared by `CREATE TABLE <table> (...)` in a migration's DDL. */
export function ddlColumns(ddl: string, table: string): string[] {
  const body = new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\n\\);`).exec(ddl)?.[1];
  if (body === undefined) {
    throw new Error(`no CREATE TABLE ${table} in the DDL`);
  }
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('--') && !line.startsWith('UNIQUE'))
    .map((line) => line.split(/\s+/)[0] ?? '');
}

/** The table and column list of an INSERT statement. */
export function insertColumns(sql: string): { table: string; columns: string[] } {
  const match = /INSERT(?: OR IGNORE)? INTO (\w+)\s*\(([^)]*)\)/.exec(sql);
  if (match === null) {
    throw new Error('not an INSERT statement');
  }
  const [, table = '', list = ''] = match;
  return { table, columns: list.split(',').map((column) => column.trim()) };
}
