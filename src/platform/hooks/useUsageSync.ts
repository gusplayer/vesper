import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../../data/stores/app';
import { useUsageStore } from '../../data/stores/usage';
import { dayBounds, weekStart } from '../../domain/day';
import { packageNamesFromToken } from '../../domain/packageSelection';
import { MINUTE } from '../../domain/time';
import { useLocaleStore } from '../../i18n/store';
import { readUsage, status } from '../usage';
import { foldUsage } from '../usageReading';

/**
 * Keeps the usage store in step with the phone (ADR-0029) by subscribing to the app
 * store from outside, like useHealthSync: the store never imports the platform.
 *
 * What is measured is the union of the real apps the modes block or allow, i.e.
 * what the user declared as the phone's pull. A read asks for today (from local
 * midnight) and the week (from Monday), folds both and stores the result. It runs on
 * mount, when the modes or the language change, whenever the app comes back to the
 * foreground, and at most once every SYNC_INTERVAL_MS unless forced. Where the phone
 * cannot answer, the store keeps the demo floor with the reason.
 */

export const SYNC_INTERVAL_MS = 5 * MINUTE;

let lastSyncAt = 0;
let lastKey = '';
let inFlight: Promise<void> | null = null;

/** The packages of every mode, deduplicated and sorted so the same set has one key. */
export function measuredPackages(modes: readonly { selectionToken: string | null }[]): string[] {
  const names = new Set<string>();
  for (const mode of modes) {
    for (const name of packageNamesFromToken(mode.selectionToken)) {
      names.add(name);
    }
  }
  return [...names].sort();
}

/** Reads the phone and updates the store. Concurrent calls share one read. */
export function syncUsage(packageNames: readonly string[], force = false): Promise<void> {
  const key = packageNames.join(',');
  const now = Date.now();
  if (!force && key === lastKey && now - lastSyncAt < SYNC_INTERVAL_MS) {
    return Promise.resolve();
  }
  if (inFlight !== null) {
    return inFlight;
  }
  const current = status(packageNames.length);
  if (!current.available) {
    lastKey = key;
    lastSyncAt = now;
    useUsageStore.getState().setDemo(current.reason ?? '');
    return Promise.resolve();
  }
  inFlight = (async () => {
    const [today, week] = await Promise.all([
      readUsage(dayBounds(now).dayStart, now, packageNames),
      readUsage(weekStart(now), now, packageNames),
    ]);
    lastKey = key;
    lastSyncAt = now;
    useUsageStore.getState().setDevice(foldUsage(today, week), now);
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function useUsageSync(): void {
  const modes = useAppStore((state) => state.modes);
  const locale = useLocaleStore((state) => state.locale);
  const key = measuredPackages(modes).join(',');

  useEffect(() => {
    const packageNames = key === '' ? [] : key.split(',');
    // The language is a dependency because the stored reason is written in it.
    void syncUsage(packageNames, true);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncUsage(packageNames);
      }
    });
    return () => subscription.remove();
  }, [key, locale]);
}
