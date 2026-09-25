import { DEMO_CHALLENGE_ID, DEMO_MEMBER_IDS } from './circleSeed';

/**
 * What the demo seed writes, by id: the one place that knows which rows are examples,
 * so "Quitar los datos de ejemplo" removes exactly those and nothing of the user's
 * (ADR-0047 §1). The ids never depend on the language; `seededIds.test.ts` checks them
 * against the seed functions so the two cannot drift.
 */
export type SeededIds = {
  /** Every seeded session id starts with this ('demo-2026-08-18-0'). */
  sessionPrefix: string;
  modes: readonly string[];
  schedules: readonly string[];
  habits: readonly string[];
  /** The four invented people of the demo circle. */
  members: readonly string[];
  /** The demo challenge, "Leer". */
  challenge: string;
};

export const SEEDED_IDS: SeededIds = {
  sessionPrefix: 'demo-',
  modes: ['mode-no-socials', 'mode-family', 'mode-deep-work'],
  schedules: ['schedule-work', 'schedule-sleep', 'schedule-walk'],
  habits: ['habit-gym', 'habit-read', 'habit-sleep'],
  members: DEMO_MEMBER_IDS,
  challenge: DEMO_CHALLENGE_ID,
};

/** Whether a session id is one of the seeded history's. */
export function isSeededSession(id: string, ids: SeededIds = SEEDED_IDS): boolean {
  return id.startsWith(ids.sessionPrefix);
}
