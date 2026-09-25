import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useSettings } from '../../data';
import { Button, FieldRow, ListGroup, ListRow, PageHeader, Screen, StatusNote, Text } from '../../design/components';
import { useRestoreTarget } from '../../features/restore/restoreTarget';
import { useStrings } from '../../i18n';
import { goBack } from '../../lib/goBack';
import { credentialsFromPastedKey } from '../../platform/circleApi';

/**
 * "Tengo una clave" (ADR-0048 §4): the backup key, pasted. It is the path that crosses
 * between iPhone and Android, and the one for a key kept in a password manager.
 *
 * The key is checked for shape here, before any request: with or without the spaces of
 * the groups Ajustes shows, a key that is not an id and a secret is said on the screen
 * and nothing goes out. The key then travels to the restoring screen in memory, never
 * in the route.
 *
 * The route belongs to neither world (src/app/_layout.tsx): the welcome screen opens it
 * during the onboarding, and it works the same from the app. From the app, the screen
 * says that restoring replaces what is on this phone.
 *
 * Without the key, a row leads to the recovery email (ADR-0050 §3): a code to the email
 * the person confirmed, and the server hands the key back.
 */
export default function RestoreKeyScreen() {
  const router = useRouter();
  const t = useStrings();
  const copy = t.identity.key;
  const settings = useSettings();
  const setTarget = useRestoreTarget((state) => state.setTarget);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = () => {
    const credentials = credentialsFromPastedKey(text);
    if (credentials === null) {
      setInvalid(true);
      return;
    }
    setTarget(credentials);
    router.push('/restore/restoring');
  };

  return (
    <Screen
      scroll
      avoidKeyboard
      footer={<Button label={copy.restore} onPress={submit} disabled={text.trim() === ''} />}
    >
      <PageHeader onBack={() => goBack(router)} title={copy.title} />
      <Text variant="body" tone="secondary">
        {copy.body}
      </Text>
      <FieldRow
        label={copy.label}
        value={text}
        onChangeText={(next) => {
          setText(next);
          setInvalid(false);
        }}
        placeholder={copy.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        multiline
        autoFocus
      />
      {invalid ? <StatusNote text={copy.invalid} tone="danger" live /> : null}
      {settings.onboardingDone ? <StatusNote text={copy.replaces} /> : null}
      <ListGroup footer={copy.emailHint}>
        <ListRow icon="mail" label={copy.emailRow} onPress={() => router.push('/restore/email')} />
      </ListGroup>
    </Screen>
  );
}
