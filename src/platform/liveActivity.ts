import type { CapabilityStatus } from './capabilities';

/**
 * liveActivity: platform seam. Filled in by its team; this stub keeps the app building and
 * honest in the meantime.
 */

export function status(): CapabilityStatus {
  return { available: false, reason: 'todavía no integrado' };
}
