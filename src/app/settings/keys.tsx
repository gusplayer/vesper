import { useRouter } from 'expo-router';

import { useKeys } from '../../data';
import { MAX_KEYS } from '../../data/stores/keys';
import { Button, Card, ListGroup, ListRow, PageHeader, Screen, Stack, Text } from '../../design/components';
import { useLocale, useStrings } from '../../i18n';

/**
 * Ajustes › Llaves (ADR-0034). The keys this phone knows: the ones it can be opened
 * by, and the ones it is. Removing one takes its secret out of the keychain first.
 */
export default function KeysScreen() {
  const router = useRouter();
  const t = useStrings();
  const { tag } = useLocale();
  const keys = useKeys();

  const full = keys.length >= MAX_KEYS;

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t.keys.add} onPress={() => router.push('/keys/pair')} disabled={full} />
          <Text variant="caption" tone="tertiary" align="center">
            {t.keys.max(MAX_KEYS)}
          </Text>
        </>
      }
    >
      <PageHeader onBack={() => router.back()} title={t.keys.title} />
      <Text variant="label" tone="secondary">
        {t.keys.subtitle}
      </Text>

      {keys.length === 0 ? (
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {t.keys.empty}
            </Text>
            <Text variant="label" tone="secondary">
              {t.keys.emptyHint}
            </Text>
          </Stack>
        </Card>
      ) : (
        <ListGroup>
          {keys.map((key) => (
            <ListRow
              key={key.id}
              label={key.name}
              value={t.keys.pairedOn(new Date(key.pairedAt).toLocaleDateString(tag))}
              onPress={() => router.push({ pathname: '/keys/show', params: { id: key.id } })}
            />
          ))}
        </ListGroup>
      )}
    </Screen>
  );
}
