import type { PackageUsage } from '../../modules/vesper-blocking';
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
 * front. The count is the union of the modes' real selections; with none there is
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

/**
 * Foreground time of each package between two instants, most used first. Empty when
 * the phone cannot answer; never throws. Icons are requested: the breakdown draws them.
 */
export async function readUsage(fromMs: number, toMs: number, packageNames: readonly string[]): Promise<PackageUsage[]> {
  const mod = nativeModule();
  if (mod === null || packageNames.length === 0 || toMs <= fromMs) {
    return [];
  }
  try {
    return await mod.queryUsage(fromMs, toMs, [...packageNames], true);
  } catch (error) {
    if (__DEV__) {
      console.warn('[usage] queryUsage failed:', error instanceof Error ? error.message : String(error));
    }
    return [];
  }
}
