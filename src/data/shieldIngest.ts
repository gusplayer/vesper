import { transaction } from '../db/client';
import * as breaksRepo from '../db/repositories/breaks';
import * as sessionsRepo from '../db/repositories/sessions';
import * as shieldEventsRepo from '../db/repositories/shieldEvents';
import { BREAK_MS, breakEndsAt, endBreak, isBreakOver, startBreakAt } from '../domain/session';
import type { ShieldEvent } from '../domain/types';

/**
 * What the native shield queued while nobody in JS was listening (ADR-0053), written
 * down in the order it happened. Every event becomes a `usage_events` row. A break
 * taken from the shield also becomes the running session's break, at the instant it
 * was tapped: the service lifted the shield then, and the clock has to agree.
 *
 * The replay runs the session forward event by event: a break that was over by the
 * time of the next tap is ended where the domain ends it, so two breaks from the shield
 * in one queue both land. Closing a session that ran out is left to settle(), which
 * runs right after (boot) or on the next check (foreground), so its closing screen is
 * owed exactly as it always is.
 *
 * Runs before anything settles the session: at boot before `recoverOrphans`, in the
 * foreground before `settleNow`. Otherwise a session a shield break pushed back would
 * close at its old end. Returns whether the running session changed.
 */
export function ingestShieldEvents(events: readonly ShieldEvent[]): boolean {
  if (events.length === 0) {
    return false;
  }
  const ordered = [...events].sort((a, b) => a.at - b.at);
  let changed = false;
  transaction(() => {
    for (const event of ordered) {
      shieldEventsRepo.insert(event);
      if (event.kind !== 'unlock_granted') {
        continue;
      }
      const running = sessionsRepo.findRunning();
      if (running === null) {
        continue;
      }
      let current = running;
      if (isBreakOver(current, event.at)) {
        current = endBreak(current, breakEndsAt(current) ?? event.at);
      }
      const next = startBreakAt(current, event.at, event.lengthMs ?? BREAK_MS);
      if (next === running) {
        continue;
      }
      sessionsRepo.update(next);
      if (current !== running) {
        breaksRepo.follow(running, current);
      }
      if (next !== current) {
        breaksRepo.follow(current, next, { source: 'shield', token: event.token });
      }
      changed = true;
    }
  });
  return changed;
}
