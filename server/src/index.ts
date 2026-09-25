import { randomBytes } from 'node:crypto';

import { serve } from '@hono/node-server';

import { createApp } from './app.ts';
import { createRecordingMailer, createResendMailer, type Mailer } from './mailer.ts';
import { createMemoryStore } from './memoryStore.ts';
import { createPgStore } from './pgStore.ts';
import { createExpoPush, createRecordingPush } from './push.ts';
import { parseRecoveryKey } from './recovery.ts';
import type { Store } from './store.ts';

/**
 * The entry point (ADR-0033). With `DATABASE_URL` it runs on Postgres and sends real
 * pushes through Expo; without one it runs on memory and records them instead, which
 * is what `npm run dev` does on a laptop. It says which of the two it is at boot: a
 * server that pretends to persist is the same lie as a capability behind a flag.
 *
 * The recovery email (ADR-0050) says so too, in one line: on, or off and why — the names
 * of the missing variables, never a value.
 */

const port = Number(process.env.PORT ?? 8787);
const databaseUrl = process.env.DATABASE_URL ?? null;

/** Set and not blank; a variable left empty in a dashboard is not a value. */
function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value === undefined || value === '' ? null : value;
}

/**
 * Production: Resend and `RECOVERY_KEY`, or the recovery routes answer 503. Local, on
 * memory: codes print to this console and the key lives until the process ends, like
 * every row does.
 */
function recoveryConfig(): { mailer: Mailer | null; recoveryKey: Uint8Array | null } {
  if (databaseUrl === null) {
    console.warn('email recovery on memory: codes print here, and the key lasts until restart');
    return { mailer: createRecordingMailer((line) => console.log(line)), recoveryKey: randomBytes(32) };
  }
  const apiKey = env('RESEND_API_KEY');
  const from = env('RECOVERY_FROM');
  const rawKey = env('RECOVERY_KEY');
  const recoveryKey = parseRecoveryKey(rawKey ?? undefined);
  const missing = [
    apiKey === null ? 'RESEND_API_KEY' : null,
    from === null ? 'RECOVERY_FROM' : null,
    rawKey === null ? 'RECOVERY_KEY' : null,
  ].filter((name): name is string => name !== null);
  const malformed = rawKey !== null && recoveryKey === null;

  if (missing.length > 0 || malformed) {
    const why = [
      missing.length > 0 ? `${missing.join(', ')} not set` : null,
      malformed ? 'RECOVERY_KEY is not 32 bytes of base64' : null,
    ]
      .filter((part) => part !== null)
      .join('; ');
    console.warn(`email recovery off (${why}): /recovery answers 503`);
  } else {
    console.log('email recovery on, through Resend');
  }
  return {
    mailer: apiKey !== null && from !== null ? createResendMailer({ apiKey, from }) : null,
    // Kept even without a mailer: a rotation still re-seals the copies it has.
    recoveryKey,
  };
}

async function main(): Promise<void> {
  let store: Store;
  if (databaseUrl === null) {
    store = createMemoryStore();
    console.warn('no DATABASE_URL: running on memory, every row is lost on restart');
  } else {
    const pg = createPgStore(databaseUrl);
    await pg.migrate();
    store = pg;
    console.log('postgres ready');
  }

  const push = databaseUrl === null ? createRecordingPush() : createExpoPush();
  const app = createApp({ store, push, now: () => Date.now(), ...recoveryConfig() });

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`vesper server on :${info.port}`);
  });
}

void main();
