import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useSettings } from '../../data';
import { Button, FieldRow, PageHeader, Screen, Stack, StatusNote, Text } from '../../design/components';
import { recoveryErrorLine } from '../../features/recovery/recoveryState';
import { useRestoreTarget } from '../../features/restore/restoreTarget';
import { useLocale, useStrings } from '../../i18n';
import { goBack } from '../../lib/goBack';
import {
  CODE_LENGTH,
  cleanEmail,
  finishRecovery,
  isValidCode,
  isValidEmail,
  startRecovery,
  type RecoveryFailure,
} from '../../platform/recoveryApi';

/**
 * "Recuperar con mi correo" (ADR-0050 §3), from "Tengo una clave": the recovery email,
 * a six-digit code, and the server hands the key back. From there it is the restore of
 * the backup key, exactly: the key travels to the restoring screen in memory
 * (`useRestoreTarget`), never in the route, and that screen tests it, opens the backup,
 * rotates the secret and brings the circle back.
 *
 * Nothing here says whether an email has a Vesper (§4). Asking for a code always
 * answers the same, so the line after it is conditional ("Si ese correo tiene un Vesper,
 * te llegó un código"), and a wrong code and an email with no Vesper read alike.
 *
 * Like restore/key, the route belongs to neither world (src/app/_layout.tsx).
 */
export default function RestoreEmailScreen() {
  const router = useRouter();
  const t = useStrings();
  const copy = t.identity.email;
  const errors = t.identity.recoveryErrors;
  const { locale } = useLocale();
  const settings = useSettings();
  const setTarget = useRestoreTarget((state) => state.setTarget);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<RecoveryFailure | null>(null);

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const send = () => {
    if (!isValidEmail(email)) {
      setFailure({ kind: 'badEmail' });
      return;
    }
    setFailure(null);
    setBusy(true);
    void startRecovery(email, locale).then((result) => {
      if (!mounted.current) {
        return;
      }
      setBusy(false);
      if (!result.ok) {
        setFailure(result.failure);
        return;
      }
      setSentTo(cleanEmail(email));
      setCode('');
    });
  };

  const recover = () => {
    if (sentTo === null) {
      return;
    }
    setFailure(null);
    setBusy(true);
    void finishRecovery(sentTo, code).then((result) => {
      if (!mounted.current) {
        return;
      }
      setBusy(false);
      if (!result.ok) {
        setFailure(result.failure);
        return;
      }
      setTarget(result.value);
      router.push('/restore/restoring');
    });
  };

  const otherEmail = () => {
    setSentTo(null);
    setCode('');
    setFailure(null);
  };

  // The email can no longer bring the key back (the server lost its escrow key): the
  // backup key is the only way left, and the ghost leads there instead.
  const escrowGone = failure?.kind === 'escrowUnreadable';

  const footer =
    sentTo === null ? (
      <Button
        label={copy.send}
        busyLabel={copy.sending}
        busy={busy}
        onPress={send}
        disabled={busy || email.trim() === ''}
      />
    ) : (
      <>
        <Button
          label={copy.recover}
          busyLabel={copy.recovering}
          busy={busy}
          onPress={recover}
          disabled={busy || !isValidCode(code)}
        />
        {escrowGone ? (
          <Button label={t.identity.welcome.haveKey} variant="ghost" onPress={() => router.replace('/restore/key')} />
        ) : (
          <Button label={copy.otherEmail} variant="ghost" onPress={otherEmail} disabled={busy} />
        )}
      </>
    );

  return (
    <Screen scroll avoidKeyboard footer={footer}>
      <PageHeader onBack={() => goBack(router)} title={copy.title} />
      <Text variant="body" tone="secondary">
        {copy.body}
      </Text>
      {sentTo === null ? (
        <FieldRow
          label={copy.emailLabel}
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            setFailure(null);
          }}
          placeholder={copy.emailPlaceholder}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="send"
          onSubmitEditing={send}
          autoFocus
        />
      ) : (
        <Stack gap="sm">
          <StatusNote text={copy.sent(sentTo)} live />
          <FieldRow
            label={copy.codeLabel}
            value={code}
            onChangeText={(next) => {
              setCode(next);
              setFailure(null);
            }}
            placeholder={copy.codePlaceholder}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={CODE_LENGTH}
            autoFocus
          />
        </Stack>
      )}
      {failure !== null ? <StatusNote text={recoveryErrorLine(failure, errors)} tone="danger" live /> : null}
      {settings.onboardingDone ? <StatusNote text={copy.replaces} /> : null}
    </Screen>
  );
}
