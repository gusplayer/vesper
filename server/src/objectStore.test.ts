import { describe, expect, it } from 'vitest';

import {
  bucketConfigFrom,
  createMemoryObjectStore,
  createS3ObjectStore,
  type BucketConfig,
} from './objectStore.ts';

/**
 * The bucket. The memory store is what the API tests run on; the S3 one is driven here
 * with a fake `fetch`, so what is checked is the request it would send — and its presigned
 * URL against the example in AWS's own documentation, byte for byte.
 */

const bytes = (text: string) => new TextEncoder().encode(text);

describe('the memory store', () => {
  it('keeps, copies, lists and deletes', async () => {
    const store = createMemoryObjectStore(() => 0);
    await store.put('m/a/1/thumb', bytes('t'));
    await store.put('m/a/1/full', bytes('f'));
    await store.put('m/b/2/thumb', bytes('x'));

    expect(await store.copy('m/a/1/thumb', 'r/9/thumb')).toBe(true);
    expect(await store.copy('m/a/404/thumb', 'r/9/full')).toBe(false);
    expect(await store.list('m/a/')).toEqual(['m/a/1/full', 'm/a/1/thumb']);
    expect(await store.deletePrefix('m/a/')).toBe(2);
    expect(await store.get('m/a/1/thumb')).toBeNull();
    expect(new TextDecoder().decode((await store.get('r/9/thumb')) ?? new Uint8Array())).toBe('t');
  });

  it('serves its own URLs for five minutes, and not a moment more', async () => {
    let clock = 1_000;
    const store = createMemoryObjectStore(() => clock);
    await store.put('m/a/1/thumb', bytes('t'));

    const signed = await store.presign('m/a/1/thumb', 5 * 60_000, 'http://localhost:8788');
    const token = signed.url.split('/').pop() ?? '';

    expect(signed.url).toMatch(/^http:\/\/localhost:8788\/media-local\/[A-Za-z0-9_-]{43}$/);
    expect(signed.expiresAt).toBe(1_000 + 5 * 60_000);
    expect(store.readLocal?.(token)).toEqual(bytes('t'));
    clock += 5 * 60_000;
    expect(store.readLocal?.(token)).toBeNull();
    expect(store.readLocal?.('made-up')).toBeNull();
  });
});

describe('the bucket’s variables', () => {
  it('reads what a Railway Bucket’s AWS SDK preset injects', () => {
    const found = bucketConfigFrom({
      AWS_ENDPOINT_URL: 'https://t3.storageapi.dev/',
      AWS_DEFAULT_REGION: 'auto',
      AWS_S3_BUCKET_NAME: 'vesper-photos-x1y2',
      AWS_ACCESS_KEY_ID: 'tid_key',
      AWS_SECRET_ACCESS_KEY: 'tsec_secret',
      AWS_S3_URL_STYLE: 'virtual-hosted',
      MEDIA_PREFIX: 'staging',
    });

    expect(found).toEqual({
      config: {
        endpoint: 'https://t3.storageapi.dev',
        region: 'auto',
        bucket: 'vesper-photos-x1y2',
        accessKeyId: 'tid_key',
        secretAccessKey: 'tsec_secret',
        pathStyle: false,
        prefix: 'staging/',
      },
    });
  });

  it('names what is missing, and never a value', () => {
    expect(bucketConfigFrom({ AWS_ACCESS_KEY_ID: 'tid_key', AWS_S3_BUCKET_NAME: ' ' })).toEqual({
      missing: ['AWS_ENDPOINT_URL', 'AWS_S3_BUCKET_NAME', 'AWS_SECRET_ACCESS_KEY'],
    });
  });

  it('takes path-style when the bucket asks for it, and region auto by default', () => {
    const found = bucketConfigFrom({
      AWS_ENDPOINT_URL: 'http://localhost:9000',
      AWS_S3_BUCKET_NAME: 'photos',
      AWS_ACCESS_KEY_ID: 'minio',
      AWS_SECRET_ACCESS_KEY: 'minio123',
      AWS_S3_URL_STYLE: 'path',
    });

    expect(found).toEqual({ config: expect.objectContaining({ pathStyle: true, region: 'auto', prefix: '' }) });
  });
});

/** A fetch that records what it was asked and answers from a list. */
function fakeFetch(answers: Response[]) {
  const requests: Request[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    requests.push(input as Request);
    return answers.shift() ?? new Response(null, { status: 200 });
  }) as typeof fetch;
  return { requests, fetcher };
}

const TIGRIS: BucketConfig = {
  endpoint: 'https://t3.storageapi.dev',
  region: 'auto',
  bucket: 'vesper-photos',
  accessKeyId: 'tid_key',
  secretAccessKey: 'tsec_secret',
  pathStyle: false,
  prefix: '',
};

