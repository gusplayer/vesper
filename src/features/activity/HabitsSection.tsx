import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { AccessibilityActionEvent } from 'react-native';

import { useAppStore, useChallengesByHabit, useHabitsWeek, useSettings } from '../../data';
import { ListGroup, ListRow, Section, Sheet, StatusNote, useTooltip } from '../../design/components';
import { canAddHabit, isMarkedByHealth, type HabitProgress } from '../../domain/habits';
import { useStrings } from '../../i18n';
import { habitProgressText } from '../../lib/format';
import { status as healthStatus } from '../../platform/health';
import { syncHealth } from '../../platform/hooks/useHealthSync';
import { syncedText } from '../health/format';

type HabitsSectionProps = {
  now: number;
};

/** The custom VoiceOver action that stands in for holding the row. */
const EDIT_ACTION = 'edit';

/**
 * This week's habits: a tap marks today, holding a row opens its editor (PRD: "tocar
 * marca hoy, mantener edita"), and 'Editar hábitos' is the same path for whoever does
 * not hold. The check on the right is today's mark. Counts, never time
 * (domain/habits.ts). While Health is connected a verified habit is Health's to mark:
 * a tap says so, and reads Health again in case a workout just ended (the regular
 * sync waits 15 minutes between reads).
 */
export function HabitsSection({ now }: HabitsSectionProps) {
  const t = useStrings();
  const router = useRouter();
  const habits = useHabitsWeek(now);
  const challengesByHabit = useChallengesByHabit(now);
  const settings = useSettings();
  const toggleHabitToday = useAppStore((state) => state.toggleHabitToday);
  const [editing, setEditing] = useState(false);
  const tooltip = useTooltip();
  const full = !canAddHabit(habits.length);

  // Without Health the verified habit still takes a tap, and the row says the mark
  // is manual: declared time, never mixed with verified (ADR-0005). Where Health
  // cannot exist, the row says why in the words of `status().reason` (rule 8).
  const health = healthStatus();
  const verifiedText = settings.healthConnected
    ? t.habits.section.verifiedSynced(syncedText(settings.healthSyncedAt, t.habits))
    : !health.available && health.reason !== null
      ? t.habits.section.verifiedManual(health.reason)
      : t.habits.section.verifiedNoHealth;

  // A habit that is also a challenge says so: the same marks, with witnesses
  // (ADR-0031). It keeps its counting line, so a verified one still says who marks it.
  const descriptionFor = (progress: HabitProgress) => {
    const counting = progress.habit.countMode === 'verified' ? verifiedText : t.habits.section.declared;
    const challenge = challengesByHabit.get(progress.habit.id);
    return challenge === undefined
      ? counting
      : t.habits.section.joined(t.circle.challenge.habitLine(challenge.others), counting);
  };

  // Before ADR-0041 the editor could save 'verified' for a name nothing maps to; such a
  // habit is not locked, so it can still be marked by hand (domain/habits.ts).
  const lockedByHealth = (progress: HabitProgress) => isMarkedByHealth(progress.habit, settings.healthConnected);

  const openEditor = (id: string) => router.push({ pathname: '/habits/edit', params: { id } });

  // The tap's moment comes in as a parameter, the way the store takes `now`: the row's
  // handler reads the clock, not a helper the list closes over while rendering.
  const press = (progress: HabitProgress, tappedAt: number) => {
    if (!lockedByHealth(progress)) {
      toggleHabitToday(progress.habit.id, tappedAt);
      return;
    }
    // Health may know something the last read did not: read it now, past the cooldown.
    if (!progress.markedToday) {
      void syncHealth(true);
    }
    tooltip.show(t.habits.section.healthTip);
  };

  const hintFor = (progress: HabitProgress) =>
    lockedByHealth(progress)
      ? t.habits.section.hintHealth
      : progress.markedToday
        ? t.habits.section.hintUnmark
        : t.habits.section.hintMark;

  const onAction = (progress: HabitProgress) => (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === EDIT_ACTION) {
      openEditor(progress.habit.id);
    }
  };

  return (
    <Section title={t.habits.section.title}>
      {tooltip.element}
      <ListGroup>
        {habits.map((progress) => {
          const value = habitProgressText(progress, t.format);
          const description = descriptionFor(progress);
          return (
            <ListRow
              key={progress.habit.id}
              label={progress.habit.name}
              description={description}
              value={value}
              selection="checkbox"
              selected={progress.markedToday}
              onPress={() => press(progress, Date.now())}
              onLongPress={() => openEditor(progress.habit.id)}
              accessibilityLabel={t.habits.section.rowA11y(progress.habit.name, value, description)}
              accessibilityHint={hintFor(progress)}
              accessibilityActions={[{ name: EDIT_ACTION, label: t.habits.edit.title }]}
              onAccessibilityAction={onAction(progress)}
            />
          );
        })}
        {habits.length === 0 ? null : (
          <ListRow label={t.habits.section.edit} onPress={() => setEditing(true)} />
        )}
        {full ? null : (
          <ListRow label={t.habits.section.add} icon="plus" onPress={() => router.push('/habits/new')} />
        )}
      </ListGroup>
      {habits.length === 0 ? (
        <StatusNote kind="empty" text={t.habits.section.empty} />
      ) : (
        <StatusNote text={settings.healthConnected ? t.habits.section.helpHealth : t.habits.section.help} />
      )}
      {full ? <StatusNote text={t.habits.section.fiveIsMax} /> : null}
      <Sheet visible={editing} title={t.habits.section.edit} onClose={() => setEditing(false)}>
        <ListGroup>
          {habits.map((progress) => (
            <ListRow
              key={progress.habit.id}
              label={progress.habit.name}
              onPress={() => {
                setEditing(false);
                openEditor(progress.habit.id);
              }}
            />
          ))}
        </ListGroup>
      </Sheet>
    </Section>
  );
}
