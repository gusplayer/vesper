import { describe, expect, it } from 'vitest';

import { digitsOnly, emptyToNull, parsePlannedMinutes } from './text';

describe('emptyToNull', () => {
  it('treats nothing and whitespace as no intention', () => {
    expect(emptyToNull('')).toBeNull();
    expect(emptyToNull('  ')).toBeNull();
  });

  it('trims what was written', () => {
    expect(emptyToNull(' x ')).toBe('x');
  });
});

describe('digitsOnly', () => {
  it('keeps only digits', () => {
    expect(digitsOnly('2a5')).toBe('25');
    expect(digitsOnly('abc')).toBe('');
    expect(digitsOnly(' 1,000 ')).toBe('1000');
  });
});

describe('parsePlannedMinutes', () => {
  it('parses whole minutes inside the allowed range', () => {
    expect(parsePlannedMinutes('25')).toBe(25);
    expect(parsePlannedMinutes('240')).toBe(240);
  });

  it('rejects zero and anything past the maximum', () => {
    expect(parsePlannedMinutes('0')).toBeNull();
    expect(parsePlannedMinutes('241')).toBeNull();
  });

  it('is null when nothing was typed', () => {
    expect(parsePlannedMinutes('')).toBeNull();
  });

  it('ignores the letters a pasted value drags along', () => {
    expect(parsePlannedMinutes('2a5')).toBe(25);
  });
});
