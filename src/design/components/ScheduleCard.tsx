import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, shadow, space } from '../tokens';
import { Text } from './Text';
import { Toggle } from './Toggle';

type ScheduleCardProps = {
  title: string;
  /** Lines under the title: window, mode, crossings. */
  lines: ReadonlyArray<string>;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  /** Opens the editor. */
  onPress: () => void;
  /** What VoiceOver reads for the text region; the switch reads the title. */
  accessibilityLabel: string;
};

/**
 * A schedule row: the text region opens the editor, the switch flips it. Two sibling
 * accessibility elements on purpose — a pressable card that wraps a switch swallows
 * it for VoiceOver.
 */
export function ScheduleCard({ title, lines, enabled, onToggle, onPress, accessibilityLabel }: ScheduleCardProps) {
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
        <Toggle value={enabled} onValueChange={onToggle} accessibilityLabel={title} />
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
