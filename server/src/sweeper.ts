import { mediaIdOfKey, mediaObjectKey, reportIdOfKey, reportPrefix } from './media.ts';
import type { ObjectStore } from './objectStore.ts';
import type { Media, Store } from './store.ts';

/**
 * What keeps the bucket honest (ADR-0051 §17). A Railway Bucket has no lifecycle rules,
 * so the server deletes by itself, in the same process:
 *
 * - **every hour**, `sweep`: a photo past its `expiresAt` becomes a tombstone and its
 *   objects go; an upload that never finished (pending for a day) goes whole; tombstones
 *   older than 60 days are forgotten; a preserved report whose year ran out goes, evidence
 *   and all; a resolved report is forgotten 60 days after;
 * - **every week**, `reconcile`: every object in the bucket without a row that still wants
 *   it — a photo's with no live photo, a report's with no open or preserved report — goes.
 *   That is the net under every deletion that failed halfway.
 *
 * The clock is injected, like the API's, so the tests move it.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A tombstone lives this long: longer than any phone is expected to go without a sync. */
export const TOMBSTONE_KEPT_MS = 60 * DAY;
/** An upload whose bytes never came is given a day before its row goes. */
export const PENDING_KEPT_MS = DAY;
/** A resolved report, unpreserved, is forgotten after this. */
export const RESOLVED_REPORT_KEPT_MS = 60 * DAY;
export const SWEEP_EVERY_MS = HOUR;
export const RECONCILE_EVERY_MS = 7 * DAY;

export type SweepDeps = {
  store: Store;
  objects: ObjectStore;
  now: () => number;
  log?: (line: string) => void;
};

export type SweepReport = {
  expired: number;
  abandoned: number;
  tombstonesPurged: number;
  preservedReleased: number;
  reportsForgotten: number;
};

export type ReconcileReport = { orphans: number };

function objectKeys(rows: readonly Media[]): string[] {
  return rows.flatMap((row) => [mediaObjectKey(row, 'thumb'), mediaObjectKey(row, 'full')]);
}

export function createSweeper(deps: SweepDeps) {
  const { store, objects, now } = deps;
  const log = deps.log ?? ((line: string) => console.log(line));
  /** The first reconciliation runs at the first tick, an hour after boot. */
  let lastReconcile: number | null = null;

  const sweep = async (): Promise<SweepReport> => {
    const at = now();

    const expired = await store.expiredMedia(at);
    const tombstoned = await store.tombstoneMedia(
      expired.map((row) => row.id),
      at,
    );
    await objects.delete(objectKeys(tombstoned));

    // Never ready, so no phone but the owner's ever had it: the row goes without a
    // tombstone, and a retry of the upload finds 404 and starts over.
    const abandoned = await store.stalePendingMedia(at - PENDING_KEPT_MS);
    await objects.delete(objectKeys(abandoned));
    await store.deleteMediaRows(abandoned.map((row) => row.id));

    const tombstonesPurged = await store.purgeMediaTombstones(at - TOMBSTONE_KEPT_MS);

    const preserved = await store.expiredPreservedReports(at);
    for (const report of preserved) {
      await objects.deletePrefix(reportPrefix(report.id));
    }
    await store.deleteReports(preserved.map((report) => report.id));

    const resolved = await store.staleResolvedReports(at - RESOLVED_REPORT_KEPT_MS);
    for (const report of resolved) {
      // Released when it was resolved; this only makes sure.
      await objects.deletePrefix(reportPrefix(report.id));
    }
    await store.deleteReports(resolved.map((report) => report.id));

    return {
      expired: tombstoned.length,
      abandoned: abandoned.length,
      tombstonesPurged,
      preservedReleased: preserved.length,
      reportsForgotten: resolved.length,
    };
  };

  const reconcile = async (): Promise<ReconcileReport> => {
    const at = now();
    lastReconcile = at;
    const orphans: string[] = [];

    const mediaKeys = await objects.list('m/');
    const mediaIds = [...new Set(mediaKeys.map(mediaIdOfKey).filter((mediaId) => mediaId !== null))];
    const live = await store.liveMediaIds(mediaIds);
    for (const key of mediaKeys) {
      const mediaId = mediaIdOfKey(key);
      if (mediaId === null || !live.has(mediaId)) {
        orphans.push(key);
      }
    }

    const reportKeys = await objects.list('r/');
    const reportIds = [...new Set(reportKeys.map(reportIdOfKey).filter((reportId) => reportId !== null))];
    const held = await store.heldReportIds(reportIds, at);
    for (const key of reportKeys) {
      const reportId = reportIdOfKey(key);
      if (reportId === null || !held.has(reportId)) {
        orphans.push(key);
      }
    }

    await objects.delete(orphans);
    return { orphans: orphans.length };
  };

  /** One hourly tick: the sweep, and the reconciliation when a week has passed. Never throws. */
  const tick = async (): Promise<void> => {
    try {
      const swept = await sweep();
      const total = Object.values(swept).reduce((sum, count) => sum + count, 0);
      if (total > 0) {
        log(
          `photo sweep: ${swept.expired} expired, ${swept.abandoned} abandoned, ${swept.tombstonesPurged} tombstones purged, ${swept.preservedReleased} preserved released, ${swept.reportsForgotten} reports forgotten`,
        );
      }
    } catch (error) {
      log(`photo sweep failed: ${error instanceof Error ? error.message : 'unknown'}`);
    }
    if (lastReconcile === null || now() - lastReconcile >= RECONCILE_EVERY_MS) {
      try {
        const { orphans } = await reconcile();
        log(`photo reconciliation: ${orphans} objects without a row deleted`);
      } catch (error) {
        lastReconcile = now();
        log(`photo reconciliation failed: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }
  };

  return { sweep, reconcile, tick };
}

/** Starts the hourly tick. Returns what stops it. */
export function startSweeper(deps: SweepDeps): () => void {
  const sweeper = createSweeper(deps);
  const timer = setInterval(() => {
    void sweeper.tick();
  }, SWEEP_EVERY_MS);
  timer.unref();
  return () => clearInterval(timer);
}
