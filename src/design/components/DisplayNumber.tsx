import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, font, space } from '../tokens';

type DisplayNumberProps = {
  value: string;
  /** Small trailing word: 'min', 'semanas'. */
  suffix?: string;
  /** When set, the number itself is the control. Tapping it opens a flow. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** The big number. One per screen, at most. */
export function DisplayNumber({ value, suffix, onPress, accessibilityLabel }: DisplayNumberProps) {
  const content = (
    <View style={styles.row}>
      <Text style={styles.value}>{value}</Text>
      {suffix === undefined ? null : <Text style={styles.suffix}>{suffix}</Text>}
    </View>
  );

  if (onPress === undefined) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${value} ${suffix ?? ''}`.trim()}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: space.sm,
  },
  value: {
    fontFamily: font.family.regular,
    fontSize: font.size.display,
    letterSpacing: font.letterSpacing.display,
    color: color.ink,
  },
  suffix: {
    fontFamily: font.family.regular,
    fontSize: font.size.body,
    color: color.ink60,
  },
});
