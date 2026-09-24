import { useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';

import { useAppStore, useSettings } from '../../data';
import { PageHeader, Screen, Stack, Text } from '../../design/components';
import { ToggleCard } from '../../features/settings/ToggleCard';
import { useStrings } from '../../i18n';
import { status as blockingStatus } from '../../platform/blocking';

/**
 * Mis reglas: four switches that make a session harder to leave. Where Screen Time is
 * available the adult-content filter applies during a session; the other three are
 * ManagedSettings the module does not expose yet, and the caption says so.
 */
export default function RulesScreen() {
  const router = useRouter();
  const { rules } = useSettings();
  const updateRules = useAppStore((state) => state.updateRules);
  const t = useStrings();
  const blocking = blockingStatus();

  return (
    <Screen scroll>
      <PageHeader onBack={() => goBack(router)} title={t.settings.rules.title} />

      <Stack gap="md">
        <ToggleCard
          title={t.settings.rules.strict.title}
          description={t.settings.rules.strict.description}
          value={rules.strictMode}
          onValueChange={(strictMode) => updateRules({ strictMode })}
        />
        <ToggleCard
          title={t.settings.rules.installs.title}
          description={t.settings.rules.installs.description}
          value={rules.blockInstalls}
          onValueChange={(blockInstalls) => updateRules({ blockInstalls })}
        />
        <ToggleCard
          title={t.settings.rules.purchases.title}
          description={t.settings.rules.purchases.description}
          value={rules.blockPurchases}
          onValueChange={(blockPurchases) => updateRules({ blockPurchases })}
        />
        <ToggleCard
          title={t.settings.rules.mature.title}
          description={t.settings.rules.mature.description}
          value={rules.blockMature}
          onValueChange={(blockMature) => updateRules({ blockMature })}
        />
      </Stack>

      <Text variant="caption" tone="secondary" align="center">
        {blocking.available ? t.settings.rules.applied : t.settings.rules.notApplied(blocking.reason ?? '')}
      </Text>
    </Screen>
  );
}
