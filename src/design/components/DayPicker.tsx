import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius } from '../tokens';
import { Text } from './Text';

type DayPickerProps = {
  /** Seven flags, Monday first. */
  days: readonly boolean[];
  onChange: (days: boolean[]) => void;
  /** One letter per circle, Monday first: `format.weekdayInitials`. */
  letters: readonly string[];
  /** What VoiceOver reads per circle, Monday first: `format.shortDays`. */
  labels: readonly string[];
};

/** Seven circles, Monday to Sunday. Chosen days are ink. */
export function DayPicker({ days, onChange, letters, labels }: DayPickerProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {letters.map((letter, index) => {
        const active = days[index] ?? false;
        return (
          <Pressable
            key={index}
            onPress={() => onChange(days.map((day, i) => (i === index ? !day : day)))}
            accessibilityRole="button"
            accessibilityLabel={labels[index]}
            accessibilityState={{ selected: active }}
            style={[styles.circle, { backgroundColor: active ? colors.ink : colors.card }]}
          >
            <Text variant="label" weight="medium" tone={active ? 'onInk' : 'secondary'}>
              {letter}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circle: {
    width: layout.touchTarget - 4,
    height: layout.touchTarget - 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
