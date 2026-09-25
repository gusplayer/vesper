import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useIdentityStore } from '../../data/identity';
import { Button, FieldRow, ListGroup, ListRow, PageHeader, Screen, Stack, StatusNote, Text } from '../../design/components';
import { refreshRecoveryAccount, setRecoveryEmail, useRecoveryAccount } from '../../features/recovery/recoveryAccount';
import { recoveryErrorLine } from '../../features/recovery/recoveryState';
import { useLocale, useStrings } from '../../i18n';
import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { loadIdentity } from '../../platform/identity';
import {
  CODE_LENGTH,
  cleanEmail,
  isValidCode,
  isValidEmail,
  removeRecoveryEmail,
  sendRecoveryCode,
  verifyRecoveryCode,
  type RecoveryFailure,
} from '../../platform/recoveryApi';

type Busy = 'send' | 'confirm' | 'remove' | null;

/**
 * Ajustes › Respaldo › Correo de recuperación (ADR-0050 §1): optional, and its price said
 * first, in one line — with an email Vesper can give the key back, so the backup is no
 * longer closed to the person alone.
 *
 * Three states, one primary each, pinned at the bottom:
 *
 * - **No email**: the field, and "Enviar código".
 * - **Code sent**: the six digits, "Confirmar", and a ghost to use another email.
 * - **Confirmed**: the email, "Cambiar el correo", and a ghost "Quitar el correo" that
 *   asks first, because it deletes the copy of the key.
 *
 * Every refusal is a sentence under the field (rule 8): a malformed email, a wrong or
 * expired code, too many attempts, no connection, not available yet (503), no identity
 * yet, and a key the server no longer takes (§10).
 */
