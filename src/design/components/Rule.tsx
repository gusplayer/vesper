import { StyleSheet, View } from 'react-native';

import { color, rule } from '../tokens';

type RuleProps = {
  /** 'thick' in ink separates a header. 'thin' in ink30 separates sections. */
  weight?: 'thick' | 'thin';
};

export function Rule({ weight = 'thin' }: RuleProps) {
  return <View style={weight === 'thick' ? styles.thick : styles.thin} />;
}

const styles = StyleSheet.create({
  thick: {
    height: rule.thick,
    backgroundColor: color.ink,
  },
  thin: {
    height: rule.thin,
    backgroundColor: color.ink30,
  },
});
