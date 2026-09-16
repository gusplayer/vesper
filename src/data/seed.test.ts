import { describe, expect, it } from 'vitest';

import { dayKeyOf } from '../domain/day';
import { DAY } from '../domain/time';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import {
  DEMO_HISTORY_DAYS,
  demoActivities,
  demoApps,
  demoHabits,
  demoModeIdeas,
  demoModes,
  demoSchedules,
  seedDayStats,
  seedDemoSessions,
  seedHabitMarks,
} from './seed';

// Wednesday 2026-08-19, 15:00 local.
const NOW = new Date(2026, 7, 19, 15).getTime();

describe('seedDayStats', () => {
  it('covers the last 70 days, oldest first, ending today with no focus', () => {
    const stats = seedDayStats(NOW);

    expect(stats).toHaveLength(DEMO_HISTORY_DAYS);
    expect(stats[0]?.dayKey).toBe('2026-06-11');
    expect(stats.at(-1)).toMatchObject({ dayKey: '2026-08-19', focusMs: 0, sessions: 0 });
  });

  it('is deterministic', () => {
    expect(seedDayStats(NOW)).toEqual(seedDayStats(NOW));
  });

  it('has a session count of zero exactly when there is no focus', () => {
    for (const stat of seedDayStats(NOW)) {
      expect(stat.sessions === 0).toBe(stat.focusMs === 0);
      expect(stat.segments).toHaveLength(stat.sessions);
    }
  });
});

describe('seedDemoSessions', () => {
  it('produces completed sessions whose day totals match seedDayStats', () => {
    const sessions = seedDemoSessions(NOW);
    const byDay = new Map<string, { focusMs: number; sessions: number }>();
    for (const session of sessions) {
      const key = dayKeyOf(session.startedAt);
      const current = byDay.get(key) ?? { focusMs: 0, sessions: 0 };
      byDay.set(key, { focusMs: current.focusMs + session.actualMs, sessions: current.sessions + 1 });
    }

    for (const stat of seedDayStats(NOW)) {
      const derived = byDay.get(stat.dayKey) ?? { focusMs: 0, sessions: 0 };
      expect(derived.sessions).toBe(stat.sessions);
      // Rounding per session can drift by at most one ms per session.
      expect(Math.abs(derived.focusMs - stat.focusMs)).toBeLessThanOrEqual(stat.sessions);
    }
  });

  it('writes nothing for today and stays inside the window', () => {
    const sessions = seedDemoSessions(NOW);

    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.some((s) => dayKeyOf(s.startedAt) === '2026-08-19')).toBe(false);
    expect(sessions.every((s) => s.startedAt >= NOW - DEMO_HISTORY_DAYS * DAY)).toBe(true);
  });

  it('builds closed, consistent rows with deterministic ids', () => {
    const [first] = seedDemoSessions(NOW);

    expect(first).toMatchObject({
      outcome: 'completed',
      activityId: 'trabajo',
      interruptions: 0,
      intention: null,
    });
    expect(first?.actualMs).toBe(first?.plannedMs);
    expect(first?.endedAt).toBe((first?.startedAt ?? 0) + (first?.actualMs ?? 0));
    expect(first?.id).toBe(`demo-${dayKeyOf(first?.startedAt ?? 0)}-0`);
  });

  it('never repeats an id, and gives the same ids on every call', () => {
    const ids = seedDemoSessions(NOW).map((s) => s.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(seedDemoSessions(NOW).map((s) => s.id)).toEqual(ids);
  });

  it('is sorted oldest first', () => {
    const sessions = seedDemoSessions(NOW);
    for (let i = 1; i < sessions.length; i += 1) {
      expect(sessions[i]?.startedAt).toBeGreaterThan(sessions[i - 1]?.startedAt ?? 0);
    }
  });
});

