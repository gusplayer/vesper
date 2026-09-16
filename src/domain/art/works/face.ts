import type { Artwork, Point } from '../types';

/**
 * A face in profile, facing left, gaze a little down. Hair gathered in a low bun.
 *
 * Drawn the way a portraitist blocks in a head: the big silhouette first (crown,
 * profile, bun, neck, shoulders), then the hair mass, then the small marks that make it
 * a person (brow, nostril, mouth, eye, ear), and last the strands and a breath of
 * shadow under the jaw.
 *
 * Canon used: crown 0.14, eye line 0.39, nose base 0.50, mouth 0.55, chin 0.61; the
 * skull runs back to 0.745 so its depth is about 0.8 of its height.
 */

/** A closed ellipse as a polyline, first point repeated last. */
function ellipse(cx: number, cy: number, rx: number, ry: number, steps: number): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i / steps) * Math.PI * 2;
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] as const;
  });
}

const BUN: Point = [0.712, 0.5];
/** Hair is drawn with finer dots than the ink line, so it reads as texture, not edge. */
const HAIR_DOT = 0.75;

export const face: Artwork = {
  id: 'face',
  jitter: 0.003,
  strokes: [
    // --- Silhouette -------------------------------------------------------------
    // Crown: from the hairline on the forehead over the skull to where the bun sits.
    {
      weight: 1.2,
      points: [
        [0.405, 0.205], [0.425, 0.178], [0.455, 0.158], [0.495, 0.143], [0.54, 0.137],
        [0.595, 0.14], [0.64, 0.155], [0.675, 0.185], [0.705, 0.215], [0.727, 0.26],
        [0.74, 0.31], [0.745, 0.36], [0.74, 0.405], [0.73, 0.44],
      ],
    },
    // The profile: forehead, brow, nose, lips, chin, throat. One line, no lifting.
    {
      weight: 1.8,
      points: [
        [0.405, 0.205], [0.388, 0.245], [0.374, 0.29], [0.366, 0.33], [0.364, 0.352],
        [0.37, 0.372], [0.362, 0.395], [0.348, 0.42], [0.334, 0.443], [0.32, 0.462],
        [0.311, 0.478], [0.313, 0.49], [0.325, 0.497], [0.342, 0.5], [0.354, 0.503],
        [0.35, 0.515], [0.341, 0.526], [0.334, 0.537], [0.348, 0.547], [0.335, 0.558],
        [0.343, 0.572], [0.358, 0.583], [0.352, 0.598], [0.36, 0.612], [0.378, 0.624],
        [0.402, 0.632], [0.425, 0.636], [0.44, 0.65], [0.444, 0.685], [0.446, 0.72],
        [0.448, 0.75], [0.452, 0.772], [0.458, 0.784],
      ],
    },
    // Bun outline, a little wider than tall, and the twist inside it.
    { weight: 1, points: ellipse(BUN[0], BUN[1], 0.062, 0.056, 20) },
    { weight: 0.6, points: [[0.724, 0.472], [0.74, 0.49], [0.736, 0.514], [0.718, 0.522], [0.704, 0.51]] },
    // Nape and back of the neck, from under the bun to the shoulder.
    {
      weight: 1,
      points: [[0.672, 0.545], [0.665, 0.58], [0.66, 0.62], [0.658, 0.67], [0.662, 0.72], [0.67, 0.762]],
    },
    // Jaw: from under the chin back to the angle, then up to the ear lobe.
    {
      weight: 1,
      points: [
        [0.425, 0.636], [0.465, 0.638], [0.508, 0.63], [0.548, 0.612], [0.577, 0.586],
        [0.596, 0.555], [0.603, 0.525], [0.602, 0.502],
      ],
    },
    // Shoulders, front and back.
    {
      weight: 0.9,
      points: [[0.458, 0.784], [0.44, 0.795], [0.41, 0.805], [0.37, 0.816], [0.32, 0.83], [0.27, 0.842], [0.23, 0.85]],
    },
    {
      weight: 0.9,
      points: [[0.67, 0.762], [0.69, 0.775], [0.72, 0.792], [0.76, 0.815], [0.8, 0.842]],
    },

    // --- Hair mass --------------------------------------------------------------
    // Hairline (forehead, temple, over and behind the ear, nape) then back along the
    // crown to close. The bun covers the corner at the nape.
    {
      fill: true,
      weight: 0.6,
      size: HAIR_DOT,
      points: [
        [0.405, 0.205], [0.425, 0.228], [0.437, 0.258], [0.45, 0.29], [0.475, 0.315],
        [0.51, 0.335], [0.55, 0.35], [0.585, 0.358], [0.615, 0.365], [0.642, 0.385],
        [0.656, 0.42], [0.665, 0.465], [0.668, 0.53],
        [0.73, 0.44], [0.74, 0.405], [0.745, 0.36], [0.74, 0.31], [0.727, 0.26],
        [0.705, 0.215], [0.675, 0.185], [0.64, 0.155], [0.595, 0.14], [0.54, 0.137],
        [0.495, 0.143], [0.455, 0.158], [0.425, 0.178], [0.405, 0.205],
      ],
    },
    { fill: true, weight: 0.6, size: HAIR_DOT, points: ellipse(BUN[0], BUN[1], 0.062, 0.056, 20) },

    // --- Features ---------------------------------------------------------------
    // Brow, from the ridge back over the eye.
    {
      weight: 1,
      points: [[0.366, 0.348], [0.382, 0.34], [0.402, 0.336], [0.424, 0.338], [0.446, 0.346], [0.462, 0.356]],
    },
    // Wing of the nose.
    { weight: 0.8, points: [[0.348, 0.462], [0.36, 0.472], [0.364, 0.487], [0.358, 0.5]] },
    // Mouth line, back from the corner of the lips, lifting a little at the end.
    { weight: 1, points: [[0.348, 0.547], [0.367, 0.549], [0.387, 0.551], [0.403, 0.547]] },
    // Eye: an almond with a heavy upper lid, looking down.
    {
      weight: 1,
      points: [
        [0.391, 0.398], [0.4, 0.387], [0.414, 0.38], [0.43, 0.379], [0.444, 0.386],
        [0.435, 0.396], [0.419, 0.402], [0.404, 0.403], [0.391, 0.398],
      ],
    },
    // Iris, low and forward.
    { fill: true, weight: 1.2, size: 1.2, points: ellipse(0.407, 0.394, 0.006, 0.007, 10) },
    // Ear: a C opening toward the face, and the fold inside.
    {
      weight: 1,
      points: [
        [0.58, 0.385], [0.6, 0.372], [0.622, 0.378], [0.636, 0.4], [0.636, 0.43],
        [0.626, 0.462], [0.61, 0.488], [0.59, 0.496], [0.582, 0.488],
      ],
    },
    { weight: 0.6, points: [[0.594, 0.402], [0.61, 0.402], [0.618, 0.425], [0.612, 0.452]] },

    // --- Strands, sweeping back and down toward the bun, spaced unevenly -------
    {
      weight: 0.4,
      size: HAIR_DOT,
      points: [
        [0.435, 0.205], [0.49, 0.18], [0.555, 0.172], [0.612, 0.188], [0.662, 0.225],
        [0.693, 0.275], [0.705, 0.34], [0.7, 0.4], [0.688, 0.445],
      ],
    },
    { weight: 0.4, size: HAIR_DOT, points: [[0.47, 0.235], [0.52, 0.215], [0.575, 0.212]] },
    { weight: 0.4, size: HAIR_DOT, points: [[0.58, 0.205], [0.635, 0.225], [0.675, 0.262]] },
    {
      weight: 0.4,
      size: HAIR_DOT,
      points: [
        [0.45, 0.265], [0.505, 0.24], [0.565, 0.236], [0.62, 0.255], [0.665, 0.295],
        [0.682, 0.35], [0.68, 0.41], [0.67, 0.455],
      ],
    },
    { weight: 0.4, size: HAIR_DOT, points: [[0.54, 0.3], [0.59, 0.298], [0.63, 0.318]] },
    {
      weight: 0.4,
      size: HAIR_DOT,
      points: [[0.47, 0.305], [0.52, 0.285], [0.57, 0.285], [0.615, 0.31], [0.648, 0.355], [0.658, 0.41], [0.663, 0.46]],
    },
    {
      weight: 0.4,
      size: HAIR_DOT,
      points: [[0.545, 0.345], [0.588, 0.34], [0.62, 0.36], [0.638, 0.398], [0.648, 0.44], [0.66, 0.49]],
    },

    // --- Shadow under the jaw ---------------------------------------------------
    {
      fill: true,
      weight: 0.22,
      points: [
        [0.45, 0.648], [0.5, 0.643], [0.545, 0.623], [0.575, 0.598], [0.59, 0.588],
        [0.585, 0.613], [0.55, 0.643], [0.5, 0.663], [0.46, 0.668], [0.45, 0.648],
      ],
    },
  ],
};
