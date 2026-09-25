import type { Mode } from '../../data/types';
import { selectionSummary, selectionSummaryText, status } from '../../platform/blocking';
import { blockingReach, type BlockingReach } from './blockingReach';

/**
 * The platform's facts about a mode's real selection, read now and folded into a
 * `BlockingReach`. Cheap and synchronous, like `modes/edit` reading the same status on
 * every render. Kept apart from `blockingReach.ts` so the pure verdict can be tested
 * without a native module.
 */
export function blockingReachOf(mode: Pick<Mode, 'selectionToken'>): BlockingReach {
  const capability = status();
  const counts = selectionSummary(mode.selectionToken);
  return blockingReach({
    available: capability.available,
    reason: capability.reason,
    selected: counts.apps + counts.categories + counts.websites,
    summary: selectionSummaryText(mode.selectionToken),
  });
}
