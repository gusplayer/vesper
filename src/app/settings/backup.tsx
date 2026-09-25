import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Share } from 'react-native';

import { useIdentityStore } from '../../data/identity';
import { Button, Card, ListGroup, ListRow, PageHeader, Screen, Section, Stack, StatusNote, Text } from '../../design/components';
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
 */
export default function BackupSettingsScreen() {
  const router = useRouter();
  const strings = useStrings();
  const t = strings.backup;
  const state = useSyncExternalStore(subscribeBackup, getBackupState);
  const identityId = useIdentityStore((s) => s.id);
  const registered = useIdentityStore((s) => s.registered);
  const line = status({ state, registered });

  const [key, setKey] = useState<KeyState>({ state: 'loading' });
  const [travel, setTravel] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<BackupOutcome | null>(null);
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

  return (
    <Screen
      scroll
      footer={
        <Button
          label={t.backupNow}
          busyLabel={t.backingUp}
          busy={state.running}
          onPress={runNow}
          disabled={!line.available || state.running || key.state !== 'found'}
        />
      }
    >
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.settings)} title={t.title} />

      <Stack gap="sm">
        <ToggleCard
          title={t.toggleTitle}
          description={t.toggleDescription}
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
          // status() cannot see the keychain; this screen can, and a missing key outranks
          // the date of the last backup, which will not move until it comes back.
          <StatusNote text={key.state === 'missing' && registered && state.enabled ? t.status.noKey : line.reason} live />
        )}
        {state.enabled ? null : <StatusNote text={t.offNote} />}
        <StatusNote text={t.contents} />
      </Stack>

      <Section title={t.keyTitle}>
        {key.state === 'loading' ? null : (
          <Card>
            {key.state === 'found' ? (
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
        {key.state === 'found' ? (
          <Button
            label={t.keySave}
            variant="ghost"
            onPress={() => {
              void Share.share({ message: key.key });
            }}
          />
        ) : null}
        <StatusNote text={t.keyHint} />
        {travel === null ? null : <StatusNote text={travel} />}
      </Section>

      <ListGroup footer={t.restoreHint}>
        <ListRow icon="download" label={t.restoreRow} onPress={() => router.push('/restore/key')} />
      </ListGroup>

      {key.state === 'missing' && registered ? (
        <ListGroup footer={t.newIdentityHint}>
          <ListRow
            icon="refresh-cw"
            label={t.newIdentityRow}
            onPress={() => {
              Alert.alert(t.newIdentityTitle, t.newIdentityMessage, [
                { text: strings.common.cancel, style: 'cancel' },
                {
                  text: t.newIdentityConfirm,
                  onPress: () => {
                    void startNewIdentity(Date.now());
                  },
                },
              ]);
            }}
          />
        </ListGroup>
      ) : null}
    </Screen>
  );
}
