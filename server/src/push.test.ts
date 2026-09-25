import { describe, expect, it } from 'vitest';

import { createExpoPush, type PushData } from './push.ts';
import type { Account } from './store.ts';

/**
 * The guard over ADR-0037 §1: what leaves this server for Expo is a silent, data-only
 * message. A `title` or a `body` makes it a visible alert, and the operating system
 * draws a visible alert before the app can see it — which would break rule 11 ("the
 * circle never notifies during a session") in a way no client code can repair.
 *
 * These tests drive the real sender with a fake `fetch`, so they fail on the actual
 * request body rather than on a copy of it.
 */

const ANA: Account = {
  id: '0199a1b2-c3d4-7e5f-8a9b-000000000002',
  secretHash: 'x',
  name: 'Ana',
  handle: 'ana',
  inviteCode: null,
  pushToken: 'ExponentPushToken[ana]',
  timeZone: 'America/Bogota',
  nudgesOn: true,
  platform: 'android',
  appVersion: '1.0.0',
  lastSeenAt: 1,
  createdAt: 1,
  updatedAt: 1,
};

const NUDGE: PushData = {
  kind: 'nudge',
  from: '0199a1b2-c3d4-7e5f-8a9b-000000000001',
  fromHandle: 'gus',
  at: '1790000000000',
  challengeId: '0199a1b2-c3d4-7e5f-8a9b-0000000000c1',
};

/** The one element there should be, so a missing push fails as a missing push. */
function only<T>(list: readonly T[]): T {
  expect(list.length).toBe(1);
  const one = list[0];
  if (one === undefined) {
    throw new Error('nothing was sent');
  }
  return one;
}

/** Records every call and answers 200, like Expo does for a well-formed batch. */
function fakeFetch() {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response('{"data":{"status":"ok"}}', { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

/**
 * Everything the system could draw on its own. `title`, `subtitle` and `body` are the
 * alert itself; `sound` and `badge` are iOS presentation; `channelId` and `richContent`
 * are Android's. A silent push has none of them.
 */
const VISIBLE_FIELDS = [
  'title',
  'subtitle',
  'body',
  'message',
  'sound',
  'badge',
  'channelId',
  'categoryId',
  'richContent',
  'mutableContent',
];

describe('what goes out to Expo', () => {
  it('carries no visible text at all', async () => {
    const { calls, impl } = fakeFetch();

    await createExpoPush(impl).send(ANA, { data: NUDGE, requiresNudges: true });

    const sent = only(calls);
    expect(sent.url).toBe('https://exp.host/--/api/v2/push/send');
    for (const field of VISIBLE_FIELDS) {
      expect(sent.body).not.toHaveProperty(field);
    }
    // Nothing anywhere in the request reads as a sentence for a person: the only Spanish
    // the old version sent ('te empuja', 'quiere entrar a tu círculo') is gone, and the
    // phone writes the line in the language of the device (ADR-0037 §2).
    expect(Object.keys(sent.body).sort()).toEqual([
      '_contentAvailable',
      'contentAvailable',
      'data',
      'priority',
      'to',
    ]);
  });

  it('asks iOS to wake the app in the background, at normal priority', async () => {
    const { calls, impl } = fakeFetch();

    await createExpoPush(impl).send(ANA, { data: NUDGE });

    // Both spellings: `contentAvailable` is the current one and `_contentAvailable` is
    // the deprecated one ADR-0037 §1 names, which Expo still accepts.
    const sent = only(calls);
    expect(sent.body.contentAvailable).toBe(true);
    expect(sent.body._contentAvailable).toBe(true);
    expect(sent.body.priority).toBe('normal');
    expect(sent.body.to).toBe('ExponentPushToken[ana]');
  });

  it('sends the facts the phone needs to write the line itself', async () => {
    const { calls, impl } = fakeFetch();

    await createExpoPush(impl).send(ANA, { data: NUDGE });

    // Who, what kind, when — and where a tap goes. Never the sender's free-text name.
    expect(only(calls).body.data).toEqual({
      kind: 'nudge',
      from: '0199a1b2-c3d4-7e5f-8a9b-000000000001',
      fromHandle: 'gus',
      at: '1790000000000',
      challengeId: '0199a1b2-c3d4-7e5f-8a9b-0000000000c1',
    });
  });

  it('stays under the 4KiB Expo allows for a whole payload', async () => {
    const { calls, impl } = fakeFetch();

    await createExpoPush(impl).send(ANA, { data: NUDGE });

    expect(new TextEncoder().encode(JSON.stringify(only(calls).body)).length).toBeLessThan(4096);
  });

  it('sends nothing to a phone with no token, and nothing when nudges are off', async () => {
    const { calls, impl } = fakeFetch();
    const push = createExpoPush(impl);

    await push.send({ ...ANA, pushToken: null }, { data: NUDGE });
    await push.send({ ...ANA, nudgesOn: false }, { data: NUDGE, requiresNudges: true });
    // The switch is only for nudges: entering a circle is not a nudge (ADR-0027 §5).
    await push.send({ ...ANA, nudgesOn: false }, { data: { ...NUDGE, kind: 'invite' } });

    expect((only(calls).body.data as PushData).kind).toBe('invite');
  });

  it('does not throw when Expo refuses the message', async () => {
    const impl = (async () =>
      new Response('{"errors":[{"code":"PUSH_TOO_MANY_EXPERIENCE_IDS"}]}', {
        status: 400,
      })) as unknown as typeof fetch;

    // The row is already written; a failed push is not worth failing the sync it rode
    // on, and the phone sees the nudge on its next sync anyway (ADR-0037 §4).
    await expect(createExpoPush(impl).send(ANA, { data: NUDGE })).resolves.toBeUndefined();
  });
});
