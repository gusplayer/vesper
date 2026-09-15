import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, shadow, space } from '../tokens';
import { IconCircle } from './IconCircle';
import { Text } from './Text';
import { Toggle } from './Toggle';

type ScheduleCardProps = {
  title: string;
  /** Lines under the title: status, mode, crossings. */
  lines: ReadonlyArray<string>;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  /**
   * A play button in place of the switch, for a routine you start by hand. `enabled`
   * still dims the card; it just has no switch to flip.
   */
  action?: { label: string; onPress: () => void };
  /** Opens the editor. */
  onPress: () => void;
  /** What VoiceOver reads for the text region; the switch reads the title. */
  accessibilityLabel: string;
};

/**
 * A schedule row: the text region opens the editor, the control on the right flips it
 * or starts it. Two sibling accessibility elements on purpose — a pressable card that
 * wraps a switch swallows it for VoiceOver.
 */
export function ScheduleCard({
  title,
  lines,
  enabled,
  onToggle,
  action,
  onPress,
  accessibilityLabel,
}: ScheduleCardProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.text, pressed ? { backgroundColor: colors.cardMuted } : null]}
      >
        <Text variant="body" weight="semibold" tone={enabled ? 'primary' : 'secondary'}>
          {title}
        </Text>
        {lines.map((line, index) => (
          <Text key={index} variant="label" tone="secondary">
            {line}
          </Text>
        ))}
      </Pressable>
      <View style={styles.control}>
        {action === undefined ? (
          <Toggle value={enabled} onValueChange={onToggle} accessibilityLabel={title} />
        ) : (
          <IconCircle name="play" onPress={action.onPress} accessibilityLabel={action.label} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  text: {
    flex: 1,
    padding: space.lg,
    rowGap: 2,
  },
  control: {
    paddingRight: space.lg,
    paddingLeft: space.sm,
  },
});
