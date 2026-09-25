import { useMemo } from 'react';

import { Stack, StippleCanvas, Tappable, Text } from '../../design/components';
import { artworkFor, dotBudget, seedFor } from '../../domain/art/gallery';
import { stipple, visibleDots } from '../../domain/art/stipple';
import { elapsed } from '../../domain/session';
import { HOUR } from '../../domain/time';
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
 * How long a session with no limit takes to draw its work (ADR-0047 §12). Its
 * `plannedMs` is the 12 h cap, which would leave the drawing at 8 % after an hour; at
 * two hours it is complete and stays so.
 */
const OPEN_SESSION_ART_MS = 2 * HOUR;

/**
 * The drawing that grows with the session (ADR-0018). The work and its dots are fixed
 * by the session id, computed once; each second only the visible count changes. A
 * timed session draws over its planned length, an open one over two hours.
 */
export function FocusArt({ session, now, onPress, layout = 'portrait' }: FocusArtProps) {
  const t = useStrings().session.art;
  const artwork = useMemo(() => artworkFor(session.id), [session.id]);
  const paceMs = session.open ? OPEN_SESSION_ART_MS : session.plannedMs;
  const dots = useMemo(
    () => stipple(artwork, dotBudget(paceMs), seedFor(session.id)),
    [artwork, paceMs, session.id],
  );
  const visible = visibleDots(dots.length, elapsed(session, now), paceMs);
  const done = visible >= dots.length;

  // The drawing is domain data; its name and caption are words, so they come from the dictionary.
  const words = t.works[artwork.id];
  const label = t.label(words.name, Math.round((visible / dots.length) * 100));

  if (layout === 'landscape') {
    return <StippleCanvas dots={dots} visible={visible} fit="height" onPress={onPress} accessibilityLabel={label} />;
  }

  return (
    <Tappable onPress={onPress} accessibilityLabel={label}>
      <Stack gap="md" align="center">
        <StippleCanvas dots={dots} visible={visible} />
        {/* No name while it grows: the drawing is its own reveal. */}
        {done ? (
          <>
            <Text variant="body" weight="medium">
              {words.name}
            </Text>
            <Text variant="caption" tone="secondary" align="center">
              {words.caption}
            </Text>
          </>
        ) : null}
      </Stack>
    </Tappable>
  );
}
