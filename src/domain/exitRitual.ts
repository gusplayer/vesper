import { SECOND } from './time';
import type { Depth } from './types';

/**
 * The conscious exit. Ending a session is not a tap: it is a short ritual whose
 * length depends on the depth chosen when the mode was made. The easy button in it is
 * always "Seguir enfocado".
 *
 * Pure: the screen feeds it elapsed milliseconds and typed text.
 */

export type BreathPhase = 'inhale' | 'hold' | 'exhale';

/** Box-ish breathing: 4 in, 4 hold, 6 out. Three rounds are 42 seconds. */
export const BREATH_PHASES: ReadonlyArray<{ phase: BreathPhase; seconds: number }> = [
  { phase: 'inhale', seconds: 4 },
  { phase: 'hold', seconds: 4 },
  { phase: 'exhale', seconds: 6 },
];

export const BREATH_CYCLES = 3;

const CYCLE_MS = BREATH_PHASES.reduce((total, step) => total + step.seconds, 0) * SECOND;

export const BREATH_TOTAL_MS = CYCLE_MS * BREATH_CYCLES;

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

export function breathState(elapsedMs: number): BreathState {
  const clamped = Math.max(0, elapsedMs);
  if (clamped >= BREATH_TOTAL_MS) {
    return { phase: 'exhale', cycle: BREATH_CYCLES, secondsLeft: 0, progress: 1, done: true };
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
        progress: clamped / BREATH_TOTAL_MS,
        done: false,
      };
    }
    inCycle -= stepMs;
  }
  // Unreachable: the loop covers the whole cycle. Kept for the type checker.
  return { phase: 'exhale', cycle, secondsLeft: 1, progress: clamped / BREATH_TOTAL_MS, done: false };
}

export type ExitStep = 'breathe' | 'type' | 'why' | 'confirm';

/**
 * What each depth asks before letting go. Deep asks nothing because deep cannot be
 * left: the timer is the only way out (and the emergency unlock, which is not this).
 */
export function exitStepsFor(depth: Depth): ExitStep[] {
  switch (depth) {
    case 'soft':
      return ['breathe', 'confirm'];
    case 'firm':
      return ['breathe', 'type', 'why', 'confirm'];
    case 'deep':
      return [];
  }
}

/** The sentence typed in 'firm'. Short, in the first person, and not something to autocomplete. */
export const EXIT_SENTENCE = 'Elijo dejar esto ahora';

/** Case, accents, spacing and trailing punctuation do not count; the words do. */
export function normalizeSentence(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,;:!¡?¿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sentenceMatches(input: string, target: string = EXIT_SENTENCE): boolean {
  return normalizeSentence(input) === normalizeSentence(target);
}

/** How long the emergency confirmation waits before its button works. */
export const EMERGENCY_WAIT_MS = 10 * SECOND;
