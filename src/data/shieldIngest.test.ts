import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aRunningSession, T0 } from '../domain/fixtures';
import { MINUTE, HOUR } from '../domain/time';
import type { Session, ShieldEvent } from '../domain/types';
import { ingestShieldEvents } from './shieldIngest';

/**
 * The replay against an in-memory session table: the repositories are mocked so the
 * running session actually moves from one event to the next, which the fake SQL
 * handle (stubbed rows, no state) cannot do.
 */

const table: { running: Session | null } = { running: null };
const inserted: ShieldEvent[] = [];
const followed: { from: Session; to: Session; origin: unknown }[] = [];

vi.mock('../db/client', () => ({
  transaction: (work: () => void) => work(),
}));

vi.mock('../db/repositories/sessions', () => ({
  findRunning: () => table.running,
  update: (session: Session) => {
    table.running = session.outcome === 'running' ? session : null;
  },
}));

vi.mock('../db/repositories/breaks', () => ({
  follow: (from: Session, to: Session, origin?: unknown) => followed.push({ from, to, origin }),
}));

vi.mock('../db/repositories/shieldEvents', () => ({
  insert: (event: ShieldEvent) => inserted.push(event),
}));

const at = (minutes: number) => T0 + minutes * MINUTE;
const IG = 'com.instagram.android';

function granted(minutes: number, lengthMin: number, token = IG): ShieldEvent {
  return { kind: 'unlock_granted', platform: 'android', token, at: at(minutes), lengthMs: lengthMin * MINUTE };
}

beforeEach(() => {
  table.running = aRunningSession({ plannedMs: HOUR });
  inserted.length = 0;
  followed.length = 0;
});

describe('ingestShieldEvents', () => {
  it('stores every event, oldest first, and says nothing changed without a break', () => {
    const hit: ShieldEvent = { kind: 'shield_hit', platform: 'android', token: IG, at: at(12), lengthMs: null };
    const back: ShieldEvent = { kind: 'backed_off', platform: 'android', token: IG, at: at(10), lengthMs: null };

    expect(ingestShieldEvents([hit, back])).toBe(false);
    expect(inserted.map((event) => event.at)).toEqual([at(10), at(12)]);
    expect(table.running?.breakStartedAt).toBeNull();
  });

  it('starts the break at the tap, with its length and its app', () => {
    expect(ingestShieldEvents([granted(30, 10)])).toBe(true);

    expect(table.running?.breakStartedAt).toBe(at(30));
    expect(table.running?.breakLengthMs).toBe(10 * MINUTE);
    expect(followed).toHaveLength(1);
    expect(followed[0]?.origin).toEqual({ source: 'shield', token: IG });
  });

  it('ends a break that was over before the next tap, so both land', () => {
    // 5 min at minute 30, then 10 min at minute 60 (25 min of focus after the first).
    ingestShieldEvents([granted(30, 5), granted(60, 10, 'com.zhiliaoapp.musically')]);

    expect(table.running?.breakMs).toBe(5 * MINUTE);
    expect(table.running?.breakStartedAt).toBe(at(60));
    expect(table.running?.breakLengthMs).toBe(10 * MINUTE);
    // Open, close, open.
    expect(followed.map((step) => step.to.breakStartedAt)).toEqual([at(30), null, at(60)]);
  });

  it('refuses a break the domain would not have allowed then, and still stores the event', () => {
    expect(ingestShieldEvents([granted(10, 10)])).toBe(false);

    expect(inserted).toHaveLength(1);
    expect(table.running?.breakStartedAt).toBeNull();
    expect(followed).toHaveLength(0);
  });

  it('stores events with no session running', () => {
    table.running = null;

    expect(ingestShieldEvents([granted(30, 10)])).toBe(false);
    expect(inserted).toHaveLength(1);
  });

  it('does nothing for an empty queue', () => {
    expect(ingestShieldEvents([])).toBe(false);
    expect(inserted).toHaveLength(0);
  });
});
