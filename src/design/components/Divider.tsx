import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';

/** A hairline. */
export function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.line, { backgroundColor: colors.line }]} />;
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
  },
});
