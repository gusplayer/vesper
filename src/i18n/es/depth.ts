import type { Depth } from '../../domain/types';

export type DepthStrings = {
  label: Record<Depth, string>;
  description: Record<Depth, string>;
  /** What the hold control says during a session. In deep, the words are the control. */
  giveUp: Record<Depth, string>;
};

/** The three depths of a session, as the mode editor, the sheet and the hold control say them. */
export const depth: DepthStrings = {
  label: {
    soft: 'suave',
    firm: 'firme',
    deep: 'profundo',
  },
  description: {
    soft: 'mantener pulsado termina de inmediato',
    firm: 'te pregunta por qué y espera 15 segundos',
    deep: 'no responde. solo el timer termina',
  },
  giveUp: {
    soft: 'mantén pulsado para terminar',
    firm: 'mantén pulsado para terminar',
    deep: 'profundo · solo el timer termina',
  },
};
