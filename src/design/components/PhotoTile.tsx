import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius } from '../tokens';
import { Icon } from './Icon';
import { PhotoImage } from './PhotoImage';
import { Tappable } from './Tappable';

type PhotoTileProps = {
  /**
   * The photo, a file:// uri. Null or left out draws the waiting fill: the file is not
   * on this phone (yet), and the square still holds its place.
   */
  uri?: string | null;
  /** 'add' is the dashed square with a plus: where a photo could go. It holds no image. */
  variant?: 'photo' | 'add';
  /** Under the `photoVeil`, so a row of photos stays a page of ink (ADR-0051). */
  muted?: boolean;
  /** 'cell' is a HeatGrid square at 'lg', and the tile that leads a row; 'thumb' the album's. */
  size?: 'cell' | 'thumb';
  /** Opens the photo. The touch area reaches 44 pt whatever the size. */
  onPress?: () => void;
  /** Required with `onPress`; without one, the tile is decoration for VoiceOver. */
  accessibilityLabel?: string;
};

/**
 * One photo as a small square with the system's corner (ADR-0051): a thumbnail in the
 * album, the tile that leads "Agregar la foto de hoy". Quiet by default in a grid
 * (`muted`); the color is for the viewer. The 'add' variant is an outline, never a
 * filled call to action: a mark without a photo counts the same.
 */
export function PhotoTile({
  uri = null,
  variant = 'photo',
  muted = false,
  size = 'cell',
  onPress,
  accessibilityLabel,
}: PhotoTileProps) {
  const { colors } = useTheme();
  const side = size === 'cell' ? layout.photo.cell : layout.photo.thumb;
  const shape = { width: side, height: side, borderRadius: radius.sm };

  const tile =
    variant === 'add' ? (
      <View
        style={[styles.center, shape, styles.dashed, { borderColor: colors.inkSecondary }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Icon name="plus" size="sm" tone="secondary" />
      </View>
    ) : (
      <View
        style={[styles.clip, shape, { backgroundColor: colors.cardMuted }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {uri === null ? null : <PhotoImage uri={uri} muted={muted} fit="cover" />}
      </View>
    );

  if (onPress === undefined) {
    return tile;
  }
  return (
    <Tappable onPress={onPress} accessibilityLabel={accessibilityLabel ?? ''}>
      {tile}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashed: {
    borderWidth: layout.photo.dash,
    borderStyle: 'dashed',
  },
  clip: {
    overflow: 'hidden',
  },
});
