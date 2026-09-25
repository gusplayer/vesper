import type { Depth } from '../../domain/types';

export type DepthStrings = {
  label: Record<Depth, string>;
  description: Record<Depth, string>;
};

/**
 * The three depths of a session, as the mode editor and the mode sheet say them. In
 * sentence case, so no screen capitalizes them by hand; a sentence that needs the word
 * mid-line lowercases it itself.
 */
export const depth: DepthStrings = {
  label: {
    soft: 'Suave',
    firm: 'Firme',
    deep: 'Profundo',
  },
  /** How each depth lets you out (ADR-0025) and whether it has breaks (ADR-0022). */
  description: {
    soft: 'Una ronda de respiración y terminas.',
    firm: 'Dos rondas de respiración, la frase y un motivo si quieres.',
    deep: 'Sin salida ni pausas: solo el reloj termina, salvo una emergencia.',
  },
};
