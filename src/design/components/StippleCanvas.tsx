import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { dotsPath } from '../../domain/art/stipple';
import type { Dot } from '../../domain/art/types';
import { useTheme } from '../theme';

type StippleCanvasProps = {
  /** Every dot of the work, in drawing order. */
  dots: readonly Dot[];
  /** How many of them to show, from the start. */
  visible: number;
  /**
   * 'width' (default) makes a square as wide as its parent, for portrait. 'height'
   * fills the parent's height instead, for a sideways phone.
   */
  fit?: 'width' | 'height';
  /** Makes the canvas itself the tappable thing, with the label VoiceOver reads for it. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * The focus-art canvas: a square that draws the first `visible` dots as one SVG path
 * in ink. It sizes itself to the width it is given, so the unit-square artwork fills
 * the page without anyone doing arithmetic in a screen.
 */
export function StippleCanvas({ dots, visible, fit = 'width', onPress, accessibilityLabel }: StippleCanvasProps) {
  const { colors } = useTheme();
  const [size, setSize] = useState(0);

  function measure(event: LayoutChangeEvent): void {
    const { width, height } = event.nativeEvent.layout;
    setSize(Math.floor(fit === 'height' ? Math.min(width, height) : width));
  }

  const path = useMemo(() => (size === 0 ? '' : dotsPath(dots, visible, size)), [dots, visible, size]);
  const style = fit === 'height' ? styles.tall : styles.square;
  const drawing =
    size === 0 ? null : (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Path d={path} fill={colors.ink} />
      </Svg>
    );

  if (onPress === undefined) {
    return (
      <View onLayout={measure} style={style}>
        {drawing}
      </View>
    );
  }
  return (
    <Pressable
      onLayout={measure}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      {drawing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  square: {
    width: '100%',
    aspectRatio: 1,
  },
  tall: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