describe('seedHabitMarks', () => {
  it('marks only days of this week before today, for seeded habits', () => {
    const marks = seedHabitMarks(NOW);
    const habitIds = new Set(demoHabits(es.demo).map((h) => h.id));

    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      expect(habitIds.has(mark.habitId)).toBe(true);
      expect(mark.dayKey >= '2026-08-17' && mark.dayKey < '2026-08-19').toBe(true);
    }
  });

  it('never repeats a (habit, day, source_ref) triple', () => {
    const marks = seedHabitMarks(NOW);
    const keys = marks.map((m) => `${m.habitId}|${m.dayKey}|${m.sourceRef}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has nothing to mark on a Monday', () => {
    expect(seedHabitMarks(new Date(2026, 7, 17, 15).getTime())).toEqual([]);
  });
});

describe('demo data in both languages', () => {
  it('keeps every id the same whatever the language', () => {
    expect(demoApps(en.demo).map((a) => a.id)).toEqual(demoApps(es.demo).map((a) => a.id));
    expect(demoActivities(en.demo).map((a) => a.id)).toEqual(demoActivities(es.demo).map((a) => a.id));
    expect(demoModes(en.demo).map((m) => m.id)).toEqual(demoModes(es.demo).map((m) => m.id));
    expect(demoModeIdeas(en.demo).map((i) => i.id)).toEqual(demoModeIdeas(es.demo).map((i) => i.id));
    expect(demoSchedules(en.demo).map((s) => s.id)).toEqual(demoSchedules(es.demo).map((s) => s.id));
    expect(demoHabits(en.demo).map((h) => h.id)).toEqual(demoHabits(es.demo).map((h) => h.id));
  });

  it('writes the words in the language it is given', () => {
    expect(demoModes(es.demo)[0]?.name).toBe('Sin redes');
    expect(demoModes(en.demo)[0]?.name).toBe('No socials');
    expect(demoSchedules(es.demo)[1]?.name).toBe('Hora de dormir');
    expect(demoSchedules(en.demo)[1]?.name).toBe('Bedtime');
    expect(demoHabits(es.demo).map((h) => h.name)).toEqual(['gym', 'leer', 'dormir 7h']);
    expect(demoHabits(en.demo).map((h) => h.name)).toEqual(['gym', 'read', 'sleep 7h']);
    expect(demoModeIdeas(es.demo)[1]).toMatchObject({ name: 'Dormir', description: 'Bajar el ritmo sin el scroll' });
    expect(demoModeIdeas(en.demo)[1]).toMatchObject({ name: 'Sleep', description: 'Wind down without the scroll' });
  });

  it('resolves app categories and activity labels through the dictionary', () => {
    expect(demoApps(es.demo).find((a) => a.id === 'instagram')?.category).toBe('Redes');
    expect(demoApps(en.demo).find((a) => a.id === 'instagram')?.category).toBe('Social');
    expect(demoActivities(es.demo).find((a) => a.id === 'trabajo')?.label).toBe('trabajo');
    expect(demoActivities(en.demo).find((a) => a.id === 'trabajo')?.label).toBe('work');
  });

  it('points modes, schedules and habits at ids that exist', () => {
    const appIds = new Set(demoApps(es.demo).map((a) => a.id));
    const modeIds = new Set(demoModes(es.demo).map((m) => m.id));
    const activityIds = new Set(demoActivities(es.demo).map((a) => a.id));
    for (const mode of demoModes(es.demo)) {
      expect(mode.appIds.every((id) => appIds.has(id))).toBe(true);
      expect(activityIds.has(mode.activityId)).toBe(true);
    }
    for (const idea of demoModeIdeas(es.demo)) {
      expect(idea.appIds.every((id) => appIds.has(id))).toBe(true);
    }
    for (const schedule of demoSchedules(es.demo)) {
      expect(modeIds.has(schedule.modeId)).toBe(true);
    }
    for (const habit of demoHabits(es.demo)) {
      expect(habit.activityId === null || activityIds.has(habit.activityId)).toBe(true);
    }
  });
});
