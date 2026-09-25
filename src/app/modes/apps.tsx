import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useApps, useAppStore } from '../../data';
import { useModeDraftStore } from '../../data/modeDraft';
import { appsTitleText } from '../../data/modes';
import { Button, Card, NativeHost, NoticeCard, PageHeader, Screen, StatusNote, Text } from '../../design/components';
import { packageNamesFromToken, tokenFromPackageNames } from '../../domain/packageSelection';
import { grantableToggle, hasRealPicker } from '../../features/modes/realBlocking';
import { SelectionPicker, type PickerItem } from '../../features/modes/SelectionPicker';
import { useLaunchableApps } from '../../features/modes/useLaunchableApps';
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
 * Picks the apps of the mode draft: one list per mode (ADR-0047 §2).
 *
 * Where the phone can block, or the access can be given from the app, it is the real
 * selection, the only thing a session blocks; `native=1` asks for it explicitly, and a
 * phone with a real picker never shows the catalogue. On iOS,
 * Apple's own picker: the result is an opaque Screen Time token, never a list of names
 * (ADR-0004). On Android, the phone's launchable apps in the same full-page picker as
 * the catalogue, with their real icons. Either way every change is written at once, to
 * the draft and to the saved mode, so going back never loses a pick.
 *
 * Where no real picker exists (simulator, iPhone without the entitlement, a build
 * without the module) it is the catalogue: a list of names that never blocks anything,
 * so it says it is an example, with the reason.
 *
 * Where the real picker was asked for and is missing the screen says why. On Android it also offers the
 * way in when what is missing is a Settings toggle: usage access through the
 * disclosure Play requires (`usage-access`, ADR-0046 §2), the overlay directly, and on
 * the way back a fresh read of `status()`.
 */
export default function ModeAppsScreen() {
  const router = useRouter();
  const t = useStrings();
  const { native } = useLocalSearchParams<{ native?: string }>();
  const catalogue = useApps();
  const behavior = useModeDraftStore((state) => state.behavior);
  const appIds = useModeDraftStore((state) => state.appIds);
  const toggleApp = useModeDraftStore((state) => state.toggleApp);
  const draftId = useModeDraftStore((state) => state.id);
  const draftToken = useModeDraftStore((state) => state.selectionToken);
  const setSelectionToken = useModeDraftStore((state) => state.setSelectionToken);
  const setModeSelection = useAppStore((state) => state.setModeSelection);
  const [blocking, setBlocking] = useState(() => blockingStatus());
  const [busy, setBusy] = useState(false);
  const nativePicker = native === '1' || hasRealPicker(blocking);

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

  // The iOS picker is blank until iOS has said yes; ask the first time it opens here.
  // On Android `isAuthorized` is the same as `available`, so this never runs there.
  useEffect(() => {
    if (!nativePicker || !blocking.available || isAuthorized()) {
      return undefined;
    }
    let alive = true;
    void requestAuthorization().then(() => {
      if (alive) {
        setBlocking(blockingStatus());
      }
    });
    return () => {
      alive = false;
    };
  }, [nativePicker, blocking.available]);

  // Android answers in Settings, not in a dialog: whatever the user did over there,
  // the screen re-reads it the moment it comes back into view.
  useFocusEffect(
    useCallback(() => {
      if (isAndroid) {
        setBlocking(blockingStatus());
      }
    }, []),
  );

  const launchable = useLaunchableApps(isAndroid && nativePicker && blocking.available);

  if (!nativePicker) {
    return (
      <SelectionPicker
        notice={blocking.reason === null ? undefined : t.modes.apps.notReal(blocking.reason)}
        title={appsTitleText(behavior, t.modes)}
        searchPlaceholder={t.modes.apps.search}
        items={items}
        selectedIds={appIds}
        selectedTitle={t.modes.apps.selected}
        listTitle={t.modes.apps.all}
        onToggle={toggleApp}
        onBack={() => goBack(router)}
        onDone={() => goBack(router)}
        fullTip={t.modes.apps.fullTip}
      />
    );
  }

  // Every change goes straight to the draft and, for a saved mode, to the mode: the
  // selection comes from a system list and is not worth making the user redo because
  // the edit was abandoned, or because they left with the back arrow.
  const writeToken = (next: string | null) => {
    setSelectionToken(next);
    if (draftId !== null) {
      setModeSelection(draftId, next);
    }
  };

  if (!blocking.available) {
    const missing = grantableToggle(blocking);
    const allowOverlay = async () => {
      setBusy(true);
      await requestAuthorization();
      setBusy(false);
      setBlocking(blockingStatus());
    };
    const heading =
      missing === 'usageAccess'
        ? t.modes.usageAccess.title
        : missing === 'overlay'
          ? t.modes.usageAccess.overlay.missing
          : isAndroid
            ? t.modes.apps.unavailableAndroid
            : t.modes.apps.unavailable;
    const body =
      missing === 'overlay'
        ? t.modes.usageAccess.overlay.body
        : blocking.reason === null
          ? null
          : t.modes.apps.unavailableReason(blocking.reason);
    const footer =
      missing === 'usageAccess' ? (
        <Button label={t.modes.usageAccess.grant} onPress={() => router.push('/usage-access')} />
      ) : missing === 'overlay' ? (
        <Button
          label={t.modes.usageAccess.overlay.allow}
          busyLabel={t.modes.usageAccess.opening}
          busy={busy}
          onPress={() => void allowOverlay()}
        />
      ) : undefined;
    return (
      <Screen footer={footer}>
        <PageHeader onBack={() => goBack(router)} title={appsTitleText(behavior, t.modes)} />
        <NoticeCard icon={missing === null ? 'slash' : 'shield'} title={heading} body={body ?? undefined} />
      </Screen>
    );
  }

  if (isAndroid) {
    const selected = packageNamesFromToken(draftToken);
    const toggle = (packageName: string) => {
      const next = selected.includes(packageName)
        ? selected.filter((name) => name !== packageName)
        : [...selected, packageName];
      writeToken(tokenFromPackageNames(next));
    };
    return (
      <SelectionPicker
        notice={t.modes.apps.realHintAndroid}
        title={appsTitleText(behavior, t.modes)}
        searchPlaceholder={t.modes.apps.search}
        items={launchable ?? []}
        loading={launchable === null}
        selectedIds={selected}
        selectedTitle={t.modes.apps.selected}
        listTitle={t.modes.apps.all}
        onToggle={toggle}
        onBack={() => goBack(router)}
        onDone={() => goBack(router)}
        fullTip={t.modes.apps.fullTip}
      />
    );
  }

  return (
    <Screen scroll footer={<Button label={t.common.done} onPress={() => goBack(router)} />}>
      <PageHeader onBack={() => goBack(router)} title={appsTitleText(behavior, t.modes)} />
      <Text variant="label" tone="secondary">
        {t.modes.apps.realHint}
      </Text>
      <Card padded={false}>
        <NativeHost>
          <NativeSelectionPicker token={draftToken} onChange={writeToken} />
        </NativeHost>
      </Card>
      <StatusNote text={t.modes.apps.selectedSummary(selectionSummaryText(draftToken))} align="center" live />
    </Screen>
  );
}
