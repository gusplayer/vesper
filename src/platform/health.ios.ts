import { dayKeyOf, weekStart } from '../domain/day';
import {
  EMPTY_HEALTH_WEEK,
  type HealthSleepSession,
  type HealthWeek,
  type HealthWorkout,
} from '../domain/healthMarks';
import { DAY } from '../domain/time';
import type { DayKey, Millis } from '../domain/types';
import { getStrings } from '../i18n';
import { isIos, type CapabilityStatus } from './capabilities';

/**
 * Health on iOS: HealthKit through react-native-health, read-only. Android reads
 * Health Connect behind the same surface in health.android.ts (ADR-0043); the screens
 * import `platform/health` and never learn which file answered. The module is iOS-only
 * and may not be linked at all (Android, a build without the pod), so it is required
 * lazily inside a try/catch and never imported at the top. Everything here returns
 * something usable when Health is missing: `status()` says why, `readWeek` gives an
 * empty week, `requestAuthorization` resolves false. Nothing throws.
 *
 * The raw samples are mapped to epoch ms here; deciding what counts as a habit mark
 * is domain/healthMarks.ts.
 */

type Callback<T> = (error: unknown, result: T) => void;

type QueryOptions = {
  startDate: string;
  endDate: string;
  type?: 'Workout';
};

type WorkoutSample = {
  start: string;
  end: string;
  activityName: string;
  calories: number;
};

type StepSample = {
  startDate: string;
  endDate: string;
  value: number;
};

type SleepSample = {
  startDate: string;
  endDate: string;
  /** 'INBED', 'ASLEEP', 'AWAKE', 'CORE', 'DEEP', 'REM'. */
  value: string;
};

/** The slice of react-native-health this app touches. Typed by hand so a wrong shape fails here. */
type HealthKitModule = {
  Constants: { Permissions: Record<string, string> };
  isAvailable(callback: Callback<boolean>): void;
  initHealthKit(
    options: { permissions: { read: string[]; write: string[] } },
    callback: (error: unknown) => void,
  ): void;
  getAnchoredWorkouts(options: QueryOptions, callback: Callback<{ data: WorkoutSample[]; anchor: string }>): void;
  getDailyStepCountSamples(options: QueryOptions, callback: Callback<StepSample[]>): void;
  getSleepSamples(options: QueryOptions, callback: Callback<SleepSample[]>): void;
};

const READ_PERMISSIONS = ['Workout', 'StepCount', 'SleepAnalysis'] as const;

/** Sleep stages that count as sleeping. 'INBED' and 'AWAKE' do not. */
const ASLEEP_VALUES = new Set(['ASLEEP', 'CORE', 'DEEP', 'REM']);

/** undefined: not tried yet. null: tried and missing. */
let kitModule: HealthKitModule | null | undefined;

/** null until isAvailable answers; true or false afterwards. */
let deviceHasHealth: boolean | null = null;
let probe: Promise<boolean> | null = null;

function loadModule(): HealthKitModule | null {
  if (kitModule !== undefined) {
    return kitModule;
  }
  if (!isIos) {
    kitModule = null;
    return kitModule;
  }
  try {
    // Lazy on purpose: a top-level import would throw at load time where the pod is
    // missing, and that takes the whole app down instead of one screen.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: the module may be absent
    const loaded = require('react-native-health') as { default?: HealthKitModule } | HealthKitModule;
    const candidate = 'default' in loaded && loaded.default !== undefined ? loaded.default : loaded;
    kitModule = typeof (candidate as HealthKitModule).isAvailable === 'function' ? (candidate as HealthKitModule) : null;
  } catch {
    kitModule = null;
  }
  return kitModule;
}

/**
 * Asks HealthKit once whether this device has it (an iPad does not). Cached; the
 * first `status()` kicks it off so the answer is there by the time a screen asks.
 */
export function checkAvailability(): Promise<boolean> {
  if (probe !== null) {
    return probe;
  }
  const kit = loadModule();
  if (kit === null) {
    deviceHasHealth = false;
    probe = Promise.resolve(false);
    return probe;
  }
  probe = new Promise<boolean>((resolve) => {
    try {
      kit.isAvailable((error, available) => {
        deviceHasHealth = error == null && available === true;
        resolve(deviceHasHealth);
      });
    } catch {
      deviceHasHealth = false;
      resolve(false);
    }
  });
  return probe;
}

/**
 * Synchronous, like every capability status. Optimistic while the availability probe
 * is in flight: the module is linked and this is an iPhone, so it almost surely works.
 * The probe corrects it to false on the rare device that has no HealthKit. The reason
 * is read from the dictionary at call time, so it follows the language (ADR-0020).
 */
