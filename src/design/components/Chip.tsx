import { Pressable, StyleSheet } from 'react-native';

import { offFill, useSurface, type Surface } from '../surface';
import { useTheme } from '../theme';
import { layout, opacity, radius, space } from '../tokens';
import { Text } from './Text';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** What VoiceOver says when the label alone is not enough ('Empujar a Ana'). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Dims the chip and ignores taps: an option that cannot be picked here. */
  disabled?: boolean;
  /**
   * What the chip sits on. Inherited from the nearest `Card` (so a chip in a card is
   * `cardMuted`, one on the page is `card`); pass it only to override.
   */
  surface?: Surface;
  /** 'radio' inside a single-choice group (ChipGroup sets it); 'button' otherwise. */
  accessibilityRole?: 'button' | 'radio';
};

/**
 * A small pill option. Selected is ink on paper; unselected is one step away from what
 * it sits on. An option, not an action: for "Aceptar" or "Dar ánimo" use
 * `Button size="sm"`, which does not announce itself as selected.
 */
export function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  surface,
  accessibilityRole = 'button',
}: ChipProps) {
  const { colors } = useTheme();
  const on = useSurface(surface);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={
        accessibilityRole === 'radio' ? { checked: selected, disabled } : { selected, disabled }
      }
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.ink : offFill(colors, on),
          opacity: disabled ? opacity.disabled : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text variant="label" weight="medium" tone={selected ? 'onInk' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: layout.touchTarget,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
});
