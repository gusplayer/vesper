import { useEffect, useState, type Ref } from 'react';
import { PixelRatio, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ForcedTheme } from '../theme';
import { colors as palette, layout } from '../tokens';
import { Mark } from './Mark';
import { PhotoImage } from './PhotoImage';
import { Text } from './Text';

export type AlbumCardDay = {
  key: string;
  /** That day's photo (its thumbnail), a file:// uri; null for a day without one. */
  uri: string | null;
};

type AlbumCardProps = {
  /** The challenge's name, as it was written. */
  title: string;
  /** The one line under the grid: 'Un reto de 21 días.' */
  line: string;
  /** 'Vesper', next to the mark. */
  wordmark: string;
  /** Every day of the challenge, Monday first, a week per row. */
  days: readonly AlbumCardDay[];
  /**
   * 'preview' is the card in its sheet, as tall as `layout.share.preview` of the window
   * lets it be. 'capture' is the same card at 1080 × 1920 physical pixels, mounted
   * where nobody sees it (a Sheet's `under`), for `platform/share` to read.
   */
  purpose: 'preview' | 'capture';
  /** VoiceOver, on the preview: what the image is. The capture is hidden from it. */
  accessibilityLabel?: string;
  /** The capture's view, for `captureView`. */
  ref?: Ref<View>;
  /** Called once every photo has loaded (or failed to): before it, a capture would miss them. */
  onReady?: () => void;
};

const SHARE = layout.share;
/**
 * What the grid may take of the square, in the story's pixels: the rest is two lines of
 * title, the line, the wordmark, the three gaps between them and the square's own
 * padding above and below.
 */
const GRID_MAX_HEIGHT =
  SHARE.safeBottom - SHARE.safeTop - 2 * SHARE.titleLine - SHARE.lineLine - SHARE.wordLine - 5 * SHARE.gap;
/** The mark's corner, as a share of its cell: the icon's. */
const MARK_CORNER = 0.25;

/**
 * The image "Compartir tu álbum" makes (ADR-0051 §13, ADR-0030): your photos of a
 * finished challenge on the grid of its days, a week per row, with a quiet square for
 * each day without one; the challenge's name above, one line under it, and Vesper's
 * mark and name at the foot. Nobody else's photo, name or count, no URL, no QR.
 *
 * Always in ink (`ForcedTheme` dark, never `ThemeScope`, which would set the status
 * bar): it is what reads in a camera roll, and it matches the session. Photos in full
 * color, still: the veil is for the app's grid, and nothing fades in an image.
 *
 * A 9:16 story, 1080 × 1920 pixels, whose content stays inside the centered square a
 * feed's 4:5 or 1:1 crop keeps (`layout.share`). Every measure is a share of the width,
 * so the preview and the capture are one picture at two sizes. The capture is sized in
 * points so that it is 1080 physical pixels wide on any screen, its text does not
 * follow the system's size, and its background is opaque. It is mounted with its parent
 * at opacity 0, under the sheet: the view itself stays opaque, which is what the
 * capture reads on both platforms (`collapsable={false}` keeps it a real view on
 * Android).
 */
export function AlbumCard({ title, line, wordmark, days, purpose, accessibilityLabel, ref, onReady }: AlbumCardProps) {
  const window = useWindowDimensions();
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set());

  const capture = purpose === 'capture';
  const width = capture
    ? SHARE.width / PixelRatio.get()
    : Math.min(window.height * SHARE.preview * (SHARE.width / SHARE.height), window.width - 2 * layout.pageMargin);
  // Points per pixel of the story.
  const unit = width / SHARE.width;
  const height = SHARE.height * unit;

  const rows: AlbumCardDay[][] = [];
  for (let start = 0; start < days.length; start += SHARE.columns) {
    rows.push(days.slice(start, start + SHARE.columns));
  }
  const gap = SHARE.cellGap * unit;
  const gridWidth = (SHARE.width - 2 * SHARE.margin) * unit;
  // A week fills the width; only a challenge longer than any the app offers would
  // have to shrink its squares to stay inside the square.
  const byWidth = (gridWidth - (SHARE.columns - 1) * gap) / SHARE.columns;
  const byHeight =
    rows.length === 0 ? byWidth : (GRID_MAX_HEIGHT * unit - (rows.length - 1) * gap) / rows.length;
  const cell = Math.min(byWidth, byHeight);

  const photoKeys = days.filter((day) => day.uri !== null).map((day) => day.key);
  const ready = photoKeys.every((key) => settled.has(key));
  useEffect(() => {
    if (ready) {
      onReady?.();
    }
  }, [ready, onReady]);
  const settle = (key: string) =>
    setSettled((previous) => (previous.has(key) ? previous : new Set(previous).add(key)));

  const sized = (size: number, lineHeight: number) => ({ fontSize: size * unit, lineHeight: lineHeight * unit });

  const card = (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { width, height, backgroundColor: palette.dark.bg }]}
      accessible={!capture}
      accessibilityRole={capture ? undefined : 'image'}
      accessibilityLabel={capture ? undefined : accessibilityLabel}
    >
      <View
        style={[
          styles.square,
          {
            top: SHARE.safeTop * unit,
            height: (SHARE.safeBottom - SHARE.safeTop) * unit,
            paddingHorizontal: SHARE.margin * unit,
            // The mark stays off the edge a 1:1 crop cuts at.
            paddingVertical: SHARE.gap * unit,
          },
        ]}
      >
        <View style={[styles.body, { rowGap: SHARE.gap * unit }]}>
          <Text
            variant="heading"
            align="center"
            numberOfLines={2}
            allowFontScaling={false}
            style={sized(SHARE.title, SHARE.titleLine)}
          >
            {title}
          </Text>
          <View style={[styles.grid, { width: gridWidth, rowGap: gap }]}>
            {rows.map((row, index) => (
              <View key={index} style={[styles.row, { columnGap: gap }]}>
                {row.map((day) => (
                  <View
                    key={day.key}
                    style={[
                      styles.cell,
                      {
                        width: cell,
                        height: cell,
                        borderRadius: cell * SHARE.cellCorner,
                        backgroundColor: palette.dark.cardMuted,
                      },
                    ]}
                  >
                    {day.uri === null ? null : (
                      <PhotoImage
                        uri={day.uri}
                        muted={false}
                        fit="cover"
                        still
                        onSettle={() => settle(day.key)}
                      />
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
          <Text
            variant="label"
            tone="secondary"
            align="center"
            allowFontScaling={false}
            style={sized(SHARE.line, SHARE.lineLine)}
          >
            {line}
          </Text>
        </View>
        <View style={[styles.brand, { columnGap: SHARE.markSpace * unit }]}>
          <Mark
            cell={SHARE.markCell * unit}
            gap={SHARE.markGap * unit}
            corner={SHARE.markCell * unit * MARK_CORNER}
          />
          <Text variant="body" weight="medium" allowFontScaling={false} style={sized(SHARE.word, SHARE.wordLine)}>
            {wordmark}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <ForcedTheme scheme="dark">
      {capture ? (
        <View
          style={styles.hidden}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {card}
        </View>
      ) : (
        card
      )}
    </ForcedTheme>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    overflow: 'hidden',
  },
  // Under everything in the sheet's window and invisible; the card inside stays opaque.
  hidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
  },
  square: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    overflow: 'hidden',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
