import { describe, expect, it } from 'vitest';

import type { NotificationPrefs, Schedule } from '../data/types';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { atMinuteOfDay, dayKeyOf, dayStartShifted } from './day';
import { aRunningSession, T0 } from './fixtures';
import {
  applyDailyBudget,
  challengeEndReminders,
  challengeRiskReminders,
  DAILY_BUDGET,
  DAILY_STAGGER_MINUTES,
  dailyOffsetMinutes,
  EXPO_SATURDAY,
  EXPO_SUNDAY,
  expoWeekday,
  inQuietHours,
  noFocusReminders,
  plannedNotifications,
  QUIET_START_MINUTES,
  reactivationReminders,
  scheduleReminders,
  breakEndReminder,
  sessionEndReminder,
  streakRiskReminders,
  weeklyCloseReminder,
  withoutQuietHours,
  type ChallengeReminder,
  type DateSpec,
  type NotificationKind,
  type ReminderState,
} from './reminders';
import { startBreak } from './session';
import type { StreakState } from './streak';
import { HOUR, MINUTE } from './time';

const ES = es.notifications;
const EN = en.notifications;

const REMINDER_MINUTES = 20 * 60;

const ALL_ON: NotificationPrefs = {
  coaching: true,
  updates: true,
  sessionEnd: true,
  weeklyClose: true,
  streak: true,
  noFocus: true,
  reactivation: true,
  challenges: true,
  nudges: true,
  reminderMinutes: REMINDER_MINUTES,
};
const ALL_OFF: NotificationPrefs = {
  coaching: false,
  updates: false,
  sessionEnd: false,
  weeklyClose: false,
  streak: false,
  noFocus: false,
  reactivation: false,
  challenges: false,
  nudges: false,
  reminderMinutes: REMINDER_MINUTES,
};

/** Tuesday 2023-11-14, noon, local: the reminder hour is still ahead. */
const NOON = new Date(2023, 10, 14, 12, 0).getTime();
/** The same day at 21:00 local: the reminder hour has passed. */
const EVENING = new Date(2023, 10, 14, 21, 0).getTime();
const TODAY_AT = atMinuteOfDay(NOON, REMINDER_MINUTES);
const TOMORROW_AT = atMinuteOfDay(dayStartShifted(NOON, 1), REMINDER_MINUTES);
const TODAY_KEY = dayKeyOf(NOON);
const TOMORROW_KEY = dayKeyOf(TOMORROW_AT);

/**
 * The instant one daily class fires at, `days` calendar days from noon: the chosen
 * hour plus the class's fixed offset inside it (ADR-0040).
 */
function dailyAt(kind: NotificationKind, days: number, from: number = NOON): number {
  return atMinuteOfDay(dayStartShifted(from, days), REMINDER_MINUTES + dailyOffsetMinutes(kind));
}

function aStreak(overrides: Partial<StreakState> = {}): StreakState {
  // A two-day streak with today counted: only tomorrow's streak notice by default.
  return { days: 2, todayCounts: true, graceLeft: 3, graceYesterday: false, ...overrides };
}

function aSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sched-1',
    name: 'Trabajo',
    modeId: 'mode-1',
    durationMs: null,
    startMinutes: 9 * 60 + 30,
    endMinutes: 18 * 60,
    days: [true, true, true, true, true, false, false],
    enabled: true,
    updatedAt: 0,
    ...overrides,
  };
}

function aState(overrides: Partial<ReminderState> = {}): ReminderState {
  return {
    session: null,
    schedules: [],
    modes: [{ id: 'mode-1', name: 'Trabajo profundo' }],
    prefs: ALL_ON,
    allowed: true,
    now: NOON,
    challenges: [],
    streak: aStreak(),
    lastOpenedAt: null,
    hasCircle: false,
    ...overrides,
  };
}

function ids(specs: readonly { id: string }[]): string[] {
  return specs.map((s) => s.id);
}

describe('expoWeekday', () => {
  it('maps every Monday-first index to expo weekday, Sunday = 1 … Saturday = 7', () => {
    // Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
    expect([0, 1, 2, 3, 4, 5, 6].map(expoWeekday)).toEqual([2, 3, 4, 5, 6, 7, 1]);
    expect(expoWeekday(5)).toBe(EXPO_SATURDAY);
    expect(expoWeekday(6)).toBe(EXPO_SUNDAY);
  });
});

