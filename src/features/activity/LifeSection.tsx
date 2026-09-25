import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { useLife, useSettings, useUsage } from '../../data';
import { Card, DotGrid, NoticeCard, Section, Stack, StatusNote, Tappable, Text } from '../../design/components';
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
 *
 * On the demo the last line says so and why, with the reason `platform/usage` gives
 * (the same one Hoy shows): Screen Time is not the answer on Android, and on iOS the
 * real figure never leaves the Report (ADR-0004), so nothing promises it arrives.
 */
export function LifeSection({ now }: LifeSectionProps) {
  const router = useRouter();
  const life = useLife(now);
  const settings = useSettings();
  const usage = useUsage();
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
        <NoticeCard
          title={copy.noBirthTitle}
          body={copy.noBirthBody}
          trailing="chevron"
          onPress={() => router.push('/settings/life')}
          accessibilityHint={copy.goToLife}
        />
      </Section>
    );
  }

  const consumedWeeks = Math.round(projectedWeeksConsumed(usage.weekMs, life.left));
  const resolved = resolveExpectancy(settings.country, settings.sex);
  const sourceText =
    settings.lifeExpectancyYears !== resolved.years
      ? copy.manualSource(yearsText(settings.lifeExpectancyYears, tag))
      : resolved.source === 'default'
        ? `${expectancySourceText(resolved, settings.sex, t.settings.lifeExpectancy, tag)} ${copy.refineHint}`
        : expectancySourceText(resolved, settings.sex, t.settings.lifeExpectancy, tag);
  const leftText = unit === 'weeks' ? copy.weeks(life.left, tag) : copy.days(life.left * 7, tag);
  const consumedText =
    unit === 'weeks' ? copy.weeks(consumedWeeks, tag) : copy.days(consumedWeeks * 7, tag);
  const paceNote =
    usage.source === 'device'
      ? copy.deviceNote
      : usage.reason === null
        ? t.activity.life.demoNote
        : `${t.activity.life.demoNote} ${usage.reason}`;

  return (
    <Section title={copy.title}>
      <Card>
        <Stack gap="md">
          <Tappable
            onPress={() => setUnit(unit === 'weeks' ? 'days' : 'weeks')}
            accessibilityLabel={copy.tapHint(leftText, unit === 'weeks')}
          >
            <Stack gap="xs">
              <Text variant="title">{copy.youHaveLeft(leftText)}</Text>
              <Text variant="body" tone="secondary">
                {copy.makeThemCount}
              </Text>
              <Text variant="caption" tone="secondary">
                {sourceText}
              </Text>
              <Text variant="caption" tone="tertiary">
                {unit === 'weeks' ? copy.tapToSeeDays : copy.tapToSeeWeeks}
              </Text>
            </Stack>
          </Tappable>
          <DotGrid
            cells={cells}
            columns={LIFE_COLUMNS}
            dense
            fill
            accessibilityLabel={t.activity.life.gridA11y(life.lived, life.total, tag)}
          />
          <Stack gap="xs">
            <Text variant="label" tone="secondary">
              {copy.atYourPace(consumedText)}
            </Text>
            <StatusNote text={paceNote} />
          </Stack>
        </Stack>
      </Card>
    </Section>
  );
}
