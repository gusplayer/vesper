import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * What this build can really do. Every native capability goes through here so the UI
 * can say "en el simulador esto no existe" instead of failing silently.
 *
 * Each module in src/platform/ exposes `isAvailable()`; this file holds the facts they
 * all need. Nothing here imports a native module: importing one on a platform that
 * lacks it would throw at load time.
 */

export const isIos = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

/** True on a physical phone; false in the simulator and the emulator. */
export const isDevice: boolean = Constants.isDevice ?? false;

export type CapabilityName = 'notifications' | 'health' | 'liveActivity' | 'blocking';

export type CapabilityStatus = {
  /** The native module exists and the platform supports it here. */
  available: boolean;
  /** One line for the UI when it is not: why, in the app's current language. */
  reason: string | null;
};
