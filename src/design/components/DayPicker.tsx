import { Pressable, StyleSheet, View } from 'react-native';

import { offFill, useSurface, type Surface } from '../surface';
import { useTheme } from '../theme';
import { layout, radius } from '../tokens';
import { Text } from './Text';

/** The circle is 40 so seven fit a card; the touch area still reaches 44. */
const SLOP = Math.max(0, (layout.touchTarget - layout.day) / 2);

type DayPickerProps = {
  /** Seven flags, Monday first. */
  days: readonly boolean[];
  onChange: (days: boolean[]) => void;
  /** One letter per circle, Monday first: `format.weekdayInitials`. */
  letters: readonly string[];
  /** What VoiceOver reads per circle, Monday first: `format.shortDays`. */
  labels: readonly string[];
  /** Inherited from the nearest Card; pass it only to override. */
  surface?: Surface;
};

/** Seven circles, Monday to Sunday. Chosen days are ink. */
export function DayPicker({ days, onChange, letters, labels, surface }: DayPickerProps) {
  const { colors } = useTheme();
  const on = useSurface(surface);
  return (
    <View style={styles.row}>
      {letters.map((letter, index) => {
        const active = days[index] ?? false;
        return (
          <Pressable
            key={index}
            onPress={() => onChange(days.map((day, i) => (i === index ? !day : day)))}
            accessibilityRole="checkbox"
            accessibilityLabel={labels[index]}
            accessibilityState={{ checked: active }}
            hitSlop={SLOP}
            style={[styles.circle, { backgroundColor: active ? colors.ink : offFill(colors, on) }]}
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
    width: layout.day,
    height: layout.day,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