describe('sessionEndReminder', () => {
  it('fires at startedAt + plannedMs, not at now', () => {
    const session = aRunningSession({ startedAt: T0, plannedMs: 50 * MINUTE });

    const spec = sessionEndReminder(session, ES);

    expect(spec?.trigger).toBe('date');
    expect(spec?.at).toBe(T0 + 50 * MINUTE);
    expect(spec?.id).toBe('session-end-session-1');
  });

  it('spells the planned duration and makes a sound', () => {
    const spec = sessionEndReminder(aRunningSession({ plannedMs: HOUR + 15 * MINUTE }), ES);

    expect(spec?.title).toBe('Terminó tu sesión');
    expect(spec?.body).toBe('1h 15m de foco. Vuelve a Vesper para cerrarla.');
    expect(spec?.sound).toBe(true);
  });

  it('speaks English with the English slice, same id and instant', () => {
    const session = aRunningSession({ plannedMs: HOUR + 15 * MINUTE });

    const spec = sessionEndReminder(session, EN);

    expect(spec?.id).toBe(sessionEndReminder(session, ES)?.id);
    expect(spec?.at).toBe(sessionEndReminder(session, ES)?.at);
    expect(spec?.title).toBe('Your session ended');
    expect(spec?.body).toBe('1h 15m of focus. Come back to Vesper to close it.');
  });

  it('moves with the breaks and is silent during one', () => {
    const rested = aRunningSession({ breakMs: 10 * MINUTE });
    expect(sessionEndReminder(rested, ES)?.at).toBe(T0 + HOUR + 10 * MINUTE);

    const onBreak = startBreak(aRunningSession({ nextBreakAtMs: 0 }), T0 + 30 * MINUTE);
    expect(sessionEndReminder(onBreak, ES)).toBeNull();
  });

  it('has nothing to say about an open session', () => {
    expect(sessionEndReminder(aRunningSession({ open: true }), ES)).toBeNull();
  });
});

describe('breakEndReminder', () => {
  it('fires when the break runs out, with an id per break', () => {
    const onBreak = startBreak(aRunningSession({ nextBreakAtMs: 0 }), T0 + 30 * MINUTE);

    const spec = breakEndReminder(onBreak, ES);

    expect(spec?.at).toBe(T0 + 45 * MINUTE);
    expect(spec?.id).toBe(`break-end-session-1-${T0 + 30 * MINUTE}`);
    expect(spec?.title).toBe('Se acabó la pausa');
    expect(breakEndReminder(onBreak, EN)?.title).toBe('Break is over');
    expect(breakEndReminder(aRunningSession(), ES)).toBeNull();
  });

  it('replaces the session notice in the plan while the break lasts', () => {
    const onBreak = startBreak(aRunningSession({ nextBreakAtMs: 0 }), T0 + 30 * MINUTE);

    const kinds = plannedNotifications(aState({ session: onBreak, prefs: { ...ALL_OFF, sessionEnd: true } }), ES).map((s) => s.kind);

    expect(kinds).toEqual(['breakEnd']);
  });
});

describe('scheduleReminders', () => {
  it('produces one weekly spec per enabled day with the start hour and minute', () => {
    const specs = scheduleReminders(aSchedule(), 'Trabajo profundo', ES);

    expect(specs).toHaveLength(5);
    expect(specs.map((s) => s.weekday)).toEqual([2, 3, 4, 5, 6]);
    expect(specs.every((s) => s.hour === 9 && s.minute === 30)).toBe(true);
    expect(specs.map((s) => s.id)).toEqual([
      'schedule-sched-1-2',
      'schedule-sched-1-3',
      'schedule-sched-1-4',
      'schedule-sched-1-5',
      'schedule-sched-1-6',
    ]);
  });

  it('names the schedule and the mode, without sound', () => {
    const [spec] = scheduleReminders(aSchedule({ days: [false, false, false, false, false, false, true] }), 'Sin redes', ES);

    expect(spec?.weekday).toBe(EXPO_SUNDAY);
    expect(spec?.title).toBe('Empieza Trabajo');
    expect(spec?.body).toBe('Modo Sin redes. Toca para empezar la sesión.');
    expect(spec?.sound).toBe(false);
  });

  it('names the schedule and the mode in English', () => {
    const [spec] = scheduleReminders(aSchedule({ days: [false, false, false, false, false, false, true] }), 'No social', EN);

    expect(spec?.id).toBe('schedule-sched-1-1');
    expect(spec?.title).toBe('Trabajo starts');
    expect(spec?.body).toBe('No social mode. Tap to start the session.');
  });

  it('produces nothing for a disabled schedule', () => {
    expect(scheduleReminders(aSchedule({ enabled: false }), 'x', ES)).toEqual([]);
  });

  it('produces nothing for a schedule with no days', () => {
    expect(scheduleReminders(aSchedule({ days: [false, false, false, false, false, false, false] }), 'x', ES)).toEqual([]);
  });
});

describe('weeklyCloseReminder', () => {
  it('is Sunday at 20:00', () => {
    const spec = weeklyCloseReminder(ES);

    expect(spec.weekday).toBe(EXPO_SUNDAY);
    expect(spec.hour).toBe(20);
    expect(spec.minute).toBe(0);
    expect(spec.title).toBe('Cierra la semana');
    expect(spec.id).toBe('weekly-close');
  });

  it('keeps the same id and instant in English', () => {
    const spec = weeklyCloseReminder(EN);

    expect(spec.id).toBe('weekly-close');
    expect(spec.weekday).toBe(EXPO_SUNDAY);
    expect(spec.title).toBe('Close the week');
    expect(spec.body).toBe('See how it went. The one starting tomorrow begins at zero.');
  });
});

