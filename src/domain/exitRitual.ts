import { SECOND } from './time';
import type { Depth } from './types';

/**
 * The conscious exit. Ending a session is not a tap: it is a short ritual whose
 * length depends on the depth chosen when the mode was made. The ritual is held, not
 * watched: the breathing clock only runs while the finger rests on the Vesper object,
 * and letting go mid-round sends that round back to its start (ADR-0025). The easy
 * button in it is always "Seguir enfocado".
 *
 * Pure: the screen feeds it held milliseconds and typed text.
 */

export type BreathPhase = 'inhale' | 'hold' | 'exhale';

/** Box-ish breathing: 4 in, 4 hold, 6 out. Three rounds are 42 seconds. */
export const BREATH_PHASES: ReadonlyArray<{ phase: BreathPhase; seconds: number }> = [
  { phase: 'inhale', seconds: 4 },
  { phase: 'hold', seconds: 4 },
  { phase: 'exhale', seconds: 6 },
];

/** Rounds of breathing before the way out opens. Firm asks for one more than soft. */
export function breathCyclesFor(depth: Depth): number {
  return depth === 'firm' ? 2 : 1;
}

export const CYCLE_MS = BREATH_PHASES.reduce((total, step) => total + step.seconds, 0) * SECOND;

export function breathTotalMs(cycles: number): number {
  return CYCLE_MS * cycles;
}

/** How long one phase lasts, in milliseconds. */
export function phaseDurationMs(phase: BreathPhase): number {
  const step = BREATH_PHASES.find((candidate) => candidate.phase === phase);
  return (step?.seconds ?? 0) * SECOND;
}

/**
 * Where the breathing clock lands when the finger lets go. Completed rounds are kept;
 * a round left halfway starts over. A release exactly on a round boundary changes
 * nothing.
 */
export function releaseBreath(heldMs: number): number {
  const clamped = Math.max(0, heldMs);
  return Math.floor(clamped / CYCLE_MS) * CYCLE_MS;
}

export type BreathState = {
  phase: BreathPhase;
  /** 1-based, for "ronda 2 de 3". */
  cycle: number;
  /** Whole seconds left in the phase, counting down to 1. */
  secondsLeft: number;
  /** 0 to 1 over the whole breathing step. */
  progress: number;
  done: boolean;
};

export function breathState(elapsedMs: number, cycles = 1): BreathState {
  const clamped = Math.max(0, elapsedMs);
  const total = breathTotalMs(cycles);
  if (clamped >= total) {
    return { phase: 'exhale', cycle: cycles, secondsLeft: 0, progress: 1, done: true };
  }
  const cycle = Math.floor(clamped / CYCLE_MS) + 1;
  let inCycle = clamped % CYCLE_MS;
  for (const step of BREATH_PHASES) {
    const stepMs = step.seconds * SECOND;
    if (inCycle < stepMs) {
      return {
        phase: step.phase,
        cycle,
        secondsLeft: Math.ceil((stepMs - inCycle) / SECOND),
        progress: clamped / total,
        done: false,
      };
    }
    inCycle -= stepMs;
  }
  // Unreachable: the loop covers the whole cycle. Kept for the type checker.
  return { phase: 'exhale', cycle, secondsLeft: 1, progress: clamped / total, done: false };
}

export type ExitStep = 'breathe' | 'commit';

/**
 * What each depth asks before letting go. Soft breathes once and the way out opens on
 * that same screen. Firm breathes twice, then types the sentence (and may say why).
 * Deep asks nothing because deep cannot be left: the timer is the only way out (and
 * the emergency unlock, which is not this). Short on purpose: the ritual must not
 * cost the time it protects.
 */
export function exitStepsFor(depth: Depth): ExitStep[] {
  switch (depth) {
    case 'soft':
      return ['breathe'];
    case 'firm':
      return ['breathe', 'commit'];
    case 'deep':
      return [];
  }
}

/**
 * The sentence typed in 'firm' lives in the dictionary (`session.exit.sentence`, one
 * per language) and arrives here as `target`: this module stays pure and knows no
 * words of its own. Case, accents, spacing and trailing punctuation do not count;
 * the words do.
 */
export function normalizeSentence(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,;:!¡?¿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when what was typed is the expected sentence, give or take case, accents and punctuation. */
export function sentenceMatches(input: string, target: string): boolean {
  return normalizeSentence(input) === normalizeSentence(target);
}

/** How long the emergency confirmation waits before its button works. */
export const EMERGENCY_WAIT_MS = 10 * SECOND;
