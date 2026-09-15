import { MINUTE } from '../domain/time';
import { isValidPlannedMs } from '../domain/session';

/**
 * Small rules for text the user typed. Presentation layer: they decide what a field
 * means, not what the product allows.
 */

/** Trimmed text, or null when nothing was written. Whitespace is not an intention. */
export function emptyToNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}

/** Only digits survive, so a number pad and a pasted 'abc' end up the same. */
export function digitsOnly(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

/** The custom duration field: whole minutes inside the allowed range, or null. */
export function parsePlannedMinutes(text: string): number | null {
  const digits = digitsOnly(text);
  if (digits === '') {
    return null;
  }
  const minutes = Number(digits);
  return isValidPlannedMs(minutes * MINUTE) ? minutes : null;
}
