import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_500Medium } from '@expo-google-fonts/literata/500Medium';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { bootDatabase, type BootResult } from '../db/boot';
import { FatalError } from '../design/components/FatalError';
import { stackScreenOptions } from '../design/navigation';
import { useSessionStore } from '../store/session';

/**
 * Root layout. Serif is 70% of the effect, so nothing renders until Literata is
 * loaded — a flash of system sans is worse than a blank paper screen.
 *
 * Two routes only: the pager host and the session. The horizontal swipe happens
 * inside the pager, not here — a Stack does not swipe. See ADR-0009.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Literata_400Regular, Literata_500Medium });

  // Synchronous on purpose: op-sqlite is sync, so the database is ready before the
  // first render and no screen has to handle a "not migrated yet" state.
  //
  // A failure here is fatal rather than thrown: this is a local-first app, the database
  // is the product, and a red box is not an answer we can give a user.
  const [boot] = useState<BootResult | Error>(() => {
    try {
      const result = bootDatabase(Date.now());
      // Hydrate in the same breath, after orphan recovery: anything still `running` is
      // a session the user legitimately left open. Doing it in an effect would render
      // the home screen once with `empezar` before it corrected itself to `seguir`.
      useSessionStore.getState().hydrate();
      return result;
    } catch (caught) {
      return caught instanceof Error ? caught : new Error(String(caught));
    }
  });

  useEffect(() => {
    if (__DEV__ && !(boot instanceof Error)) {
      console.log(
        `db ready · ${boot.activityCount} activities · ${boot.orphansRecovered} orphan(s) recovered`,
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
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" />
      {/* No back gesture: a swipe must not be able to abandon a deep session. */}
      <Stack.Screen name="session" options={{ gestureEnabled: false }} />
      <Stack.Screen name="config/session" />
      <Stack.Screen name="config/habit" />
      <Stack.Screen name="config/week" />
      <Stack.Screen name="config/habit-edit" />
    </Stack>
  );
}
