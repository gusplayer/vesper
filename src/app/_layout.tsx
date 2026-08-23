import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_500Medium } from '@expo-google-fonts/literata/500Medium';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { bootDatabase, type BootResult } from '../db/boot';
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
  const [boot] = useState<BootResult>(() => bootDatabase(Date.now()));
  const hydrate = useSessionStore((state) => state.hydrate);

  // Runs after orphan recovery, so anything still `running` is a session the user
  // legitimately left open by backgrounding the app.
  useEffect(() => {
    hydrate();
  }, [hydrate, boot]);

  useEffect(() => {
    if (__DEV__) {
      console.log(
        `db ready · ${boot.activityCount} activities · ${boot.orphansRecovered} orphan(s) recovered`,
      );
    }
  }, [boot]);

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
    </Stack>
  );
}
