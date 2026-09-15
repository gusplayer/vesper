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

const VERSION = 'Versión 2026.9.1';

/** Acerca de Vesper: the object, the version, what the product is, and the legal rows. */
export default function AboutScreen() {
  const router = useRouter();

  return (
    <Screen scroll>
      <PageHeader onBack={() => router.back()} title="Acerca de Vesper" />

      <Stack align="center" gap="md">
        <HeroObject size="md" />
        <Stack align="center" gap="xs">
          <Text variant="caption" weight="semibold">
            VESPER
          </Text>
          <Text variant="caption" tone="tertiary">
            {VERSION}
          </Text>
        </Stack>
      </Stack>

      <Text variant="body" tone="secondary" align="center">
        Vesper mide el tiempo que invertís, no el que consumís. Lo que hacés con foco, lo que
        verifica Salud y lo que el teléfono estima viven en columnas distintas y nunca se suman.
        La idea es que veas tu tiempo como algo que se asigna, no como algo que se pierde.
      </Text>

      <ListGroup>
        <ListRow label="Términos" />
        <ListRow label="Privacidad" />
      </ListGroup>

      <Text variant="caption" tone="tertiary" align="center">
        Prototipo con datos de ejemplo. Nada de lo que ves es real.
      </Text>
    </Screen>
  );
}
