import { AppState, type AppStateStatus } from 'react-native';

import { blockPlan, isEmptyPlan, shieldCopy, type BlockPlan, type BlockRules, type BlockableMode, type ShieldCopy } from '../domain/blocking';
import { packageNamesFromToken } from '../domain/packageSelection';
import { getStrings } from '../i18n';
import type { NativeCopy, NativeStatus, VesperBlockingNative } from '../../modules/vesper-blocking';
import type { PausePlan, PlanTiming, ResumePlan, RoutineWindowSpec } from './blockingTypes';
import { isAndroid, type CapabilityStatus } from './capabilities';

/**
 * blocking on Android: the local Kotlin module in modules/vesper-blocking behind the
 * same surface as blocking.ios.ts (ADR-0017, ADR-0019). The stores and screens
 * import `../platform/blocking` and never learn which file answered.
 *
 * The honest differences: there is no opaque token, so `Mode.selectionToken` holds a
 * JSON array of package names; there is no system dialog, so `requestAuthorization()`
 * walks the user through two Settings pages and checks again when the app comes back;
 * and the rules (installs, purchases, adult content) have no Android counterpart yet.
 *
 * Routine windows (phase 2) are AlarmManager alarms armed by `scheduleWindow`: the
 * shield rises and falls through the OS with the app closed. Their arithmetic is
 * src/platform/routineWindows.ts, mirrored in Kotlin.
 *
 * A break (ADR-0023, phase 4) is the service's: `pausePlan` leaves it alive with the
 * notification counting the break down, and it resumes watching by itself; `resumePlan`
 * only brings it back early with the session's new end. The notification's words and
 * the shield's release line travel with every plan, so they follow the app language.
 *
 * Every native call is wrapped: a build without the module, or a stale one, must
 * degrade to "no disponible", never to a red screen.
 */

type Module = VesperBlockingNative;

/** Undefined until the first load; null when the module cannot be used here. */
let cached: Module | null | undefined;

/**
 * The copy the next applyPlan sends. Set by configureShield, like the iOS shield;
 * until then the nameless copy in the current language, resolved when first needed
 * so the strings store is never read at module load.
 */
let pendingCopy: ShieldCopy | null = null;

const NO_RULES: BlockRules = { blockInstalls: false, blockPurchases: false, blockMature: false };

/** How long to wait for the app to leave the foreground after opening Settings. */
const SETTINGS_LEAVE_TIMEOUT_MS = 1500;

const NO_STATUS: NativeStatus = { usageAccess: false, overlay: false, running: false, exactAlarm: false, notifications: false };

export type AuthorizationResult = 'approved' | 'denied' | 'unavailable';

export type SelectionSummary = {
  apps: number;
  categories: number;
  websites: number;
};

/** The module, or null. Never throws. */
export function nativeModule(): Module | null {
  if (cached !== undefined) {
    return cached;
  }
  if (!isAndroid) {
    cached = null;
    return cached;
  }
  try {
    const { requireVesperBlocking } = require('../../modules/vesper-blocking') as typeof import('../../modules/vesper-blocking');
    cached = requireVesperBlocking();
  } catch (error) {
    if (__DEV__) {
      console.warn('[blocking] module missing:', errorMessage(error));
    }
    cached = null;
  }
  return cached;
}

export function status(): CapabilityStatus {
  const mod = nativeModule();
  if (mod === null) {
    return unavailable(getStrings().modes.blocking.androidNoModule);
  }
  const native = nativeStatus(mod);
  if (!native.usageAccess) {
    return unavailable(getStrings().modes.blocking.androidNoUsageAccess);
  }
  if (!native.overlay) {
    return unavailable(getStrings().modes.blocking.androidNoOverlay);
  }
  return { available: true, reason: null };
}

/** True once both Settings toggles are on. There is no "not asked yet" on Android. */
export function isAuthorized(): boolean {
  return status().available;
}

/**
 * Opens the usage-access page, waits for the user to come back, checks; then the
 * overlay page the same way. 'approved' only when both hold, 'denied' when the user
 * came back without granting one, 'unavailable' without the module.
 */
export async function requestAuthorization(): Promise<AuthorizationResult> {
  const mod = nativeModule();
  if (mod === null) {
    return 'unavailable';
  }
  if (!nativeStatus(mod).usageAccess) {
    const opened = await safeAsync(() => mod.openUsageAccessSettings());
    if (!opened) {
      return 'unavailable';
    }
    await returnedToForeground();
    if (!nativeStatus(mod).usageAccess) {
      return 'denied';
    }
  }
  if (!nativeStatus(mod).overlay) {
    const opened = await safeAsync(() => mod.openOverlaySettings());
    if (!opened) {
      return 'unavailable';
    }
    await returnedToForeground();
    if (!nativeStatus(mod).overlay) {
      return 'denied';
    }
  }
  return 'approved';
}

