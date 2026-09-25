import { useAppStore, useSettings } from '../../data';
import { healthTypeFor } from '../../domain/habits';
import type { CountMode } from '../../domain/types';
import { requestAuthorization, status } from '../../platform/health';

/**
 * Saving a verified habit is the moment to ask for Health (ADR-0005: "el momento
 * correcto para pedir el permiso, no el onboarding"; rule 8), the same way joining a
 * challenge does (features/circle/useAskHealthToJoin.ts). Resolves once the sheet is
 * answered, or at once when there is nothing to ask: a declared habit, Health already
 * connected, a name nothing verifies, or no Health on this phone. Saying no still saves:
 * the habit stays verified and takes a manual tap until Health is connected.
 *
 * `needsAsking` lets the form show a busy label only when a sheet is really coming.
 */
export function useAskHealthForHabit(): {
  needsAsking: (name: string, countMode: CountMode) => boolean;
  ask: (name: string, countMode: CountMode) => Promise<void>;
} {
  const connected = useSettings().healthConnected;
  const updateSettings = useAppStore((state) => state.updateSettings);

  const needsAsking = (name: string, countMode: CountMode) =>
    countMode === 'verified' && !connected && healthTypeFor(name.trim()) !== null && status().available;

  const ask = async (name: string, countMode: CountMode) => {
    if (!needsAsking(name, countMode)) {
      return;
    }
    if (await requestAuthorization()) {
      updateSettings({ healthConnected: true });
    }
  };

  return { needsAsking, ask };
}
