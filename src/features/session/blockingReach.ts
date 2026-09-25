import type { ModeBehavior } from '../../data/types';
import type { Strings } from '../../i18n/es';

/**
 * What a session in a mode really blocks on this phone. Only the mode's real selection
 * (`selectionToken`) ever reaches iOS or Android (domain/blocking.blockPlan); the
 * catalogue list is an example and blocks nothing. So the home page and the closing
 * page speak from this, never from the catalogue count (rule 8: what does not exist is
 * said, not implied).
 *
 * Pure: the platform facts come in, a verdict comes out. The screen reads them from
 * `platform/blocking` through `blockingReachOf`.
 */
export type BlockingReach =
  /** The phone cannot block at all here; `reason` is the platform's lowercase fragment. */
  | { kind: 'unavailable'; reason: string | null }
  /** The phone can block, and the mode picks no apps: a valid choice, said plainly. */
  | { kind: 'nothingPicked' }
  /** A real selection; `summary` is the platform's words for it ('3 apps · 1 categoría'). */
  | { kind: 'real'; summary: string };

export type BlockingFacts = {
  available: boolean;
  reason: string | null;
  /** Apps, categories and sites the real selection holds, added up. */
  selected: number;
  summary: string;
};

export function blockingReach(facts: BlockingFacts): BlockingReach {
  if (!facts.available) {
    return { kind: 'unavailable', reason: facts.reason };
  }
  if (facts.selected === 0) {
    return { kind: 'nothingPicked' };
  }
  return { kind: 'real', summary: facts.summary };
}

export type BlockingLineStrings = Strings['focus']['blocking'];

/**
 * The line under a mode's name: 'Bloquea 3 apps', or the plain fact 'No bloquea apps'
 * (ADR-0047 §1: a mode that blocks nothing is a choice, not a fault). The same words
 * whether nothing was picked or the phone cannot block: the second is a fact about the
 * phone, said once per page by `blockingReasonText`.
 */
export function blockingLineText(reach: BlockingReach, behavior: ModeBehavior, t: BlockingLineStrings): string {
  if (reach.kind === 'real') {
    return behavior === 'allow' ? t.allowsOnly(reach.summary) : t.blocks(reach.summary);
  }
  return t.none;
}

/** 'Este teléfono no bloquea apps: …' when the phone cannot block at all; null otherwise. */
export function blockingReasonText(reach: BlockingReach, t: BlockingLineStrings): string | null {
  if (reach.kind !== 'unavailable') {
    return null;
  }
  return reach.reason === null ? t.unavailable : t.unavailableBecause(reach.reason);
}

export type ClosingBlockingStrings = Pick<Strings['session']['complete'], 'notBlocked' | 'notBlockedHere'>;

/**
 * The line under the closing page's rows when the phone could not block, with its
 * reason. Null otherwise: a real selection is the row itself, and a mode that blocks no
 * apps already says "Ninguno" in the row, as a plain fact.
 */
export function closingBlockingNote(reach: BlockingReach, t: ClosingBlockingStrings): string | null {
  if (reach.kind !== 'unavailable') {
    return null;
  }
  return reach.reason === null ? t.notBlockedHere : t.notBlocked(reach.reason);
}
