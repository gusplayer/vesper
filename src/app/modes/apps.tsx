import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useApps, useAppStore } from '../../data';
import { useModeDraftStore } from '../../data/modeDraft';
import { appsTitleText } from '../../data/modes';
import { Button, Card, PageHeader, Screen, Stack, Text , NativeHost } from '../../design/components';
import { SelectionPicker, type PickerItem } from '../../features/modes/SelectionPicker';
import { useStrings } from '../../i18n';
import { SelectionPicker as NativeSelectionPicker } from '../../platform/BlockingSelectionView';
import {
  isAuthorized,
  requestAuthorization,
  selectionSummaryText,
  status as blockingStatus,
} from '../../platform/blocking';
import { isAndroid } from '../../platform/capabilities';

/**
 * Picks the apps of the mode draft. From onboarding (`onboarding=1`) it writes into
 * the same draft and continues to the Screen Time step instead of going back.
 *
 * With `native=1` it shows Apple's own picker instead of the catalogue: the result is
 * an opaque Screen Time token stored on the mode, never a list of names (ADR-0004).
 * Where Screen Time is missing the screen says why and offers the way back.
 *
 * Android grants usage access outside the app, so the same screen also offers the way
 * in: the disclosure Play requires (`usage-access`, ADR-0046 §2) and, on the way back,
 * a fresh read of `status()`. It is offered only when the access is what is missing —
 * a build without the blocking module has nothing to grant.
 */
export default function ModeAppsScreen() {
  const router = useRouter();
  const t = useStrings();
  const { onboarding, native } = useLocalSearchParams<{ onboarding?: string; native?: string }>();
  const catalogue = useApps();
  const behavior = useModeDraftStore((state) => state.behavior);
  const appIds = useModeDraftStore((state) => state.appIds);
  const toggleApp = useModeDraftStore((state) => state.toggleApp);
  const draftId = useModeDraftStore((state) => state.id);
  const draftToken = useModeDraftStore((state) => state.selectionToken);
  const setSelectionToken = useModeDraftStore((state) => state.setSelectionToken);
  const setModeSelection = useAppStore((state) => state.setModeSelection);
  const fromOnboarding = onboarding === '1';
  const nativePicker = native === '1';

  // The catalogue follows the language; its categories are the row descriptions.
  const items = useMemo<readonly PickerItem[]>(
    () =>
      catalogue.map((app) => ({
        id: app.id,
        label: app.name,
        description: app.category,
        tile: { initial: app.initial, color: app.color },
      })),
    [catalogue],
  );

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

  // Android answers this in Settings, not in a dialog: whatever the user did over
  // there, the screen re-reads it the moment it comes back into view.
  useFocusEffect(
    useCallback(() => {
      if (isAndroid) {
        setReason(blockingStatus().reason);
      }
    }, []),
  );

  if (!nativePicker) {
    // The catalogue is a list of names, never a block: where the device cannot block
    // for real, the picker says so instead of letting the list pass for one (rule 8).
    const blocking = blockingStatus();
    return (
      <SelectionPicker
        notice={blocking.available || blocking.reason === null ? undefined : t.modes.apps.notReal(blocking.reason)}
        title={appsTitleText(behavior, t.modes)}
        searchPlaceholder={t.modes.apps.search}
        items={items}
        selectedIds={appIds}
        selectedTitle={t.modes.apps.selected}
        listTitle={t.modes.apps.all}
        onToggle={toggleApp}
        onBack={() => goBack(router)}
        onDone={() => (fromOnboarding ? router.push('/onboarding/screen-time') : goBack(router))}
        doneLabel={fromOnboarding ? t.common.continue : t.common.done}
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
    goBack(router);
  };

  if (reason !== null) {
    // Only the two Android toggles can be granted from here; every other reason
    // (no module, no entitlement, a simulator) is a fact, not a permission.
    const canGrant =
      isAndroid &&
      (reason === t.modes.blocking.androidNoUsageAccess || reason === t.modes.blocking.androidNoOverlay);
    return (
      <Screen
        footer={
          <>
            {canGrant ? (
              <Button label={t.modes.usageAccess.grant} onPress={() => router.push('/usage-access')} />
            ) : null}
            <Button variant="ghost" label={t.common.back} onPress={() => goBack(router)} />
          </>
        }
      >
        <PageHeader onBack={() => goBack(router)} title={t.modes.apps.realTitle} />
        <Card>
          <Stack gap="xs">
            <Text variant="heading">{canGrant ? t.modes.usageAccess.title : t.modes.apps.unavailable}</Text>
            <Text variant="label" tone="secondary">
              {reason}
            </Text>
          </Stack>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll footer={<Button label={t.common.done} onPress={done} />}>
      <PageHeader onBack={() => goBack(router)} title={t.modes.apps.realTitle} />
      <Text variant="label" tone="secondary">
        {t.modes.apps.realHint}
      </Text>
      <Card padded={false}>
        <NativeHost>
          <NativeSelectionPicker token={token} onChange={setToken} />
        </NativeHost>
      </Card>
      <Text variant="caption" tone="tertiary" align="center">
        {t.modes.apps.selectedSummary(selectionSummaryText(token))}
      </Text>
    </Screen>
  );
}
