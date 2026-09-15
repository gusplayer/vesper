import { describe, expect, it } from 'vitest';

import { dayKeyOf } from '../../domain/day';
import { DAY, HOUR } from '../../domain/time';
import { FULL_DAY_MS, recentDayCells } from './recentDays';

// 2026-09-16 is a Wednesday.
const NOW = new Date(2026, 8, 16, 12).getTime();

describe('recentDayCells', () => {
  it('ends on today and starts on the Monday three weeks back', () => {
    const cells = recentDayCells([], NOW, 4);
    expect(cells.length).toBe(3 * 7 + 3);
    expect(cells[cells.length - 1]?.key).toBe(dayKeyOf(NOW));
    expect(cells[cells.length - 1]?.today).toBe(true);
    expect(cells[0]?.key).toBe(dayKeyOf(NOW - 23 * DAY));
  });

  it('scales intensity to a full day and caps it', () => {
    const stats = [
      { dayKey: dayKeyOf(NOW), focusMs: FULL_DAY_MS / 2, sessions: 1, segments: [] },
      { dayKey: dayKeyOf(NOW - DAY), focusMs: 9 * HOUR, sessions: 3, segments: [] },
    ];
    const cells = recentDayCells(stats, NOW, 1);
    expect(cells[cells.length - 1]?.intensity).toBeCloseTo(0.5);
    expect(cells[cells.length - 2]?.intensity).toBe(1);
    expect(cells[0]?.intensity).toBe(0);
  });
});
