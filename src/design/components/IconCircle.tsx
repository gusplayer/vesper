import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius } from '../tokens';
import { Icon, type IconName } from './Icon';

type IconCircleProps = {
  name: IconName;
  onPress?: () => void;
  /** 'ink' is the filled dark circle used in onboarding footers. */
  tone?: 'muted' | 'ink' | 'card';
  accessibilityLabel?: string;
};

/** A round button holding one icon: back, close, plus. */
export function IconCircle({ name, onPress, tone = 'muted', accessibilityLabel }: IconCircleProps) {
  const { colors } = useTheme();
  const background =
    tone === 'ink' ? colors.ink : tone === 'card' ? colors.card : colors.cardMuted;
  const content = (
    <View style={[styles.circle, { backgroundColor: background }]}>
      <Icon name={name} size="md" tone={tone === 'ink' ? 'onInk' : 'primary'} />
    </View>
  );
  if (onPress === undefined) {
    return content;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
