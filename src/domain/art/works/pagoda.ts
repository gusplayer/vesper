import type { Artwork, Point } from '../types';

/**
 * A five-tier pagoda, ink and dots on a dark ground.
 *
 * Composition: the tower stands on a stepped stone base at the centre of the square,
 * roofs narrowing upward to a spire; a thin moon high on the right and low distant
 * hills at both edges give it air. Everything sits inside 0.08–0.92.
 *
 * Stroke order follows the builder: ground, then the base, then each tier as walls,
 * balcony rail, roof edge, under-eave line and roof band, bottom to top; the spire;
 * then windows and eave accents; and last the hills, mist and moon, which appear as
 * the session ends.
 */

const CX = 0.5;
/** How far the roof curve runs past its deepest point: the eaves turn up. */
const SWEEP = Math.PI * 0.8;
/** Roof thickness under the edge, at the ridge and at the tip. */
const THICK_RIDGE = 0.024;
const THICK_TIP = 0.004;

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * One side of a roof, ridge to eave tip, pushed down by `offset` at the ridge tapering
 * to half that at the tip. The curve falls steeply, flattens, then lifts at the tip.
 * `side` is -1 for the left edge, 1 for the right.
 */
function roofSide(side: -1 | 1, ridgeHw: number, ridgeY: number, tipHw: number, drop: number, n: number, offset = 0): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const x = CX + side * (ridgeHw + (tipHw - ridgeHw) * t);
    const y = ridgeY + drop * Math.sin(t * SWEEP) + offset * (1 - t * (1 - THICK_TIP / THICK_RIDGE));
    return [r3(x), r3(y)] as const;
  });
}

/** The full roof edge, left tip over the ridge to the right tip. */
function roofEdge(ridgeHw: number, ridgeY: number, tipHw: number, drop: number, n: number, offset = 0): Point[] {
  return [
    ...roofSide(-1, ridgeHw, ridgeY, tipHw, drop, n, offset).reverse(),
    ...roofSide(1, ridgeHw, ridgeY, tipHw, drop, n, offset),
  ];
}

/** The roof as a closed band to fill with ink: the edge on top, the under-eave line below. */
function roofBand(ridgeHw: number, ridgeY: number, tipHw: number, drop: number, n: number): Point[] {
  const edge = roofEdge(ridgeHw, ridgeY, tipHw, drop, n);
  const under = roofEdge(ridgeHw, ridgeY, tipHw, drop, n, THICK_RIDGE).reverse();
  return [...edge, ...under, edge[0] as Point];
}

function arc(cx: number, cy: number, r: number, from: number, to: number, n: number): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const a = from + ((to - from) * i) / (n - 1);
    return [r3(cx + Math.cos(a) * r), r3(cy + Math.sin(a) * r)] as const;
  });
}

function square(x: number, y: number, s: number): Point[] {
  return [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];
}

