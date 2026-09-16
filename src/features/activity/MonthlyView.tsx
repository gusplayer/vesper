import { useMemo, useState } from 'react';

import type { DayStat } from '../../data/types';
import { BarChart, Card, HorizontalBars, Section, Stack, Text } from '../../design/components';
import { PeriodStrip } from '../../design/components';
import { HOUR } from '../../domain/time';
import { useLocale, useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { monthLabel, monthStart } from './dates';
import { monthBars, monthTotals, weekdayRhythm } from './selectors';

const MONTH_GUIDES = [
  { value: 10 * HOUR, label: '10h' },
  { value: 5 * HOUR, label: '5h' },
] as const;

type MonthlyViewProps = {
  stats: ReadonlyArray<DayStat>;
  now: number;
};

/** The month's total, a bar per day, and the weekday rhythm over the whole history. */
export function MonthlyView({ stats, now }: MonthlyViewProps) {
  const t = useStrings();
  const { tag } = useLocale();
  const [offset, setOffset] = useState(0);
  const periods = useMemo(
    () => [
      { key: '1', label: monthLabel(monthStart(now, 1), t.activity).toUpperCase() },
      { key: '0', label: monthLabel(monthStart(now), t.activity).toUpperCase() },
    ],
    [now, t],
  );
  const bars = useMemo(() => monthBars(stats, now, offset), [stats, now, offset]);
  const totals = useMemo(() => monthTotals(stats, now, offset), [stats, now, offset]);
  const rhythm = useMemo(() => weekdayRhythm(stats, tag), [stats, tag]);
  const current = offset === 0;

  return (
    <Stack gap="lg">
      <PeriodStrip
        options={periods}
        selectedKey={String(offset)}
        onSelect={(key) => setOffset(Number(key))}
      />
      <Section title={t.activity.monthly.totalFocused}>
        <Text variant="title">{durationText(totals.totalMs)}</Text>
        <Text variant="label" tone="secondary">
          {totals.averageMs === null
            ? t.activity.monthly.noFocusedDays(current)
            : t.activity.monthly.dailyAverage(current, durationText(totals.averageMs))}
        </Text>
      </Section>
      <Card>
        <BarChart bars={bars} guides={MONTH_GUIDES} average={totals.averageMs ?? undefined} />
      </Card>
      <Card>
        <Stack gap="sm">
          <Text variant="caption" tone="secondary">
            {t.activity.monthly.patterns}
          </Text>
          <Text variant="heading">{t.activity.monthly.rhythmTitle}</Text>
          <Text variant="label" tone="secondary">
            {t.activity.monthly.rhythmDescription}
          </Text>
          <HorizontalBars rows={rhythm} />
        </Stack>
      </Card>
    </Stack>
  );
}
