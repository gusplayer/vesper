import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { APPS, useAppStore } from '../../data';
import { useModeDraftStore } from '../../data/modeDraft';
import { appsTitleText } from '../../data/modes';
import { Button, Card, PageHeader, Screen, Stack, Text } from '../../design/components';
import { NativeHost } from '../../design/components';
import { SelectionPicker, type PickerItem } from '../../features/modes/SelectionPicker';
import { SelectionPicker as NativeSelectionPicker } from '../../platform/BlockingSelectionView';
import {
  isAuthorized,
  requestAuthorization,
  selectionSummaryText,
  status as blockingStatus,
} from '../../platform/blocking';

const ITEMS: ReadonlyArray<PickerItem> = APPS.map((app) => ({
  id: app.id,
  label: app.name,
  description: app.category,
  tile: { initial: app.initial, color: app.color },
}));

/**
 * Picks the apps of the mode draft. From onboarding (`onboarding=1`) it writes into
 * the same draft and continues to the Screen Time step instead of going back.
 *
 * With `native=1` it shows Apple's own picker instead of the catalogue: the result is
 * an opaque Screen Time token stored on the mode, never a list of names (ADR-0004).
 * Where Screen Time is missing the screen says why and offers the way back.
 */
export default function ModeAppsScreen() {
  const router = useRouter();
  const { onboarding, native } = useLocalSearchParams<{ onboarding?: string; native?: string }>();
  const behavior = useModeDraftStore((state) => state.behavior);
  const appIds = useModeDraftStore((state) => state.appIds);
  const toggleApp = useModeDraftStore((state) => state.toggleApp);
  const draftId = useModeDraftStore((state) => state.id);
  const draftToken = useModeDraftStore((state) => state.selectionToken);
  const setSelectionToken = useModeDraftStore((state) => state.setSelectionToken);
  const setModeSelection = useAppStore((state) => state.setModeSelection);
  const fromOnboarding = onboarding === '1';
  const nativePicker = native === '1';

  // The token the native picker is editing. Starts from the draft and is written back
  // on "Listo", like the catalogue's ids are written on each toggle.
  const [token, setToken] = useState<string | null>(draftToken);
  // The picker is blank until iOS has said yes; ask the first time it opens here.
  const [reason, setReason] = useState<string | null>(blockingStatus().reason);
  useEffect(() => {
    if (!nativePicker || reason !== null || isAuthorized()) {
      return;
    }
    let alive = true;
    void requestAuthorization().then(() => {
      if (alive) {
        setReason(blockingStatus().reason);
      }
    });
    return () => {
      alive = false;
    };
  }, [nativePicker, reason]);

  if (!nativePicker) {
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

  const done = () => {
    setSelectionToken(token);
    if (draftId !== null) {
      // An existing mode keeps its real selection even if the edit is abandoned: the
      // token comes from a system dialog and is not worth making the user redo.
      setModeSelection(draftId, token);
    }
    router.back();
  };

  if (reason !== null) {
    return (
      <Screen footer={<Button variant="ghost" label="Volver" onPress={() => router.back()} />}>
        <PageHeader onBack={() => router.back()} title="Apps reales" />
        <Card>
          <Stack gap="xs">
            <Text variant="heading">Tiempo de uso no está disponible</Text>
            <Text variant="label" tone="secondary">
              {reason}
            </Text>
          </Stack>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll footer={<Button label="Listo" onPress={done} />}>
      <PageHeader onBack={() => router.back()} title="Apps reales" />
      <Text variant="label" tone="secondary">
        Elegí en Tiempo de uso qué apps, categorías y sitios limita este modo. Vesper guarda
        la selección sin ver qué hay adentro.
      </Text>
      <Card padded={false}>
        <NativeHost>
          <NativeSelectionPicker token={token} onChange={setToken} />
        </NativeHost>
      </Card>
      <Text variant="caption" tone="tertiary" align="center">
        {`Seleccionadas: ${selectionSummaryText(token)}`}
      </Text>
    </Screen>
  );
}
