import { describe, expect, it } from 'vitest';

import type { NotificationPrefs, Schedule } from '../data/types';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { aRunningSession, T0 } from './fixtures';
import {
  EXPO_SATURDAY,
  EXPO_SUNDAY,
  expoWeekday,
  plannedNotifications,
  scheduleReminders,
  sessionEndReminder,
  weeklyCloseReminder,
  type ReminderState,
} from './reminders';
import { HOUR, MINUTE } from './time';

const ES = es.notifications;
const EN = en.notifications;

const ALL_ON: NotificationPrefs = { coaching: true, updates: true, sessionEnd: true, weeklyClose: true };
const ALL_OFF: NotificationPrefs = { coaching: false, updates: false, sessionEnd: false, weeklyClose: false };

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
    ...overrides,
  };
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

    expect(spec.trigger).toBe('date');
    expect(spec.at).toBe(T0 + 50 * MINUTE);
    expect(spec.id).toBe('session-end-session-1');
  });

  it('spells the planned duration and makes a sound', () => {
    const spec = sessionEndReminder(aRunningSession({ plannedMs: HOUR + 15 * MINUTE }), ES);

    expect(spec.title).toBe('Terminó tu sesión');
    expect(spec.body).toBe('1h 15m de foco. Vuelve a Vesper para cerrarla.');
    expect(spec.sound).toBe(true);
  });

  it('speaks English with the English slice, same id and instant', () => {
    const session = aRunningSession({ plannedMs: HOUR + 15 * MINUTE });

    const spec = sessionEndReminder(session, EN);

    expect(spec.id).toBe(sessionEndReminder(session, ES).id);
    expect(spec.at).toBe(sessionEndReminder(session, ES).at);
    expect(spec.title).toBe('Your session ended');
    expect(spec.body).toBe('1h 15m of focus. Come back to Vesper to close it.');
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
    expect(spec?.body).toBe('Modo Sin redes. Toca para enfocar.');
    expect(spec?.sound).toBe(false);
  });

  it('names the schedule and the mode in English', () => {
    const [spec] = scheduleReminders(aSchedule({ days: [false, false, false, false, false, false, true] }), 'No social', EN);

    expect(spec?.id).toBe('schedule-sched-1-1');
    expect(spec?.title).toBe('Trabajo starts');
    expect(spec?.body).toBe('No social mode. Tap to focus.');
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

    expect(spec?.body).toBe('Modo Trabajo profundo. Toca para enfocar.');
  });

  it('carries the words of the slice it is given: a language change is a change of plan', () => {
    const state = aState({ schedules: [aSchedule({ days: [true, false, false, false, false, false, false] })], prefs: { ...ALL_OFF, coaching: true } });

    const [spanish] = plannedNotifications(state, ES);
    const [english] = plannedNotifications(state, EN);

    expect(english?.id).toBe(spanish?.id);
    expect(english?.body).toBe('Trabajo profundo mode. Tap to focus.');
    expect(english?.body).not.toBe(spanish?.body);
  });

  it('is the full set: session, schedules and weekly close together, with unique ids', () => {
    const state = aState({ session: aRunningSession(), schedules: [aSchedule(), aSchedule({ id: 'sched-2', days: [false, false, false, false, false, true, true] })] });

    const specs = plannedNotifications(state, ES);

    expect(specs).toHaveLength(1 + 5 + 2 + 1);
    expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length);
  });
});
