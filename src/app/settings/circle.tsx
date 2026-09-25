import { useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useCircleMembers, useCircleStore, useProfile, useSettings, useSharePrefs, useUsage } from '../../data';
import {
  Button,
  FieldRow,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  StatusNote,
  Toggle,
} from '../../design/components';
import { useCircleSyncStatus } from '../../features/circle/useCircleSyncStatus';
import { useStrings } from '../../i18n';
import { cleanHandle, isValidHandle } from '../../platform/circleApi';
import {
  deleteCircleAccountOutcome,
  endEveryLink,
  renameCircleAccount,
  type DeleteOutcome,
  type RenameOutcome,
} from '../../platform/hooks/useCircleSync';

/**
 * Ajustes › Círculo: the identity (a name and a handle, nothing else), the three
 * share switches, a row to the backup key and the two ways out. The draft is local and
 * the profile changes only on Guardar; the switches write at once, like every toggle in
 * Ajustes.
 *
 * **The profile shown is what the server has.** The handle is checked against the
 * server's own rule before it can be saved, and once there is an account Guardar sends
 * the rename first: a handle somebody else holds is refused here, before the phone
 * shows a handle the circle does not see; without a connection it is saved here and
 * goes out with the next sync. The hint under the fields says where the name lives,
 * which changes the moment the account is born.
 *
 * The backup key moved to Ajustes › Respaldo with ADR-0048: it is the whole account's —
 * the identity, its encrypted backup and its circle — and it brings all three back on
 * another phone. The row here says so and goes there.
 *
 * "Borrar la cuenta" is not "Salir del círculo". Leaving empties the people on this
 * phone — and, while the server cannot end a link, the alert says the circle still sees
 * the user's week; deleting takes the account and every row of it off the server and
 * hands the phone back its local-only life.
 */