describe('plannedNotifications', () => {
  it('plans nothing when not allowed, whatever the state', () => {
    const state = aState({ session: aRunningSession(), schedules: [aSchedule()], allowed: false });

    expect(plannedNotifications(state, ES)).toEqual([]);
  });

  it('plans nothing when every preference is off', () => {
    const state = aState({ session: aRunningSession(), schedules: [aSchedule()], prefs: ALL_OFF });

    expect(plannedNotifications(state, ES)).toEqual([]);
  });

  it('sessionEnd gates the session notice', () => {
    const session = aRunningSession();

    expect(plannedNotifications(aState({ session, prefs: { ...ALL_OFF, sessionEnd: true } }), ES).map((s) => s.id)).toEqual([
      'session-end-session-1',
    ]);
    expect(plannedNotifications(aState({ session, prefs: { ...ALL_ON, sessionEnd: false } }), ES).some((s) => s.kind === 'sessionEnd')).toBe(false);
  });

  it('drops the session notice once the session is no longer running', () => {
    const closed = aRunningSession({ outcome: 'completed', actualMs: HOUR, endedAt: T0 + HOUR });

    expect(plannedNotifications(aState({ session: closed }), ES).some((s) => s.kind === 'sessionEnd')).toBe(false);
    expect(plannedNotifications(aState({ session: null }), ES).some((s) => s.kind === 'sessionEnd')).toBe(false);
  });

  it('coaching gates the schedule notices', () => {
    const schedules = [aSchedule()];

    const on = plannedNotifications(aState({ schedules, prefs: { ...ALL_OFF, coaching: true } }), ES);
    expect(on).toHaveLength(5);
    expect(on.every((s) => s.kind === 'schedule')).toBe(true);

    const off = plannedNotifications(aState({ schedules, prefs: { ...ALL_ON, coaching: false } }), ES);
    expect(off.some((s) => s.kind === 'schedule')).toBe(false);
  });

  it('weeklyClose gates the Sunday notice', () => {
    expect(plannedNotifications(aState({ prefs: { ...ALL_OFF, weeklyClose: true } }), ES).map((s) => s.id)).toEqual(['weekly-close']);
    expect(plannedNotifications(aState({ prefs: { ...ALL_ON, weeklyClose: false } }), ES).some((s) => s.kind === 'weeklyClose')).toBe(false);
  });

  it('skips disabled schedules and schedules whose mode is gone', () => {
    const schedules = [
      aSchedule({ id: 'off', enabled: false }),
      aSchedule({ id: 'orphan', modeId: 'mode-deleted' }),
      aSchedule({ id: 'live', days: [true, false, false, false, false, false, false] }),
    ];

    const ids = plannedNotifications(aState({ schedules, prefs: { ...ALL_OFF, coaching: true } }), ES).map((s) => s.id);

    expect(ids).toEqual(['schedule-live-2']);
  });

  it('puts the mode name in the schedule body', () => {
    const [spec] = plannedNotifications(
      aState({ schedules: [aSchedule({ days: [true, false, false, false, false, false, false] })], prefs: { ...ALL_OFF, coaching: true } }),
      ES,
    );

    expect(spec?.body).toBe('Modo Trabajo profundo. Toca para empezar la sesión.');
  });

  it('carries the words of the slice it is given: a language change is a change of plan', () => {
    const state = aState({ schedules: [aSchedule({ days: [true, false, false, false, false, false, false] })], prefs: { ...ALL_OFF, coaching: true } });

    const [spanish] = plannedNotifications(state, ES);
    const [english] = plannedNotifications(state, EN);

    expect(english?.id).toBe(spanish?.id);
    expect(english?.body).toBe('Trabajo profundo mode. Tap to start the session.');
    expect(english?.body).not.toBe(spanish?.body);
  });

  it('is the full set: schedules, weekly close and the daily notices together, with unique ids', () => {
    const state = aState({
      schedules: [aSchedule(), aSchedule({ id: 'sched-2', days: [false, false, false, false, false, true, true] })],
      streak: aStreak({ days: 5, todayCounts: false }),
      lastOpenedAt: NOON,
    });

    const specs = plannedNotifications(state, ES);

    expect(specs).toHaveLength(5 + 2 + 1 + 2 + 2);
    expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length);
  });

  describe('silence in session (ADR-0027 §1)', () => {
    const loud = (session: ReminderState['session']) =>
      aState({
        session,
        schedules: [aSchedule()],
        streak: aStreak({ days: 5, todayCounts: false }),
        lastOpenedAt: NOON,
      });

    it('holds only the session notice while a session runs, whatever else is on', () => {
      const specs = plannedNotifications(loud(aRunningSession()), ES);

      expect(specs.map((s) => s.kind)).toEqual(['sessionEnd']);
    });

    it('holds only the break notice during a break', () => {
      const onBreak = startBreak(aRunningSession({ nextBreakAtMs: 0 }), T0 + 30 * MINUTE);

      const specs = plannedNotifications(loud(onBreak), ES);

      expect(specs.map((s) => s.kind)).toEqual(['breakEnd']);
    });

    it('holds nothing at all while a session runs with sessionEnd off', () => {
      const state = { ...loud(aRunningSession()), prefs: { ...ALL_ON, sessionEnd: false } };

      expect(plannedNotifications(state, ES)).toEqual([]);
    });

    it('puts everything back once the session closes', () => {
      const closed = aRunningSession({ outcome: 'completed', actualMs: HOUR, endedAt: T0 + HOUR });

      const kinds = new Set(plannedNotifications(loud(closed), ES).map((s) => s.kind));

      expect(kinds).toEqual(new Set(['schedule', 'weeklyClose', 'streakRisk', 'reactivation']));
    });
  });

  it('gates each daily kind by its own preference', () => {
    const state = aState({ streak: aStreak({ days: 5, todayCounts: false }), lastOpenedAt: NOON });

    expect(plannedNotifications({ ...state, prefs: { ...ALL_OFF, streak: true } }, ES).every((s) => s.kind === 'streakRisk')).toBe(true);
    expect(plannedNotifications({ ...state, prefs: { ...ALL_OFF, reactivation: true } }, ES).every((s) => s.kind === 'reactivation')).toBe(true);
    expect(plannedNotifications({ ...state, prefs: { ...ALL_OFF, noFocus: true } }, ES)).toEqual([]);
  });

  it('drops a daily notice whose hour falls in quiet hours, even if the preference asks for it', () => {
    const state = aState({
      prefs: { ...ALL_ON, reminderMinutes: 23 * 60 },
      streak: aStreak({ days: 5, todayCounts: false }),
      lastOpenedAt: NOON,
    });

    const kinds = plannedNotifications(state, ES).map((s) => s.kind);

    expect(kinds).toEqual(['weeklyClose']);
  });
});

