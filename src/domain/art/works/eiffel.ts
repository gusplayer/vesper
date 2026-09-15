import type { Artwork, Point, Stroke } from '../types';

/**
 * The Eiffel Tower, seen from the Champ de Mars: two concave sweeps from the ground
 * to the antenna, three platforms, a lattice only suggested. Drawn ground first, legs
 * and arch, then upward platform by platform; the sky comes last.
 */

const GROUND = 0.88;
const TIP = 0.12;
const SPAN = GROUND - TIP;

/**
 * Half-width of the body at a height fraction (0 at the ground, 1 at the antenna
 * tip), in unit space. Real proportions: the base is a little over a third of the
 * height; the first floor sits at 0.18, the second at 0.36, the third at 0.85.
 */
const PROFILE: ReadonlyArray<Point> = [
  [0.0, 0.18],
  [0.03, 0.158],
  [0.07, 0.138],
  [0.11, 0.121],
  [0.15, 0.107],
  [0.176, 0.1],
  [0.22, 0.086],
  [0.27, 0.072],
  [0.32, 0.06],
  [0.355, 0.053],
  [0.44, 0.043],
  [0.53, 0.035],
  [0.62, 0.029],
  [0.72, 0.024],
  [0.82, 0.022],
  [0.88, 0.02],
];

function halfWidth(h: number): number {
  for (let i = 1; i < PROFILE.length; i += 1) {
    const [h0, w0] = PROFILE[i - 1] as Point;
    const [h1, w1] = PROFILE[i] as Point;
    if (h <= h1) {
      return w0 + ((w1 - w0) * (h - h0)) / (h1 - h0);
    }
  }
  return (PROFILE[PROFILE.length - 1] as Point)[1];
}

function y(h: number): number {
  return GROUND - SPAN * h;
}

/** A point on the outer edge at height fraction `h`; side -1 is the left leg. */
function outer(h: number, side: -1 | 1): Point {
  return [0.5 + side * halfWidth(h), y(h)];
}

/** Inner edge of a leg below the first floor: the legs stand apart, the arch spans the gap. */
function inner(h: number, side: -1 | 1): Point {
  return [0.5 + side * (0.105 - 0.06 * h), y(h)];
}

/** Half ellipse from the right foot of the arch over the top to the left foot. */
function arch(rx: number, ry: number, top: number): Point[] {
  const cy = top + ry;
  return Array.from({ length: 17 }, (_, i) => {
    const a = Math.PI * (i / 16);
    return [0.5 + rx * Math.cos(a), cy - ry * Math.sin(a)];
  });
}

function edge(side: -1 | 1): Point[] {
  return PROFILE.map(([h]) => outer(h, side));
}

function platform(hw: number, top: number, bottom: number): Point[] {
  return [
    [0.5 - hw, top],
    [0.5 + hw, top],
    [0.5 + hw, bottom],
    [0.5 - hw, bottom],
    [0.5 - hw, top],
  ];
}

const lattice = (points: Point[], weight = 0.55): Stroke => ({ points, weight, size: 0.8 });

export const eiffel: Artwork = {
  id: 'eiffel',
  name: 'Torre Eiffel',
  caption: 'Se levantó pieza a pieza, como tu sesión.',
  strokes: [
    // Ground and the four feet as two heavy stubs.
    { points: [[0.15, GROUND], [0.85, GROUND]], weight: 0.8, size: 0.9 },
    { points: [outer(0, -1), inner(0, -1)], weight: 1.6, size: 1.1 },
    { points: [inner(0, 1), outer(0, 1)], weight: 1.6, size: 1.1 },
    // Outer sweeps, ground to the top of the body.
    { points: edge(-1), weight: 1.6 },
    { points: edge(1), weight: 1.6 },
    // Inner edges of the legs joined by the great arch under the first floor.
    {
      points: [inner(0, 1), inner(0.05, 1), ...arch(0.096, 0.06, 0.762), inner(0.05, -1), inner(0, -1)],
      weight: 1.5,
    },
    { points: arch(0.08, 0.048, 0.774), weight: 0.8 },
    // First floor.
    { points: platform(0.118, 0.732, 0.756), weight: 1.3 },
    // Lattice in the legs: one cross per leg, braced at mid-height.
    lattice([outer(0.02, -1), inner(0.15, -1)], 0.65),
    lattice([inner(0.02, -1), outer(0.15, -1)], 0.65),
    lattice([outer(0.085, -1), inner(0.085, -1)]),
    lattice([inner(0.02, 1), outer(0.15, 1)], 0.65),
    lattice([outer(0.02, 1), inner(0.15, 1)], 0.65),
    lattice([inner(0.085, 1), outer(0.085, 1)]),
    // Second floor and the big cross between the two platforms.
    { points: platform(0.066, 0.6, 0.618), weight: 1.5 },
    lattice([outer(0.2, -1), outer(0.34, 1)]),
    lattice([outer(0.2, 1), outer(0.34, -1)]),
    lattice([outer(0.27, -1), outer(0.27, 1)]),
    // Upper body: two more crosses, each tied by a girder, and the intermediate level.
    lattice([outer(0.41, -1), outer(0.57, 1)]),
    lattice([outer(0.41, 1), outer(0.57, -1)]),
    lattice([outer(0.49, -1), outer(0.49, 1)]),
    lattice([outer(0.59, -1), outer(0.59, 1)], 0.9),
    lattice([outer(0.61, -1), outer(0.78, 1)]),
    lattice([outer(0.61, 1), outer(0.78, -1)]),
    lattice([outer(0.695, -1), outer(0.695, 1)]),
    // Third floor, the cap and the antenna.
    { points: platform(0.034, 0.248, 0.266), weight: 1.4 },
    { points: [[0.48, y(0.88)], [0.52, y(0.88)]], weight: 1.2 },
    { points: [[0.5, y(0.88)], [0.5, TIP]], weight: 1.3, size: 0.8 },
    // Sky: a thin moon and two birds.
    {
      points: [
        ...Array.from({ length: 13 }, (_, i): Point => {
          const a = (-100 + (200 * i) / 12) * (Math.PI / 180);
          return [0.8 + 0.035 * Math.cos(a), 0.2 + 0.035 * Math.sin(a)];
        }),
        ...Array.from({ length: 13 }, (_, i): Point => {
          const a = (100 - (200 * i) / 12) * (Math.PI / 180);
          return [0.786 + 0.032 * Math.cos(a), 0.2 + 0.032 * Math.sin(a)];
        }),
      ],
      fill: true,
      weight: 0.6,
      size: 0.8,
    },
    { points: [[0.19, 0.31], [0.205, 0.302], [0.22, 0.31]], weight: 0.8, size: 0.8 },
    { points: [[0.24, 0.275], [0.252, 0.268], [0.264, 0.275]], weight: 0.8, size: 0.8 },
  ],
};
