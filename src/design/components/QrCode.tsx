import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { encodeQr, qrPath } from '../../lib/qr';
import { colors, layout, radius } from '../tokens';

type QrCodeProps = {
  /** What the code says. Short by design: an invite link, never a paragraph. */
  value: string;
  accessibilityLabel: string;
};

/** Modules of light margin around the code, as the standard asks. */
const QUIET_ZONE = 4;

/**
 * A QR code drawn as one SVG path. It ignores the active scheme on purpose: a camera
 * wants dark modules on a light ground, so it always takes the light palette, even
 * inside a dark session. The size is a layout token; the module count comes from the text.
 */
export function QrCode({ value, accessibilityLabel }: QrCodeProps) {
  const ground = colors.light;
  const { path, modules } = useMemo(() => {
    const matrix = encodeQr(value);
    return { path: qrPath(matrix), modules: matrix.length + QUIET_ZONE * 2 };
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
        <Path d={path} fill={ground.ink} transform={`translate(${QUIET_ZONE} ${QUIET_ZONE})`} />
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
