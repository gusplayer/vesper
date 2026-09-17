import { breakEndsAt, plannedEndAt } from '../domain/session';
import type { Session } from '../domain/types';
import type { session as sessionStrings } from '../i18n/es/session';
import type { FocusActivityPhase, FocusActivityProps } from '../widgets/FocusActivity';

/**
 * The pure half of the Live Activity: what a session looks like as an activity, and
 * what the widget receives. Nothing native, nothing from the stores, so vitest can
 * cover it; src/platform/liveActivity.ts and its hook do the talking.
 *
 * The props carry no clock text. Every time the widget shows is a native
 * `Text timerInterval` counting between `startedAt` and `endsAt` (ADR-0023), so the
 * app never has to refresh them, and `statusText` only names the phase.
 */

export type FocusInput = {
  modeName: string;
  phase: FocusActivityPhase;
  startedAt: number;
  endsAt: number;
};

type LiveActivityStrings = (typeof sessionStrings)['liveActivity'];

/** The interval the activity counts for a session, or during its break. */
export function focusInputFor(session: Session, modeName: string): FocusInput {
  const breakEnd = breakEndsAt(session);
  if (breakEnd !== null && session.breakStartedAt !== null) {
    // The break counts down on its own; the session waits behind it.
    return { modeName, phase: 'break', startedAt: session.breakStartedAt, endsAt: breakEnd };
  }
  return {
    modeName,
    phase: session.open ? 'open' : 'focus',
    startedAt: session.startedAt,
    // Never null outside a break; the cap for an open session, which counts up anyway.
    endsAt: plannedEndAt(session) ?? session.startedAt + session.plannedMs,
  };
}

export function statusTextFor(phase: FocusActivityPhase, t: LiveActivityStrings): string {
  switch (phase) {
    case 'break':
      return t.statusBreak;
    case 'open':
      return t.statusOpen;
    case 'focus':
      return t.statusFocus;
  }
}

export function focusActivityProps(input: FocusInput, t: LiveActivityStrings): FocusActivityProps {
  return {
    modeName: input.modeName,
    phase: input.phase,
    startedAt: input.startedAt,
    endsAt: input.endsAt,
    statusText: statusTextFor(input.phase, t),
  };
}
