import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SurfaceProvider } from '../surface';
import { useTheme } from '../theme';
import { radius, shadow, space } from '../tokens';
import { Icon } from './Icon';

type CardProps = {
  children: ReactNode;
  /** 'muted' is a card inside a card or an inactive tile. */
  tone?: 'default' | 'muted' | 'ink';
  padded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** A pressable card that is the chosen one of several: VoiceOver says "selected". */
  selected?: boolean;
  /** A chevron on the right of a pressable card: it opens something. */
  chevron?: boolean;
  /**
   * Controls that belong to the card but are not the card's own tap (Editar, '…'):
   * drawn under the content, outside the pressable, so VoiceOver reaches each one. A
   * pressable card that wrapped them would swallow them (the ScheduleCard rule).
   */
  actions?: ReactNode;
};

/** The white rounded surface everything sits on. */
export function Card({
  children,
  tone = 'default',
  padded = true,
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
  selected,
  chevron = false,
  actions,
}: CardProps) {
  const { colors } = useTheme();
  const background =
    tone === 'ink' ? colors.ink : tone === 'muted' ? colors.cardMuted : colors.card;
  const surface = tone === 'muted' ? 'muted' : 'card';
  const content =
    chevron && onPress !== undefined ? (
      <View style={styles.chevronRow}>
        <View style={styles.grow}>{children}</View>
        <Icon name="chevron-right" size="sm" tone={tone === 'ink' ? 'onInkSecondary' : 'secondary'} />
      </View>
    ) : (
      children
    );

  if (actions !== undefined) {
    // Two siblings in one surface: the pressable content, then the actions.
    return (
      <SurfaceProvider surface={surface}>
        <View style={[styles.card, { backgroundColor: background, shadowColor: colors.shadow }, style]}>
          {onPress === undefined ? (
            <View style={padded ? styles.padded : null} accessible={accessibilityLabel !== undefined} accessibilityLabel={accessibilityLabel}>
              {content}
            </View>
          ) : (
            <Pressable
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityHint={accessibilityHint}
              accessibilityState={selected === undefined ? undefined : { selected }}
              style={({ pressed }) => [styles.top, padded ? styles.padded : null, pressed ? { backgroundColor: colors.cardMuted } : null]}
            >
              {content}
            </Pressable>
          )}
          <View style={padded ? styles.actions : null}>{actions}</View>
        </View>
      </SurfaceProvider>
    );
  }

  const base = [
    styles.card,
    { backgroundColor: background, shadowColor: colors.shadow },
    padded ? styles.padded : null,
    style,
  ];

  if (onPress === undefined) {
    // A static card can still be one VoiceOver element when it is given a label.
    return (
      <SurfaceProvider surface={surface}>
        <View
          style={base}
          accessible={accessibilityLabel !== undefined}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
        >
          {content}
        </View>
      </SurfaceProvider>
    );
  }
  return (
    <SurfaceProvider surface={surface}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={selected === undefined ? undefined : { selected }}
        style={({ pressed }) => [base, pressed ? { backgroundColor: colors.cardMuted } : null]}
      >
        {content}
      </Pressable>
    </SurfaceProvider>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    ...shadow.card,
  },
  // The pressed tint follows the card's top corners; the actions sit below it.
  top: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  padded: {
    padding: space.lg,
  },
  actions: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
  chevronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.md,
  },
  grow: {
    flex: 1,
  },
});
