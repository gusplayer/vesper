import { seededRandom } from '../../lib/random';
import type { Artwork, Dot, Point, Stroke } from './types';

/**
 * Turns strokes into an ordered list of dots. Pure and deterministic for a seed.
 *
 * Dots keep stroke order, so the drawing grows the way the artist intended; within a
 * stroke they follow the line, with a little jitter so it reads as ink, not as a plot.
 */

const DEFAULT_DOT_RADIUS = 0.004;
const DEFAULT_JITTER = 0.0025;

function length(points: ReadonlyArray<Point>): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1] as Point;
    const [x1, y1] = points[i] as Point;
    total += Math.hypot(x1 - x0, y1 - y0);
  }
  return total;
}

/** Shoelace area of a closed polygon. */
function area(points: ReadonlyArray<Point>): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x0, y0] = points[i] as Point;
    const [x1, y1] = points[(i + 1) % points.length] as Point;
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum) / 2;
}

function pointAt(points: ReadonlyArray<Point>, distance: number): Point {
  let left = distance;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1] as Point;
    const [x1, y1] = points[i] as Point;
    const segment = Math.hypot(x1 - x0, y1 - y0);
    if (left <= segment || i === points.length - 1) {
      const t = segment === 0 ? 0 : Math.min(1, left / segment);
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
    }
    left -= segment;
  }
  return points[points.length - 1] as Point;
}

function inside(points: ReadonlyArray<Point>, x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i] as Point;
    const [xj, yj] = points[j] as Point;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}

function bounds(points: ReadonlyArray<Point>): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const [x, y] of points) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** How much of the dot budget a stroke deserves: its extent times its weight. */
function demand(stroke: Stroke): number {
  const weight = stroke.weight ?? 1;
  if (stroke.fill) {
    // Area scaled so a filled 0.1×0.1 square asks for about what a 0.6 line does.
    return Math.sqrt(area(stroke.points)) * 6 * weight;
  }
  return length(stroke.points) * weight;
}

/**
 * `count` dots for the artwork, in drawing order. The budget is shared among strokes
 * by their demand, so a long heavy roof gets more dots than a short whisker, and every
 * stroke gets at least two so nothing vanishes at small budgets.
 */
export function stipple(artwork: Artwork, count: number, seed: number): Dot[] {
  const random = seededRandom(seed);
  const radius = artwork.dotRadius ?? DEFAULT_DOT_RADIUS;
  const jitter = artwork.jitter ?? DEFAULT_JITTER;
  const demands = artwork.strokes.map(demand);
  const total = demands.reduce((sum, d) => sum + d, 0) || 1;
  const dots: Dot[] = [];

  artwork.strokes.forEach((stroke, index) => {
    const share = Math.max(2, Math.round((count * (demands[index] ?? 0)) / total));
    const size = radius * (stroke.size ?? 1);
    if (stroke.fill) {
      const box = bounds(stroke.points);
      let placed = 0;
      let tries = 0;
      while (placed < share && tries < share * 20) {
        tries += 1;
        const x = box.minX + random() * (box.maxX - box.minX);
        const y = box.minY + random() * (box.maxY - box.minY);
        if (inside(stroke.points, x, y)) {
          dots.push({ x, y, r: size * (0.7 + random() * 0.6) });
          placed += 1;
        }
      }
      return;
    }
    const strokeLength = length(stroke.points);
    for (let i = 0; i < share; i += 1) {
      // Evenly spaced along the line, then nudged: a hand never lands twice the same.
      const along = ((i + 0.5) / share) * strokeLength;
      const [x, y] = pointAt(stroke.points, along);
      dots.push({
        x: x + (random() - 0.5) * 2 * jitter,
        y: y + (random() - 0.5) * 2 * jitter,
        r: size * (0.7 + random() * 0.6),
      });
    }
  });

  return dots;
}

/**
 * How many dots show at this point of the session. Linear over the planned time, so
 * the last dot lands as the timer ends; a session that ends early stays unfinished,
 * which is the honest picture.
 */
export function visibleDots(total: number, elapsedMs: number, plannedMs: number): number {
  if (plannedMs <= 0) {
    return total;
  }
  const fraction = Math.min(1, Math.max(0, elapsedMs / plannedMs));
  return Math.floor(total * fraction);
}

/**
 * An SVG path that draws every visible dot as a tiny circle, in one element. Cheap to
 * render whatever the count: it is one string, not thousands of views.
 */
export function dotsPath(dots: ReadonlyArray<Dot>, visible: number, size: number): string {
  const parts: string[] = [];
  const shown = Math.min(visible, dots.length);
  for (let i = 0; i < shown; i += 1) {
    const dot = dots[i] as Dot;
    const cx = (dot.x * size).toFixed(1);
    const cy = (dot.y * size).toFixed(1);
    const r = Math.max(0.4, dot.r * size).toFixed(2);
    parts.push(`M${cx} ${cy}m-${r} 0a${r} ${r} 0 1 0 ${Number(r) * 2} 0a${r} ${r} 0 1 0 -${Number(r) * 2} 0`);
  }
  return parts.join('');
}
