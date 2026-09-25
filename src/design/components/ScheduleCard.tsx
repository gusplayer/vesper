import { Pressable, StyleSheet, View } from 'react-native';

import { SurfaceProvider } from '../surface';
import { useTheme } from '../theme';
import { radius, shadow, space } from '../tokens';
import { Badge } from './Badge';
import { Icon } from './Icon';
import { IconCircle } from './IconCircle';
import { Text } from './Text';
import { Toggle } from './Toggle';

type ScheduleCardProps = {
  title: string;
  /** Lines under the title: status, mode, crossings. */
  lines: readonly string[];
  /** A line under the others in its own tone: 'No bloquea nada: el modo no tiene apps reales'. */
  warning?: string;
  warningTone?: 'secondary' | 'danger';
  enabled: boolean;
  onToggle?: (enabled: boolean) => void;
  /**
   * A play button in place of the switch, for a routine you start by hand. `enabled`
   * still dims the card; it just has no switch to flip.
   */
  action?: { label: string; onPress: () => void };
  /**
   * What sits on the right. Defaults to 'play' when `action` is given, 'toggle'
   * otherwise. 'none' draws a chevron: the card only opens the editor.
   */
  control?: 'toggle' | 'play' | 'none';
  /** Opens the editor. */
  onPress?: () => void;
  /**
   * A picture of the card as the Rutinas tab will show it (the onboarding): nothing
   * presses, no switch; `badge` ('activa') stands where the switch would be.
   */
  preview?: boolean;
  badge?: string;
  /** What VoiceOver reads for the text region; the switch reads the title. */
  accessibilityLabel?: string;
};

/**
 * A schedule row: the text region opens the editor, the control on the right flips it
 * or starts it. Two sibling accessibility elements on purpose — a pressable card that
 * wraps a switch swallows it for VoiceOver.
 */
export function ScheduleCard({
  title,
  lines,
  warning,
  warningTone = 'danger',
  enabled,
  onToggle,
  action,
  control,
  onPress,
  preview = false,
  badge,
  accessibilityLabel,
}: ScheduleCardProps) {
  const { colors } = useTheme();
  const shown = control ?? (action === undefined ? 'toggle' : 'play');
  const spoken = accessibilityLabel ?? [title, ...lines, ...(warning === undefined ? [] : [warning])].join(', ');

  const text = (
    <>
      <Text variant="body" weight="medium" tone={enabled ? 'primary' : 'secondary'}>
        {title}
      </Text>
      {lines.map((line, index) => (
        <Text key={index} variant="label" tone="secondary">
          {line}
        </Text>
      ))}
      {warning === undefined ? null : (
        <Text variant="label" tone={warningTone}>
          {warning}
        </Text>
      )}
    </>
  );

  const right = preview ? (
    badge === undefined ? null : <Badge label={badge} />
  ) : shown === 'play' && action !== undefined ? (
    <IconCircle name="play" onPress={action.onPress} accessibilityLabel={action.label} />
  ) : shown === 'none' ? (
    <Icon name="chevron-right" size="sm" tone="secondary" />
  ) : shown === 'toggle' && onToggle !== undefined ? (
    <Toggle value={enabled} onValueChange={onToggle} accessibilityLabel={title} />
  ) : null;

  return (
    <SurfaceProvider surface="card">
      <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
        {preview || onPress === undefined ? (
          <View style={styles.text} accessible accessibilityLabel={spoken}>
            {text}
          </View>
        ) : (
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={spoken}
            style={({ pressed }) => [styles.text, styles.pressArea, pressed ? { backgroundColor: colors.cardMuted } : null]}
          >
            {text}
          </Pressable>
        )}
        {right === null ? null : <View style={styles.control}>{right}</View>}
      </View>
    </SurfaceProvider>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    ...shadow.card,
  },
  text: {
    flex: 1,
    padding: space.lg,
    rowGap: space.xxs,
  },
  // Without `overflow: hidden` (it would clip the shadow on iOS), the pressed tint
  // keeps the card's left corners by itself.
  pressArea: {
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  control: {
    paddingRight: space.lg,
    paddingLeft: space.sm,
  },
});
