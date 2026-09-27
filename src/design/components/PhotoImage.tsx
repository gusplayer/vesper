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
  /**
   * Drawn at once, with no fade of ours and none of Android's: an image that is going to
   * be captured (AlbumCard) must be whole the moment it has loaded.
   */
  still?: boolean;
  /** Once the image has loaded, or failed to: a capture waits for every one. */
  onSettle?: () => void;
};

/**
 * A photo that fills its parent: the image, and in a grid the veil over it. It fades
 * in once it has loaded, in the route's 160 ms, so a thumbnail never pops; with
 * "reduce motion" it is simply there. Only opacity moves (rule 6). Internal: PhotoTile,
 * PhotoCard, HeatSquare and AlbumCard draw with it, and it is not exported.
 */
export function PhotoImage({ uri, muted, fit, still = false, onSettle }: PhotoImageProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [shown] = useState(() => new Animated.Value(still ? 1 : 0));

  const onLoad = () => {
    onSettle?.();
    if (still) {
      return;
    }
    if (reduceMotion) {
      shown.setValue(1);
      return;
    }
    Animated.timing(shown, {
      toValue: 1,
      duration: motion.fadeMs,
      easing: Easing.out(Easing.quad),
      // JS-driven on purpose. A tile often mounts on a screen that sits under another
      // route (the challenge, while the preview saves), and on Android a native-driven
      // fade started on a detached view never lands: the photo stayed at opacity 0
      // until the screen was mounted again. A few thumbnails fading is cheap on JS.
      useNativeDriver: false,
    }).start();
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: shown }]} pointerEvents="none">
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={fit}
        onLoad={onLoad}
        onError={onSettle}
        // Android fades a new image in on its own (300 ms); a still one is whole at once.
        fadeDuration={still ? 0 : undefined}
        // A photo is the one thing Smart Invert must leave alone.
        accessibilityIgnoresInvertColors
        accessible={false}
        importantForAccessibility="no"
      />
      {muted ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.photoVeil }]} /> : null}
    </Animated.View>
  );
}
