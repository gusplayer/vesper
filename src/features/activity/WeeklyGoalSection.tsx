import { useState } from 'react';

import { useAppStore, useWeekProgress } from '../../data';
import { Card, ChipGroup, ProgressBar, Section, Sheet, Stack, StatusNote, Text } from '../../design/components';
import { HOUR } from '../../domain/time';
import { hasTarget, WEEKLY_TARGET_HOURS } from '../../domain/week';
import { useLocale, useStrings } from '../../i18n';
import { durationText, focusOfTargetText } from '../../lib/format';
import { daysText } from './text';

type WeeklyGoalSectionProps = {
  now: number;
};

/**
 * The weekly focus goal: progress against it, and a sheet to change it. ADR-0013. The
 * card carries a chevron and says its progress to VoiceOver; the tap is the hint.
 */
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
  const progress = focusOfTargetText(week, t.format);
  const options = [
    ...WEEKLY_TARGET_HOURS.map((hours) => ({
      value: hours * HOUR,
      label: durationText(hours * HOUR),
      accessibilityLabel: t.activity.units.hours(hours, tag),
    })),
    { value: null, label: t.activity.weeklyGoal.none },
  ];

  return (
    <Section title={t.activity.weeklyGoal.title}>
      <Card
        onPress={() => setOpen(true)}
        chevron
        accessibilityLabel={t.activity.weeklyGoal.cardA11y(progress, status)}
        accessibilityHint={t.activity.weeklyGoal.change}
      >
        <Stack gap="sm">
          <Text variant="heading">{progress}</Text>
          <Text variant="label" tone="secondary">
            {status}
          </Text>
          <ProgressBar progress={hasTarget(targetMs) ? week.focusMs / targetMs : 0} />
        </Stack>
      </Card>
      <StatusNote text={t.activity.weeklyGoal.footer} />
      <Sheet visible={open} title={t.activity.weeklyGoal.sheetTitle} onClose={() => setOpen(false)}>
        <ChipGroup
          options={options}
          value={hasGoal ? targetMs : null}
          onChange={choose}
          accessibilityLabel={t.activity.weeklyGoal.sheetTitle}
        />
      </Sheet>
    </Section>
  );
}
