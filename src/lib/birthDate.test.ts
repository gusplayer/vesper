import { describe, expect, it } from 'vitest';

import { DAY } from '../domain/time';
import { formatBirthDate, parseBirthDate } from './birthDate';

// 2026-09-14 is a Monday. `now` is that day unless a test says otherwise.
const TODAY_START = new Date(2026, 8, 14).getTime();
const TODAY_END = new Date(2026, 8, 15).getTime() - 1;

describe('parseBirthDate', () => {
  it('parses a padded date to local midnight', () => {
    expect(parseBirthDate('1990-02-03', TODAY_END)).toBe(new Date(1990, 1, 3).getTime());
  });

  it('trims surrounding whitespace', () => {
    expect(parseBirthDate('  1990-02-03 \n', TODAY_END)).toBe(new Date(1990, 1, 3).getTime());
  });

  it('rejects unpadded and foreign formats', () => {
    expect(parseBirthDate('2026-2-3', TODAY_END)).toBeNull();
    expect(parseBirthDate('03/02/1990', TODAY_END)).toBeNull();
  });

  it('rejects impossible dates field by field instead of letting Date roll them over', () => {
    expect(parseBirthDate('1990-13-01', TODAY_END)).toBeNull();
    expect(parseBirthDate('1990-02-30', TODAY_END)).toBeNull();
    expect(parseBirthDate('2023-02-29', TODAY_END)).toBeNull();
  });

  it('accepts a real leap day', () => {
    expect(parseBirthDate('2024-02-29', TODAY_END)).toBe(new Date(2024, 1, 29).getTime());
  });

  it('rejects tomorrow', () => {
    expect(parseBirthDate('2026-09-15', TODAY_START + DAY - 1)).toBeNull();
  });

  it('accepts today', () => {
    expect(parseBirthDate('2026-09-14', TODAY_END)).toBe(TODAY_START);
  });
});

describe('formatBirthDate', () => {
  it('round-trips with parseBirthDate', () => {
    const parsed = parseBirthDate('1990-02-03', TODAY_END);
    expect(parsed).not.toBeNull();
    expect(formatBirthDate(parsed ?? 0)).toBe('1990-02-03');
    expect(parseBirthDate(formatBirthDate(parsed ?? 0), TODAY_END)).toBe(parsed);
  });
});
