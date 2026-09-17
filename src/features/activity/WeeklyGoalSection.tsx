import { useState } from 'react';

import { useAppStore, useWeekProgress } from '../../data';
import { Card, Chip, ProgressBar, Section, Sheet, Stack, Text } from '../../design/components';
import { HOUR } from '../../domain/time';
import { hasTarget, WEEKLY_TARGET_HOURS } from '../../domain/week';
import { useLocale, useStrings } from '../../i18n';
import { durationText, focusOfTargetText } from '../../lib/format';
import { daysText } from './text';

type WeeklyGoalSectionProps = {
  now: number;
};

/** The weekly focus goal: progress against it, and a sheet to change it. ADR-0013. */
export function WeeklyGoalSection({ now }: WeeklyGoalSectionProps) {
  const t = useStrings();
  const { tag } = useLocale();
  const week = useWeekProgress(now);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [open, setOpen] = useState(false);
  const targetMs = week.targetMs;
  const hasGoal = hasTarget(targetMs);

  const status = !hasGoal
    ? t.activity.weeklyGoal.noGoal
    : week.met
      ? t.activity.weeklyGoal.met
      : t.activity.weeklyGoal.untilClose(daysText(week.daysLeft, t.activity, tag));

  const choose = (ms: number | null) => {
    updateSettings({ weeklyTargetMs: ms });
    setOpen(false);
  };

  return (
    <Section title={t.activity.weeklyGoal.title}>
      <Card onPress={() => setOpen(true)} accessibilityLabel={t.activity.weeklyGoal.change}>
        <Stack gap="sm">
          <Text variant="heading">{focusOfTargetText(week, t.format)}</Text>
          <Text variant="label" tone="secondary">
            {status}
          </Text>
          <ProgressBar progress={hasTarget(targetMs) ? week.focusMs / targetMs : 0} />
        </Stack>
      </Card>
      <Text variant="caption" tone="tertiary">
        {t.activity.weeklyGoal.footer}
      </Text>
      <Sheet visible={open} title={t.activity.weeklyGoal.sheetTitle} onClose={() => setOpen(false)}>
        <Stack direction="row" gap="sm" wrap>
          {WEEKLY_TARGET_HOURS.map((hours) => (
            <Chip
              key={hours}
              label={durationText(hours * HOUR)}
              selected={targetMs === hours * HOUR}
              onPress={() => choose(hours * HOUR)}
            />
          ))}
          <Chip label={t.activity.weeklyGoal.none} selected={!hasGoal} onPress={() => choose(null)} />
        </Stack>
      </Sheet>
    </Section>
  );
}
