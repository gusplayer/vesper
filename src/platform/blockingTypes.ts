import type { BlockPlan } from '../domain/blocking';

/**
 * A break inside a session (ADR-0022) as both backends see it (ADR-0023, decision
 * 5). `pausePlan` lifts the shield until `untilMs`, epoch ms; `resumePlan` puts it
 * back with the plan's new end. Android keeps its service alive between the two and
 * resumes by itself at `untilMs` even if the app has died; iOS has no service, so
 * pausing is release() and resuming is applyPlan(). The shared hook calls these and
 * never learns which platform answered.
 */
export type PausePlan = (untilMs: number) => void;
export type ResumePlan = (plan: BlockPlan, timing?: PlanTiming) => void;

/**
 * When the session runs, for a backend that can time itself (Android). `endsAt` is
 * the planned end, or the cap of an open session: the service stops there whatever
 * happens to the app. `open` says the session has no planned end, so the notification
 * counts up from `startedAt` instead of down to the cap (ADR-0022, ADR-0023).
 */
export type PlanTiming = { startedAt: number; endsAt: number; open: boolean };

/**
 * The contract both blocking backends (iOS Screen Time, Android vesper-blocking)
 * implement for routine windows. A window is registered with the system so the
 * shield rises and falls even when the app is closed.
 */
export type RoutineWindowSpec = {
  /** The routine id; cancelling uses it. */
  id: string;
  /** Minutes from local midnight. */
  startMinute: number;
  /** Minutes from local midnight; null means start + capMinutes. */
  endMinute: number | null;
  /** Fallback length for an open-ended window, in minutes. */
  capMinutes: number;
  /** Monday first. */
  days: boolean[];
  /** The mode's selection token (iOS: FamilyActivitySelection; Android: JSON package list). */
  token: string;
  kind: 'block' | 'allow';
  shieldTitle: string;
  shieldSubtitle: string;
  shieldButton: string;
};
