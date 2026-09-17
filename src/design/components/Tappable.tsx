import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

type TappableProps = {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  /** What VoiceOver reads: the thing, then what a tap does. */
  accessibilityLabel: string;
};

/**
 * A tap target with no look of its own: the children are the button. For a heading
 * that opens a sheet, a number that switches units. Screens use this instead of
 * importing Pressable, so the design layer owns every tappable thing.
 */
export function Tappable({ children, onPress, disabled = false, accessibilityLabel }: TappableProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      {children}
    </Pressable>
  );
}
