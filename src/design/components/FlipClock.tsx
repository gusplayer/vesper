import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { FlipDigit } from './FlipDigit';
import { Text } from './Text';

type FlipClockProps = {
  /** Already formatted: '24:13' or '1:02:03'. Digits become cards; colons stay text. */
  value: string;
  /** 1 in the session; larger sideways. */
  scale?: number;
};

/** A split-flap clock: one card per digit, a colon between groups. */
export function FlipClock({ value, scale = 1 }: FlipClockProps) {
  return (
    <View style={styles.row} accessibilityLabel={value}>
      {value.split('').map((char, index) =>
        char === ':' ? (
          <Text key={index} variant="hero" tone="secondary">
            :
          </Text>
        ) : (
          <FlipDigit key={index} value={char} scale={scale} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: space.xs,
    flexWrap: 'nowrap',
  },
});
