import { router } from 'expo-router';

import { Button, HeroObject, Screen, Stack, Text , ThemeScope } from '../../design/components';
import { useStrings } from '../../i18n';

/** The first thing the app shows: a dark page, the object, and one button. */
export default function WelcomeScreen() {
  const t = useStrings();

  return (
    <ThemeScope scheme="dark">
      <Screen
        footer={
          <>
            <Button label={t.onboarding.welcome.start} onPress={() => router.push('/onboarding/goal')} />
            <Text variant="caption" tone="tertiary" align="center">
              {t.onboarding.welcome.legal}
            </Text>
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