describe('streakRiskReminders', () => {
  it('plans today and tomorrow when the hour is ahead, the streak is 2+ and today does not count', () => {
    const specs = streakRiskReminders(aState({ streak: aStreak({ days: 12, todayCounts: false }) }), ES);

    expect(ids(specs)).toEqual([`streak-risk-${TODAY_KEY}`, `streak-risk-${TOMORROW_KEY}`]);
    expect(specs.map((s) => s.at)).toEqual([TODAY_AT, TOMORROW_AT]);
    expect(specs[0]?.title).toBe('Tu racha de 12 días termina a medianoche');
    expect(specs[0]?.body).toBe('10 minutos bastan.');
    expect(specs.every((s) => s.kind === 'streakRisk' && s.trigger === 'date' && !s.sound)).toBe(true);
  });

  it('plans only tomorrow once the hour has passed', () => {
    const specs = streakRiskReminders(aState({ now: EVENING, streak: aStreak({ days: 12, todayCounts: false }) }), ES);

    expect(ids(specs)).toEqual([`streak-risk-${TOMORROW_KEY}`]);
  });

  it('plans only tomorrow, with the same number, when today already counts', () => {
    const specs = streakRiskReminders(aState({ streak: aStreak({ days: 12, todayCounts: true }) }), ES);

    expect(ids(specs)).toEqual([`streak-risk-${TOMORROW_KEY}`]);
    expect(specs[0]?.title).toBe('Tu racha de 12 días termina a medianoche');
  });

  it('says nothing under two days, or with the preference off', () => {
    expect(streakRiskReminders(aState({ streak: aStreak({ days: 1, todayCounts: false }) }), ES)).toEqual([]);
    expect(streakRiskReminders(aState({ streak: aStreak({ days: 1, todayCounts: true }) }), ES)).toEqual([]);
    expect(streakRiskReminders(aState({ prefs: { ...ALL_ON, streak: false }, streak: aStreak({ days: 12, todayCounts: false }) }), ES)).toEqual([]);
  });

  it('speaks English with the English slice, same ids', () => {
    const state = aState({ streak: aStreak({ days: 12, todayCounts: false }) });

    const [spec] = streakRiskReminders(state, EN);

    expect(spec?.id).toBe(streakRiskReminders(state, ES)[0]?.id);
    expect(spec?.title).toBe('Your 12-day streak ends at midnight');
    expect(spec?.body).toBe('10 minutes are enough.');
  });
});

