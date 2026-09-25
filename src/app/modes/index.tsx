import { useFocusEffect, useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import {
  IconCircle,
  ListGroup,
  ListRow,
  NoticeCard,
  PageHeader,
  Screen,
  Sheet,
  StatusNote,
} from '../../design/components';
import { useAppStore, useModes, useRunningSession, useSchedules } from '../../data';
import type { Mode } from '../../data/types';
import { ModeCard } from '../../features/modes/ModeCard';
import { appsSource } from '../../features/modes/realBlocking';
import { useStrings } from '../../i18n';
import { status as blockingStatus } from '../../platform/blocking';

/** The list of modes. Tapping a card activates it; '…' duplicates or deletes. */
export default function ModesScreen() {
  const router = useRouter();
  const t = useStrings();
  const running = useRunningSession() !== null;
  const modes = useModes();
  const schedules = useSchedules();
  const activeModeId = useAppStore((state) => state.activeModeId);
  const setActiveMode = useAppStore((state) => state.setActiveMode);
  const duplicateMode = useAppStore((state) => state.duplicateMode);
  const deleteMode = useAppStore((state) => state.deleteMode);
  /** The mode whose options sheet is open. */
  const [menuFor, setMenuFor] = useState<Mode | null>(null);

  // What this phone can block, read again whenever the list comes back into view: the
  // user may have just granted the access, or picked real apps in the editor.
  const [blocking, setBlocking] = useState(() => blockingStatus());
  useFocusEffect(
    useCallback(() => {
      setBlocking(blockingStatus());
    }, []),
  );

  const confirmDelete = (mode: Mode) => {
    setMenuFor(null);
    const routines = schedules.filter((schedule) => schedule.modeId === mode.id).map((schedule) => schedule.name);
    Alert.alert(t.modes.deleteAlert.title(mode.name), t.modes.deleteAlert.message(routines), [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.modes.deleteAlert.confirm, style: 'destructive', onPress: () => deleteMode(mode.id) },
    ]);
  };

  return (
    <Screen scroll>
      <PageHeader
        onBack={() => goBack(router)}
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

      {running ? <StatusNote text={t.modes.list.readOnlyNotice} align="center" /> : null}

      {blocking.available || blocking.reason === null ? null : (
        <StatusNote text={t.modes.list.cannotBlock(blocking.reason)} icon="info" />
      )}

      {modes.length === 0 ? <NoticeCard tone="muted" body={t.modes.list.empty} /> : null}

      {modes.map((mode) => (
        <ModeCard
          key={mode.id}
          mode={mode}
          active={mode.id === activeModeId}
          source={appsSource(mode, blocking)}
          readOnly={running}
          onSelect={() => setActiveMode(mode.id)}
          onEdit={() => router.push({ pathname: '/modes/edit', params: { id: mode.id } })}
          onMore={() => setMenuFor(mode)}
        />
      ))}

      {running ? null : (
        <NoticeCard
          tone="muted"
          title={t.modes.list.ideasTitle}
          body={t.modes.list.ideasSubtitle}
          trailing="chevron"
          onPress={() => router.push('/modes/ideas')}
        />
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
