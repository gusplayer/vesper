import type { Depth } from '../../domain/types';

export type DepthStrings = {
  label: Record<Depth, string>;
  description: Record<Depth, string>;
};

/** The three depths of a session, as the mode editor and the mode sheet say them. */
export const depth: DepthStrings = {
  label: {
    soft: 'suave',
    firm: 'firme',
    deep: 'profundo',
  },
  /** How each depth lets you out (ADR-0025). */
  description: {
    soft: 'una ronda de respiración y terminas',
    firm: 'dos rondas, la frase y un motivo',
    deep: 'no responde. solo el timer termina',
  },
};
