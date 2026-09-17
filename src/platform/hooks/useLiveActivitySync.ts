import { useEffect } from 'react';

import { useAppStore } from '../../data/stores/app';
import { useFocusStore } from '../../data/stores/focus';
import { getStrings } from '../../i18n';
import { endFocus, startFocus, status, updateFocus, type FocusInput } from '../liveActivity';
import { focusInputFor } from '../liveActivityProps';

/**
 * Keeps the lock screen in step with the session. Subscribes to the stores from
 * outside — they never import the platform — and shows, refreshes or removes the
 * Live Activity as the session and the setting change. Side effects only.
 *
 * The activity follows one identity: the id of the session it shows. A session that
 * is already running when this mounts (hydrated from a previous launch) is shown on
 * the spot; turning the setting off ends it and turning it back on brings it back.
 *
 * There is no timer here. The activity's clocks are native and count from the
 * interval they were given (ADR-0023); an update goes out only when the interval or
 * the words change: a break starts or ends, the mode is renamed.
 */

function currentInput(): FocusInput | null {
  const { session, modeId } = useFocusStore.getState();
  if (session === null) {
    return null;
  }
  const mode = useAppStore.getState().modes.find((m) => m.id === modeId);
  // A session whose mode was deleted meanwhile still needs a name.
  return focusInputFor(session, mode?.name ?? getStrings().session.liveActivity.fallbackModeName);
}

export function useLiveActivitySync(): void {
  useEffect(() => {
    if (!status().available) {
      return;
    }

    let shownSessionId: string | null = null;

    const refresh = () => {
      const input = currentInput();
      if (input !== null) {
        updateFocus(input);
      }
    };

    const stop = () => {
      shownSessionId = null;
      void endFocus();
    };

    const sync = () => {
      const enabled = useAppStore.getState().settings.liveActivities;
      const session = useFocusStore.getState().session;
      const wanted = enabled && session !== null ? session.id : null;
      if (wanted === shownSessionId) {
        return;
      }
      if (shownSessionId !== null) {
        stop();
      }
      if (wanted !== null) {
        const input = currentInput();
        if (input !== null) {
          startFocus(input);
          shownSessionId = wanted;
        }
      }
    };

    sync();

    const unsubscribeFocus = useFocusStore.subscribe((state, previous) => {
      // The identity decides whether there is an activity; a break changes what it shows.
      if (state.session?.id !== previous.session?.id) {
        sync();
      } else if (
        state.session?.breakStartedAt !== previous.session?.breakStartedAt ||
        state.session?.breakMs !== previous.session?.breakMs
      ) {
        refresh();
      }
    });
    const unsubscribeApp = useAppStore.subscribe((state, previous) => {
      if (state.settings.liveActivities !== previous.settings.liveActivities) {
        sync();
      } else if (state.modes !== previous.modes && shownSessionId !== null) {
        // The mode may have been renamed under the running session.
        refresh();
      }
    });

    return () => {
      unsubscribeFocus();
      unsubscribeApp();
      if (shownSessionId !== null) {
        stop();
      }
    };
  }, []);
}
