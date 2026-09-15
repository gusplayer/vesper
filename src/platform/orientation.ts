/**
 * Screen orientation. The app is portrait everywhere except the active session, which
 * may turn sideways into a bare clock. Wrapped so a missing module (web, a stale dev
 * client) degrades to portrait-only instead of throwing.
 */

type Module = typeof import('expo-screen-orientation');

let cached: Module | null | undefined;

function load(): Module | null {
  if (cached !== undefined) {
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-screen-orientation') as Module;
  } catch {
    cached = null;
  }
  return cached;
}

export function lockPortrait(): void {
  const module = load();
  if (module === null) {
    return;
  }
  module.lockAsync(module.OrientationLock.PORTRAIT_UP).catch(() => undefined);
}

/** Back to the app-level policy: portrait and both landscapes (app.json: default). */
export function allowRotation(): void {
  const module = load();
  if (module === null) {
    return;
  }
  module.lockAsync(module.OrientationLock.DEFAULT).catch(() => undefined);
}
