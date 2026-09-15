import { useLocalSearchParams, useRouter } from 'expo-router';

import { APPS } from '../../data';
import { useModeDraftStore } from '../../data/modeDraft';
import { appsTitleText } from '../../data/modes';
import { SelectionPicker, type PickerItem } from '../../features/modes/SelectionPicker';

const ITEMS: ReadonlyArray<PickerItem> = APPS.map((app) => ({
  id: app.id,
  label: app.name,
  description: app.category,
  tile: { initial: app.initial, color: app.color },
}));

/**
 * Picks the apps of the mode draft. From onboarding (`onboarding=1`) it writes into
 * the same draft and continues to the Screen Time step instead of going back.
 */
export default function ModeAppsScreen() {
  const router = useRouter();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const behavior = useModeDraftStore((state) => state.behavior);
  const appIds = useModeDraftStore((state) => state.appIds);
  const toggleApp = useModeDraftStore((state) => state.toggleApp);
  const fromOnboarding = onboarding === '1';

  return (
    <SelectionPicker
      title={appsTitleText(behavior)}
      searchPlaceholder="Buscar apps"
      items={ITEMS}
      selectedIds={appIds}
      selectedTitle="Seleccionadas"
      listTitle="Todas"
      onToggle={toggleApp}
      onBack={() => router.back()}
      onDone={() => (fromOnboarding ? router.push('/onboarding/screen-time') : router.back())}
      doneLabel={fromOnboarding ? 'Continuar' : 'Listo'}
    />
  );
}
