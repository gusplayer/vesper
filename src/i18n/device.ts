import { getLocales } from 'expo-localization';

import type { DeviceLocale } from './locale';

/**
 * The only file that talks to expo-localization. Everything else receives a plain
 * `DeviceLocale[]`, so the resolution is pure and tests never load a native module.
 */
export function readDeviceLocales(): DeviceLocale[] {
  try {
    return getLocales().map((entry) => ({
      languageCode: entry.languageCode ?? null,
      languageTag: entry.languageTag,
    }));
  } catch {
    return [];
  }
}
