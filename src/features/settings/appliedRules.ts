import type { Rules } from '../../data/types';
import { isIos, type CapabilityStatus } from '../../platform/capabilities';

export type RuleKey = keyof Rules;

/**
 * The rules this phone really applies during a session, as `platform/blocking` reports
 * them in `status().detail.appliedRules`: today only the adult content filter, and only
 * through Screen Time on iOS. Strict mode, installs and purchases are kept but reach no
 * system, and Android has no equivalent for any of them.
 *
 * Nothing applies while blocking itself is unavailable. A status without the list (an
 * older platform module) falls back to what the platforms are known to apply.
 */
export function appliedRules(blocking: CapabilityStatus): readonly RuleKey[] {
  if (!blocking.available) {
    return [];
  }
  return blocking.detail?.appliedRules ?? (isIos ? ['blockMature'] : []);
}
