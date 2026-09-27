import { StyleSheet, View } from 'react-native';

import { layout, space } from '../tokens';
import { Card } from './Card';
import { PhotoTile } from './PhotoTile';
import { Text } from './Text';

export type PhotoMosaicItem = {
  key: string;
  /** The thumbnail, a file:// uri; null holds the place with the waiting fill. */
  uri: string | null;
  /** A short line under the thumbnail, the day it belongs to: '24'. */
  label?: string;
  /** What VoiceOver reads for it: 'Foto del martes 24'. Opening is said by the role. */
  accessibilityLabel: string;
  onPress: () => void;
};

export type PhotoMosaicRow = {
  key: string;
  /** Whose row it is ('Tú', 'Ana'). Left out when the album is one person's. */
  label?: string;
  /** In the order of the days. */
  photos: readonly PhotoMosaicItem[];
};

type PhotoMosaicProps = {
  rows: readonly PhotoMosaicRow[];
};

/**
 * The album a finished challenge leaves (ADR-0051): one row per person, the photos in
 * the order of the days, in the shape of Retro. Each thumbnail opens the photo; none
 * says how many there are, and nothing ranks the rows. The thumbnails are quiet under
 * the veil, like the grid, and wrap when a long challenge fills more than a line.
 */
export function PhotoMosaic({ rows }: PhotoMosaicProps) {
  return (
    <Card>
      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.key} style={styles.row}>
            {row.label === undefined ? null : (
              <Text variant="label" tone="secondary">
                {row.label}
              </Text>
            )}
            <View style={styles.photos}>
              {row.photos.map((photo) => (
                <View key={photo.key} style={styles.item}>
                  <PhotoTile
                    uri={photo.uri}
                    muted
                    size="thumb"
                    onPress={photo.onPress}
                    accessibilityLabel={photo.accessibilityLabel}
                  />
                  {photo.label === undefined ? null : (
                    <Text variant="caption" tone="secondary" align="center" decorative>
                      {photo.label}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  rows: {
    rowGap: space.lg,
  },
  row: {
    rowGap: space.sm,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: layout.photo.gap,
  },
  item: {
    width: layout.photo.thumb,
    rowGap: space.xxs,
  },
});
