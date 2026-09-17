/**
 * Focus art: an illustration that draws itself, dot by dot, over a session.
 *
 * An artwork is a list of strokes in drawing order, the way a calligrapher orders
 * them: ground before walls, walls before roof, roof before ornament. Each stroke is a
 * polyline in a unit square (0..1, y down). The engine turns strokes into dots; the
 * session clock decides how many dots are visible.
 */

export type Point = readonly [x: number, y: number];

export type Stroke = {
  /** Two or more points, in unit space. Closed shapes repeat the first point last. */
  points: readonly Point[];
  /**
   * Relative dot density along this stroke. 1 is a normal line; 2 a heavy one; 0.4 a
   * whisper. The engine spreads the artwork's dot budget in proportion.
   */
  weight?: number;
  /** Dot radius scale for this stroke, relative to the artwork's base. */
  size?: number;
  /**
   * Fill the polygon (closed stroke) with scattered dots instead of tracing its edge.
   * Density still follows `weight`. For roofs, shadows, foliage.
   */
  fill?: boolean;
};

/** Every work in the gallery. The name and caption per language live in `src/i18n`. */
export type ArtworkId = 'dog' | 'eiffel' | 'face' | 'liberty' | 'pagoda';

export type Artwork = {
  id: ArtworkId;
  strokes: readonly Stroke[];
  /** Base dot radius in unit space. ~0.004 reads as ink dots on a phone. */
  dotRadius?: number;
  /** Jitter across the stroke, in unit space. Gives the hand-made feel. */
  jitter?: number;
};

export type Dot = {
  x: number;
  y: number;
  r: number;
};
