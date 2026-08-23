import { getDb } from '../client';

/**
 * The settings table is a key-value store, not a settings screen. Every value here is
 * written from the flow that uses it — ADR-0007.
 *
 * Known keys are listed in docs/DATA_MODEL.md.
 */

export const SETTING_KEYS = {
  lastSessionConfig: 'last_session_config',
  birthDate: 'birth_date',
  lifeExpectancyYears: 'life_expectancy_years',
  lifeScreenEnabled: 'life_screen_enabled',
  weeklyFocusTargetMs: 'weekly_focus_target_ms',
  onboardingCompletedAt: 'onboarding_completed_at',
} as const;

export const DEFAULT_LIFE_EXPECTANCY_YEARS = 77.6;

export function get(key: string): string | null {
  const result = getDb().executeSync('SELECT value FROM settings WHERE key = ?', [key]);
  const value = result.rows[0]?.value;
  return typeof value === 'string' ? value : null;
}

export function set(key: string, value: string, now: number): void {
  getDb().executeSync(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now],
  );
}

export function getNumber(key: string): number | null {
  const raw = get(key);
  if (raw === null) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setNumber(key: string, value: number, now: number): void {
  set(key, String(value), now);
}

export function getBoolean(key: string): boolean {
  return get(key) === 'true';
}

export function setBoolean(key: string, value: boolean, now: number): void {
  set(key, value ? 'true' : 'false', now);
}

/**
 * Reads a JSON value, returning null on anything unparseable rather than throwing.
 * A corrupt stored config should fall back to defaults, not break the home screen.
 */
export function getJson<T>(key: string): T | null {
  const raw = get(key);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setJson(key: string, value: unknown, now: number): void {
  set(key, JSON.stringify(value), now);
}
