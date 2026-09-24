import { router } from 'expo-router';

import { Linking } from 'react-native';

import { Button, HeroObject, Screen, Stack, Tappable, Text , ThemeScope } from '../../design/components';
import { useStrings } from '../../i18n';

/** The first thing the app shows: a dark page, the object, and one button. */
const TERMS_URL = 'https://vesper-azure.vercel.app/terms';
const PRIVACY_URL = 'https://vesper-azure.vercel.app/privacy';

/** Opening the browser is best effort: a phone without one is not an error worth a modal. */
function openLegal(url: string): void {
  void Linking.openURL(url).catch(() => undefined);
}

export default function WelcomeScreen() {
  const t = useStrings();

  return (
    <ThemeScope scheme="dark">
      <Screen
        footer={
          <>
            <Button label={t.onboarding.welcome.start} onPress={() => router.push('/onboarding/goal')} />
            {/* The two pages live on the web (ADR-0046), so accepting them is not a
                promise the user cannot check: each word opens its own. */}
            <Stack direction="row" justify="center" align="center" gap="xs">
              <Text variant="caption" tone="tertiary">
                {t.onboarding.welcome.legal}
              </Text>
              <Tappable
                onPress={() => openLegal(TERMS_URL)}
                accessibilityLabel={t.onboarding.welcome.openTerms}
              >
                <Text variant="caption" tone="secondary">
                  {t.onboarding.welcome.terms}
                </Text>
              </Tappable>
              <Text variant="caption" tone="tertiary">
                ·
              </Text>
              <Tappable
                onPress={() => openLegal(PRIVACY_URL)}
                accessibilityLabel={t.onboarding.welcome.openPrivacy}
              >
                <Text variant="caption" tone="secondary">
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
        </Stack>
      </Screen>
    </ThemeScope>
  );
}
