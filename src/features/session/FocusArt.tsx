import { useMemo } from 'react';
import { Pressable } from 'react-native';

import { Stack, StippleCanvas, Text } from '../../design/components';
import { artworkFor, dotBudget, seedFor } from '../../domain/art/gallery';
import { stipple, visibleDots } from '../../domain/art/stipple';
import { elapsed } from '../../domain/session';
import type { Session } from '../../domain/types';

type FocusArtProps = {
  session: Session;
  now: number;
  /** Tapping the drawing goes back to the clock. */
  onPress: () => void;
};

/**
 * The drawing that grows with the session (ADR-0018). The work and its dots are fixed
 * by the session id, computed once; each second only the visible count changes.
 */
export function FocusArt({ session, now, onPress }: FocusArtProps) {
  const artwork = useMemo(() => artworkFor(session.id), [session.id]);
  const dots = useMemo(
    () => stipple(artwork, dotBudget(session.plannedMs), seedFor(session.id)),
    [artwork, session.plannedMs, session.id],
  );
  const visible = visibleDots(dots.length, elapsed(session, now), session.plannedMs);
  const done = visible >= dots.length;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${artwork.name}, ${Math.round((visible / dots.length) * 100)} por ciento. Toca para volver al reloj`}
    >
      <Stack gap="md" align="center">
        <StippleCanvas dots={dots} visible={visible} />
        <Text variant="body" weight="medium">
          {artwork.name}
        </Text>
        <Text variant="caption" tone="tertiary" align="center">
          {done ? (artwork.caption ?? 'Terminado.') : 'Se termina cuando termina la sesión.'}
        </Text>
      </Stack>
    </Pressable>
  );
}
