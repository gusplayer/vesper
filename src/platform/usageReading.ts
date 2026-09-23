import type { PackageUsage } from '../../modules/vesper-blocking';
import type { AppUsage, UsageReading } from '../data/types';
import type { BlockableMode } from '../domain/blocking';
import { packageNamesFromToken } from '../domain/packageSelection';
import { MINUTE } from '../domain/time';

/**
 * What the usage sync measures, and how two native reads, today's and the week's,
 * fold into what the store keeps (ADR-0029). Pure, so it is tested here: the native
 * call is platform/usage.ts and the hook that drives it is hooks/useUsageSync.ts,
 * neither of which a test can import (they pull in React Native).
 *
 * The totals are sums of every row the phone answered with, and the breakdown is the
 * most used MAX_USAGE_ROWS of those same rows, so the breakdown can never exceed the
 * "redes" line. The week is read from Monday and includes today, so it is at least
 * today's total; the guard only matters if the phone's event history is shorter than
 * the week.
 */

/**
 * How many apps the breakdown shows. A ledger, not a ranking (ADR-0029). The cut is
 * made here, once, so a screen never has to know the number.
 */
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
    .slice(0, MAX_USAGE_ROWS)
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

/** How long a reading stands before the phone is read again for the same apps. */
export const SYNC_INTERVAL_MS = 5 * MINUTE;

/**
 * The packages of every mode that blocks, deduplicated and sorted so the same set has
 * one key. Allow modes are left out on purpose: their token is what stays *alive*
 * during a session (domain/blocking.ts passes the same token with `kind: 'allow'`), so
 * counting it would file Maps, Phone and Notes as the phone's pull, feed them into the
 * life projection and share them to the circle. What pulls in an allow mode is
 * everything *not* selected, which cannot be enumerated, so it is not measured at all
 * (ADR-0035 §1, rule 9).
 */
export function measuredPackages(modes: readonly BlockableMode[]): string[] {
  const names = new Set<string>();
  for (const mode of modes) {
    if (mode.behavior !== 'block') {
      continue;
    }
    for (const name of packageNamesFromToken(mode.selectionToken)) {
      names.add(name);
    }
  }
  return [...names].sort();
}

/** What the last finished read was of, and when. Only a real read writes it. */
export type SyncMemory = { lastKey: string; lastSyncAt: number };

/**
 * Whether the phone was already read for this exact set of packages moments ago. Only
 * a finished read counts: a status that said "not available", and a read that failed,
 * read nothing, so neither starts the cooldown and the next foreground can notice that
 * usage access was granted in Settings.
 */
export function isFresh(memory: SyncMemory, key: string, now: number): boolean {
  return memory.lastKey !== '' && key === memory.lastKey && now - memory.lastSyncAt < SYNC_INTERVAL_MS;
}
