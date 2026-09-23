import type { PackageUsage } from '../../modules/vesper-blocking';
import { SECOND } from '../domain/time';
import { getStrings } from '../i18n';
import { isAndroid, type CapabilityStatus } from './capabilities';

/**
 * Per-app usage, read from the phone on demand and never stored (ADR-0029). Android
 * answers through the Kotlin module with the usage-access toggle the blocking already
 * asks for. iOS has no per-app figure outside DeviceActivityReport (ADR-0004), so
 * `status()` says so and the activity tab keeps the demo floor.
 *
 * Lives beside blocking.ts rather than inside it, like androidApps.ts: the two
 * blocking files must export the same names and iOS has nothing to export here.
 * Every native call is wrapped: a missing module degrades to "no disponible".
 */

type Module = import('../../modules/vesper-blocking').VesperBlockingNative;

/** Undefined until the first load; null when the module cannot be used here. */
let cached: Module | null | undefined;

/**
 * A native promise that never settles must not hold the reading hostage for the rest
 * of the process, so a read that takes this long counts as a failure (rule 8).
 */
export const READ_TIMEOUT_MS = 10 * SECOND;

function nativeModule(): Module | null {
  if (cached !== undefined) {
    return cached;
  }
  if (!isAndroid) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: the module may be absent
    const { requireVesperBlocking } = require('../../modules/vesper-blocking') as typeof import('../../modules/vesper-blocking');
    cached = requireVesperBlocking();
  } catch (error) {
    if (__DEV__) {
      console.warn('[usage] module missing:', error instanceof Error ? error.message : String(error));
    }
    cached = null;
  }
  return cached;
}

/**
 * Whether the phone can say how long each of `packageCount` chosen apps was in
 * front. The count is the union of the selections the modes block; with none there is
 * nothing to measure and the reason says what to do.
 */
export function status(packageCount: number): CapabilityStatus {
  const reasons = getStrings().activity.today.usage;
  if (!isAndroid) {
    return { available: false, reason: reasons.ios };
  }
  const mod = nativeModule();
  if (mod === null) {
    return { available: false, reason: reasons.noModule };
  }
  let usageAccess = false;
  try {
    usageAccess = mod.getStatus().usageAccess;
  } catch {
    return { available: false, reason: reasons.noModule };
  }
  if (!usageAccess) {
    return { available: false, reason: reasons.noUsageAccess };
  }
  if (packageCount === 0) {
    return { available: false, reason: reasons.noApps };
  }
  return { available: true, reason: null };
}

/** Why the last read gave nothing, in the app's language. Never a zero passed off as read. */
export function readFailedReason(): string {
  return getStrings().activity.today.usage.readFailed;
}

/**
 * Foreground time of each package between two instants, most used first. **Null when
 * the phone could not answer**, so a failure is never stored as a verified zero
 * (rule 8): the caller falls back to the demo floor with a reason. Never throws.
 *
 * `withIcons` is true only for the read whose rows reach the breakdown; the weekly
 * read needs totals alone and a base64 PNG per app across the bridge is not free.
 */
export async function readUsage(
  fromMs: number,
  toMs: number,
  packageNames: readonly string[],
  withIcons: boolean,
): Promise<PackageUsage[] | null> {
  const mod = nativeModule();
  if (mod === null) {
    return null;
  }
  if (packageNames.length === 0 || toMs <= fromMs) {
    // Nothing was asked, so nothing failed: an empty window is an empty answer.
    return [];
  }
  try {
    const rows = await withTimeout(mod.queryUsage(fromMs, toMs, [...packageNames], withIcons));
    if (rows === null) {
      if (__DEV__) {
        console.warn(`[usage] queryUsage did not answer in ${READ_TIMEOUT_MS} ms`);
      }
      return null;
    }
    // UsageQuery.kt answers with one row per package asked, zeros included, so an
    // empty answer to a non-empty question can only mean the query itself failed.
    return rows.length === 0 ? null : rows;
  } catch (error) {
    if (__DEV__) {
      console.warn('[usage] queryUsage failed:', error instanceof Error ? error.message : String(error));
    }
    return null;
  }
}

/** The promise's value, or null when it has not settled in READ_TIMEOUT_MS. */
function withTimeout<T>(promise: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), READ_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}
