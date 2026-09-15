import type { Artwork, Point, Stroke } from '../types';

/**
 * The Statue of Liberty from the harbor: torch on the right of the frame, tablet on
 * the left. Drawn from the ground up: fort, pedestal, robe, arms, head, crown. The
 * flame is the last thing to light.
 */

const HEAD: Point = [0.5, 0.272];
const HEAD_RX = 0.035;
const HEAD_RY = 0.042;
/** The diadem sits just outside the head. */
const BAND = 0.005;

/** Points on an ellipse between two angles in degrees (y down, so 270 is the top). */
function ellipse(cx: number, cy: number, rx: number, ry: number, from: number, to: number, n: number): Point[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}

/** One ray of the crown: from the diadem outward, along the angle in degrees. */
function ray(angle: number, length: number): Stroke {
  const a = (angle * Math.PI) / 180;
  const [cx, cy] = HEAD;
  const rx = HEAD_RX + BAND;
  const ry = HEAD_RY + BAND;
  return {
    points: [
      [cx + rx * Math.cos(a), cy + ry * Math.sin(a)],
      [cx + (rx + length) * Math.cos(a), cy + (ry + length) * Math.sin(a)],
    ],
    weight: 1.4,
    size: 1.3,
  };
}

const fold = (points: Point[]): Stroke => ({ points, weight: 0.5, size: 0.9 });

export const liberty: Artwork = {
  id: 'liberty',
  name: 'Estatua de la Libertad',
  caption: 'Lleva la antorcha en alto desde 1886. Tú solo sostén esta sesión.',
  strokes: [
    // Ground, the star fort and the pedestal.
    { points: [[0.14, 0.9], [0.86, 0.9]], weight: 0.7, size: 0.9 },
    { points: [[0.2, 0.9], [0.23, 0.855], [0.77, 0.855], [0.8, 0.9]], weight: 0.9 },
    { points: [[0.31, 0.855], [0.335, 0.765], [0.665, 0.765], [0.69, 0.855]], weight: 1.2 },
    { points: [[0.345, 0.81], [0.655, 0.81]], weight: 0.4 },
    { points: [[0.32, 0.765], [0.68, 0.765]], weight: 1.2, size: 1.1 },
    { points: [[0.375, 0.765], [0.375, 0.745], [0.625, 0.745], [0.625, 0.765]], weight: 1.1 },
    // The robe: two tapering edges and long folds falling from the waist.
    {
      points: [[0.385, 0.745], [0.395, 0.68], [0.41, 0.6], [0.425, 0.52], [0.435, 0.44], [0.435, 0.38], [0.43, 0.35]],
      weight: 1.8,
    },
    {
      points: [[0.615, 0.745], [0.605, 0.68], [0.59, 0.6], [0.575, 0.52], [0.565, 0.45], [0.565, 0.4], [0.57, 0.36]],
      weight: 1.8,
    },
    fold([[0.425, 0.735], [0.445, 0.6], [0.465, 0.45]]),
    fold([[0.48, 0.735], [0.487, 0.58], [0.495, 0.42]]),
    fold([[0.545, 0.735], [0.535, 0.6], [0.52, 0.46]]),
    fold([[0.585, 0.725], [0.57, 0.6], [0.55, 0.52]]),
    // Shoulders.
    { points: [[0.43, 0.35], [0.45, 0.345], [0.47, 0.34], [0.485, 0.335]], weight: 1.4 },
    { points: [[0.515, 0.335], [0.535, 0.34], [0.555, 0.345], [0.575, 0.355]], weight: 1.4 },
    // Left arm holding the tablet against the hip.
    { points: [[0.43, 0.355], [0.405, 0.395], [0.39, 0.44]], weight: 1.4 },
    { points: [[0.355, 0.445], [0.435, 0.43], [0.445, 0.55], [0.365, 0.565], [0.355, 0.445]], weight: 1.4 },
    { points: [[0.375, 0.47], [0.43, 0.46]], weight: 0.6 },
    { points: [[0.38, 0.5], [0.435, 0.49]], weight: 0.6 },
    // Right arm raised, the sleeve hanging from it down the side, and the torch.
    { points: [[0.575, 0.355], [0.61, 0.3], [0.635, 0.24], [0.645, 0.18], [0.647, 0.158]], weight: 1.6 },
    { points: [[0.548, 0.34], [0.58, 0.295], [0.605, 0.245], [0.615, 0.19], [0.617, 0.16]], weight: 1.6 },
    { points: [[0.612, 0.285], [0.628, 0.34], [0.622, 0.4], [0.6, 0.45], [0.583, 0.475]], weight: 0.8 },
    { points: [[0.632, 0.158], [0.632, 0.14]], weight: 1.2, size: 1.1 },
    { points: [[0.598, 0.14], [0.666, 0.14], [0.655, 0.118], [0.609, 0.118], [0.598, 0.14]], weight: 1.4 },
    // Neck, head, the profile turned a little to the left, the diadem.
    { points: [[0.485, 0.335], [0.485, 0.312]], weight: 1 },
    { points: [[0.515, 0.335], [0.515, 0.312]], weight: 1 },
    { points: ellipse(HEAD[0], HEAD[1], HEAD_RX, HEAD_RY, 0, 360, 24), weight: 1.5 },
    { points: [[0.478, 0.255], [0.474, 0.27], [0.469, 0.28], [0.476, 0.286], [0.474, 0.295], [0.48, 0.305]], weight: 0.9 },
    { points: [[0.484, 0.266], [0.492, 0.265]], weight: 0.7 },
    { points: ellipse(HEAD[0], HEAD[1], HEAD_RX + BAND, HEAD_RY + BAND, 195, 345, 12), weight: 1.3, size: 1.1 },
    // The seven rays of the crown.
    ray(190, 0.04),
    ray(215, 0.048),
    ray(241, 0.053),
    ray(268, 0.056),
    ray(295, 0.053),
    ray(321, 0.048),
    ray(346, 0.04),
    // The flame, last.
    {
      points: [
        [0.61, 0.118],
        [0.654, 0.118],
        [0.664, 0.102],
        [0.652, 0.088],
        [0.642, 0.096],
        [0.632, 0.082],
        [0.622, 0.096],
        [0.61, 0.09],
        [0.604, 0.105],
        [0.61, 0.118],
      ],
      fill: true,
      weight: 1.2,
      size: 1.1,
    },
  ],
};
