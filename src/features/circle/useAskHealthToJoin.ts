import { useAppStore, useSettings } from '../../data';
import { healthTypeFor } from '../../domain/habits';
import { requestAuthorization, status } from '../../platform/health';

/**
 * Joining a challenge Health can confirm is the moment to ask for Health (ADR-0042 §2,
 * rule 8). Resolves once the sheet is answered, or at once when there is nothing to
 * ask: Health already connected, a name nothing verifies, or no Health on this phone.
 * The habit the store links right after reads `healthConnected` and comes out verified
 * or declared; saying no still joins.
 */
export function useAskHealthToJoin(): (name: string) => Promise<void> {
  const connected = useSettings().healthConnected;
  const updateSettings = useAppStore((state) => state.updateSettings);
  return async (name) => {
    if (connected || healthTypeFor(name.trim()) === null || !status().available) {
      return;
    }
    if (await requestAuthorization()) {
      updateSettings({ healthConnected: true });
    }
  };
}
