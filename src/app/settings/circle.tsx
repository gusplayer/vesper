import { useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';
import { useEffect, useState } from 'react';
import { Alert, Share } from 'react-native';

import { useCircleMembers, useCircleStore, useProfile, useSharePrefs } from '../../data';
import {
  Button,
  Card,
  FieldRow,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  Stack,
  Text,
  Toggle,
} from '../../design/components';
import { useStrings } from '../../i18n';
import { loadCredentials, status as circleStatus } from '../../platform/circle';
import { backupKeyGroups, backupKeyOf } from '../../platform/circleApi';
import { deleteCircleAccount } from '../../platform/hooks/useCircleSync';

/**
 * Ajustes › Círculo: the local identity (a name and a handle, nothing else), the three
 * share switches, the backup key and the two ways out. The draft is local and the
 * profile changes only on Guardar; the switches write at once, like every toggle in
 * Ajustes.
 *
 * The backup key is shown here and nowhere else (ADR-0044 §3). It is the whole account:
 * `id.secreto`, cut into readable groups, with what is lost without it said on the
 * screen and not in a footnote. Reinstalling without it loses the circle, and that is
 * the price of not asking for an email (ADR-0033).
 *
 * "Borrar la cuenta" is not "Salir del círculo". Leaving empties the people; deleting
 * takes the account and every row of it off the server and hands the phone back its
 * local-only life.
 */
export default function CircleSettingsScreen() {
  const router = useRouter();
  const strings = useStrings();
  const t = strings.circle.settings;
  const profile = useProfile();
  const share = useSharePrefs();
  const members = useCircleMembers();
  const createProfile = useCircleStore((state) => state.createProfile);
  const updateProfile = useCircleStore((state) => state.updateProfile);
  const updateShare = useCircleStore((state) => state.updateShare);
  const leaveCircle = useCircleStore((state) => state.leaveCircle);
  const account = useCircleStore((state) => state.account);
  const syncedAt = useCircleStore((state) => state.syncedAt);
  const syncFailed = useCircleStore((state) => state.syncFailed);
  // Subscribed one by one and handed to `status()`, so the line below changes the
  // moment a sync lands instead of on the next render this screen happens to do.
  const sync = circleStatus({ account, syncedAt, syncFailed });

  const [name, setName] = useState(profile?.name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [backupKey, setBackupKey] = useState<string | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const profileId = profile?.id ?? null;
  useEffect(() => {
    if (profileId === null || account === null) {
      return;
    }
    let live = true;
    void loadCredentials(profileId).then((credentials) => {
      if (live) {
        setBackupKey(credentials === null ? null : backupKeyOf(credentials));
      }
    });
    return () => {
      live = false;
    };
  }, [profileId, account]);

  // The key belongs to the account that is there now: one deleted while the screen is
  // open must not leave its secret on screen.
  const shownKey = account === null ? null : backupKey;

  const trimmedName = name.trim();
  const trimmedHandle = handle.trim().toLowerCase().replace(/\s+/g, '');
  const unchanged = profile !== null && profile.name === trimmedName && profile.handle === trimmedHandle;
  const canSave = trimmedName !== '' && trimmedHandle !== '' && !unchanged;
  const hasCircle = members.length > 0;

  const save = () => {
    if (profile === null) {
      createProfile({ name: trimmedName, handle: trimmedHandle }, Date.now());
    } else {
      updateProfile({ name: trimmedName, handle: trimmedHandle }, Date.now());
    }
    goBack(router);
  };

  const confirmDelete = () => {
    Alert.alert(t.deleteQuestion, t.deleteMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.deleteConfirm,
        style: 'destructive',
        onPress: () => {
          void deleteCircleAccount(Date.now()).then((done) => setDeleteFailed(!done));
        },
      },
    ]);
  };

  const confirmLeave = () => {
    Alert.alert(t.leaveQuestion, t.leaveMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: t.leaveConfirm, style: 'destructive', onPress: () => leaveCircle(Date.now()) },
    ]);
  };

  return (
    <Screen
      scroll
      footer={
        <Button label={profile === null ? t.createProfile : strings.common.save} onPress={save} disabled={!canSave} />
      }
    >
      <PageHeader onBack={() => goBack(router)} title={t.title} />

      <Section title={t.profile}>
        <FieldRow
          label={t.name}
          value={name}
          onChangeText={setName}
          placeholder={t.namePlaceholder}
          autoFocus={profile === null}
        />
        <FieldRow
          label={t.handle}
          value={handle}
          onChangeText={setHandle}
          placeholder={t.handlePlaceholder}
          autoCapitalize="none"
        />
        <Text variant="caption" tone="tertiary">
          {t.profileHint}
        </Text>
      </Section>

      <Section title={t.share}>
        <ListGroup>
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
        <Text variant="caption" tone="tertiary">
          {t.shareHint}
        </Text>
      </Section>

      {profile === null || account === null ? null : (
        <Section title={t.backup}>
          <Card>
            <Stack gap="sm">
              <Text variant="label">
                {shownKey === null ? t.backupNone : backupKeyGroups(shownKey).join(' ')}
              </Text>
            </Stack>
          </Card>
          <Button
            label={t.backupCopy}
            variant="ghost"
            disabled={shownKey === null}
            onPress={() => {
              if (shownKey !== null) {
                void Share.share({ message: shownKey });
              }
            }}
          />
          <Text variant="caption" tone="tertiary">
            {t.backupHint}
          </Text>
        </Section>
      )}

      {profile === null ? null : (
        <ListGroup>
          <ListRow icon="users" label={t.seeCircle} onPress={() => router.push('/circle')} />
          {hasCircle ? (
            <ListRow icon="log-out" label={t.leaveCircle} tone="danger" kind="action" onPress={confirmLeave} />
          ) : null}
          {account === null ? null : (
            <ListRow icon="trash-2" label={t.deleteAccount} tone="danger" kind="action" onPress={confirmDelete} />
          )}
        </ListGroup>
      )}

      {deleteFailed ? (
        <Text variant="label" tone="danger">
          {t.deleteFailed}
        </Text>
      ) : null}

      <Text variant="caption" tone="secondary" align="center">
        {sync.reason}
      </Text>
    </Screen>
  );
}
