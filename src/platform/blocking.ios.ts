import type * as DeviceActivity from 'react-native-device-activity';

import { SHIELD_ICON, shieldPalette } from '../design/shieldPalette';
import { blockPlan, isEmptyPlan, shieldCopy, type BlockPlan, type BlockRules, type BlockableMode, type ShieldCopy } from '../domain/blocking';
import { ACTIVITY_PREFIX, routineIdFromActivityName, routineIdsFromActivityNames, windowIntervals } from '../domain/routineWindows';
import { getStrings } from '../i18n';
import type { PausePlan, ResumePlan, RoutineWindowSpec } from './blockingTypes';
import { isAndroid, isDevice, type CapabilityStatus } from './capabilities';

/**
 * blocking: Screen Time (Family Controls) behind the platform seam of ADR-0017.
 *
 * The native module is loaded lazily and only once, inside a try/catch: importing it at
 * the top of a screen would throw on a build that lacks it. Every call below is a
 * no-op where the capability is missing, and `status()` says why in Spanish, so the UI
 * never sees a native error.
 *
 * What is honest here: Family Controls does not exist in the simulator, and on a
 * device it needs Apple's entitlement, which this project does not have yet. We only
 * learn that the entitlement is missing when `requestAuthorization()` fails, so the
 * failure is remembered for the rest of the launch.
 */

type Module = typeof DeviceActivity;

/** Undefined until the first load; null when the module cannot be used here. */
let cached: Module | null | undefined;

/** Set when an authorization request failed for a reason other than the user saying no. */
let entitlementMissing = false;

const NO_RULES: BlockRules = { blockInstalls: false, blockPurchases: false, blockMature: false };

/** Tag every ManagedSettings write, so the logs of the extensions say who did it. */
const TRIGGERED_BY = 'vesper-session';

export type AuthorizationResult = 'approved' | 'denied' | 'unavailable';

export type SelectionSummary = {
  apps: number;
  categories: number;
  websites: number;
};

/**
 * The module, or null. Never throws. Exported for the picker view, which is the one
 * piece of UI that must render a native component from this module.
 */
