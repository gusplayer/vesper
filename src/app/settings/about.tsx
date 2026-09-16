import { useRouter } from 'expo-router';

import {
  HeroObject,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Stack,
  Text,
} from '../../design/components';
import { useStrings } from '../../i18n';

const VERSION_NUMBER = '2026.9.1';

/** Acerca de Vesper: the object, the version, what the product is, and the legal rows. */
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

      <ListGroup>
        <ListRow label={t.settings.about.terms} />
        <ListRow label={t.settings.about.privacy} />
      </ListGroup>

      <Text variant="caption" tone="tertiary" align="center">
        {t.settings.about.prototypeNote}
      </Text>
    </Screen>
  );
}
