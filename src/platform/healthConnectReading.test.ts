import { describe, expect, it } from 'vitest';

import { dayKeyOf } from '../domain/day';
import { HOUR, MINUTE } from '../domain/time';
import { weekFromHealthConnect } from './healthConnectReading';

const MONDAY = new Date(2026, 8, 21).getTime();
const TUESDAY = new Date(2026, 8, 22).getTime();

const EMPTY = { steps: [], workouts: [], sleep: [] };

describe('weekFromHealthConnect', () => {
  it('keys steps by the local day each slice starts', () => {
    const week = weekFromHealthConnect({
      ...EMPTY,
      steps: [
        { start: MONDAY, count: 8123.4 },
        { start: TUESDAY, count: 12000 },
      ],
    });
    expect(week.stepsByDay).toEqual({ [dayKeyOf(MONDAY)]: 8123, [dayKeyOf(TUESDAY)]: 12000 });
  });

  it('drops steps that are not numbers and never counts below zero', () => {
    const week = weekFromHealthConnect({
      ...EMPTY,
      steps: [
        { start: Number.NaN, count: 100 },
        { start: MONDAY, count: -5 },
      ],
    });
    expect(week.stepsByDay).toEqual({ [dayKeyOf(MONDAY)]: 0 });
  });

  it('keeps workouts that have a length and drops the rest', () => {
    const start = MONDAY + 18 * HOUR;
    const week = weekFromHealthConnect({
      ...EMPTY,
      workouts: [
        { start, end: start + 45 * MINUTE },
        { start, end: start },
      ],
    });
    expect(week.workouts).toEqual([{ start, end: start + 45 * MINUTE }]);
  });

  it('lays a staged night back from its end, so it lands on the morning after', () => {
    const start = MONDAY + 23 * HOUR;
    const end = TUESDAY + 7 * HOUR;
    const week = weekFromHealthConnect({
      ...EMPTY,
      sleep: [
        {
          start,
          end,
          stages: [
            { start, end: start + 30 * MINUTE, stage: 1 },
            { start: start + 30 * MINUTE, end: TUESDAY + 3 * HOUR, stage: 4 },
            { start: TUESDAY + 3 * HOUR, end: TUESDAY + 4 * HOUR, stage: 7 },
            { start: TUESDAY + 4 * HOUR, end, stage: 6 },
          ],
        },
      ],
    });
    const asleepMs = 3.5 * HOUR + 3 * HOUR;
    expect(week.sleepSessions).toEqual([{ start: end - asleepMs, end, asleep: true }]);
    expect(dayKeyOf(week.sleepSessions[0]?.start ?? 0)).toBe(dayKeyOf(TUESDAY));
  });

  it('counts a session without stages as sleep', () => {
    const start = MONDAY + 23 * HOUR;
    const end = TUESDAY + 6 * HOUR;
    const week = weekFromHealthConnect({ ...EMPTY, sleep: [{ start, end, stages: [] }] });
    expect(week.sleepSessions).toEqual([{ start, end, asleep: true }]);
  });

  it('marks a session that was all awake as not asleep', () => {
    const start = MONDAY + 23 * HOUR;
    const end = start + HOUR;
    const week = weekFromHealthConnect({
      ...EMPTY,
      sleep: [{ start, end, stages: [{ start, end, stage: 7 }] }],
    });
    expect(week.sleepSessions).toEqual([{ start, end, asleep: false }]);
  });

  it('drops a session with no length', () => {
    const week = weekFromHealthConnect({ ...EMPTY, sleep: [{ start: MONDAY, end: MONDAY, stages: [] }] });
    expect(week.sleepSessions).toEqual([]);
  });
});
