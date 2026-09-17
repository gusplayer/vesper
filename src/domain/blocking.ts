/**
 * What a session asks the platform to block. Pure: it reads a mode and the user's
 * rules and answers with a plan the platform layer can apply without thinking. It
 * never touches Screen Time itself, so it is testable and runs identically where
 * Family Controls does not exist.
 */

/** The two shapes a mode can take, plus 'none' when there is nothing to block. */
export type BlockKind = 'block' | 'allow' | 'none';

export type BlockPlan = {
  kind: BlockKind;
  /** The opaque FamilyActivitySelection token, or null when there is none. */
  token: string | null;
  blockInstalls: boolean;
  blockPurchases: boolean;
  blockMature: boolean;
};

/** The bits of a mode the plan needs. Structural, so `Mode` from src/data fits as is. */
export type BlockableMode = {
  behavior: 'block' | 'allow';
  selectionToken: string | null;
};

/** The bits of the user's rules the plan needs. `Rules` from src/data fits as is. */
export type BlockRules = {
  blockInstalls: boolean;
  blockPurchases: boolean;
  blockMature: boolean;
};

/** The strings the iOS shield shows on top of a blocked app. */
export type ShieldCopy = {
  title: string;
  subtitle: string;
  primaryButtonLabel: string;
};

/**
 * The plan for a session in `mode` under `rules`. Without a mode or without a real
 * selection there is nothing to shield, so the kind is 'none'; the rules still travel
 * because the adult-content filter does not need a selection to apply.
 */
export function blockPlan(mode: BlockableMode | null, rules: BlockRules): BlockPlan {
  const token = mode === null ? null : normalizeToken(mode.selectionToken);
  return {
    kind: mode === null || token === null ? 'none' : mode.behavior,
    token,
    blockInstalls: rules.blockInstalls,
    blockPurchases: rules.blockPurchases,
    blockMature: rules.blockMature,
  };
}

/** True when the plan asks the platform for nothing at all. */
export function isEmptyPlan(plan: BlockPlan): boolean {
  return plan.kind === 'none' && !plan.blockInstalls && !plan.blockPurchases && !plan.blockMature;
}

/** The two lines the shield says, in the app's language (src/i18n, session.shield). */
export type ShieldStrings = { subtitle: string; close: string };

/**
 * 'Vesper · Sin redes' on the shield. An empty mode name leaves just 'Vesper'. The
 * button says what it does, and all it can do is close the blocked app: the shield
 * extension cannot open Vesper (ADR-0023, docs/PLATFORM_IOS.md "Escudo").
 */
export function shieldCopy(modeName: string, t: ShieldStrings): ShieldCopy {
  const name = modeName.trim();
  return {
    title: name === '' ? 'Vesper' : `Vesper · ${name}`,
    subtitle: t.subtitle,
    primaryButtonLabel: t.close,
  };
}

function normalizeToken(token: string | null): string | null {
  if (token === null) {
    return null;
  }
  return token.trim() === '' ? null : token;
}
