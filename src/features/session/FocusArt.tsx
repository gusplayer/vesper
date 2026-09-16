import { useMemo } from 'react';
import { Pressable } from 'react-native';

import { Stack, StippleCanvas, Text } from '../../design/components';
import { artworkFor, dotBudget, seedFor } from '../../domain/art/gallery';
import { stipple, visibleDots } from '../../domain/art/stipple';
import { elapsed } from '../../domain/session';
import type { Session } from '../../domain/types';
import { useStrings } from '../../i18n';

type FocusArtProps = {
  session: Session;
  now: number;
  /** Tapping the drawing goes back to the clock. */
  onPress: () => void;
  /** Sideways: the canvas fills the height and the words go beside it, not below. */
  layout?: 'portrait' | 'landscape';
};

/**
 * The drawing that grows with the session (ADR-0018). The work and its dots are fixed
 * by the session id, computed once; each second only the visible count changes.
 */
export function FocusArt({ session, now, onPress, layout = 'portrait' }: FocusArtProps) {
  const t = useStrings().session.art;
  const artwork = useMemo(() => artworkFor(session.id), [session.id]);
  const dots = useMemo(
    () => stipple(artwork, dotBudget(session.plannedMs), seedFor(session.id)),
    [artwork, session.plannedMs, session.id],
  );
  const visible = visibleDots(dots.length, elapsed(session, now), session.plannedMs);
  const done = visible >= dots.length;

  // The drawing is domain data; its name and caption are words, so they come from the dictionary.
  const words = t.works[artwork.id];
  const label = t.label(words.name, Math.round((visible / dots.length) * 100));

  if (layout === 'landscape') {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1 }}>
        <StippleCanvas dots={dots} visible={visible} fit="height" />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Stack gap="md" align="center">
        <StippleCanvas dots={dots} visible={visible} />
        {/* No name while it grows: the drawing is its own reveal. */}
        {done ? (
          <>
            <Text variant="body" weight="medium">
              {words.name}
            </Text>
            <Text variant="caption" tone="tertiary" align="center">
              {words.caption}
            </Text>
          </>
        ) : null}
      </Stack>
    </Pressable>
  );
}
