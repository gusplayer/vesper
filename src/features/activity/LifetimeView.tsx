import { useMemo } from 'react';

import type { DayStat } from '../../data/types';
import { DotGrid, Stack, StatCard, Text } from '../../design/components';
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
  const totals = useMemo(() => lifetimeTotals(stats), [stats]);
  const months = useMemo(() => recentMonths(stats, now, 3), [stats, now]);

  return (
    <Stack gap="lg">
      <StatCard
        tone="ink"
        label="HORAS ENFOCADO"
        value={hoursText(totals.totalMs)}
        description={
          totals.bestDayMs > 0
            ? `Tiempo que moldeaste con intención. Tu mejor día sumó ${durationText(totals.bestDayMs)}.`
            : 'Tiempo que moldeaste con intención. Tu primera sesión todavía no llegó.'
        }
      />
      <StatCard
        label="DÍAS ENFOCADO"
        value={daysText(totals.daysFocused)}
        description={
          totals.firstAt === null
            ? 'Todavía no hay días enfocados.'
            : `Desde ${monthLabel(totals.firstAt)}`
        }
      >
        <Stack gap="md">
          {months.map((month) => (
            <Stack key={month.key} gap="xs">
              <Text variant="caption" tone="secondary">
                {capitalize(month.label)}
              </Text>
              <DotGrid cells={month.cells} columns={7} size={14} />
            </Stack>
          ))}
        </Stack>
      </StatCard>
      <WeeklyGoalSection now={now} />
      <HabitsSection now={now} />
      <TodaySection now={now} />
      <LifeSection now={now} />
    </Stack>
  );
}
