import { Switch } from 'react-native';

import { useTheme } from '../theme';
import { opacity } from '../tokens';

type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel?: string;
  /** What the switch does, read after its state: the row's description. */
  accessibilityHint?: string;
  /** Cannot be flipped here (no permission, no capability): faded, and says so. */
  disabled?: boolean;
};

/**
 * The native switch, in ink. Off, its track is `trackOff`, a step darker than the
 * hairlines, so it still reads as a control on a card.
 */
export function Toggle({ value, onValueChange, accessibilityLabel, accessibilityHint, disabled = false }: ToggleProps) {
  const { colors } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: colors.ink, false: colors.trackOff }}
      thumbColor={colors.card}
      ios_backgroundColor={colors.trackOff}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, checked: value }}
      style={disabled ? { opacity: opacity.disabled } : undefined}
    />
  );
}
