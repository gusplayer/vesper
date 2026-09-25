import { useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { Alert, Linking } from 'react-native';

import { HeroObject, ListGroup, ListRow, PageHeader, Screen, Stack, StatusNote, Text } from '../../design/components';
import { useHasDemoData } from '../../data';
import { VERSION_NUMBER } from '../../features/settings/version';
import { useStrings } from '../../i18n';

/**
 * The two texts live in `web/`, not in here (ADR-0046): a store needs a URL, a policy
 * changes without shipping a version, and the same text kept in two places ends up
 * saying two things one day. Each page carries both languages and follows the browser.
 */
const TERMS_URL = 'https://vesper-azure.vercel.app/terms';
const PRIVACY_URL = 'https://vesper-azure.vercel.app/privacy';

/**
 * Acerca de Vesper: the object, the version, what the product is, and the two texts the
 * app has to be able to show. The footer that promised them and led nowhere is now two
 * rows that open the browser.
 */
export default function AboutScreen() {
  const router = useRouter();
  const t = useStrings();
  const hasDemoData = useHasDemoData();

  /** A phone with no browser is rare and not a crash: say it instead of doing nothing. */
  const open = (url: string): void => {
    Linking.openURL(url).catch(() => {
      Alert.alert(t.settings.about.linkFailed);
    });
  };

  return (
    <Screen scroll>
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.settings)} title={t.settings.about.title} />

      <Stack align="center" gap="md">
        <HeroObject size="md" />
        <Stack align="center" gap="xs">
          <Text variant="caption" weight="semibold">
            {t.common.brand}
          </Text>
          <Text variant="caption" tone="secondary">
            {t.settings.about.version(VERSION_NUMBER)}
          </Text>
        </Stack>
      </Stack>

      <Text variant="body" tone="secondary">
        {t.settings.about.body}
      </Text>

      <ListGroup footer={t.settings.about.legalNote}>
        <ListRow label={t.settings.about.terms} icon="file-text" onPress={() => open(TERMS_URL)} />
        <ListRow label={t.settings.about.privacy} icon="lock" onPress={() => open(PRIVACY_URL)} />
      </ListGroup>

      {hasDemoData ? <StatusNote text={t.settings.about.demoNote} align="center" /> : null}
      <StatusNote text={t.settings.about.circleNote} align="center" />
    </Screen>
  );
}