describe('noFocusReminders', () => {
  it('plans today and tomorrow when there is no streak and today does not count', () => {
    const specs = noFocusReminders(aState({ streak: aStreak({ days: 1, todayCounts: false }) }), ES);

    expect(ids(specs)).toEqual([`no-focus-${TODAY_KEY}`, `no-focus-${TOMORROW_KEY}`]);
    expect(specs.map((s) => s.at)).toEqual([dailyAt('noFocus', 0), dailyAt('noFocus', 1)]);
    expect(specs[0]?.title).toBe('Hoy no has enfocado');
    expect(specs[0]?.body).toBe('25 minutos y listo.');
    expect(specs.every((s) => s.kind === 'noFocus' && !s.sound)).toBe(true);
    expect(noFocusReminders(aState({ streak: aStreak({ days: 0, todayCounts: false }) }), EN)[0]?.title).toBe('No focus yet today');
  });

  it('plans only tomorrow once the hour has passed', () => {
    const specs = noFocusReminders(aState({ now: EVENING, streak: aStreak({ days: 0, todayCounts: false }) }), ES);

    expect(ids(specs)).toEqual([`no-focus-${TOMORROW_KEY}`]);
  });

  it('plans only tomorrow when today counts but the streak is still short', () => {
    const specs = noFocusReminders(aState({ streak: aStreak({ days: 1, todayCounts: true }) }), ES);

    expect(ids(specs)).toEqual([`no-focus-${TOMORROW_KEY}`]);
  });

  it('says nothing when there is a streak to warn about, or with the preference off', () => {
    expect(noFocusReminders(aState({ streak: aStreak({ days: 2, todayCounts: false }) }), ES)).toEqual([]);
    expect(noFocusReminders(aState({ streak: aStreak({ days: 12, todayCounts: true }) }), ES)).toEqual([]);
    expect(noFocusReminders(aState({ prefs: { ...ALL_ON, noFocus: false }, streak: aStreak({ days: 0, todayCounts: false }) }), ES)).toEqual([]);
  });

  it('never coincides with the streak notice, and tomorrow always holds exactly one of the two', () => {
    for (const days of [0, 1, 2, 3, 12]) {
      for (const todayCounts of [false, true]) {
        const state = aState({ streak: aStreak({ days, todayCounts }) });
        const tomorrow = [...streakRiskReminders(state, ES), ...noFocusReminders(state, ES)].filter(
          (s) => dayKeyOf(s.at) === TOMORROW_KEY,
        );
        expect(tomorrow).toHaveLength(1);
      }
    }
  });
});

describe('challengeRiskReminders', () => {
  function aChallenge(overrides: Partial<ChallengeReminder> = {}): ChallengeReminder {
    return {
      id: 'challenge-1',
      name: 'Leer',
      needed: 3,
      daysLeft: 3,
      atRisk: true,
      markedToday: false,
      endsOn: null,
      ...overrides,
    };
  }

  it('plans today, for the challenge that can only still be met day by day', () => {
    const specs = challengeRiskReminders(aState({ challenges: [aChallenge()] }), ES);

    expect(ids(specs)).toEqual([`challenge-risk-challenge-1-${TODAY_KEY}`]);
    expect(specs[0]?.at).toBe(dailyAt('challengeRisk', 0));
    expect(specs[0]?.title).toBe('Leer se te está yendo');
    expect(specs[0]?.body).toBe('Te faltan 3 y quedan 3 días. Márcalo hoy.');
    expect(specs.every((s) => s.kind === 'challengeRisk' && s.trigger === 'date' && !s.sound)).toBe(true);
  });

  it('says nothing when it is not at risk, when today is marked, or with the preference off', () => {
    expect(challengeRiskReminders(aState({ challenges: [aChallenge({ atRisk: false })] }), ES)).toEqual([]);
    expect(challengeRiskReminders(aState({ challenges: [aChallenge({ markedToday: true })] }), ES)).toEqual([]);
    expect(
      challengeRiskReminders(aState({ prefs: { ...ALL_ON, challenges: false }, challenges: [aChallenge()] }), ES),
    ).toEqual([]);
  });

  it('says nothing once the reminder hour has passed: tomorrow depends on today', () => {
    expect(challengeRiskReminders(aState({ now: EVENING, challenges: [aChallenge()] }), ES)).toEqual([]);
  });

  it('keeps only the tightest challenge: fewest days left, then most needed', () => {
    const specs = challengeRiskReminders(
      aState({
        challenges: [
          aChallenge({ id: 'far', needed: 4, daysLeft: 4 }),
          aChallenge({ id: 'near', name: 'Caminar', needed: 2, daysLeft: 2 }),
          aChallenge({ id: 'tied', needed: 2, daysLeft: 2 }),
        ],
      }),
      ES,
    );

    expect(ids(specs)).toEqual([`challenge-risk-near-${TODAY_KEY}`]);
    expect(specs[0]?.title).toBe('Caminar se te está yendo');
  });

  it('speaks English with the English slice, same id', () => {
    const state = aState({ challenges: [aChallenge({ needed: 1, daysLeft: 1 })] });

    const [spec] = challengeRiskReminders(state, EN);

    expect(spec?.id).toBe(challengeRiskReminders(state, ES)[0]?.id);
    expect(spec?.title).toBe('Leer is slipping away');
    expect(spec?.body).toBe('You need 1 more and 1 day is left. Mark it today.');
  });
});

