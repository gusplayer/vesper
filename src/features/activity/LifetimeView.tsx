import { useMemo } from 'react';

import { useLifetimeTotals } from '../../data';
import type { DayStat } from '../../data/types';
import { Columns, DotGrid, Stack, StatCard, Text } from '../../design/components';
import { useLocale, useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { capitalize, monthLabel } from './dates';
import { HabitsSummary } from './HabitsSummary';
import { LifeSection } from './LifeSection';
import { recentMonths } from './selectors';
import { StreakSection } from './StreakSection';
import { daysText, hoursText } from './text';
import { TodaySection } from './TodaySection';
import { WeeklyGoalSection } from './WeeklyGoalSection';

type LifetimeViewProps = {
  stats: readonly DayStat[];
  now: number;
  /** The habits summary opens Semanal, where they are marked (ADR-0047 §7). */
  onShowWeek: () => void;
};

/**
 * Brick's two lifetime cards, then what only Vesper has: the weekly goal, the streak,
 * a summary of the habits (they are marked in Semanal), today's ledger and the weeks of
 * life. The two cards read every closed session
 * (`useLifetimeTotals`), not the day stats' window, so "lifetime" stays lifetime past
 * a year; the month grids are recent by nature and keep reading the day stats.
 */
export function LifetimeView({ stats, now, onShowWeek }: LifetimeViewProps) {
  const t = useStrings();
  const { tag } = useLocale();
  const totals = useLifetimeTotals();
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
              <DotGrid
                cells={month.cells}
                columns={7}
                fill
                accessibilityLabel={t.activity.spoken.monthGrid(
                  capitalize(month.label),
                  daysText(month.cells.filter(Boolean).length, t.activity, tag),
                )}
              />
            </Stack>
          ))}
        </Columns>
      </StatCard>
      <WeeklyGoalSection now={now} />
      <StreakSection now={now} />
      <HabitsSummary now={now} onShowWeek={onShowWeek} />
      <TodaySection now={now} />
      <LifeSection now={now} />
    </Stack>
  );
}
