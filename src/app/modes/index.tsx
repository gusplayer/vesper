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
import { useAppStore, useModes, useRunningSession } from '../../data';
import type { Mode } from '../../data/types';
import { ModeCard } from '../../features/modes/ModeCard';
import { useStrings } from '../../i18n';

/** The list of modes. Tapping a card activates it; '…' duplicates or deletes. */
export default function ModesScreen() {
  const router = useRouter();
  const t = useStrings();
  const running = useRunningSession() !== null;
  const modes = useModes();
  const activeModeId = useAppStore((state) => state.activeModeId);
  const setActiveMode = useAppStore((state) => state.setActiveMode);
  const duplicateMode = useAppStore((state) => state.duplicateMode);
  const deleteMode = useAppStore((state) => state.deleteMode);
  /** The mode whose options sheet is open. */
  const [menuFor, setMenuFor] = useState<Mode | null>(null);

  const confirmDelete = (mode: Mode) => {
    setMenuFor(null);
    Alert.alert(t.modes.deleteAlert.title(mode.name), t.modes.deleteAlert.message, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.modes.deleteAlert.confirm, style: 'destructive', onPress: () => deleteMode(mode.id) },
    ]);
  };

  return (
    <Screen scroll>
      <PageHeader
        onBack={() => router.back()}
        title={t.modes.list.title}
        right={
          running ? undefined : (
            <IconCircle
              name="plus"
              onPress={() => router.push('/modes/edit')}
              accessibilityLabel={t.modes.list.newModeA11y}
            />
          )
        }
      />

      {running ? (
        <Text variant="label" tone="secondary" align="center">
          {t.modes.list.readOnlyNotice}
        </Text>
      ) : null}

      {modes.length === 0 ? (
        <Text variant="label" tone="secondary" align="center">
          {t.modes.list.empty}
        </Text>
      ) : null}

      {modes.map((mode) => (
        <ModeCard
          key={mode.id}
          mode={mode}
          active={mode.id === activeModeId}
          readOnly={running}
          onSelect={() => setActiveMode(mode.id)}
          onEdit={() => router.push({ pathname: '/modes/edit', params: { id: mode.id } })}
          onMore={() => setMenuFor(mode)}
        />
      ))}

      {running ? null : (
      <Card tone="muted" onPress={() => router.push('/modes/ideas')} accessibilityLabel={t.modes.list.ideasA11y}>
        <Stack direction="row" align="center" gap="md">
          <Stack gap="xs" grow>
            <Text weight="medium">{t.modes.list.ideasTitle}</Text>
            <Text variant="label" tone="secondary">
              {t.modes.list.ideasSubtitle}
            </Text>
          </Stack>
          <Icon name="chevron-right" size="sm" tone="secondary" />
        </Stack>
      </Card>
      )}

      <Sheet visible={menuFor !== null} title={t.modes.list.options} onClose={() => setMenuFor(null)}>
        {menuFor === null ? null : (
          <ListGroup>
            <ListRow
              label={t.modes.list.duplicate}
              icon="copy"
              right={null}
              onPress={() => {
                duplicateMode(menuFor.id);
                setMenuFor(null);
              }}
            />
            <ListRow
              label={t.modes.list.remove}
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
