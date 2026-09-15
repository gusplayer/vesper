import { describe, expect, it } from 'vitest';

import { packageNamesFromToken, tokenFromPackageNames } from './packageSelection';

describe('packageNamesFromToken', () => {
  it('reads a JSON array of package names', () => {
    expect(packageNamesFromToken('["com.a","com.b"]')).toEqual(['com.a', 'com.b']);
  });

  it('is empty for null, blank and malformed tokens', () => {
    expect(packageNamesFromToken(null)).toEqual([]);
    expect(packageNamesFromToken('')).toEqual([]);
    expect(packageNamesFromToken('   ')).toEqual([]);
    expect(packageNamesFromToken('not json')).toEqual([]);
    expect(packageNamesFromToken('ZmFrZS1zZWxlY3Rpb24=')).toEqual([]);
  });

  it('is empty for JSON that is not an array of strings', () => {
    expect(packageNamesFromToken('{"a":1}')).toEqual([]);
    expect(packageNamesFromToken('[1, null, ""]')).toEqual([]);
  });

  it('drops duplicates and blanks but keeps order', () => {
    expect(packageNamesFromToken('["com.b","com.a"," ","com.b"]')).toEqual(['com.b', 'com.a']);
  });
});

describe('tokenFromPackageNames', () => {
  it('round-trips through packageNamesFromToken', () => {
    const token = tokenFromPackageNames(['com.a', 'com.b']);

    expect(token).toBe('["com.a","com.b"]');
    expect(packageNamesFromToken(token)).toEqual(['com.a', 'com.b']);
  });

  it('is null when nothing remains', () => {
    expect(tokenFromPackageNames([])).toBeNull();
    expect(tokenFromPackageNames(['', ' '])).toBeNull();
  });

  it('deduplicates', () => {
    expect(tokenFromPackageNames(['com.a', 'com.a'])).toBe('["com.a"]');
  });
});
