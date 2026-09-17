import { Switch } from 'react-native';

import { useTheme } from '../theme';

type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel?: string;
};

/** The native switch, in ink: the only saturated color left is gone from the palette. */
export function Toggle({ value, onValueChange, accessibilityLabel }: ToggleProps) {
  const { colors } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: colors.ink, false: colors.cardMuted }}
      thumbColor={colors.card}
      ios_backgroundColor={colors.cardMuted}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
