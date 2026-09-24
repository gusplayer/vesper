import { describe, expect, it } from 'vitest';

import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { atMinuteOfDay, dayStartShifted } from './day';
import { aRunningSession, T0 } from './fixtures';
import {
  countsAgainstBudget,
  foregroundPresentation,
  nextQuietEnd,
  noticeId,
  noticeMessage,
  noticeName,
  NOTICE_ID_PREFIX,
  parsePushNotice,
  planNotice,
  silencedBySession,
  type NoticeState,
  type PushNotice,
} from './nudgeNotice';
import { DAILY_BUDGET } from './reminders';
import { DAY, HOUR, MINUTE } from './time';

/**
 * The gate of ADR-0037: what a silent push from the circle turns into, and when.
 * Every case the ADR names has a test here, because this is the only place that can
 * keep rule 11 — the server cannot, and the OS will not.
 */

const words = es.circle.push;

/** A weekday at 10:00 local, well outside quiet hours and with nothing else going on. */
const TEN_AM = atMinuteOfDay(T0, 10 * 60);

function aNudge(overrides: Partial<PushNotice> = {}): PushNotice {
  return {
    kind: 'nudge',
    fromId: 'account-ana',
    fromHandle: 'ana',
    at: TEN_AM,
    challengeId: 'challenge-read',
    ...overrides,
  };
}

function aState(overrides: Partial<NoticeState> = {}): NoticeState {
  return {
    now: TEN_AM,
    session: null,
    allowed: true,
    switches: { nudge: true, invite: true, accepted: true },
    spentToday: 0,
    names: new Map([['account-ana', 'Ana']]),
    ...overrides,
  };
}

describe('parsePushNotice', () => {
  it('reads the exact shape the server sends, with `at` as a decimal string', () => {
    const notice = parsePushNotice({
      kind: 'nudge',
      from: 'account-ana',
      fromHandle: 'ana',
      at: '1790000000000',
      challengeId: 'challenge-read',
    });
    expect(notice).toEqual({
      kind: 'nudge',
      fromId: 'account-ana',
      fromHandle: 'ana',
      at: 1_790_000_000_000,
      challengeId: 'challenge-read',
    });
  });

  it('unwraps the JSON of dataString, which is how some paths deliver it', () => {
    const notice = parsePushNotice({
      dataString: JSON.stringify({ kind: 'invite', from: 'x', fromHandle: 'gus', at: '10' }),
    });
    expect(notice?.kind).toBe('invite');
    expect(notice?.fromHandle).toBe('gus');
  });

  it('keeps no challenge for anything but a nudge: only a nudge opens one', () => {
    const notice = parsePushNotice({
      kind: 'accepted',
      from: 'x',
      fromHandle: 'gus',
      at: '10',
      challengeId: 'challenge-read',
    });
    expect(notice?.challengeId).toBeNull();
  });

  it('answers null to anything unshaped instead of throwing in a background task', () => {
    expect(parsePushNotice(null)).toBeNull();
    expect(parsePushNotice('nudge')).toBeNull();
    expect(parsePushNotice({ kind: 'shout', from: 'x', fromHandle: 'y', at: '1' })).toBeNull();
    expect(parsePushNotice({ kind: 'nudge', from: 'x', fromHandle: 'y' })).toBeNull();
    expect(parsePushNotice({ kind: 'nudge', from: 'x', fromHandle: 'y', at: 'soon' })).toBeNull();
    expect(parsePushNotice({ dataString: 'not json' })).toBeNull();
  });
});

