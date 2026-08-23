/**
 * Domain types. Source of truth for the whole app — mirrors docs/DATA_MODEL.md.
 *
 * This module is pure: no React, no database, no imports at all.
 */

/** Epoch milliseconds. Every instant in the app is this. */
export type Millis = number;

/**
 * 'YYYY-MM-DD' in the user's local zone. The only date-as-text in the codebase,
 * justified in docs/DATA_MODEL.md: weekly habit goals are counted in calendar days.
 */
export type DayKey = string;

export type Depth = 'soft' | 'firm' | 'deep';

/**
 * 'expired' is not a surrender: the process died mid-session and nobody closed the row.
 * See docs/ARCHITECTURE.md, "Muerte del proceso".
 */
export type SessionOutcome = 'running' | 'completed' | 'cancelled' | 'expired';

export type CountMode = 'verified' | 'declared';

export type HealthType = 'workout' | 'steps' | 'sleep';

/** Where a ledger row's number came from. Never mixed into one metric — ADR-0005. */
export type Provenance = 'verified' | 'declared' | 'estimated' | 'unknown';

export type MarkSource = 'health' | 'manual' | 'session';

export type Activity = {
  id: string;
  /** Stable slug: 'trabajo', 'lectura', 'gym'. */
  key: string;
  label: string;
  isDefault: boolean;
  archivedAt: Millis | null;
  createdAt: Millis;
};

export type Habit = {
  id: string;
  /** Free text written by the user. See ADR-0008. */
  name: string;
  /** Optional category, auto-linked when the name matches an activity. */
  activityId: string | null;
  weeklyTarget: number;
  countMode: CountMode;
  healthType: HealthType | null;
  archivedAt: Millis | null;
  createdAt: Millis;
};

export type Session = {
  id: string;
  activityId: string;
  plannedMs: number;
  /** Never exceeds plannedMs. Invariant 2 in docs/DATA_MODEL.md. */
  actualMs: number;
  outcome: SessionOutcome;
  depth: Depth;
  /** Always null in phase 1 — ADR-0003. */
  blockProfile: string | null;
  intention: string | null;
  /** Text written when giving up in 'firm' depth. */
  exitReason: string | null;
  interruptions: number;
  startedAt: Millis;
  endedAt: Millis | null;
};

export type HabitMark = {
  id: string;
  habitId: string;
  dayKey: DayKey;
  source: MarkSource;
  /** Health sample or session id. Empty string for a manual mark — invariant 6. */
  sourceRef: string;
  durationMs: number | null;
  markedAt: Millis;
};

export type HealthSample = {
  id: string;
  externalId: string;
  type: HealthType | 'exercise_time';
  value: number;
  unit: string;
  startedAt: Millis;
  endedAt: Millis;
  sourceName: string | null;
};

export type LedgerInput = {
  dayStart: Millis;
  dayEnd: Millis;
  now: Millis;
  /** Needed to label rows. The ledger resolves no ids on its own. */
  activities: Activity[];
  sessions: Session[];
  /** Empty in phase 1. */
  healthSamples: HealthSample[];
  /** 0 in phase 1. */
  usageEstimateMs: number;
};

export type LedgerRow = {
  /** Stable identity for the UI: an activity key, a health type, or 'unknown'. */
  key: string;
  label: string;
  ms: number;
  provenance: Provenance;
};

export type Ledger = {
  rows: LedgerRow[];
  /** Real declared total, before the daily cap. */
  declaredMs: number;
  /** True when declaredMs exceeded the cap, so the UI can say so out loud. */
  declaredCapped: boolean;
};

/** Product decision, not a technical limit. */
export const MAX_HABITS = 5;

/** 6h. Declared time is capped per day so a bogus timer cannot distort the ledger. */
export const DECLARED_DAILY_CAP_MS = 21_600_000;