export const pagoda: Artwork = {
  id: 'pagoda',
  strokes: [
    // Ground: a soft line dipping under the base.
    { points: [[0.08, 0.882], [0.25, 0.868], [0.5, 0.862], [0.75, 0.866], [0.92, 0.879]], weight: 0.8 },

    // Stone base: two steps.
    { points: [[0.22, 0.862], [0.22, 0.836], [0.78, 0.834], [0.78, 0.862]], weight: 1.2 },
    { points: [[0.27, 0.835], [0.27, 0.802], [0.73, 0.8], [0.73, 0.835]], weight: 1.2 },

    // Tier 1: walls, door, roof (ridge 0.675, eaves out to 0.255–0.745).
    { points: [[0.37, 0.802], [0.37, 0.715]], weight: 1.6 },
    { points: [[0.63, 0.8], [0.63, 0.715]], weight: 1.6 },
    { points: [[0.47, 0.8], [0.47, 0.762], ...arc(0.5, 0.762, 0.03, Math.PI, Math.PI * 2, 9), [0.53, 0.8]], weight: 0.9 },
    { points: roofEdge(0.115, 0.675, 0.245, 0.065, 14), weight: 1.8 },
    { points: roofEdge(0.115, 0.675, 0.245, 0.065, 12, THICK_RIDGE), weight: 1 },
    { points: roofBand(0.115, 0.675, 0.245, 0.065, 12), fill: true, weight: 1 },

    // Tier 2 (ridge 0.57).
    { points: [[0.392, 0.675], [0.392, 0.605]], weight: 1.6 },
    { points: [[0.608, 0.675], [0.608, 0.605]], weight: 1.6 },
    { points: [[0.376, 0.662], [0.624, 0.662]], weight: 0.8 },
    { points: roofEdge(0.097, 0.57, 0.207, 0.058, 14), weight: 1.8 },
    { points: roofEdge(0.097, 0.57, 0.207, 0.058, 12, THICK_RIDGE), weight: 1 },
    { points: roofBand(0.097, 0.57, 0.207, 0.058, 12), fill: true, weight: 1 },

    // Tier 3 (ridge 0.478).
    { points: [[0.41, 0.57], [0.41, 0.51]], weight: 1.6 },
    { points: [[0.59, 0.57], [0.59, 0.51]], weight: 1.6 },
    { points: [[0.394, 0.558], [0.606, 0.558]], weight: 0.8 },
    { points: roofEdge(0.08, 0.478, 0.175, 0.05, 12), weight: 1.8 },
    { points: roofEdge(0.08, 0.478, 0.175, 0.05, 12, THICK_RIDGE), weight: 1 },
    { points: roofBand(0.08, 0.478, 0.175, 0.05, 12), fill: true, weight: 1 },

    // Tier 4 (ridge 0.395).
    { points: [[0.426, 0.478], [0.426, 0.425]], weight: 1.6 },
    { points: [[0.574, 0.478], [0.574, 0.425]], weight: 1.6 },
    { points: [[0.41, 0.467], [0.59, 0.467]], weight: 0.8 },
    { points: roofEdge(0.064, 0.395, 0.145, 0.044, 12), weight: 1.8 },
    { points: roofEdge(0.064, 0.395, 0.145, 0.044, 10, THICK_RIDGE), weight: 1 },
    { points: roofBand(0.064, 0.395, 0.145, 0.044, 10), fill: true, weight: 1 },

    // Tier 5: the peaked top roof (apex 0.29).
    { points: [[0.441, 0.395], [0.441, 0.35]], weight: 1.6 },
    { points: [[0.559, 0.395], [0.559, 0.35]], weight: 1.6 },
    { points: [[0.426, 0.384], [0.574, 0.384]], weight: 0.8 },
    { points: roofEdge(0.012, 0.29, 0.12, 0.07, 12), weight: 1.8 },
    { points: roofEdge(0.012, 0.29, 0.12, 0.07, 10, THICK_RIDGE), weight: 1 },
    { points: roofBand(0.012, 0.29, 0.12, 0.07, 10), fill: true, weight: 1 },

    // Spire: mast, three rings, finial.
    { points: [[0.5, 0.29], [0.5, 0.13]], weight: 1.2 },
    { points: [[0.474, 0.25], [0.526, 0.25]], weight: 0.8 },
    { points: [[0.48, 0.21], [0.52, 0.21]], weight: 0.8 },
    { points: [[0.486, 0.17], [0.514, 0.17]], weight: 0.8 },
    { points: arc(0.5, 0.115, 0.012, 0, Math.PI * 2, 12), weight: 1, size: 1.3 },

    // Windows, tier by tier; the top tier is too small for one.
    { points: square(0.405, 0.742, 0.03), weight: 0.7 },
    { points: square(0.565, 0.742, 0.03), weight: 0.7 },
    { points: square(0.432, 0.622, 0.025), weight: 0.7 },
    { points: square(0.543, 0.622, 0.025), weight: 0.7 },
    { points: square(0.487, 0.522, 0.026), weight: 0.7 },
    { points: [[0.486, 0.446], [0.514, 0.446]], weight: 0.7 },

    // Eave accents: one heavier dot at each lower tip.
    { points: [[0.255, 0.713], [0.256, 0.712]], size: 1.6 },
    { points: [[0.745, 0.713], [0.744, 0.712]], size: 1.6 },
    { points: [[0.293, 0.604], [0.294, 0.603]], size: 1.5 },
    { points: [[0.707, 0.604], [0.706, 0.603]], size: 1.5 },

    // Atmosphere, last: distant hills, mist at the base, a thin moon.
    { points: [[0.08, 0.8], [0.11, 0.755], [0.145, 0.715], [0.175, 0.735], [0.205, 0.762], [0.235, 0.79]], weight: 0.5 },
    { points: [[0.78, 0.8], [0.83, 0.765], [0.87, 0.75], [0.92, 0.775]], weight: 0.5 },
    { points: [[0.1, 0.83], [0.21, 0.828]], weight: 0.4 },
    { points: [[0.79, 0.822], [0.9, 0.826]], weight: 0.4 },
    { points: arc(0.77, 0.21, 0.055, 0, Math.PI * 2, 40), weight: 0.4 },
  ],
};