describe('the sentence the phone writes', () => {
  it('uses the name the circle already synced', () => {
    const message = noticeMessage(aNudge(), new Map([['account-ana', 'Ana']]), words);
    expect(message.title).toBe('Ana te empuja');
    expect(message.body).toBe('Hoy no has marcado el reto.');
    expect(message.challengeId).toBe('challenge-read');
  });

  it('falls back to the handle for somebody it has never seen', () => {
    // An invitation is exactly this case: the sender is not a member yet.
    const notice = aNudge({ kind: 'invite', fromId: 'stranger', fromHandle: 'gus' });
    expect(noticeName(notice, new Map())).toBe('@gus');
    expect(noticeMessage(notice, new Map(), words).title).toBe('@gus quiere entrar a tu círculo');
  });

  it('writes the same notice in English when that is the phone', () => {
    expect(noticeMessage(aNudge(), new Map([['account-ana', 'Ana']]), en.circle.push).title).toBe(
      'Ana is nudging you',
    );
  });

  it('gives one id per sender, kind and day, so a repeat replaces itself', () => {
    const id = noticeId(aNudge());
    expect(id.startsWith(NOTICE_ID_PREFIX)).toBe(true);
    expect(noticeId(aNudge({ at: TEN_AM + MINUTE }))).toBe(id);
    expect(noticeId(aNudge({ kind: 'invite' }))).not.toBe(id);
  });
});

describe('planNotice', () => {
  it('shows a nudge that arrives on an ordinary morning', () => {
    const plan = planNotice(aNudge(), aState(), words);
    expect(plan).toEqual({ action: 'show', message: noticeMessage(aNudge(), aState().names, words) });
  });

  it('waits while a session runs', () => {
    const plan = planNotice(aNudge(), aState({ session: aRunningSession() }), words);
    expect(plan).toEqual({ action: 'wait' });
  });

  it('waits while a session is paused: a pause is still a session', () => {
    const paused = aRunningSession({ breakStartedAt: TEN_AM });
    expect(silencedBySession(paused)).toBe(true);
    expect(planNotice(aNudge(), aState({ session: paused }), words)).toEqual({ action: 'wait' });
  });

  it('shows what was waiting once the session closed', () => {
    const notice = aNudge();
    const inSession = aState({ session: aRunningSession(), now: TEN_AM });
    expect(planNotice(notice, inSession, words).action).toBe('wait');
    // Half an hour later the session is over and the same notice goes through.
    const after = aState({ now: TEN_AM + 30 * MINUTE });
    expect(planNotice(notice, after, words).action).toBe('show');
  });

  it('never rings for a push more than a day old (ADR-0037 §3)', () => {
    const state = aState({ now: TEN_AM + DAY });
    expect(planNotice(aNudge(), state, words)).toEqual({ action: 'drop', reason: 'expired' });
  });

  it('still rings just under the day', () => {
    const state = aState({ now: TEN_AM + DAY - MINUTE });
    expect(planNotice(aNudge(), state, words).action).toBe('show');
  });

  it('waits for the morning when it lands inside quiet hours', () => {
    const elevenPm = atMinuteOfDay(T0, 23 * 60);
    const plan = planNotice(aNudge({ at: elevenPm }), aState({ now: elevenPm }), words);
    expect(plan.action).toBe('schedule');
    if (plan.action === 'schedule') {
      expect(plan.at).toBe(atMinuteOfDay(dayStartShifted(elevenPm, 1), 8 * 60));
    }
  });

  it('waits only until this morning when the push lands after midnight', () => {
    const twoAm = atMinuteOfDay(T0, 2 * 60);
    const plan = planNotice(aNudge({ at: twoAm }), aState({ now: twoAm }), words);
    expect(plan.action).toBe('schedule');
    if (plan.action === 'schedule') {
      expect(plan.at).toBe(atMinuteOfDay(twoAm, 8 * 60));
    }
  });

  it('drops a notice that would run out while it waits for the morning', () => {
    // Sent at 07:00, held by a session all day, free again at 23:30: the next 8:00 is
    // twenty-five hours later, so it stays on the circle screen and knocks nowhere.
    const sentAt = atMinuteOfDay(T0, 7 * 60);
    const state = aState({ now: atMinuteOfDay(T0, 23 * 60 + 30) });
    expect(planNotice(aNudge({ at: sentAt }), state, words)).toEqual({
      action: 'drop',
      reason: 'expired',
    });
  });

  it('does not ring once the day’s two notices are spent (ADR-0027 §2)', () => {
    const state = aState({ spentToday: DAILY_BUDGET });
    expect(planNotice(aNudge(), state, words)).toEqual({ action: 'drop', reason: 'budgetSpent' });
    expect(planNotice(aNudge(), aState({ spentToday: DAILY_BUDGET - 1 }), words).action).toBe('show');
  });

  it('counts a notice pushed to tomorrow morning against tomorrow, not today', () => {
    const elevenPm = atMinuteOfDay(T0, 23 * 60);
    const state = aState({ now: elevenPm, spentToday: DAILY_BUDGET });
    expect(planNotice(aNudge({ at: elevenPm }), state, words).action).toBe('schedule');
  });

  it('says nothing when the nudge switch is off', () => {
    const state = aState({ switches: { nudge: false, invite: true, accepted: true } });
    expect(planNotice(aNudge(), state, words)).toEqual({ action: 'drop', reason: 'switchedOff' });
    // The switch is the nudge's own: an invitation still comes through.
    expect(planNotice(aNudge({ kind: 'invite' }), state, words).action).toBe('show');
  });

  it('says nothing without the permission or the master switch', () => {
    expect(planNotice(aNudge(), aState({ allowed: false }), words)).toEqual({
      action: 'drop',
      reason: 'notAllowed',
    });
  });
});

