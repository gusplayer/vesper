import type { AppsSource } from '../../data/modes';
import type { Mode } from '../../data/types';
import { selectionSummary, selectionSummaryText } from '../../platform/blocking';
import type { BlockingStatus, GrantableToggle } from '../../platform/blockingTypes';
import { isAndroid } from '../../platform/capabilities';

/**
 * One app list per mode (ADR-0047 §2), decided from the blocking `status()`: where the
 * phone can block, or the access can be given from the app, the mode's apps are its
 * real selection and "Apps" opens the real picker. Anywhere else the catalogue stands
 * in, as an example. Screens read `status()` once and pass it here.
 */
export function hasRealPicker(blocking: BlockingStatus): boolean {
  return blocking.available || blocking.detail?.grantable === true;
}

/** Where this mode's apps come from on this phone, and what its real selection holds. */
export function appsSource(mode: Pick<Mode, 'selectionToken' | 'needsRepick'>, blocking: BlockingStatus): AppsSource {
  if (!hasRealPicker(blocking)) {
    return { kind: 'example' };
  }
  const summary = selectionSummary(mode.selectionToken);
  const holds = summary.apps + summary.categories + summary.websites > 0;
  return {
    kind: 'real',
    selection: holds ? selectionSummaryText(mode.selectionToken) : null,
    // Apps picked on the phone this was restored from: say so, rather than a plain
    // "No bloquea apps" that reads as the user's own choice (ADR-0048 §9).
    repick: !holds && mode.needsRepick === true,
  };
}

/**
 * Whether the mode shows a site list. Android blocks no sites at all, and on an iPhone
 * with the real picker the sites are chosen in Screen Time with the apps; only the
 * catalogue world of an iPhone (simulator, no entitlement) keeps the example list.
 */
export function showsSites(blocking: BlockingStatus): boolean {
  return !isAndroid && !hasRealPicker(blocking);
}

/**
 * The Settings toggle a screen can send the user to when blocking is off because of
 * it (Android: usage access, then the overlay). Null where the reason is a fact — no
 * module, a simulator, Apple's entitlement — or where blocking already works.
 */
export function grantableToggle(blocking: BlockingStatus): GrantableToggle | null {
  return blocking.available ? null : (blocking.detail?.missing ?? null);
}
