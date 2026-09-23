import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius } from '../tokens';

type ProgressBarProps = {
  /** 0 to 1, clamped. */
  progress: number;
  /** Several segments, e.g. sessions of a day: [0.2, 0.5] as fractions of the track. */
  segments?: readonly { start: number; end: number }[];
};

/** A thin rounded track with an ink fill, or a few ink segments on it. */
export function ProgressBar({ progress, segments }: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View style={[styles.track, { backgroundColor: colors.cardMuted }]}>
      {segments === undefined ? (
        <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: colors.ink }]} />
      ) : (
        segments.map((segment, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              {
                left: `${Math.max(0, segment.start) * 100}%`,
                width: `${Math.max(0.01, segment.end - segment.start) * 100}%`,
                backgroundColor: colors.inkSecondary,
              },
            ]}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: layout.bar.track,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: layout.bar.track,
    borderRadius: radius.pill,
  },
  segment: {
    position: 'absolute',
    top: 0,
    height: layout.bar.track,
    borderRadius: radius.pill,
  },
});
