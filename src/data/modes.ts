import { create } from 'zustand';

import { DEFAULT_PLANNED_MS } from '../domain/session';
import { MINUTE } from '../domain/time';
import type { Strings } from '../i18n/es';
import type { Mode, ModeBehavior } from './types';

/**
 * Small helpers around modes and the focus button that more than one screen needs.
 * Pure text on one side, a tiny store on the other; both sit on top of the stores in
 * src/data/stores and never reach for the UI.
 *
 * The text helpers take the `modes` slice of the dictionary (ADR-0020): screens pass
 * `useStrings().modes`, code outside React passes `getStrings().modes`.
 */

export type ModesStrings = Strings['modes'];

type ModeShape = Pick<Mode, 'behavior' | 'appIds' | 'websiteIds'>;

/**
 * The mode that already carries `name`, ignoring case and surrounding spaces, or
 * undefined. Modos › Ideas uses it to mark an idea that is already one of the modes
 * instead of adding a twin; the first match wins, so the oldest mode is the one found.
 */
export function findModeByName<T extends Pick<Mode, 'name'>>(modes: readonly T[], name: string): T | undefined {
  const wanted = name.trim().toLowerCase();
  if (wanted === '') {
    return undefined;
  }
  return modes.find((mode) => mode.name.trim().toLowerCase() === wanted);
}

/**
 * The name of a duplicate: 'Sin redes (1)', then '(2)' when that one exists. A copy of
 * a copy counts from the same base ('Sin redes (1)' → 'Sin redes (2)'), never
 * 'Sin redes (1) (1)'. Names compare as the user reads them (trimmed, any case).
 */
export function duplicateName(name: string, existing: readonly string[]): string {
  const base = name.trim().replace(/\s\(\d+\)$/, '');
  const taken = new Set(existing.map((other) => other.trim().toLowerCase()));
  let n = 1;
  while (taken.has(`${base} (${n})`.toLowerCase())) {
    n += 1;
  }
  return `${base} (${n})`;
}

/**
 * Where a mode's apps come from on this phone (ADR-0047 §2): one list per mode.
 *
 * - `real`: the phone can block, or the access can be given from the app. "Apps" is
 *   the real picker and the mode's real selection (`selectionToken`) is its list; the
 *   catalogue does not show. `selection` is what the token holds ('3 apps · 1 sitio'),
 *   or null when it holds nothing.
 * - `example`: there is no real picker here (simulator, iPhone without the
 *   entitlement, a build without the module). The catalogue stands in, as an example:
 *   nothing on this phone blocks it.
 *
 * Built by the caller from the blocking `status()` (features/modes/realBlocking), so
 * this file stays free of the platform.
 */
/**
 * Where a mode's apps come from on this phone. `repick`: a real picker, nothing picked
 * here, and apps that were picked on another phone before a restore (ADR-0048 §9).
 */
export type AppsSource = { kind: 'real'; selection: string | null; repick?: boolean } | { kind: 'example' };

/**
 * The line under a mode name, counting what really blocks: 'Bloquea 3 apps', 'Permite
 * solo 2 apps', or 'No bloquea apps' — a neutral fact, since a mode with nothing blocked
 * is a valid choice (ADR-0047 §1). Where the catalogue stands in, it says the list is
 * an example ('4 apps · 3 sitios de ejemplo') and claims no blocking.
 */
export function modeSummaryText(mode: ModeShape, t: ModesStrings, source: AppsSource): string {
  if (source.kind === 'real') {
    if (source.selection === null) {
      return source.repick === true ? t.summary.repick : t.summary.none;
    }
    return mode.behavior === 'allow' ? t.summary.allowsOnly(source.selection) : t.summary.blocks(source.selection);
  }
  const parts: string[] = [];
  if (mode.appIds.length > 0) {
    parts.push(t.summary.apps(mode.appIds.length));
  }
  if (mode.websiteIds.length > 0) {
    parts.push(t.summary.sites(mode.websiteIds.length));
  }
  return parts.length === 0 ? t.summary.none : t.summary.example(parts.join(' · '));
}

/** What the apps row is called for each behavior: what the list means changes. */
export function appsTitleText(behavior: ModeBehavior, t: ModesStrings): string {
  return behavior === 'allow' ? t.summary.allowedApps : t.summary.blockedApps;
}

/** '1 app', '4 apps'. Language-neutral: the caller passes the two words. */
export function countText(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** The durations offered before a session, in ms. */
export const PLANNED_OPTIONS_MS: readonly number[] = [5, 25, 50, 90, 120].map((m) => m * MINUTE);

/**
 * The duration picked for the next session, shown on the focus button. Null is
 * "sin límite" (ADR-0022). Not persisted: the prototype forgets on relaunch (ADR-0016).
 */
export const usePlannedStore = create<{ plannedMs: number | null; setPlannedMs: (ms: number | null) => void }>(
  (set) => ({
    plannedMs: DEFAULT_PLANNED_MS,
    setPlannedMs: (plannedMs) => set({ plannedMs }),
  }),
);