export function status(): CapabilityStatus {
  const reasons = getStrings().habits.healthStatus;
  if (!isIos) {
    return { available: false, reason: reasons.unsupported };
  }
  if (loadModule() === null) {
    return { available: false, reason: reasons.notLinked };
  }
  if (deviceHasHealth === null) {
    void checkAvailability();
  }
  if (deviceHasHealth === false) {
    return { available: false, reason: reasons.notAvailable };
  }
  return { available: true, reason: null };
}

/**
 * Shows the system sheet for the three read types. Resolves true when HealthKit
 * accepted the request. iOS never says whether the user allowed reading, so true
 * means "asked", and an empty week afterwards is what a refusal looks like.
 */
export async function requestAuthorization(): Promise<boolean> {
  const kit = loadModule();
  if (kit === null || !(await checkAvailability())) {
    return false;
  }
  const read = READ_PERMISSIONS.map((name) => kit.Constants.Permissions[name] ?? name);
  return new Promise<boolean>((resolve) => {
    try {
      kit.initHealthKit({ permissions: { read, write: [] } }, (error) => resolve(error == null));
    } catch {
      resolve(false);
    }
  });
}

function query<T>(run: (callback: Callback<T>) => void, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    try {
      run((error, result) => resolve(error == null && result != null ? result : fallback));
    } catch {
      resolve(fallback);
    }
  });
}

function toMillis(iso: string): Millis | null {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function toWorkouts(samples: readonly WorkoutSample[]): HealthWorkout[] {
  const workouts: HealthWorkout[] = [];
  for (const sample of samples) {
    const start = toMillis(sample.start);
    const end = toMillis(sample.end);
    if (start !== null && end !== null && end > start) {
      workouts.push({ start, end });
    }
  }
  return workouts;
}

function toStepsByDay(samples: readonly StepSample[]): Record<DayKey, number> {
  const byDay: Record<DayKey, number> = {};
  for (const sample of samples) {
    const start = toMillis(sample.startDate);
    if (start === null || !Number.isFinite(sample.value)) {
      continue;
    }
    const dayKey = dayKeyOf(start);
    byDay[dayKey] = (byDay[dayKey] ?? 0) + Math.max(0, Math.round(sample.value));
  }
  return byDay;
}

function toSleepSessions(samples: readonly SleepSample[]): HealthSleepSession[] {
  const sessions: HealthSleepSession[] = [];
  for (const sample of samples) {
    const start = toMillis(sample.startDate);
    const end = toMillis(sample.endDate);
    if (start !== null && end !== null && end > start) {
      sessions.push({ start, end, asleep: ASLEEP_VALUES.has(String(sample.value).toUpperCase()) });
    }
  }
  return sessions;
}

/**
 * Workouts, steps and sleep from the start of the week to `now`. Sleep is read from a
 * day earlier so Sunday night, which ends on Monday morning, is not lost; the domain
 * keeps only the nights that end inside the week. A failed query yields its empty
 * part rather than failing the whole read.
 */
export async function readWeek(now: Millis): Promise<HealthWeek> {
  const kit = loadModule();
  if (kit === null || !(await checkAvailability())) {
    return EMPTY_HEALTH_WEEK;
  }
  const from = weekStart(now);
  const startDate = new Date(from).toISOString();
  const endDate = new Date(now).toISOString();
  const sleepStartDate = new Date(from - DAY).toISOString();

  try {
    const [workouts, steps, sleep] = await Promise.all([
      query<{ data: WorkoutSample[]; anchor: string }>(
        (cb) => kit.getAnchoredWorkouts({ startDate, endDate, type: 'Workout' }, cb),
        { data: [], anchor: '' },
      ),
      query<StepSample[]>((cb) => kit.getDailyStepCountSamples({ startDate, endDate }, cb), []),
      query<SleepSample[]>((cb) => kit.getSleepSamples({ startDate: sleepStartDate, endDate }, cb), []),
    ]);
    return {
      workouts: toWorkouts(Array.isArray(workouts.data) ? workouts.data : []),
      stepsByDay: toStepsByDay(Array.isArray(steps) ? steps : []),
      sleepSessions: toSleepSessions(Array.isArray(sleep) ? sleep : []),
    };
  } catch {
    return EMPTY_HEALTH_WEEK;
  }
}

/** Play's page for Health Connect. Android only: HealthKit ships with iOS. */
export function openInstallPage(): boolean {
  return false;
}

/** Health Connect's own screen. Android only: `status().detail.healthConnect` is never set here. */
export function openHealthApp(): boolean {
  return false;
}
