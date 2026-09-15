import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { ACTIVITIES, appsById, useAppStore, useMode } from '../../data';
import { draftToMode, useModeDraftStore } from '../../data/modeDraft';
import type { ModeBehavior } from '../../data/types';
import { DepthCards } from '../../features/modes/DepthCards';
import { selectionSummaryText, status as blockingStatus } from '../../platform/blocking';

const BEHAVIORS: ReadonlyArray<{ value: ModeBehavior; label: string }> = [
  { value: 'block', label: 'Bloquear seleccionadas' },
  { value: 'allow', label: 'Permitir solo seleccionadas' },
];

/**
 * New or existing mode. The form is the draft store, so the app and website pickers
 * (their own routes) write into it and this screen finds it as they left it.
 */
export default function ModeEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const mode = useMode(id);
  const upsertMode = useAppStore((state) => state.upsertMode);
  const deleteMode = useAppStore((state) => state.deleteMode);
  const draft = useModeDraftStore();
  const editing = draft.id !== null;
  // Loaded once, on arrival. Coming back from a picker keeps this screen mounted, so
  // the draft the picker edited is the one shown.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    useModeDraftStore.getState().load(mode);
    setReady(true);
    // Only on mount, on purpose: later store changes must not reload the draft.
  }, []);

  if (!ready) {
    return null;
  }

  const apps = appsById(draft.appIds);
  const sites = draft.websiteIds.length;
  // Cheap and synchronous: a few flags, no native call unless the module is loaded.
  const blocking = blockingStatus();

  const save = () => {
    upsertMode(draftToMode(draft));
    router.back();
  };

  const confirmDelete = () => {
    if (draft.id === null) {
      return;
    }
    const modeId = draft.id;
    Alert.alert(`¿Eliminar "${draft.name}"?`, 'Las rutinas que usen este modo se apagarán.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          deleteMode(modeId);
          router.back();
        },
      },
    ]);
  };

  const footer = (
    <>
      <Button label="Guardar modo" onPress={save} disabled={draft.name.trim() === ''} />
      {editing ? <Button variant="ghost" label="Eliminar modo" onPress={confirmDelete} /> : null}
    </>
  );

  return (
    <Screen scroll footer={footer}>
      <PageHeader onBack={() => router.back()} title={editing ? 'Editar modo' : 'Nuevo modo'} />

      <FieldRow
        label="Nombre"
        value={draft.name}
        onChangeText={draft.setName}
        placeholder="Sin redes"
        autoFocus={!editing}
      />

      <Card>
        <Stack gap="md">
          <Stack gap="xs">
            <Text variant="heading">Comportamiento</Text>
            <Text variant="label" tone="secondary">
              Elige qué se limita mientras estás enfocado
            </Text>
          </Stack>
          <SegmentedControl segments={BEHAVIORS} value={draft.behavior} onChange={draft.setBehavior} />
          <Divider />
          <ListRow
            label="Apps"
            icon="smartphone"
            value={apps.length > 0 ? String(apps.length) : 'Ninguna'}
            onPress={() => router.push({ pathname: '/modes/apps', params: { draft: '1' } })}
          />
          {apps.length > 0 ? <AppIconStack apps={apps} max={6} /> : null}
          {blocking.available ? (
            <>
              <Divider />
              <ListRow
                label="Apps reales (Tiempo de uso)"
                icon="shield"
                value={selectionSummaryText(draft.selectionToken)}
                onPress={() => router.push({ pathname: '/modes/apps', params: { native: '1' } })}
              />
            </>
          ) : null}
          <Divider />
          <ListRow
            label="Sitios"
            icon="globe"
            value={sites > 0 ? String(sites) : 'Ninguno'}
            onPress={() => router.push({ pathname: '/modes/websites', params: { draft: '1' } })}
          />
        </Stack>
      </Card>

      <Section title="Profundidad">
        <DepthCards value={draft.depth} onChange={draft.setDepth} />
      </Section>

      <Section title="Actividad">
        <Stack direction="row" gap="sm" wrap>
          {ACTIVITIES.map((activity) => (
            <Chip
              key={activity.id}
              label={activity.label}
              selected={activity.id === draft.activityId}
              onPress={() => draft.setActivityId(activity.id)}
            />
          ))}
        </Stack>
        <Text variant="caption" tone="secondary">
          A qué se acredita el tiempo de este modo en el día
        </Text>
      </Section>
    </Screen>
  );
}
