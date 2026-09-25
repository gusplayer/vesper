import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../../data/stores/app';
import { healthWindow, marksFromHealth, type HealthWeek } from '../../domain/healthMarks';
import { MINUTE } from '../../domain/time';
import { readWeek, status } from '../health';

/**
 * Keeps the habit marks in step with Health by subscribing to the store from outside:
 * the store never imports the platform, so the app builds where HealthKit is missing.
 *
 * A sync reads the week from HealthKit, turns it into marks (domain/healthMarks.ts)
 * and replaces the health-sourced marks of that week in the store. It runs on mount, whenever the
 * app comes back to the foreground, when Health is connected, and at most once every
 * SYNC_INTERVAL_MS unless forced. Editing a habit recomputes the marks from the last
 * read without touching HealthKit again.
 */

export const SYNC_INTERVAL_MS = 15 * MINUTE;

let lastSyncAt = 0;
let lastWeek: HealthWeek | null = null;
let inFlight: Promise<void> | null = null;

function canSync(): boolean {
  return useAppStore.getState().settings.healthConnected && status().available;
}

/** `syncedAt` is when Health was last read, which a recompute does not change. */
function applyWeek(week: HealthWeek, now: number, syncedAt: number): void {
  const store = useAppStore.getState();
  const marks = marksFromHealth(store.habits, week, now);
  store.setHealthMarks(marks, syncedAt, healthWindow(now));
}

/**
 * Reads Health and updates the marks. Skips silently when Health is not connected or
 * not available, and when the last read is recent unless `force` is true. Concurrent
 * calls share one read.
 */
export function syncHealth(force = false): Promise<void> {
  if (!canSync()) {
    return Promise.resolve();
  }
  if (!force && Date.now() - lastSyncAt < SYNC_INTERVAL_MS) {
    return Promise.resolve();
  }
  if (inFlight !== null) {
    return inFlight;
  }
  inFlight = (async () => {
    const now = Date.now();
    const week = await readWeek(now);
    // The user may have disconnected while HealthKit was answering.
    if (!useAppStore.getState().settings.healthConnected) {
      return;
    }
    lastWeek = week;
    lastSyncAt = Date.now();
    applyWeek(week, lastSyncAt, lastSyncAt);
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function useHealthSync(): void {
  useEffect(() => {
    void syncHealth();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncHealth();
      }
    });

    const unsubscribe = useAppStore.subscribe((state, previous) => {
      const connected = state.settings.healthConnected;
      if (connected && !previous.settings.healthConnected) {
        void syncHealth(true);
        return;
      }
      if (!connected) {
        lastWeek = null;
        return;
      }
      if (state.habits !== previous.habits) {
        if (lastWeek === null) {
          void syncHealth(true);
        } else {
          applyWeek(lastWeek, Date.now(), lastSyncAt);
        }
      }
    });

    return () => {
      appState.remove();
      unsubscribe();
    };
  }, []);
}
