import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { font, radius } from '../tokens';
import { useReduceMotion } from '../useReduceMotion';

type FlipDigitProps = {
  /** One character. Digits flip; anything else just sits there. */
  value: string;
  /** 1 is the session clock; the sideways clock uses more. */
  scale?: number;
};

/** Card proportions. The card is a little taller than the glyph, like a real flap. */
const CARD_HEIGHT = 64;
const CARD_WIDTH = 44;
const FLIP_MS = 340;

/**
 * One split-flap card. Two halves separated by a hairline; when the value changes the
 * top half of the old digit falls forward and the bottom half of the new one follows,
 * the way the old airport boards did. Linear timing, no bounce.
 */
export function FlipDigit({ value, scale = 1 }: FlipDigitProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [shown, setShown] = useState(value);
  // Two values, one per half, so each half gets its own curve on the native driver.
  const [topProgress] = useState(() => new Animated.Value(0));
  const [bottomProgress] = useState(() => new Animated.Value(0));
  const running = useRef(false);

  // With "reduce motion" the digit changes, nothing falls: the shown value follows the
  // new one on the same render, no animation and no effect.
  if (reduceMotion && shown !== value) {
    setShown(value);
  }

  useEffect(() => {
    if (value === shown || running.current || reduceMotion) {
      return;
    }
    running.current = true;
    topProgress.setValue(0);
    bottomProgress.setValue(0);
    // The top half falls like something let go (accelerating); the bottom half lands
    // like something set down (decelerating). Neither overshoots.
    Animated.sequence([
      Animated.timing(topProgress, {
        toValue: 1,
        duration: FLIP_MS / 2,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bottomProgress, {
        toValue: 1,
        duration: FLIP_MS / 2,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      running.current = false;
      setShown(value);
    });
  }, [value, shown, topProgress, bottomProgress, reduceMotion]);

  const topFlap = topProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-90deg'] });
  const bottomFlap = bottomProgress.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] });

  const card = { backgroundColor: colors.card };
  const glyph = { color: colors.ink };
  const next = value;
  const previous = shown;

  return (
    <View style={[styles.wrap, scale === 1 ? null : { transform: [{ scale }], margin: (CARD_HEIGHT * (scale - 1)) / 2 }]}>
      {/* Behind: the new digit's top half and the old digit's bottom half. */}
      <View style={[styles.half, styles.top, card]}>
        <Animated.Text style={[styles.glyph, glyph]}>{next}</Animated.Text>
      </View>
      <View style={[styles.half, styles.bottom, card]}>
        <Animated.Text style={[styles.glyph, styles.glyphBottom, glyph]}>{previous}</Animated.Text>
      </View>
      {/* Moving: the old top half falling, then the new bottom half arriving. */}
      <Animated.View
        style={[
          styles.half,
          styles.top,
          styles.flap,
          card,
          { transform: [{ perspective: 600 }, { rotateX: topFlap }], transformOrigin: 'bottom' },
        ]}
      >
        <Animated.Text style={[styles.glyph, glyph]}>{previous}</Animated.Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.half,
          styles.bottom,
          styles.flap,
          card,
          { transform: [{ perspective: 600 }, { rotateX: bottomFlap }], transformOrigin: 'top' },
        ]}
      >
        <Animated.Text style={[styles.glyph, styles.glyphBottom, glyph]}>{next}</Animated.Text>
      </Animated.View>
      <View style={[styles.line, { backgroundColor: colors.bg }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  half: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: CARD_HEIGHT / 2,
    overflow: 'hidden',
  },
  top: {
    top: 0,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  bottom: {
    bottom: 0,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },
  flap: {
    backfaceVisibility: 'hidden',
  },
  glyph: {
    fontFamily: font.family.medium,
    fontSize: font.size.hero,
    lineHeight: CARD_HEIGHT,
    height: CARD_HEIGHT,
    textAlign: 'center',
  },
  glyphBottom: {
    marginTop: -CARD_HEIGHT / 2,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: CARD_HEIGHT / 2 - 1,
    height: 2,
  },
});
