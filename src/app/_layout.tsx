import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useAppStore } from '../data';
import { ThemeProvider, useSchemeStore } from '../design/theme';
import { lockedScreenOptions, stackScreenOptions } from '../design/navigation';

/**
 * Root layout. Nothing renders until Outfit is loaded: a flash of system sans is
 * worse than a blank page.
 *
 * Two worlds behind guards: onboarding until it is done, the app after. The session
 * routes are full screen and cannot be swiped away (ADR-0009 still holds there).
 *
 * The prototype has no database (ADR-0016): the stores in src/data seed themselves.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold });
  const onboardingDone = useAppStore((state) => state.settings.onboardingDone);
  const scheme = useSchemeStore((state) => state.scheme);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Protected guard={!onboardingDone}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboardingDone}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="session/active" options={lockedScreenOptions} />
          <Stack.Screen name="session/complete" options={lockedScreenOptions} />
          <Stack.Screen name="modes/index" />
          <Stack.Screen name="modes/edit" />
          <Stack.Screen name="modes/apps" />
          <Stack.Screen name="modes/websites" />
          <Stack.Screen name="modes/ideas" />
          <Stack.Screen name="schedules/edit" />
          <Stack.Screen name="settings/rules" />
          <Stack.Screen name="settings/emergency" />
          <Stack.Screen name="settings/notifications" />
          <Stack.Screen name="settings/live-activities" />
          <Stack.Screen name="settings/health" />
          <Stack.Screen name="settings/life" />
          <Stack.Screen name="settings/help" />
          <Stack.Screen name="settings/about" />
          <Stack.Screen name="habits/edit" />
          <Stack.Screen name="habits/new" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
