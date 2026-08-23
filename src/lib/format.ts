/**
 * Presentation-only formatting. Lives outside domain/ because how a number reads is a
 * UI decision, not a rule of the product.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** 'mm:ss', or 'h:mm:ss' past an hour. Used by the session clock. */
export function timerText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / SECOND));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);

  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** '2h 15m', '45m', '0m'. Used by the ledger, where seconds are noise. */
export function durationText(ms: number): string {
  const total = Math.max(0, ms);
  const hours = Math.floor(total / HOUR);
  const minutes = Math.floor((total % HOUR) / MINUTE);

  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

/** Whole minutes, for the duration chips. */
export function minutesText(ms: number): string {
  return String(Math.round(ms / MINUTE));
}

/** 'domingo, 23 de agosto'. Lowercase, like everything else in the app. */
export function dayText(now: number): string {
  return new Date(now)
    .toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    .toLowerCase();
}
