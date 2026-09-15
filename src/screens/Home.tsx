import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { dayBounds, dayKeyOf } from '../domain/day';
import { buildLedger } from '../domain/ledger';
import { isDue } from '../domain/session';
import { MAX_HABITS } from '../domain/types';
import { isClosingDay } from '../domain/week';
import { loadWeekSnapshot } from '../db/queries/week';
import * as activitiesRepo from '../db/repositories/activities';
import * as habitsRepo from '../db/repositories/habits';
import * as settingsRepo from '../db/repositories/settings';
import * as sessionConfigRepo from '../db/repositories/sessionConfig';
import * as sessionsRepo from '../db/repositories/sessions';
import { Caption } from '../design/components/Caption';
import { DisplayNumber } from '../design/components/DisplayNumber';
import { Label } from '../design/components/Label';
import { LedgerRow } from '../design/components/LedgerRow';
import { PrimaryAction } from '../design/components/PrimaryAction';
import { Rule } from '../design/components/Rule';
import { Screen } from '../design/components/Screen';
import { ScreenHeader } from '../design/components/ScreenHeader';
import { TextAction } from '../design/components/TextAction';
import { dayText, durationText, habitProgressText, minutesText, weekSummaryText } from '../lib/format';
import { DEPTH_LABEL } from '../lib/labels';
import { habitTone, ledgerTone } from '../lib/tone';
import { useNow } from '../lib/useNow';
import { useRevision } from '../lib/useRevision';
import { useSessionStore } from '../store/session';

/**
 * The only explanatory text in the app, and it appears once. There is no onboarding in
 * phase 1: there is nothing to ask for and any screen before this one works against the
 * one-tap metric. See ADR-0012.
 */
const FIRST_TIME_LINE =
  'tres monedas separadas: lo que invertís, lo que Health confirma, lo que consumís. nunca se suman';

const ADD_HABIT_LABEL = 'agregar hábito';

/**
 * At the limit, the link does not vanish silently: rule 4 is a product decision, and a
 * control that disappears without a word reads as a bug. Say why, in one line.
 */
const MAX_HABITS_REACHED = 'cinco es el máximo, a propósito';

type HomeProps = {
  /** Bumped by the pager host on focus, so the ledger reloads after a session. */
  revision: number;
};

/**
 * One tap from opening the app to being in a session. That is the whole screen.
 *
 * Tapping the big number is the only way into session config — there is no gear icon
 * anywhere in the app (ADR-0007). The header opens the weekly goal, and the ledger
 * opens habit creation, because each thing is configured where it is read.
 */
export function Home({ revision }: HomeProps) {
  const router = useRouter();
  // A minute is enough: nothing here counts seconds.
  const now = useNow(60_000);
  const running = useSessionStore((state) => state.session);
  const start = useSessionStore((state) => state.start);
  const expireUnwatched = useSessionStore((state) => state.expireUnwatched);

  // Bumped locally when a habit is marked, so the ledger updates without a round trip
  // through navigation focus.
  const [marks, bumpMarks] = useRevision();

  // A session hydrated after a relaunch can run out while the user sits here. Nobody
  // watched it end, so it gets the orphan's verdict, not a completion — ARCHITECTURE.md.
  useEffect(() => {
    if (running !== null && isDue(running, now)) {
      expireUnwatched();
    }
  }, [running, now, expireUnwatched]);

  const data = useMemo(() => {
    const { dayStart, dayEnd } = dayBounds(now);
    const activities = activitiesRepo.listActive();
    const config = sessionConfigRepo.loadOrDefault();
    const todayKey = dayKeyOf(now);

    return {
      todayKey,
      config,
      activityLabel:
        activities.find((activity) => activity.id === config?.activityId)?.label ?? '—',
      ledger: buildLedger({
        dayStart,
        dayEnd,
        now,
        activities,
        sessions: sessionsRepo.listBetween(dayStart, dayEnd),
        healthSamples: [],
        usageEstimateMs: 0,
      }),
      // The first time ends when a session has been completed, not when the app opens:
      // rule 8 keys on having done a session — ADR-0012.
      firstTime:
        settingsRepo.getNumber(settingsRepo.SETTING_KEYS.onboardingCompletedAt) === null,
      ...loadWeekSnapshot(now),
    };
    // revision, marks and running are dependencies on purpose: they are the signals
    // that the database changed underneath.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function toggleHabit(habitId: string, markedToday: boolean): void {
    if (markedToday) {
      habitsRepo.unmarkManual(habitId, data.todayKey);
    } else {
      habitsRepo.mark({ habitId, dayKey: data.todayKey, source: 'manual' }, Date.now());
    }
    bumpMarks();
  }

  return (
    <Screen scroll>
      <ScreenHeader
        left={dayText(now)}
        right={weekSummaryText(data.week, isClosingDay(now))}
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
          : `${data.activityLabel} · ${DEPTH_LABEL[config.depth]} · sin bloqueo`}
      </Caption>

      <PrimaryAction
        label={running === null ? 'empezar' : 'seguir'}
        onPress={onStart}
        disabled={config === null}
      />
      {data.firstTime ? <Caption>{FIRST_TIME_LINE}</Caption> : null}

      <Rule />
      <Label>hoy</Label>
      {data.ledger.rows.map((row) => (
        <LedgerRow
          key={row.key}
          label={row.label}
          value={durationText(row.ms)}
          tone={ledgerTone(row)}
        />
      ))}
      {data.ledger.declaredCapped ? <Caption>tope de 6h declarables alcanzado</Caption> : null}

      <Rule />
      <Label>esta semana</Label>
      {data.habits.map((progress) => (
        <LedgerRow
          key={progress.habit.id}
          label={progress.habit.name}
          value={habitProgressText(progress)}
          tone={habitTone(progress)}
          onPress={() => toggleHabit(progress.habit.id, progress.markedToday)}
          onLongPress={() =>
            router.push({ pathname: '/config/habit-edit', params: { id: progress.habit.id } })
          }
          accessibilityLabel={`${progress.habit.name}, ${progress.markedDays} de ${progress.habit.weeklyTarget} esta semana, toca para ${progress.markedToday ? 'desmarcar' : 'marcar'} hoy, mantén pulsado para editar`}
        />
      ))}
      {data.habits.length === 0 ? <Caption>sin hábitos todavía</Caption> : null}
      {data.habits.length >= MAX_HABITS ? (
        <Caption>{MAX_HABITS_REACHED}</Caption>
      ) : (
        <TextAction label={ADD_HABIT_LABEL} onPress={() => router.push('/config/habit')} />
      )}
    </Screen>
  );
}
