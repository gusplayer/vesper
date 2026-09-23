import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../../data/stores/app';
import { useUsageStore } from '../../data/stores/usage';
import { dayBounds, weekStart } from '../../domain/day';
import { useLocaleStore } from '../../i18n/store';
import { readFailedReason, readUsage, status } from '../usage';
import { foldUsage, isFresh, measuredPackages, type SyncMemory } from '../usageReading';

/**
 * Keeps the usage store in step with the phone (ADR-0029) by subscribing to the app
 * store from outside, like useHealthSync: the store never imports the platform.
 *
 * What is measured is the union of the real apps the modes *block*, i.e. what the user
 * declared as the phone's pull. A read asks for today (from local midnight) and the
 * week (from Monday), folds both and stores the result. It runs on mount, when the
 * modes or the language change, whenever the app comes back to the foreground, and at
 * most once every SYNC_INTERVAL_MS unless forced. Where the phone cannot answer, or
 * answers with nothing, the store keeps the demo floor with the reason (rule 8).
 */

const memory: SyncMemory = { lastKey: '', lastSyncAt: 0 };
/** One promise per package set: a read of another set must not be answered with this one. */
const inFlight = new Map<string, Promise<void>>();
/** The set the most recent caller asked for; a read that lands after it is stale. */
let latestKey = '';

/** Forgets the last read, so the next call reads the phone again. Reset and tests. */
export function forgetUsageSync(): void {
  memory.lastKey = '';
  memory.lastSyncAt = 0;
  latestKey = '';
}

/** Reads the phone and updates the store. Concurrent calls for the same set share one read. */
export function syncUsage(packageNames: readonly string[], force = false): Promise<void> {
  const key = packageNames.join(',');
  const now = Date.now();
  if (!force && isFresh(memory, key, now)) {
    return Promise.resolve();
  }
  const pending = inFlight.get(key);
  if (pending !== undefined) {
    // Same question, already on its way: even a forced caller wants that answer.
    return pending;
  }
  latestKey = key;
  const current = status(packageNames.length);
  if (!current.available) {
    useUsageStore.getState().setDemo(current.reason ?? '');
    return Promise.resolve();
  }
  const read = (async () => {
    const [today, week] = await Promise.all([
      readUsage(dayBounds(now).dayStart, now, packageNames, true),
      // No icons: the breakdown is built from today's rows, so a week of base64 PNGs
      // would cross the bridge to be thrown away.
      readUsage(weekStart(now), now, packageNames, false),
    ]);
    if (key !== latestKey) {
      // The modes (or the language) changed while the phone was answering; the newer
      // call owns the store, so this reading is dropped instead of overwriting it.
      return;
    }
    if (today === null || week === null) {
      // A failed read is not a verified zero: say so and keep the floor
      // (rule 8, ADR-0035 §4).
      useUsageStore.getState().setDemo(readFailedReason());
      return;
    }
    memory.lastKey = key;
    memory.lastSyncAt = now;
    useUsageStore.getState().setDevice(foldUsage(today, week), now);
  })().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, read);
  return read;
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
      if (state !== 'active') {
        return;
      }
      // Coming back from Settings with usage access just granted is the common case,
      // and nothing in any store changed: force the read while the floor is still the
      // demo one, as useHealthSync forces on connect.
      void syncUsage(packageNames, useUsageStore.getState().source === 'demo');
    });
    // "Borrar todo y reiniciar" empties the store; the cooldown must go with it.
    const unsubscribe = useUsageStore.subscribe((state, previous) => {
      if (state.epoch !== previous.epoch) {
        forgetUsageSync();
        void syncUsage(packageNames, true);
      }
    });
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, [key, locale]);
}
