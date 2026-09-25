import { Pressable, StyleSheet, View } from 'react-native';

import { useSurface, type Surface } from '../surface';
import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { Text } from './Text';

type Segment<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Inherited from the nearest Card; pass it only to override. */
  surface?: Surface;
};

/** Two or three pills side by side; the chosen one is ink. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  surface,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  // On the page the muted track is the page's own grey; there it is a card.
  const on = useSurface(surface);
  return (
    <View
      style={[styles.track, { backgroundColor: on === 'card' ? colors.cardMuted : colors.card }]}
      accessibilityRole="radiogroup"
    >
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => onChange(segment.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            // The track's padding makes up the rest of the 44 pt.
            hitSlop={{ top: space.xs, bottom: space.xs }}
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
