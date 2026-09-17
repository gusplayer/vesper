import type { Strings } from '../../i18n/es';
import { clockText } from '../../lib/format';

/**
 * How a Health sync reads on screen. Pure: epoch ms in, text out. Lives with the
 * health feature because the activity tab and the Health settings page are the only
 * two places that speak of syncs. The words come from the `habits` slice of the
 * dictionary (`useStrings().habits`, ADR-0020); the clock is `lib/format`'s, the same
 * in every language.
 */

/** 'sincronizado 14:30', or what to say before the first read. */
export function syncedText(syncedAt: number | null, t: Strings['habits']): string {
  return syncedAt === null ? t.sync.never : t.sync.at(clockText(syncedAt));
}
