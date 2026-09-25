import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * What this build can really do. Every native capability goes through here so the UI
 * can say "en el simulador esto no existe" instead of failing silently.
 *
 * Each module in src/platform/ exposes `status()`; this file holds the facts they
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
  /**
   * Platform-specific facts a screen may show next to the capability, filled only
   * where they exist (Android's exact-alarm toggle for routine windows). Never a
   * substitute for `reason`: `available` and `reason` alone say whether the
   * capability works; `detail` only adds what the platform knows on top.
   */
  detail?: {
    /** SCHEDULE_EXACT_ALARM is on, so routine windows open on the minute. Android only. */
    exactAlarm?: boolean;
    /** Health Connect is missing or too old and Play can install it. Android only. */
    installable?: boolean;
    /**
     * Health is read through Health Connect, which only has what the user linked to it
     * (Samsung Health, Fit, a watch). Android only.
     */
    healthConnect?: boolean;
    /**
     * Blocking is not available yet, but the user can grant what is missing from inside
     * the app (Android usage access or display over other apps). Android only.
     */
    grantable?: boolean;
    /**
     * The rules of Mis reglas this platform really applies during a session. A rule not
     * listed is kept as a preference and the screen says it does not reach the system.
     */
    appliedRules?: readonly ('strictMode' | 'blockInstalls' | 'blockPurchases' | 'blockMature')[];
    /**
     * The user refused the permission in the system's own dialog (iOS Screen Time).
     * Unlike a missing module or entitlement it is their answer, and only Settings can
     * change it. iOS only.
     */
    denied?: boolean;
  };
};
