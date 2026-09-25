import { createContext, useContext, type ReactNode } from 'react';

import type { Colors } from './tokens';

/**
 * What a control is drawn on. A chip, a day circle or a segment track that is the
 * color of the card under it disappears, so the few controls that have an "off" fill
 * pick it from here: `card` on the page, `cardMuted` on a card, `card` again on a
 * muted card. `Card` (and so `ListGroup`, `FieldRow`, `StatCard`) provides it; a
 * control can still be told with its own `surface` prop.
 */
export type Surface = 'page' | 'card' | 'muted';

const SurfaceContext = createContext<Surface>('page');

export function SurfaceProvider({ surface, children }: { surface: Surface; children: ReactNode }) {
  return <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>;
}

export function useSurface(override?: Surface): Surface {
  const inherited = useContext(SurfaceContext);
  return override ?? inherited;
}

/** The fill of an unselected control on `surface`: always one step away from it. */
export function offFill(colors: Colors, surface: Surface): string {
  return surface === 'card' ? colors.cardMuted : colors.card;
}
