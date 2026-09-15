import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { HOUR } from '../../domain/time';
import { WEEKLY_TARGET_HOURS, hasTarget, isClosingDay, isPresetTarget } from '../../domain/week';
import { loadWeekSnapshot } from '../../db/queries/week';
import * as settings from '../../db/repositories/settings';
import { Caption } from '../../design/components/Caption';
import { Label } from '../../design/components/Label';
import { LedgerRow } from '../../design/components/LedgerRow';
import { OptionChips } from '../../design/components/OptionChips';
import { Rule } from '../../design/components/Rule';
import { Screen } from '../../design/components/Screen';
import { ScreenHeader } from '../../design/components/ScreenHeader';
import {
  durationText,
  focusOfTargetText,
  habitProgressText,
  weekClosingText,
} from '../../lib/format';
import { habitTone } from '../../lib/tone';

const NONE = 'ninguna';

/**
 * The weekly focus goal, and on Sunday, the closing of the week.
 *
 * Reached by tapping the progress in the home header, which is where it is read — there
 * is no settings screen (ADR-0007). It doubles as the closing screen rather than adding a
 * fourth one, and the order is the natural one: see how it went, then choose the next
 * target (ADR-0013).
 *
 * No goal is a valid answer, and it is the default. The app does not invent a number for
 * you.
 */
export default function WeekConfigScreen() {
  const router = useRouter();
  const [targetMs, setTargetMs] = useState<number | null>(() => settings.getWeeklyTargetMs());

  // On Sunday the closing is read against the target being chosen, so it re-reads.
  const closing = useMemo(() => {
    const now = Date.now();
    return isClosingDay(now) ? loadWeekSnapshot(now) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMs]);

  function update(next: number | null): void {
    setTargetMs(next);
    settings.setWeeklyTargetMs(next, Date.now());
  }

  const selected = hasTarget(targetMs) ? String(targetMs / HOUR) : NONE;

  return (
    <Screen scroll>
      <ScreenHeader
        left={closing === null ? 'meta semanal' : 'cierre de la semana'}
        right="listo"
        onPressRight={() => router.back()}
      />

      {closing === null ? null : (
        <>
          <LedgerRow
            label="foco"
            value={focusOfTargetText(closing.week)}
            tone={closing.week.met ? 'strong' : 'normal'}
          />
          <LedgerRow label="sesiones" value={String(closing.sessionCount)} tone="normal" />
          {closing.habits.map((progress) => (
            <LedgerRow
              key={progress.habit.id}
              label={progress.habit.name}
              value={habitProgressText(progress)}
              tone={habitTone(progress)}
            />
          ))}
          <Caption>{weekClosingText(closing.week)}</Caption>
          <Rule />
        </>
      )}

      <Label>horas de foco por semana</Label>
      <OptionChips
        options={[
          ...WEEKLY_TARGET_HOURS.map((hours) => ({ value: String(hours) })),
          // A stored target outside the presets still shows as selected instead of
          // leaving every chip unselected, which reads as no goal when there is one.
          ...(isPresetTarget(targetMs) || targetMs === null
            ? []
            : [{ value: String(targetMs / HOUR), label: durationText(targetMs) }]),
          { value: NONE },
        ]}
        selected={selected}
        onSelect={(value) => update(value === NONE ? null : Number(value) * HOUR)}
      />

      <Caption>
        se reinicia el lunes. una meta por semana, no rachas diarias: enfermarse un martes
        no debería costarte nada
      </Caption>
    </Screen>
  );
}
