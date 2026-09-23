import { describe, expect, it } from 'vitest';

import { isFresh, measuredPackages, SYNC_INTERVAL_MS } from '../usageReading';

/**
 * What the usage sync decides before it touches the phone. The hook itself imports
 * React Native and the stores, which a test may not (vitest.config.ts), so its pure
 * parts live in platform/usageReading.ts and are covered here, next to the hook they
 * serve. The reading it folds is covered in usageReading.test.ts.
 */

function mode(behavior: 'block' | 'allow', packageNames: string[] | null) {
  return { behavior, selectionToken: packageNames === null ? null : JSON.stringify(packageNames) };
}

describe('measuredPackages', () => {
  it('measures the apps a mode blocks', () => {
    expect(measuredPackages([mode('block', ['com.instagram.android', 'com.zhiliaoapp.musically'])])).toEqual([
      'com.instagram.android',
      'com.zhiliaoapp.musically',
    ]);
  });

  it('never measures the apps an allow mode keeps alive', () => {
    // The token of an allow mode is Maps, Phone and Notes: what stays open during a
    // session, not what pulls. Counting it would file them as social use, project
    // them onto the life card and share them to the circle.
    const modes = [mode('allow', ['com.google.android.apps.maps', 'com.android.dialer'])];
    expect(measuredPackages(modes)).toEqual([]);
  });

  it('keeps the blocked apps of a mix and drops the allowed ones', () => {
    const modes = [
      mode('allow', ['com.google.android.apps.maps']),
      mode('block', ['com.instagram.android']),
      mode('block', null),
    ];
    expect(measuredPackages(modes)).toEqual(['com.instagram.android']);
  });

  it('deduplicates and sorts, so the same set is always the same key', () => {
    const a = measuredPackages([mode('block', ['com.b', 'com.a']), mode('block', ['com.a'])]);
    const b = measuredPackages([mode('block', ['com.a']), mode('block', ['com.a', 'com.b'])]);
    expect(a).toEqual(['com.a', 'com.b']);
    expect(a.join(',')).toBe(b.join(','));
  });

  it('answers empty for no modes and for malformed tokens', () => {
    expect(measuredPackages([])).toEqual([]);
    expect(measuredPackages([mode('block', null), { behavior: 'block', selectionToken: 'not json' }])).toEqual([]);
  });
});

describe('isFresh', () => {
  const now = 1_700_000_000_000;

  it('holds a reading of the same apps for the interval', () => {
    const memory = { lastKey: 'com.a', lastSyncAt: now };
    expect(isFresh(memory, 'com.a', now + SYNC_INTERVAL_MS - 1)).toBe(true);
    expect(isFresh(memory, 'com.a', now + SYNC_INTERVAL_MS)).toBe(false);
  });

  it('never holds a reading of other apps', () => {
    const memory = { lastKey: 'com.a', lastSyncAt: now };
    expect(isFresh(memory, 'com.a,com.b', now)).toBe(false);
    expect(isFresh(memory, '', now)).toBe(false);
  });

  it('is false until a read finished, so granting usage access is noticed at once', () => {
    // A status that says "not available" reads nothing and writes no memory: the next
    // foreground asks again instead of waiting out a cooldown it never earned.
    expect(isFresh({ lastKey: '', lastSyncAt: 0 }, 'com.a', now)).toBe(false);
    expect(isFresh({ lastKey: '', lastSyncAt: now }, '', now)).toBe(false);
  });
});
