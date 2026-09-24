import type { VesperHealthNative } from '../../modules/vesper-health';
import { weekStart } from '../domain/day';
import { EMPTY_HEALTH_WEEK, type HealthWeek } from '../domain/healthMarks';
import { DAY } from '../domain/time';
import type { Millis } from '../domain/types';
import { getStrings } from '../i18n';
import { isAndroid, type CapabilityStatus } from './capabilities';
import { weekFromHealthConnect } from './healthConnectReading';

/**
 * Health on Android: Health Connect through the local Kotlin module in
 * modules/vesper-health, read-only, behind the same surface as health.ios.ts
 * (ADR-0043). The screens import `platform/health` and never learn which file answered.
 *
 * The honest differences: Health Connect may be missing or old on Android 9 to 13,
 * and Play fixes that (`detail.installable`, `openInstallPage`); and Health Connect
 * only holds what the user linked to it, so a connected screen offers a way into it
 * (`detail.healthConnect`, `openHealthApp`). Unlike HealthKit, it says what was
 * granted, so `requestAuthorization` resolving true means something was.
 *
 * Every native call is wrapped: a build without the module, or a stale one, must
 * degrade to "no disponible", never to a red screen.
 */

/** Undefined until the first load; null when the module cannot be used here. */
let cached: VesperHealthNative | null | undefined;

/** The module, or null. Never throws. */
function loadModule(): VesperHealthNative | null {
  if (cached !== undefined) {
    return cached;
  }
  if (!isAndroid) {
    cached = null;
    return cached;
  }
  try {
    // Lazy on purpose, like blocking.android.ts: a missing native module throws on load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: the module may be absent
    const { requireVesperHealth } = require('../../modules/vesper-health') as typeof import('../../modules/vesper-health');
    cached = requireVesperHealth();
  } catch {
    cached = null;
  }
  return cached;
}

function sdkStatus(kit: VesperHealthNative): ReturnType<VesperHealthNative['sdkStatus']> {
  try {
    return kit.sdkStatus();
  } catch {
    return 'unsupported';
  }
}

/** Synchronous, like every capability status. Asked fresh each time: Play may have just installed it. */
export function status(): CapabilityStatus {
  const reasons = getStrings().habits.healthStatus;
  const kit = loadModule();
  if (kit === null) {
    return { available: false, reason: reasons.notLinked };
  }
  switch (sdkStatus(kit)) {
    case 'available':
      return { available: true, reason: null, detail: { healthConnect: true } };
    case 'updateRequired':
      return { available: false, reason: reasons.installHealthConnect, detail: { installable: true } };
    case 'unsupported':
      return { available: false, reason: reasons.notAvailable };
  }
}

/** Kept for the same surface as iOS; Health Connect answers synchronously. */
export function checkAvailability(): Promise<boolean> {
  return Promise.resolve(status().available);
}

/**
 * Health Connect's sheet for steps, workouts and sleep. Resolves true when at least
 * one was granted: each read type fails on its own, so a partial grant still marks
 * the habits it covers.
 */
export async function requestAuthorization(): Promise<boolean> {
  const kit = loadModule();
  if (kit === null || !status().available) {
    return false;
  }
  try {
    const granted = await kit.requestPermissions();
    return granted.length > 0;
  } catch {
    return false;
  }
}

/**
 * Workouts, steps and sleep from the start of the week to `now`. Sleep is read from a
 * day earlier so Sunday night, which ends on Monday morning, is not lost; the domain
 * keeps only the nights that end inside the week.
 */
export async function readWeek(now: Millis): Promise<HealthWeek> {
  const kit = loadModule();
  if (kit === null || !status().available) {
    return EMPTY_HEALTH_WEEK;
  }
  const from = weekStart(now);
  try {
    const native = await kit.readWeek(from, from - DAY, now);
    return weekFromHealthConnect(native);
  } catch {
    return EMPTY_HEALTH_WEEK;
  }
}

/** Play's page for Health Connect, for the Android 9 to 13 phone that lacks it. */
export function openInstallPage(): boolean {
  const kit = loadModule();
  if (kit === null) {
    return false;
  }
  try {
    return kit.openInstallPage();
  } catch {
    return false;
  }
}

/** Health Connect's own screen, where the user links Samsung Health, Fit or a watch. */
export function openHealthApp(): boolean {
  const kit = loadModule();
  if (kit === null) {
    return false;
  }
  try {
    return kit.openHealthConnect();
  } catch {
    return false;
  }
}
