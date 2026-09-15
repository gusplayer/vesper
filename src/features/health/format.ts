/**
 * How a Health sync reads on screen. Pure: epoch ms in, Spanish text out. Lives with
 * the health feature because the activity tab and the Health settings page are the
 * only two places that speak of syncs.
 */

/** '9:05', '14:30'. Local time, twenty-four hours, no leading zero on the hour. */
export function clockText(at: number): string {
  const date = new Date(at);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** 'sincronizado 14:30', or what to say before the first read. */
export function syncedText(syncedAt: number | null): string {
  return syncedAt === null ? 'sin sincronizar' : `sincronizado ${clockText(syncedAt)}`;
}
