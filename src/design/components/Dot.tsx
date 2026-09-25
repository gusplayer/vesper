import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius } from '../tokens';

type DotProps = {
  /** 'accent' is "today"; 'ink' and 'secondary' for other quiet marks. */
  tone?: 'accent' | 'ink' | 'secondary';
};

/** A small round mark beside a caption: the "today" of a day card. Decorative; the words carry it. */
export function Dot({ tone = 'accent' }: DotProps) {
  const { colors } = useTheme();
  const color = tone === 'accent' ? colors.accent : tone === 'ink' ? colors.ink : colors.inkSecondary;
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[styles.dot, { backgroundColor: color }]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: layout.todayDot,
    height: layout.todayDot,
    borderRadius: radius.pill,
  },
});
