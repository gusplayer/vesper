import type { PackageUsage } from '../../modules/vesper-blocking';
import type { AppUsage, UsageReading } from '../data/types';

/**
 * Folds two native reads, today's and the week's, into what the store keeps
 * (ADR-0029). Pure, so it is tested; the native call is platform/usage.ts.
 *
 * The totals are sums of the same rows the breakdown shows, so the breakdown can
 * never exceed the "redes" line. The week is read from Monday and includes today,
 * so it is at least today's total; the guard only matters if the phone's event
 * history is shorter than the week.
 */

/** How many apps the breakdown shows. A ledger, not a ranking (ADR-0029). */
export const MAX_USAGE_ROWS = 5;

function sum(rows: readonly PackageUsage[]): number {
  return rows.reduce((total, row) => total + Math.max(0, row.ms), 0);
}

/** The first letter of the label, uppercased; a package name's first letter as a fallback. */
export function initialOf(label: string, fallback: string): string {
  const source = label.trim() === '' ? fallback : label.trim();
  const first = Array.from(source)[0] ?? '';
  return first.toLocaleUpperCase();
}

export function foldUsage(today: readonly PackageUsage[], week: readonly PackageUsage[]): UsageReading {
  const todayMs = sum(today);
  const byApp: AppUsage[] = [...today]
    .filter((row) => row.ms > 0)
    .sort((a, b) => b.ms - a.ms)
    .map((row) => ({
      id: row.packageName,
      name: row.label,
      icon: row.iconBase64,
      initial: initialOf(row.label, row.packageName),
      color: null,
      ms: row.ms,
    }));
  return { todayMs, weekMs: Math.max(sum(week), todayMs), byApp };
}
