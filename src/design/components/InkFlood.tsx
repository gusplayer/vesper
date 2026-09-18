import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { dissolveLayers } from '../../lib/dissolve';
import { useTheme } from '../theme';
import { colors as palette, motion } from '../tokens';
import { useReduceMotion } from '../useReduceMotion';

type InkFloodProps = {
  /** True starts the flood; it runs once and calls `onDone`. */
  active: boolean;
  /** Where the ink starts, in window points. Defaults to the bottom center: the footer button. */
  origin?: { x: number; y: number } | null;
  /**
   * Fires when the page is fully ink. The caller starts the session, opens its route
   * and drops `active`; the flood lingers for one route fade on its own.
   */
  onDone: () => void;
  /**
   * What floods the page. `ink` is the way in: the current scheme's ink over the page.
   * `paper` is the way out: the light page color over the dark session, whatever the
   * theme says, because paper is the app's page (ADR-0025).
   */
  tone?: 'ink' | 'paper';
};

/**
 * The way into a session, and back out of it: ink spreads from the button over the
 * whole page, dot by dot, until nothing else is left, and the dark session route opens
 * underneath. Leaving is the same dissolve the other way, paper over ink, with the light
 * route underneath (ADR-0025). Drawn as stipple layers whose opacity follows one
 * progress value, so the noise is free and the animation runs on the native driver.
 * Same language as the focus art (ADR-0018).
 */
export function InkFlood({ active, origin = null, onDone, tone = 'ink' }: InkFloodProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const fill = tone === 'paper' ? palette.light.bg : colors.ink;
  const { width, height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  // Up from the same render `active` turns on, and for one route fade after it drops,
  // so the dark session route is already in place when the sheet goes.
  const [shown, setShown] = useState(active);
  if (active && !shown) {
    setShown(true);
  }
  // The latest `onDone`, so the effects below never restart the flood over a new callback.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (active) {
      return undefined;
    }
    const timer = setTimeout(() => setShown(false), motion.fadeMs);
    return () => clearTimeout(timer);
  }, [active]);

  const layers = useMemo(() => {
    const point = origin ?? { x: width / 2, y: height };
    return dissolveLayers({
      width,
      height,
      spacing: motion.dissolve.spacing,
      layers: motion.dissolve.layers,
      direction: { kind: 'radial', x: point.x, y: point.y },
    });
  }, [width, height, origin]);

  useEffect(() => {
    if (!active) {
      // Keep the ink where it is while the sheet lingers; the next flood resets it.
      return undefined;
    }
    // With "reduce motion" the sheet is simply there: no dots spreading, same result.
    if (reduceMotion) {
      progress.setValue(1);
      done.current();
      return undefined;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.floodMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        done.current();
      }
    });
    return () => animation.stop();
  }, [active, progress, reduceMotion]);

  if (!shown) {
    return null;
  }

  const count = layers.length;
  // The last step is a solid sheet: dots leave gaps, the page must not.
  const sheetOpacity = progress.interpolate({
    inputRange: [0, 0.85, 1],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={styles.fill} pointerEvents="none">
        {layers.map((layer, index) => (
          <Animated.View
            key={index}
            style={[
              styles.fill,
              {
                opacity: progress.interpolate({
                  inputRange: [index / count, (index + 1) / count],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
              <Path d={layer.path} fill={fill} />
            </Svg>
          </Animated.View>
        ))}
        <Animated.View style={[styles.fill, { backgroundColor: fill, opacity: sheetOpacity }]} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});
