import { randomBytes } from 'node:crypto';

import { serve } from '@hono/node-server';

import { createApp } from './app.ts';
import { createRecordingMailer, createResendMailer, type Mailer } from './mailer.ts';
import { createMemoryStore } from './memoryStore.ts';
import {
  bucketConfigFrom,
  createMemoryObjectStore,
  createS3ObjectStore,
  type ObjectStore,
} from './objectStore.ts';
import { createPgStore } from './pgStore.ts';
import { createExpoPush, createRecordingPush } from './push.ts';
import { parseRecoveryKey } from './recovery.ts';
import type { Store } from './store.ts';
import { startSweeper } from './sweeper.ts';

/**
 * The entry point (ADR-0033). With `DATABASE_URL` it runs on Postgres and sends real
 * pushes through Expo; without one it runs on memory and records them instead, which
 * is what `npm run dev` does on a laptop. It says which of the two it is at boot: a
 * server that pretends to persist is the same lie as a capability behind a flag.
 *
 * The recovery email (ADR-0050) says so too, in one line: on, or off and why — the names
 * of the missing variables, never a value. So do the photos' bucket and the moderation
 * routes (ADR-0051).
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

/**
 * The photos' bucket (ADR-0051 §17): the variables of a Railway Bucket's "AWS SDK" preset,
 * or memory — objects lost on restart and URLs served by this process — and a line that
 * says which, with the names of what is missing and never a value.
 */
function objectStore(now: () => number): ObjectStore {
  const bucket = bucketConfigFrom(process.env);
  if ('config' in bucket) {
    const { config } = bucket;
    const host = new URL(config.endpoint).host;
    console.log(
      `photos in bucket ${config.bucket} at ${host} (${config.pathStyle ? 'path-style' : 'virtual-hosted'}, region ${config.region}${config.prefix === '' ? '' : `, keys under ${config.prefix}`})`,
    );
    return createS3ObjectStore(config, fetch, now);
  }
  console.warn(
    `photos on memory (${bucket.missing.join(', ')} not set): objects are lost on restart, URLs are served by /media-local`,
  );
  return createMemoryObjectStore(now);
}

/** `ADMIN_TOKEN`, or null and a line saying the moderation routes answer 404. */
function adminToken(): string | null {
  const token = env('ADMIN_TOKEN');
  if (token === null) {
    console.warn('moderation off (ADMIN_TOKEN not set): /admin answers 404');
    return null;
  }
  if (token.length < 32) {
    console.warn('moderation off (ADMIN_TOKEN is shorter than 32 characters): /admin answers 404');
    return null;
  }
  console.log('moderation on: /admin takes ADMIN_TOKEN');
  return token;
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
  const now = () => Date.now();
  const objects = objectStore(now);
  const app = createApp({
    store,
    push,
    now,
    ...recoveryConfig(),
    objects,
    adminToken: adminToken(),
  });
  // Expired photos, abandoned uploads, old tombstones and released evidence, every hour;
  // objects without a row, every week (sweeper.ts).
  startSweeper({ store, objects, now });

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`vesper server on :${info.port}`);
  });
}

void main();
