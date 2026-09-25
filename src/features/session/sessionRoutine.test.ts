import { describe, expect, it } from 'vitest';

import type { RoutineLike } from '../../domain/routines';
import { MINUTE } from '../../domain/time';
import { sessionRoutine } from './sessionRoutine';

// 2026-09-16 is a Wednesday.
const NINE = new Date(2026, 8, 16, 9).getTime();
const SIX_PM = new Date(2026, 8, 16, 18).getTime();
const TEN_THIRTY = new Date(2026, 8, 16, 10, 30).getTime();

function routine(overrides: Partial<RoutineLike> = {}): RoutineLike {
  return {
    id: 'work',
    modeId: 'deep',
    startMinutes: 9 * 60,
    endMinutes: 18 * 60,
    days: [true, true, true, true, true, false, false],
    enabled: true,
    durationMs: null,
    updatedAt: new Date(2026, 8, 1).getTime(),
    ...overrides,
  };
}

/** A session the engine would start at `at`: the routine's mode, ending with the window. */
function engineSession(at: number) {
  return { startedAt: at, plannedMs: SIX_PM - at, open: false, blockProfile: 'deep' };
}

describe('sessionRoutine', () => {
  it('finds the routine whose marked window started the session, even when the app opened late', () => {
    const found = sessionRoutine(engineSession(TEN_THIRTY), [routine()], { work: NINE });
    expect(found?.routine.id).toBe('work');
    expect(found?.window).toEqual({ start: NINE, end: SIX_PM });
  });

  it('does not claim a session when the window was never marked', () => {
    expect(sessionRoutine(engineSession(TEN_THIRTY), [routine()], null)).toBeNull();
    expect(sessionRoutine(engineSession(TEN_THIRTY), [routine()], { work: NINE - 1 })).toBeNull();
  });

  it('does not claim a session started by hand in the same mode inside the window', () => {
    const byHand = { startedAt: TEN_THIRTY, plannedMs: 25 * MINUTE, open: false, blockProfile: 'deep' };
    expect(sessionRoutine(byHand, [routine()], { work: NINE })).toBeNull();
  });

  it('does not claim a session in another mode, or one with no limit', () => {
    expect(sessionRoutine({ ...engineSession(TEN_THIRTY), blockProfile: 'other' }, [routine()], { work: NINE })).toBeNull();
    expect(sessionRoutine({ ...engineSession(TEN_THIRTY), open: true }, [routine()], { work: NINE })).toBeNull();
  });
});
