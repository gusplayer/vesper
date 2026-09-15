import { requireNativeModule } from 'expo-modules-core';

/**
 * The typed surface of the Kotlin module in ./android. Android only: on any other
 * platform `requireVesperBlocking()` throws, which src/platform/blocking.android.ts
 * turns into "no disponible". Nothing here is imported at module load time on purpose.
 */

export type NativeStatus = {
  /** PACKAGE_USAGE_STATS granted in Settings ("Acceso de uso"). */
  usageAccess: boolean;
  /** SYSTEM_ALERT_WINDOW granted in Settings ("Mostrar sobre otras apps"). */
  overlay: boolean;
  /** The foreground service is alive. */
  running: boolean;
};

export type LaunchableApp = {
  packageName: string;
  label: string;
  /** A 96px PNG, base64 without data: prefix. Null when icons were not requested. */
  iconBase64: string | null;
};

export type NativePlan = {
  packageNames: string[];
  /** 'block' shields the packages; 'allow' shields every other app. */
  mode: 'block' | 'allow';
  /** Epoch ms; the service stops itself then. Omitted: until release(). */
  endsAt?: number;
  shieldTitle: string;
  shieldSubtitle: string;
  shieldButton: string;
};

export type VesperBlockingNative = {
  getStatus(): NativeStatus;
  isShielding(): boolean;
  openUsageAccessSettings(): Promise<void>;
  openOverlaySettings(): Promise<void>;
  listLaunchableApps(withIcons: boolean): Promise<LaunchableApp[]>;
  applyPlan(plan: NativePlan): Promise<void>;
  release(): Promise<void>;
};

/** Loads the native module. Throws where it is not linked (iOS, a stale build). */
export function requireVesperBlocking(): VesperBlockingNative {
  return requireNativeModule<VesperBlockingNative>('VesperBlocking');
}
