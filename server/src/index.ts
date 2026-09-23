import { serve } from '@hono/node-server';

import { createApp } from './app.ts';
import { createMemoryStore } from './memoryStore.ts';
import { createPgStore } from './pgStore.ts';
import { createExpoPush, createRecordingPush } from './push.ts';
import type { Store } from './store.ts';

/**
 * The entry point (ADR-0033). With `DATABASE_URL` it runs on Postgres and sends real
 * pushes through Expo; without one it runs on memory and records them instead, which
 * is what `npm run dev` does on a laptop. It says which of the two it is at boot: a
 * server that pretends to persist is the same lie as a capability behind a flag.
 */

const port = Number(process.env.PORT ?? 8787);
const databaseUrl = process.env.DATABASE_URL ?? null;

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
  const app = createApp({ store, push, now: () => Date.now() });

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`vesper server on :${info.port}`);
  });
}

void main();
