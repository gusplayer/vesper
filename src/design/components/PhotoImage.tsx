import { useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { motion } from '../tokens';
import { useReduceMotion } from '../useReduceMotion';

type PhotoImageProps = {
  /** A file:// uri on this phone. */
  uri: string;
  /** Under the `photoVeil`: quiet in a grid or an album (ADR-0051). */
  muted: boolean;
  /** Fills a square cell ('cover') or shows the whole photo in a frame ('contain'). */
  fit: 'cover' | 'contain';
};

/**
 * A photo that fills its parent: the image, and in a grid the veil over it. It fades
 * in once it has loaded, in the route's 160 ms, so a thumbnail never pops; with
 * "reduce motion" it is simply there. Only opacity moves (rule 6). Internal: PhotoTile,
 * PhotoCard and HeatSquare draw with it, and it is not exported.
 */
export function PhotoImage({ uri, muted, fit }: PhotoImageProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [shown] = useState(() => new Animated.Value(0));

  const onLoad = () => {
    if (reduceMotion) {
      shown.setValue(1);
      return;
    }
    Animated.timing(shown, {
      toValue: 1,
      duration: motion.fadeMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: shown }]} pointerEvents="none">
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={fit}
        onLoad={onLoad}
        // A photo is the one thing Smart Invert must leave alone.
        accessibilityIgnoresInvertColors
        accessible={false}
        importantForAccessibility="no"
      />
      {muted ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.photoVeil }]} /> : null}
    </Animated.View>
  );
}
