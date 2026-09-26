import { randomBytes } from 'node:crypto';

import { AwsClient } from 'aws4fetch';

/**
 * Where the photos' bytes live (ADR-0051 §17): a bucket, never Postgres. The server only
 * ever holds ciphertext it cannot open, so this is plain storage — put, get, copy, delete,
 * list — and one thing more: a URL a phone can download one object from for five minutes,
 * without the bucket's credentials and without passing the bytes through this process.
 *
 * Two implementations. `S3ObjectStore` signs requests with `aws4fetch` against any S3 API
 * (a Railway Bucket on Tigris, R2, MinIO). `MemoryObjectStore` keeps the bytes in a map
 * for the tests and `npm run dev`; its "signed" URL is a route of this same server,
 * `GET /media-local/:token`, with a random token that dies in five minutes.
 */
export type ObjectStore = {
  /** 'memory' serves its own URLs through `readLocal`; 's3' hands out presigned ones. */
  kind: 'memory' | 's3';
  put(key: string, bytes: Uint8Array): Promise<void>;
  /** Null when there is no such object. */
  get(key: string): Promise<Uint8Array | null>;
  /** Deletes each key; a key that is not there is not an error. */
  delete(keys: readonly string[]): Promise<void>;
  /** Every key under the prefix, however many pages that takes. */
  list(prefix: string): Promise<string[]>;
  /** Deletes everything under the prefix; returns how many objects went. */
  deletePrefix(prefix: string): Promise<number>;
  /** Copies one object inside the bucket. False when the source is not there. */
  copy(from: string, to: string): Promise<boolean>;
  /**
   * A URL that downloads the object for `ttlMs`. `origin` is where this server answers,
   * which only the memory store needs.
   */
  presign(key: string, ttlMs: number, origin: string): Promise<{ url: string; expiresAt: number }>;
  /** The memory store's side of its URLs: the bytes for a live token, or null. */
  readLocal?(token: string): Uint8Array | null;
};

/** The route the memory store's URLs point at. */
export const LOCAL_MEDIA_PATH = '/media-local/';

export function createMemoryObjectStore(now: () => number): ObjectStore {
  const objects = new Map<string, Uint8Array>();
  const tokens = new Map<string, { key: string; expiresAt: number }>();

  const prune = (at: number) => {
    for (const [token, grant] of tokens) {
      if (grant.expiresAt <= at) {
        tokens.delete(token);
      }
    }
  };

  return {
    kind: 'memory',
    async put(key, bytes) {
      objects.set(key, new Uint8Array(bytes));
    },
    async get(key) {
      const bytes = objects.get(key);
      return bytes === undefined ? null : new Uint8Array(bytes);
    },
    async delete(keys) {
      for (const key of keys) {
        objects.delete(key);
      }
    },
    async list(prefix) {
      return [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
    },
    async deletePrefix(prefix) {
      let count = 0;
      for (const key of [...objects.keys()]) {
        if (key.startsWith(prefix)) {
          objects.delete(key);
          count += 1;
        }
      }
      return count;
    },
    async copy(from, to) {
      const bytes = objects.get(from);
      if (bytes === undefined) {
        return false;
      }
      objects.set(to, new Uint8Array(bytes));
      return true;
    },
    async presign(key, ttlMs, origin) {
      const at = now();
      prune(at);
      const token = randomBytes(32).toString('base64url');
      const expiresAt = at + ttlMs;
      tokens.set(token, { key, expiresAt });
      return { url: `${origin}${LOCAL_MEDIA_PATH}${token}`, expiresAt };
    },
    readLocal(token) {
      const grant = tokens.get(token);
      if (grant === undefined || grant.expiresAt <= now()) {
        return null;
      }
      const bytes = objects.get(grant.key);
      return bytes === undefined ? null : new Uint8Array(bytes);
    },
  };
}

/**
 * A bucket behind the S3 API, as a Railway Bucket's "AWS SDK" preset describes it:
 * endpoint, region (`auto` on Tigris), name, the two keys, and the URL style. Railway
 * buckets are virtual-hosted (`https://<bucket>.<endpoint host>/<key>`); older ones and
 * MinIO want path-style (`https://<endpoint host>/<bucket>/<key>`).
 */
export type BucketConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathStyle: boolean;
  /** Put in front of every key, so two environments can share one bucket. '' by default. */
  prefix: string;
};

/**
 * The variables a Railway Bucket's "AWS SDK" preset injects into a service
 * (docs.railway.com/storage-buckets, "Variable references"): `AWS_ENDPOINT_URL`,
 * `AWS_DEFAULT_REGION`, `AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`,
 * `AWS_SECRET_ACCESS_KEY` and `AWS_S3_URL_STYLE`. Plus `MEDIA_PREFIX`, ours, for keys.
 *
 * Returns the config, or the names of what is missing — never a value.
 */
