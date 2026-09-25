import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Share } from 'react-native';

import { useIdentityStore } from '../../data/identity';
import { Button, Card, ListGroup, ListRow, PageHeader, Screen, Section, Stack, StatusNote, Text } from '../../design/components';
import { refreshRecoveryAccount, useRecoveryAccount } from '../../features/recovery/recoveryAccount';
import { isLeftBehind, recoveryRowValue } from '../../features/recovery/recoveryState';
import { ToggleCard } from '../../features/settings/ToggleCard';
import { useStrings } from '../../i18n';
import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import {
  backupNow,
  getBackupState,
  setBackupEnabled,
  status,
  subscribeBackup,
  type BackupOutcome,
} from '../../platform/backup';
import { backupKeyGroups, backupKeyOf } from '../../platform/circleApi';
import { startNewIdentity } from '../../platform/hooks/useIdentitySync';
import { identityTravels, loadIdentity } from '../../platform/identity';

/** The key while it is read from the keychain, the key, or no key on this phone yet. */
type KeyState = { state: 'loading' } | { state: 'found'; key: string } | { state: 'missing' };

/**
 * Ajustes › Respaldo (ADR-0048 §7): the encrypted backup, on by default.
 *
 * One switch with one sentence on what it is (encrypted here, unreadable on the server),
 * and under it the one true line of `status()`: off, no identity yet, never, the last
 * backup, or why the last attempt did not go out (rule 8). What travels and what does
 * not is said plainly, iPhone's app choices included (§9).
 *
 * The backup key lives here now: it is the only thing that opens the backup, so what is
 * lost without it is said next to it, not in a footnote. Whether the key also travels by
 * itself (iCloud Keychain, Block Store) is the identity's to say, and it is shown as it
 * says it. "Tengo una clave" goes to the restore.
 *
 * "Respaldar ahora" is the page's one primary, pinned at the bottom.
 *
 * ADR-0050 adds two things. A row to the recovery email, with its price under it; with
 * an email set, the lines that promised nobody else holds the key say that Vesper can
 * give it back. And a device left behind: when the server refuses this device's key (the
 * Vesper moved to another device with "Traerlo aquí", or its key changed), the key is
 * not shown as if it worked, the line says why nothing is backed up, and the two ways
 * out are offered — "Tengo una clave" and "Empezar una identidad nueva".
 */
