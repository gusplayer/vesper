import type { Strings } from '../i18n/es';
import { atMinuteOfDay, dayKeyOf, dayStartShifted } from './day';
import { DAILY_BUDGET, DAILY_KINDS, inQuietHours, QUIET_END_MINUTES } from './reminders';
import { DAY } from './time';
import type { Millis, Session } from './types';

/**
 * What the phone does with a silent push from the circle (ADR-0037). Pure: no
 * expo-notifications, no stores, no dictionary of its own — the words arrive as a
 * parameter like everywhere else in `src/domain/`.
 *
 * The server sends **a fact, not a sentence**: `kind`, `from`, `fromHandle`, `at` and,
 * for a nudge, `challengeId`. Nothing to show. Two things follow, and they are the
 * whole of this file:
 *
 * 1. **The sentence is written here**, in the language of the phone, resolving `from`
 *    against the people the circle already synced and falling back to the handle for
 *    somebody it has never seen — which is exactly the case of an invitation. The
 *    sender's *name* never travels (server/src/push.ts says why), so the fallback is
 *    the handle and never free text from a stranger.
 *
 * 2. **It goes through the same gate as everything else** (ADR-0027 §2, ADR-0037 §2):
 *    at most two notices a day outside a session, nothing between 22:00 and 8:00, and
 *    absolute silence while a session runs or is paused. A push that lands in a
 *    session **waits** for the session to close; if by then it is quiet hours, it
 *    waits for the morning. A push older than a day **never rings**: a nudge is a
 *    thing of one day (ADR-0021 §3, ADR-0037 §3) and after that it only lives on the
 *    circle screen.
 *
 * Nothing here decides *when* it is re-asked: the platform hook replans a waiting
 * notice when the session closes, and a notice the process forgets is not an error —
 * the row is already on the server and shows up at the next sync (ADR-0037 §4).
 */

/** What happened, as `server/src/push.ts` names it. */
export type PushKind = 'nudge' | 'invite' | 'accepted';

export const PUSH_KINDS: readonly PushKind[] = ['nudge', 'invite', 'accepted'];

/** Everything that travels, already in the project's units (`at` is epoch ms). */
export type PushNotice = {
  kind: PushKind;
  /** The account id of whoever did it: the phone looks it up among its members. */
  fromId: string;
  /** Their unique handle, for a phone that does not know them yet. */
  fromHandle: string;
  at: Millis;
  /** Only a nudge carries one; tapping the notice opens that challenge. */
  challengeId: string | null;
};

/** The slice of the dictionary this file writes with. The value never crosses. */
export type NoticeStrings = Strings['circle']['push'];

/** A notice ready to be handed to the OS, words and all. */
export type NoticeMessage = {
  id: string;
  kind: PushKind;
  title: string;
  body: string;
  challengeId: string | null;
};

export type DropReason =
  /** No permission, or the user's own master switch is off. */
  | 'notAllowed'
  /** This kind's switch is off (Ajustes › Notificaciones, Ajustes › Círculo). */
  | 'switchedOff'
  /** More than a day old by the time it could have rung (ADR-0037 §3). */
  | 'expired'
  /** The day's two notices are already spent (ADR-0027 §2). */
  | 'budgetSpent';

export type NoticePlan =
  /** Present it now. */
  | { action: 'show'; message: NoticeMessage }
  /** Quiet hours: hand it to the OS for `at`, which is the next 8:00. */
  | { action: 'schedule'; at: Millis; message: NoticeMessage }
  /** A session (or a pause) is running. Ask again when it closes. */
  | { action: 'wait' }
  | { action: 'drop'; reason: DropReason };

