import { useHabitsWeek } from '../../data';
import { ListGroup, ListRow, Section } from '../../design/components';
import { useStrings } from '../../i18n';

type HabitsSummaryProps = {
  now: number;
  /** Switches the tab to Semanal, where the habits are marked and edited. */
  onShowWeek: () => void;
};

/**
 * What De por vida keeps of the habits (ADR-0047 §7): marking one is a daily action and
 * lives in Semanal (`HabitsSection`); here one row says how many met their target this
 * week and opens the weekly view.
 */
export function HabitsSummary({ now, onShowWeek }: HabitsSummaryProps) {
  const t = useStrings();
  const habits = useHabitsWeek(now);
  const met = habits.filter((progress) => progress.met).length;

  return (
    <Section title={t.habits.summary.title}>
      <ListGroup>
        <ListRow
          label={t.habits.summary.label}
          value={t.habits.summary.value(met, habits.length)}
          onPress={onShowWeek}
          accessibilityHint={t.habits.summary.hint}
        />
      </ListGroup>
    </Section>
  );
}
