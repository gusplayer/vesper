import { describe, expect, it } from 'vitest';

import type { PackageUsage } from '../../modules/vesper-blocking';
import { MINUTE } from '../domain/time';
import { foldUsage, initialOf } from './usageReading';

function row(packageName: string, ms: number, label = packageName, iconBase64: string | null = null): PackageUsage {
  return { packageName, label, iconBase64, ms };
}

describe('foldUsage', () => {
  it('sums the totals from the same rows the breakdown shows', () => {
    const today = [row('com.a', 10 * MINUTE, 'A'), row('com.b', 5 * MINUTE, 'B')];
    const week = [row('com.a', 60 * MINUTE, 'A'), row('com.b', 30 * MINUTE, 'B')];
    const reading = foldUsage(today, week);
    expect(reading.todayMs).toBe(15 * MINUTE);
    expect(reading.weekMs).toBe(90 * MINUTE);
    expect(reading.byApp.reduce((total, app) => total + app.ms, 0)).toBe(reading.todayMs);
  });

  it('orders the breakdown most used first and drops apps not used today', () => {
    const today = [row('com.a', 5 * MINUTE, 'A'), row('com.zero', 0, 'Zero'), row('com.b', 20 * MINUTE, 'B')];
    const reading = foldUsage(today, today);
    expect(reading.byApp.map((app) => app.id)).toEqual(['com.b', 'com.a']);
  });

  it('carries the real icon and derives the tile fallback from the label', () => {
    const reading = foldUsage([row('com.instagram.android', MINUTE, 'instagram', 'iVBOR')], []);
    const app = reading.byApp[0];
    expect(app?.icon).toBe('iVBOR');
    expect(app?.initial).toBe('I');
    expect(app?.color).toBeNull();
    expect(app?.name).toBe('instagram');
  });

  it('never lets the week fall under today, even with a short event history', () => {
    const reading = foldUsage([row('com.a', 30 * MINUTE)], [row('com.a', 10 * MINUTE)]);
    expect(reading.weekMs).toBe(30 * MINUTE);
  });

  it('ignores negative rows and answers empty for empty reads', () => {
    expect(foldUsage([row('com.a', -5)], [])).toEqual({ todayMs: 0, weekMs: 0, byApp: [] });
    expect(foldUsage([], [])).toEqual({ todayMs: 0, weekMs: 0, byApp: [] });
  });
});

describe('initialOf', () => {
  it('takes the first letter of the label, uppercased', () => {
    expect(initialOf('tiktok', 'com.zhiliaoapp.musically')).toBe('T');
    expect(initialOf('ñandú', 'x')).toBe('Ñ');
  });

  it('falls back to the package name when the label is blank', () => {
    expect(initialOf('   ', 'com.example')).toBe('C');
  });
});