describe('nextQuietEnd', () => {
  it('is 8:00 of the same day before it, and of the next day after 22:00', () => {
    const threeAm = atMinuteOfDay(T0, 3 * 60);
    expect(nextQuietEnd(threeAm)).toBe(atMinuteOfDay(T0, 8 * 60));
    const elevenPm = atMinuteOfDay(T0, 23 * 60);
    expect(nextQuietEnd(elevenPm)).toBe(atMinuteOfDay(dayStartShifted(T0, 1), 8 * 60));
  });

  it('is 8:00 on the wall clock, which a day is not always 24 h away from', () => {
    const elevenPm = atMinuteOfDay(T0, 23 * 60);
    expect(nextQuietEnd(elevenPm) - elevenPm).toBeGreaterThanOrEqual(8 * HOUR);
  });
});

describe('foregroundPresentation', () => {
  it('shows nothing for a message with no kind: that is a silent push', () => {
    expect(foregroundPresentation(null, false).shouldShowBanner).toBe(false);
    expect(foregroundPresentation(null, false).shouldShowList).toBe(false);
  });

  it('shows nothing during a session but the session’s own two notices', () => {
    expect(foregroundPresentation('nudge', true).shouldShowBanner).toBe(false);
    expect(foregroundPresentation('streakRisk', true).shouldShowBanner).toBe(false);
    expect(foregroundPresentation('sessionEnd', true).shouldShowBanner).toBe(true);
    expect(foregroundPresentation('breakEnd', true).shouldShowBanner).toBe(true);
  });

  it('shows an ordinary notice outside a session, and sounds only for the end of one', () => {
    expect(foregroundPresentation('nudge', false)).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
    expect(foregroundPresentation('sessionEnd', false).shouldPlaySound).toBe(true);
  });
});

describe('countsAgainstBudget', () => {
  it('counts the daily notices and the three the circle pushes, and nothing else', () => {
    expect(countsAgainstBudget('streakRisk')).toBe(true);
    expect(countsAgainstBudget('reactivation')).toBe(true);
    expect(countsAgainstBudget('nudge')).toBe(true);
    expect(countsAgainstBudget('invite')).toBe(true);
    expect(countsAgainstBudget('sessionEnd')).toBe(false);
    expect(countsAgainstBudget('schedule')).toBe(false);
    expect(countsAgainstBudget(null)).toBe(false);
  });
});
