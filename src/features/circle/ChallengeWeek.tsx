import { HeatGrid } from '../../design/components';

type ChallengeWeekProps = {
  /** One flag per day, Monday first: whether that day was marked. */
  days: readonly boolean[];
  /** The day that is today, 0 for Monday; null when the week shown is not the current one. */
  todayIndex: number | null;
  /** One letter per column, drawn above the row. Left out where the line already says it. */
  labels?: readonly string[];
  size?: 'sm' | 'md';
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * A challenge week drawn the way Focus draws its four: ink for a day delivered, an
 * outline for one that is not, today breathing (ADR-0031). It is the same grammar on
 * purpose — a challenge is a week of yours, like the week of focus above it.
 */
export function ChallengeWeek({
  days,
  todayIndex,
  labels,
  size = 'sm',
  onPress,
  accessibilityLabel,
}: ChallengeWeekProps) {
  return (
    <HeatGrid
      cells={days.map((done, index) => ({
        key: String(index),
        intensity: done ? 1 : 0,
        today: index === todayIndex,
      }))}
      columnLabels={labels}
      size={size}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
