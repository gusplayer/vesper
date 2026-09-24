import { requireNativeModule } from 'expo-modules-core';

/**
 * The typed surface of the Kotlin module in ./android: Health Connect, read-only
 * (ADR-0043). Android only: on any other platform `requireVesperHealth()` throws,
 * which src/platform/health.android.ts turns into "no disponible". Nothing here is
 * imported at module load time on purpose.
 */

/**
 * 'available': Health Connect answers. 'updateRequired': it is missing or too old and
 * Play can fix it (Android 9 to 13). 'unsupported': Android 8 or older, or a phone
 * without it.
 */
export type NativeSdkStatus = 'available' | 'updateRequired' | 'unsupported';

/** Steps of one local day. `start` is that day's local midnight, epoch ms. */
export type NativeStepDay = { start: number; count: number };

export type NativeWorkout = { start: number; end: number };

/** Health Connect's stage ints: 1 awake, 2 sleeping, 3 out of bed, 4 light, 5 deep, 6 REM, 7 awake in bed. */
export type NativeSleepStage = { start: number; end: number; stage: number };

export type NativeSleepSession = { start: number; end: number; stages: NativeSleepStage[] };

export type NativeHealthWeek = {
  steps: NativeStepDay[];
  workouts: NativeWorkout[];
  sleep: NativeSleepSession[];
};

export type VesperHealthNative = {
  sdkStatus(): NativeSdkStatus;
  /**
   * Opens Health Connect's sheet for steps, workouts and sleep, unless all three are
   * already granted. Resolves with the permissions granted afterwards; empty when the
   * user said no or Health Connect is not available.
   */
  requestPermissions(): Promise<string[]>;
  /** Epoch ms. Sleep is read from `sleepFromMs` so the night into the first day is kept. */
  readWeek(fromMs: number, sleepFromMs: number, toMs: number): Promise<NativeHealthWeek>;
  /** Play Store on Health Connect's page. False when nothing could open it. */
  openInstallPage(): boolean;
  /** Health Connect's own screen, where the user links Samsung Health, Fit or a watch. */
  openHealthConnect(): boolean;
};

/** Loads the native module. Throws where it is not linked (iOS, a stale build). */
export function requireVesperHealth(): VesperHealthNative {
  return requireNativeModule<VesperHealthNative>('VesperHealth');
}
