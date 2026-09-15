import { Switch } from 'react-native';

import { useTheme } from '../theme';

type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** The native switch, in ink: the only saturated color left is gone from the palette. */
export function Toggle({ value, onValueChange, disabled = false, accessibilityLabel }: ToggleProps) {
  const { colors } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: colors.ink, false: colors.cardMuted }}
      thumbColor={colors.card}
      ios_backgroundColor={colors.cardMuted}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
