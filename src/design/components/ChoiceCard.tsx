import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, shadow, space } from '../tokens';
import { Check } from './Check';
import { Text } from './Text';

type ChoiceCardProps = {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  /**
   * Cannot be chosen here: a muted card, secondary text, and taps do nothing. Say why
   * in `description` — it is read out with the rest.
   */
  disabled?: boolean;
  accessibilityHint?: string;
};

/**
 * One option of a short exclusive choice, as a card: the depth of a mode, how a habit
 * is counted, the goal of the first mode. Title, a sentence, a radio on the right. A
 * radio to VoiceOver, with its title and sentence as one label.
 */
export function ChoiceCard({ title, description, selected, onPress, disabled = false, accessibilityHint }: ChoiceCardProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={description === undefined ? title : `${title}, ${description}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: selected, disabled }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: disabled ? colors.cardMuted : pressed ? colors.cardMuted : colors.card,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.text}>
          <Text variant="body" weight="medium" tone={disabled ? 'secondary' : 'primary'}>
            {title}
          </Text>
          {description === undefined ? null : (
            <Text variant="label" tone="secondary">
              {description}
            </Text>
          )}
        </View>
        <Check checked={selected} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: space.lg,
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.md,
  },
  text: {
    flex: 1,
    rowGap: space.xs,
  },
});
