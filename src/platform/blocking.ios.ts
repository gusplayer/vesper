import type * as DeviceActivity from 'react-native-device-activity';

import { blockPlan, isEmptyPlan, shieldCopy, type BlockPlan, type BlockRules, type BlockableMode } from '../domain/blocking';
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
  if (isAndroid) {
    return unavailable('solo iPhone');
  }
  if (!isDevice) {
    return unavailable('el simulador no tiene Tiempo de uso');
  }
  const mod = nativeModule();
  if (mod === null) {
    return unavailable('este build no trae Tiempo de uso');
  }
  if (entitlementMissing) {
    return unavailable('falta el entitlement de Family Controls de Apple');
  }
  if (authorizationStatus(mod) === mod.AuthorizationStatus.denied) {
    return unavailable('el permiso de Tiempo de uso está denegado');
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
  const summary = selectionSummary(token);
  const parts: string[] = [];
  if (summary.apps > 0) {
    parts.push(count(summary.apps, 'app', 'apps'));
  }
  if (summary.categories > 0) {
    parts.push(count(summary.categories, 'categoría', 'categorías'));
  }
  if (summary.websites > 0) {
    parts.push(count(summary.websites, 'sitio', 'sitios'));
  }
  return parts.length === 0 ? 'Ninguna' : parts.join(' · ');
}

/**
 * Puts the shield up for a mode. 'block' shields the selection; 'allow' shields
 * everything and whitelists the selection. Rules the typings expose are applied too:
 * only the adult-content filter is (see applyPlan).
 */
export function applyMode(mode: BlockableMode, rules: BlockRules = NO_RULES): void {
  applyPlan(blockPlan(mode, rules));
}

/** Applies a plan from src/domain/blocking. Nothing happens where the capability is missing. */
export function applyPlan(plan: BlockPlan): void {
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

/** What the shield says on top of a blocked app. The only button sends the user back. */
export function configureShield(modeName: string): void {
  const mod = nativeModule();
  if (mod === null || !status().available) {
    return;
  }
  const copy = shieldCopy(modeName);
  safe(() =>
    mod.updateShield(
      { title: copy.title, subtitle: copy.subtitle, primaryButtonLabel: copy.primaryButtonLabel },
      { primary: { behavior: 'close' } },
      TRIGGERED_BY,
    ),
  );
}

/** True while iOS is shielding something on our behalf. */
export function isShielding(): boolean {
  const mod = nativeModule();
  if (mod === null || !status().available) {
    return false;
  }
  return safe(() => mod.isShieldActive()) ?? false;
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

function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
