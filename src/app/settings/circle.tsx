import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useCircleMembers, useCircleStore, useProfile, useSharePrefs } from '../../data';
import {
  Button,
  FieldRow,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  Text,
  Toggle,
} from '../../design/components';
import { useStrings } from '../../i18n';
import { status as circleStatus } from '../../platform/circle';

/**
 * Ajustes › Círculo: the local identity (a name and a handle, nothing else), the three
 * share switches, and the way out. The draft is local and the profile changes only on
 * Guardar; the switches write at once, like every toggle in Ajustes.
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
  const sync = circleStatus();

  const [name, setName] = useState(profile?.name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');

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
    router.back();
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
      <PageHeader onBack={() => router.back()} title={t.title} />

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

      {profile === null ? null : (
        <ListGroup>
          <ListRow icon="users" label={t.seeCircle} onPress={() => router.push('/circle')} />
          {hasCircle ? (
            <ListRow icon="log-out" label={t.leaveCircle} tone="danger" kind="action" onPress={confirmLeave} />
          ) : null}
        </ListGroup>
      )}

      <Text variant="caption" tone="secondary" align="center">
        {sync.reason}
      </Text>
    </Screen>
  );
}
