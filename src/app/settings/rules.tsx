import { useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';

import { useAppStore, useSettings } from '../../data';
import { PageHeader, Screen, Stack, StatusNote } from '../../design/components';
import { appliedRules, type RuleKey } from '../../features/settings/appliedRules';
import { ToggleCard } from '../../features/settings/ToggleCard';
import { useStrings } from '../../i18n';
import { status as blockingStatus } from '../../platform/blocking';

type RuleCopyKey = 'installs' | 'purchases' | 'mature';

/**
 * The rules, in the order Brick lists them, with the copy each one reads. Strict mode
 * is gone (ADR-0047 §6): it was never implemented. Its stored field stays readable.
 */
const RULES: readonly { key: RuleKey; copy: RuleCopyKey }[] = [
  { key: 'blockInstalls', copy: 'installs' },
  { key: 'blockPurchases', copy: 'purchases' },
  { key: 'blockMature', copy: 'mature' },
];

/**
 * Mis reglas: three switches that make a session harder to leave. Each card says on
 * itself whether this phone applies it: where Screen Time is available the adult
 * content filter applies during a session; installs and purchases are ManagedSettings
 * the module does not expose yet, and Android has none of them. The footer sums it up,
 * or says why nothing applies when blocking itself is not available.
 */
export default function RulesScreen() {
  const router = useRouter();
  const { rules } = useSettings();
  const updateRules = useAppStore((state) => state.updateRules);
  const t = useStrings();
  const blocking = blockingStatus();
  const applied = appliedRules(blocking);

  const footer = !blocking.available
    ? t.settings.rules.notApplied(blocking.reason ?? '')
    : applied.length === 0
      ? t.settings.rules.noneApplied
      : t.settings.rules.applied;

  return (
    <Screen scroll>
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.settings)} title={t.settings.rules.title} />

      <Stack gap="md">
        {RULES.map(({ key, copy }) => (
          <ToggleCard
            key={key}
            title={t.settings.rules[copy].title}
            description={t.settings.rules[copy].description}
            note={blocking.available && !applied.includes(key) ? t.settings.rules.notYet : undefined}
            value={rules[key]}
            onValueChange={(value) => updateRules({ [key]: value })}
          />
        ))}
      </Stack>

      <StatusNote text={footer} align="center" />
    </Screen>
  );
}
