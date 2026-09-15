import type { Depth } from '../domain/types';

/**
 * The words the UI uses for domain values. Domain code speaks in identifiers; this is
 * where they become Spanish, in one place, so the phase-2 i18n pass has one file to
 * translate.
 */

export const DEPTH_LABEL: Record<Depth, string> = {
  soft: 'suave',
  firm: 'firme',
  deep: 'profundo',
};

export const DEPTH_DESCRIPTION: Record<Depth, string> = {
  soft: 'mantener pulsado termina de inmediato',
  firm: 'te pregunta por qué y espera 15 segundos',
  deep: 'no responde. solo el timer termina',
};

/** What the hold control says during a session. In deep, the words are the control. */
export const GIVE_UP_LABEL: Record<Depth, string> = {
  soft: 'mantén pulsado para terminar',
  firm: 'mantén pulsado para terminar',
  deep: 'profundo · solo el timer termina',
};
