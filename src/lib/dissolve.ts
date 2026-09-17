/**
 * Stipple dissolves: a field of small squares that turn on in an order, so a surface
 * can fill with ink (or with paper) the way the focus art draws itself, dot by dot
 * (ADR-0018). Pure: given a size and a direction, it returns the dots bucketed into
 * layers by the moment they appear. A component animates one opacity per layer.
 */

export type DissolveDirection =
  /** From both ends of the width toward the middle: the hold on the focus button. */
  | { kind: 'inward' }
  /** Outward from a point, in window coordinates of the field: the flood into a session. */
  | { kind: 'radial'; x: number; y: number };

export type DissolveOptions = {
  width: number;
  height: number;
  /** Distance between dot centers. */
  spacing: number;
  /** How many opacity layers; more is smoother and costs one view each. */
  layers: number;
  direction: DissolveDirection;
  /** 0 is a clean wipe, 1 is pure noise. */
  noise?: number;
  seed?: number;
};

export type DissolveLayer = {
  /** An SVG path of unit squares, one per dot, in field coordinates. */
  path: string;
};

/** mulberry32: small, deterministic, good enough to place dots. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** When a dot at (x, y) is reached by the wipe, 0 first and 1 last, before noise. */
function order(direction: DissolveDirection, x: number, y: number, width: number, height: number): number {
  if (direction.kind === 'inward') {
    const half = width / 2;
    return half === 0 ? 0 : 1 - Math.abs(x - half) / half;
  }
  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ];
  const reach = Math.max(...corners.map(([cx = 0, cy = 0]) => Math.hypot(cx - direction.x, cy - direction.y)));
  return reach === 0 ? 0 : Math.hypot(x - direction.x, y - direction.y) / reach;
}

/**
 * Buckets the dots of a `width` × `height` field into `layers` paths. Layer i holds
 * the dots that appear while progress runs from i / layers to (i + 1) / layers.
 */
export function dissolveLayers({
  width,
  height,
  spacing,
  layers,
  direction,
  noise = 0.35,
  seed = 7,
}: DissolveOptions): DissolveLayer[] {
  const next = random(seed);
  const parts: string[][] = Array.from({ length: layers }, () => []);
  if (width <= 0 || height <= 0 || spacing <= 0 || layers <= 0) {
    return parts.map(() => ({ path: '' }));
  }
  const side = Math.max(1, Math.round(spacing * 0.72));
  const columns = Math.ceil(width / spacing);
  const rows = Math.ceil(height / spacing);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * spacing + spacing / 2;
      const y = row * spacing + spacing / 2;
      const when = clamp01(order(direction, x, y, width, height) * (1 - noise) + next() * noise);
      const layer = Math.min(layers - 1, Math.floor(when * layers));
      parts[layer]?.push(`M${(x - side / 2).toFixed(1)} ${(y - side / 2).toFixed(1)}h${side}v${side}h-${side}z`);
    }
  }
  return parts.map((dots) => ({ path: dots.join('') }));
}
