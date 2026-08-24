import { useRouter } from 'expo-router';
import { useState } from 'react';

import { WEEKLY_TARGET_HOURS } from '../../domain/week';
import * as settings from '../../db/repositories/settings';
import { Caption } from '../../design/components/Caption';
import { ChipRow } from '../../design/components/ChipRow';
import { Chip } from '../../design/components/Chip';
import { Label } from '../../design/components/Label';
import { Screen } from '../../design/components/Screen';
import { ScreenHeader } from '../../design/components/ScreenHeader';

const HOUR = 3_600_000;

/**
 * The weekly focus goal. Reached by tapping the progress in the home header, which is
 * where it is read — there is no settings screen (ADR-0007).
 *
 * No goal is a valid answer, and it is the default. The app does not invent a number
 * for you.
 */
export default function WeekConfigScreen() {
  const router = useRouter();
  const [targetMs, setTargetMs] = useState<number | null>(() =>
    settings.getNumber(settings.SETTING_KEYS.weeklyFocusTargetMs),
  );

  function update(next: number | null): void {
    setTargetMs(next);
    settings.setNumber(settings.SETTING_KEYS.weeklyFocusTargetMs, next ?? 0, Date.now());
  }

  return (
    <Screen scroll>
      <ScreenHeader left="meta semanal" right="listo" onPressRight={() => router.back()} />

      <Label>horas de foco por semana</Label>
      <ChipRow>
        {WEEKLY_TARGET_HOURS.map((hours) => (
          <Chip
            key={hours}
            label={String(hours)}
            selected={targetMs === hours * HOUR}
            onPress={() => update(hours * HOUR)}
          />
        ))}
        <Chip
          label="ninguna"
          selected={targetMs === null || targetMs <= 0}
          onPress={() => update(null)}
        />
      </ChipRow>

      <Caption>
        se reinicia el lunes. una meta por semana, no rachas diarias: enfermarse un martes
        no debería costarte nada
      </Caption>
    </Screen>
  );
}
