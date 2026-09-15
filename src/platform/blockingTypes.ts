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
