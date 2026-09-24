import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { resetAndRehydrate, useCircleMembers, useProfile, useSettings } from '../../data';
import { Card, ListGroup, ListRow, PageHeader, Screen, Stack, Text } from '../../design/components';
import { VERSION_NUMBER } from '../../features/settings/version';
import { useLocale, useLocaleStore, useStrings } from '../../i18n';
import { birthDateText } from '../../lib/birthDate';

/** The Ajustes tab: groups of rows that each open their own page, like Brick. */
export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettings();
  const t = useStrings();
  const { tag } = useLocale();
  const preference = useLocaleStore((state) => state.preference);
  const profile = useProfile();
  const circleMembers = useCircleMembers().filter((member) => member.status === 'member').length;

  const activeRules = Object.values(settings.rules).filter(Boolean).length;
  const onOff = (flag: boolean) => (flag ? t.settings.tab.enabled : t.settings.tab.disabled);
  const languageValue = preference === 'auto' ? t.settings.language.auto : t.settings.language.names[preference];

  /**
   * The reset deletes the circle account before it empties the database (ADR-0044
   * §7), so it has to be awaited. When there was no network to delete it with, the
   * account outlives the phone's copy of it and that is said out loud: the app is
   * already on its way to onboarding, so the only place left to say it is an alert.
   */
  const reset = () => {
    void resetAndRehydrate(Date.now()).then((outcome) => {
      if (outcome.accountLeft) {
        Alert.alert(t.circle.settings.resetLeftAccountTitle, t.circle.settings.resetLeftAccount);
      }
    });
  };

  const confirmReset = () => {
    Alert.alert(t.settings.tab.resetConfirmTitle, t.settings.tab.resetConfirmMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.settings.tab.resetConfirm, style: 'destructive', onPress: reset },
    ]);
  };

  return (
    <Screen scroll inTabs>
      <PageHeader title={t.settings.tab.title} />

      <Card tone="muted">
        <Stack gap="xs">
          <Text variant="body">{t.settings.tab.thisPhone}</Text>
          <Text variant="label" tone="secondary">
            {t.settings.tab.noAccount}
          </Text>
        </Stack>
      </Card>

      <ListGroup>
        <ListRow
          icon="edit-3"
          label={t.settings.tab.rules}
          value={t.settings.tab.activeRules(activeRules)}
          onPress={() => router.push('/settings/rules')}
        />
        <ListRow
          icon="unlock"
          label={t.settings.tab.emergency}
          value={t.settings.tab.emergencyLeft(settings.emergencyLeft)}
          onPress={() => router.push('/settings/emergency')}
        />
      </ListGroup>

      <ListGroup>
        <ListRow
          icon="clock"
          label={t.settings.tab.liveActivities}
          value={onOff(settings.liveActivities)}
          onPress={() => router.push('/settings/live-activities')}
        />
        <ListRow
          icon="bell"
          label={t.settings.tab.notifications}
          value={onOff(settings.notificationsAllowed)}
          onPress={() => router.push('/settings/notifications')}
        />
        <ListRow
          icon="globe"
          label={t.settings.tab.language}
          value={languageValue}
          onPress={() => router.push('/settings/language')}
        />
        <ListRow
          icon="heart"
          label={t.settings.tab.health}
          value={settings.healthConnected ? t.settings.tab.healthConnected : t.settings.tab.healthNotConnected}
          onPress={() => router.push('/settings/health')}
        />
      </ListGroup>

      <ListGroup>
        <ListRow
          icon="users"
          label={t.settings.tab.circle}
          value={profile === null ? t.settings.tab.circleNoProfile : t.settings.tab.circleValue(circleMembers)}
          onPress={() => router.push('/settings/circle')}
        />
        <ListRow
          icon="calendar"
          label={t.settings.tab.life}
          value={settings.birthDate === null ? t.settings.tab.noBirthDate : birthDateText(settings.birthDate, tag)}
          onPress={() => router.push('/settings/life')}
        />
        <ListRow icon="help-circle" label={t.settings.tab.help} onPress={() => router.push('/settings/help')} />
        <ListRow icon="info" label={t.settings.tab.about} onPress={() => router.push('/settings/about')} />
      </ListGroup>

      <Stack gap="sm">
        <ListGroup>
          <ListRow icon="trash-2" label={t.settings.tab.reset} tone="danger" kind="action" onPress={confirmReset} />
        </ListGroup>
        <Text variant="caption" tone="secondary">
          {t.settings.tab.resetCaption}
        </Text>
      </Stack>

      <Stack align="center" gap="xs">
        <Text variant="caption" weight="semibold">
          VESPER
        </Text>
        <Text variant="caption" tone="secondary">
          {t.settings.about.version(VERSION_NUMBER)}
        </Text>
      </Stack>
    </Screen>
  );
}
