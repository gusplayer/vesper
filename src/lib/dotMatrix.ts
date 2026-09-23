/**
 * A QR matrix drawn as a field of dots (ADR-0034).
 *
 * The key's code had to look like Vesper and not like a parking ticket, and the way to
 * get both that and a code a phone can actually read is to keep the content a standard
 * QR and change only the ink: the three finder patterns stay square, because that is
 * what a decoder looks for first, and every other module becomes a circle.
 *
 * Two paths come out, because they are filled the same but have to be built
 * differently, and because a decoder that struggles is a decoder we want to be able to
 * test against the squares alone.
 *
 * Pure: a boolean matrix in, two SVG path strings out. No imports.
 */

/** How wide a finder pattern is, in modules, by the standard. */
const FINDER = 7;

/** A dot fills this much of its module. Under ~0.8 the code stops reading reliably. */
const DOT_SCALE = 0.86;

export type DotMatrixPaths = {
  /** The three corner squares, as unit squares. */
  finders: string;
  /** Every other dark module, as a circle inside its cell. */
  dots: string;
};

/** The same read-only shape `encodeQr` returns. */
export type DotMatrix = readonly (readonly boolean[])[];

/** True where (x, y) falls inside one of the three finder patterns. */
export function inFinder(x: number, y: number, size: number): boolean {
  const near = (v: number) => v < FINDER || v >= size - FINDER;
  const topLeft = x < FINDER && y < FINDER;
  const topRight = x >= size - FINDER && y < FINDER;
  const bottomLeft = x < FINDER && y >= size - FINDER;
  return near(x) && near(y) && (topLeft || topRight || bottomLeft);
}

export function dotMatrixPaths(matrix: DotMatrix): DotMatrixPaths {
  const size = matrix.length;
  const radius = DOT_SCALE / 2;
  let finders = '';
  let dots = '';

  for (let y = 0; y < size; y += 1) {
    const row = matrix[y];
    if (row === undefined) {
      continue;
    }
    for (let x = 0; x < size; x += 1) {
      if (row[x] !== true) {
        continue;
      }
      if (inFinder(x, y, size)) {
        finders += `M${x} ${y}h1v1h-1z`;
        continue;
      }
      // Two half-circle arcs, starting at the left of the dot: a circle with no
      // <Circle> element, so the whole field is still one path.
      const cx = x + 0.5;
      const cy = y + 0.5;
      const d = radius * 2;
      dots += `M${round(cx - radius)} ${round(cy)}a${round(radius)} ${round(radius)} 0 1 0 ${round(d)} 0a${round(radius)} ${round(radius)} 0 1 0 ${round(-d)} 0z`;
    }
  }

  return { finders, dots };
}

/** Three decimals is plenty at this scale and keeps the path short. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