export function nativeModule(): Module | null {
  if (cached !== undefined) {
    return cached;
  }
  if (isAndroid) {
    cached = null;
    return cached;
  }
  try {
    // A static require so Metro bundles it; wrapped so a build without the pod does
    // not take the app down at load time.
    const loaded = require('react-native-device-activity') as Module;
    cached = loaded.isAvailable() ? loaded : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function status(): CapabilityStatus {
  const t = getStrings().modes.blocking;
  if (isAndroid) {
    return unavailable(t.iosOnly);
  }
  if (!isDevice) {
    return unavailable(t.simulator);
  }
  const mod = nativeModule();
  if (mod === null) {
    return unavailable(t.noModule);
  }
  if (entitlementMissing) {
    return unavailable(t.noEntitlement);
  }
  if (authorizationStatus(mod) === mod.AuthorizationStatus.denied) {
    return unavailable(t.denied);
  }
  return { available: true, reason: null };
}

/** True once the user said yes. `status().available` also covers "not asked yet". */
export function isAuthorized(): boolean {
  const mod = nativeModule();
  return mod !== null && status().available && authorizationStatus(mod) === mod.AuthorizationStatus.approved;
}

/**
 * Asks iOS for Screen Time. Resolves, never rejects: 'unavailable' where the capability
 * is missing or the entitlement is not there, 'denied' when the user says no.
 */
export async function requestAuthorization(): Promise<AuthorizationResult> {
  const mod = nativeModule();
  if (mod === null || !status().available) {
    return mod !== null && authorizationStatus(mod) === mod.AuthorizationStatus.denied ? 'denied' : 'unavailable';
  }
  if (authorizationStatus(mod) === mod.AuthorizationStatus.approved) {
    return 'approved';
  }
  try {
    await mod.requestAuthorization('individual');
  } catch (error) {
    if (isCancellation(error)) {
      return 'denied';
    }
    // Anything else is the system refusing the app itself: no entitlement, a device
    // without a passcode, a restricted account. The entitlement is the one we expect.
    entitlementMissing = true;
    if (__DEV__) {
      console.warn('[blocking] authorization failed:', errorMessage(error));
    }
    return 'unavailable';
  }
  return authorizationStatus(mod) === mod.AuthorizationStatus.approved ? 'approved' : 'denied';
}

/** How many apps, categories and websites a selection token holds. Zeros when unknown. */
export function selectionSummary(token: string | null): SelectionSummary {
  const none: SelectionSummary = { apps: 0, categories: 0, websites: 0 };
  const mod = nativeModule();
  if (token === null || token === '' || mod === null || !status().available) {
    return none;
  }
  const metadata = safe(() => mod.activitySelectionMetadata({ activitySelectionToken: token }));
  if (metadata === undefined || metadata === null) {
    return none;
  }
  return {
    apps: metadata.applicationCount,
    categories: metadata.categoryCount,
    websites: metadata.webDomainCount,
  };
}

/** '3 apps · 1 categoría · 2 sitios', or 'Ninguna' when the token holds nothing. */
export function selectionSummaryText(token: string | null): string {
  const t = getStrings().modes.blocking;
  const summary = selectionSummary(token);
  const parts: string[] = [];
  if (summary.apps > 0) {
    parts.push(t.apps(summary.apps));
  }
  if (summary.categories > 0) {
    parts.push(t.categories(summary.categories));
  }
  if (summary.websites > 0) {
    parts.push(t.sites(summary.websites));
  }
  return parts.length === 0 ? t.none : parts.join(' · ');
}

/**
 * Puts the shield up for a mode. 'block' shields the selection; 'allow' shields
 * everything and whitelists the selection. Rules the typings expose are applied too:
 * only the adult-content filter is (see applyPlan).
 */
export function applyMode(mode: BlockableMode, rules: BlockRules = NO_RULES): void {
  applyPlan(blockPlan(mode, rules));
}

/**
 * Applies a plan from src/domain/blocking. Nothing happens where the capability is
 * missing. `endsAt` is part of the shared contract (Android times its own release);
 * iOS ignores it, because ManagedSettings has no timer and useBlockingSync calls
 * release() when the session ends.
 */
export function applyPlan(plan: BlockPlan, _endsAt?: number): void {
  const mod = nativeModule();
  if (mod === null || !status().available || isEmptyPlan(plan)) {
    return;
  }
  if (plan.kind === 'block' && plan.token !== null) {
    const token = plan.token;
    safe(() => mod.disableBlockAllMode(TRIGGERED_BY));
    safe(() => mod.blockSelection({ activitySelectionToken: token }, TRIGGERED_BY));
  } else if (plan.kind === 'allow' && plan.token !== null) {
    // "Permitir solo seleccionadas": shield every app except the selection. Categories
    // inside the selection only pass through when it was picked with
    // includeEntireCategory, which the inline picker cannot ask for; the module warns.
    const token = plan.token;
    safe(() => mod.enableBlockAllMode(TRIGGERED_BY));
    safe(() => mod.addSelectionToWhitelistAndUpdateBlock({ activitySelectionToken: token }, TRIGGERED_BY));
  }
  if (plan.blockMature) {
    // Apple's automatic filter for adult websites, on ManagedSettingsStore.webContent.
    safe(() => mod.setWebContentFilterPolicy({ type: 'auto' }, TRIGGERED_BY));
  }
  // blockInstalls and blockPurchases map to ManagedSettings `application` and
  // `appStore`, which react-native-device-activity does not expose. They stay as UI.
}

/** Takes every shield down: blocklist, block-all mode, whitelist and the web filter. */
export function release(): void {
  const mod = nativeModule();
  if (mod === null || !status().available) {
    return;
  }
  safe(() => mod.resetBlocks(TRIGGERED_BY));
  safe(() => mod.disableBlockAllMode(TRIGGERED_BY));
  safe(() => mod.clearWhitelistAndUpdateBlock(TRIGGERED_BY));
  safe(() => mod.clearWebContentFilterPolicy(TRIGGERED_BY));
}

/** What the shield says on top of a blocked app, in the session's ink (ADR-0023). */
export function configureShield(modeName: string): void {
  const mod = nativeModule();
  if (mod === null || !status().available) {
    return;
  }
  const copy = shieldCopy(modeName, getStrings().session.shield);
  safe(() => mod.updateShield(shieldConfiguration(mod, copy), SHIELD_ACTIONS, TRIGGERED_BY));
}

/**
 * The only button closes the blocked app, and its label says so. The library's
 * `openApp` action cannot do more: from the ShieldAction extension it calls
 * `NSExtensionContext().open("device-activity://")` on a context it just created,
 * with no host behind it, and iOS ignores it (extensions cannot open URLs; the
 * library tracks it as issue #81). A promise the button cannot keep is worse than
 * "Cerrar".
 */
const SHIELD_ACTIONS: DeviceActivity.ShieldActions = { primary: { behavior: 'close' } };

/**
 * The shield's copy and look, as the ShieldConfiguration extension consumes them:
 * colors as 0-255 channels (src/design/shieldPalette), an SF Symbol for the icon, and
 * a dark blur under the ink in case the system draws the ground before the color.
 */
function shieldConfiguration(mod: Module, copy: ShieldCopy): DeviceActivity.ShieldConfiguration {
  const palette = shieldPalette();
  return {
    title: copy.title,
    subtitle: copy.subtitle,
    primaryButtonLabel: copy.primaryButtonLabel,
    iconSystemName: SHIELD_ICON,
    backgroundBlurStyle: mod.UIBlurEffectStyle.dark,
    ...palette,
  };
}

/** True while iOS is shielding something on our behalf. */
export function isShielding(): boolean {
  const mod = nativeModule();
  if (mod === null || !status().available) {
    return false;
  }
  return safe(() => mod.isShieldActive()) ?? false;
}

// ---------------------------------------------------------------------------------
// Routine windows (ADR-0019): DeviceActivity schedules the shield while the app is
// closed. See docs/PLATFORM_IOS.md, "Ventanas de rutina".
// ---------------------------------------------------------------------------------

/**
 * Registers a routine window with DeviceActivity: one repeating schedule per weekday
 * the routine is on (or one daily schedule when it is on every day), with the
 * selection stored under the routine's id so the monitor extension can block and
 * unblock it without the app. Whatever this routine had scheduled before is replaced.
 * Resolves, never rejects.
 */
export async function scheduleWindow(spec: RoutineWindowSpec): Promise<void> {
  const mod = nativeModule();
  if (mod === null || !status().available) {
    return;
  }
  const intervals = windowIntervals(spec);
  if (intervals.length === 0 || spec.token.trim() === '') {
    return;
  }
  const key = windowKey(spec.id);
  // Days or hours may have changed: the old activities of this routine go first.
  stopWindow(mod, spec.id);
  safe(() => mod.setFamilyActivitySelectionId({ id: key, familyActivitySelection: spec.token }));
  safe(() =>
    mod.updateShieldWithId(
      shieldConfiguration(mod, { title: spec.shieldTitle, subtitle: spec.shieldSubtitle, primaryButtonLabel: spec.shieldButton }),
      SHIELD_ACTIONS,
      key,
    ),
  );
  for (const interval of intervals) {
    safe(() =>
      mod.configureActions({
        activityName: interval.activityName,
        callbackName: 'intervalDidStart',
        actions: windowStartActions(spec.kind, key),
      }),
    );
    safe(() =>
      mod.configureActions({
        activityName: interval.activityName,
        callbackName: 'intervalDidEnd',
        actions: windowEndActions(spec.kind, key),
      }),
    );
    await safeAsync(() =>
      mod.startMonitoring(
        interval.activityName,
        { intervalStart: interval.start, intervalEnd: interval.end, repeats: true },
        [],
      ),
    );
  }
}

/** Stops every schedule of a routine and forgets its actions. Resolves, never rejects. */
export async function cancelWindow(id: string): Promise<void> {
  const mod = nativeModule();
  if (mod === null || !status().available) {
    return;
  }
  stopWindow(mod, id);
}

/** The routines DeviceActivity currently holds a window for. */
export async function listWindowIds(): Promise<string[]> {
  const mod = nativeModule();
  if (mod === null || !status().available) {
    return [];
  }
  return routineIdsFromActivityNames(safe(() => mod.getActivities()) ?? []);
}

/**
 * The Android backend needs exact alarms, a notification channel, a living service and
 * a way out of battery optimisation. iOS needs none of that: the system runs the
 * schedule. These exist so the shared hooks can call them on both platforms.
 */
export async function requestExactAlarms(): Promise<boolean> {
  return true;
}

export async function requestNotifications(): Promise<boolean> {
  return true;
}

/** True when the system is in a position to run our schedules. */
export function serviceAlive(): boolean {
  return status().available;
}

/** Nothing to open on iOS. */
export async function openBatterySettings(): Promise<boolean> {
  return false;
}

/** Selection id, shield id and action prefix of a routine, all the same string. */
function windowKey(id: string): string {
  return `${ACTIVITY_PREFIX}${id}`;
}

function stopWindow(mod: Module, id: string): void {
  const names = (safe(() => mod.getActivities()) ?? []).filter((name) => routineIdFromActivityName(name) === id);
  // An empty list tells the module to stop *every* activity, so it never gets one.
  if (names.length > 0) {
    safe(() => mod.stopMonitoring(names));
  }
  safe(() => mod.cleanUpAfterActivity(windowKey(id)));
}

/**
 * What the monitor extension does when the interval starts. 'block' shields the
 * selection under the routine's shield copy; 'allow' whitelists the selection first
 * and then shields everything else (the extension applies the whitelist inside
 * enableBlockAllMode).
 */
function windowStartActions(kind: RoutineWindowSpec['kind'], key: string): DeviceActivity.Action[] {
  if (kind === 'block') {
    return [{ type: 'blockSelection', familyActivitySelectionId: key, shieldId: key }];
  }
  return [
    { type: 'addSelectionToWhitelist', familyActivitySelection: { activitySelectionId: key } },
    { type: 'enableBlockAllMode', shieldId: key },
  ];
}

/** What the extension does when the interval ends: undo exactly what it did. */
function windowEndActions(kind: RoutineWindowSpec['kind'], key: string): DeviceActivity.Action[] {
  if (kind === 'block') {
    return [{ type: 'unblockSelection', familyActivitySelectionId: key }];
  }
  return [{ type: 'disableBlockAllMode' }, { type: 'clearWhitelistAndUpdateBlock' }];
}

function authorizationStatus(mod: Module): DeviceActivity.AuthorizationStatusType {
  return safe(() => mod.getAuthorizationStatus()) ?? mod.AuthorizationStatus.notDetermined;
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

function isCancellation(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes('cancel');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : String(error);
}

// ---------------------------------------------------------------------------------
// Breaks (ADR-0022, ADR-0023 decision 5): iOS has no service to keep alive through a
// break, so pausing is releasing and resuming is applying. The shared hook calls
// these on both platforms and never learns which one answered.
// ---------------------------------------------------------------------------------

/** Takes the shield down for the break. `_untilMs` is Android's; iOS waits for resumePlan. */
export const pausePlan: PausePlan = (_untilMs) => {
  release();
};

/** Puts the shield back after the break, the same way the session put it up. */
export const resumePlan: ResumePlan = (plan, endsAt) => {
  applyPlan(plan, endsAt);
};
