import { useState } from 'react';

import { useAppStore, useWeekProgress } from '../../data';
import { Card, Chip, ProgressBar, Section, Sheet, Stack, Text } from '../../design/components';
import { HOUR } from '../../domain/time';
import { hasTarget, WEEKLY_TARGET_HOURS } from '../../domain/week';
import { focusOfTargetText } from '../../lib/format';
import { daysText } from './text';

type WeeklyGoalSectionProps = {
  now: number;
};

/** The weekly focus goal: progress against it, and a sheet to change it. ADR-0013. */
export function WeeklyGoalSection({ now }: WeeklyGoalSectionProps) {
  const week = useWeekProgress(now);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [open, setOpen] = useState(false);
  const targetMs = week.targetMs;
  const hasGoal = hasTarget(targetMs);

  const status = !hasGoal
    ? 'Sin meta. Tocá para elegir una.'
    : week.met
      ? 'Meta cumplida'
      : `${daysText(week.daysLeft)} para el cierre`;

  const choose = (ms: number | null) => {
    updateSettings({ weeklyTargetMs: ms });
    setOpen(false);
  };

  return (
    <Section title="Meta semanal">
      <Card onPress={() => setOpen(true)} accessibilityLabel="Cambiar la meta semanal">
        <Stack gap="sm">
          <Text variant="heading">{focusOfTargetText(week)}</Text>
          <Text variant="label" tone="secondary">
            {status}
          </Text>
          <ProgressBar progress={hasTarget(targetMs) ? week.focusMs / targetMs : 0} />
        </Stack>
      </Card>
      <Text variant="caption" tone="tertiary">
        Se reinicia el lunes. Una meta por semana, sin rachas.
      </Text>
      <Sheet visible={open} title="Horas por semana" onClose={() => setOpen(false)}>
        <Stack direction="row" gap="sm" wrap>
          {WEEKLY_TARGET_HOURS.map((hours) => (
            <Chip
              key={hours}
              label={`${hours}h`}
              selected={targetMs === hours * HOUR}
              onPress={() => choose(hours * HOUR)}
            />
          ))}
          <Chip label="Ninguna" selected={!hasGoal} onPress={() => choose(null)} />
        </Stack>
      </Sheet>
    </Section>
  );
}
