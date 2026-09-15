import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import {
  Card,
  Icon,
  IconCircle,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Sheet,
  Stack,
  Text,
} from '../../design/components';
import { useAppStore, useModes } from '../../data';
import type { Mode } from '../../data/types';
import { ModeCard } from '../../features/modes/ModeCard';

/** The list of modes. Tapping a card activates it; '…' duplicates or deletes. */
export default function ModesScreen() {
  const router = useRouter();
  const modes = useModes();
  const activeModeId = useAppStore((state) => state.activeModeId);
  const setActiveMode = useAppStore((state) => state.setActiveMode);
  const duplicateMode = useAppStore((state) => state.duplicateMode);
  const deleteMode = useAppStore((state) => state.deleteMode);
  /** The mode whose options sheet is open. */
  const [menuFor, setMenuFor] = useState<Mode | null>(null);

  const confirmDelete = (mode: Mode) => {
    setMenuFor(null);
    Alert.alert(`¿Eliminar "${mode.name}"?`, 'Los horarios que usen este modo se apagarán.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteMode(mode.id) },
    ]);
  };

  return (
    <Screen scroll>
      <PageHeader
        onBack={() => router.back()}
        title="Modos"
        right={
          <IconCircle
            name="plus"
            onPress={() => router.push('/modes/edit')}
            accessibilityLabel="nuevo modo"
          />
        }
      />

      {modes.length === 0 ? (
        <Text variant="label" tone="secondary" align="center">
          Todavía no hay modos. Creá uno con el más, o elegí una idea.
        </Text>
      ) : null}

      {modes.map((mode) => (
        <ModeCard
          key={mode.id}
          mode={mode}
          active={mode.id === activeModeId}
          onSelect={() => setActiveMode(mode.id)}
          onEdit={() => router.push({ pathname: '/modes/edit', params: { id: mode.id } })}
          onMore={() => setMenuFor(mode)}
        />
      ))}

      <Card tone="muted" onPress={() => router.push('/modes/ideas')} accessibilityLabel="explorar ideas">
        <Stack direction="row" align="center" gap="md">
          <Stack gap="xs" grow>
            <Text weight="medium">Explorar ideas</Text>
            <Text variant="label" tone="secondary">
              Modos armados para enfocarte
            </Text>
          </Stack>
          <Icon name="chevron-right" size="sm" tone="secondary" />
        </Stack>
      </Card>

      <Sheet visible={menuFor !== null} title="Opciones" onClose={() => setMenuFor(null)}>
        {menuFor === null ? null : (
          <ListGroup>
            <ListRow
              label="Duplicar"
              icon="copy"
              right={null}
              onPress={() => {
                duplicateMode(menuFor.id);
                setMenuFor(null);
              }}
            />
            <ListRow
              label="Eliminar"
              icon="trash-2"
              tone="danger"
              right={null}
              onPress={() => confirmDelete(menuFor)}
            />
          </ListGroup>
        )}
      </Sheet>
    </Screen>
  );
}
