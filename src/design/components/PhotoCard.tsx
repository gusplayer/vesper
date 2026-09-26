import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { Card } from './Card';
import { PhotoImage } from './PhotoImage';
import { Text } from './Text';

type PhotoCardProps = {
  /** The full photo, a file:// uri. Null keeps its frame, empty: the file is not on this phone. */
  uri: string | null;
  /** Of the full image, in pixels: the frame keeps its shape. */
  width: number;
  height: number;
  /** The first line under the photo: 'Tú · martes 24'. */
  title?: string;
  /** What the person wrote, already in quotes, as they wrote it. */
  caption?: string | null;
  /** Quieter lines under it: where the photo came from, how the mark was counted. */
  lines?: readonly string[];
  /** VoiceOver: what the photo is ('Tu foto del martes 24'). The lines read on their own. */
  accessibilityLabel: string;
  /**
   * 'preview' draws a lower frame (`layout.photo.previewMaxHeight`), so the caption field
   * and the button under the card fit on the screen without scrolling.
   */
  frame?: 'full' | 'preview';
};

/**
 * A photo at the width of its card, in full color, with its lines under it
 * (ADR-0051): the preview before saving and the viewer. The frame keeps the photo's
 * shape up to `layout.photo.maxHeight` of the window, and past it the photo is drawn
 * whole inside the frame instead of cropped. Nothing zooms or swipes: the card is
 * still, and leaving it is going back (rule 6).
 */
export function PhotoCard({
  uri,
  width,
  height,
  title,
  caption,
  lines = [],
  accessibilityLabel,
  frame = 'full',
}: PhotoCardProps) {
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const ratio = width > 0 && height > 0 ? width / height : 1;
  const hasText = title !== undefined || (caption !== undefined && caption !== null) || lines.length > 0;

  return (
    <Card>
      <View style={styles.stack}>
        <View
          style={[
            styles.frame,
            {
              aspectRatio: ratio,
              maxHeight: window.height * (frame === 'preview' ? layout.photo.previewMaxHeight : layout.photo.maxHeight),
              backgroundColor: colors.cardMuted,
            },
          ]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
        >
          {uri === null ? null : <PhotoImage uri={uri} muted={false} fit="contain" />}
        </View>
        {hasText ? (
          <View style={styles.text}>
            {title === undefined ? null : (
              <Text variant="body" weight="medium">
                {title}
              </Text>
            )}
            {caption === undefined || caption === null ? null : <Text variant="body">{caption}</Text>}
            {lines.map((line) => (
              <Text key={line} variant="label" tone="secondary">
                {line}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: {
    rowGap: space.md,
  },
  // Past the tallest it may be, the frame either keeps its width and letterboxes the
  // photo or narrows to keep its shape; centred, either reads as intended.
  frame: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  text: {
    rowGap: space.xs,
  },
});
