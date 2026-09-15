import { resolveSessionConfig, type SessionConfig } from '../../domain/session';
import { listActive } from './activities';
import * as settings from './settings';

/**
 * The last session config, which is the default for the next one. The app never asks
 * the same question twice — ADR-0007.
 *
 * Validation lives in domain/session.ts: this file only knows where the JSON sits.
 */

/** The stored config, or the default. Null only when there is no activity at all. */
export function loadOrDefault(): SessionConfig | null {
  return resolveSessionConfig(
    settings.getJson<unknown>(settings.SETTING_KEYS.lastSessionConfig),
    listActive(),
  );
}

export function save(config: SessionConfig, now: number): void {
  settings.setJson(settings.SETTING_KEYS.lastSessionConfig, config, now);
}
