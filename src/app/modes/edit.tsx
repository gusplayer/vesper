import { useLocalSearchParams, useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';
import { useState } from 'react';
import { Alert } from 'react-native';

import {
  AppIconStack,
  Button,
  Card,
  Chip,
  Divider,
  FieldRow,
  ListRow,
  PageHeader,
  Screen,
  Section,
  SegmentedControl,
  Stack,
  Text,
} from '../../design/components';
import { appsById, useActivities, useAppStore, useMode } from '../../data';
import { draftToMode, useModeDraftStore } from '../../data/modeDraft';
import type { ModeBehavior } from '../../data/types';
import { DepthCards } from '../../features/modes/DepthCards';
import { useStrings } from '../../i18n';
import { selectionSummaryText, status as blockingStatus } from '../../platform/blocking';

/**
 * New or existing mode. The form is the draft store, so the app and website pickers
 * (their own routes) write into it and this screen finds it as they left it.
 */
export default function ModeEditScreen() {
  const router = useRouter();
  const t = useStrings();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const mode = useMode(id);
  const activities = useActivities();
  const upsertMode = useAppStore((state) => state.upsertMode);
  const deleteMode = useAppStore((state) => state.deleteMode);
  // Loaded once, on arrival, before the first read of the draft below: a state
  // initializer runs exactly once per mount, and `load` is idempotent, so the first
  // render already shows this mode and the name field decides its autoFocus right.
  // Coming back from a picker keeps this screen mounted, so the draft the picker
  // edited is the one shown; later store changes never reload it.
  useState(() => useModeDraftStore.getState().load(mode));
  const draft = useModeDraftStore();
  const editing = draft.id !== null;

  const behaviors: readonly { value: ModeBehavior; label: string }[] = [
    { value: 'block', label: t.modes.edit.behaviorBlock },
    { value: 'allow', label: t.modes.edit.behaviorAllow },
  ];

  const apps = appsById(draft.appIds);
  const sites = draft.websiteIds.length;
  // Cheap and synchronous: a few flags, no native call unless the module is loaded.
  const blocking = blockingStatus();

  const save = () => {
    upsertMode(draftToMode(draft));
    goBack(router);
  };

  const confirmDelete = () => {
    if (draft.id === null) {
      return;
    }
    const modeId = draft.id;
    Alert.alert(t.modes.deleteAlert.title(draft.name), t.modes.deleteAlert.message, [
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
      {editing ? <Button variant="ghost" label={t.modes.edit.remove} onPress={confirmDelete} /> : null}
    </>
  );

  return (
    <Screen scroll footer={footer}>
      <PageHeader onBack={() => goBack(router)} title={editing ? t.modes.edit.editTitle : t.modes.edit.newTitle} />

      <FieldRow
        label={t.modes.edit.name}
        value={draft.name}
        onChangeText={draft.setName}
        placeholder={t.modes.edit.namePlaceholder}
        autoFocus={!editing}
      />

      <Card>
        <Stack gap="md">
          <Stack gap="xs">
            <Text variant="heading">{t.modes.edit.behavior}</Text>
            <Text variant="label" tone="secondary">
              {t.modes.edit.behaviorHint}
            </Text>
          </Stack>
          <SegmentedControl segments={behaviors} value={draft.behavior} onChange={draft.setBehavior} />
          <Divider />
          <ListRow
            label={t.modes.edit.apps}
            icon="smartphone"
            value={apps.length > 0 ? String(apps.length) : t.modes.edit.noApps}
            onPress={() => router.push({ pathname: '/modes/apps', params: { draft: '1' } })}
          />
          {apps.length > 0 ? <AppIconStack apps={apps} max={6} /> : null}
          {blocking.available || blocking.reason === null ? null : (
            <Text variant="caption" tone="secondary">
              {t.modes.apps.notReal(blocking.reason)}
            </Text>
          )}
          {blocking.available ? (
            <>
              <Divider />
              <ListRow
                label={t.modes.edit.realApps}
                icon="shield"
                value={selectionSummaryText(draft.selectionToken)}
                onPress={() => router.push({ pathname: '/modes/apps', params: { native: '1' } })}
              />
            </>
          ) : null}
          <Divider />
          <ListRow
            label={t.modes.edit.sites}
            icon="globe"
            value={sites > 0 ? String(sites) : t.common.none}
            onPress={() => router.push({ pathname: '/modes/websites', params: { draft: '1' } })}
          />
        </Stack>
      </Card>

      <Section title={t.modes.edit.depth}>
        <DepthCards value={draft.depth} onChange={draft.setDepth} />
      </Section>

      <Section title={t.modes.edit.activity}>
        <Stack direction="row" gap="sm" wrap>
          {activities.map((activity) => (
            <Chip
              key={activity.id}
              label={activity.label}
              selected={activity.id === draft.activityId}
              onPress={() => draft.setActivityId(activity.id)}
            />
          ))}
        </Stack>
        <Text variant="caption" tone="secondary">
          {t.modes.edit.activityHint}
        </Text>
      </Section>
    </Screen>
  );
}
