import { beforeEach, describe, expect, it, vi } from 'vitest';

import { anActivity } from '../../domain/fixtures';
import { DEFAULT_DEPTH, DEFAULT_PLANNED_MS } from '../../domain/session';
import { MINUTE } from '../../domain/time';
import * as activities from './activities';
import * as sessionConfig from './sessionConfig';
import * as settings from './settings';

vi.mock('./settings', () => ({
  SETTING_KEYS: { lastSessionConfig: 'last_session_config' },
  getJson: vi.fn(() => null),
  setJson: vi.fn(),
}));

vi.mock('./activities', () => ({
  listActive: vi.fn(() => []),
}));

const T0 = 1_700_000_000_000;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('loadOrDefault', () => {
  it('is the default when nothing is stored', () => {
    vi.mocked(activities.listActive).mockReturnValue([anActivity()]);

    expect(sessionConfig.loadOrDefault()).toEqual({
      activityId: 'activity-work',
      plannedMs: DEFAULT_PLANNED_MS,
      depth: DEFAULT_DEPTH,
      blockProfile: null,
    });
    expect(settings.getJson).toHaveBeenCalledWith('last_session_config');
  });

  it('is the stored config when it is still valid', () => {
    vi.mocked(activities.listActive).mockReturnValue([anActivity(), anActivity({ id: 'a2' })]);
    vi.mocked(settings.getJson).mockReturnValue({
      activityId: 'a2',
      plannedMs: 50 * MINUTE,
      depth: 'firm',
      blockProfile: null,
    });

    expect(sessionConfig.loadOrDefault()).toEqual({
      activityId: 'a2',
      plannedMs: 50 * MINUTE,
      depth: 'firm',
      blockProfile: null,
    });
  });

  it('falls back to the default when the stored activity is gone', () => {
    vi.mocked(activities.listActive).mockReturnValue([anActivity()]);
    vi.mocked(settings.getJson).mockReturnValue({
      activityId: 'archived',
      plannedMs: 50 * MINUTE,
      depth: 'firm',
    });

    expect(sessionConfig.loadOrDefault()?.activityId).toBe('activity-work');
  });

  it('is null when there is no activity at all', () => {
    expect(sessionConfig.loadOrDefault()).toBeNull();
  });
});

describe('save', () => {
  it('stores the config under the last session config key', () => {
    const config = {
      activityId: 'activity-work',
      plannedMs: DEFAULT_PLANNED_MS,
      depth: DEFAULT_DEPTH,
      blockProfile: null,
    };

    sessionConfig.save(config, T0);

    expect(settings.setJson).toHaveBeenCalledWith('last_session_config', config, T0);
  });
});
