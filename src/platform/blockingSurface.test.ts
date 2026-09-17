import { describe, expect, it } from 'vitest';

import type * as Android from './blocking.android';
import type * as Ios from './blocking.ios';

/**
 * The two blocking backends must export the same surface (ADR-0017, ADR-0019): the
 * stores and screens import `../platform/blocking` and tsc only ever resolves it to
 * the iOS file (moduleSuffixes puts `.ios` first), so a name or a signature that only
 * Android has, or lacks, would go unnoticed until the app ran on a phone. The checks
 * below are types: a drift is a tsc error on this file, and vitest only records that
 * the file compiled. `nativeModule` is the one export whose type differs by design:
 * it hands the picker the platform's own native object.
 */

type IosSurface = Omit<typeof Ios, 'nativeModule'>;
type AndroidSurface = Omit<typeof Android, 'nativeModule'>;

type MissingOnAndroid = Exclude<keyof IosSurface, keyof AndroidSurface>;
type MissingOnIos = Exclude<keyof AndroidSurface, keyof IosSurface>;

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Mismatched = {
  [K in keyof IosSurface]: K extends keyof AndroidSurface ? (Same<IosSurface[K], AndroidSurface[K]> extends true ? never : K) : K;
}[keyof IosSurface];

// Each of these is `never` when the surfaces agree; anything else fails to compile.
const missingOnAndroid: [MissingOnAndroid] extends [never] ? true : MissingOnAndroid = true;
const missingOnIos: [MissingOnIos] extends [never] ? true : MissingOnIos = true;
const mismatched: [Mismatched] extends [never] ? true : Mismatched = true;

describe('blocking surface', () => {
  it('is the same on iOS and Android', () => {
    expect(missingOnAndroid).toBe(true);
    expect(missingOnIos).toBe(true);
    expect(mismatched).toBe(true);
  });
});
