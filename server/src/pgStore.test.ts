import { describe, expect, it } from 'vitest';

import { tlsFor, withoutSslParams } from './pgStore.ts';

/**
 * The connection to Postgres, and the one thing it must never do: accept a certificate
 * without checking it. What is tested here is the decision, not the socket — the socket
 * is checked by running the server against a real database.
 */
describe('the database connection', () => {
  it('verifies the certificate everywhere but on this machine', () => {
    expect(tlsFor('ep-snowy-lake-14790843.us-east-1.aws.neon.tech', undefined)).toBe(true);
    expect(tlsFor('localhost', undefined)).toBe(false);
    expect(tlsFor('127.0.0.1', undefined)).toBe(false);
    expect(tlsFor('::1', undefined)).toBe(false);
  });

  it('trusts a private CA alone when one is given', () => {
    // Trimmed: an environment variable almost always arrives with a newline on the end.
    expect(tlsFor('db.internal', '-----BEGIN CERTIFICATE-----\nx\n')).toEqual({
      ca: '-----BEGIN CERTIFICATE-----\nx',
    });
    // An empty variable is not a certificate; it must not read as "no TLS either".
    expect(tlsFor('db.internal', '   ')).toBe(true);
  });

  it('drops the ssl parameters the URL carries, and nothing else', () => {
    const neon =
      'postgresql://neondb_owner:npg_Ab3%2FxY@ep-snowy-lake.aws.neon.tech/neondb?sslmode=no-verify&channel_binding=require';

    const { url, hostname } = withoutSslParams(neon);

    expect(hostname).toBe('ep-snowy-lake.aws.neon.tech');
    expect(url).toBe(
      'postgresql://neondb_owner:npg_Ab3%2FxY@ep-snowy-lake.aws.neon.tech/neondb?channel_binding=require',
    );
  });

  it('leaves the password exactly as it arrived', () => {
    // Anything that re-encodes this is an outage: the password is what it is.
    const url = 'postgresql://user:p%40ss%2Fw%3Frd@host.example/db?sslmode=require&sslrootcert=/x';

    expect(withoutSslParams(url).url).toBe('postgresql://user:p%40ss%2Fw%3Frd@host.example/db');
  });

  it('leaves a URL without a query alone', () => {
    expect(withoutSslParams('postgres://localhost:5432/vesper')).toEqual({
      url: 'postgres://localhost:5432/vesper',
      hostname: 'localhost',
    });
  });
});
