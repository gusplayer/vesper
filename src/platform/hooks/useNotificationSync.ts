import { useEffect } from 'react';

import { challengeReminders } from '../../data/challenges';
import { readStreak } from '../../data/streak';
import { useAppStore } from '../../data/stores/app';
import { useCircleStore } from '../../data/stores/circle';
import { useFocusStore } from '../../data/stores/focus';
import { plannedNotifications } from '../../domain/reminders';
import { getStrings, useLocaleStore } from '../../i18n';
import { hasPermission, status, syncScheduled } from '../notifications';

/**
 * Keeps the OS's scheduled notifications equal to what the stores imply. Subscribes
 * to the stores from outside — they never import the platform — and on every change
 * that can alter the plan recomputes it and hands it to the diff. Side effects only.
 *
 * Finishing a session removes its end notice from the plan, so the diff cancels it;
 * turning the permission or a preference off empties that kind, same mechanism.
 * Starting a session empties every kind but the session's own (ADR-0027 §1), and
 * closing one changes whether today counts, so the daily notices are remade then too.
 */

const DEBOUNCE_MS = 300;

/** A profile with at least one accepted member: the reactivation notice mentions the circle. */
function hasCircle(): boolean {
  const circle = useCircleStore.getState();
  return circle.profile !== null && circle.members.some((member) => member.status === 'member');
}

async function syncNow(): Promise<void> {
  const app = useAppStore.getState();
  const focus = useFocusStore.getState();
  const allowed = app.settings.notificationsAllowed && (await hasPermission());
  const now = Date.now();
  const specs = plannedNotifications(
    {
      session: focus.session,
      schedules: app.schedules,
      modes: app.modes,
      prefs: app.settings.notifications,
      allowed,
      now,
      streak: readStreak(now),
      lastOpenedAt: app.settings.lastOpenedAt,
      hasCircle: hasCircle(),
      challenges: challengeReminders(useCircleStore.getState().challenges, app.habitMarks, now),
    },
    // The reminders speak the language the app is in right now.
    getStrings().notifications,
  );
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
        state.settings.notificationsAllowed !== previous.settings.notificationsAllowed ||
        // A new open moves the reactivation pair; a grace day applied changes the streak.
        state.settings.lastOpenedAt !== previous.settings.lastOpenedAt ||
        state.graceDays !== previous.graceDays ||
        // Marking a habit can be marking a challenge, which silences today's notice.
        state.habitMarks !== previous.habitMarks
      ) {
        schedule();
      }
    });
    // A language change rewrites every pending reminder.
    const unsubscribeLocale = useLocaleStore.subscribe(() => schedule());
    const unsubscribeFocus = useFocusStore.subscribe((state, previous) => {
      // The identity and the breaks matter: a break moves the end and adds its own
      // notice. A closed session changes today's focus, so the daily notices too.
      // Editing the intention changes nothing here.
      if (
        state.session?.id !== previous.session?.id ||
        state.session?.breakStartedAt !== previous.session?.breakStartedAt ||
        state.session?.breakMs !== previous.session?.breakMs ||
        state.lastClosed !== previous.lastClosed
      ) {
        schedule();
      }
    });
    // Joining or leaving a circle changes what the reactivation notice says, and a
    // challenge that moves changes the risk notice.
    const unsubscribeCircle = useCircleStore.subscribe((state, previous) => {
      if (
        state.profile !== previous.profile ||
        state.members !== previous.members ||
        // Joining, leaving or creating a challenge changes what can slip away today.
        state.challenges !== previous.challenges
      ) {
        schedule();
      }
    });

    return () => {
      unsubscribeApp();
      unsubscribeLocale();
      unsubscribeFocus();
      unsubscribeCircle();
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, []);
}
