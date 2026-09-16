import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';

import { USAGE, useLife, useSettings } from '../../data';
import { Card, DotGrid, Section, Stack, Text } from '../../design/components';
import { projectedWeeksConsumed } from '../../domain/life';
import { expectancySourceText, resolveExpectancy, yearsText } from '../../domain/lifeExpectancy';
import { useLocale, useStrings } from '../../i18n';

/** 52 weeks a row: a year per line, like the classic life calendar. */
const LIFE_COLUMNS = 52;

type Unit = 'weeks' | 'days';

type LifeSectionProps = {
  now: number;
};

/**
 * Weeks left, a grid of the ones lived, and what the current social pace would take
 * from the rest. Framing, not a countdown (docs/PRD.md). Tapping the number switches
 * between weeks and days: the same time, at a scale that lands differently.
 */
export function LifeSection({ now }: LifeSectionProps) {
  const router = useRouter();
  const life = useLife(now);
  const settings = useSettings();
  const t = useStrings();
  const { tag } = useLocale();
  const copy = t.settings.lifeSection;
  const [unit, setUnit] = useState<Unit>('weeks');
  const cells = useMemo(
    () => (life === null ? [] : Array.from({ length: life.total }, (_, i) => i < life.lived)),
    [life],
  );

  if (life === null) {
    return (
      <Section title={copy.title}>
        <Card onPress={() => router.push('/settings/life')} accessibilityLabel={copy.goToLife}>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {copy.noBirthTitle}
            </Text>
            <Text variant="label" tone="secondary">
              {copy.noBirthBody}
            </Text>
          </Stack>
        </Card>
      </Section>
    );
  }

  const consumedWeeks = Math.round(projectedWeeksConsumed(USAGE.weekMs, life.left));
  const resolved = resolveExpectancy(settings.country, settings.sex);
  const sourceText =
    settings.lifeExpectancyYears !== resolved.years
      ? copy.manualSource(yearsText(settings.lifeExpectancyYears, tag))
      : resolved.source === 'default'
        ? `${expectancySourceText(resolved, settings.sex, t.settings.lifeExpectancy, tag)} ${copy.refineHint}`
        : expectancySourceText(resolved, settings.sex, t.settings.lifeExpectancy, tag);
  const leftText = unit === 'weeks' ? copy.weeks(life.left) : copy.days(life.left * 7);
  const consumedText = unit === 'weeks' ? copy.weeks(consumedWeeks) : copy.days(consumedWeeks * 7);

  return (
    <Section title={copy.title}>
      <Card>
        <Stack gap="md">
          <Pressable
            onPress={() => setUnit(unit === 'weeks' ? 'days' : 'weeks')}
            accessibilityRole="button"
            accessibilityLabel={copy.tapHint(leftText, unit === 'weeks')}
          >
            <Stack gap="xs">
              <Text variant="title">{copy.youHaveLeft(leftText)}</Text>
              <Text variant="body" tone="secondary">
                {copy.makeThemCount}
              </Text>
              <Text variant="caption" tone="tertiary">
                {sourceText}
              </Text>
              <Text variant="caption" tone="tertiary">
                {unit === 'weeks' ? copy.tapToSeeDays : copy.tapToSeeWeeks}
              </Text>
            </Stack>
          </Pressable>
          <DotGrid cells={cells} columns={LIFE_COLUMNS} gap={1} fill />
          <Stack gap="xs">
            <Text variant="label" tone="secondary">
              {copy.atYourPace(consumedText)}
            </Text>
            <Text variant="caption" tone="tertiary">
              {copy.estimateNote}
            </Text>
          </Stack>
        </Stack>
      </Card>
    </Section>
  );
}
