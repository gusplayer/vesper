import { seedFromString, seededRandom } from '../../lib/random';
import type { Artwork } from './types';

/**
 * The gallery: every artwork the app can draw. Each lives in its own file under
 * ./works and is registered here. Order does not matter; the pick is random.
 */
import { WORKS } from './works';

export const GALLERY: ReadonlyArray<Artwork> = WORKS;

/** The artwork for a session: random, but the same every time that session is opened. */
export function artworkFor(sessionId: string): Artwork {
  const random = seededRandom(seedFromString(sessionId));
  const index = Math.floor(random() * GALLERY.length);
  return GALLERY[index] ?? (GALLERY[0] as Artwork);
}

/** The dot seed for a session, distinct from the pick. */
export function seedFor(sessionId: string): number {
  return seedFromString(`${sessionId}:dots`);
}

/**
 * Dot budget by session length: enough that the last dots keep landing, few enough
 * that a phone draws it in one path. A 25-minute session lands a dot every ~0.5 s.
 */
export function dotBudget(plannedMs: number): number {
  const minutes = plannedMs / 60_000;
  return Math.round(Math.min(6000, Math.max(1500, minutes * 120)));
}
