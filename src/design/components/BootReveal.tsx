import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { dissolveLayers } from '../../lib/dissolve';
import { useTheme } from '../theme';
import { colors as palette, layout, motion, radius } from '../tokens';
import { readReduceMotion } from '../useReduceMotion';

export type BootRevealPhase =
  /** The ink sheet is on screen, seamless with the native splash: the caller drops the splash. */
  | 'ink'
  /** The ink has dissolved; only the mark is left on the page. */
  | 'mark'
  /** The reveal has faded into the app and can be unmounted. */
  | 'done';

type BootRevealProps = {
  /** True once the app is rendered underneath. The mark waits for it before fading. */
  ready: boolean;
  onPhase: (phase: BootRevealPhase) => void;
};

const COLUMNS = 4;
const CELLS = COLUMNS * COLUMNS;
/** The cells the icon draws in ink: the lived part of the grid, as in HeroObject. */
const LIVED = 9;

/**
 * The way into the app (ADR-0028). The native splash is a plain ink sheet; this picks
 * it up in the same color and dissolves it dot by dot from the edges toward the center,
 * the same stipple InkFlood floods with (ADR-0018, ADR-0022), until only Vesper's mark
 * is left on the page: the four by four grid of the icon. The mark holds for a beat
 * and fades into the app with one route fade. Only opacity moves. With "reduce motion"
 * the ink is simply gone and the mark fades on its own.
 */
export function BootReveal({ ready, onPhase }: BootRevealProps) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  // Born fully ink, so the first frame matches the splash the caller is about to drop.
  const [progress] = useState(() => new Animated.Value(1));
  const [veil] = useState(() => new Animated.Value(1));
  // Nothing is announced before the ink sheet is painted: the splash must go first.
  const [inkShown, setInkShown] = useState(false);
  const [inkGone, setInkGone] = useState(false);
  const phase = useRef(onPhase);
  useEffect(() => {
    phase.current = onPhase;
  });

  const layers = useMemo(
    () =>
      dissolveLayers({
        width,
        height,
        spacing: motion.dissolve.spacing,
        layers: motion.dissolve.layers,
        direction: { kind: 'radial', x: width / 2, y: height / 2 },
      }),
    [width, height],
  );

  // The ink leaves from the edges in, so the last of it lingers around the mark.
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    let alive = true;
    readReduceMotion().then((reduced) => {
      if (!alive) {
        return;
      }
      if (reduced) {
        progress.setValue(0);
        setInkGone(true);
        return;
      }
      animation = Animated.timing(progress, {
        toValue: 0,
        duration: motion.revealMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      animation.start(({ finished }) => {
        if (finished) {
          setInkGone(true);
        }
      });
    });
    return () => {
      alive = false;
      animation?.stop();
    };
  }, [progress]);

  useEffect(() => {
    if (inkShown && inkGone) {
      phase.current('mark');
    }
  }, [inkShown, inkGone]);

  // The mark stays a beat once the app is under it, then the page shows through.
  useEffect(() => {
    if (!inkShown || !inkGone || !ready) {
      return undefined;
    }
    const animation = Animated.timing(veil, {
      toValue: 0,
      duration: motion.fadeMs,
      delay: motion.revealHoldMs,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        phase.current('done');
      }
    });
    return () => animation.stop();
  }, [inkShown, inkGone, ready, veil]);

  function announceInk(): void {
    if (inkShown) {
      return;
    }
    // One frame later, so the sheet is painted before the splash behind it goes.
    requestAnimationFrame(() => {
      phase.current('ink');
      setInkShown(true);
    });
  }

  const count = layers.length;
  const { cell, gap } = layout.mark;
  const gridWidth = COLUMNS * cell + (COLUMNS - 1) * gap;
  // Same seam as InkFlood: a solid sheet covers the dots while the field is (nearly) full.
  const sheetOpacity = progress.interpolate({
    inputRange: [0, 0.85, 1],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[styles.fill, styles.center, { backgroundColor: colors.bg, opacity: veil }]}
      onLayout={announceInk}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.grid, { width: gridWidth, gap }]}>
        {Array.from({ length: CELLS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.cell,
              { width: cell, height: cell, backgroundColor: i < LIVED ? colors.ink : colors.inkTertiary },
            ]}
          />
        ))}
      </View>
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
            <Path d={layer.path} fill={palette.light.ink} />
          </Svg>
        </Animated.View>
      ))}
      <Animated.View style={[styles.fill, { backgroundColor: palette.light.ink, opacity: sheetOpacity }]} />
    </Animated.View>
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
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    borderRadius: radius.sm / 4,
  },
});
