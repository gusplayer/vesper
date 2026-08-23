import type { SessionConfig } from '../../domain/session';
import type { Depth } from '../../domain/types';
import { listActive } from './activities';
import * as settings from './settings';

/**
 * The last session config, which is the default for the next one. The app never asks
 * the same question twice — ADR-0007.
 */

export const DEFAULT_PLANNED_MS = 25 * 60_000;

type StoredConfig = {
  activityId: string;
  plannedMs: number;
  depth: Depth;
  intention: string | null;
  blockProfile: string | null;
};

function isDepth(value: unknown): value is Depth {
  return value === 'soft' || value === 'firm' || value === 'deep';
}

/**
 * Reads the stored config, validating it against reality: an activity can have been
 * archived since, and a stored id pointing nowhere would break the home screen.
 */
export function load(): SessionConfig | null {
  const stored = settings.getJson<StoredConfig>(settings.SETTING_KEYS.lastSessionConfig);
  if (stored === null || typeof stored.plannedMs !== 'number' || !isDepth(stored.depth)) {
    return null;
  }

  const activity = listActive().find((candidate) => candidate.id === stored.activityId);
  if (activity === undefined) {
    return null;
  }

  return {
    activityId: activity.id,
    plannedMs: stored.plannedMs,
    depth: stored.depth,
    intention: null,
    blockProfile: null,
  };
}

/** Falls back to 25 minutes of the first activity, soft depth. */
export function loadOrDefault(): SessionConfig | null {
  const stored = load();
  if (stored !== null) {
    return stored;
  }

  const first = listActive()[0];
  if (first === undefined) {
    return null;
  }

  return {
    activityId: first.id,
    plannedMs: DEFAULT_PLANNED_MS,
    depth: 'soft',
    intention: null,
    blockProfile: null,
  };
}

export function save(config: SessionConfig, now: number): void {
  const stored: StoredConfig = {
    activityId: config.activityId,
    plannedMs: config.plannedMs,
    depth: config.depth,
    intention: null,
    blockProfile: null,
  };
  settings.setJson(settings.SETTING_KEYS.lastSessionConfig, stored, now);
}
