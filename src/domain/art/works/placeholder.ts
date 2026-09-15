import type { Artwork } from '../types';

/** A circle, so the engine has something to draw before the gallery is authored. */
export const placeholder: Artwork = {
  id: 'placeholder',
  name: 'Círculo',
  strokes: [
    {
      points: Array.from({ length: 49 }, (_, i) => {
        const angle = (i / 48) * Math.PI * 2;
        return [0.5 + Math.cos(angle) * 0.3, 0.5 + Math.sin(angle) * 0.3] as const;
      }),
    },
  ],
};
