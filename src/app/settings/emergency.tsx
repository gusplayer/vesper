import { useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';

import { useSettings } from '../../data';
import { Badge, Card, PageHeader, Screen, Stack, Text } from '../../design/components';
import { useStrings } from '../../i18n';

/**
 * The emergency unlock, as a count. The page only says how many are left this month;
 * the unlock itself is a session route with its ten-second wait (ADR-0025).
 */
export default function EmergencyScreen() {
  const router = useRouter();
  const settings = useSettings();
  const t = useStrings();

  return (
    <Screen scroll>
      <PageHeader onBack={() => goBack(router)} title={t.settings.emergency.title} />

      <Card>
        <Stack direction="row" align="flex-start" gap="md">
          <Stack grow gap="xs">
            <Text variant="body" weight="medium">
              {t.settings.emergency.cardTitle}
            </Text>
            <Text variant="label" tone="secondary">
              {t.settings.emergency.cardDescription}
            </Text>
          </Stack>
          <Badge label={t.settings.emergency.left(settings.emergencyLeft)} />
        </Stack>
      </Card>

      <Stack gap="xs">
        <Text variant="caption" tone="tertiary" align="center">
          {t.settings.emergency.perMonth(settings.emergencyTotal)}
        </Text>
        <Text variant="caption" tone="tertiary" align="center">
          {t.settings.emergency.fromSession}
        </Text>
      </Stack>
    </Screen>
  );
}