export default function CircleSettingsScreen() {
  const router = useRouter();
  const strings = useStrings();
  const t = strings.circle.settings;
  const profile = useProfile();
  const share = useSharePrefs();
  const members = useCircleMembers();
  const settings = useSettings();
  const usage = useUsage();
  const createProfile = useCircleStore((state) => state.createProfile);
  const updateShare = useCircleStore((state) => state.updateShare);
  const leaveCircle = useCircleStore((state) => state.leaveCircle);
  const account = useCircleStore((state) => state.account);
  const linkEndSupport = useCircleStore((state) => state.linkEndSupport);
  const sync = useCircleSyncStatus();

  const [name, setName] = useState(profile?.name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [deleted, setDeleted] = useState<DeleteOutcome | null>(null);
  // What "Salir del círculo" could not finish on the server (ADR-0049), said once.
  const [leftLine, setLeftLine] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<RenameOutcome | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const trimmedName = name.trim();
  const trimmedHandle = cleanHandle(handle);
  const handleValid = isValidHandle(trimmedHandle);
  const unchanged = profile !== null && profile.name === trimmedName && profile.handle === trimmedHandle;
  const canSave = trimmedName !== '' && handleValid && !unchanged;
  // Only people who are in: a pending request alone is not a circle to leave.
  const hasCircle = members.some((member) => member.status === 'member');
  const handleTaken = saved === 'handleTaken';

  const save = () => {
    if (profile === null) {
      createProfile({ name: trimmedName, handle: trimmedHandle }, Date.now());
      goBack(router, BACK_FALLBACK.settings);
      return;
    }
    void (async () => {
      setSaving(true);
      const outcome = await renameCircleAccount({ name: trimmedName, handle: trimmedHandle }, Date.now());
      if (!mounted.current) {
        return;
      }
      setSaving(false);
      setSaved(outcome);
      // Saved on the server, or saved here to go out later: either way the page's job
      // is done. A taken handle stays on screen to be changed.
      if (outcome === 'saved') {
        goBack(router, BACK_FALLBACK.settings);
      }
    })();
  };

  const confirmDelete = () => {
    Alert.alert(t.deleteQuestion, t.deleteMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.deleteConfirm,
        style: 'destructive',
        onPress: () => {
          void deleteCircleAccountOutcome(Date.now()).then((outcome) => {
            if (mounted.current) {
              setDeleted(outcome);
            }
          });
        },
      },
    ]);
  };

  const confirmLeave = () => {
    // With an account, leaving ends every link on the server too (ADR-0049). A server
    // that predates the call cannot: once it has said so, the alert says the circle
    // still sees the user's week, before anything happens.
    const message =
      account === null ? t.leaveMessage : linkEndSupport === 'no' ? t.leaveMessageAccount : t.leaveMessageLinked;
    Alert.alert(t.leaveQuestion, message, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.leaveConfirm,
        style: 'destructive',
        onPress: () => {
          leaveCircle(Date.now());
          setLeftLine(null);
          void endEveryLink().then((outcome) => {
            if (mounted.current) {
              setLeftLine(
                outcome === 'unsupported'
                  ? t.leaveUnsupported
                  : outcome === 'queued'
                    ? strings.circle.invite.endQueued
                    : null,
              );
            }
          });
        },
      },
    ]);
  };

  const handleLine = handleTaken
    ? t.handleTaken
    : trimmedHandle !== '' && !handleValid
      ? t.handleRule
      : null;

  return (
    <Screen
      scroll
      avoidKeyboard
      footer={
        <Button
          label={profile === null ? t.createProfile : strings.common.save}
          busyLabel={t.saving}
          busy={saving}
          onPress={save}
          disabled={!canSave}
        />
      }
    >
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.settings)} title={t.title} />

      <Section title={t.profile}>
        <FieldRow
          label={t.name}
          value={name}
          onChangeText={(text) => {
            setName(text);
            setSaved(null);
          }}
          placeholder={t.namePlaceholder}
          autoFocus={profile === null}
        />
        <FieldRow
          label={t.handle}
          value={handle}
          onChangeText={(text) => {
            setHandle(text);
            setSaved(null);
          }}
          placeholder={t.handlePlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
        {handleLine === null ? (
          <StatusNote text={t.handleRule} />
        ) : (
          <StatusNote text={handleLine} tone="danger" live />
        )}
        {saved === 'pending' ? <StatusNote text={t.renamePending} live /> : null}
        <StatusNote text={account === null ? t.profileHint : t.profileHintAccount} />
      </Section>

      <ListGroup title={t.share} footer={t.shareHint}>
        <ListRow
          label={t.shareFocus.label}
          description={t.shareFocus.description}
          right={
            <Toggle
              value={share.focus}
              onValueChange={(focus) => updateShare({ focus }, Date.now())}
              accessibilityLabel={t.shareFocus.label}
            />
          }
        />
        <ListRow
          label={t.shareHabits.label}
          description={t.shareHabits.description}
          right={
            <Toggle
              value={share.habits}
              onValueChange={(habits) => updateShare({ habits }, Date.now())}
              accessibilityLabel={t.shareHabits.label}
            />
          }
        />
        <ListRow
          label={t.shareSocial.label}
          description={t.shareSocial.description}
          right={
            <Toggle
              value={share.social}
              onValueChange={(social) => updateShare({ social }, Date.now())}
              accessibilityLabel={t.shareSocial.label}
            />
          }
        />
      </ListGroup>
      {/* On with nothing real to send (iOS, or the demo floor): say so (ADR-0035). */}
      {share.social && usage.source !== 'device' ? (
        <>
          <StatusNote text={t.socialNothing} />
          {usage.reason === null ? null : <StatusNote text={usage.reason} />}
        </>
      ) : null}

      {/* The key is the whole account's since ADR-0048, not the circle's: it lives in
          Ajustes › Respaldo, and this row says what it brings back. */}
      <ListGroup footer={t.backupRowHint}>
        <ListRow icon="key" label={t.backupRow} onPress={() => router.push('/settings/backup')} />
      </ListGroup>

      {profile === null ? null : (
        <ListGroup>
          <ListRow icon="users" label={t.seeCircle} onPress={() => router.push('/circle')} />
          <ListRow
            icon="bell"
            label={t.notices}
            value={settings.notifications.nudges ? t.noticesOn : t.noticesOff}
            onPress={() => router.push('/settings/notifications')}
          />
          {hasCircle ? (
            <ListRow icon="log-out" label={t.leaveCircle} tone="danger" kind="action" onPress={confirmLeave} />
          ) : null}
          {account === null ? null : (
            <ListRow icon="trash-2" label={t.deleteAccount} tone="danger" kind="action" onPress={confirmDelete} />
          )}
        </ListGroup>
      )}

      {leftLine === null ? null : <StatusNote text={leftLine} live />}
      {deleted === 'offline' ? <StatusNote text={t.deleteFailed} tone="danger" live /> : null}
      {deleted === 'orphaned' ? <StatusNote text={t.deleteOrphaned} tone="danger" live /> : null}

      <StatusNote text={sync.reason} align="center" />
    </Screen>
  );
}
