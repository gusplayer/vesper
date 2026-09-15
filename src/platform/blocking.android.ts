import { AppState, type AppStateStatus } from 'react-native';

import { blockPlan, isEmptyPlan, shieldCopy, type BlockPlan, type BlockRules, type BlockableMode } from '../domain/blocking';
import { packageNamesFromToken } from '../domain/packageSelection';
import type { NativeStatus, VesperBlockingNative } from '../../modules/vesper-blocking';
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
 * Every native call is wrapped: a build without the module, or a stale one, must
 * degrade to "no disponible", never to a red screen.
 */

type Module = VesperBlockingNative;

/** Undefined until the first load; null when the module cannot be used here. */
let cached: Module | null | undefined;

/** The copy the next applyPlan sends. Set by configureShield, like the iOS shield. */
let pendingCopy = shieldCopy('');

const NO_RULES: BlockRules = { blockInstalls: false, blockPurchases: false, blockMature: false };

/** The Android button goes home, not back to Vesper, so its label says just that. */
const SHIELD_BUTTON = 'Volver';

/** How long to wait for the app to leave the foreground after opening Settings. */
const SETTINGS_LEAVE_TIMEOUT_MS = 1500;

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
    return unavailable('Este build no trae el módulo de bloqueo');
  }
  const native = nativeStatus(mod);
  if (!native.usageAccess) {
    return unavailable('Falta el acceso de uso');
  }
  if (!native.overlay) {
    return unavailable('Falta mostrar sobre otras apps');
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

/** How many apps a token holds. Android has no categories or websites. */
export function selectionSummary(token: string | null): SelectionSummary {
  return { apps: packageNamesFromToken(token).length, categories: 0, websites: 0 };
}

/** '3 apps', or 'Ninguna' when the token holds nothing. */
export function selectionSummaryText(token: string | null): string {
  const { apps } = selectionSummary(token);
  return apps === 0 ? 'Ninguna' : count(apps, 'app', 'apps');
}

/** Puts the shield up for a mode. See applyPlan. */
export function applyMode(mode: BlockableMode, rules: BlockRules = NO_RULES): void {
  applyPlan(blockPlan(mode, rules));
}

/**
 * Applies a plan from src/domain/blocking: starts the foreground service with the
 * package names and the shield copy. The rules do not travel: Android has no
 * ManagedSettings, and nothing here pretends otherwise.
 */
export function applyPlan(plan: BlockPlan): void {
  const mod = nativeModule();
  const kind = plan.kind;
  if (mod === null || !status().available || isEmptyPlan(plan) || kind === 'none') {
    return;
  }
  const packageNames = packageNamesFromToken(plan.token);
  if (packageNames.length === 0) {
    return;
  }
  void safeAsync(() =>
    mod.applyPlan({
      packageNames,
      mode: kind,
      shieldTitle: pendingCopy.title,
      shieldSubtitle: pendingCopy.subtitle,
      shieldButton: SHIELD_BUTTON,
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

/** Remembers what the shield says; the next applyPlan carries it to the service. */
export function configureShield(modeName: string): void {
  pendingCopy = shieldCopy(modeName);
}

/** True while the shield is covering an app. */
export function isShielding(): boolean {
  const mod = nativeModule();
  if (mod === null) {
    return false;
  }
  return safe(() => mod.isShielding()) ?? false;
}

function nativeStatus(mod: Module): NativeStatus {
  return safe(() => mod.getStatus()) ?? { usageAccess: false, overlay: false, running: false };
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

function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
