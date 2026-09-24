import { useRouter } from 'expo-router';
import { Alert, Linking } from 'react-native';

import { HeroObject, ListGroup, ListRow, PageHeader, Screen, Stack, Text } from '../../design/components';
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

  /** A phone with no browser is rare and not a crash: say it instead of doing nothing. */
  const open = (url: string): void => {
    Linking.openURL(url).catch(() => {
      Alert.alert(t.settings.about.linkFailed);
    });
  };

  return (
    <Screen scroll>
      <PageHeader onBack={() => router.back()} title={t.settings.about.title} />

      <Stack align="center" gap="md">
        <HeroObject size="md" />
        <Stack align="center" gap="xs">
          <Text variant="caption" weight="semibold">
            VESPER
          </Text>
          <Text variant="caption" tone="tertiary">
            {t.settings.about.version(VERSION_NUMBER)}
          </Text>
        </Stack>
      </Stack>

      <Text variant="body" tone="secondary" align="center">
        {t.settings.about.body}
      </Text>

      <ListGroup>
        <ListRow label={t.settings.about.terms} icon="file-text" onPress={() => open(TERMS_URL)} />
        <ListRow label={t.settings.about.privacy} icon="lock" onPress={() => open(PRIVACY_URL)} />
      </ListGroup>

      <Text variant="caption" tone="tertiary" align="center">
        {t.settings.about.legalNote}
      </Text>

      <Text variant="caption" tone="secondary" align="center">
        {t.settings.about.prototypeNote}
      </Text>
    </Screen>
  );
}
