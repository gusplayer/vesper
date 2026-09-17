import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeDb, type FakeRows } from '../../db/testing/fakeDb';
import { useSchemeStore } from '../../design/theme';
import { T0 } from '../../domain/fixtures';
import { BREAK_EVERY_MS, OPEN_SESSION_CAP_MS } from '../../domain/session';
import { HOUR, MINUTE } from '../../domain/time';
import { useAppStore } from './app';
import { useFocusStore } from './focus';

/**
 * The focus store against a fake database handle: every action must reach the
 * sessions table through its repository before it touches the cache, and the one
 * running session (invariant 1) must survive a relaunch through hydrate().
 */

let fake = createFakeDb();

vi.mock('../../db/client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
}));

vi.mock('../../lib/uuid', () => ({
  uuidv7: (now: number) => `id-${now}`,
}));

function runningRow(startedAt: number, plannedMs: number, extra: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    activity_id: 'activity-work',
    planned_ms: plannedMs,
    actual_ms: 0,
    outcome: 'running',
    depth: 'firm',
    block_profile: 'mode-x',
    intention: null,
    exit_reason: null,
    interruptions: 0,
    started_at: startedAt,
    ended_at: null,
    open: 0,
    break_ms: 0,
    break_started_at: null,
    next_break_at_ms: BREAK_EVERY_MS,
    ...extra,
  };
}

function updates() {
  return fake.calls.filter((call) => call.sql.includes('UPDATE sessions'));
}

function lastUpdateParams(): unknown[] {
  const call = updates().at(-1);
  if (call === undefined) {
    throw new Error('no UPDATE sessions call');
  }
  return call.params ?? [];
}

beforeEach(() => {
  fake = createFakeDb();
  useFocusStore.setState({ session: null, modeId: null, lastClosed: null, completedCount: 0 });
  useAppStore.setState({ modes: [], habits: [], habitMarks: [], dayStats: [] });
  useSchemeStore.getState().setScheme('light');
});

describe('start', () => {
  it('writes the row through the repository before caching it, and turns the theme dark', () => {
    // Without a mode there is no activity key: the first activity takes the session.
    fake.whenSql('FROM activities WHERE archived_at IS NULL', [
      { id: 'activity-first', key: 'trabajo', label: 'trabajo', is_default: 1, archived_at: null, created_at: 0 },
    ]);

    useFocusStore.getState().start('mode-x', 25 * MINUTE, T0);

    const insert = fake.callMatching(/INSERT INTO sessions/);
    expect(insert.params?.slice(0, 5)).toEqual([`id-${T0}`, 'activity-first', 25 * MINUTE, 0, 'running']);
    expect(useFocusStore.getState().session?.id).toBe(`id-${T0}`);
    expect(useFocusStore.getState().modeId).toBe('mode-x');
    expect(useSchemeStore.getState().scheme).toBe('dark');
  });

  it('never starts a second session while one runs: invariant 1', () => {
    useFocusStore.getState().start('mode-x', 25 * MINUTE, T0);
    useFocusStore.getState().start('mode-y', 50 * MINUTE, T0 + MINUTE);

    expect(fake.calls.filter((call) => call.sql.includes('INSERT INTO sessions'))).toHaveLength(1);
    expect(useFocusStore.getState().session?.id).toBe(`id-${T0}`);
    expect(useFocusStore.getState().modeId).toBe('mode-x');
  });

  it('starts an open session at the 12 h cap, never deep, taking depth and activity from the mode', () => {
    useAppStore.setState({
      modes: [
        {
          id: 'mode-deep',
          name: 'Deep',
          behavior: 'allow',
          appIds: [],
          websiteIds: [],
          depth: 'deep',
          activityId: 'lectura',
          selectionToken: null,
          createdAt: 1,
        },
      ],
    });

    useFocusStore.getState().start('mode-deep', null, T0);

    const session = useFocusStore.getState().session;
    expect(session?.open).toBe(true);
    expect(session?.plannedMs).toBe(OPEN_SESSION_CAP_MS);
    expect(session?.depth).toBe('firm');
    expect(session?.activityId).toBe('lectura');
    expect(session?.blockProfile).toBe('mode-deep');
  });
});

describe('breaks', () => {
  it('refuses a break before it unlocks without writing, then writes it and turns the theme light', () => {
    useFocusStore.getState().start('mode-x', HOUR, T0);

    useFocusStore.getState().takeBreak(T0 + 10 * MINUTE);
    expect(updates()).toHaveLength(0);
    expect(useSchemeStore.getState().scheme).toBe('dark');

    useFocusStore.getState().takeBreak(T0 + 25 * MINUTE);
    expect(updates()).toHaveLength(1);
    expect(useFocusStore.getState().session?.breakStartedAt).toBe(T0 + 25 * MINUTE);
    expect(useSchemeStore.getState().scheme).toBe('light');
  });

  it('resume records what the break took and turns the theme dark again', () => {
    useFocusStore.getState().start('mode-x', HOUR, T0);
    useFocusStore.getState().takeBreak(T0 + 25 * MINUTE);

    useFocusStore.getState().resume(T0 + 30 * MINUTE);

    const session = useFocusStore.getState().session;
    expect(session?.breakMs).toBe(5 * MINUTE);
    expect(session?.breakStartedAt).toBeNull();
    expect(session?.nextBreakAtMs).toBe(50 * MINUTE);
    expect(useSchemeStore.getState().scheme).toBe('dark');

    // Outside a break, resume is a no-op: nothing more is written.
    useFocusStore.getState().resume(T0 + 31 * MINUTE);
    expect(updates()).toHaveLength(2);
  });
});

