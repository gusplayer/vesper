import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, font, layout, rule, space } from '../tokens';

type LedgerRowProps = {
  label: string;
  value: string;
  /**
   * How loudly the row speaks. Verified time is 'strong', declared and estimated are
   * 'normal', unregistered time is 'faint'. Never a color — there is no green here.
   */
  tone?: 'strong' | 'normal' | 'faint';
  /** Habits are marked from the ledger, so a row can be a control. */
  onPress?: () => void;
  /** Holding a habit row opens its editing — ADR-0007 puts that flow here too. */
  onLongPress?: () => void;
  accessibilityLabel?: string;
};

export function LedgerRow({
  label,
  value,
  tone = 'normal',
  onPress,
  onLongPress,
  accessibilityLabel,
}: LedgerRowProps) {
  const textStyle = tone === 'strong' ? styles.strong : tone === 'faint' ? styles.faint : styles.normal;

  if (onPress === undefined) {
    return (
      <View style={styles.row}>
        <Text style={[styles.text, textStyle]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.text, textStyle]}>{value}</Text>
      </View>
    );
  }

  // A row that responds says so with a rule and darkens while held — ADR-0011.
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}, ${value}`}
    >
      {({ pressed }) => (
        <View>
          <View style={[styles.row, styles.tappableRow]}>
            <Text
              style={[styles.text, textStyle, pressed ? styles.pressedText : null]}
              numberOfLines={1}
            >
              {label}
            </Text>
            <Text style={[styles.text, textStyle, pressed ? styles.pressedText : null]}>
              {value}
            </Text>
          </View>
          <View style={styles.rule} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    columnGap: space.md,
    paddingVertical: space.xs,
  },
  text: {
    fontFamily: font.family.regular,
    // Small type: the PRD puts the ledger at the bottom of the screen, quietly.
    fontSize: font.size.label,
  },
  strong: {
    fontFamily: font.family.medium,
    color: color.ink,
  },
  normal: {
    color: color.ink,
  },
  faint: {
    color: color.ink60,
  },
  tappableRow: {
    minHeight: layout.touchTarget,
    alignItems: 'center',
  },
  pressedText: {
    color: color.ink,
  },
  rule: {
    height: rule.thin,
    backgroundColor: color.ink30,
  },
});
