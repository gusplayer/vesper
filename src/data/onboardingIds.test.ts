import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeDb } from '../db/testing/fakeDb';
import { forgetOnboardingIds, parseOnboardingIds, saveOnboardingIds, savedOnboardingIds } from './onboardingIds';

let fake = createFakeDb();

vi.mock('../db/client', () => ({
  getDb: () => fake,
}));

const T0 = 1_700_000_000_000;

beforeEach(() => {
  fake = createFakeDb();
});

describe('parseOnboardingIds', () => {
  it('keeps two ids, and only ids', () => {
    expect(parseOnboardingIds({ modeId: 'm', scheduleId: 's' })).toEqual({ modeId: 'm', scheduleId: 's' });
    expect(parseOnboardingIds({ modeId: 'm', scheduleId: null })).toEqual({ modeId: 'm', scheduleId: null });
    expect(parseOnboardingIds({ modeId: 7, scheduleId: '' })).toEqual({ modeId: null, scheduleId: null });
  });

  it('reads anything else as nothing saved', () => {
    for (const raw of [null, undefined, 'm', 3, []]) {
      expect(parseOnboardingIds(raw)).toEqual({ modeId: null, scheduleId: null });
    }
  });
});

describe('the settings row', () => {
  it('is written as JSON under its own key', () => {
    saveOnboardingIds({ modeId: 'm', scheduleId: 's' }, T0);

    const call = fake.callMatching('INSERT INTO settings');
    expect(call.params).toEqual(['onboarding_ids', JSON.stringify({ modeId: 'm', scheduleId: 's' }), T0]);
  });

  it('reads back what an earlier run saved, and nothing once forgotten', () => {
    fake.whenSql('SELECT value', [{ value: JSON.stringify({ modeId: 'm', scheduleId: null }) }]);
    expect(savedOnboardingIds()).toEqual({ modeId: 'm', scheduleId: null });

    forgetOnboardingIds(T0);
    expect(fake.callMatching('INSERT INTO settings').params).toEqual(['onboarding_ids', 'null', T0]);
  });
});
