import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { dotMatrixPaths } from '../../lib/dotMatrix';
import { encodeQr } from '../../lib/qr';
import { colors, layout, radius } from '../tokens';

type KeyPatternProps = {
  /** What the code says: a key's rotating code, or a pairing code. */
  value: string;
  accessibilityLabel: string;
};

/** Modules of light margin around the code, as the standard asks. */
const QUIET_ZONE = 4;

/**
 * The key's code (ADR-0035): a field of dots with three square corners.
 *
 * Like `QrCode` it ignores the active scheme — a camera wants dark on light, even
 * inside a dark session — and like it, the content is a standard QR. What changes is
 * the ink: the finder patterns stay square because a decoder hunts for those, and
 * every other module is a dot, which is the app's language.
 *
 * Nothing animates here. The code is whole in any single frame, which is what
 * "Reducir movimiento" requires of anything that could move, and what a camera
 * requires of everything.
 */
export function KeyPattern({ value, accessibilityLabel }: KeyPatternProps) {
  const ground = colors.light;
  const { finders, dots, modules } = useMemo(() => {
    const matrix = encodeQr(value);
    return { ...dotMatrixPaths(matrix), modules: matrix.length + QUIET_ZONE * 2 };
  }, [value]);

  return (
    <View
      style={[styles.box, { backgroundColor: ground.card }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={layout.qr} height={layout.qr} viewBox={`0 0 ${modules} ${modules}`}>
        <Rect x={0} y={0} width={modules} height={modules} fill={ground.card} />
        <Path d={finders} fill={ground.ink} transform={`translate(${QUIET_ZONE} ${QUIET_ZONE})`} />
        <Path d={dots} fill={ground.ink} transform={`translate(${QUIET_ZONE} ${QUIET_ZONE})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'center',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
