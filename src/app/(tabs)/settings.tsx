import { useRouter } from 'expo-router';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

import {
  resetAndRehydrate,
  useCircleMembers,
  useCircleStore,
  useHasDemoData,
  useProfile,
  useRunningSession,
  useSettings,
} from '../../data';
import { removeDemoData } from '../../data/demoData';
import { ListGroup, ListRow, NoticeCard, PageHeader, Screen, Stack, Text } from '../../design/components';
import { VERSION_NUMBER } from '../../features/settings/version';
import { useLocale, useLocaleStore, useStrings } from '../../i18n';
import { birthDateText } from '../../lib/birthDate';
import { getBackupState, subscribeBackup } from '../../platform/backup';
import { status as liveActivityStatus } from '../../platform/liveActivity';

/** The Ajustes tab: groups of rows that each open their own page, like Brick. */
export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettings();
  const t = useStrings();
  const { tag } = useLocale();
  const preference = useLocaleStore((state) => state.preference);
  const profile = useProfile();
  const circleAccount = useCircleStore((state) => state.account);
  const circleMembers = useCircleMembers().filter((member) => member.status === 'member').length;
  const liveActivities = liveActivityStatus();
  const backup = useSyncExternalStore(subscribeBackup, getBackupState);
  const [resetting, setResetting] = useState(false);
  // A ref as well as the state: two taps inside one frame both see `resetting` false.
  const resettingRef = useRef(false);

  const hasDemoData = useHasDemoData();
  const running = useRunningSession();

  // Strict mode is no longer a switch (ADR-0047 §6); a stored `true` of an older build
  // must not count as a rule the user sees on.
  const { blockInstalls, blockPurchases, blockMature } = settings.rules;
  const activeRules = [blockInstalls, blockPurchases, blockMature].filter(Boolean).length;
  const onOff = (flag: boolean) => (flag ? t.settings.tab.enabled : t.settings.tab.disabled);
  const languageValue = preference === 'auto' ? t.settings.language.auto : t.settings.language.names[preference];

  /**
   * The reset deletes the circle account before it empties the database (ADR-0044
   * §7), so it has to be awaited, and that can take up to the request timeout. The row
   * says it is working and ignores taps meanwhile, so a second confirm cannot start a
   * second reset. When there was no network to delete the account with, it outlives
   * the phone's copy of it and that is said out loud: the app is already on its way to
   * onboarding, so the only place left to say it is an alert.
   */
  const reset = () => {
    if (resettingRef.current) {
      return;
    }
    resettingRef.current = true;
    setResetting(true);
    void resetAndRehydrate(Date.now())
      .then((outcome) => {
        if (outcome.accountLeft) {
          Alert.alert(t.circle.settings.resetLeftAccountTitle, t.circle.settings.resetLeftAccount);
        }
      })
      .finally(() => {
        resettingRef.current = false;
        setResetting(false);
      });
  };

  /** Takes only what the seed wrote; the row disappears with it, which is the feedback. */
  const confirmRemoveDemo = () => {
    Alert.alert(t.settings.tab.removeDemoConfirmTitle, t.settings.tab.removeDemoConfirmMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.tab.removeDemoConfirm,
        style: 'destructive',
        onPress: () => {
          removeDemoData(Date.now());
        },
      },
    ]);
  };

  const confirmReset = () => {
    if (resettingRef.current) {
      return;
    }
    Alert.alert(t.settings.tab.resetConfirmTitle, t.settings.tab.resetConfirmMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.settings.tab.resetConfirm, style: 'destructive', onPress: reset },
    ]);
  };

  return (
    <Screen scroll inTabs>
      <PageHeader title={t.settings.tab.title} />

      <NoticeCard
        tone="muted"
        title={t.settings.tab.thisPhone}
        body={circleAccount === null ? t.settings.tab.noAccount : t.settings.tab.withAccount}
      />

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
          value={liveActivities.available ? onOff(settings.liveActivities) : t.settings.tab.unavailable}
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
          icon="shield"
          label={t.settings.tab.backup}
          value={backup.enabled ? t.settings.tab.backupOn : t.settings.tab.backupOff}
          onPress={() => router.push('/settings/backup')}
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

      {hasDemoData && running === null ? (
        <ListGroup footer={t.settings.tab.removeDemoCaption}>
          <ListRow icon="layers" label={t.settings.tab.removeDemo} kind="action" onPress={confirmRemoveDemo} />
        </ListGroup>
      ) : null}

      <ListGroup footer={t.settings.tab.resetCaption}>
        <ListRow
          icon="trash-2"
          label={resetting ? t.settings.tab.resetting : t.settings.tab.reset}
          tone="danger"
          kind="action"
          onPress={confirmReset}
          disabled={resetting}
        />
      </ListGroup>

      <Stack align="center" gap="xs">
        <Text variant="caption" weight="semibold">
          {t.common.brand}
        </Text>
        <Text variant="caption" tone="secondary">
          {t.settings.about.version(VERSION_NUMBER)}
        </Text>
      </Stack>
    </Screen>
  );
}
