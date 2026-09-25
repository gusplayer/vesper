import { describe, expect, it } from 'vitest';

import { composeRecoveryMail, createRecordingMailer, createResendMailer, localeOf } from './mailer.ts';

/**
 * The one message Vesper sends (ADR-0050 §7). These drive the real Resend sender with a
 * fake `fetch`, so they fail on the request that would leave, and nothing is sent.
 */

type Captured = { url: string; init: RequestInit };

function fakeFetch(status = 200): { fetchImpl: typeof fetch; captured: Captured[] } {
  const captured: Captured[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ id: 'x' }), { status });
  }) as typeof fetch;
  return { fetchImpl, captured };
}

describe('the Resend sender', () => {
  it('posts from, to, subject and text to Resend, with the key as a bearer token', async () => {
    const { fetchImpl, captured } = fakeFetch();
    const mailer = createResendMailer({ apiKey: 're_test', from: 'Vesper <codigo@vesper.example>', fetchImpl });

    await mailer.send({ to: 'gus@example.com', code: '012345', purpose: 'recover', locale: 'es' });

    expect(captured).toHaveLength(1);
    const [request] = captured;
    expect(request?.url).toBe('https://api.resend.com/emails');
    expect(request?.init.method).toBe('POST');
    expect(request?.init.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer re_test', 'content-type': 'application/json' }),
    );
    const body = JSON.parse(String(request?.init.body));
    expect(Object.keys(body).sort()).toEqual(['from', 'subject', 'text', 'to']);
    expect(body).toEqual({
      from: 'Vesper <codigo@vesper.example>',
      to: ['gus@example.com'],
      subject: 'Tu código de Vesper: 012345',
      text: expect.stringContaining('012345'),
    });
  });

  it('fails when Resend does not take the message', async () => {
    const { fetchImpl } = fakeFetch(403);
    const mailer = createResendMailer({ apiKey: 're_test', from: 'codigo@vesper.example', fetchImpl });

    await expect(
      mailer.send({ to: 'gus@example.com', code: '012345', purpose: 'verify', locale: 'es' }),
    ).rejects.toThrow('resend answered 403');
  });
});

describe('the words', () => {
  it('say the code, when it expires and what to do if you did not ask, in Spanish', () => {
    const verify = composeRecoveryMail({ code: '123456', purpose: 'verify', locale: 'es' });
    const recover = composeRecoveryMail({ code: '123456', purpose: 'recover', locale: 'es' });

    expect(verify.subject).toBe('Tu código de Vesper: 123456');
    expect(verify.text).toBe(
      'Tu código para confirmar este correo en Vesper es:\n\n123456\n\nVence en 10 minutos.\n\nSi no lo pediste, ignora este correo.',
    );
    expect(recover.text.startsWith('Tu código para recuperar tu Vesper es:')).toBe(true);
  });

  it('say the same in English, in the same plain voice', () => {
    const verify = composeRecoveryMail({ code: '123456', purpose: 'verify', locale: 'en' });
    const recover = composeRecoveryMail({ code: '123456', purpose: 'recover', locale: 'en' });

    expect(verify.subject).toBe('Your Vesper code: 123456');
    expect(verify.text).toBe(
      "Your code to confirm this email in Vesper is:\n\n123456\n\nIt expires in 10 minutes.\n\nIf you didn't ask for it, ignore this email.",
    );
    expect(recover.text.startsWith('Your code to recover your Vesper is:')).toBe(true);
  });

  it('carry no link, no markup and nothing shouted', () => {
    for (const locale of ['es', 'en'] as const) {
      for (const purpose of ['verify', 'recover'] as const) {
        const { subject, text } = composeRecoveryMail({ code: '123456', purpose, locale });
        for (const words of [subject, text]) {
          expect(words).not.toMatch(/https?:|www\.|<[a-z]|!/i);
        }
      }
    }
  });

  it('follow the phone: English for English, Spanish for everything else', () => {
    expect(localeOf('en')).toBe('en');
    expect(localeOf('en-US')).toBe('en');
    expect(localeOf('es')).toBe('es');
    expect(localeOf('pt')).toBe('es');
    expect(localeOf(undefined)).toBe('es');
  });
});

describe('the recording sender', () => {
  it('keeps the message and prints the code for local development', async () => {
    const lines: string[] = [];
    const mailer = createRecordingMailer((line) => lines.push(line));

    await mailer.send({ to: 'gus@example.com', code: '654321', purpose: 'recover', locale: 'es' });

    expect(mailer.sent).toEqual([{ to: 'gus@example.com', code: '654321', purpose: 'recover', locale: 'es' }]);
    expect(lines).toEqual(['recovery code for gus@example.com: 654321']);
  });
});
