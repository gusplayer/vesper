import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { radius, shadow, space } from '../tokens';

type CardProps = {
  children: ReactNode;
  /** 'muted' is a card inside a card or an inactive tile. */
  tone?: 'default' | 'muted' | 'ink';
  padded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** The white rounded surface everything sits on. */
export function Card({
  children,
  tone = 'default',
  padded = true,
  onPress,
  style,
  accessibilityLabel,
}: CardProps) {
  const { colors } = useTheme();
  const background =
    tone === 'ink' ? colors.ink : tone === 'muted' ? colors.cardMuted : colors.card;
  const base = [
    styles.card,
    { backgroundColor: background, shadowColor: colors.shadow },
    padded ? styles.padded : null,
    style,
  ];

  if (onPress === undefined) {
    return <View style={base}>{children}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed ? { backgroundColor: colors.cardMuted } : null]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    ...shadow.card,
  },
  padded: {
    padding: space.lg,
  },
});
