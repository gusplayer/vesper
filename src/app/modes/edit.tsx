import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';
import { useCallback, useState } from 'react';
import { Alert, BackHandler } from 'react-native';

import {
  AppIconStack,
  Button,
  Card,
  ChipGroup,
  Divider,
  FieldRow,
  ListRow,
  PageHeader,
  Screen,
  Section,
  SegmentedControl,
  Stack,
  StatusNote,
} from '../../design/components';
import { appsById, useActivities, useAppStore, useMode, useSchedules } from '../../data';
import { draftToMode, useModeDraftStore, type ModeDraft } from '../../data/modeDraft';
import type { ModeBehavior } from '../../data/types';
import { DepthCards } from '../../features/modes/DepthCards';
import { hasRealPicker, showsSites } from '../../features/modes/realBlocking';
import { useStrings } from '../../i18n';
import { selectionSummaryText, status as blockingStatus } from '../../platform/blocking';
import { isAndroid } from '../../platform/capabilities';

/** The fields a user edits by hand. The real selection of a saved mode is saved as it is picked. */
function sameDraft(a: ModeDraft, b: ModeDraft): boolean {
  return (
    a.name === b.name &&
    a.behavior === b.behavior &&
    a.depth === b.depth &&
    a.activityId === b.activityId &&
    a.appIds.join() === b.appIds.join() &&
    a.websiteIds.join() === b.websiteIds.join() &&
    (a.id !== null || a.selectionToken === b.selectionToken)
  );
}

function snapshot(draft: ModeDraft): ModeDraft {
  return {
    id: draft.id,
    name: draft.name,
    behavior: draft.behavior,
    appIds: [...draft.appIds],
    websiteIds: [...draft.websiteIds],
    depth: draft.depth,
    activityId: draft.activityId,
    selectionToken: draft.selectionToken,
  };
}

/**
 * New or existing mode. The form is the draft store, so the app and website pickers
 * (their own routes) write into it and this screen finds it as they left it.
 *
 * One app list per mode (ADR-0047 §2). Where the phone can block, or the access can be
 * given from the app, "Apps" opens the real picker (`modes/apps?native=1`, which also
 * offers the access on Android) and the catalogue does not show; the sites are chosen
 * with the apps on an iPhone and do not exist on Android. Anywhere else the catalogue
 * and its sites stand in, labelled as an example, under the reason this phone cannot
 * block. A mode with nothing picked is a valid choice: nothing here asks for apps.
 */
