import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { bootAndHydrate, useAppStore } from '../data';
import type { BootResult } from '../db/boot';
import { DevJump } from '../dev/DevJump';
import { SessionGate } from '../features/session/SessionGate';
import { PlatformEffects } from '../platform/PlatformEffects';
import { lockPortrait } from '../platform/orientation';
import { FatalError } from '../design/components';
import { ThemeProvider, useSchemeStore } from '../design/theme';
import { lockedScreenOptions, stackScreenOptions } from '../design/navigation';

/**
 * Root layout. Nothing renders until Outfit is loaded: a flash of system sans is
 * worse than a blank page.
 *
 * Two worlds behind guards: onboarding until it is done, the app after. The session
 * routes are full screen and cannot be swiped away (ADR-0009 still holds there);
 * SessionGate pulls the app into them whenever a session is running.
 *
 * The database is opened, migrated and read into the stores here, synchronously,
 * before anything renders (ADR-0017): op-sqlite is sync, so no screen has to handle
 * a "not loaded yet" state, and the onboarding guard below sees the persisted flag
 * on its first pass instead of flashing the wrong world.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold });

  // A failure here is fatal rather than thrown: this is a local-first app, the database
  // is the product, and a red box is not an answer we can give a user.
  const [boot] = useState<BootResult | Error>(() => {
    try {
      return bootAndHydrate(Date.now());
    } catch (caught) {
      return caught instanceof Error ? caught : new Error(String(caught));
    }
  });

  const onboardingDone = useAppStore((state) => state.settings.onboardingDone);
  const scheme = useSchemeStore((state) => state.scheme);

  // Portrait everywhere; the active session unlocks itself while it is on screen.
  useEffect(() => {
    lockPortrait();
  }, []);

  useEffect(() => {
    if (__DEV__ && !(boot instanceof Error)) {
      console.log(
        `db ready · ${boot.activityCount} activities · ${boot.orphansRecovered} orphan(s) recovered · demo ${boot.demoSeeded ? 'seeded' : 'kept'}`,
      );
    }
  }, [boot]);

  if (boot instanceof Error) {
    return <FatalError message={boot.message} />;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {__DEV__ ? <DevJump /> : null}
      <PlatformEffects />
      <SessionGate />
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Protected guard={!onboardingDone}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboardingDone}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="session/active" options={lockedScreenOptions} />
          <Stack.Screen name="session/complete" options={lockedScreenOptions} />
          <Stack.Screen name="session/exit" options={lockedScreenOptions} />
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
          <Stack.Screen name="settings/circle" />
          <Stack.Screen name="habits/edit" />
          <Stack.Screen name="habits/new" />
          <Stack.Screen name="circle/index" />
          <Stack.Screen name="circle/invite" />
          <Stack.Screen name="circle/join" />
          <Stack.Screen name="circle/challenge" />
          <Stack.Screen name="circle/challenge-new" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
