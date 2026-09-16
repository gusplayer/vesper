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

/** 'Bloquea 4 apps · 3 sitios' or 'Permite solo 3 apps' — the line under a mode name. */
export function modeSummaryText(mode: ModeShape, t: ModesStrings): string {
  const apps = t.summary.apps(mode.appIds.length);
  const sites = mode.websiteIds.length;
  if (mode.behavior === 'allow') {
    return t.summary.allowsOnly(apps);
  }
  const parts = [t.summary.blocks(apps)];
  if (sites > 0) {
    parts.push(t.summary.sites(sites));
  }
  return parts.join(' · ');
}

/** 'Bloqueando 4 apps' / 'Permitiendo solo 3 apps' — the line under the mode name during a session. */
export function modeRunningText(mode: ModeShape, t: ModesStrings): string {
  const apps = t.summary.apps(mode.appIds.length);
  return mode.behavior === 'allow' ? t.summary.allowingOnly(apps) : t.summary.blocking(apps);
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
export const PLANNED_OPTIONS_MS: ReadonlyArray<number> = [5, 25, 50, 90, 120].map((m) => m * MINUTE);

/**
 * The duration picked last time, so the long press on the focus button can start
 * without asking. Not persisted: the prototype forgets on relaunch (ADR-0016).
 */
export const usePlannedStore = create<{ plannedMs: number; setPlannedMs: (ms: number) => void }>(
  (set) => ({
    plannedMs: DEFAULT_PLANNED_MS,
    setPlannedMs: (plannedMs) => set({ plannedMs }),
  }),
);
