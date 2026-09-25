import { useMemo, useState } from 'react';

import type { DayStat } from '../../data/types';
import { BarChart, Card, HorizontalBars, PeriodStrip, Section, Stack, Text } from '../../design/components';
import { useLocale, useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { monthLabel, monthStart } from './dates';
import { monthBars, monthTotals, niceGuides, weekdayRhythm } from './selectors';
import { monthChartSummary } from './text';

type MonthlyViewProps = {
  stats: readonly DayStat[];
  now: number;
};

/**
 * The month's total, a bar per day, and the weekday rhythm over the whole history. The
 * chart sits on the page like the week's, and scales like it: fixed 10h/5h guides
 * flattened a month of 25-minute days to a few points.
 */
export function MonthlyView({ stats, now }: MonthlyViewProps) {
  const t = useStrings();
  const { tag } = useLocale();
  const [offset, setOffset] = useState(0);
  const periods = useMemo(
    () => [
      { key: '1', label: monthLabel(monthStart(now, 1), t.activity) },
      { key: '0', label: monthLabel(monthStart(now), t.activity) },
    ],
    [now, t],
  );
  const bars = useMemo(() => monthBars(stats, now, offset), [stats, now, offset]);
  const guides = useMemo(() => niceGuides(bars), [bars]);
  const totals = useMemo(() => monthTotals(stats, now, offset), [stats, now, offset]);
  const rhythm = useMemo(() => weekdayRhythm(stats, tag), [stats, tag]);
  const spokenChart = useMemo(
    () => monthChartSummary(bars, monthStart(now, offset), t.activity, tag),
    [bars, now, offset, t, tag],
  );
  const rhythmEmpty = rhythm.every((row) => row.value === 0);
  const current = offset === 0;

  return (
    <Stack gap="lg">
      <PeriodStrip
        options={periods}
        selectedKey={String(offset)}
        onSelect={(key) => setOffset(Number(key))}
        locale={tag}
      />
      <Section title={t.activity.monthly.totalFocused}>
        <Text variant="title">{durationText(totals.totalMs)}</Text>
        <Text variant="label" tone="secondary">
          {totals.averageMs === null
            ? t.activity.monthly.noFocusedDays(current)
            : t.activity.monthly.dailyAverage(current, durationText(totals.averageMs))}
        </Text>
      </Section>
      <BarChart
        bars={bars}
        guides={guides}
        average={totals.averageMs ?? undefined}
        averageLabel={t.activity.chart.average}
        accessibilityLabel={spokenChart}
      />
      <Card>
        <Stack gap="sm">
          <Text variant="caption" tone="secondary">
            {t.activity.monthly.patterns}
          </Text>
          <Text variant="heading">{t.activity.monthly.rhythmTitle}</Text>
          <Text variant="label" tone="secondary">
            {rhythmEmpty ? t.activity.monthly.rhythmEmpty : t.activity.monthly.rhythmDescription}
          </Text>
          {rhythmEmpty ? null : <HorizontalBars rows={rhythm} />}
        </Stack>
      </Card>
    </Stack>
  );
}
