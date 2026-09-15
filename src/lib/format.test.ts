import { describe, expect, it } from 'vitest';

import { aHabit } from '../domain/fixtures';
import { HOUR, MINUTE } from '../domain/time';
import type { WeekProgress } from '../domain/week';
import {
  dayText,
  durationText,
  focusOfTargetText,
  habitProgressText,
  minutesText,
  timerText,
  weekClosingText,
  weekSummaryText,
} from './format';

function aWeek(overrides: Partial<WeekProgress> = {}): WeekProgress {
  return { focusMs: 4 * HOUR, targetMs: 10 * HOUR, met: false, daysLeft: 5, ...overrides };
}

describe('timerText', () => {
  it('is mm:ss under an hour', () => {
    expect(timerText(24 * MINUTE + 13_000)).toBe('24:13');
    expect(timerText(9_000)).toBe('0:09');
  });

  it('grows to h:mm:ss past an hour', () => {
    expect(timerText(HOUR + 2 * MINUTE + 3_000)).toBe('1:02:03');
  });

  it('floors instead of rounding, so it never shows a second that has not passed', () => {
    expect(timerText(1_999)).toBe('0:01');
  });

  it('clamps negatives to zero', () => {
    expect(timerText(-5_000)).toBe('0:00');
  });

  it('reads the boundaries the session clock passes through', () => {
    expect(timerText(0)).toBe('0:00');
    expect(timerText(MINUTE)).toBe('1:00');
    expect(timerText(HOUR - 1)).toBe('59:59');
    expect(timerText(HOUR)).toBe('1:00:00');
    expect(timerText(10 * HOUR)).toBe('10:00:00');
  });
});

describe('durationText', () => {
  it('drops the hour when there is none and the minutes when there are none', () => {
    expect(durationText(45 * MINUTE)).toBe('45m');
    expect(durationText(2 * HOUR)).toBe('2h');
    expect(durationText(2 * HOUR + 15 * MINUTE)).toBe('2h 15m');
  });

  it('shows 0m rather than an empty string', () => {
    expect(durationText(0)).toBe('0m');
  });

  it("reads '<1m' under a minute, because a 55 second session is not nothing", () => {
    expect(durationText(55_000)).toBe('<1m');
    expect(durationText(1)).toBe('<1m');
    expect(durationText(59_999)).toBe('<1m');
    expect(durationText(MINUTE)).toBe('1m');
  });

  it('clamps negatives to 0m', () => {
    expect(durationText(-MINUTE)).toBe('0m');
  });

  it('floors whole minutes and never rounds up into the next hour', () => {
    expect(durationText(HOUR - 1)).toBe('59m');
    expect(durationText(HOUR + 59_999)).toBe('1h');
  });

  it('keeps counting hours past a day', () => {
    expect(durationText(25 * HOUR)).toBe('25h');
  });
});

describe('minutesText', () => {
  it('rounds to whole minutes', () => {
    expect(minutesText(25 * MINUTE)).toBe('25');
    expect(minutesText(90 * MINUTE)).toBe('90');
  });

  it('rounds half up', () => {
    expect(minutesText(90_000)).toBe('2');
    expect(minutesText(29_999)).toBe('0');
  });
});

describe('dayText', () => {
  it("reads 'domingo, 23 de agosto' in lowercase", () => {
    expect(dayText(new Date(2026, 7, 23, 12).getTime())).toBe('domingo, 23 de agosto');
  });

  it('does not zero-pad the first of the month', () => {
    expect(dayText(new Date(2026, 8, 1, 12).getTime())).toBe('martes, 1 de septiembre');
  });
});

describe('focusOfTargetText', () => {
  it('reads focus of target when there is a goal', () => {
    expect(focusOfTargetText(aWeek())).toBe('4h de 10h');
  });

  it('reads only the focus when there is none', () => {
    expect(focusOfTargetText(aWeek({ targetMs: null }))).toBe('4h');
  });
});

describe('weekSummaryText', () => {
  it('invites the closing on Sunday whatever the numbers say', () => {
    expect(weekSummaryText(aWeek({ met: true }), true)).toBe('cerrar la semana');
  });

  it('reports the total without measuring it when there is no goal', () => {
    expect(weekSummaryText(aWeek({ targetMs: null }), false)).toBe('4h esta semana');
  });

  it('says the goal is done once it is met', () => {
    expect(weekSummaryText(aWeek({ focusMs: 10 * HOUR, met: true }), false)).toBe(
      'meta hecha · 10h',
    );
  });

  it('counts down the days while in progress', () => {
    expect(weekSummaryText(aWeek(), false)).toBe('4h de 10h · 5d');
  });
});

describe('weekClosingText', () => {
  it('asks for a goal when there was none', () => {
    expect(weekClosingText(aWeek({ targetMs: null }))).toBe(
      'no había meta esta semana. pon una para la que empieza mañana',
    );
  });

  it('celebrates a met goal', () => {
    expect(weekClosingText(aWeek({ met: true }))).toBe(
      'meta cumplida. la semana que empieza mañana arranca en cero',
    );
  });

  it('promises a clean start when the goal was missed', () => {
    expect(weekClosingText(aWeek())).toBe(
      'la semana que empieza mañana arranca en cero. sin rachas que perder',
    );
  });
});

describe('habitProgressText', () => {
  it("says 'hecho' once the target is met", () => {
    expect(
      habitProgressText({ habit: aHabit(), markedDays: 4, met: true, markedToday: true }),
    ).toBe('hecho');
  });

  it('counts marked days against the target otherwise', () => {
    expect(
      habitProgressText({ habit: aHabit(), markedDays: 2, met: false, markedToday: false }),
    ).toBe('2 de 4');
  });
});
