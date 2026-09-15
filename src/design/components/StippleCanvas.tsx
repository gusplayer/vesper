import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { dotsPath } from '../../domain/art/stipple';
import type { Dot } from '../../domain/art/types';
import { useTheme } from '../theme';

type StippleCanvasProps = {
  /** Every dot of the work, in drawing order. */
  dots: ReadonlyArray<Dot>;
  /** How many of them to show, from the start. */
  visible: number;
};

/**
 * The focus-art canvas: a square that draws the first `visible` dots as one SVG path
 * in ink. It sizes itself to the width it is given, so the unit-square artwork fills
 * the page without anyone doing arithmetic in a screen.
 */
export function StippleCanvas({ dots, visible }: StippleCanvasProps) {
  const { colors } = useTheme();
  const [size, setSize] = useState(0);

  function measure(event: LayoutChangeEvent): void {
    setSize(Math.floor(event.nativeEvent.layout.width));
  }

  const path = useMemo(() => (size === 0 ? '' : dotsPath(dots, visible, size)), [dots, visible, size]);

  return (
    <View onLayout={measure} style={styles.square}>
      {size === 0 ? null : (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Path d={path} fill={colors.ink} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  square: {
    width: '100%',
    aspectRatio: 1,
  },
});