describe('the S3 store', () => {
  it('signs a presigned URL exactly as AWS documents it', async () => {
    // "Authenticating Requests: Using Query Parameters (AWS Signature Version 4)", the
    // GET example: examplebucket/test.txt, 24 May 2013, 86400 seconds.
    const store = createS3ObjectStore(
      {
        endpoint: 'https://s3.amazonaws.com',
        region: 'us-east-1',
        bucket: 'examplebucket',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        pathStyle: false,
        prefix: '',
      },
      fakeFetch([]).fetcher,
      () => Date.UTC(2013, 4, 24),
    );

    const signed = await store.presign('test.txt', 86_400_000, 'ignored');
    const url = new URL(signed.url);

    expect(url.host).toBe('examplebucket.s3.amazonaws.com');
    expect(url.pathname).toBe('/test.txt');
    expect(url.searchParams.get('X-Amz-Credential')).toBe('AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(url.searchParams.get('X-Amz-Signature')).toBe(
      'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });

  it('presigns for five minutes on Tigris, virtual-hosted and in region auto', async () => {
    const store = createS3ObjectStore(TIGRIS, fakeFetch([]).fetcher, () => Date.UTC(2026, 8, 26, 12));

    const signed = await store.presign('m/gus/photo/thumb', 5 * 60_000, 'ignored');
    const url = new URL(signed.url);

    expect(url.origin).toBe('https://vesper-photos.t3.storageapi.dev');
    expect(url.pathname).toBe('/m/gus/photo/thumb');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Credential')).toBe('tid_key/20260926/auto/s3/aws4_request');
    expect(signed.expiresAt).toBe(Date.UTC(2026, 8, 26, 12) + 5 * 60_000);
  });

  it('puts, gets, copies and deletes with signed requests, path-style when asked', async () => {
    const { requests, fetcher } = fakeFetch([
      new Response(null, { status: 200 }),
      new Response(bytes('sealed'), { status: 200 }),
      new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 }),
      new Response('<CopyObjectResult></CopyObjectResult>', { status: 200 }),
      new Response(null, { status: 204 }),
    ]);
    const store = createS3ObjectStore({ ...TIGRIS, pathStyle: true, prefix: 'staging/' }, fetcher);

    await store.put('m/a/1/thumb', bytes('sealed'));
    const got = await store.get('m/a/1/thumb');
    const missing = await store.get('m/a/2/thumb');
    const copied = await store.copy('m/a/1/thumb', 'r/9/thumb');
    await store.delete(['m/a/1/thumb']);

    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'PUT https://t3.storageapi.dev/vesper-photos/staging/m/a/1/thumb',
      'GET https://t3.storageapi.dev/vesper-photos/staging/m/a/1/thumb',
      'GET https://t3.storageapi.dev/vesper-photos/staging/m/a/2/thumb',
      'PUT https://t3.storageapi.dev/vesper-photos/staging/r/9/thumb',
      'DELETE https://t3.storageapi.dev/vesper-photos/staging/m/a/1/thumb',
    ]);
    expect(requests.every((request) => request.headers.get('Authorization')?.startsWith('AWS4-HMAC-SHA256 '))).toBe(true);
    expect(requests[3]?.headers.get('x-amz-copy-source')).toBe('/vesper-photos/staging/m/a/1/thumb');
    expect(new TextDecoder().decode(got ?? new Uint8Array())).toBe('sealed');
    expect(missing).toBeNull();
    expect(copied).toBe(true);
  });

  it('lists every page, and hands keys back without the prefix', async () => {
    const page = (keys: string[], next: string | null) =>
      new Response(
        `<?xml version="1.0"?><ListBucketResult>${keys.map((key) => `<Contents><Key>${key}</Key></Contents>`).join('')}<IsTruncated>${next !== null}</IsTruncated>${next === null ? '' : `<NextContinuationToken>${next}</NextContinuationToken>`}</ListBucketResult>`,
        { status: 200 },
      );
    const { requests, fetcher } = fakeFetch([
      page(['staging/m/a/1/thumb', 'staging/m/a/1/full'], 'tok&amp;2'),
      page(['staging/m/b/2/thumb'], null),
    ]);
    const store = createS3ObjectStore({ ...TIGRIS, prefix: 'staging/' }, fetcher);

    const keys = await store.list('m/');

    expect(keys).toEqual(['m/a/1/thumb', 'm/a/1/full', 'm/b/2/thumb']);
    expect(new URL(requests[0]?.url ?? '').searchParams.get('prefix')).toBe('staging/m/');
    expect(new URL(requests[1]?.url ?? '').searchParams.get('continuation-token')).toBe('tok&2');
  });

  it('says what failed, without the body it sent', async () => {
    const { fetcher } = fakeFetch([new Response('<Error><Code>AccessDenied</Code></Error>', { status: 403 })]);
    const store = createS3ObjectStore(TIGRIS, fetcher);

    await expect(store.put('m/a/1/thumb', bytes('sealed'))).rejects.toThrow(/bucket put failed: 403/);
  });
});
