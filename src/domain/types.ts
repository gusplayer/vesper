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

/** In order of how hard it is to leave. The union is derived so a guard can iterate it. */
export const DEPTHS = ['soft', 'firm', 'deep'] as const;
export type Depth = (typeof DEPTHS)[number];

/**
 * 'completed' is the timer running out, whether or not the app was awake to see it.
 * 'expired' is an open session reaching its 12 h cap: more likely forgotten than
 * finished (ADR-0022). 'cancelled' is the user giving up.
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
  /** For an open session this is the cap (OPEN_SESSION_CAP_MS), not a choice. */
  plannedMs: number;
  /** Never exceeds plannedMs. Invariant 2 in docs/DATA_MODEL.md. */
  actualMs: number;
  outcome: SessionOutcome;
  depth: Depth;
  /** "Sin límite": ends when the user says, or at the cap (ADR-0022). */
  open: boolean;
  /** Time spent in finished breaks. Never focus, never counted. */
  breakMs: number;
  /** The break running right now, if any. The clock is frozen while it is set. */
  breakStartedAt: Millis | null;
  /** Focus time (elapsed) at which the next break unlocks. */
  nextBreakAtMs: number;
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

// --- Circle (ADR-0021) -------------------------------------------------------------

/** The id that stands for the user in circle tables: kudos, challenge participants. */
export const ME = 'me';

/** Product decision: a circle is the people you would text, not an audience. */
export const MAX_CIRCLE = 12;

/** Times per week a challenge can ask for. */
export const CHALLENGE_TARGET_OPTIONS = [2, 3, 4, 5, 6] as const;

/**
 * How long a challenge runs, in days: one, two and four weeks, the 21 days that make
 * a habit, or no end at all (ADR-0027). 21 is the default.
 */
export const CHALLENGE_DURATION_OPTIONS = [7, 14, 21, 28, null] as const;
export const DEFAULT_CHALLENGE_DAYS = 21;

/** The user's own identity inside a circle. Lives on this phone; no server yet. */
export type Profile = {
  id: string;
  name: string;
  /** Short, written by the user, unique inside a circle: 'ana', 'gus'. Lowercase. */
  handle: string;
  /** Bumped by "Generar código nuevo": the invite code derives from id and this. */
  codeGeneration: number;
  createdAt: Millis;
};

/**
 * 'member' is in the circle. 'invited' is someone the user invited who has not
 * answered. 'pending' is someone who invited the user and waits for an answer.
 */
export type MemberStatus = 'member' | 'invited' | 'pending';

export type Member = {
  id: string;
  name: string;
  handle: string;
  status: MemberStatus;
  /** Null until the invitation is accepted, on either side. */
  joinedAt: Millis | null;
  createdAt: Millis;
};

/** What the user shares with the circle. Off means the number never leaves the phone. */
export type SharePrefs = {
  focus: boolean;
  habits: boolean;
  social: boolean;
};

/**
 * One member's week as the circle sees it: what a server would deliver. The UI derives
 * everything from these rows and from the user's own stores; there is no other path.
 */
export type MemberWeek = {
  memberId: string;
  /** The DayKey of that week's Monday. */
  weekKey: DayKey;
  focusMs: number;
  /** Estimated floor, null when the member does not share it. Never summed — ADR-0005. */
  socialMs: number | null;
  habitsDone: number;
  habitsTarget: number;
  updatedAt: Millis;
};

/** One person pushing another on a challenge they share, once a day at most (ADR-0027). */
export type Nudge = {
  id: string;
  fromId: string;
  toId: string;
  challengeId: string;
  dayKey: DayKey;
  createdAt: Millis;
};

/** A day the daily streak was bridged automatically; three a month (ADR-0027). */
export type GraceDay = {
  dayKey: DayKey;
  /** 'YYYY-MM' of `dayKey`. */
  monthKey: string;
  createdAt: Millis;
};

/** One person cheering another, once a day at most. Either side can be ME. */
export type Kudos = {
  id: string;
  fromId: string;
  toId: string;
  dayKey: DayKey;
  createdAt: Millis;
};

/**
 * A habit with witnesses. The user's own marks are the marks of `habitId`; the other
 * participants' marks arrive as ChallengeMark rows.
 */
export type Challenge = {
  id: string;
  name: string;
  weeklyTarget: number;
  /** The Monday DayKey of the first week. */
  startWeekKey: DayKey;
  /** The last day, inclusive, or null for a challenge with no end (ADR-0027). */
  endDayKey: DayKey | null;
  /** ME or a member id. */
  createdBy: string;
  /** ME and/or member ids. */
  participantIds: string[];
  /** The user's habit that counts, or null while the user has not joined. */
  habitId: string | null;
  createdAt: Millis;
  archivedAt: Millis | null;
};

export type ChallengeMark = {
  id: string;
  challengeId: string;
  /** Never ME: the user's marks are habit marks. */
  memberId: string;
  dayKey: DayKey;
  markedAt: Millis;
};
