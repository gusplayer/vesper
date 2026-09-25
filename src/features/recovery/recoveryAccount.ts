import { create } from 'zustand';

import { noteKeyRejected, readIdentity } from '../../data/identity';
import { getAccount, type ApiFailure } from '../../platform/circleApi';
import { loadIdentity } from '../../platform/identity';

/**
 * What the server says about this install's own account, for Ajustes › Respaldo and
 * Correo de recuperación (ADR-0050): the recovery email, and whether the key still
 * works. In memory only: the email is the server's to say, and a copy on the phone
 * would be one more thing that can be wrong after another device changes it.
 *
 * - `loading`: being asked. What was known before stays in `email` meanwhile.
 * - `noIdentity`: not registered yet; `noKey`: registered, and the key is not here.
 * - `rejected`: the server refused the key (401): left behind (§10).
 * - `unknown`: nobody answered, or the server failed.
 * - `known`: `email` is the recovery email, or null when there is none.
 */
export type AccountView =
  | { state: 'loading' }
  | { state: 'noIdentity' }
  | { state: 'noKey' }
  | { state: 'rejected' }
  | { state: 'unknown'; failure: ApiFailure }
  | { state: 'known'; email: string | null };

type RecoveryAccountState = {
  /** The identity this view is about. A view of another id is not shown. */
  id: string | null;
  view: AccountView;
  /** The email as last known for `id`; undefined while it never was. */
  email: string | null | undefined;
};

export const useRecoveryAccount = create<RecoveryAccountState>(() => ({
  id: null,
  view: { state: 'loading' },
  email: undefined,
}));

function settle(id: string | null, view: AccountView): AccountView {
  const before = useRecoveryAccount.getState();
  const email = view.state === 'known' ? view.email : before.id === id ? before.email : undefined;
  useRecoveryAccount.setState({ id, view, email });
  return view;
}

let asking: Promise<AccountView> | null = null;

/** Asks the server again. One question at a time; never throws. */
export function refreshRecoveryAccount(): Promise<AccountView> {
  if (asking !== null) {
    return asking;
  }
  const run = ask()
    .catch((): AccountView => ({ state: 'unknown', failure: { kind: 'offline' } }))
    .finally(() => {
      asking = null;
    });
  asking = run;
  return run;
}

async function ask(): Promise<AccountView> {
  const record = readIdentity();
  if (record === null || record.registeredAt === null) {
    return settle(record?.id ?? null, { state: 'noIdentity' });
  }
  const credentials = await loadIdentity();
  if (credentials === null) {
    return settle(record.id, { state: 'noKey' });
  }
  const before = useRecoveryAccount.getState();
  useRecoveryAccount.setState({
    id: record.id,
    view: { state: 'loading' },
    email: before.id === record.id ? before.email : undefined,
  });
  const account = await getAccount(credentials);
  if (account.ok) {
    return settle(record.id, { state: 'known', email: account.value.recoveryEmail });
  }
  if (account.failure.kind === 'unauthorized') {
    noteKeyRejected(record.id);
    return settle(record.id, { state: 'rejected' });
  }
  return settle(record.id, { state: 'unknown', failure: account.failure });
}

/** The email the server just confirmed, or null once it was removed. */
export function setRecoveryEmail(id: string, email: string | null): void {
  useRecoveryAccount.setState({ id, view: { state: 'known', email }, email });
}