export type NoticeState = {
  now: Millis;
  /** The session the phone is in. A pause is a running session and silences too. */
  session: Session | null;
  /** The OS permission and the user's master switch, as `plannedNotifications` reads them. */
  allowed: boolean;
  /** One switch per kind (ADR-0027 §2: "cada tipo tiene su interruptor"). */
  switches: Record<PushKind, boolean>;
  /** Budgeted notices already delivered today. `DAILY_BUDGET` is the cap. */
  spentToday: number;
  /** The circle's people by account id. What is missing falls back to the handle. */
  names: ReadonlyMap<string, string>;
};

/** Ids of what this file produces. `syncScheduled` leaves this prefix alone. */
export const NOTICE_ID_PREFIX = 'circle-';

/** A notice is a thing of one day: after this it is only on the circle screen. */
export const NOTICE_TTL_MS = DAY;

// --- Reading what arrived ---------------------------------------------------------------

function field(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  if (typeof value === 'string') {
    return value.length > 0 ? value : null;
  }
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
}

function isPushKind(value: string | null): value is PushKind {
  return value !== null && (PUSH_KINDS as readonly string[]).includes(value);
}

/**
 * Unwraps what the OS handed over. Expo delivers the data payload as an object, and
 * on some paths only as `dataString`, a JSON string; FCM turns every value into a
 * string on the way out either way, which is why `at` arrives as text.
 *
 * Anything unshaped answers null rather than throwing: this runs from a background
 * task, where an exception is a crash nobody sees.
 */
