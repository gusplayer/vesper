import { useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';

import { useSettings } from '../../data';
import { nextEmergencyRefill } from '../../data/emergency';
import { NoticeCard, PageHeader, Screen, Stack, StatusNote } from '../../design/components';
import { useLocale, useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';

/** The refill date only has to notice a new day. */
const CLOCK_MS = 60_000;

/**
 * The emergency unlock, as a count. The page only says how many are left this month
 * and when they come back (the first of next month, ADR-0025); the unlock itself is a
 * session route with its ten-second wait.
 */
export default function EmergencyScreen() {
  const router = useRouter();
  const settings = useSettings();
  const t = useStrings();
  const { tag } = useLocale();
  const now = useNow(CLOCK_MS);

  const refillDate = new Date(nextEmergencyRefill(now)).toLocaleDateString(tag, { day: 'numeric', month: 'long' });

  return (
    <Screen scroll>
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.settings)} title={t.settings.emergency.title} />

      <NoticeCard
        title={t.settings.emergency.cardTitle}
        body={t.settings.emergency.cardDescription}
        trailing={{ badge: t.settings.emergency.left(settings.emergencyLeft) }}
      />

      <Stack gap="xs">
        <StatusNote text={t.settings.emergency.perMonth(settings.emergencyTotal)} align="center" />
        <StatusNote text={t.settings.emergency.refills(refillDate)} align="center" />
        <StatusNote text={t.settings.emergency.fromSession} align="center" />
      </Stack>
    </Screen>
  );
}
