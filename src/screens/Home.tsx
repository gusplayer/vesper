import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { dayBounds, dayKeyOf, weekStart } from '../domain/day';
import { weeklyProgress } from '../domain/habits';
import { buildLedger } from '../domain/ledger';
import { weekProgress } from '../domain/week';
import type { Depth, LedgerRow as LedgerRowData } from '../domain/types';
import * as activitiesRepo from '../db/repositories/activities';
import * as habitsRepo from '../db/repositories/habits';
import * as settingsRepo from '../db/repositories/settings';
import * as sessionConfigRepo from '../db/repositories/sessionConfig';
import * as sessionsRepo from '../db/repositories/sessions';
import { Caption } from '../design/components/Caption';
import { Label } from '../design/components/Label';
import { TextAction } from '../design/components/TextAction';
import { LedgerRow } from '../design/components/LedgerRow';
import { DisplayNumber } from '../design/components/DisplayNumber';
import { PrimaryAction } from '../design/components/PrimaryAction';
import { Rule } from '../design/components/Rule';
import { Screen } from '../design/components/Screen';
import { ScreenHeader } from '../design/components/ScreenHeader';
import { dayText, durationText, minutesText } from '../lib/format';
import { useNow } from '../lib/useNow';
import { useSessionStore } from '../store/session';

const DEPTH_LABEL: Record<Depth, string> = {
  soft: 'suave',
  firm: 'firme',
  deep: 'profundo',
};

/** Verified time is celebrated, unregistered time whispers. Never a color. */
function toneFor(row: LedgerRowData): 'strong' | 'normal' | 'faint' {
  if (row.provenance === 'verified') {
    return 'strong';
  }
  return row.provenance === 'unknown' ? 'faint' : 'normal';
}

const MAX_HABITS_HINT = 'agregar hábito';

/**
 * The header line for the weekly goal. Without a target it reports the total and says
 * nothing about progress: the app does not invent a number to measure you against.
 */
function weekSummary(week: { focusMs: number; targetMs: number | null; met: boolean; daysLeft: number }): string {
  if (week.targetMs === null || week.targetMs <= 0) {
    return `${durationText(week.focusMs)} esta semana`;
  }
  if (week.met) {
    return `meta hecha · ${durationText(week.focusMs)}`;
  }
  return `${durationText(week.focusMs)} de ${durationText(week.targetMs)} · ${week.daysLeft}d`;
}

type HomeProps = {
  /** Bumped by the pager host on focus, so the ledger reloads after a session. */
  revision: number;
};

/**
 * One tap from opening the app to being in a session. That is the whole screen.
 *
 * Tapping the big number is the only way into session config — there is no gear icon
 * anywhere in the app (ADR-0007).
 */
export function Home({ revision }: HomeProps) {
  const router = useRouter();
  // A minute is enough: nothing here counts seconds.
  const now = useNow(60_000);
  const running = useSessionStore((state) => state.session);
  const start = useSessionStore((state) => state.start);

  // Bumped locally when a habit is marked, so the ledger updates without a round trip
  // through navigation focus.
  const [marks, setMarks] = useState(0);

  const data = useMemo(() => {
    const { dayStart, dayEnd } = dayBounds(now);
    const activities = activitiesRepo.listActive();
    const config = sessionConfigRepo.loadOrDefault();
    const today = sessionsRepo.listBetween(dayStart, dayEnd);
    const week = sessionsRepo.listBetween(weekStart(now), dayEnd);
    const todayKey = dayKeyOf(now);
    const habits = habitsRepo.listActive();

    return {
      todayKey,
      habits: weeklyProgress(
        habits,
        habitsRepo.listMarksBetween(dayKeyOf(weekStart(now)), todayKey),
        todayKey,
      ),
      activities,
      config,
      ledger: buildLedger({
        dayStart,
        dayEnd,
        now,
        activities,
        sessions: today,
        healthSamples: [],
        usageEstimateMs: 0,
      }),
      sessionsToday: today.length,
      week: weekProgress(
        week,
        (session) => sessionsRepo.servedMs(session, now),
        settingsRepo.getNumber(settingsRepo.SETTING_KEYS.weeklyFocusTargetMs),
        now,
      ),
    };
    // revision and marks are dependencies on purpose: they are the signals that the
    // database changed underneath.
  }, [now, revision, running, marks]);

  const { config } = data;

  function onStart(): void {
    if (running !== null) {
      router.push('/session');
      return;
    }
    if (config === null) {
      return;
    }
    start(config, Date.now());
    router.push('/session');
  }

  const activityLabel =
    data.activities.find((activity) => activity.id === config?.activityId)?.label ?? '—';

  return (
    <Screen scroll>
      <ScreenHeader
        left={dayText(now)}
        right={weekSummary(data.week)}
        onPressRight={() => router.push('/config/week')}
      />

      <DisplayNumber
        value={config === null ? '—' : minutesText(config.plannedMs)}
        suffix="min"
        onPress={() => router.push('/config/session')}
        accessibilityLabel="duración de la sesión, toca para configurar"
      />
      <Caption>
        {config === null
          ? 'sin actividades'
          : `${activityLabel} · ${DEPTH_LABEL[config.depth]} · sin bloqueo`}
      </Caption>

      <PrimaryAction
        label={running === null ? 'empezar' : 'seguir'}
        onPress={onStart}
        disabled={config === null}
      />

      <Rule />
      <Label>hoy</Label>
      {data.ledger.rows.map((row) => (
        <LedgerRow key={row.key} label={row.label} value={durationText(row.ms)} tone={toneFor(row)} />
      ))}
      {data.ledger.declaredCapped ? <Caption>tope de 6h declarables alcanzado</Caption> : null}

      <Rule />
      <Label>esta semana</Label>
      {data.habits.map((progress) => (
        <LedgerRow
          key={progress.habit.id}
          label={progress.habit.name}
          value={
            progress.met
              ? 'hecho'
              : `${progress.markedDays} de ${progress.habit.weeklyTarget}`
          }
          tone={progress.habit.countMode === 'verified' ? 'strong' : 'normal'}
          onPress={() => {
            const now_ = Date.now();
            if (progress.markedToday) {
              habitsRepo.unmarkManual(progress.habit.id, data.todayKey);
            } else {
              habitsRepo.mark(
                { habitId: progress.habit.id, dayKey: data.todayKey, source: 'manual' },
                now_,
              );
            }
            setMarks((current) => current + 1);
          }}
          onLongPress={() => router.push({ pathname: '/config/habit-edit', params: { id: progress.habit.id } })}
          accessibilityLabel={`${progress.habit.name}, ${progress.markedDays} de ${progress.habit.weeklyTarget} esta semana, toca para ${progress.markedToday ? 'desmarcar' : 'marcar'} hoy, mantén pulsado para editar`}
        />
      ))}
      {data.habits.length === 0 ? <Caption>sin hábitos todavía</Caption> : null}
      {data.habits.length >= 5 ? null : (
        <TextAction label={MAX_HABITS_HINT} onPress={() => router.push('/config/habit')} />
      )}
    </Screen>
  );
}
