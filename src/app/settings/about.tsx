import { useRouter } from 'expo-router';

import { HeroObject, PageHeader, Screen, Stack, Text } from '../../design/components';
import { VERSION_NUMBER } from '../../features/settings/version';
import { useStrings } from '../../i18n';

/** Acerca de Vesper: the object, the version and what the product is. No legal text exists yet. */
export default function AboutScreen() {
  const router = useRouter();
  const t = useStrings();

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

      <Text variant="caption" tone="tertiary" align="center">
        {t.settings.about.prototypeNote}
      </Text>
    </Screen>
  );
}