export default function BackupSettingsScreen() {
  const router = useRouter();
  const strings = useStrings();
  const t = strings.backup;
  const state = useSyncExternalStore(subscribeBackup, getBackupState);
  const identityId = useIdentityStore((s) => s.id);
  const registered = useIdentityStore((s) => s.registered);
  const keyRejected = useIdentityStore((s) => s.keyRejected);
  const recovery = useRecoveryAccount();
  const recoveryEmail = recovery.id === identityId ? recovery.email : undefined;
  const line = status({ state, registered });

  const [key, setKey] = useState<KeyState>({ state: 'loading' });
  const [travel, setTravel] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<BackupOutcome | null>(null);
  const [newIdentityFailed, setNewIdentityFailed] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The key of this install's identity, read again when the identity changes (a
  // restore, the first registration). Never kept anywhere but this screen's state.
  useEffect(() => {
    let live = true;
    void loadIdentity().then((credentials) => {
      if (live) {
        setKey(credentials === null ? { state: 'missing' } : { state: 'found', key: backupKeyOf(credentials) });
      }
    });
    void identityTravels()
      .then((travelStatus) => {
        if (live) {
          setTravel(travelStatus.reason);
        }
      })
      .catch(() => undefined);
    // The recovery email, and whether the server still takes this key (ADR-0050 §10).
    void refreshRecoveryAccount();
    return () => {
      live = false;
    };
  }, [identityId, registered]);

  const runNow = () => {
    setOutcome(null);
    void (async () => {
      const credentials = await loadIdentity();
      if (credentials === null) {
        return;
      }
      const result = await backupNow(credentials, Date.now());
      if (mounted.current) {
        setOutcome(result);
      }
    })();
  };

  // A later automatic failure while the page is open takes the line back.
  const upToDate = (outcome === 'done' || outcome === 'unchanged') && state.lastError === null;
  const leftBehind = isLeftBehind({ registered, keyFound: key.state === 'found', keyRejected, lastError: state.lastError });
  const withEmail = typeof recoveryEmail === 'string';

  const startOver = () => {
    Alert.alert(t.newIdentityTitle, t.newIdentityMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.newIdentityConfirm,
        onPress: () => {
          setNewIdentityFailed(false);
          const before = identityId;
          void startNewIdentity(Date.now()).then((result) => {
            // A new id is on its way even when its registration waits for a connection;
            // only an answer that left the identity where it was means nothing started.
            if (mounted.current && result.kind === 'failed' && useIdentityStore.getState().id === before) {
              setNewIdentityFailed(true);
            }
          });
        },
      },
    ]);
  };

  return (
    <Screen
      scroll
      footer={
        <Button
          label={t.backupNow}
          busyLabel={t.backingUp}
          busy={state.running}
          onPress={runNow}
          disabled={!line.available || state.running || key.state !== 'found' || leftBehind}
        />
      }
    >
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.settings)} title={t.title} />

      <Stack gap="sm">
        <ToggleCard
          title={t.toggleTitle}
          description={withEmail ? t.toggleDescriptionWithEmail : t.toggleDescription}
          value={state.enabled}
          onValueChange={(enabled) => {
            setOutcome(null);
            setBackupEnabled(enabled, Date.now());
          }}
        />
        {/* The result of "Respaldar ahora" when it worked; a failure is the line itself. */}
        {upToDate ? (
          <StatusNote text={t.done} live />
        ) : (
          // status() cannot see the keychain or the server's refusal; this screen can,
          // and a missing or refused key outranks the date of the last backup, which will
          // not move until the key is back.
          <StatusNote
            text={
              leftBehind && state.enabled
                ? t.status.moved
                : key.state === 'missing' && registered && state.enabled
                  ? t.status.noKey
                  : line.reason
            }
            live
          />
        )}
        {state.enabled ? null : <StatusNote text={t.offNote} />}
        <StatusNote text={t.contents} />
      </Stack>

      <Section title={t.keyTitle}>
        {key.state === 'loading' ? null : (
          <Card>
            {key.state === 'found' && leftBehind ? (
              // A key the server refuses is not one to copy into a password manager.
              <Text variant="label" tone="secondary">
                {t.keyMoved}
              </Text>
            ) : key.state === 'found' ? (
              <Text variant="label" selectable>
                {backupKeyGroups(key.key).join(' ')}
              </Text>
            ) : (
              <Text variant="label" tone="secondary">
                {/* Registered and no key: it stayed on another phone (a system restore
                    brings the database, not the secret). Otherwise it is on its way. */}
                {registered ? t.keyLost : t.keyMissing}
              </Text>
            )}
          </Card>
        )}
        {key.state === 'found' && !leftBehind ? (
          <Button
            label={t.keySave}
            variant="ghost"
            onPress={() => {
              void Share.share({ message: key.key });
            }}
          />
        ) : null}
        <StatusNote text={withEmail ? t.keyHintWithEmail : t.keyHint} />
        {travel === null ? null : <StatusNote text={travel} />}
      </Section>

      <ListGroup footer={t.recoveryHint}>
        <ListRow
          icon="mail"
          label={t.recoveryRow}
          value={recoveryRowValue(recoveryEmail, t.recoveryNone)}
          onPress={() => router.push('/settings/recovery-email')}
        />
      </ListGroup>

      <ListGroup footer={t.restoreHint}>
        <ListRow icon="download" label={t.restoreRow} onPress={() => router.push('/restore/key')} />
      </ListGroup>

      {(key.state === 'missing' && registered) || leftBehind ? (
        <ListGroup footer={t.newIdentityHint}>
          <ListRow icon="refresh-cw" label={t.newIdentityRow} onPress={startOver} />
        </ListGroup>
      ) : null}
      {newIdentityFailed ? <StatusNote text={t.newIdentityFailed} tone="danger" live /> : null}
    </Screen>
  );
}
