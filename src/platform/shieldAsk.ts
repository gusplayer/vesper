import type { NativeAskCopy, NativeShieldEvent } from '../../modules/vesper-blocking';
import { BREAK_CHOICES_MS, BREAK_EVERY_MS } from '../domain/session';
import type { ShieldEvent, ShieldEventKind } from '../domain/types';
import type { Strings } from '../i18n/es';
import type { PlanTiming } from './blockingTypes';

/**
 * The pure half of the Android shield that asks and counts (ADR-0053): what a plan
 * carries so the shield can decide with no JS awake, and how the native queue becomes
 * domain events. blocking.android.ts calls these; tests call them without a phone.
 */

export type NativeBreakPolicy = {
  breakUnlocksAt: number | null;
  breakEveryMs: number;
  breakChoicesMs: number[];
};

/**
 * From the session's timing: when the next break unlocks, the focus between breaks and
 * the lengths offered. Deep has no breaks at all: no unlock and no interval, so the
 * shield says deep's line instead.
 */
export function breakPolicy(timing: PlanTiming): NativeBreakPolicy {
  return {
    breakUnlocksAt: timing.deep ? null : timing.breakUnlocksAt,
    breakEveryMs: timing.deep ? 0 : BREAK_EVERY_MS,
    breakChoicesMs: [...BREAK_CHOICES_MS],
  };
}

/** The words of the pause row and of today's count, from the current dictionary. */
export function askCopy(t: Strings['session']): NativeAskCopy {
  return {
    shieldPause: t.shield.pauseFocus,
    shieldMinutes: t.shield.minutes,
    shieldNextBreak: t.shield.nextBreak,
    shieldNoBreak: t.active.deepOnlyTimer,
    shieldToday: t.shield.today,
    shieldAttemptOne: t.shield.attemptOne,
    shieldAttemptOther: t.shield.attemptOther,
    shieldBreakOne: t.shield.breakOne,
    shieldBreakOther: t.shield.breakOther,
  };
}

const KINDS: readonly ShieldEventKind[] = ['shield_hit', 'backed_off', 'unlock_granted'];

/**
 * The native queue as domain events. An event of a kind this build does not know, with
 * no app, or with no usable instant is dropped rather than guessed at; a length only
 * survives on a break.
 */
export function parseShieldEvents(raw: readonly NativeShieldEvent[]): ShieldEvent[] {
  return raw.flatMap((event): ShieldEvent[] => {
    const kind = KINDS.find((known) => known === event.kind);
    if (kind === undefined || event.packageName === '' || !Number.isFinite(event.at)) {
      return [];
    }
    const lengthMs = kind === 'unlock_granted' && event.lengthMs !== null && Number.isFinite(event.lengthMs) ? event.lengthMs : null;
    return [{ kind, platform: 'android', token: event.packageName, at: event.at, lengthMs }];
  });
}