export default function ModeEditScreen() {
  const router = useRouter();
  const t = useStrings();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const mode = useMode(id);
  const activities = useActivities();
  const schedules = useSchedules();
  const upsertMode = useAppStore((state) => state.upsertMode);
  const deleteMode = useAppStore((state) => state.deleteMode);
  // Loaded once, on arrival, before the first read of the draft below: a state
  // initializer runs exactly once per mount, and `load` is idempotent, so the first
  // render already shows this mode and the name field decides its autoFocus right.
  // Coming back from a picker keeps this screen mounted, so the draft the picker
  // edited is the one shown; later store changes never reload it. The snapshot is what
  // "unsaved changes" is measured against.
  const [loaded] = useState(() => {
    useModeDraftStore.getState().load(mode);
    return snapshot(useModeDraftStore.getState());
  });
  const draft = useModeDraftStore();
  const editing = draft.id !== null;

  // What this phone can block, read again whenever the screen comes back into view:
  // the user may have granted the access in Settings on the way.
  const [blocking, setBlocking] = useState(() => blockingStatus());
  useFocusEffect(
    useCallback(() => {
      setBlocking(blockingStatus());
    }, []),
  );

  const behaviors: readonly { value: ModeBehavior; label: string }[] = [
    { value: 'block', label: t.modes.edit.behaviorBlock },
    { value: 'allow', label: t.modes.edit.behaviorAllow },
  ];

  const apps = appsById(draft.appIds);
  const sites = draft.websiteIds.length;
  const real = hasRealPicker(blocking);
  const usedBy = editing ? schedules.filter((schedule) => schedule.modeId === draft.id) : [];
  const dirty = !sameDraft(draft, loaded);

  const save = () => {
    upsertMode(draftToMode(draft));
    goBack(router);
  };

  const leave = useCallback(() => {
    if (!dirty) {
      goBack(router);
      return;
    }
    Alert.alert(t.modes.edit.discardTitle, t.modes.edit.discardMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.modes.edit.discardConfirm, style: 'destructive', onPress: () => goBack(router) },
    ]);
  }, [dirty, router, t]);

  // Android's back button asks the same question as the chevron.
  useFocusEffect(
    useCallback(() => {
      if (!isAndroid) {
        return undefined;
      }
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!dirty) {
          return false;
        }
        leave();
        return true;
      });
      return () => subscription.remove();
    }, [dirty, leave]),
  );

  const confirmDelete = () => {
    if (draft.id === null) {
      return;
    }
    const modeId = draft.id;
    // The saved name: the field may be half edited, or empty.
    const name = mode?.name ?? draft.name;
    Alert.alert(t.modes.deleteAlert.title(name), t.modes.deleteAlert.message(usedBy.map((schedule) => schedule.name)), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.modes.deleteAlert.confirm,
        style: 'destructive',
        onPress: () => {
          deleteMode(modeId);
          goBack(router);
        },
      },
    ]);
  };

  const footer = (
    <>
      <Button label={t.modes.edit.save} onPress={save} disabled={draft.name.trim() === ''} />
      {editing ? <Button variant="ghost" tone="danger" label={t.modes.edit.remove} onPress={confirmDelete} /> : null}
    </>
  );

  return (
    <Screen scroll avoidKeyboard footer={footer}>
      <PageHeader onBack={leave} title={editing ? t.modes.edit.editTitle : t.modes.edit.newTitle} />

      <FieldRow
        label={t.modes.edit.name}
        value={draft.name}
        onChangeText={draft.setName}
        placeholder={t.modes.edit.namePlaceholder}
        autoFocus={!editing}
      />

      <Section title={t.modes.edit.behavior}>
        <Card>
          <Stack gap="md">
            <StatusNote text={t.modes.edit.behaviorHint} />
            <SegmentedControl segments={behaviors} value={draft.behavior} onChange={draft.setBehavior} />
            <Divider />
            {real ? (
              <ListRow
                label={t.modes.edit.apps}
                icon="smartphone"
                value={blocking.available ? selectionSummaryText(draft.selectionToken) : t.modes.edit.realAppsNoAccess}
                onPress={() => router.push({ pathname: '/modes/apps', params: { native: '1' } })}
              />
            ) : (
              <ListRow
                label={t.modes.edit.apps}
                icon="smartphone"
                value={apps.length > 0 ? String(apps.length) : t.modes.edit.noApps}
                onPress={() => router.push('/modes/apps')}
              />
            )}
            {!real && apps.length > 0 ? <AppIconStack apps={apps} max={6} /> : null}
            {blocking.available || blocking.reason === null ? null : (
              <StatusNote
                text={real ? t.modes.list.cannotBlock(blocking.reason) : t.modes.apps.notReal(blocking.reason)}
                icon="info"
              />
            )}
            {showsSites(blocking) ? (
              <>
                <Divider />
                <ListRow
                  label={t.modes.edit.sites}
                  icon="globe"
                  value={sites > 0 ? String(sites) : t.common.none}
                  onPress={() => router.push('/modes/websites')}
                />
              </>
            ) : null}
          </Stack>
        </Card>
      </Section>

      <Section title={t.modes.edit.depth}>
        <DepthCards value={draft.depth} onChange={draft.setDepth} />
        {usedBy.length > 0 ? <StatusNote text={t.modes.edit.usedBy(usedBy.map((schedule) => schedule.name))} /> : null}
      </Section>

      <Section title={t.modes.edit.activity}>
        <ChipGroup
          accessibilityLabel={t.modes.edit.activity}
          options={activities.map((activity) => ({ value: activity.id, label: activity.label }))}
          value={draft.activityId}
          onChange={draft.setActivityId}
        />
        <StatusNote text={t.modes.edit.activityHint} />
      </Section>
    </Screen>
  );
}
