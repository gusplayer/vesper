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

/**
 * The words the notification and the shield's third line use, in the app's language
 * (ADR-0023). Every field is optional: a missing one keeps the Kotlin default, which
 * only exists for plans written by older builds.
 */
export type NativeCopy = {
  /** Settings › Notifications shows these for the channel. */
  channelName?: string;
  channelDescription?: string;
  /** Under the title while the session runs ('Sesión de foco'). */
  sessionText?: string;
  /** The same line during a break ('Pausa'). */
  breakText?: string;
  /** The shield's third line when the plan has an end; Kotlin fills `{time}`. */
  shieldReleasesAt?: string;
};

export type NativePlan = NativeCopy & {
  packageNames: string[];
  /** 'block' shields the packages; 'allow' shields every other app. */
  mode: 'block' | 'allow';
  /** Epoch ms; the service stops itself then and the notification counts down to it. Omitted: until release(), counting up. */
  endsAt?: number;
  /** Epoch ms the count-up starts from when there is no end, or when `open`. Omitted: when the plan is applied. */
  startedAt?: number;
  /** An open session: `endsAt` is only its cap, so the notification counts up from `startedAt`. */
  open?: boolean;
  shieldTitle: string;
  shieldSubtitle: string;
  shieldButton: string;
};

/** A routine window with its token already opened into package names. See RoutineWindowSpec. */
export type NativeWindow = NativeCopy & {
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
  /**
   * A break: the shield comes down and nothing is watched until `untilMs` (epoch ms),
   * but the service and its notification stay, counting the break down. Watching
   * resumes then with no JS involved. Rejects with E_NO_PLAN when nothing is applied.
   */
  pausePlan(untilMs: number): Promise<void>;
  /**
   * Ends the break now. `endsAt` is the plan's new end (epoch ms); null keeps the
   * old one pushed back by what the break took. Rejects with E_NO_PLAN when nothing
   * is applied.
   */
  resumePlan(endsAt: number | null): Promise<void>;
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