/**
 * Exact alarms make a routine window open on the minute. Android 13+ turns the
 * toggle off by default; this opens its page, waits for the user to come back and
 * checks again. True when exact alarms are allowed (always, before Android 12).
 */
export async function requestExactAlarms(): Promise<boolean> {
  const mod = nativeModule();
  if (mod === null) {
    return false;
  }
  if (safe(() => mod.canScheduleExactAlarms()) === true) {
    return true;
  }
  const opened = await safeAsync(() => mod.openExactAlarmSettings());
  if (!opened) {
    return false;
  }
  await returnedToForeground();
  return safe(() => mod.canScheduleExactAlarms()) ?? false;
}

/**
 * The POST_NOTIFICATIONS dialog (Android 13+), so the session notification is seen.
 * The service runs without it; this is for the user to know a session is on. True
 * when notifications are enabled afterwards.
 */
export async function requestNotifications(): Promise<boolean> {
  const mod = nativeModule();
  if (mod === null) {
    return false;
  }
  try {
    return await mod.requestNotificationPermission();
  } catch (error) {
    if (__DEV__) {
      console.warn('[blocking]', errorMessage(error));
    }
    return false;
  }
}

/** The battery-optimisation list, for phones whose makers kill services. */
export function openBatterySettings(): void {
  const mod = nativeModule();
  if (mod === null) {
    return;
  }
  void safeAsync(() => mod.openBatterySettings());
}

/** How many apps a token holds. Android has no categories or websites. */
export function selectionSummary(token: string | null): SelectionSummary {
  return { apps: packageNamesFromToken(token).length, categories: 0, websites: 0 };
}

/** '3 apps', or 'Ninguna' when the token holds nothing. */
export function selectionSummaryText(token: string | null): string {
  const { apps } = selectionSummary(token);
  const t = getStrings().modes.blocking;
  return apps === 0 ? t.none : t.apps(apps);
}

/** Puts the shield up for a mode. See applyPlan. */
export function applyMode(mode: BlockableMode, rules: BlockRules = NO_RULES): void {
  applyPlan(blockPlan(mode, rules));
}

/**
 * Applies a plan from src/domain/blocking: starts the foreground service with the
 * package names and the shield copy. `endsAt` (epoch ms) makes the service stop
 * itself then, even with JS gone; without it the plan lasts until release(). The
 * rules do not travel: Android has no ManagedSettings, and nothing here pretends
 * otherwise.
 */
export function applyPlan(plan: BlockPlan, timing?: PlanTiming): void {
  const mod = nativeModule();
  const kind = plan.kind;
  if (mod === null || !status().available || isEmptyPlan(plan) || kind === 'none') {
    return;
  }
  const packageNames = packageNamesFromToken(plan.token);
  if (packageNames.length === 0) {
    return;
  }
  const copy = pendingCopy ?? shieldCopy('', getStrings().session.shield);
  void safeAsync(() =>
    mod.applyPlan({
      packageNames,
      mode: kind,
      ...(timing !== undefined && Number.isFinite(timing.endsAt)
        ? { endsAt: timing.endsAt, startedAt: timing.startedAt, open: timing.open }
        : {}),
      shieldTitle: copy.title,
      shieldSubtitle: copy.subtitle,
      // The Android button goes home, not back to Vesper, so its label says just that.
      shieldButton: getStrings().session.shield.home,
      ...nativeCopy(),
    }),
  );
}

/** Stops the service and takes the shield down. */
export function release(): void {
  const mod = nativeModule();
  if (mod === null) {
    return;
  }
  void safeAsync(() => mod.release());
}

/**
 * A break until `untilMs`: the shield comes down and the service stops watching, but
 * it stays alive with its notification counting the break down, and it resumes on
 * its own at `untilMs` even if the app has died meanwhile (ADR-0023, decision 5).
 * Without a plan applied there is nothing to pause, and the module says so quietly.
 */
export const pausePlan: PausePlan = (untilMs) => {
  const mod = nativeModule();
  if (mod === null || !Number.isFinite(untilMs)) {
    return;
  }
  void safeAsync(() => mod.pausePlan(untilMs));
};

/**
 * Ends the break early, or on time from JS's side, with the session's new end. When
 * the service has no plan any more (it was killed and its plan cleared, or the app
 * was reinstalled) the plan is applied from scratch instead, so the shield is back
 * either way.
 */
export const resumePlan: ResumePlan = (plan, timing) => {
  const mod = nativeModule();
  if (mod === null) {
    return;
  }
  const end = timing !== undefined && Number.isFinite(timing.endsAt) ? timing.endsAt : null;
  void safeAsync(() => mod.resumePlan(end)).then((resumed) => {
    if (!resumed) {
      applyPlan(plan, timing);
    }
  });
};

