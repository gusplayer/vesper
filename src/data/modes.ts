import { create } from 'zustand';

import { DEFAULT_PLANNED_MS } from '../domain/session';
import { MINUTE } from '../domain/time';
import type { Mode, ModeBehavior } from './types';

/**
 * Small helpers around modes and the focus button that more than one screen needs.
 * Pure text on one side, a tiny store on the other; both sit on top of the stores in
 * src/data/stores and never reach for the UI.
 */

type ModeShape = Pick<Mode, 'behavior' | 'appIds' | 'websiteIds'>;

/** 'Bloquea 4 apps · 3 sitios' or 'Permite solo 3 apps' — the line under a mode name. */
export function modeSummaryText(mode: ModeShape): string {
  const apps = mode.appIds.length;
  const sites = mode.websiteIds.length;
  if (mode.behavior === 'allow') {
    return `Permite solo ${countText(apps, 'app', 'apps')}`;
  }
  const parts = [`Bloquea ${countText(apps, 'app', 'apps')}`];
  if (sites > 0) {
    parts.push(countText(sites, 'sitio', 'sitios'));
  }
  return parts.join(' · ');
}

/** 'Bloqueando 4 apps' / 'Permitiendo solo 3 apps' — the line under the mode name during a session. */
export function modeRunningText(mode: ModeShape): string {
  const apps = countText(mode.appIds.length, 'app', 'apps');
  return mode.behavior === 'allow' ? `Permitiendo solo ${apps}` : `Bloqueando ${apps}`;
}

/** What the apps row is called for each behavior: what the list means changes. */
export function appsTitleText(behavior: ModeBehavior): string {
  return behavior === 'allow' ? 'Apps permitidas' : 'Apps bloqueadas';
}

/** '1 app', '4 apps'. */
export function countText(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** The durations offered before a session, in ms. */
export const PLANNED_OPTIONS_MS: ReadonlyArray<number> = [25, 50, 90, 120].map((m) => m * MINUTE);

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