describe('challengeEndReminders', () => {
  const ending = (dayKey: string, met = 2, total = 3): ChallengeReminder => ({
    id: 'challenge-1',
    name: 'Leer',
    needed: 0,
    daysLeft: 0,
    atRisk: false,
    markedToday: false,
    endsOn: { dayKey, met, total },
  });

  it('knocks the day after the last day, once, with how the whole thing went', () => {
    const specs = challengeEndReminders(aState({ challenges: [ending(TODAY_KEY)] }), ES);

    expect(ids(specs)).toEqual([`challenge-end-challenge-1-${TODAY_KEY}`]);
    expect(specs[0]?.at).toBe(dailyAt('challengeEnd', 1));
    expect(specs[0]?.title).toBe('Terminó Leer');
    expect(specs[0]?.body).toBe('Cumpliste 2 de 3 semanas.');
  });

  it('counts a clean run whole', () => {
    const [spec] = challengeEndReminders(aState({ challenges: [ending(TODAY_KEY, 3, 3)] }), ES);

    expect(spec?.body).toBe('Cumpliste las 3 semanas.');
    expect(challengeEndReminders(aState({ challenges: [ending(TODAY_KEY, 3, 3)] }), EN)[0]?.body).toBe(
      'You kept all 3 weeks.',
    );
  });

  it('plans the notice before the last day arrives, so a phone that stays closed still hears it', () => {
    // The last sync was three days before the last day. If the notice waited for the
    // end to pass, a phone that is not opened that day would never hear how it went.
    const lastDay = dayKeyOf(dayStartShifted(NOON, 3));

    const specs = challengeEndReminders(aState({ challenges: [ending(lastDay)] }), ES);

    expect(ids(specs)).toEqual([`challenge-end-challenge-1-${lastDay}`]);
    expect(specs[0]?.at).toBe(dailyAt('challengeEnd', 4));
    expect(specs[0]?.body).toBe('Cumpliste 2 de 3 semanas.');
  });

  it('goes through the quiet hours and the daily budget like every other daily notice', () => {
    const lastDay = dayKeyOf(dayStartShifted(NOON, 3));
    const quiet = aState({ challenges: [ending(lastDay)], prefs: { ...ALL_ON, reminderMinutes: 23 * 60 } });

    expect(plannedNotifications(quiet, ES).some((s) => s.kind === 'challengeEnd')).toBe(false);

    // Planned ahead it shares tomorrow with the streak notice, and the two fill the
    // day's budget between them.
    const planned = plannedNotifications(aState({ challenges: [ending(TODAY_KEY)] }), ES);
    const tomorrow = planned.filter((spec) => spec.trigger === 'date' && dayKeyOf(spec.at) === TOMORROW_KEY);

    expect(tomorrow.map((s) => s.kind).sort()).toEqual(['challengeEnd', 'streakRisk']);
    expect(tomorrow).toHaveLength(DAILY_BUDGET);
  });

  it('is gone once its hour has passed, and says nothing for a challenge still running', () => {
    const yesterdayKey = dayKeyOf(dayStartShifted(NOON, -1));

    expect(ids(challengeEndReminders(aState({ challenges: [ending(yesterdayKey)] }), ES))).toEqual([
      `challenge-end-challenge-1-${yesterdayKey}`,
    ]);
    expect(challengeEndReminders(aState({ now: EVENING, challenges: [ending(yesterdayKey)] }), ES)).toEqual([]);
    expect(challengeEndReminders(aState({ challenges: [{ ...ending(TODAY_KEY), endsOn: null }] }), ES)).toEqual([]);
  });
});

