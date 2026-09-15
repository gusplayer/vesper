import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { Text } from './Text';

type Segment<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  segments: ReadonlyArray<Segment<T>>;
  value: T;
  onChange: (value: T) => void;
};

/** Two or three pills side by side; the chosen one is ink. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.cardMuted }]}>
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => onChange(segment.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active ? { backgroundColor: colors.ink } : null]}
          >
            <Text variant="label" weight="medium" tone={active ? 'onInk' : 'secondary'} align="center">
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: space.xs,
  },
  segment: {
    flex: 1,
    minHeight: layout.touchTarget - space.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
});
