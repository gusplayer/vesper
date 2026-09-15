import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { font, radius } from '../tokens';

type FlipDigitProps = {
  /** One character. Digits flip; anything else just sits there. */
  value: string;
};

/** Card proportions. The card is a little taller than the glyph, like a real flap. */
const CARD_HEIGHT = 64;
const CARD_WIDTH = 44;
const FLIP_MS = 260;

/**
 * One split-flap card. Two halves separated by a hairline; when the value changes the
 * top half of the old digit falls forward and the bottom half of the new one follows,
 * the way the old airport boards did. Linear timing, no bounce.
 */
export function FlipDigit({ value }: FlipDigitProps) {
  const { colors } = useTheme();
  const [shown, setShown] = useState(value);
  const [progress] = useState(() => new Animated.Value(0));
  const running = useRef(false);

  useEffect(() => {
    if (value === shown || running.current) {
      return;
    }
    running.current = true;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: FLIP_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      running.current = false;
      setShown(value);
    });
  }, [value, shown, progress]);

  const topFlap = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '-90deg', '-90deg'] });
  const bottomFlap = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['90deg', '90deg', '0deg'] });

  const card = { backgroundColor: colors.card };
  const glyph = { color: colors.ink };
  const next = value;
  const previous = shown;

  return (
    <View style={styles.wrap}>
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
