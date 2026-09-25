import { useState, type ReactNode } from 'react';
import { Pressable, type Insets, type LayoutChangeEvent } from 'react-native';

import { layout, opacity } from '../tokens';

type TappableProps = {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  /** What VoiceOver reads: the thing, then what a tap does. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** 'link' for words that open a page outside the app (Términos, Privacidad). */
  accessibilityRole?: 'button' | 'link';
};

/** How far the touch area reaches past a box of `side` points to make it a full target. */
function slop(side: number): number {
  return Math.max(0, Math.ceil((layout.touchTarget - side) / 2));
}

/**
 * A tap target with no look of its own: the children are the button. For a heading
 * that opens a sheet, a number that switches units. Screens use this instead of
 * importing Pressable, so the design layer owns every tappable thing.
 *
 * However small the children (a caption is 16 pt tall), the touch area reaches 44 pt:
 * the hit slop is measured, so nothing around it moves. Pressed, it dims for as long
 * as the finger is on it.
 */
export function Tappable({
  children,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
}: TappableProps) {
  const [hitSlop, setHitSlop] = useState<Insets | undefined>(undefined);

  function measure(event: LayoutChangeEvent): void {
    const { width, height } = event.nativeEvent.layout;
    const vertical = slop(height);
    const horizontal = slop(width);
    setHitSlop((current) =>
      current?.top === vertical && current.left === horizontal
        ? current
        : { top: vertical, bottom: vertical, left: horizontal, right: horizontal },
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onLayout={measure}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({ opacity: pressed && !disabled ? opacity.pressed : 1 })}
    >
      {children}
    </Pressable>
  );
}
