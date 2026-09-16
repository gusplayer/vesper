import { describe, expect, it } from 'vitest';

import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { clockText, syncedText } from './format';

function at(hour: number, minute: number): number {
  return new Date(2026, 7, 19, hour, minute).getTime();
}

describe('clockText', () => {
  it('reads as a wall clock, minutes padded, hour not', () => {
    expect(clockText(at(9, 5))).toBe('9:05');
    expect(clockText(at(14, 30))).toBe('14:30');
    expect(clockText(at(0, 0))).toBe('0:00');
  });
});

describe('syncedText', () => {
  it('says when, or that it never happened', () => {
    expect(syncedText(at(14, 30), es.habits)).toBe('sincronizado 14:30');
    expect(syncedText(null, es.habits)).toBe('sin sincronizar');
  });

  it('says it in English with the English dictionary', () => {
    expect(syncedText(at(14, 30), en.habits)).toBe('synced 14:30');
    expect(syncedText(null, en.habits)).toBe('not synced');
  });
});