/** The notification's words and the shield's release line, in the current language. */
function nativeCopy(): NativeCopy {
  const t = getStrings().session.shield;
  return {
    channelName: t.channelName,
    channelDescription: t.channelDescription,
    sessionText: t.session,
    breakText: t.pause,
    shieldReleasesAt: t.releasesAt,
  };
}

/**
 * Registers a routine window with AlarmManager, replacing one with the same id. The
 * OS raises the window's plan at its start and lowers it at its end, app closed or
 * not. A window whose token holds no package is cancelled instead: there would be
 * nothing to shield. Needs both permissions, like applyPlan; without them the
 * window is not registered and status() says why. Resolves, never rejects.
 */
export async function scheduleWindow(spec: RoutineWindowSpec): Promise<void> {
  const mod = nativeModule();
  if (mod === null) {
    return;
  }
  const packageNames = packageNamesFromToken(spec.token);
  if (packageNames.length === 0 || !status().available) {
    await safeAsync(() => mod.cancelWindow(spec.id));
    return;
  }
  await safeAsync(() =>
    mod.scheduleWindow({
      id: spec.id,
      startMinute: spec.startMinute,
      endMinute: spec.endMinute,
      capMinutes: spec.capMinutes,
      days: spec.days.slice(0, 7),
      packageNames,
      mode: spec.kind,
      shieldTitle: spec.shieldTitle,
      shieldSubtitle: spec.shieldSubtitle,
      shieldButton: spec.shieldButton,
      ...nativeCopy(),
    }),
  );
}

/** Disarms and forgets a window. A plan it already raised runs until its end. Resolves, never rejects. */
export async function cancelWindow(id: string): Promise<void> {
  const mod = nativeModule();
  if (mod === null) {
    return;
  }
  await safeAsync(() => mod.cancelWindow(id));
}

/** Ids of the windows the OS currently holds, so a sync can cancel the orphans. */
export async function listWindowIds(): Promise<string[]> {
  const mod = nativeModule();
  if (mod === null) {
    return [];
  }
  return safe(() => mod.listWindows()) ?? [];
}

/** Remembers what the shield says; the next applyPlan carries it to the service. */
export function configureShield(modeName: string): void {
  pendingCopy = shieldCopy(modeName, getStrings().session.shield);
}

/** True while the shield is covering an app. */
export function isShielding(): boolean {
  const mod = nativeModule();
  if (mod === null) {
    return false;
  }
  return safe(() => mod.isShielding()) ?? false;
}

/**
 * True while the foreground service is alive. False with a plan applied means the
 * system (or an OEM battery killer) took it down: the UI can say so.
 */
export function serviceAlive(): boolean {
  const mod = nativeModule();
  if (mod === null) {
    return false;
  }
  return safe(() => mod.serviceAlive()) ?? false;
}

/**
 * Calls `listener` when the service starts or stops. Returns the unsubscribe. A
 * no-op where the module is missing.
 */
export function onServiceStateChanged(listener: (running: boolean) => void): () => void {
  const mod = nativeModule();
  if (mod === null) {
    return () => undefined;
  }
  const subscription = safe(() => mod.addListener('onServiceStateChanged', (event) => listener(event.running)));
  return () => subscription?.remove();
}

function nativeStatus(mod: Module): NativeStatus {
  return safe(() => mod.getStatus()) ?? NO_STATUS;
}

/**
 * Resolves when the app has gone to the background and come back. If it never leaves
 * (the Settings page failed to open), resolves after a short wait, so a caller is
 * never stuck on a busy button.
 */
function returnedToForeground(): Promise<void> {
  return new Promise((resolve) => {
    let left = false;
    let done = false;
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      subscription.remove();
      resolve();
    };
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') {
        left = true;
      } else if (left) {
        finish();
      }
    });
    setTimeout(() => {
      if (!left) {
        finish();
      }
    }, SETTINGS_LEAVE_TIMEOUT_MS);
  });
}

function unavailable(reason: string): CapabilityStatus {
  return { available: false, reason };
}

/** Runs a native call and swallows whatever it throws. Undefined on failure. */
function safe<T>(call: () => T): T | undefined {
  try {
    return call();
  } catch (error) {
    if (__DEV__) {
      console.warn('[blocking]', errorMessage(error));
    }
    return undefined;
  }
}

/** The async twin of `safe`: true when the call resolved. */
async function safeAsync(call: () => Promise<void>): Promise<boolean> {
  try {
    await call();
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn('[blocking]', errorMessage(error));
    }
    return false;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : String(error);
}