describe('finish', () => {
  it('closes through the repository, keeps the closed session for the completion screen, and counts it', () => {
    useFocusStore.getState().start('mode-x', 25 * MINUTE, T0);

    const closed = useFocusStore.getState().finish('completed', T0 + 25 * MINUTE);

    expect(closed?.outcome).toBe('completed');
    expect(closed?.actualMs).toBe(25 * MINUTE);
    expect(lastUpdateParams().slice(0, 2)).toEqual([25 * MINUTE, 'completed']);
    expect(useFocusStore.getState().session).toBeNull();
    expect(useFocusStore.getState().lastClosed?.id).toBe(`id-${T0}`);
    expect(useFocusStore.getState().completedCount).toBe(1);
    expect(useSchemeStore.getState().scheme).toBe('light');
  });

  it('cancelled credits only what was served and keeps the reason', () => {
    useFocusStore.getState().start('mode-x', 25 * MINUTE, T0);

    const closed = useFocusStore.getState().finish('cancelled', T0 + 10 * MINUTE, '  me llamaron ');

    expect(closed?.actualMs).toBe(10 * MINUTE);
    expect(closed?.exitReason).toBe('  me llamaron ');
    expect(useFocusStore.getState().completedCount).toBe(0);
  });

  it('is a no-op without a session', () => {
    expect(useFocusStore.getState().finish('completed', T0)).toBeNull();
    expect(updates()).toHaveLength(0);
  });
});

describe('hydrate', () => {
  it('picks up the running row after a relaunch and puts the theme back in dark', () => {
    fake.whenSql(/outcome = 'running'/, [runningRow(T0, HOUR)]);
    fake.whenSql(/COUNT\(\*\)/, [{ n: 3 }]);

    useFocusStore.getState().hydrate();

    expect(useFocusStore.getState().session?.id).toBe('row-1');
    expect(useFocusStore.getState().modeId).toBe('mode-x');
    expect(useFocusStore.getState().completedCount).toBe(3);
    expect(useSchemeStore.getState().scheme).toBe('dark');
  });

  it('keeps the theme light for a session hydrated in the middle of a break', () => {
    useSchemeStore.getState().setScheme('dark');
    fake.whenSql(/outcome = 'running'/, [runningRow(T0, HOUR, { break_started_at: T0 + 25 * MINUTE })]);

    useFocusStore.getState().hydrate();

    expect(useFocusStore.getState().session?.breakStartedAt).toBe(T0 + 25 * MINUTE);
    expect(useSchemeStore.getState().scheme).toBe('light');
  });

  it('clears a stale cache when the database holds no running session', () => {
    useSchemeStore.getState().setScheme('dark');
    useFocusStore.getState().start('mode-x', HOUR, T0);

    useFocusStore.getState().hydrate();

    expect(useFocusStore.getState().session).toBeNull();
    expect(useSchemeStore.getState().scheme).toBe('light');
  });
});

describe('settleNow', () => {
  it('completes a chosen session whose time ran out while the app slept, at its planned end, and counts it', () => {
    useFocusStore.getState().start('mode-x', 25 * MINUTE, T0);

    const settled = useFocusStore.getState().settleNow(T0 + 3 * HOUR);

    expect(settled?.outcome).toBe('completed');
    expect(settled?.endedAt).toBe(T0 + 25 * MINUTE);
    expect(lastUpdateParams().slice(0, 2)).toEqual([25 * MINUTE, 'completed']);
    expect(useFocusStore.getState().session).toBeNull();
    expect(useFocusStore.getState().lastClosed?.id).toBe(`id-${T0}`);
    expect(useFocusStore.getState().completedCount).toBe(1);
    expect(useSchemeStore.getState().scheme).toBe('light');
  });

  it('expires an open session at its cap and does not count it as completed', () => {
    useFocusStore.getState().start('mode-x', null, T0);

    const settled = useFocusStore.getState().settleNow(T0 + 20 * HOUR);

    expect(settled?.outcome).toBe('expired');
    expect(settled?.endedAt).toBe(T0 + OPEN_SESSION_CAP_MS);
    expect(useFocusStore.getState().completedCount).toBe(0);
    expect(useFocusStore.getState().session).toBeNull();
  });

  it('gives the same verdict finish() gives on screen, so SessionGate can call it instead', () => {
    useFocusStore.getState().start('mode-x', 25 * MINUTE, T0);
    const viaFinish = useFocusStore.getState().finish('completed', T0 + 25 * MINUTE);

    useFocusStore.setState({ session: null, lastClosed: null, completedCount: 0 });
    fake = createFakeDb();
    useFocusStore.getState().start('mode-x', 25 * MINUTE, T0);
    const viaSettle = useFocusStore.getState().settleNow(T0 + 25 * MINUTE);

    expect(viaSettle).toEqual(viaFinish);
    expect(useFocusStore.getState().completedCount).toBe(1);
  });

  it('ends an overrun break and keeps the session running', () => {
    useFocusStore.getState().start('mode-x', 2 * HOUR, T0);
    useFocusStore.getState().takeBreak(T0 + 25 * MINUTE);

    const settled = useFocusStore.getState().settleNow(T0 + 50 * MINUTE);

    expect(settled?.outcome).toBe('running');
    expect(settled?.breakMs).toBe(15 * MINUTE);
    expect(useFocusStore.getState().session?.breakStartedAt).toBeNull();
    expect(useSchemeStore.getState().scheme).toBe('dark');
  });

  it('returns null and writes nothing when nothing is owed', () => {
    useFocusStore.getState().start('mode-x', HOUR, T0);
    const before = updates().length;

    expect(useFocusStore.getState().settleNow(T0 + 10 * MINUTE)).toBeNull();
    expect(updates()).toHaveLength(before);
  });
});
