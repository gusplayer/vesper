import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as sessions from '../db/repositories/sessions';
import * as settings from '../db/repositories/settings';
import { aRunningSession, T0 } from '../domain/fixtures';
import type { SessionConfig } from '../domain/session';
import { HOUR, MINUTE } from '../domain/time';
import { useSessionStore } from './session';

vi.mock('../db/repositories/sessions', () => ({
  insert: vi.fn(),
  update: vi.fn(),
  findRunning: vi.fn(() => null),
}));

vi.mock('../db/repositories/settings', () => ({
  SETTING_KEYS: { onboardingCompletedAt: 'onboarding_completed_at' },
  getNumber: vi.fn(() => null),
  setNumber: vi.fn(),
}));

vi.mock('../lib/uuid', () => ({
  uuidv7: () => 'session-fixed',
}));

const config: SessionConfig = {
  activityId: 'activity-work',
  plannedMs: 25 * MINUTE,
  depth: 'soft',
  blockProfile: null,
};

const store = () => useSessionStore.getState();

beforeEach(() => {
  vi.resetAllMocks();
  useSessionStore.setState({ session: null });
});

describe('hydrate', () => {
  it('caches the running row from the database', () => {
    const running = aRunningSession();
    vi.mocked(sessions.findRunning).mockReturnValue(running);

    store().hydrate();

    expect(store().session).toBe(running);
  });
});

describe('start', () => {
  it('inserts a new session and caches it', () => {
    const started = store().start(config, T0);

    expect(started).toMatchObject({
      id: 'session-fixed',
      activityId: 'activity-work',
      plannedMs: 25 * MINUTE,
      outcome: 'running',
      startedAt: T0,
    });
    expect(sessions.insert).toHaveBeenCalledWith(started);
    expect(store().session).toBe(started);
  });

  it('returns the cached running session without inserting', () => {
    const running = aRunningSession();
    useSessionStore.setState({ session: running });

    expect(store().start(config, T0 + HOUR)).toBe(running);
    expect(sessions.insert).not.toHaveBeenCalled();
  });

  it('returns a running session found in the database without inserting', () => {
    const running = aRunningSession();
    vi.mocked(sessions.findRunning).mockReturnValue(running);

    expect(store().start(config, T0 + HOUR)).toBe(running);
    expect(sessions.insert).not.toHaveBeenCalled();
    expect(store().session).toBe(running);
  });
});

describe('finish', () => {
  it('returns the closed row and lets go of it', () => {
    useSessionStore.setState({ session: aRunningSession() });

    const closed = store().finish('cancelled', T0 + 10 * MINUTE, 'llamada');

    expect(closed).toMatchObject({
      id: 'session-1',
      outcome: 'cancelled',
      actualMs: 10 * MINUTE,
      exitReason: 'llamada',
      endedAt: T0 + 10 * MINUTE,
    });
    expect(sessions.update).toHaveBeenCalledWith(closed);
    expect(store().session).toBeNull();
  });

  it('is null when nothing is running', () => {
    expect(store().finish('completed', T0)).toBeNull();
    expect(sessions.update).not.toHaveBeenCalled();
  });

  it('records the first completed session as the end of onboarding, once', () => {
    useSessionStore.setState({ session: aRunningSession() });
    store().finish('completed', T0 + HOUR);

    expect(settings.setNumber).toHaveBeenCalledWith('onboarding_completed_at', T0 + HOUR, T0 + HOUR);

    vi.mocked(settings.getNumber).mockReturnValue(T0 + HOUR);
    useSessionStore.setState({ session: aRunningSession({ id: 'session-2' }) });
    store().finish('completed', T0 + 2 * HOUR);

    expect(settings.setNumber).toHaveBeenCalledTimes(1);
  });

  it('does not end onboarding on a cancelled session', () => {
    useSessionStore.setState({ session: aRunningSession() });

    store().finish('cancelled', T0 + MINUTE);

    expect(settings.setNumber).not.toHaveBeenCalled();
  });
});

describe('expireUnwatched', () => {
  it('closes the session as expired at its planned end and clears', () => {
    useSessionStore.setState({ session: aRunningSession() });

    store().expireUnwatched();

    expect(sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1', outcome: 'expired', endedAt: T0 + HOUR }),
    );
    expect(store().session).toBeNull();
  });

  it('does nothing when nothing is running', () => {
    store().expireUnwatched();

    expect(sessions.update).not.toHaveBeenCalled();
  });
});

describe('setIntention', () => {
  it('stores null for whitespace and the trimmed text otherwise', () => {
    useSessionStore.setState({ session: aRunningSession() });

    store().setIntention('   ');
    expect(store().session?.intention).toBeNull();
    expect(sessions.update).toHaveBeenLastCalledWith(expect.objectContaining({ intention: null }));

    store().setIntention(' leer ');
    expect(store().session?.intention).toBe('leer');
    expect(sessions.update).toHaveBeenLastCalledWith(expect.objectContaining({ intention: 'leer' }));
  });

  it('does nothing when nothing is running', () => {
    store().setIntention('leer');

    expect(sessions.update).not.toHaveBeenCalled();
  });
});

describe('registerInterruption', () => {
  it('writes nothing in soft', () => {
    useSessionStore.setState({ session: aRunningSession({ depth: 'soft' }) });

    store().registerInterruption();

    expect(sessions.update).not.toHaveBeenCalled();
    expect(store().session?.interruptions).toBe(0);
  });

  it('counts and writes in firm', () => {
    useSessionStore.setState({ session: aRunningSession({ depth: 'firm' }) });

    store().registerInterruption();
    store().registerInterruption();

    expect(sessions.update).toHaveBeenCalledTimes(2);
    expect(sessions.update).toHaveBeenLastCalledWith(expect.objectContaining({ interruptions: 2 }));
    expect(store().session?.interruptions).toBe(2);
  });
});
