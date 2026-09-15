import type { Artwork } from '../types';

/**
 * A dog sitting, seen from the side, facing left. Shiba-like: pointed muzzle, upright
 * ears, tail curled over the back. Strokes in sketching order: ground, the long body
 * contours, legs, head and ears, tail, then eye, nose, mouth and a few fur ticks.
 */
export const dog: Artwork = {
  id: 'dog',
  name: 'Perro',
  caption: 'Se sienta y espera contigo.',
  dotRadius: 0.0036,
  jitter: 0.003,
  strokes: [
    // Ground shadow: a thin sparse band under the paws.
    {
      points: [
        [0.24, 0.862], [0.30, 0.868], [0.40, 0.875], [0.52, 0.88], [0.64, 0.878],
        [0.74, 0.87], [0.78, 0.862], [0.74, 0.885], [0.64, 0.895], [0.52, 0.90],
        [0.40, 0.897], [0.30, 0.89], [0.24, 0.862],
      ],
      fill: true,
      weight: 0.3,
    },
    // Back line, from the root of the tail up to the nape.
    {
      points: [
        [0.73, 0.585], [0.715, 0.55], [0.69, 0.515], [0.66, 0.48], [0.625, 0.45],
        [0.59, 0.425], [0.55, 0.405], [0.51, 0.39], [0.475, 0.378], [0.445, 0.37],
        [0.42, 0.36], [0.405, 0.35],
      ],
      weight: 1.8,
    },
    // Rump: from the tail root around the haunch and down to the ground.
    {
      points: [
        [0.73, 0.585], [0.752, 0.62], [0.767, 0.665], [0.772, 0.71], [0.765, 0.755],
        [0.748, 0.795], [0.72, 0.83], [0.68, 0.852], [0.64, 0.858], [0.61, 0.858],
      ],
      weight: 1.8,
    },
    // Haunch: front of the thigh from the belly down to the hind paw, then the ground.
    {
      points: [
        [0.465, 0.668], [0.485, 0.675], [0.505, 0.69], [0.518, 0.715], [0.523, 0.745],
        [0.52, 0.775], [0.51, 0.80], [0.495, 0.822], [0.478, 0.838], [0.468, 0.852],
        [0.49, 0.862], [0.54, 0.862], [0.58, 0.862], [0.61, 0.858],
      ],
      weight: 1.8,
    },
    // Chest and near front leg, throat to paw.
    {
      points: [
        [0.30, 0.378], [0.287, 0.41], [0.275, 0.45], [0.268, 0.50], [0.27, 0.55],
        [0.28, 0.60], [0.29, 0.65], [0.293, 0.70], [0.29, 0.75], [0.288, 0.79],
        [0.278, 0.82], [0.262, 0.84], [0.27, 0.852], [0.31, 0.855], [0.35, 0.852],
        [0.36, 0.84],
      ],
      weight: 1.8,
    },
    // Back edge of the near front leg, then the belly to the haunch.
    {
      points: [
        [0.36, 0.84], [0.36, 0.80], [0.358, 0.75], [0.355, 0.70], [0.355, 0.66],
        [0.365, 0.645], [0.395, 0.65], [0.43, 0.66], [0.465, 0.668],
      ],
      weight: 1.2,
    },
    // Far front leg, only the edge that shows behind the near one.
    {
      points: [
        [0.39, 0.845], [0.42, 0.845], [0.428, 0.83], [0.425, 0.78], [0.42, 0.72],
        [0.415, 0.67],
      ],
      weight: 0.9,
    },
    // Head: nape over the skull, brow, pointed muzzle, chin, jaw, back to the nape.
    {
      points: [
        [0.405, 0.35], [0.42, 0.30], [0.415, 0.25], [0.395, 0.21], [0.36, 0.19],
        [0.32, 0.192], [0.29, 0.21], [0.275, 0.235], [0.25, 0.255], [0.225, 0.278],
        [0.205, 0.298], [0.19, 0.312], [0.198, 0.328], [0.22, 0.338], [0.245, 0.35],
        [0.27, 0.365], [0.30, 0.378], [0.335, 0.385], [0.37, 0.378], [0.405, 0.35],
      ],
      weight: 1.6,
    },
    // Near ear, upright.
    {
      points: [[0.295, 0.205], [0.305, 0.155], [0.318, 0.10], [0.34, 0.145], [0.356, 0.19], [0.295, 0.205]],
      weight: 1.2,
    },
    // Inner line of the near ear.
    {
      points: [[0.308, 0.195], [0.318, 0.135], [0.342, 0.185]],
      weight: 0.5,
    },
    // Far ear, filled so it sits behind.
    {
      points: [[0.365, 0.19], [0.385, 0.15], [0.40, 0.108], [0.41, 0.16], [0.412, 0.215], [0.365, 0.19]],
      fill: true,
      weight: 0.8,
    },
    // Tail: a thick comma curled over the back, outer edge from the root to the tip
    // and back along the inner edge.
    {
      points: [
        [0.735, 0.585], [0.765, 0.545], [0.778, 0.49], [0.77, 0.43], [0.742, 0.385],
        [0.70, 0.365], [0.655, 0.38], [0.632, 0.42], [0.64, 0.455], [0.665, 0.448],
        [0.678, 0.425], [0.70, 0.415], [0.722, 0.425], [0.733, 0.45], [0.735, 0.49],
        [0.73, 0.53], [0.72, 0.565], [0.735, 0.585],
      ],
      weight: 1.4,
    },
    // Tail: bushy, so ink inside the curl.
    {
      points: [
        [0.735, 0.585], [0.765, 0.545], [0.778, 0.49], [0.77, 0.43], [0.742, 0.385],
        [0.70, 0.365], [0.655, 0.38], [0.632, 0.42], [0.64, 0.455], [0.665, 0.448],
        [0.678, 0.425], [0.70, 0.415], [0.722, 0.425], [0.733, 0.45], [0.735, 0.49],
        [0.73, 0.53], [0.72, 0.565], [0.735, 0.585],
      ],
      fill: true,
      weight: 0.7,
    },
    // Eye: a small filled almond, slanted toward the ear.
    {
      points: [
        [0.272, 0.265], [0.283, 0.254], [0.298, 0.25], [0.31, 0.255], [0.30, 0.266],
        [0.285, 0.27], [0.272, 0.265],
      ],
      fill: true,
      weight: 1.4,
      size: 1.3,
    },
    // Nose: a filled triangle at the tip of the muzzle.
    {
      points: [[0.196, 0.31], [0.216, 0.302], [0.21, 0.326], [0.196, 0.31]],
      fill: true,
      weight: 1.4,
      size: 1.2,
    },
    // Mouth line along the jaw.
    {
      points: [[0.205, 0.33], [0.228, 0.336], [0.25, 0.34], [0.268, 0.338]],
      weight: 0.7,
    },
    // Fur ticks on the chest.
    { points: [[0.31, 0.45], [0.325, 0.465], [0.33, 0.485]], weight: 0.4 },
    { points: [[0.315, 0.515], [0.33, 0.53], [0.335, 0.55]], weight: 0.4 },
    { points: [[0.32, 0.58], [0.335, 0.595], [0.34, 0.615]], weight: 0.4 },
    // Fur ticks on the neck ruff.
    { points: [[0.385, 0.40], [0.395, 0.43], [0.39, 0.46]], weight: 0.4 },
    // Fur ticks on the haunch.
    { points: [[0.585, 0.63], [0.568, 0.652], [0.56, 0.68]], weight: 0.4 },
    { points: [[0.65, 0.68], [0.632, 0.705], [0.622, 0.735]], weight: 0.4 },
    { points: [[0.61, 0.765], [0.60, 0.79], [0.598, 0.815]], weight: 0.4 },
    // Fur tick on the cheek.
    { points: [[0.34, 0.33], [0.352, 0.35], [0.356, 0.37]], weight: 0.4 },
  ],
};
