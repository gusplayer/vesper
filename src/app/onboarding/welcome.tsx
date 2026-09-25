import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { Alert, Linking } from 'react-native';

import { Button, HeroObject, Screen, StatusNote, Stack, Tappable, Text, ThemeScope } from '../../design/components';
import { MINUTE } from '../../domain/time';
import { lastUseWhen, welcomeChoices, type FoundUse } from '../../features/restore/foundUse';
import { useFoundVesper, type FoundBackup } from '../../features/restore/useFoundVesper';
import { useRestoreTarget } from '../../features/restore/restoreTarget';
import { useLocale, useStrings, type Strings } from '../../i18n';
import { useNow } from '../../lib/useNow';
import { startApart, startFresh, type StartFreshOutcome } from '../../platform/hooks/useIdentitySync';
import { readStoredCredential } from '../../platform/identity';

/**
 * The first thing the app shows: a dark page, the object, and one button.
 *
 * When this phone holds the key of a previous Vesper — a new phone that found it in the
 * keychain that travels, or a reinstall (ADR-0048 §4) — the one button restores it, and
 * a line says from when its backup is. "Empezar de cero" deletes that Vesper on the
 * server after a confirmation, and a new one is born. "Tengo una clave" is always there,
 * for the key pasted from a password manager or another system.
 *
 * Unless that Vesper is still in use on another device (ADR-0050 §9): an iPad on the
 * iPhone's Apple account finds the iPhone's key. Used within 30 days, the line says when,
 * and the choices are "Traerlo aquí" — a restore, confirmed first, because the other
 * device stops backing up and seeing the circle — and "Empezar aparte", an identity of
 * this device's own that deletes nothing. Nothing destructive is offered for a Vesper
 * the server could not be asked about.
 */
const TERMS_URL = 'https://vesper-azure.vercel.app/terms';
const PRIVACY_URL = 'https://vesper-azure.vercel.app/privacy';

function foundLine(
  backup: FoundBackup,
  use: FoundUse,
  copy: Strings['identity']['welcome'],
  tag: string,
  now: number,
): string {
  if (use.kind === 'inUse') {
    return copy.inUse(lastUseWhen(use.lastSeenAt, now, copy.ago));
  }
  switch (backup.kind) {
    case 'loading':
      return copy.found;
    case 'unknown':
      return copy.foundUnknown;
    case 'none':
      return copy.foundNoBackup;
    case 'at':
      return copy.foundBackup(new Intl.DateTimeFormat(tag, { dateStyle: 'long' }).format(new Date(backup.at)));
  }
}

export default function WelcomeScreen() {
  const t = useStrings();
  const { tag } = useLocale();
  const copy = t.identity.welcome;
  const { checked, found } = useFoundVesper();
  // "hace 2 horas" stays true while the screen is open: a minute's clock is enough.
  const now = useNow(MINUTE);
  const setTarget = useRestoreTarget((state) => state.setTarget);
  const [fresh, setFresh] = useState<StartFreshOutcome | 'apart' | 'busy' | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** A phone with no browser is rare and not a crash: say it, like Acerca de does. */
  const openLegal = (url: string): void => {
    Linking.openURL(url).catch(() => {
      Alert.alert(t.settings.about.linkFailed);
    });
  };

  const restore = () => {
    void readStoredCredential().then((credentials) => {
      if (credentials === null) {
        // The key went away between the look and the tap: the key screen is the way.
        router.push('/restore/key');
        return;
      }
      setTarget(credentials);
      router.push('/restore/restoring');
    });
  };

  const confirmBringHere = () => {
    Alert.alert(copy.bringHereQuestion, copy.bringHereMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: copy.bringHereConfirm, onPress: restore },
    ]);
  };

  const apart = () => {
    setFresh('busy');
    void startApart(Date.now()).then(() => {
      if (mounted.current) {
        setFresh('apart');
      }
    });
  };

  const confirmFresh = () => {
    Alert.alert(copy.freshQuestion, copy.freshMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: copy.freshConfirm,
        style: 'destructive',
        onPress: () => {
          setFresh('busy');
          void startFresh(Date.now()).then((outcome) => {
            if (mounted.current) {
              setFresh(outcome);
            }
          });
        },
      },
    ]);
  };

  // A previous Vesper, until the user decides. While the keychain is being read (a few
  // milliseconds, under the boot reveal) "Empezar" waits, so it is never tapped past one.
  const offerRestore = found !== null && fresh !== 'busy';
  const choices = found === null ? null : welcomeChoices(found.use);

  return (
    <ThemeScope scheme="dark">
      <Screen
        footer={
          <>
            {offerRestore && choices !== null ? (
              <>
                {choices.primary === 'bringHere' ? (
                  <Button label={copy.bringHere} onPress={confirmBringHere} />
                ) : (
                  <Button label={copy.restore} onPress={restore} disabled={!choices.ready} />
                )}
                {choices.secondary === 'startFresh' ? (
                  <Button label={copy.startFresh} variant="ghost" onPress={confirmFresh} />
                ) : null}
                {choices.secondary === 'startApart' ? (
                  <Button label={copy.startApart} variant="ghost" onPress={apart} />
                ) : null}
              </>
            ) : (
              <Button
                label={t.onboarding.welcome.start}
                onPress={() => router.push('/onboarding/goal')}
                disabled={!checked || fresh === 'busy'}
              />
            )}
            <Stack direction="row" justify="center">
              <Tappable onPress={() => router.push('/restore/key')} accessibilityLabel={copy.haveKey}>
                <Text variant="label" weight="medium">
                  {copy.haveKey}
                </Text>
              </Tappable>
            </Stack>
            {/* The two pages live on the web (ADR-0046), so accepting them is not a
                promise the user cannot check: each word opens its own, as a link with
                a 44 pt touch area. Consent is text that informs, so it is secondary,
                and the two words read as the tappable part. */}
            <Stack direction="row" justify="center" align="center" gap="xs" wrap>
              <Text variant="caption" tone="secondary">
                {t.onboarding.welcome.legal}
              </Text>
              <Tappable
                onPress={() => openLegal(TERMS_URL)}
                accessibilityLabel={t.onboarding.welcome.openTerms}
                accessibilityRole="link"
              >
                <Text variant="caption" weight="medium">
                  {t.onboarding.welcome.terms}
                </Text>
              </Tappable>
              <Text variant="caption" tone="secondary">
                ·
              </Text>
              <Tappable
                onPress={() => openLegal(PRIVACY_URL)}
                accessibilityLabel={t.onboarding.welcome.openPrivacy}
                accessibilityRole="link"
              >
                <Text variant="caption" weight="medium">
                  {t.onboarding.welcome.privacy}
                </Text>
              </Tappable>
            </Stack>
          </>
        }
      >
        <Stack grow justify="center" align="center">
          <HeroObject size="lg" />
        </Stack>
        <Stack gap="sm" align="center">
          <Text variant="title" align="center">
            {t.onboarding.welcome.titleLine1}
          </Text>
          <Text variant="title" align="center">
            {t.onboarding.welcome.titleLine2}
          </Text>
          <Text variant="label" tone="secondary" align="center">
            {t.onboarding.welcome.subtitle}
          </Text>
          {offerRestore ? (
            <StatusNote text={foundLine(found.backup, found.use, copy, tag, now)} align="center" live />
          ) : null}
          {fresh === 'pending' ? <StatusNote text={copy.freshPending} align="center" live /> : null}
          {fresh === 'apart' ? <StatusNote text={copy.apartDone} align="center" live /> : null}
        </Stack>
      </Screen>
    </ThemeScope>
  );
}