describe('reactivationReminders', () => {
  const openedKey = dayKeyOf(NOON);

  it('plans one notice 3 and 7 days after the last open, at the reminder hour', () => {
    const specs = reactivationReminders(aState({ lastOpenedAt: NOON }), ES);

    expect(ids(specs)).toEqual([`reactivation-3-${openedKey}`, `reactivation-7-${openedKey}`]);
    expect(specs.map((s) => s.at)).toEqual([dailyAt('reactivation', 3), dailyAt('reactivation', 7)]);
    expect(specs.map((s) => s.title)).toEqual(['Llevas 3 días sin enfocar', 'Llevas 7 días sin enfocar']);
    expect(specs.every((s) => s.kind === 'reactivation' && !s.sound)).toBe(true);
  });

  it('drops the ones already behind now', () => {
    const fiveDaysLater = dayStartShifted(NOON, 5) + 12 * HOUR;

    const specs = reactivationReminders(aState({ lastOpenedAt: NOON, now: fiveDaysLater }), ES);

    expect(ids(specs)).toEqual([`reactivation-7-${openedKey}`]);
  });

  it('says what the app knows: circle first, then the streak that stopped, else the plain line', () => {
    const plain = reactivationReminders(aState({ lastOpenedAt: NOON, streak: aStreak({ days: 1 }) }), ES);
    const withStreak = reactivationReminders(aState({ lastOpenedAt: NOON, streak: aStreak({ days: 12 }) }), ES);
    const withCircle = reactivationReminders(aState({ lastOpenedAt: NOON, streak: aStreak({ days: 12 }), hasCircle: true }), ES);

    expect(plain[0]?.body).toBe('Una sesión corta cuenta.');
    expect(withStreak[0]?.body).toBe('Tu racha se detuvo en 12. Puedes empezar otra hoy.');
    expect(withCircle[0]?.body).toBe('Tu círculo sigue ahí.');
    expect(reactivationReminders(aState({ lastOpenedAt: NOON, hasCircle: true }), EN)[0]?.body).toBe('Your circle is still there.');
    expect(reactivationReminders(aState({ lastOpenedAt: NOON, streak: aStreak({ days: 0 }) }), EN)[0]?.body).toBe('A short session counts.');
    expect(reactivationReminders(aState({ lastOpenedAt: NOON }), EN)[0]?.title).toBe('It has been 3 days without focus');
  });

  it('says nothing before the first open, or with the preference off', () => {
    expect(reactivationReminders(aState({ lastOpenedAt: null }), ES)).toEqual([]);
    expect(reactivationReminders(aState({ lastOpenedAt: NOON, prefs: { ...ALL_ON, reactivation: false } }), ES)).toEqual([]);
  });
});

describe('the daily stagger (ADR-0040)', () => {
  const aChallenge = (overrides: Partial<ChallengeReminder> = {}): ChallengeReminder => ({
    id: 'challenge-1',
    name: 'Leer',
    needed: 3,
    daysLeft: 3,
    atRisk: true,
    markedToday: false,
    endsOn: null,
    ...overrides,
  });

  it('gives each daily class a fixed offset, three minutes apart, in the priority order', () => {
    const offsets = (['streakRisk', 'challengeRisk', 'challengeEnd', 'noFocus', 'reactivation'] as const).map(
      dailyOffsetMinutes,
    );

    expect(DAILY_STAGGER_MINUTES).toBe(3);
    expect(offsets).toEqual([0, 3, 6, 9, 12]);
  });

  it('leaves the notices that are not part of the daily batch where they are', () => {
    const others = (['sessionEnd', 'breakEnd', 'schedule', 'weeklyClose'] as const).map(dailyOffsetMinutes);

    expect(others).toEqual([0, 0, 0, 0]);
    // The Sunday close keeps its own hour, on the hour.
    expect(weeklyCloseReminder(ES).minute).toBe(0);
    // And a routine keeps the minute the user set for it.
    expect(scheduleReminders(aSchedule(), 'Trabajo profundo', ES)[0]?.minute).toBe(30);
  });

  it('lands the two notices a day may hold at two instants, best one first', () => {
    // A streak about to break and a challenge slipping away, the same evening.
    const state = aState({ streak: aStreak({ days: 12, todayCounts: false }), challenges: [aChallenge()] });

    const today = plannedNotifications(state, ES).filter(
      (spec): spec is DateSpec => spec.trigger === 'date' && dayKeyOf(spec.at) === TODAY_KEY,
    );

    expect(today.map((s) => s.kind)).toEqual(['streakRisk', 'challengeRisk']);
    expect(today.map((s) => s.at)).toEqual([TODAY_AT, TODAY_AT + DAILY_STAGGER_MINUTES * MINUTE]);
    expect(new Set(today.map((s) => s.at)).size).toBe(today.length);
  });

  it('is the same offset on every run: fixed, never random', () => {
    const state = aState({ streak: aStreak({ days: 12, todayCounts: false }), challenges: [aChallenge()] });

    const runs = [1, 2, 3].map(() => plannedNotifications(state, ES).map((spec) => `${spec.id}@${spec.trigger === 'date' ? spec.at : spec.minute}`));

    expect(runs[1]).toEqual(runs[0]);
    expect(runs[2]).toEqual(runs[0]);
  });

  it('keeps every offset inside the evening at the last hour the picker offers', () => {
    const lastHour = 21 * 60;
    const state = aState({
      prefs: { ...ALL_ON, reminderMinutes: lastHour },
      streak: aStreak({ days: 12, todayCounts: false }),
      challenges: [aChallenge(), aChallenge({ id: 'ending', endsOn: { dayKey: TODAY_KEY, met: 2, total: 3 } })],
      lastOpenedAt: NOON,
    });

    const daily = plannedNotifications(state, ES).filter(
      (spec): spec is DateSpec => spec.trigger === 'date',
    );
    const minutes = daily.map((spec) => new Date(spec.at).getHours() * 60 + new Date(spec.at).getMinutes());

    // Nothing was dropped by quiet hours, and nothing reaches 22:00: 21:12 is the latest.
    expect(daily.length).toBeGreaterThan(0);
    expect(Math.max(...minutes)).toBe(lastHour + dailyOffsetMinutes('reactivation'));
    expect(minutes.every((minute) => !inQuietHours(minute))).toBe(true);
    expect(Math.max(...minutes)).toBeLessThan(QUIET_START_MINUTES);
  });

  it('does not spend the budget: still two a day, and still the best two', () => {
    const state = aState({
      streak: aStreak({ days: 12, todayCounts: false }),
      challenges: [aChallenge(), aChallenge({ id: 'ending', endsOn: { dayKey: TODAY_KEY, met: 2, total: 3 } })],
      lastOpenedAt: dayStartShifted(NOON, -3) + 12 * HOUR,
    });

    const perDay = new Map<string, string[]>();
    for (const spec of plannedNotifications(state, ES)) {
      if (spec.trigger === 'date') {
        const key = dayKeyOf(spec.at);
        perDay.set(key, [...(perDay.get(key) ?? []), spec.kind]);
      }
    }

    expect(Math.max(...[...perDay.values()].map((kinds) => kinds.length))).toBe(DAILY_BUDGET);
    expect(perDay.get(TODAY_KEY)).toEqual(['streakRisk', 'challengeRisk']);
  });
});

