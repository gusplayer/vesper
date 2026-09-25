import { StyleSheet, View } from 'react-native';

import type { Surface } from '../surface';
import { space } from '../tokens';
import { Chip } from './Chip';

export type ChipOption<T> = {
  value: T;
  label: string;
  /** When the label alone is not enough for VoiceOver. */
  accessibilityLabel?: string;
  disabled?: boolean;
};

type ChipGroupProps<T> = {
  options: readonly ChipOption<T>[];
  /** The chosen value; null (or a value no option has) when nothing is chosen. */
  value: T | null;
  onChange: (value: T) => void;
  /** What the group is, for VoiceOver: 'Veces por semana'. */
  accessibilityLabel?: string;
  /** Passed to every chip; inherited from the nearest Card when left out. */
  surface?: Surface;
};

/**
 * One choice among a few chips, wrapping onto new lines: the weekly goal, the session
 * length, times per week. A radio group to VoiceOver; each chip is a radio.
 */
export function ChipGroup<T extends string | number | null>({
  options,
  value,
  onChange,
  accessibilityLabel,
  surface,
}: ChipGroupProps<T>) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => (
        <Chip
          key={String(option.value)}
          label={option.label}
          selected={option.value === value}
          onPress={() => onChange(option.value)}
          accessibilityLabel={option.accessibilityLabel}
          accessibilityRole="radio"
          disabled={option.disabled}
          surface={surface}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
