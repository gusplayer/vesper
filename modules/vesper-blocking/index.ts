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
  /** SCHEDULE_EXACT_ALARM: routine windows fire on the minute. Always true before Android 12. */
  exactAlarm: boolean;
  /** Notifications are enabled for the app, so the session notification is seen. */
  notifications: boolean;
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

/** A routine window with its token already opened into package names. See RoutineWindowSpec. */
export type NativeWindow = {
  id: string;
  /** Minutes from local midnight. */
  startMinute: number;
  /** Minutes from local midnight; null means start + capMinutes. At or before start crosses midnight. */
  endMinute: number | null;
  capMinutes: number;
  /** Monday first, seven entries. */
  days: boolean[];
  packageNames: string[];
  mode: 'block' | 'allow';
  shieldTitle: string;
  shieldSubtitle: string;
  shieldButton: string;
};

export type ServiceStateEvent = { running: boolean };

export type VesperBlockingNative = {
  getStatus(): NativeStatus;
  isShielding(): boolean;
  /** The foreground service is alive right now. */
  serviceAlive(): boolean;
  canScheduleExactAlarms(): boolean;
  /** Ids of the windows registered with AlarmManager. */
  listWindows(): string[];
  openUsageAccessSettings(): Promise<void>;
  openOverlaySettings(): Promise<void>;
  /** The SCHEDULE_EXACT_ALARM page for this app (Android 12+; no-op before). */
  openExactAlarmSettings(): Promise<void>;
  /** The battery-optimisation list, for OEMs that kill services. */
  openBatterySettings(): Promise<void>;
  /** POST_NOTIFICATIONS on Android 13+; resolves with the outcome. Before 13, whether notifications are on. */
  requestNotificationPermission(): Promise<boolean>;
  listLaunchableApps(withIcons: boolean): Promise<LaunchableApp[]>;
  applyPlan(plan: NativePlan): Promise<void>;
  release(): Promise<void>;
  /** Registers (or replaces) a window and arms its next start and end. */
  scheduleWindow(window: NativeWindow): Promise<void>;
  cancelWindow(id: string): Promise<void>;
  /** Fires when the foreground service starts or stops, on the main thread. */
  addListener(event: 'onServiceStateChanged', listener: (event: ServiceStateEvent) => void): { remove(): void };
};

/** Loads the native module. Throws where it is not linked (iOS, a stale build). */
export function requireVesperBlocking(): VesperBlockingNative {
  return requireNativeModule<VesperBlockingNative>('VesperBlocking');
}