export function bucketConfigFrom(
  env: Record<string, string | undefined>,
): { config: BucketConfig } | { missing: string[] } {
  const read = (name: string) => {
    const value = env[name]?.trim();
    return value === undefined || value === '' ? null : value;
  };
  const endpoint = read('AWS_ENDPOINT_URL');
  const bucket = read('AWS_S3_BUCKET_NAME');
  const accessKeyId = read('AWS_ACCESS_KEY_ID');
  const secretAccessKey = read('AWS_SECRET_ACCESS_KEY');
  const missing = [
    endpoint === null ? 'AWS_ENDPOINT_URL' : null,
    bucket === null ? 'AWS_S3_BUCKET_NAME' : null,
    accessKeyId === null ? 'AWS_ACCESS_KEY_ID' : null,
    secretAccessKey === null ? 'AWS_SECRET_ACCESS_KEY' : null,
  ].filter((name): name is string => name !== null);
  if (endpoint === null || bucket === null || accessKeyId === null || secretAccessKey === null) {
    return { missing };
  }
  const rawPrefix = read('MEDIA_PREFIX') ?? '';
  return {
    config: {
      endpoint: endpoint.replace(/\/+$/, ''),
      region: read('AWS_DEFAULT_REGION') ?? read('AWS_REGION') ?? 'auto',
      bucket,
      accessKeyId,
      secretAccessKey,
      pathStyle: (read('AWS_S3_URL_STYLE') ?? '').toLowerCase().startsWith('path'),
      prefix: rawPrefix === '' || rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`,
    },
  };
}

/** S3's escaping of a key in a path: every byte but unreserved characters and '/'. */
function encodeKey(key: string): string {
  return key
    .split('/')
    .map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/');
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** How long one request to the bucket may take before it counts as failed. */
const REQUEST_TIMEOUT_MS = 20_000;

export function createS3ObjectStore(
  config: BucketConfig,
  fetcher: typeof fetch = fetch,
  now: () => number = () => Date.now(),
): ObjectStore {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: config.region,
    // Retries are the caller's: a photo upload the phone retries is better than ten here.
    retries: 0,
  });
  const endpoint = new URL(config.endpoint);

  /** The bucket's base URL, in the configured style, ending in '/'. */
  const base = config.pathStyle
    ? `${endpoint.protocol}//${endpoint.host}/${config.bucket}/`
    : `${endpoint.protocol}//${config.bucket}.${endpoint.host}/`;
  const urlOf = (key: string) => `${base}${encodeKey(config.prefix + key)}`;

  const send = async (url: string, init: RequestInit): Promise<Response> => {
    const signed = await client.sign(url, init);
    return fetcher(signed, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  };

  const fail = async (what: string, response: Response): Promise<never> => {
    const detail = (await response.text().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(`bucket ${what} failed: ${response.status} ${detail}`);
  };

  const store: ObjectStore = {
    kind: 's3',
    async put(key, bytes) {
      const response = await send(urlOf(key), {
        method: 'PUT',
        // A copy with a plain ArrayBuffer under it, which is what `BodyInit` takes.
        body: new Uint8Array(bytes),
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      if (!response.ok) {
        await fail('put', response);
      }
    },
    async get(key) {
      const response = await send(urlOf(key), { method: 'GET' });
      if (response.status === 404) {
        await response.body?.cancel();
        return null;
      }
      if (!response.ok) {
        await fail('get', response);
      }
      return new Uint8Array(await response.arrayBuffer());
    },
    async delete(keys) {
      // One by one: a batch delete wants Content-MD5 on some providers and not others,
      // and what goes at once here is a photo's two objects or one account's handful.
      for (const key of keys) {
        const response = await send(urlOf(key), { method: 'DELETE' });
        if (!response.ok && response.status !== 404) {
          await fail('delete', response);
        }
        await response.body?.cancel();
      }
    },
    async list(prefix) {
      const keys: string[] = [];
      let token: string | null = null;
      do {
        const url = new URL(base);
        url.searchParams.set('list-type', '2');
        url.searchParams.set('prefix', config.prefix + prefix);
        url.searchParams.set('max-keys', '1000');
        if (token !== null) {
          url.searchParams.set('continuation-token', token);
        }
        const response = await send(url.toString(), { method: 'GET' });
        if (!response.ok) {
          await fail('list', response);
        }
        const xml = await response.text();
        for (const match of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) {
          const key = decodeXml(match[1] ?? '');
          if (key.startsWith(config.prefix)) {
            keys.push(key.slice(config.prefix.length));
          }
        }
        const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml);
        const next = /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1];
        token = truncated && next !== undefined && next !== '' ? decodeXml(next) : null;
      } while (token !== null);
      return keys;
    },
    async deletePrefix(prefix) {
      const keys = await store.list(prefix);
      await store.delete(keys);
      return keys.length;
    },
    async copy(from, to) {
      const response = await send(urlOf(to), {
        method: 'PUT',
        headers: { 'x-amz-copy-source': `/${config.bucket}/${encodeKey(config.prefix + from)}` },
      });
      if (response.status === 404) {
        await response.body?.cancel();
        return false;
      }
      if (!response.ok) {
        await fail('copy', response);
      }
      // S3 can answer 200 with an error in the body when a copy fails late.
      const body = await response.text();
      if (body.includes('<Error>')) {
        if (body.includes('NoSuchKey')) {
          return false;
        }
        throw new Error(`bucket copy failed: ${body.slice(0, 200)}`);
      }
      return true;
    },
    async presign(key, ttlMs) {
      // Signed at the injected clock, so the URL dies exactly when `expiresAt` says.
      const at = now();
      const url = new URL(urlOf(key));
      url.searchParams.set('X-Amz-Expires', String(Math.max(1, Math.floor(ttlMs / 1000))));
      const datetime = new Date(at).toISOString().replace(/[:-]|\.\d{3}/g, '');
      const signed = await client.sign(url.toString(), { method: 'GET', aws: { signQuery: true, datetime } });
      return { url: signed.url, expiresAt: at + ttlMs };
    },
  };
  return store;
}
