import { StyleSheet, Text, View } from 'react-native';

import { color, font, space } from '../tokens';

type LedgerRowProps = {
  label: string;
  value: string;
  /**
   * How loudly the row speaks. Verified time is 'strong', declared and estimated are
   * 'normal', unregistered time is 'faint'. Never a color — there is no green here.
   */
  tone?: 'strong' | 'normal' | 'faint';
};

export function LedgerRow({ label, value, tone = 'normal' }: LedgerRowProps) {
  const textStyle = tone === 'strong' ? styles.strong : tone === 'faint' ? styles.faint : styles.normal;

  return (
    <View style={styles.row}>
      <Text style={[styles.text, textStyle]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.text, textStyle]}>{value}</Text>
    </View>
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
    fontSize: font.size.body,
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
});
