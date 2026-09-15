import { router } from 'expo-router';

import { Button, HeroObject, Screen, Stack, Text } from '../../design/components';
import { ThemeScope } from '../../design/components';

/** The first thing the app shows: a dark page, the object, and one button. */
export default function WelcomeScreen() {
  return (
    <ThemeScope scheme="dark">
      <Screen
        footer={
          <>
            <Button label="Empezar" onPress={() => router.push('/onboarding/goal')} />
            <Text variant="caption" tone="tertiary" align="center">
              Al continuar aceptás los Términos y la Privacidad.
            </Text>
          </>
        }
      >
        <Stack grow justify="center" align="center">
          <HeroObject size="lg" />
        </Stack>
        <Stack gap="sm" align="center">
          <Text variant="title" align="center">
            Tu tiempo es tuyo.
          </Text>
          <Text variant="title" align="center">
            Volvé a lo que importa.
          </Text>
          <Text variant="label" tone="secondary" align="center">
            Sin cuenta, sin nube. Todo queda en tu teléfono.
          </Text>
        </Stack>
      </Screen>
    </ThemeScope>
  );
}
