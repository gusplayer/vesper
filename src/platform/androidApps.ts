import type { LaunchableApp } from '../../modules/vesper-blocking';
import { isAndroid } from './capabilities';

/**
 * The launchable apps of the phone, for the Android picker. Lives beside blocking.ts
 * rather than inside it because iOS has no such list (ADR-0004) and the two platform
 * files must export the same names. Empty where the module is missing.
 */
export async function listLaunchableApps(withIcons: boolean): Promise<LaunchableApp[]> {
  if (!isAndroid) {
    return [];
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: the module may be absent
    const { requireVesperBlocking } = require('../../modules/vesper-blocking') as typeof import('../../modules/vesper-blocking');
    return await requireVesperBlocking().listLaunchableApps(withIcons);
  } catch (error) {
    if (__DEV__) {
      console.warn('[blocking] listLaunchableApps failed:', error instanceof Error ? error.message : String(error));
    }
    return [];
  }
}
