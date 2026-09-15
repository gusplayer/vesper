import { useEffect } from 'react';

import { useAppStore } from '../../data/stores/app';
import { useFocusStore } from '../../data/stores/focus';
import { plannedNotifications } from '../../domain/reminders';
import { hasPermission, status, syncScheduled } from '../notifications';

/**
 * Keeps the OS's scheduled notifications equal to what the stores imply. Subscribes
 * to the stores from outside — they never import the platform — and on every change
 * that can alter the plan recomputes it and hands it to the diff. Side effects only.
 *
 * Finishing a session removes its end notice from the plan, so the diff cancels it;
 * turning the permission or a preference off empties that kind, same mechanism.
 */

const DEBOUNCE_MS = 300;

async function syncNow(): Promise<void> {
  const app = useAppStore.getState();
  const focus = useFocusStore.getState();
  const allowed = app.settings.notificationsAllowed && (await hasPermission());
  const specs = plannedNotifications({
    session: focus.session,
    schedules: app.schedules,
    modes: app.modes,
    prefs: app.settings.notifications,
    allowed,
  });
  await syncScheduled(specs);
}

export function useNotificationSync(): void {
  useEffect(() => {
    if (!status().available) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        void syncNow();
      }, DEBOUNCE_MS);
    };

    void syncNow();

    const unsubscribeApp = useAppStore.subscribe((state, previous) => {
      if (
        state.schedules !== previous.schedules ||
        state.modes !== previous.modes ||
        state.settings.notifications !== previous.settings.notifications ||
        state.settings.notificationsAllowed !== previous.settings.notificationsAllowed
      ) {
        schedule();
      }
    });
    const unsubscribeFocus = useFocusStore.subscribe((state, previous) => {
      // Only the session's identity matters: editing its intention changes nothing here.
      if (state.session?.id !== previous.session?.id) {
        schedule();
      }
    });

    return () => {
      unsubscribeApp();
      unsubscribeFocus();
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, []);
}
