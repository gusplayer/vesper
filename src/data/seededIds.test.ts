import { describe, expect, it } from 'vitest';

import { es } from '../i18n/es';
import { demoChallenge, demoMembers } from './circleSeed';
import { demoHabits, demoModes, demoSchedules, seedDemoSessions } from './seed';
import { isSeededSession, SEEDED_IDS } from './seededIds';

const NOW = new Date(2026, 8, 25, 12).getTime();

describe('SEEDED_IDS', () => {
  it('names exactly what the seed writes, so removing it cannot miss a row or take one of the user', () => {
    expect([...SEEDED_IDS.modes].sort()).toEqual(demoModes(es.demo).map((mode) => mode.id).sort());
    expect([...SEEDED_IDS.schedules].sort()).toEqual(demoSchedules(es.demo).map((schedule) => schedule.id).sort());
    expect([...SEEDED_IDS.habits].sort()).toEqual(demoHabits(es.demo).map((habit) => habit.id).sort());
    expect([...SEEDED_IDS.members].sort()).toEqual(demoMembers(NOW).map((member) => member.id).sort());
    expect(SEEDED_IDS.challenge).toBe(demoChallenge(NOW, es.demo).id);
  });

  it('recognises every seeded session by its prefix', () => {
    const sessions = seedDemoSessions(NOW);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((session) => isSeededSession(session.id))).toBe(true);
  });

  it('never takes a session the app wrote itself (uuid v7 ids)', () => {
    expect(isSeededSession('0192f3a4-7b1c-7def-8123-456789abcdef')).toBe(false);
  });
});
