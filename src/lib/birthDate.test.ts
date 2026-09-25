import { describe, expect, it } from 'vitest';

import { DAY } from '../domain/time';
import { birthDateText, formatBirthDate, parseBirthDate, typeBirthDate } from './birthDate';

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

describe('birthDateText', () => {
  const birthDate = new Date(1990, 1, 3).getTime();

  it('reads the date in the language of the tag', () => {
    const spanish = birthDateText(birthDate, 'es-CO');
    const english = birthDateText(birthDate, 'en-US');

    expect(spanish).toMatch(/feb/);
    expect(spanish).toContain('1990');
    expect(english).toBe('Feb 3, 1990');
    expect(spanish).not.toBe(english);
  });
});

describe('typeBirthDate', () => {
  it('puts the hyphens in as the digits arrive', () => {
    expect(typeBirthDate('1')).toBe('1');
    expect(typeBirthDate('1992')).toBe('1992');
    expect(typeBirthDate('19920')).toBe('1992-0');
    expect(typeBirthDate('199204')).toBe('1992-04');
    expect(typeBirthDate('1992041')).toBe('1992-04-1');
    expect(typeBirthDate('19920414')).toBe('1992-04-14');
  });

  it('is stable on what it produced, so each keystroke only adds or removes a digit', () => {
    expect(typeBirthDate('1992-04-14')).toBe('1992-04-14');
    expect(typeBirthDate('1992-04-1')).toBe('1992-04-1');
    // Backspace over '1992-04-1' leaves '1992-04-': the dangling hyphen goes too.
    expect(typeBirthDate('1992-04-')).toBe('1992-04');
  });

  it('keeps only digits, at most eight, from anything pasted', () => {
    expect(typeBirthDate('1992/04/14')).toBe('1992-04-14');
    expect(typeBirthDate(' 14.04.1992 ')).toBe('1404-19-92');
    expect(typeBirthDate('199204149999')).toBe('1992-04-14');
  });

  it('is empty for an empty field, which is how Vida is turned off', () => {
    expect(typeBirthDate('')).toBe('');
  });

  it('produces what parseBirthDate accepts once the date is whole', () => {
    expect(parseBirthDate(typeBirthDate('19900203'), TODAY_END)).toBe(new Date(1990, 1, 3).getTime());
  });
});
