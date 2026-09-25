import { CODE_TTL_MS } from './recovery.ts';
import type { CodePurpose } from './store.ts';

/**
 * The one email Vesper sends (ADR-0050): a six-digit code, to confirm a recovery address
 * or to recover with it. Plain text only — no HTML, so no tracking pixel; no link, so
 * nothing to click in a message that could be a copy. The code, when it expires, and
 * what to do if you did not ask for it.
 *
 * Like `Push`, the sender is injected: Resend in production, a recording one for the
 * tests and for `npm run dev`, which prints the code instead of sending it.
 */

export type MailLocale = 'es' | 'en';

export type RecoveryMail = {
  to: string;
  code: string;
  purpose: CodePurpose;
  locale: MailLocale;
};

export type Mailer = {
  /** Resolves once the provider took the message; rejects when it did not. */
  send(mail: RecoveryMail): Promise<void>;
};

/** What the phone sends as its language; anything but English reads as Spanish. */
export function localeOf(value: unknown): MailLocale {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith('en') ? 'en' : 'es';
}

const MINUTES = Math.round(CODE_TTL_MS / 60_000);

/**
 * The words, in the phone's language. Spanish in neutral tú and sentence case, English
 * in the same plain voice: no exclamation marks, no "Let's", nothing to sell.
 */
export function composeRecoveryMail(mail: Pick<RecoveryMail, 'code' | 'purpose' | 'locale'>): {
  subject: string;
  text: string;
} {
  if (mail.locale === 'en') {
    const lead =
      mail.purpose === 'verify'
        ? 'Your code to confirm this email in Vesper is:'
        : 'Your code to recover your Vesper is:';
    return {
      subject: `Your Vesper code: ${mail.code}`,
      text: [
        lead,
        '',
        mail.code,
        '',
        `It expires in ${MINUTES} minutes.`,
        '',
        "If you didn't ask for it, ignore this email.",
      ].join('\n'),
    };
  }
  const lead =
    mail.purpose === 'verify'
      ? 'Tu código para confirmar este correo en Vesper es:'
      : 'Tu código para recuperar tu Vesper es:';
  return {
    subject: `Tu código de Vesper: ${mail.code}`,
    text: [
      lead,
      '',
      mail.code,
      '',
      `Vence en ${MINUTES} minutos.`,
      '',
      'Si no lo pediste, ignora este correo.',
    ].join('\n'),
  };
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
/** A code that arrives a minute late is still good; a request that hangs is not. */
const RESEND_TIMEOUT_MS = 10_000;

/**
 * Resend's `POST /emails`: `{ from, to: [email], subject, text }` with the API key as a
 * bearer token. `from` is `RECOVERY_FROM`, an address on a domain verified in Resend
 * (ADR-0050 §7). Open and click tracking are Resend settings per domain; neither can
 * touch a text-only message with no links.
 */
export function createResendMailer(options: {
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
}): Mailer {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async send(mail) {
      const { subject, text } = composeRecoveryMail(mail);
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ from: options.from, to: [mail.to], subject, text }),
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      });
      if (!response.ok) {
        // The status and nothing else: the body can echo the address back.
        throw new Error(`resend answered ${response.status}`);
      }
    },
  };
}

/**
 * For the tests and for running with no network: keeps every message instead of sending
 * it, and hands each one to `print` when there is one — `npm run dev` passes
 * `console.log`, so the code shows up in the terminal.
 */
export function createRecordingMailer(
  print?: (line: string) => void,
): Mailer & { sent: RecoveryMail[] } {
  const sent: RecoveryMail[] = [];
  return {
    sent,
    async send(mail) {
      sent.push(mail);
      print?.(`recovery code for ${mail.to}: ${mail.code}`);
    },
  };
}
