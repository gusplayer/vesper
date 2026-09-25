import type { Strings } from '../../i18n';
import type { BackupError } from '../../platform/backup';
import type { RecoveryFailure } from '../../platform/recoveryApi';

/**
 * The decisions of the recovery email and of a device left behind (ADR-0050), pure so
 * vitest can hold them: which sentence a refusal is, and when Ajustes › Respaldo says
 * this device's key stopped working.
 */

/**
 * A refusal of the recovery routes, as the one sentence it is (rule 8). A 404 is a server
 * deployed before these routes existed: to the person that is the same fact as the
 * server's own "email not configured" — not available yet.
 */
export function recoveryErrorLine(failure: RecoveryFailure, copy: Strings['identity']['recoveryErrors']): string {
  switch (failure.kind) {
    case 'badEmail':
      return copy.badEmail;
    case 'wrongCode':
      return copy.wrongCode;
    case 'codeExpired':
      return copy.codeExpired;
    case 'rateLimited':
      return copy.tooMany;
    case 'tooManyAttempts':
      return copy.tooManyAttempts;
    case 'notSent':
      return copy.notSent;
    case 'escrowUnreadable':
      return copy.escrowUnreadable;
    case 'offline':
      return copy.offline;
    case 'notConfigured':
    case 'notFound':
      return copy.notConfigured;
    case 'unauthorized':
      return copy.keyRejected;
    default:
      return copy.server;
  }
}

/**
 * Whether this device was left behind (ADR-0050 §10): registered, holding its key, and
 * the server refusing that key — said by a call this launch made, or by the last backup
 * attempt, which is what outlives a restart. A key that is not here at all is the other
 * case (ADR-0048: the data came, the key did not), with its own sentence.
 */
export function isLeftBehind(facts: {
  registered: boolean;
  keyFound: boolean;
  keyRejected: boolean;
  lastError: BackupError | string | null;
}): boolean {
  return facts.registered && facts.keyFound && (facts.keyRejected || facts.lastError === 'unauthorized');
}

/**
 * The value of the row "Correo de recuperación": the email, "Ninguno", or nothing while
 * it is not known (no connection, or the account is being asked).
 */
export function recoveryRowValue(email: string | null | undefined, none: string): string | undefined {
  if (email === undefined) {
    return undefined;
  }
  return email ?? none;
}
