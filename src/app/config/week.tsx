import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { dayBounds, dayKeyOf, weekStart } from '../../domain/day';
import { weeklyProgress } from '../../domain/habits';
import { WEEKLY_TARGET_HOURS, isClosingDay, weekProgress } from '../../domain/week';
import * as habitsRepo from '../../db/repositories/habits';
import * as sessionsRepo from '../../db/repositories/sessions';
import * as settings from '../../db/repositories/settings';
import { Caption } from '../../design/components/Caption';
import { ChipRow } from '../../design/components/ChipRow';
import { Chip } from '../../design/components/Chip';
import { Label } from '../../design/components/Label';
import { LedgerRow } from '../../design/components/LedgerRow';
import { Rule } from '../../design/components/Rule';
import { Screen } from '../../design/components/Screen';
import { ScreenHeader } from '../../design/components/ScreenHeader';
import { durationText } from '../../lib/format';

const HOUR = 3_600_000;

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
  const [targetMs, setTargetMs] = useState<number | null>(() =>
    settings.getNumber(settings.SETTING_KEYS.weeklyFocusTargetMs),
  );

  const closing = useMemo(() => {
    const now = Date.now();
    if (!isClosingDay(now)) {
      return null;
    }

    const { dayEnd } = dayBounds(now);
    const from = weekStart(now);
    const sessions = sessionsRepo.listBetween(from, dayEnd);
    const todayKey = dayKeyOf(now);

    return {
      week: weekProgress(
        sessions,
        (session) => sessionsRepo.servedMs(session, now),
        targetMs,
        now,
      ),
      habits: weeklyProgress(
        habitsRepo.listActive(),
        habitsRepo.listMarksBetween(dayKeyOf(from), todayKey),
        todayKey,
      ),
      sessionCount: sessions.length,
    };
    // targetMs on purpose: changing the target re-reads the closing against it.
  }, [targetMs]);

  function update(next: number | null): void {
    setTargetMs(next);
    settings.setNumber(settings.SETTING_KEYS.weeklyFocusTargetMs, next ?? 0, Date.now());
  }

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
            value={
              closing.week.targetMs === null || closing.week.targetMs <= 0
                ? durationText(closing.week.focusMs)
                : `${durationText(closing.week.focusMs)} de ${durationText(closing.week.targetMs)}`
            }
            tone={closing.week.met ? 'strong' : 'normal'}
          />
          <LedgerRow
            label="sesiones"
            value={String(closing.sessionCount)}
            tone="normal"
          />
          {closing.habits.map((progress) => (
            <LedgerRow
              key={progress.habit.id}
              label={progress.habit.name}
              value={
                progress.met ? 'hecho' : `${progress.markedDays} de ${progress.habit.weeklyTarget}`
              }
              tone={progress.met ? 'strong' : 'normal'}
            />
          ))}
          <Caption>
            {closing.week.targetMs === null || closing.week.targetMs <= 0
              ? 'no había meta esta semana. poné una para la que empieza mañana'
              : closing.week.met
                ? 'meta cumplida. la semana que empieza mañana arranca en cero'
                : 'la semana que empieza mañana arranca en cero. sin rachas que perder'}
          </Caption>
          <Rule />
        </>
      )}

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
