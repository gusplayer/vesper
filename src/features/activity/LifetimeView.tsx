import { useMemo } from 'react';

import type { DayStat } from '../../data/types';
import { Columns, DotGrid, Stack, StatCard, Text } from '../../design/components';
import { useLocale, useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { capitalize, monthLabel } from './dates';
import { HabitsSection } from './HabitsSection';
import { LifeSection } from './LifeSection';
import { lifetimeTotals, recentMonths } from './selectors';
import { daysText, hoursText } from './text';
import { TodaySection } from './TodaySection';
import { WeeklyGoalSection } from './WeeklyGoalSection';

type LifetimeViewProps = {
  stats: ReadonlyArray<DayStat>;
  now: number;
};

/**
 * Brick's two lifetime cards, then what only Vesper has: the weekly goal, the habits,
 * today's ledger and the weeks of life.
 */
export function LifetimeView({ stats, now }: LifetimeViewProps) {
  const t = useStrings();
  const { tag } = useLocale();
  const totals = useMemo(() => lifetimeTotals(stats), [stats]);
  const months = useMemo(() => recentMonths(stats, now, 4, t.activity), [stats, now, t]);

  return (
    <Stack gap="lg">
      <StatCard
        tone="ink"
        label={t.activity.lifetime.totalFocused}
        value={hoursText(totals.totalMs, t.activity, tag)}
        description={
          totals.bestDayMs > 0
            ? t.activity.lifetime.bestDay(durationText(totals.bestDayMs))
            : t.activity.lifetime.noSessionYet
        }
      />
      <StatCard
        label={t.activity.lifetime.daysWithFocus}
        value={daysText(totals.daysFocused, t.activity, tag)}
        description={
          totals.firstAt === null
            ? t.activity.lifetime.noDayYet
            : t.activity.lifetime.since(monthLabel(totals.firstAt, t.activity))
        }
      >
        <Columns count={2}>
          {months.map((month) => (
            <Stack key={month.key} gap="xs">
              <Text variant="caption" tone="secondary">
                {capitalize(month.label)}
              </Text>
              <DotGrid cells={month.cells} columns={7} fill />
            </Stack>
          ))}
        </Columns>
      </StatCard>
      <WeeklyGoalSection now={now} />
      <HabitsSection now={now} />
      <TodaySection now={now} />
      <LifeSection now={now} />
    </Stack>
  );
}
