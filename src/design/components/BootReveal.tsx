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
/** A frame this long or shorter means the UI thread is drawing at its normal pace again. */
const STEADY_FRAME_MS = 40;
const STEADY_FRAMES = 2;
const STEADY_DEADLINE_MS = 1500;

/**
 * Calls back once the UI thread has drawn a couple of frames at its normal pace, or
 * after a deadline. Frame callbacks reach JS from the UI thread, so a long native draw
 * (the first raster of the dissolve layers, the system taking its splash window down)
 * shows up as one long gap between them. Returns a cancel function.
 */
function afterSteadyFrames(callback: () => void): () => void {
  let alive = true;
  let last = Date.now();
  const deadline = last + STEADY_DEADLINE_MS;
  let steady = 0;
  const tick = (): void => {
    if (!alive) {
      return;
    }
    const now = Date.now();
    steady = now - last <= STEADY_FRAME_MS ? steady + 1 : 0;
    last = now;
    if (steady >= STEADY_FRAMES || now >= deadline) {
      callback();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => {
    alive = false;
  };
}

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
  const [inkAnnounced, setInkAnnounced] = useState(false);
  // The dissolve layers mount under the solid sheet once the splash has had its frames
  // to leave, and the dissolve starts once their first raster is behind us.
  const [layersMounted, setLayersMounted] = useState(false);
  const [inkShown, setInkShown] = useState(false);
  const [inkGone, setInkGone] = useState(false);
  // Read once, before anything moves; null until the system has answered.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
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

  useEffect(() => {
    let alive = true;
    readReduceMotion().then((reduced) => {
      if (alive) {
        setReduceMotion(reduced);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // The layers wait until the splash window is gone. Android takes it down only when
  // the app's UI thread goes idle after its first frame, so nothing heavy may happen
  // until the frames are steady, or the whole dissolve runs under the splash.
  useEffect(() => {
    if (!inkAnnounced) {
      return undefined;
    }
    return afterSteadyFrames(() => setLayersMounted(true));
  }, [inkAnnounced]);

  // The ink leaves from the edges in, so the last of it lingers around the mark. It
  // starts only once the sheet is on screen and the splash behind it has been dropped:
  // whatever moves under the splash is lost.
  useEffect(() => {
    if (!inkShown || reduceMotion === null) {
      return undefined;
    }
    if (reduceMotion) {
      // Simply gone; `inkDone` below reads this branch without another render.
      progress.setValue(0);
      return undefined;
    }
    // In and out: the page starts from stillness, so the first dots leave gently, and
    // the last ones linger around the mark. InkFlood eases out only: it follows a tap.
    const animation = Animated.timing(progress, {
      toValue: 0,
      duration: motion.revealMs,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        setInkGone(true);
      }
    });
    return () => animation.stop();
  }, [inkShown, reduceMotion, progress]);

  const inkDone = inkShown && (inkGone || reduceMotion === true);

  useEffect(() => {
    if (inkDone) {
      phase.current('mark');
    }
  }, [inkDone]);

  // The mark stays a beat once the app is under it, then the page shows through.
  useEffect(() => {
    if (!inkDone || !ready) {
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
  }, [inkDone, ready, veil]);

  function announceInk(): void {
    if (inkAnnounced) {
      return;
    }
    // One frame later, so the sheet is painted before the splash behind it goes.
    requestAnimationFrame(() => {
      phase.current('ink');
      setInkAnnounced(true);
    });
  }

  // The layers are laid out: their first raster comes with the next frame, and the
  // dissolve clock starts only once that is over and the frames are steady again.
  const armDissolve = useRef<(() => void) | null>(null);
  function layersReady(): void {
    if (inkShown || armDissolve.current !== null) {
      return;
    }
    armDissolve.current = afterSteadyFrames(() => setInkShown(true));
  }
  useEffect(() => () => armDissolve.current?.(), []);

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
      {layersMounted ? (
        <View style={styles.fill} onLayout={layersReady}>
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
        </View>
      ) : null}
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
