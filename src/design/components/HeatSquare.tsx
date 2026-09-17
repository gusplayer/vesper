import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
import { motion } from '../tokens';

export type HeatSquareProps = {
  /** 0 = nothing, 1 = a full day. Quantized into four levels when drawn. */
  intensity: number;
  /** Today keeps breathing after it lights, so the grid has a "you are here". */
  today: boolean;
  size: number;
  radius: number;
  /** The system asked for less motion: fully lit at once, no breathing. */
  reduceMotion: boolean;
};

/** Four levels read as levels; a continuous ramp reads as mud. Empty is an outline. */
function levelOpacity(intensity: number): number {
  if (intensity <= 0) {
    return 0;
  }
  if (intensity < 0.34) {
    return 0.4;
  }
  if (intensity < 0.67) {
    return 0.7;
  }
  return 1;
}

/** Most lamps come on clean; a few hesitate once, gently, before they hold. */
const FLICKER_SHARE = 0.2;
const FLICKER_PEAK = 0.6;
const FLICKER_DIP = 0.4;
/** How far today dims while breathing: deep enough to catch on a faint day, never off. */
const BREATH_LOW = 0.4;

function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * One day of the grid: a square that lights up when it appears, like a lamp in a row
 * of old lamps. Each waits its own moment and takes its own time, a few hesitate on
 * the way, so the grid never comes on as one block. Today keeps breathing softly
 * after. Only opacity moves: nothing scales, nothing springs.
 */
export function HeatSquare({ intensity, today, size, radius, reduceMotion }: HeatSquareProps) {
  const { colors } = useTheme();
  const [light] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));

  useEffect(() => {
    if (reduceMotion) {
      light.setValue(1);
      return undefined;
    }
    const duration = between(motion.lightMinMs, motion.lightMaxMs);
    const timing = (toValue: number, ms: number, easing = Easing.inOut(Easing.sin)) =>
      Animated.timing(light, { toValue, duration: ms, easing, useNativeDriver: true });

    const on =
      Math.random() < FLICKER_SHARE
        ? Animated.sequence([
            timing(FLICKER_PEAK, duration * 0.25),
            timing(FLICKER_DIP, duration * 0.2),
            timing(1, duration * 0.55),
          ])
        : timing(1, duration);
    const steps = [Animated.delay(between(0, motion.lightDelayMaxMs)), on];
    if (today) {
      // Without `resetBeforeIteration: false` the loop would snap back to dark every
      // round; the breath has to pick up where it left off.
      steps.push(
        Animated.loop(
          Animated.sequence([
            timing(BREATH_LOW, motion.breathMs, Easing.inOut(Easing.sin)),
            timing(1, motion.breathMs, Easing.inOut(Easing.sin)),
          ]),
          { resetBeforeIteration: false },
        ),
      );
    }
    const animation = Animated.sequence(steps);
    animation.start();
    return () => animation.stop();
  }, [light, today, reduceMotion]);

  const opacity = levelOpacity(intensity);
  return (
    <Animated.View style={[styles.slot, { width: size, height: size, borderRadius: radius, opacity: light }]}>
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: radius },
          opacity === 0
            ? { borderWidth: 1, borderColor: colors.inkTertiary }
            : { backgroundColor: colors.ink, opacity },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: {
    padding: 0,
  },
  fill: {
    flex: 1,
  },
});