export function parsePushNotice(payload: unknown): PushNotice | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  let data = payload as Record<string, unknown>;
  const nested = data.dataString;
  if (typeof nested === 'string') {
    try {
      const parsed: unknown = JSON.parse(nested);
      if (typeof parsed !== 'object' || parsed === null) {
        return null;
      }
      data = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const kind = field(data, 'kind');
  const fromId = field(data, 'from');
  const fromHandle = field(data, 'fromHandle');
  const at = field(data, 'at');
  if (!isPushKind(kind) || fromId === null || fromHandle === null || at === null) {
    return null;
  }
  const millis = Number(at);
  if (!Number.isFinite(millis)) {
    return null;
  }
  return {
    kind,
    fromId,
    fromHandle,
    at: millis,
    challengeId: kind === 'nudge' ? field(data, 'challengeId') : null,
  };
}

// --- Writing the sentence ----------------------------------------------------------------

/**
 * The name to say. The circle's own name for that person when it knows them, and the
 * handle when it does not — an invitation is precisely the case where it does not.
 * The handle is `[a-z0-9_]{3,20}` and validated by the server, so it is safe to put
 * in a notification shade; a name chosen by a stranger would not be.
 */
export function noticeName(notice: PushNotice, names: ReadonlyMap<string, string>): string {
  const known = names.get(notice.fromId);
  return known !== undefined && known.length > 0 ? known : `@${notice.fromHandle}`;
}

/** One notice per sender, per kind, per day: a second push about the same thing replaces it. */
export function noticeId(notice: PushNotice): string {
  return `${NOTICE_ID_PREFIX}${notice.kind}-${notice.fromId}-${dayKeyOf(notice.at)}`;
}

export function noticeMessage(
  notice: PushNotice,
  names: ReadonlyMap<string, string>,
  t: NoticeStrings,
): NoticeMessage {
  const name = noticeName(notice, names);
  const words = t[notice.kind];
  return {
    id: noticeId(notice),
    kind: notice.kind,
    title: words.title(name),
    body: words.body,
    challengeId: notice.challengeId,
  };
}

// --- The gate -----------------------------------------------------------------------------

/** True while a session runs, break included: `outcome` stays 'running' through a pause. */
export function silencedBySession(session: Session | null): boolean {
  return session !== null && session.outcome === 'running';
}

function localMinutesOfDay(at: Millis): number {
  const date = new Date(at);
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * The first instant after `at` that is not quiet hours: 8:00 today when the night is
 * still young enough, otherwise 8:00 tomorrow. On the wall clock, so it is 8:00 across
 * a DST change.
 */
export function nextQuietEnd(at: Millis): Millis {
  const morning = atMinuteOfDay(at, QUIET_END_MINUTES);
  return at < morning ? morning : atMinuteOfDay(dayStartShifted(at, 1), QUIET_END_MINUTES);
}

/**
 * What to do with `notice` right now. The order is the order of the rules: a switch
 * that is off never becomes a notification, an expired notice never rings, a session
 * silences everything, quiet hours push to the morning, and the day's budget is the
 * last word.
 *
 * `wait` is not a failure. It is the whole point of ADR-0037: the phone is the only
 * one that knows a session is running, so it holds the notice and is asked again when
 * the session closes — with a new `now`, which is why every other rule is re-applied
 * then, expiry included.
 */
export function planNotice(notice: PushNotice, state: NoticeState, t: NoticeStrings): NoticePlan {
  if (!state.allowed) {
    return { action: 'drop', reason: 'notAllowed' };
  }
  if (!state.switches[notice.kind]) {
    return { action: 'drop', reason: 'switchedOff' };
  }
  if (state.now - notice.at >= NOTICE_TTL_MS) {
    return { action: 'drop', reason: 'expired' };
  }
  if (silencedBySession(state.session)) {
    return { action: 'wait' };
  }

  const quiet = inQuietHours(localMinutesOfDay(state.now));
  const at = quiet ? nextQuietEnd(state.now) : state.now;
  // A notice held through the night can run out while it waits. It is still on the
  // circle screen; it just no longer knocks.
  if (at - notice.at >= NOTICE_TTL_MS) {
    return { action: 'drop', reason: 'expired' };
  }
  // The budget is per local day, so a notice pushed to tomorrow morning is counted
  // against tomorrow — a day whose two notices nothing has spent yet.
  if (dayKeyOf(at) === dayKeyOf(state.now) && state.spentToday >= DAILY_BUDGET) {
    return { action: 'drop', reason: 'budgetSpent' };
  }

  const message = noticeMessage(notice, state.names, t);
  return quiet ? { action: 'schedule', at, message } : { action: 'show', message };
}

// --- What the OS shows while the app is open ----------------------------------------------

export type ForegroundPresentation = {
  shouldShowBanner: boolean;
  shouldShowList: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
};

const NOTHING: ForegroundPresentation = {
  shouldShowBanner: false,
  shouldShowList: false,
  shouldPlaySound: false,
  shouldSetBadge: false,
};

/** The two the session itself owns. They are the only ones a session lets through. */
const SESSION_KINDS: readonly string[] = ['sessionEnd', 'breakEnd'];

/**
 * How a notification that arrives while the app is in front is presented. Before
 * ADR-0037 this was "banner, always", which is the one thing that must not happen
 * here: a silent push has no words of its own, and drawing it during a session is
 * exactly what rule 11 forbids.
 *
 * - **No kind at all** is a remote data-only message (`kind` is written by this app on
 *   what it schedules itself). It carries nothing to show and is never shown: what it
 *   turns into is decided by `planNotice`, which may present a notice of its own.
 * - **In a session or a pause**, only the session's own two notices show.
 * - Sound is still only the end of a session.
 */
export function foregroundPresentation(kind: string | null, inSession: boolean): ForegroundPresentation {
  if (kind === null) {
    return NOTHING;
  }
  if (inSession && !SESSION_KINDS.includes(kind)) {
    return NOTHING;
  }
  return {
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: kind === 'sessionEnd',
    shouldSetBadge: false,
  };
}

/**
 * The kinds that spend the day's budget: the five daily notices of `reminders.ts` and
 * the three the circle can push. Session and routine notices are appointments the user
 * made and stay outside it (ADR-0027 §2).
 */
export function countsAgainstBudget(kind: string | null): boolean {
  return kind !== null && ((DAILY_KINDS as readonly string[]).includes(kind) || (PUSH_KINDS as readonly string[]).includes(kind));
}