describe('quiet hours', () => {
  it('runs from 22:00 up to 8:00, wrapping midnight', () => {
    expect(inQuietHours(22 * 60)).toBe(true);
    expect(inQuietHours(23 * 60 + 59)).toBe(true);
    expect(inQuietHours(0)).toBe(true);
    expect(inQuietHours(7 * 60 + 59)).toBe(true);
    expect(inQuietHours(8 * 60)).toBe(false);
    expect(inQuietHours(12 * 60)).toBe(false);
    expect(inQuietHours(21 * 60 + 59)).toBe(false);
  });

  it('drops the date specs whose local minute falls inside', () => {
    const at = (minutes: number): DateSpec => ({
      id: `x-${minutes}`,
      kind: 'noFocus',
      trigger: 'date',
      at: atMinuteOfDay(NOON, minutes),
      title: '',
      body: '',
      sound: false,
    });

    const kept = withoutQuietHours([at(7 * 60), at(8 * 60), at(20 * 60), at(22 * 60), at(23 * 60 + 30)]);

    expect(ids(kept)).toEqual(['x-480', 'x-1200']);
  });
});

describe('applyDailyBudget', () => {
  const daily = (kind: DateSpec['kind'], at: number, id = `${kind}-${at}`): DateSpec => ({
    id,
    kind,
    trigger: 'date',
    at,
    title: '',
    body: '',
    sound: false,
  });

  it('keeps at most two per local day, streak first, then no focus, then reactivation', () => {
    const specs = [daily('reactivation', TODAY_AT), daily('noFocus', TODAY_AT), daily('streakRisk', TODAY_AT)];

    const kept = applyDailyBudget(specs);

    expect(DAILY_BUDGET).toBe(2);
    expect(kept.map((s) => s.kind)).toEqual(['noFocus', 'streakRisk']);
  });

  it('drops the challenge notice when the streak and the use notice already filled the day', () => {
    const specs = [
      daily('reactivation', TODAY_AT),
      daily('challengeEnd', TODAY_AT),
      daily('challengeRisk', TODAY_AT),
      daily('streakRisk', TODAY_AT),
    ];

    const kept = applyDailyBudget(specs);

    // A streak about to break beats a challenge, and a challenge beats anything about use.
    expect(kept.map((s) => s.kind)).toEqual(['challengeRisk', 'streakRisk']);
  });

  it('counts each day on its own and leaves the other kinds alone', () => {
    const specs = [
      weeklyCloseReminder(ES),
      daily('reactivation', TODAY_AT),
      daily('noFocus', TODAY_AT),
      daily('streakRisk', TODAY_AT),
      daily('reactivation', TOMORROW_AT),
      daily('streakRisk', TOMORROW_AT),
    ];

    const kept = applyDailyBudget(specs);

    expect(ids(kept)).toEqual(['weekly-close', `noFocus-${TODAY_AT}`, `streakRisk-${TODAY_AT}`, `reactivation-${TOMORROW_AT}`, `streakRisk-${TOMORROW_AT}`]);
  });

  it('is never exceeded by the plan itself: streak and no focus are exclusive, reactivation days differ', () => {
    const state = aState({ streak: aStreak({ days: 5, todayCounts: false }), lastOpenedAt: dayStartShifted(NOON, -3) + 12 * HOUR });

    const specs = plannedNotifications(state, ES);
    const perDay = new Map<string, number>();
    for (const spec of specs) {
      if (spec.trigger === 'date') {
        const key = dayKeyOf(spec.at);
        perDay.set(key, (perDay.get(key) ?? 0) + 1);
      }
    }

    expect(specs.some((s) => s.kind === 'reactivation')).toBe(true);
    expect(specs.some((s) => s.kind === 'streakRisk')).toBe(true);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(DAILY_BUDGET);
  });
});