export default function RecoveryEmailScreen() {
  const router = useRouter();
  const strings = useStrings();
  const t = strings.backup.recoveryEmail;
  const errors = strings.identity.recoveryErrors;
  const { locale } = useLocale();
  const identityId = useIdentityStore((s) => s.id);
  const account = useRecoveryAccount();
  const mine = account.id === identityId;
  const view = mine ? account.view : ({ state: 'loading' } as const);
  const known = mine ? account.email : undefined;

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<'done' | 'removed' | null>(null);

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    void refreshRecoveryAccount();
  }, [identityId]);

  const blocked =
    view.state === 'noIdentity'
      ? errors.noIdentity
      : view.state === 'noKey'
        ? errors.noKey
        : view.state === 'rejected'
          ? errors.keyRejected
          : null;
  const loading = view.state === 'loading' && known === undefined;
  const mode: 'enter' | 'code' | 'confirmed' =
    sentTo !== null ? 'code' : typeof known === 'string' && !editing ? 'confirmed' : 'enter';

  /** The key to sign with, or null with the sentence said. */
  const credentials = async () => {
    const found = await loadIdentity();
    if (found === null && mounted.current) {
      setError(errors.noKey);
    }
    return found;
  };

  const fail = (failure: RecoveryFailure) => {
    if (failure.kind === 'unauthorized') {
      // Left behind: the account view says so, and Ajustes › Respaldo offers the way out.
      void refreshRecoveryAccount();
    }
    if (mounted.current) {
      setError(recoveryErrorLine(failure, errors));
    }
  };

  const send = () => {
    setNote(null);
    if (!isValidEmail(email)) {
      setError(errors.badEmail);
      return;
    }
    setError(null);
    setBusy('send');
    void (async () => {
      const signer = await credentials();
      const result = signer === null ? null : await sendRecoveryCode(signer, email, locale);
      if (!mounted.current) {
        return;
      }
      setBusy(null);
      if (result === null) {
        return;
      }
      if (!result.ok) {
        fail(result.failure);
        return;
      }
      setSentTo(cleanEmail(email));
      setCode('');
    })();
  };

  const confirm = () => {
    if (sentTo === null) {
      return;
    }
    setError(null);
    setBusy('confirm');
    void (async () => {
      const signer = await credentials();
      const result = signer === null ? null : await verifyRecoveryCode(signer, code);
      if (!mounted.current) {
        return;
      }
      setBusy(null);
      if (signer === null || result === null) {
        return;
      }
      if (!result.ok) {
        fail(result.failure);
        return;
      }
      setRecoveryEmail(signer.id, result.value.email ?? sentTo);
      setSentTo(null);
      setEditing(false);
      setCode('');
      setNote('done');
    })();
  };

  const remove = () => {
    Alert.alert(t.removeQuestion, t.removeMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.removeConfirm,
        style: 'destructive',
        onPress: () => {
          setError(null);
          setNote(null);
          setBusy('remove');
          void (async () => {
            const signer = await credentials();
            const result = signer === null ? null : await removeRecoveryEmail(signer);
            if (!mounted.current) {
              return;
            }
            setBusy(null);
            if (signer === null || result === null) {
              return;
            }
            if (!result.ok) {
              fail(result.failure);
              return;
            }
            setRecoveryEmail(signer.id, null);
            setEditing(false);
            setEmail('');
            setNote('removed');
          })();
        },
      },
    ]);
  };

  const otherEmail = () => {
    setSentTo(null);
    setCode('');
    setError(null);
  };

  const change = () => {
    setEditing(true);
    setNote(null);
    setError(null);
    setEmail(typeof known === 'string' ? known : '');
  };

  let footer;
  if (mode === 'code') {
    footer = (
      <>
        <Button
          label={t.confirm}
          busyLabel={t.confirming}
          busy={busy === 'confirm'}
          onPress={confirm}
          disabled={busy !== null || !isValidCode(code)}
        />
        <Button label={t.otherEmail} variant="ghost" onPress={otherEmail} disabled={busy !== null} />
      </>
    );
  } else if (mode === 'confirmed') {
    footer = (
      <>
        <Button label={t.change} onPress={change} disabled={busy !== null || blocked !== null} />
        <Button
          label={t.remove}
          busyLabel={t.removing}
          busy={busy === 'remove'}
          variant="ghost"
          tone="danger"
          onPress={remove}
          disabled={busy !== null || blocked !== null}
        />
      </>
    );
  } else {
    footer = (
      <Button
        label={t.send}
        busyLabel={t.sending}
        busy={busy === 'send'}
        onPress={send}
        disabled={busy !== null || blocked !== null || loading || email.trim() === ''}
      />
    );
  }

  return (
    <Screen scroll avoidKeyboard footer={footer}>
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.settings)} title={t.title} />

      <Text variant="body" tone="secondary">
        {t.price}
      </Text>

      {mode === 'confirmed' && typeof known === 'string' ? (
        <ListGroup title={t.confirmedTitle} footer={t.confirmedNote}>
          <ListRow icon="mail" label={known} />
        </ListGroup>
      ) : null}

      {mode === 'enter' ? (
        <Stack gap="sm">
          <FieldRow
            label={t.emailLabel}
            value={email}
            onChangeText={(next) => {
              setEmail(next);
              setError(null);
            }}
            placeholder={t.emailPlaceholder}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="send"
            onSubmitEditing={send}
            editable={blocked === null}
            autoFocus={editing}
          />
          <StatusNote text={t.body} />
        </Stack>
      ) : null}

      {mode === 'code' && sentTo !== null ? (
        <Stack gap="sm">
          <StatusNote text={t.codeSent(sentTo)} live />
          <FieldRow
            label={t.codeLabel}
            value={code}
            onChangeText={(next) => {
              setCode(next);
              setError(null);
            }}
            placeholder={t.codePlaceholder}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={CODE_LENGTH}
            autoFocus
          />
        </Stack>
      ) : null}

      {error !== null ? <StatusNote text={error} tone="danger" live /> : null}
      {note === 'done' ? <StatusNote text={t.done} live /> : null}
      {note === 'removed' ? <StatusNote text={t.removed} live /> : null}
      {blocked !== null ? <StatusNote text={blocked} tone="danger" live /> : null}
      {loading && blocked === null ? <StatusNote text={t.loading} /> : null}
      {view.state === 'unknown' && known === undefined && mode === 'enter' ? <StatusNote text={t.unknown} /> : null}
    </Screen>
  );
}
